"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EntryRow } from "@/components/archive/EntryRow";
import type { Archive, MonthGroup } from "@/lib/archive";
import { hueFor } from "@/lib/source-hues";
import { cn } from "@/lib/utils";

/**
 * The archive index: month distribution, filters, and the entry list.
 *
 * Filtering happens in the browser rather than through `searchParams`, because
 * reading search params opts the route out of static generation — and this list
 * is identical for every visitor. The whole archive ships once, pre-rendered,
 * and narrowing it after that costs no request.
 *
 * That trade is only affordable because `lib/archive.ts` cuts each summary to an
 * excerpt first. The full summaries average ~1,130 characters across 244
 * entries; sending them all would put roughly 275KB of prose into the payload
 * for text that is clamped to two lines.
 *
 * The month strip is navigation and data at once: bar height is that month's
 * share of the archive, and each bar jumps to its group. It re-scales as you
 * filter, so a source filter also answers "when was this publication active".
 */

const PLOT_H = 56;

function anchorFor(key: string) {
	return key === "undated" ? "undated" : `m-${key.slice(0, 7)}`;
}

/** "July 2026" → "Jul ’26"; the strip has ~56px per column. */
function shortLabel(label: string) {
	const [month, year] = label.split(" ");
	if (!year) {
		return month.slice(0, 3);
	}
	return `${month.slice(0, 3)} ’${year.slice(2)}`;
}

function normalise(value: string) {
	return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function MonthStrip({ groups }: { groups: MonthGroup[] }) {
	// One bar is not a distribution.
	if (groups.length < 2) {
		return null;
	}

	const max = Math.max(...groups.map((group) => group.entries.length));

	// The list is newest-first, but a time axis is not: read left to right, the
	// groups' own order put July before April. Reversed here rather than in
	// `buildArchive`, so the chart runs forwards and the list still opens on the
	// most recent entry. "Undated" has no position on a time axis, so it stays at
	// the end instead of leading the row.
	const columns = [...groups].reverse();
	const undated = columns.findIndex((group) => group.key === "undated");
	if (undated !== -1) {
		columns.push(...columns.splice(undated, 1));
	}

	return (
		// Bars share the row rather than sitting at a fixed width: four 56px columns
		// left two thirds of the strip empty and read as a cropped chart. The whole
		// strip is capped to the prose measure so a four-month archive doesn't
		// stretch four bars across 1200px either.
		<div className="flex max-w-2xl items-end gap-1.5 overflow-x-auto pb-1">
			{columns.map((group) => {
				const count = group.entries.length;
				// A floor of 3px, so a one-entry month is still a visible mark
				// rather than a gap in the row.
				const height = Math.max(3, Math.round((count / max) * PLOT_H));

				return (
					<a
						key={group.key}
						href={`#${anchorFor(group.key)}`}
						className="group flex min-w-12 flex-1 flex-col items-center rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						<span className="text-[11px] text-muted-foreground tabular-nums">
							{count}
						</span>
						<span
							className="mt-1.5 flex w-full items-end"
							style={{ height: PLOT_H }}
						>
							<span
								className="w-full rounded-t-[3px] bg-gradient-to-t from-brand to-brand/55 opacity-85 transition-opacity group-hover:opacity-100"
								style={{ height }}
							/>
						</span>
						<span className="mt-2 text-[11px] whitespace-nowrap text-muted-foreground transition-colors group-hover:text-foreground">
							{shortLabel(group.label)}
						</span>
					</a>
				);
			})}
		</div>
	);
}

export function ArchiveIndex({ archive }: { archive: Archive }) {
	const [query, setQuery] = useState("");
	const [source, setSource] = useState<string | null>(null);

	const groups = useMemo(() => {
		const term = normalise(query);
		if (!term && !source) {
			return archive.groups;
		}

		return archive.groups
			.map((group) => ({
				...group,
				entries: group.entries.filter((entry) => {
					if (source && entry.source !== source) {
						return false;
					}
					if (!term) {
						return true;
					}
					// Title and excerpt only. Matching the source name here would
					// make a search for "TechCrunch" return that publication's whole
					// output, which is what the source filter is for.
					return (
						normalise(entry.title).includes(term) ||
						normalise(entry.excerpt).includes(term)
					);
				}),
			}))
			.filter((group) => group.entries.length > 0);
	}, [archive.groups, query, source]);

	const shown = groups.reduce((sum, group) => sum + group.entries.length, 0);
	const filtered = Boolean(query.trim()) || source !== null;

	return (
		<>
			<section className="border-t border-border/60 pt-8">
				<div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
					<h2 className="text-sm font-medium">Published by month</h2>
					<p className="text-sm text-muted-foreground">
						{filtered
							? `${shown} of ${archive.total} entries`
							: `${archive.total} entries`}
					</p>
				</div>
				<div className="mt-5">
					<MonthStrip groups={groups} />
				</div>
			</section>

			<section className="mt-12">
				<div className="flex flex-col gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-center lg:justify-between">
					<div className="relative w-full max-w-sm">
						<Search
							className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search titles and summaries"
							aria-label="Search the archive"
							className="h-10 w-full rounded-full border border-border bg-transparent pr-4 pl-9 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
						/>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						{/* The selected pill carries the accent instead of inverting to solid
						    ink. Only ever one is selected, so this is a single small object
						    telling you which filter is on — and indigo-600 rather than the
						    lighter accent step because white text on indigo-500 lands at
						    4.3:1, under AA for 12px type. */}
						<button
							type="button"
							onClick={() => setSource(null)}
							aria-pressed={source === null}
							className={cn(
								"rounded-full border px-3 py-1.5 text-xs transition-colors",
								source === null
									? "border-indigo-600 bg-indigo-600 text-white"
									: "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
							)}
						>
							All sources
						</button>
						{/* Each source pill wears its own hue as a dot, so the filter row is
						    the legend for the list below it — you learn the mapping here and
						    then read it down the column. Selection is still carried by the
						    solid fill and `aria-pressed`, never by the dot alone. */}
						{archive.sources.map((item) => {
							const hue = hueFor(item.name);
							const active = source === item.name;

							return (
								<button
									key={item.name}
									type="button"
									onClick={() =>
										setSource((current) =>
											current === item.name ? null : item.name,
										)
									}
									aria-pressed={active}
									className={cn(
										"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
										active
											? "border-indigo-600 bg-indigo-600 text-white"
											: "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
									)}
								>
									<span
										className={cn(
											"h-1.5 w-1.5 shrink-0 rounded-full",
											active ? "bg-white/70" : hue.dot,
										)}
										aria-hidden="true"
									/>
									{item.name}
									<span className="tabular-nums opacity-60">{item.count}</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* Announced rather than shown-only, so the result of a filter is
				    audible to a screen reader that isn't tracking the list. */}
				<p className="sr-only" role="status" aria-live="polite">
					{shown} entries shown
				</p>

				{groups.length === 0 ? (
					<div className="py-24 text-center">
						<p className="text-lg font-bold">Nothing matches that.</p>
						<p className="mt-2 text-sm text-muted-foreground">
							{query.trim() ? (
								<>
									No entry mentions{" "}
									<span className="text-foreground">
										&ldquo;{query.trim()}&rdquo;
									</span>
									{source ? ` in ${source}` : ""}.
								</>
							) : (
								`No entries from ${source}.`
							)}
						</p>
						<button
							type="button"
							onClick={() => {
								setQuery("");
								setSource(null);
							}}
							className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary/50"
						>
							<X className="h-3.5 w-3.5" aria-hidden="true" />
							Clear filters
						</button>
					</div>
				) : (
					groups.map((group) => (
						<div key={group.key} className="mt-10 first:mt-8">
							{/* Sticky so the month you're reading in stays named while
							    you scroll a 100-entry group. Offset by the 64px navbar,
							    which is itself sticky — at `top-0` the month header slid
							    underneath it and the group went unlabelled. */}
							<div
								id={anchorFor(group.key)}
								className="sticky top-16 z-10 -mx-4 flex scroll-mt-16 items-baseline justify-between gap-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm"
							>
								<h2 className="text-sm font-medium tracking-wide uppercase">
									{group.label}
								</h2>
								<span className="text-xs text-muted-foreground tabular-nums">
									{group.entries.length}
								</span>
							</div>
							{/* The month header already draws a rule; the first entry's own
							    top border would double it. */}
							<ol className="[&>li:first-child>a]:border-t-0">
								{group.entries.map((entry) => (
									<EntryRow key={entry.slug} entry={entry} />
								))}
							</ol>
							<div className="border-t border-border/60" />
						</div>
					))
				)}
			</section>
		</>
	);
}
