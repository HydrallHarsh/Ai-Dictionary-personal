"use client";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { useAuth } from "./auth/AuthContext";

/**
 * Renders a signup form UI that registers a new user and navigates to the home page on success.
 *
 * The form collects name, email, password and confirm-password fields, uses the app authentication
 * context to perform registration, and on successful signup redirects to "/". On registration failure
 * it sets a local error message and logs the failure (UI notification is not provided here).
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
	const [_error, setError] = useState<string | null>(null);

	const { registerAction } = useAuth();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		try {
			await registerAction(email, password);
			router.push("/");
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Signup failed";
			setError(msg);
			console.log("Signup failed from signup-form component:", msg);
			//TODO: Need to add UI notification for error
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
								<FieldLabel htmlFor="name">Full Name</FieldLabel>
								<Input id="name" type="text" placeholder="John Doe" required />
							</Field>
							<Field>
								<FieldLabel htmlFor="email">Email</FieldLabel>
								<Input
									id="email"
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
											type="password"
											onChange={(e) => setPassword(e.target.value)}
											required
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor="confirm-password">
											Confirm Password
										</FieldLabel>
										<Input id="confirm-password" type="password" required />
									</Field>
								</Field>
								<FieldDescription>
									Must be at least 8 characters long.
								</FieldDescription>
							</Field>
							<Field>
								<Button type="submit">Create Account</Button>
								<FieldDescription className="text-center">
									Already have an account? <a href="/login">Sign in</a>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
			<FieldDescription className="px-6 text-center">
				By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
				and <a href="#">Privacy Policy</a>.
			</FieldDescription>
		</div>
	);
}
