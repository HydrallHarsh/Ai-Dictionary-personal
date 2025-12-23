const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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


export async function loginUser(payload: LoginPayload): Promise<boolean> {
    try {
        const formData = new URLSearchParams();
        formData.append('grant_type', 'password');
        formData.append('username', payload.username);
        formData.append('password', payload.password);
        const response = await fetch(`${API_URL}/auth/cookie/login`, {
            method: "POST",
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData,
            credentials: "include"
        });
        if (!response.ok) {
            const data = await response.json().catch(() => { });
            throw new Error(data?.detail || "Login failed");
        }
        return true;
    }
    catch (error) {
        console.log("Error occurred while loginUser");
        throw error;
    }
}

// change in the production #prod.

export async function handleSignup(payload: RegisterPayload): Promise<RegisterResponse> {

    const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.detail || "Registration failed");
    }

    return data as RegisterResponse;
}

export async function getCurrentUser() {
    const response = await fetch(`${API_URL}/users/me`, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: "include",
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Fetching user failed");
    }
    return await response.json();
}

export async function logoutUser() {
    try {
        const response = await fetch(`${API_URL}/auth/cookie/logout`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: "include",
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error((data as any).detail || "Logout failed");
        }
    } catch (error) {
        console.error("Error occurred while logoutUser", error);
        throw error;
    }
}