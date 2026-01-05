"use client";
import { GalleryVerticalEnd } from "lucide-react";

import { SignupForm } from "@/components/signup-form";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { useEffect } from "react";

/**
 * Render the signup page and redirect authenticated users to the home route.
 *
 * Uses authentication context to check `user` and `loading`; if authentication is still loading the component renders `null`, and if a user is present it navigates to `/`. When unauthenticated and not loading, it renders the signup layout with branding and the `SignupForm` component.
 *
 * @returns The signup page JSX element, or `null` while authentication state is loading.
 */
export default function SignupPage() {
	const { user, loading } = useAuth();

	const router = useRouter();

	useEffect(() => {
		if (!loading && user) {
			router.push("/");
		}
	}, [user, loading, router]);
	if (loading) return null;
	return (
		<div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<a href="#" className="flex items-center gap-2 self-center font-medium">
					<div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
						<GalleryVerticalEnd className="size-4" />
					</div>
					AI Dictionary
				</a>
				<SignupForm />
			</div>
		</div>
	);
}
