"use client";

import { BookmarkIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { EntryRow } from "@/components/archive/EntryRow";
import { useAuth } from "@/components/auth/AuthContext";
import { useBookmarks } from "@/components/bookmarks/BookmarksContext";
import { useSavedPosts } from "@/components/bookmarks/useSavedPosts";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";

/**
 * The reader's own list.
 *
 * Client-side because it depends on a cookie the server render can't see: the
 * FastAPI session is set on `127.0.0.1:8000` and is sent to `/bookmarks`, not
 * to the Next server. The page therefore renders from the same bookmark ids the
 * toggle buttons use, which also means it updates live when something is
 * unsaved — no refetch, no stale row.
 */
export default function SavedPage() {
	const { user, loading: authLoading } = useAuth();
	const {
		savedIds,
		loading: bookmarksLoading,
		restoreError,
		retryRestore,
	} = useBookmarks();
	const { entries, loading, error } = useSavedPosts(savedIds, Boolean(user));

	const busy = authLoading || bookmarksLoading || loading;

	return (
		<div className="relative min-h-screen bg-background text-foreground">
			<div
				className="ambient-wash pointer-events-none absolute inset-x-0 top-0 h-[22rem] opacity-70"
				aria-hidden="true"
			/>
			<main className="relative container mx-auto max-w-[1200px] px-4 pt-14 pb-20 sm:px-6 md:pt-20">
				<header className="max-w-2xl">
					<p className="flex items-center gap-2.5 text-sm text-muted-foreground">
						<span
							className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
							aria-hidden="true"
						/>
						Kept for later
					</p>
					<h1 className="mt-5 text-5xl leading-[1.05] font-bold tracking-tighter sm:text-6xl">
						Saved
					</h1>
					<p className="mt-6 text-lg leading-relaxed text-muted-foreground">
						Entries you bookmarked. They stay here until you remove them.
					</p>
				</header>

				<section className="mt-12 border-t border-border/60 pt-8">
					{authLoading ? (
						<Centered>
							<Loader2
								className="h-5 w-5 animate-spin text-muted-foreground"
								aria-hidden="true"
							/>
							<span className="sr-only">Loading</span>
						</Centered>
					) : !user ? (
						<Empty
							title="Sign in to keep a list."
							body="Saved posts are tied to your account, so they follow you between visits."
							action={
								<Button asChild variant="outline" className="rounded-full">
									<Link href="/login">Log in</Link>
								</Button>
							}
						/>
					) : restoreError ? (
						<Empty
							title="Your saved list didn't load."
							body={restoreError.message}
							action={
								<Button
									variant="outline"
									className="rounded-full"
									onClick={() => void retryRestore()}
								>
									{restoreError.sessionExpired ? "Check sign-in" : "Try again"}
								</Button>
							}
						/>
					) : error ? (
						<Empty
							title="That list didn't load."
							body={error}
							action={
								<Button
									variant="outline"
									className="rounded-full"
									onClick={() => window.location.reload()}
								>
									Try again
								</Button>
							}
						/>
					) : busy && entries.length === 0 ? (
						<Centered>
							<Loader2
								className="h-5 w-5 animate-spin text-muted-foreground"
								aria-hidden="true"
							/>
							<span className="sr-only">Loading saved posts</span>
						</Centered>
					) : entries.length === 0 ? (
						<Empty
							title="Nothing saved yet."
							body="Open an entry and use Save in its masthead to keep it here."
							action={
								<Button asChild variant="outline" className="rounded-full">
									<Link href="/blog">Browse the archive</Link>
								</Button>
							}
						/>
					) : (
						<>
							<div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
								<h2 className="text-sm font-medium tracking-wide uppercase">
									{entries.length} {entries.length === 1 ? "entry" : "entries"}
								</h2>
							</div>
							<ol className="[&>li:first-child>a]:border-t-0">
								{entries.map((entry) => (
									<EntryRow key={entry.slug} entry={entry} />
								))}
							</ol>
						</>
					)}
				</section>
			</main>
			<Footer />
		</div>
	);
}

function Centered({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
			{children}
		</div>
	);
}

function Empty({
	title,
	body,
	action,
}: {
	title: string;
	body: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="py-20 text-center">
			<BookmarkIcon
				className="mx-auto h-6 w-6 text-muted-foreground/70"
				aria-hidden="true"
			/>
			<p className="mt-4 text-lg font-bold">{title}</p>
			<p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
				{body}
			</p>
			{action ? <div className="mt-6">{action}</div> : null}
		</div>
	);
}
