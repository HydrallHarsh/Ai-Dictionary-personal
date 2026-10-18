import type { NextConfig } from "next";
import { SUPABASE_STORAGE_PREFIX, supabaseImageHost } from "./lib/image-hosts";

/** Local Supabase only exists while you're developing against it. */
const isDev = process.env.NODE_ENV === "development";

const supabaseHost = supabaseImageHost();
if (!supabaseHost) {
	console.warn(
		"next.config: NEXT_PUBLIC_SUPABASE_URL is unset or unparseable — remote images will not be optimized.",
	);
}

const nextConfig: NextConfig = {
	images: {
		// Local IPs are rejected by the optimizer unless this is on, so without it
		// the 127.0.0.1 entry below is inert and dev images 400. It stays off
		// outside development, where fetching a private address on behalf of a
		// request is an SSRF hole rather than a convenience.
		dangerouslyAllowLocalIP: isDev,
		// Only hosts we actually serve images from. Each entry here widens what the
		// optimizer will fetch and re-serve from our own origin, so giphy and
		// pixabay are gone — they were template leftovers with no reference in the
		// codebase. Supabase storage stays: article markdown can embed images.
		//
		// The host is derived from NEXT_PUBLIC_SUPABASE_URL rather than written as
		// `*.supabase.co`, which would have matched every Supabase project on the
		// internet, not just ours.
		remotePatterns: [
			...(supabaseHost
				? [
						{
							protocol: "https" as const,
							hostname: supabaseHost,
							pathname: `${SUPABASE_STORAGE_PREFIX}**`,
						},
					]
				: []),
			...(isDev
				? [
						{
							protocol: "http" as const,
							hostname: "127.0.0.1",
							port: "54321",
						},
					]
				: []),
		],
	},
};

export default nextConfig;
