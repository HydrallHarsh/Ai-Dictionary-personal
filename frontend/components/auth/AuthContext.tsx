"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	ApiRequestError,
	getCurrentUser,
	handleSignup,
	loginUser,
	logoutUser,
} from "@/lib/api";

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
	refreshSession: () => Promise<User | null>;
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
 * `refreshSession`, `loginAction`, `logoutAction`, and `registerAction` through
 * context.
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

	async function refreshSession(): Promise<User | null> {
		try {
			const currUser = (await getCurrentUser()) as User;
			setUser(currUser);
			return currUser;
		} catch (error) {
			if (error instanceof ApiRequestError && error.status === 401) {
				setUser(null);
				return null;
			}
			throw error;
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
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Registration failed",
			);
			console.log("Registration failed in AuthProvider", error);
			throw error;
		}
		try {
			await loginAction(email, password);
		} catch (loginError) {
			toast.error(
				"Registration succeeded, but auto-login failed. Please log in manually.",
			);
			console.log("Auto-login failed after registration", loginError);
		}
	}
	return (
		<AuthContext.Provider
			value={{
				user,
				loading,
				refreshSession,
				loginAction,
				logoutAction,
				registerAction,
			}}
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
