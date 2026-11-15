import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/database.types";
import { publicSupabaseConfig } from "./config";

export async function createClient() {
	const cookieStore = await cookies();

	const { url: supabaseUrl, key: supabaseKey } = publicSupabaseConfig();

	// Create a server's supabase client with newly configured cookie,
	// which could be used to maintain user's session
	return createServerClient<Database>(supabaseUrl, supabaseKey, {
		cookies: {
			getAll() {
				return cookieStore.getAll();
			},
			setAll(cookiesToSet, _headers) {
				try {
					cookiesToSet.forEach(({ name, value, options }) =>
						cookieStore.set(name, value, options),
					);
				} catch (error) {
					// The `setAll` method was called from a Server Component.
					// This can be ignored if you have proxy refreshing
					// user sessions.
					// Log for debugging in case this hides unexpected errors
					console.warn(
						"Failed to set cookies (may be called from Server Component):",
						error,
					);
				}
			},
		},
	});
}
