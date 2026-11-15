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
 * Renders a signup form UI that registers a new user and navigates to the home page on success.
 *
 * The form collects email, password and confirm-password fields, uses the app authentication
 * context to perform registration, and on successful signup redirects to "/". On registration failure
 * it displays a toast notification with the error message.
 *
 * @param props - Standard div element props; `className` may be provided to style the outer container.
 * @returns A JSX element containing the signup form and related descriptions/links.
 */
export function SignupForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const { registerAction } = useAuth();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (submitting) return;
		if (password.length < 8 || password !== confirmation) {
			toast.error(password.length < 8 ? "Password must be at least 8 characters long." : "Passwords do not match.");
			return;
		}
		setSubmitting(true);
		try {
			await registerAction(email, password);
			router.push("/");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Signup failed");
		} finally {
			setSubmitting(false);
		}
	};
	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader className="text-center">
					<CardTitle className="text-xl">Create your account</CardTitle>
					<CardDescription>
						Enter your email below to create your account
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="email">Email</FieldLabel>
								<Input
									id="email"
									autoComplete="email"
									type="email"
									placeholder="m@example.com"
									onChange={(e) => setEmail(e.target.value)}
									required
								/>
							</Field>
							<Field>
								<Field className="grid grid-cols-2 gap-4">
									<Field>
										<FieldLabel htmlFor="password">Password</FieldLabel>
										<Input
											id="password"
											autoComplete="new-password"
											minLength={8}
											type="password"
											onChange={(e) => setPassword(e.target.value)}
											required
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor="confirm-password">
											Confirm Password
										</FieldLabel>
										<Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
									</Field>
								</Field>
								<FieldDescription>
									Must be at least 8 characters long.
								</FieldDescription>
							</Field>
							<Field>
								<Button type="submit" disabled={submitting}>{submitting ? "Creating account…" : "Create Account"}</Button>
								<FieldDescription className="text-center">
									Already have an account? <a href="/login">Sign in</a>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
