"use client";
import { GalleryVerticalEnd } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { LoginForm } from "@/components/login-form";

/**
 * Render the login page and redirect authenticated users to the homepage.
 *
 * Keeps the form mounted while authentication loads. When a user is authenticated,
 * performs a client-side navigation to "/"; otherwise displays the login UI.
 *
 * @returns The login page JSX element.
 */
export default function LoginPage() {
	const { user, loading } = useAuth();

	const router = useRouter();

	useEffect(() => {
		if (!loading && user) {
			router.push("/");
		}
	}, [user, loading, router]);
	// Keep the form mounted while signing in so pending feedback remains visible.

	return (
		<div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				{/* The mark is the accent, not solid ink. On a page that is one form on
				    one flat surface it's the only colour there's room for, and it's the
				    same indigo the rest of the site uses — so arriving here from the
				    archive doesn't feel like arriving somewhere else. `indigo-600` in
				    both themes: the glyph is white, and white on `indigo-500` is 4.3:1. */}
				<Link
					href="/"
					className="flex items-center gap-2 self-center font-medium"
				>
					<div className="flex size-6 items-center justify-center rounded-md bg-indigo-600 text-white">
						<GalleryVerticalEnd className="size-4" />
					</div>
					AI Dictionary
				</Link>
				<LoginForm />
			</div>
		</div>
	);
}
