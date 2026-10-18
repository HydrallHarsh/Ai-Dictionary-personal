const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export class ApiRequestError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "ApiRequestError";
	}
}

// No Login Response Interface because response returns No Content (204) on successful login
export interface LoginPayload {
	username: string;
	password: string;
}
export interface RegisterPayload {
	email: string;
	password: string;
}

export interface RegisterResponse {
	id: string;
	email: string;
	is_active: boolean;
	is_verified: boolean;
	is_superuser: boolean;
}

/**
 * Attempt to authenticate a user using a cookie-based session by POSTing form-encoded credentials.
 *
 * @param payload - Object containing `username` and `password` to submit for authentication
 * @returns `true` if authentication succeeded
 * @throws Error when the server responds with a non-ok status (the error message will prefer the server-provided `detail` when available) or when a network/error occurs
 *  * Note: fastapi-users with cookie-based authentication does not return any content in the response body.
 * Instead, it returns a 204 No Content status and sets the authentication cookie via the `Set-Cookie` header,
 * which is automatically handled by the browser when `credentials: "include"` is specified.
 */
export async function loginUser(payload: LoginPayload): Promise<boolean> {
	try {
		const formData = new URLSearchParams();
		formData.append("grant_type", "password");
		formData.append("username", payload.username);
		formData.append("password", payload.password);
		const response = await fetch(`${API_URL}/auth/cookie/login`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: formData,
			credentials: "include",
		});
		if (!response.ok) {
			const data = await response.json().catch(() => {});
			throw new Error(data?.detail || "Login failed");
		}
		return true;
	} catch (error) {
		console.log("Error occurred while loginUser");
		throw error;
	}
}

/**
 * Create a new user account using the provided registration data.
 *
 * @param payload - Registration fields (expected: `email` and `password`)
 * @returns The created user's data: `id`, `email`, `is_active`, `is_verified`, and `is_superuser`
 * @throws Error if the registration request fails; message contains server `detail` when available
 */

export async function handleSignup(
	payload: RegisterPayload,
): Promise<RegisterResponse> {
	const response = await fetch(`${API_URL}/auth/register`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	const data = await response.json();

	if (!response.ok) {
		throw new Error(data.detail || "Registration failed");
	}

	return data as RegisterResponse;
}

/**
 * Retrieves the currently authenticated user's profile from the API.
 *
 * @returns The parsed JSON object representing the current user.
 * @throws Error when the request fails; the error message is the server's `detail` field when available.
 */
export async function getCurrentUser() {
	const response = await fetch(`${API_URL}/users/me`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	if (!response.ok) {
		const data = await response.json().catch(() => ({}));
		throw new ApiRequestError(
			data.detail || "Fetching user failed",
			response.status,
		);
	}
	return await response.json();
}

/**
 * Logs out the current user by calling the API's cookie-based logout endpoint.
 *
 * @throws Error when the server responds with a non-ok status — the error message is the server's `detail` field if present, otherwise "Logout failed".
 * @throws Error rethrowing underlying network or unexpected errors encountered while performing the request.
 */
export async function logoutUser() {
	try {
		const response = await fetch(`${API_URL}/auth/cookie/logout`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
		});

		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.detail || "Logout failed");
		}
	} catch (error) {
		console.error("Error occurred while logoutUser", error);
		throw error;
	}
}

/** One saved post. `post_id` is the `posts.id` in Supabase. */
export interface Bookmark {
	post_id: string;
	created_at: string;
}

/**
 * The signed-in user's saved posts, newest first.
 *
 * @throws Error when the request fails, including when the session is no longer
 * valid. The provider only calls this for a signed-in user, so a 401 must not
 * be interpreted as a genuinely empty saved list.
 */
export async function listBookmarks(): Promise<Bookmark[]> {
	const response = await fetch(`${API_URL}/bookmarks`, {
		method: "GET",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
	});

	if (!response.ok) {
		const data = await response.json().catch(() => ({}));
		throw new ApiRequestError(
			response.status === 401
				? "Your session expired. Sign in again to load saved posts."
				: data.detail || "Fetching saved posts failed",
			response.status,
		);
	}

	return await response.json();
}

/**
 * Save a post for the signed-in user. Idempotent on the server.
 *
 * @throws Error if the user is not signed in or the request fails.
 */
export async function saveBookmark(postId: string): Promise<void> {
	const response = await fetch(`${API_URL}/bookmarks/${postId}`, {
		method: "PUT",
		credentials: "include",
	});

	if (!response.ok) {
		throw new Error(
			response.status === 401
				? "Sign in to save posts"
				: "Could not save this post",
		);
	}
}

/**
 * Remove a post from the signed-in user's saved list. Idempotent on the server.
 *
 * @throws Error if the user is not signed in or the request fails.
 */
export async function removeBookmark(postId: string): Promise<void> {
	const response = await fetch(`${API_URL}/bookmarks/${postId}`, {
		method: "DELETE",
		credentials: "include",
	});

	if (!response.ok) {
		throw new Error(
			response.status === 401
				? "Sign in to manage saved posts"
				: "Could not remove this post",
		);
	}
}
