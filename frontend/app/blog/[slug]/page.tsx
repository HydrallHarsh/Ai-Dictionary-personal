import { ArrowLeft, ArrowRight, ArrowUpRight, Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/article/ArticleBody";
import { TableOfContents } from "@/components/article/TableOfContents";
import { BookmarkButton } from "@/components/bookmarks/BookmarkButton";
import { Footer } from "@/components/Footer";
import { ScrollProgress } from "@/components/scroll-progress";
import { normaliseSource } from "@/lib/archive";
import { type BlogPost, getPublicArticle } from "@/lib/blog-data";
import {
	extractHeadings,
	readingTime,
	sanitizeArticleMarkdown,
	standfirst,
} from "@/lib/markdown";
import { hueFor } from "@/lib/source-hues";

/**
 * One article.
 *
 * The previous page wrapped every section in a framer-motion entrance animation,
 * including a title block that hydrated to a hardcoded "Deep Dive" heading and a
 * stale author. This version keeps the body server-rendered: motion on a wall of
 * prose costs legibility and buys nothing, and the page is static — it's served
 * from the ISR cache the moment it's generated.
 *
 * Layout is the same edition style as the rest of the site: left-aligned masthead,
 * a contents rail on the right, hairline rules, indigo as the only accent.
 */

interface PageProps {
	params: Promise<{
		slug: string;
	}>;
}

/** Regenerated hourly, like the rest of the site. */
export const revalidate = 3600;

/**
 * Empty on purpose.
 *
 * A dynamic segment with no `generateStaticParams` at all is treated as fully
 * dynamic: the responses come back `Cache-Control: no-store`, so every view of
 * every article re-runs the corpus query. Declaring the function — even with
 * nothing in it — opts the segment into on-demand ISR instead: the first request
 * for a slug renders it, and the next hour of requests are served from the cache.
 *
 * Nothing is listed because rendering an article costs one full-corpus fetch and
 * there are 244 of them; paying that 244 times at build time to save the first
 * visitor of each a single query is the wrong trade.
 */
export function generateStaticParams() {
	return [];
}

export async function generateMetadata({ params }: PageProps) {
	const { slug } = await params;
	const result = await getPublicArticle(slug);
	if (!result) {
		return { title: "Not found" };
	}

	const title = titleOf(result.post);
	const summary = result.post.blocks.find(
		(block): block is Extract<typeof block, { type: "summary" }> =>
			block.type === "summary",
	)?.data.content;

	return {
		title,
		description:
			summary && summary !== "No summary available."
				? summary.slice(0, 200)
				: undefined,
	};
}

export default async function BlogPostPage({ params }: PageProps) {
	const { slug } = await params;
	const result = await getPublicArticle(slug);

	if (!result) {
		notFound();
	}

	const { post, newer, older } = result;
	const titleBlock = post.blocks.find(
		(block): block is Extract<typeof block, { type: "title" }> =>
			block.type === "title",
	);
	const summaryBlock = post.blocks.find(
		(block): block is Extract<typeof block, { type: "summary" }> =>
			block.type === "summary",
	);
	const explanationBlock = post.blocks.find(
		(block): block is Extract<typeof block, { type: "explanation" }> =>
			block.type === "explanation",
	);

	// Same helper the metadata title uses, so the tab and the page can't disagree
	// — it falls back to `metadata.title` before "Untitled".
	const title = titleOf(post);
	const date = titleBlock?.data.date ?? "";
	const difficulty = titleBlock?.data.difficulty?.toLowerCase().trim();

	// Folded to the archive's spelling before it reaches `hueFor`. The ingest
	// adapters record one publication as "MarkTechPost", "Marktech Post" and
	// "MarktechPost", and the hue is a hash of the raw string, so the unfolded
	// name gives the same source a different dot here than on the rows it was
	// clicked from — which is the one thing the dot is there to rule out.
	const source = post.metadata?.source
		? normaliseSource(post.metadata.source)
		: null;
	const rawMarkdown = explanationBlock?.data.content ?? "";
	const markdown = sanitizeArticleMarkdown(rawMarkdown);
	const headings = extractHeadings(markdown);

	// Measured from the body, not read from `estimated_time` — that field is
	// absent on 178 of 244 entries and `blog-data` fills it with "5 min read".
	const minutes = readingTime(markdown);

	const metaRows = [date && `Published ${date}`, minutes]
		.filter(Boolean)
		.join(" · ");

	// "No summary available." is `blog-data`'s placeholder, not prose — printing
	// it at display size would make the absence of a summary the loudest thing on
	// the page.
	const summary = summaryBlock?.data.content ?? "";
	const lede =
		summary && summary !== "No summary available." ? standfirst(summary) : "";

	return (
		<div className="relative min-h-screen bg-background text-foreground">
			<ScrollProgress />
			{/* Shallower than the landing wash — an article is a reading surface, and
			    the masthead is the only part that should carry any tint at all. */}
			<div
				className="ambient-wash pointer-events-none absolute inset-x-0 top-0 h-[24rem] opacity-70"
				aria-hidden="true"
			/>
			<main className="relative container mx-auto max-w-[1200px] px-4 pt-12 pb-20 sm:px-6 md:pt-16">
				{/* A quieter breadcrumb than the old three-part chain: the archive is
				    the only real way back, and Home is one click away in the nav. */}
				<nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
					<Link
						href="/blog"
						className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
					>
						<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
						Archive
					</Link>
				</nav>

				{/* One grid over the masthead and the body, so the rail can span both
				    rows. It used to sit inside the header, which made the header its
				    containing block — `sticky` then released it the moment the header
				    scrolled off, taking the section list away exactly when the reader
				    reached the sections it lists. */}
				<div className="mt-10 grid grid-cols-1 gap-x-16 lg:grid-cols-[minmax(0,1fr)_18rem]">
					<header className="max-w-3xl lg:col-start-1 lg:row-start-1">
						<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
							{source ? (
								/* The same source dot as the archive rows, so a publication
								   keeps one colour across the two places it appears. */
								<span className="inline-flex items-center gap-2">
									<span
										className={`h-1.5 w-1.5 shrink-0 rounded-full ${hueFor(source).dot}`}
										aria-hidden="true"
									/>
									{source}
								</span>
							) : null}
							{difficulty === "intermediate" || difficulty === "advanced" ? (
								<>
									<span aria-hidden="true">·</span>
									<span className="capitalize">{difficulty}</span>
								</>
							) : null}
						</p>

						<h1 className="mt-5 text-4xl leading-[1.08] font-bold tracking-tighter sm:text-5xl md:text-6xl">
							{title}
						</h1>

						<div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
							{metaRows ? (
								<p className="flex items-center gap-2 text-sm text-muted-foreground">
									<Clock className="h-3.5 w-3.5" aria-hidden="true" />
									{metaRows}
								</p>
							) : null}
							{/* The bookmark is the one action on the page, so it sits with
							    the metadata rather than floating over the prose. */}
							<BookmarkButton postId={post.id} />
						</div>

						{lede ? (
							/* Serif and upright — italic at any real length is a
							   paragraph you skip rather than a standfirst you read.
							   Cut to its opening sentences by `standfirst`: the full
							   summaries run ~1,130 characters and restate the whole
							   article, which the body below then says again.

							   The wash is the faintest step of the accent — enough to
							   set the standfirst apart from the body it introduces
							   without drawing a card around it. */
							<p className="mt-8 max-w-[38rem] rounded-r-lg border-l-2 border-brand bg-brand-subtle py-4 pr-5 pl-5 font-serif text-xl leading-snug text-foreground/85 md:text-2xl">
								{lede}
							</p>
						) : null}
					</header>

					{/* The rail: section names, plus a way forward when you finish.
					    Spans both rows so it stays sticky the length of the article;
					    desktop only, where there's a column for it to sit in. */}
					<aside className="hidden lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block">
						{/* `top-24` clears the 64px sticky navbar — at `top-10` the rail's
						    own "Contents" label sat underneath it. Matches the
						    `scroll-mt-24` on body headings, so a rail link lands its
						    heading exactly where the rail's own top edge is.

						    Capped and scrollable because the rail is pinned for the whole
						    article now, and the longest documents carry enough headings to
						    run past the bottom of the window. */}
						<div className="sticky top-24 max-h-[calc(100vh-8rem)] space-y-10 overflow-y-auto">
							<TableOfContents headings={headings} />
							<Link
								href="/blog"
								className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
							>
								Browse the archive
								<ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
							</Link>
						</div>
					</aside>

					<div className="mt-12 border-t border-border/60 pt-10 md:mt-16 lg:col-start-1 lg:row-start-2">
						<article className="max-w-3xl">
							{/* Mobile and tablet still get the section list — it collapses
							    into a single column above the body. */}
							<div className="mb-10 lg:hidden">
								<TableOfContents headings={headings} />
							</div>

							<ArticleBody markdown={rawMarkdown} />

							{/* Direction out of the article: the neighbouring entries,
							    in the same order the archive lists them. */}
							<nav
								aria-label="Adjacent articles"
								className="mt-16 grid grid-cols-1 gap-4 border-t border-border/60 pt-8 sm:grid-cols-2"
							>
								{older ? (
									<Link
										href={`/blog/${older.slug}`}
										className="group flex flex-col gap-2 rounded-2xl border border-border p-5 transition-colors hover:bg-secondary/40"
									>
										<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
											<ArrowLeft
												className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
												aria-hidden="true"
											/>
											Older
										</span>
										<span className="text-sm leading-snug font-semibold group-hover:text-brand">
											{titleOf(older)}
										</span>
									</Link>
								) : (
									<span />
								)}
								{newer ? (
									<Link
										href={`/blog/${newer.slug}`}
										className="group flex flex-col items-end gap-2 rounded-2xl border border-border p-5 text-right transition-colors hover:bg-secondary/40"
									>
										<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
											Newer
											<ArrowRight
												className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
												aria-hidden="true"
											/>
										</span>
										<span className="text-sm leading-snug font-semibold group-hover:text-brand">
											{titleOf(newer)}
										</span>
									</Link>
								) : (
									<span />
								)}
							</nav>
						</article>
					</div>
				</div>
			</main>
			<Footer />
		</div>
	);
}

function titleOf(post: BlogPost) {
	const block = post.blocks.find(
		(entry): entry is Extract<typeof entry, { type: "title" }> =>
			entry.type === "title",
	);
	return block?.data.content ?? post.metadata?.title ?? "Untitled";
}
