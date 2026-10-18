"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthContext";
import {
	ApiRequestError,
	listBookmarks,
	removeBookmark,
	saveBookmark,
} from "@/lib/api";

/**
 * The signed-in user's saved post ids.
 *
 * Ids live here rather than in each button so the article page's toggle and the
 * saved list can't disagree: saving from one updates the other without a
 * refetch. Only ids are held — the post rows themselves are read from Supabase
 * by whichever page needs them.
 *
 * The list is restored once per sign-in, not on every mount, so navigating
 * between articles doesn't re-request it.
 */

interface BookmarksContextType {
	/** Newest first, as the API returns them. */
	savedIds: string[];
	loading: boolean;
	restoreError: { message: string; sessionExpired: boolean } | null;
	isSaved: (postId: string) => boolean;
	retryRestore: () => Promise<void>;
	toggle: (postId: string) => Promise<void>;
}

const BookmarksContext = createContext<BookmarksContextType | null>(null);

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
	const { user, refreshSession } = useAuth();
	const [savedIds, setSavedIds] = useState<string[]>([]);
	const [savedIdsFor, setSavedIdsFor] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [restoreError, setRestoreError] = useState<{
		userId: string;
		message: string;
		sessionExpired: boolean;
	} | null>(null);

	// Which user the current list belongs to, so a restore fires when the
	// identity changes but not on every render.
	const loadedFor = useRef<string | null>(null);
	// Ids with a request in flight. A second click on the same button would
	// otherwise race its own first request and end up in the wrong state.
	const pending = useRef(new Set<string>());
	const currentUserId = useRef<string | null>(user?.id ?? null);
	currentUserId.current = user?.id ?? null;
	const currentSavedIds = user?.id === savedIdsFor ? savedIds : [];
	const currentRestoreError =
		restoreError?.userId === user?.id ? restoreError : null;
	const isLoading =
		loading || Boolean(user && savedIdsFor !== user.id && !currentRestoreError);

	/**
	 * Read the list for `userId`.
	 *
	 * Pulled out of the effect so an explicit retry can call it directly. The
	 * earlier version bumped a counter that the effect depended on, which meant
	 * the retry only worked as a side effect of re-running the effect — and only
	 * because the error path had cleared `loadedFor`. Two pieces of state were
	 * silently coupled; a direct call has no such dependency.
	 *
	 * Returns whether the read succeeded, so `retryRestore` can report a failure
	 * instead of resolving as though it worked.
	 */
	const loadSavedIds = useCallback(async (userId: string): Promise<boolean> => {
		loadedFor.current = userId;
		setSavedIds([]);
		setSavedIdsFor(userId);
		setRestoreError(null);
		setLoading(true);

		try {
			const bookmarks = await listBookmarks();
			// The account may have changed while the request was in flight.
			if (currentUserId.current === userId) {
				setSavedIds(bookmarks.map((bookmark) => bookmark.post_id));
			}
			return true;
		} catch (error) {
			// Keep this user eligible for a later explicit retry. The error is
			// exposed to the UI so a failed read cannot look like an empty list.
			loadedFor.current = null;
			if (currentUserId.current === userId) {
				setRestoreError({
					userId,
					message:
						error instanceof Error
							? error.message
							: "Could not load your saved posts",
					sessionExpired:
						error instanceof ApiRequestError && error.status === 401,
				});
			}
			return false;
		} finally {
			if (currentUserId.current === userId) {
				setLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		if (!user) {
			loadedFor.current = null;
			setSavedIds([]);
			setSavedIdsFor(null);
			setRestoreError(null);
			setLoading(false);
			return;
		}

		if (loadedFor.current === user.id) {
			return;
		}

		void loadSavedIds(user.id);
	}, [user, loadSavedIds]);

	const isSaved = useCallback(
		(postId: string) => currentSavedIds.includes(postId),
		[currentSavedIds],
	);

	const retryRestore = useCallback(async () => {
		if (!user || isLoading) {
			return;
		}

		if (currentRestoreError?.sessionExpired) {
			try {
				const refreshedUser = await refreshSession();
				if (!refreshedUser) {
					return;
				}
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Could not check your sign-in status",
				);
				return;
			}
		}

		// A failed retry leaves `restoreError` set, so the button stays in its
		// retry state. Nothing here can loop: this only runs on an explicit click.
		const loaded = await loadSavedIds(user.id);
		if (!loaded && currentUserId.current === user.id) {
			toast.error("Saved posts still aren't available. Try again shortly.");
		}
	}, [currentRestoreError, isLoading, loadSavedIds, refreshSession, user]);

	const toggle = useCallback(
		async (postId: string) => {
			if (!user) {
				toast.error("Sign in to save posts");
				return;
			}
			const requestKey = `${user.id}:${postId}`;
			if (pending.current.has(requestKey)) {
				return;
			}

			const wasSaved = currentSavedIds.includes(postId);
			pending.current.add(requestKey);

			// Optimistic: the button flips on click and flips back if the request
			// fails. The alternative — waiting for the round trip — makes a button
			// that does nothing for a third of a second.
			setSavedIdsFor(user.id);
			setSavedIds((current) => {
				const currentForUser = savedIdsFor === user.id ? current : [];
				return wasSaved
					? currentForUser.filter((id) => id !== postId)
					: [postId, ...currentForUser];
			});

			try {
				if (wasSaved) {
					await removeBookmark(postId);
					if (currentUserId.current === user.id) {
						toast.success("Removed from saved");
					}
				} else {
					await saveBookmark(postId);
					if (currentUserId.current === user.id) {
						toast.success("Saved for later");
					}
				}
			} catch (error) {
				if (currentUserId.current === user.id) {
					setSavedIdsFor(user.id);
					setSavedIds((current) =>
						wasSaved
							? [postId, ...current.filter((id) => id !== postId)]
							: current.filter((id) => id !== postId),
					);
					toast.error(
						error instanceof Error
							? error.message
							: "Could not update saved posts",
					);
				}
			} finally {
				pending.current.delete(requestKey);
			}
		},
		[currentSavedIds, savedIdsFor, user],
	);

	const value = useMemo(
		() => ({
			savedIds: currentSavedIds,
			loading: isLoading,
			restoreError: currentRestoreError,
			isSaved,
			retryRestore,
			toggle,
		}),
		[
			currentSavedIds,
			isLoading,
			currentRestoreError,
			isSaved,
			retryRestore,
			toggle,
		],
	);

	return (
		<BookmarksContext.Provider value={value}>
			{children}
		</BookmarksContext.Provider>
	);
}

export function useBookmarks() {
	const ctx = useContext(BookmarksContext);
	if (!ctx) {
		throw new Error("useBookmarks must be used within BookmarksProvider");
	}
	return ctx;
}
