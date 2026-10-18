"use client";

import { Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBookmarks } from "./BookmarksContext";

/**
 * Save / unsave the article currently open.
 *
 * The label states what the button does, not what the post is — "Save" while
 * unsaved, "Saved" once it is. Filled with the brand tint only when saved, so
 * the state is legible without relying on the icon fill alone; `aria-pressed`
 * carries it for assistive tech.
 *
 * Logged-out readers are sent to the login page instead of being shown a
 * button that can only fail.
 */
export function BookmarkButton({ postId }: { postId: string }) {
	const { user, loading: authLoading } = useAuth();
	const { isSaved, loading, restoreError, retryRestore, toggle } =
		useBookmarks();
	const router = useRouter();

	if (authLoading || (user && loading)) {
		// Reserve the button's footprint so the masthead doesn't reflow when the
		// saved list arrives.
		return <div className="h-8 w-24 rounded-full border border-border/60" />;
	}
	if (user && restoreError) {
		return (
			<Button
				variant="outline"
				size="sm"
				aria-label="Retry loading saved status"
				onClick={() => void retryRestore()}
				className="rounded-full border-border px-3"
			>
				{restoreError.sessionExpired ? "Check sign-in" : "Retry saved status"}
			</Button>
		);
	}

	const saved = user ? isSaved(postId) : false;

	return (
		<Button
			variant="outline"
			size="sm"
			aria-pressed={saved}
			onClick={() => {
				if (!user) {
					router.push("/login");
					return;
				}
				void toggle(postId);
			}}
			className={cn(
				"rounded-full border-border px-3",
				saved && "border-brand/40 bg-brand-subtle text-foreground",
			)}
		>
			<Bookmark
				className={cn("h-3.5 w-3.5", saved && "fill-brand text-brand")}
				aria-hidden="true"
			/>
			{saved ? "Saved" : "Save"}
		</Button>
	);
}
