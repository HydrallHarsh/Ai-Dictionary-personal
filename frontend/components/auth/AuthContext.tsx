"use client";

import { getCurrentUser, handleSignup, loginUser, logoutUser } from "@/lib/api";
import { toast } from "sonner";
import { useState, createContext, useContext, useEffect } from "react";

interface User {
	id: string;
	email: string;
	is_active: boolean;
	is_superuser: boolean;
	is_verified: boolean;
}

interface AuthContextType {
	user: User | null;
	loading: boolean;
	loginAction: (email: string, password: string) => Promise<void>;
	logoutAction: () => Promise<void>;
	registerAction: (email: string, password: string) => Promise<void>;
}
// Creating Auth Context
const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Provides authentication state and actions to descendant components.
 *
 * Restores the current user on mount, and exposes `user`, `loading`,
 * `loginAction`, `logoutAction`, and `registerAction` through context.
 *
 * @returns A React context provider element that supplies authentication state and actions to its children
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const restoreSession = async () => {
			try {
				setLoading(true);
				const currUser = await getCurrentUser();
				setUser(currUser);
			} catch {
				// Silently fail - this is expected for users without an active session
				setUser(null);
			} finally {
				setLoading(false);
			}
		};
		restoreSession();
	}, []);

	async function loginAction(email: string, password: string) {
		setLoading(true);
		try {
			console.log("loginAction called in AuthProvider");
			await loginUser({
				username: email,
				password: password,
			});
			const currUser = await getCurrentUser();
			setUser(currUser);
		} finally {
			setLoading(false);
		}
	}

	async function logoutAction() {
		try {
			await logoutUser();
			setUser(null);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Logout failed");
			console.error("Logout failed in AuthProvider", error);
			throw error;
		}
	}

	async function registerAction(email: string, password: string) {
		try {
			console.log("registerAction called in AuthProvider");
			await handleSignup({ email, password });
			await loginAction(email, password); // Auto-login after successful registration
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Registration failed",
			);
			console.log("Registration failed in AuthProvider", error);
			throw error;
		}
	}
	return (
		<AuthContext.Provider
			value={{ user, loading, loginAction, logoutAction, registerAction }}
		>
			{children}
		</AuthContext.Provider>
	);
}

/**
 * Access the authentication context provided by AuthProvider.
 *
 * @returns The current authentication context with `user`, `loading`, `loginAction`, `logoutAction`, and `registerAction`.
 * @throws Error if called outside of an AuthProvider.
 */
export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return ctx;
}
