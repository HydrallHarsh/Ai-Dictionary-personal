import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

/**
 * Article markdown repair and heading extraction.
 *
 * The generator's output has two consistent artifacts that render badly:
 *
 * 1. **A leading H1.** 175 of 244 bodies open with one, and it is never the
 *    headline the page displays — the display title is the source's headline
 *    ("China's robot-hand unicorn Linkerbot is hunting a $6bn valuation") while
 *    the body writes its own ("Linkerbot: A Pioneer in Dexterous Robotic
 *    Hands"). Rendering both gives the article two competing headlines and two
 *    H1s. The source headline is the more informative of the two and is already
 *    the page's H1, so the body's is dropped.
 *
 * 2. **Setext underlines below ATX headings.** `# Heading` followed by a line
 *    of `=====` is not a setext heading — the ATX line already closed the
 *    block, so the underline renders as a paragraph of equals signs. The `-----`
 *    form is worse: it renders as a horizontal rule, so the corpus is full of
 *    stray dividers directly under headings. 147 of these across 244 documents.
 *
 * An underline directly below *paragraph* text is a real setext heading, and a
 * `---` after a blank line is a real thematic break. Both are kept — but the
 * setext form is rewritten to its ATX equivalent, because the contents list is
 * read off the `#`-prefixed lines and a setext heading would otherwise appear in
 * the body without appearing in the rail.
 *
 * Everything here is markup normalisation. No prose is rewritten.
 */

export type Heading = {
	id: string;
	text: string;
	level: 2 | 3;
};

const ATX_HEADING = /^(#{1,6})\s+\S/;
const SETEXT_UNDERLINE = /^(={3,}|-{3,})\s*$/;
const FENCE = /^\s*(```|~~~)/;

/**
 * Lines a setext underline can legally turn into a heading.
 *
 * Excludes list markers, blockquotes, table rows and indented code: `- item`
 * followed by `---` is a list then a divider, not a heading called "- item".
 */
const PARAGRAPH_TEXT = /^(?![ \t]|[-*+>|]|\d+[.)]\s)\S/;

export function sanitizeArticleMarkdown(markdown: string): string {
	const lines = markdown.split(/\r?\n/);
	const out: string[] = [];
	let droppedLeadingH1 = false;
	let inFence = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Inside a fence everything is verbatim — `# load the model` is a comment
		// in someone's Python, not a heading, and `---` may be YAML.
		if (FENCE.test(line)) {
			inFence = !inFence;
			out.push(line);
			continue;
		}
		if (inFence) {
			out.push(line);
			continue;
		}

		// The body's own H1, only when it is the document's first heading.
		if (!droppedLeadingH1 && /^#\s+\S/.test(line)) {
			const seenHeadingAlready = out.some((prev) => ATX_HEADING.test(prev));
			if (!seenHeadingAlready) {
				droppedLeadingH1 = true;
				continue;
			}
		}

		// Three documents carry a second H1 further down. Demote rather than drop:
		// it's a real section, but the page already has its H1, and leaving it at
		// level 1 would put it outside the H2/H3 range the contents list reads —
		// so the body and the contents rail would disagree about the section list.
		if (/^#\s+\S/.test(line)) {
			out.push(line.replace(/^#/, "##"));
			continue;
		}

		if (SETEXT_UNDERLINE.test(line)) {
			const previous = out[out.length - 1] ?? "";

			// Walk back past blank lines to find what this claims to underline.
			let j = out.length - 1;
			while (j >= 0 && out[j].trim() === "") {
				j--;
			}
			if (j >= 0 && ATX_HEADING.test(out[j])) {
				continue;
			}

			// Directly below paragraph text: a real setext heading. Rewrite it as
			// ATX so `extractHeadings` sees it. `=` is level 1, which we demote for
			// the same reason as above; `-` is already level 2.
			if (previous.trim() !== "" && PARAGRAPH_TEXT.test(previous)) {
				out[out.length - 1] = `## ${previous.trim()}`;
				continue;
			}

			// A run of `=` with nothing above it to underline renders as a paragraph
			// of equals signs. A `---` in the same position is a genuine divider.
			if (line.trimStart().startsWith("=")) {
				continue;
			}
		}

		out.push(line);
	}

	return out.join("\n").replace(/^\n+/, "");
}

/**
 * GitHub-style anchor slugs, with the same de-duplication the extractor and the
 * renderer both need — a document with two "Conclusion" headings must produce
 * `conclusion` and `conclusion-1` in both places, or the contents links point
 * at the wrong section.
 *
 * Returns a stateful function: create one per render pass, never share it.
 */
export function createSlugger() {
	const seen = new Map<string, number>();

	return (text: string) => {
		const base =
			text
				.toLowerCase()
				.trim()
				.replace(/[^\p{L}\p{N}\s-]/gu, "")
				.replace(/\s+/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "") || "section";

		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		return count === 0 ? base : `${base}-${count}`;
	};
}

const headingParser = unified().use(remarkParse).use(remarkGfm);

/**
 * A heading's display text, using the same Markdown parser and GFM rules as the
 * article renderer. This handles inline markup and the complete set of
 * character references consistently in the contents rail and rendered IDs.
 */
export function headingText(markdown: string): string {
	const tree = headingParser.parse(`## ${markdown}`);
	const heading = tree.children.find((node) => node.type === "heading");
	return heading ? nodeText(heading).trim() : markdown.trim();
}

/**
 * The contents list, taken from the sanitized markdown.
 *
 * H2 and H3 only. H1 is the page title, and H4+ is below the granularity
 * anyone navigates by.
 */
export function extractHeadings(sanitized: string): Heading[] {
	const slugify = createSlugger();
	const headings: Heading[] = [];
	let inFence = false;

	for (const line of sanitized.split(/\r?\n/)) {
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) {
			continue;
		}

		const match = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
		if (!match) {
			continue;
		}
		const text = headingText(match[2]);

		headings.push({
			id: slugify(text),
			text,
			level: match[1].length === 2 ? 2 : 3,
		});
	}

	return headings;
}

/** Flatten a hast node to its text, so a heading can be slugged at render time. */
export function nodeText(node: unknown): string {
	if (!node || typeof node !== "object") {
		return "";
	}
	const candidate = node as { value?: unknown; children?: unknown };
	if (typeof candidate.value === "string") {
		return candidate.value;
	}
	if (Array.isArray(candidate.children)) {
		return candidate.children.map(nodeText).join("");
	}
	return "";
}

/**
 * The generator addressing the request instead of the article.
 *
 * Ten summaries in the corpus open this way — "I can summarize the content for
 * you.", "I generated a summary but it seems I have to provide it in a specific
 * format. Here is the summary:". It was harmless while the summary was a wall of
 * small text nobody finished; as a standfirst at display size it becomes the
 * first sentence anyone reads.
 *
 * The explicit hand-off is taken last-match-wins, because one row narrates a
 * failed attempt and *then* hands off. The `[^:.]` run allows the qualifier some
 * of them carry ("a summary of the content provided:") while stopping at a full
 * stop, so the pattern can never swallow a sentence of real prose.
 */
const HANDOFF =
	/here(?:'s|\s+is|\s+are)?\s+(?:a|the)\s+summary\b[^:.\n]{0,60}[:\-—]\s*/gi;

/** A leading first-person sentence about the act of summarizing. */
const META_OPENER =
	/^\s*i\s+(?:can|will|have|am|'ll)\b[^.!?:]{0,120}[.!?:]\s*/i;

function stripGeneratorPreamble(text: string): string {
	let out = text;

	let cut = 0;
	HANDOFF.lastIndex = 0;
	let match = HANDOFF.exec(out);
	while (match !== null) {
		cut = match.index + match[0].length;
		match = HANDOFF.exec(out);
	}
	if (cut > 0) {
		out = out.slice(cut);
	}

	return out.replace(META_OPENER, "").trim();
}

/**
 * Target length for a standfirst. Two lines at the article measure, near enough.
 *
 * A sentence that would push past this is still kept whole if it is the first
 * one — a truncated opening sentence reads as broken markup, where a slightly
 * long one just reads as a long sentence.
 */
const STANDFIRST_TARGET = 230;

/** Never take more than this, however the sentences fall. */
const STANDFIRST_MAX = 340;

/**
 * The opening of the summary, as a standfirst.
 *
 * The generator's summaries average ~1,130 characters and restate the entire
 * article: the one in the screenshot ran thirteen lines of large serif and
 * covered the funding round, the investors, the founder's background and his
 * Harvard exit — all of which the body then says again in its own sections. Set
 * at display size above the article it read as the piece printed twice, and the
 * reader hits the real opening already having read it.
 *
 * So the page takes the first sentence or two and stops. The rest isn't shown
 * anywhere, because the body is the long version — there is nothing in the tail
 * of the summary that the article doesn't already carry.
 *
 * Splitting on `[.!?] ` rather than a sentence segmenter: these are plain news
 * summaries, and the abbreviations that would fool it ("U.S.", "Inc.") are
 * followed by a capitalised word either way, so the worst case is a break one
 * sentence early.
 */
export function standfirst(summary: string): string {
	const clean = stripGeneratorPreamble(summary.replace(/\s+/g, " ").trim());
	if (clean.length <= STANDFIRST_TARGET) {
		return clean;
	}

	// Keep the trailing punctuation with the sentence it closes.
	const sentences = clean.match(/[^.!?]+[.!?]+(?:\s|$)/g);
	if (!sentences) {
		return clean.slice(0, STANDFIRST_MAX).trim();
	}

	let out = "";
	for (const sentence of sentences) {
		const next = (out + sentence).trim();
		// The first sentence goes in whatever its length, so the standfirst is
		// never an empty string or a fragment.
		if (out && next.length > STANDFIRST_TARGET) {
			break;
		}
		out = next;
		if (out.length >= STANDFIRST_TARGET) {
			break;
		}
	}

	return (out || clean).slice(0, STANDFIRST_MAX).trim();
}

/** Adult silent-reading speed for non-fiction prose, rounded to something round. */
const WORDS_PER_MINUTE = 220;

/** Below this, there is no body to measure — the fetch fell back to a stub. */
const MIN_WORDS = 40;

/**
 * How long the article actually takes to read.
 *
 * `blog-data` fills a missing `estimated_time` with the string "5 min read", and
 * 178 of the 244 entries are missing it — so three quarters of the archive was
 * printing a number nobody had measured, in a column that looks measured. The
 * body is always present, so count it instead: one rule, applied to every entry,
 * true by construction.
 *
 * Markup is stripped first, or a fenced code block would inflate the count with
 * punctuation nobody reads word by word.
 */
export function readingTime(markdown: string): string | null {
	const words = markdown
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`[^`]*`/g, " ")
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/[#>*_~|-]/g, " ")
		.split(/\s+/)
		.filter((token) => /[\p{L}\p{N}]/u.test(token)).length;

	if (words < MIN_WORDS) {
		return null;
	}
	return `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min read`;
}
