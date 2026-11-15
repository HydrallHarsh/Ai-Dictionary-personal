"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "./auth/AuthContext";

/**
 * Render the supported email/password login flow with a pending submit state.
 *
 * The form invokes the app's authentication flow when submitted and navigates to the root path on successful login.
 *
 * @returns The JSX element for the login UI
 */
export function LoginForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	const [submitting, setLoad] = useState(false);

	const router = useRouter(); //Simple Router Hook for redirecting after successful login
	const { loginAction } = useAuth();

	async function handleLoginSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (submitting) return;
		setLoad(true);

		const form = e.target as HTMLFormElement;
		const username = form.email.value;
		const password = form.password.value;

		try {
			await loginAction(username, password);
			router.push("/");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Login failed");
		} finally {
			setLoad(false);
		}
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader className="text-center">
					<CardTitle className="text-xl">Welcome back</CardTitle>
					<CardDescription>
						Sign in with your email and password
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleLoginSubmit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="email">Email</FieldLabel>
								<Input
									id="email"
									autoComplete="email"
									type="email"
									placeholder="m@example.com"
									required
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="password">Password</FieldLabel>
								<Input id="password" autoComplete="current-password" type="password" required />
							</Field>
							<Field>
				<Button type="submit" disabled={submitting}>{submitting ? "Signing in..." : "Login"}</Button>
								<FieldDescription className="text-center">
									Don&apos;t have an account? <a href="/signup">Sign up</a>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>

		</div>
	);
}
