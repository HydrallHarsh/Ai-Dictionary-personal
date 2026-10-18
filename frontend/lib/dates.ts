/**
 * One parser for the display dates `blog-data` produces.
 *
 * Dates reach the UI already formatted — "April 23, 2026" — so anything that
 * needs to sort or group by date has to read that string back. Both the archive
 * and the article page do, and they have to agree, or the "older"/"newer" links
 * on an entry point somewhere other than the neighbours in the list you
 * clicked through from.
 */

const MONTHS = [
	"january",
	"february",
	"march",
	"april",
	"may",
	"june",
	"july",
	"august",
	"september",
	"october",
	"november",
	"december",
];

const DISPLAY_DATE = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/;

/**
 * An ISO date-time carrying no zone at all - "2026-04-23T00:00:00".
 *
 * `new Date` reads one of these in the *runtime's* zone while the formatter
 * below renders UTC, so a build east of Greenwich prints the day before. A
 * date-only string has no such problem: `new Date("2026-04-23")` is already
 * UTC midnight by spec, which is why this pattern requires the time part.
 */
const ZONELESS_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

const DISPLAY_FORMAT = new Intl.DateTimeFormat("en", {
	month: "long",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

/**
 * A post timestamp as the site displays it - "April 23, 2026".
 *
 * Shared because two places render the same column: `blog-data` builds article
 * blocks from it, and the saved page reads `posts` rows directly. If they each
 * formatted their own, a saved row could carry a different date than the
 * article it links to.
 *
 * Pinned to UTC for the reason `parseDisplayDate` reads UTC: everything
 * downstream parses this string back, so formatting in the server's zone would
 * shift entries a day either way depending on where the render ran.
 */
export function formatDisplayDate(value?: string | null) {
	if (!value) {
		return "Unknown Date";
	}

	// `published_at` and `created_at` are both `timestamptz`, so Postgres sends
	// an offset and this is a no-op today. It is here because nothing in the
	// generated types says so - the column type is the only thing standing
	// between this formatter and a silent one-day shift.
	const date = new Date(ZONELESS_DATE_TIME.test(value) ? `${value}Z` : value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return DISPLAY_FORMAT.format(date);
}

/**
 * A formatted date back to ms since epoch, or null if it isn't one.
 *
 * Read as UTC, deliberately. `Date.parse("April 23, 2026")` interprets a
 * date-only string in the *runtime's* local zone, and every label built from
 * the result is formatted with `timeZone: "UTC"` — so on a server anywhere east
 * of Greenwich the whole archive displayed one day early, and entries dated the
 * first of a month were filed under the month before.
 */
export function parseDisplayDate(
	display: string | null | undefined,
): number | null {
	const value = (display ?? "").trim();
	if (!value || value === "Unknown Date") {
		return null;
	}

	const match = value.match(DISPLAY_DATE);
	if (match) {
		const month = MONTHS.indexOf(match[1].toLowerCase());
		if (month >= 0) {
			return Date.UTC(Number(match[3]), month, Number(match[2]));
		}
	}

	// `formatDate` passes through anything it couldn't parse, so the string may
	// still be a raw ISO date — which `Date.parse` already reads as UTC.
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? null : parsed;
}
