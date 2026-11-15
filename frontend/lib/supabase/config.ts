/** Validate public clients and the Next.js build before bundling credentials. */
export function publicSupabaseConfig() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!url || !key) {
		throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
	}
	const parsed = new URL(url);
	if (!["http:", "https:"].includes(parsed.protocol)) {
		throw new Error("Supabase URL must use HTTP or HTTPS.");
	}
	let publicKey = key.startsWith("sb_publishable_");
	if (key.startsWith("eyJ")) {
		try {
			const payload = key.split(".")[1];
			const role = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role;
			publicKey = role === "anon";
		} catch {
			publicKey = false;
		}
	}
	if (!publicKey) {
		throw new Error("Public Supabase configuration requires a publishable or legacy anon key. Server secrets and service-role keys must never be bundled.");
	}
	return { url, key };
}
