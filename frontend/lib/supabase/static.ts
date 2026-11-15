import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";
import { publicSupabaseConfig } from "./config";

/**
 * Read-only client for public, cacheable pages.
 *
 * `lib/supabase/server.ts` reads `cookies()` so it can carry a user session.
 * Touching cookies opts the route out of static generation entirely, which is
 * why the homepage was rendering per-request and its `revalidate` was doing
 * nothing. Public content — the post list, the pipeline counts — is identical
 * for every visitor and needs no session, so it uses this client instead and
 * the route prerenders with ISR.
 *
 * Anything that depends on who is asking (likes, saved posts, auth) must keep
 * using the cookie-aware client.
 */
export function createStaticClient() {
	const { url: supabaseUrl, key: supabaseKey } = publicSupabaseConfig();

	return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
}
