"use client";

import { useEffect, useMemo, useState } from "react";
import { entryFromRow } from "@/lib/archive";
import { formatDisplayDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";

/**
 * Read the saved posts' rows from Supabase.
 *
 * The backend records *which* posts are saved; the posts themselves live in
 * Supabase. So the saved list is assembled from two sources: ids from our API,
 * rows from the public table — no service key on either side, and the ids can
 * only ever be the signed-in user's.
 *
 * One query for every id rather than one per post. Ids whose posts have since
 * been deleted, hidden, or migrated away simply don't come back and drop out of
 * the list.
 */

const SAVED_COLUMNS =
	"id, slug, title, summary, description, source_name, difficulty, published_at, created_at";

type SavedRow = {
	id: string;
	slug: string | null;
	title: string;
	summary: string | null;
	description: string | null;
	source_name: string | null;
	difficulty: string | null;
	published_at: string | null;
	created_at: string | null;
};

/** The set of ids, in a form that only changes when its contents do. */
function keyOf(postIds: string[]) {
	return [...postIds].sort().join(",");
}

export function useSavedPosts(postIds: string[], enabled: boolean) {
	const [rows, setRows] = useState<SavedRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Re-query when the set of saved ids changes, not when the array is rebuilt.
	const key = keyOf(postIds);

	useEffect(() => {
		const ids = key ? key.split(",") : [];

		if (!enabled || ids.length === 0) {
			setRows([]);
			setError(null);
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setRows([]);
		setError(null);

		const supabase = createClient();
		void (async () => {
			try {
				const { data, error: queryError } = await supabase
					.from("posts")
					.select(SAVED_COLUMNS)
					.in("id", ids)
					.eq("is_old_post", false);

				if (cancelled) {
					return;
				}
				if (queryError) {
					console.error("Failed to load saved posts", queryError);
					setError("Could not load the saved posts.");
				} else {
					setRows(data ?? []);
				}
			} catch (queryError) {
				if (cancelled) {
					return;
				}
				console.error("Failed to load saved posts", queryError);
				setError("Could not load the saved posts.");
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [enabled, key]);

	// Order by the API's list (newest saved first), not the query's arbitrary
	// order. Rows the query didn't return are skipped.
	const entries = useMemo(() => {
		const byId = new Map(rows.map((row) => [row.id, row]));

		return postIds
			.map((id) => byId.get(id))
			.filter((row): row is SavedRow => row !== undefined)
			.map((row) =>
				entryFromRow({
					slug: row.slug ?? row.id,
					title: row.title,
					summary: row.summary,
					body: row.description,
					source: row.source_name,
					difficulty: row.difficulty,
					displayDate: formatDisplayDate(row.published_at ?? row.created_at),
				}),
			);
	}, [postIds, rows]);

	return { entries, loading, error };
}
