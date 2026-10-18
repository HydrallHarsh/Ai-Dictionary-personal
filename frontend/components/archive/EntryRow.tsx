"use client";

import Link from "next/link";
import type { ArchiveEntry } from "@/lib/archive";
import { hueFor } from "@/lib/source-hues";
import { cn } from "@/lib/utils";

/**
 * One row of a reading list — the archive entry and a saved post render the
 * same way, because they are the same thing: an entry you can open.
 *
 * Extracted from `ArchiveIndex` so the saved page doesn't import the archive's
 * month strip and filters just to draw a row.
 */
export function EntryRow({ entry }: { entry: ArchiveEntry }) {
	const hue = hueFor(entry.source);

	return (
		<li>
			<Link
				href={`/blog/${entry.slug}`}
				className="group relative -mx-4 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-border/60 px-4 py-5 transition-colors hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:grid-cols-[4.5rem_1fr_9rem]"
			>
				{/* A source-coloured edge that only appears on hover. At rest the list
				    stays a clean ruled column; under the cursor the row picks up its
				    publication's hue on the left margin. Scale-y from the centre so it
				    grows into place rather than blinking on. */}
				<span
					className={cn(
						"absolute top-0 bottom-0 left-0 w-[3px] scale-y-0 rounded-full transition-transform duration-200 group-hover:scale-y-100",
						hue.dot,
					)}
					aria-hidden="true"
				/>

				<span className="hidden pt-1 text-sm text-muted-foreground tabular-nums sm:block">
					{entry.date}
				</span>

				<div className="min-w-0">
					<h3 className="text-base leading-snug font-bold transition-colors group-hover:text-brand md:text-lg">
						{entry.title}
					</h3>
					{entry.excerpt ? (
						<p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
							{entry.excerpt}
						</p>
					) : null}
					<div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:hidden">
						<span className="tabular-nums">{entry.date}</span>
						<span aria-hidden="true">·</span>
						<span className="inline-flex items-center gap-1.5">
							<span
								className={cn("h-1.5 w-1.5 shrink-0 rounded-full", hue.dot)}
								aria-hidden="true"
							/>
							{entry.source}
						</span>
						{entry.readingTime ? <span>· {entry.readingTime}</span> : null}
					</div>
				</div>

				{/* Same fields, given their own column once there's room, so the
				    values line up down the length of the list. */}
				<div className="hidden flex-col items-end gap-1 pt-1 text-xs text-muted-foreground sm:flex">
					<span className="inline-flex items-center gap-1.5 text-right">
						<span
							className={cn("h-1.5 w-1.5 shrink-0 rounded-full", hue.dot)}
							aria-hidden="true"
						/>
						{entry.source}
					</span>
					{entry.readingTime ? <span>{entry.readingTime}</span> : null}
					{entry.difficulty ? (
						<span className="capitalize">{entry.difficulty}</span>
					) : null}
				</div>
			</Link>
		</li>
	);
}
