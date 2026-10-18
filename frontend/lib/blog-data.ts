import { cache } from "react";
import { formatDisplayDate, parseDisplayDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { createStaticClient } from "@/lib/supabase/static";
import type { AllContentBlock, TitleBlock } from "@/types/content";

/**
 * The columns an article page reads.
 *
 * The redesign flattened `post_content`'s JSON payload into real columns on
 * `posts`, so summary, description, tags, difficulty and read time are read
 * straight off the row instead of being dug back out of a blob.
 */
const POST_COLUMNS =
	"id, slug, title, summary, description, source_name, image_url, tags, difficulty, read_time, published_at, created_at";

type PostRow = {
	id: string;
	slug: string | null;
	title: string;
	summary: string | null;
	description: string | null;
	source_name: string | null;
	image_url: string | null;
	tags: string[] | null;
	difficulty: string | null;
	read_time: string | null;
	published_at: string | null;
	created_at: string | null;
};

type PostMetadata = {
	title: string | null;
	/** `posts.source_name` — the publication an entry came from. */
	source: string | null;
};

export type BlogPost = {
	id: string;
	slug: string;
	metadata: PostMetadata;
	blocks: AllContentBlock[];
};

function asString(value: unknown, fallback = "") {
	return typeof value === "string" && value.trim() ? value : fallback;
}

const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

/**
 * `posts.difficulty` is a free `text` column guarded by a CHECK, so it arrives
 * as `string | null` and has to be narrowed before it can be a `TitleBlock`
 * difficulty. Anything unrecognised comes back undefined and the badge is
 * dropped, which is what the archive and the homepage already do with it.
 */
function asDifficulty(value: string | null): TitleBlock["data"]["difficulty"] {
	const normalised = value?.toLowerCase().trim();
	return DIFFICULTIES.find((level) => level === normalised);
}

function makeBlocks(row: PostRow): AllContentBlock[] {
	const postTitle = asString(row.title, "Untitled Post");

	const blocks: AllContentBlock[] = [
		{
			id: "title",
			type: "title",
			data: {
				content: postTitle,
				// `published_at` is the migration's coalesce of the old approved and
				// upload dates, so it is the one date every entry has. formatDisplayDate
				// passes through anything it cannot parse.
				date: formatDisplayDate(row.published_at ?? row.created_at),
				tags: row.tags ?? [],
				// Difficulty and read time are left undefined when the pipeline did
				// not record them, rather than defaulted to "beginner" and
				// "5 min read". Those defaults are why the archive and the homepage
				// both ignore these fields and recompute: a constant substituted for
				// every entry read as measured while never varying. Now that both
				// are real columns, absent means absent.
				difficulty: asDifficulty(row.difficulty),
				author: "AI Dictionary Bot",
				estimated_time: row.read_time?.trim() || undefined,
			},
		},
		{
			id: "summary",
			type: "summary",
			data: {
				content: asString(row.summary, "No summary available."),
			},
		},
	];

	const imageUrl = asString(row.image_url, "");
	if (imageUrl) {
		blocks.push({
			id: "image",
			type: "image",
			data: {
				url: imageUrl,
				caption: postTitle,
				alt: postTitle,
			},
		});
	}

	blocks.push({
		id: "description",
		type: "explanation",
		data: {
			content: asString(row.description, "No description available."),
		},
	});

	return blocks;
}

function mapRowToBlogPost(row: PostRow): BlogPost {
	return {
		id: row.id,
		// Every post written since the redesign has a slug — the CHECK constraint
		// requires one — but the migrated archive predates it, so the id stands in
		// rather than routing those entries to /blog/null.
		slug: asString(row.slug, row.id),
		metadata: { title: row.title, source: row.source_name },
		blocks: makeBlocks(row),
	};
}

/** Either Supabase client — the cookie-aware one or the public read-only one. */
type PostsClient =
	| Awaited<ReturnType<typeof createClient>>
	| ReturnType<typeof createStaticClient>;

/**
 * Every published post.
 *
 * This pages deliberately. PostgREST enforces a server-side ceiling of 1000
 * rows per response and truncates past it without saying so, and the corpus is
 * already 244 and growing — an unpaged query works right up until it silently
 * starts dropping the oldest quarter of the archive.
 *
 * Ordered by publication date rather than by id: paging needs a total order and
 * the id is a random uuid, so `range()` over it returned pages in an order that
 * meant nothing. `id` breaks ties so the sort stays deterministic across pages,
 * and undated entries sort last to match the archive.
 */
async function queryBlogPosts(supabase: PostsClient): Promise<BlogPost[]> {
	const PAGE = 1000;
	const MAX_PAGES = 50; // ~50k posts; a backstop, not an expected bound.
	const posts: BlogPost[] = [];

	for (let page = 0; page < MAX_PAGES; page++) {
		const from = page * PAGE;
		const { data, error } = await supabase
			.from("posts")
			.select(POST_COLUMNS)
			.eq("is_old_post", false)
			.order("published_at", { ascending: false, nullsFirst: false })
			.order("id", { ascending: false })
			.range(from, from + PAGE - 1);

		if (error) {
			console.error("Failed to fetch blog posts", error);
			throw new Error("Unable to load blog posts.");
		}

		for (const row of data ?? []) {
			posts.push(mapRowToBlogPost(row));
		}

		if (!data || data.length < PAGE) {
			return posts;
		}
	}

	console.warn("Blog posts hit the page ceiling — the list may be truncated.");
	return posts;
}

export async function getBlogPosts(): Promise<BlogPost[]> {
	return queryBlogPosts(await createClient());
}

/**
 * Same posts, fetched without reading cookies.
 *
 * Reading `cookies()` forces a route to render per-request. The post list is
 * the same for everyone, so pages that only display it use this and stay
 * statically generated with ISR.
 */
export const getPublicBlogPosts = cache(async (): Promise<BlogPost[]> => {
	return queryBlogPosts(createStaticClient());
});

export async function getBlogPostBySlug(slug: string) {
	const posts = await getBlogPosts();
	return posts.find((post) => post.slug === slug) ?? null;
}

/**
 * One article, plus the entries either side of it.
 *
 * The neighbours come from the same order the archive uses — by publication
 * date, newest first — not the order the query returns, so "older" and "newer"
 * agree with the list you clicked through from. `getPublicBlogPosts` is
 * memoised for the render pass, so asking for the article and its neighbours
 * costs one query, not three.
 */
export async function getPublicArticle(slug: string): Promise<{
	post: BlogPost;
	newer: BlogPost | null;
	older: BlogPost | null;
} | null> {
	const posts = await getPublicBlogPosts();

	// Same key and direction as `buildArchive`: newest first, undated last.
	const ordered = posts
		.map((post) => {
			const titleBlock = post.blocks.find((block) => block.type === "title");
			const date = titleBlock?.type === "title" ? titleBlock.data.date : "";
			return { post, time: parseDisplayDate(date) };
		})
		.sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity))
		.map((entry) => entry.post);

	const index = ordered.findIndex((post) => post.slug === slug);
	if (index === -1) {
		return null;
	}

	// Newest first, so the preceding entry is the newer one.
	return {
		post: ordered[index],
		newer: ordered[index - 1] ?? null,
		older: ordered[index + 1] ?? null,
	};
}
