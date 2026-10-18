import type { BlogPost } from "@/lib/blog-data";
import { parseDisplayDate } from "@/lib/dates";
import { readingTime, sanitizeArticleMarkdown } from "@/lib/markdown";

/**
 * Derivations for the archive index.
 *
 * The archive is 244 entries and growing, so the page can't just be the post
 * list rendered end to end — it needs grouping, counts, and a way to narrow.
 * Everything here is computed on the server from the same rows the article
 * pages use; nothing is fetched twice.
 *
 * The entry shape is deliberately lean. Summaries average ~1,130 characters,
 * so shipping all 244 in full would put roughly 275KB of prose into the page
 * for text that is clamped to two lines anyway. They're cut to an excerpt
 * before they ever reach the markup.
 */

/** Characters of summary kept for the list. Two lines at the list's measure. */
const EXCERPT_LENGTH = 180;

export type ArchiveEntry = {
	slug: string;
	title: string;
	excerpt: string;
	/** Formatted for display — the raw value is already normalised upstream. */
	date: string;
	/** Sort key and month-group key: ms since epoch, or null if unparseable. */
	time: number | null;
	source: string;
	difficulty: string | null;
	readingTime: string | null;
};

export type MonthGroup = {
	/** First of the month, ISO — the group key. */
	key: string;
	label: string;
	entries: ArchiveEntry[];
};

export type SourceCount = {
	name: string;
	count: number;
};

export type Archive = {
	entries: ArchiveEntry[];
	groups: MonthGroup[];
	sources: SourceCount[];
	total: number;
	/** Formatted first and last publication dates, or null if none parse. */
	span: { from: string; to: string } | null;
};

/**
 * Fold the spelling variants of a publication into one name.
 *
 * The ingest adapters record whatever the feed called itself, so one
 * publication arrives as "Marktechpost", "MarkTechPost", "Marktech Post",
 * "MarktechPost" and "MarkTech Post" — five buckets for one source. Counting
 * them separately would understate the biggest contributors and give the
 * filter five near-identical rows.
 */
const SOURCE_ALIASES = new Map<string, string>([
	["marktechpost", "MarkTechPost"],
	["thenextweb", "The Next Web"],
	["techcrunch", "TechCrunch"],
	["newshub", "NewsHub"],
]);

export function normaliseSource(raw: string | null | undefined): string {
	const trimmed = (raw ?? "").trim();
	if (!trimmed) {
		return "Unattributed";
	}
	const key = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
	return SOURCE_ALIASES.get(key) ?? trimmed;
}

/** Cut on a word boundary; a mid-word ellipsis reads as a rendering bug. */
function excerpt(text: string) {
	const clean = text.replace(/\s+/g, " ").trim();
	if (clean.length <= EXCERPT_LENGTH) {
		return clean;
	}
	const cut = clean.slice(0, EXCERPT_LENGTH);
	const lastSpace = cut.lastIndexOf(" ");
	return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, "")}…`;
}

const MONTH_LABEL = new Intl.DateTimeFormat("en", {
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});

const DAY_LABEL = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

/**
 * The fields any listing row needs, whether it came from an article page's
 * blocks or a bare `posts` row.
 */
export type EntryFields = {
	slug: string;
	title: string | null | undefined;
	summary: string | null | undefined;
	body: string | null | undefined;
	source: string | null | undefined;
	difficulty: string | null | undefined;
	/** Formatted, as `formatDisplayDate` produces it. */
	displayDate: string;
};

/**
 * Build one archive row.
 *
 * Shared by the archive (which assembles the fields from blog blocks) and the
 * saved list (which reads the same columns off `posts` directly). Both need the
 * excerpt cut, the date read back as UTC, and the same rules for which fields
 * are allowed to appear — duplicating that in the second caller is how the two
 * lists start formatting the same post differently.
 */
export function entryFromRow(fields: EntryFields): ArchiveEntry {
	const display = fields.displayDate;
	const time = parseDisplayDate(display);

	// Difficulty is only present on a quarter of the corpus. Where it's absent
	// the field is left null and the badge is dropped, rather than printing the
	// "beginner" default as though the pipeline had actually graded it.
	const rawDifficulty = fields.difficulty?.toLowerCase().trim();
	const graded =
		rawDifficulty === "intermediate" || rawDifficulty === "advanced"
			? rawDifficulty
			: null;

	const summary = fields.summary ?? "";
	const body = fields.body ?? "";

	return {
		slug: fields.slug,
		title: fields.title || "Untitled",
		excerpt: excerpt(summary === "No summary available." ? "" : summary),
		date: time === null ? display : DAY_LABEL.format(new Date(time)),
		time,
		source: normaliseSource(fields.source),
		difficulty: graded,
		// Same reasoning as difficulty, one step further: `estimated_time` is
		// absent on 178 of 244 entries and `blog-data` substitutes "5 min read",
		// so the column read as measured while being a constant. The body is
		// always there, so it's counted instead.
		readingTime: readingTime(sanitizeArticleMarkdown(body)),
	};
}

function toEntry(post: BlogPost): ArchiveEntry {
	const titleBlock = post.blocks.find((block) => block.type === "title");
	const summaryBlock = post.blocks.find((block) => block.type === "summary");
	const bodyBlock = post.blocks.find((block) => block.type === "explanation");
	const title = titleBlock?.type === "title" ? titleBlock.data : undefined;
	const summary =
		summaryBlock?.type === "summary" ? summaryBlock.data.content : "";
	const body = bodyBlock?.type === "explanation" ? bodyBlock.data.content : "";

	return entryFromRow({
		slug: post.slug,
		title: title?.content || post.metadata?.title,
		summary,
		body,
		source: post.metadata?.source,
		difficulty: title?.difficulty,
		// `blog-data` formats dates for display before we see them, and
		// `entryFromRow` parses the formatted string back to get a sort key.
		// Anything unparseable sorts last rather than throwing the list out of
		// order.
		displayDate: title?.date ?? "",
	});
}

function monthKey(time: number) {
	const date = new Date(time);
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
	).toISOString();
}

export function buildArchive(posts: BlogPost[]): Archive {
	const entries = posts
		.map(toEntry)
		// Newest first. Undated entries go to the end instead of the top, where a
		// null would otherwise sort as 0 and look like 1970.
		.sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity));

	const byMonth = new Map<string, ArchiveEntry[]>();
	const undated: ArchiveEntry[] = [];
	for (const entry of entries) {
		if (entry.time === null) {
			undated.push(entry);
			continue;
		}
		const key = monthKey(entry.time);
		const bucket = byMonth.get(key);
		if (bucket) {
			bucket.push(entry);
		} else {
			byMonth.set(key, [entry]);
		}
	}

	const groups: MonthGroup[] = [...byMonth.entries()].map(([key, items]) => ({
		key,
		label: MONTH_LABEL.format(new Date(key)),
		entries: items,
	}));
	if (undated.length > 0) {
		groups.push({ key: "undated", label: "Undated", entries: undated });
	}

	const counts = new Map<string, number>();
	for (const entry of entries) {
		counts.set(entry.source, (counts.get(entry.source) ?? 0) + 1);
	}
	const sources = [...counts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

	const times = entries
		.map((entry) => entry.time)
		.filter((time): time is number => time !== null);
	const span =
		times.length > 0
			? {
					from: MONTH_LABEL.format(new Date(Math.min(...times))),
					to: MONTH_LABEL.format(new Date(Math.max(...times))),
				}
			: null;

	return { entries, groups, sources, total: entries.length, span };
}
