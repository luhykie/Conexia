import { supabase } from "../supabaseConfig";

const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:8000/api";

let cachedAccessToken = null;
let cachedExpiresAt = 0;
let refreshPromise = null;
let signOutPromise = null;

export class AuthenticationError extends Error {
    constructor(message = "Your session has expired. Please sign in again.") {
        super(message);
        this.name = "AuthenticationError";
        this.status = 401;
    }
}

export function primeApiAccessToken(session) {
    cachedAccessToken = session?.access_token || null;
    cachedExpiresAt = session?.expires_at || 0;
}

export function clearApiAccessToken() {
    cachedAccessToken = null;
    cachedExpiresAt = 0;
}

function hasUsableCachedToken() {
    if (!cachedAccessToken) {
        return false;
    }

    if (!cachedExpiresAt) {
        return true;
    }

    return cachedExpiresAt - Math.floor(Date.now() / 1000) > 30;
}

async function refreshAccessToken() {
    if (!refreshPromise) {
        refreshPromise = (async () => {
            clearApiAccessToken();

            const {
                data: { session: refreshedSession },
                error: refreshError,
            } = await supabase.auth.refreshSession();

            if (refreshError || !refreshedSession?.access_token) {
                await signOutOnce();
                throw new AuthenticationError();
            }

            primeApiAccessToken(refreshedSession);

            return refreshedSession.access_token;
        })().finally(() => {
            refreshPromise = null;
        });
    }

    return refreshPromise;
}

async function signOutOnce() {
    if (!signOutPromise) {
        signOutPromise = (async () => {
            clearApiAccessToken();

            try {
                await supabase.auth.signOut();
            } catch {}
        })().finally(() => {
            signOutPromise = null;
        });
    }

    return signOutPromise;
}

async function getCurrentAccessToken(forceRefresh = false) {
    if (!forceRefresh && hasUsableCachedToken()) {
        return cachedAccessToken;
    }

    if (forceRefresh) {
        return refreshAccessToken();
    }

    const {
        data: { session },
        error,
    } = await supabase.auth.getSession();

    if (error) {
        await signOutOnce();
        throw new AuthenticationError(
            "Unable to restore your session. Please sign in again."
        );
    }

    if (session?.access_token) {
        primeApiAccessToken(session);

        return session.access_token;
    }

    return refreshAccessToken();
}

async function buildRequestHeaders(options, accessToken) {
    const isFormData =
        options.body instanceof FormData;

    return {
        ...(isFormData
            ? {}
            : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
    };
}

async function request(endpoint, options = {}) {
    const accessToken = await getCurrentAccessToken();
    let headers = await buildRequestHeaders(options, accessToken);
    
    let response = await fetch(
        `${API_URL}${endpoint}`,
        {
            ...options,
            headers,
        }
    );

    if (response.status === 401) {
        try {
            const retryToken = await getCurrentAccessToken(true);

            headers = await buildRequestHeaders(options, retryToken);
            response = await fetch(
                `${API_URL}${endpoint}`,
                {
                    ...options,
                    headers,
                }
            );
        } catch (error) {
            if (error instanceof AuthenticationError) {
                throw error;
            }

            throw new AuthenticationError();
        }
    }

    if (!response.ok) {
        let message = "Request failed.";

        try {
            const body = await response.json();
            message = body.message || message;
        } catch {}

        if (response.status === 401) {
            throw new AuthenticationError(message);
        }

        throw new Error(message);
    }

    if (options.responseType === "blob") {
        return {
            blob: await response.blob(),
            response,
        };
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

export function apiGet(endpoint) {
    return request(endpoint);
}

export function withQuery(endpoint, params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            query.set(key, value);
        }
    });

    const queryString = query.toString();

    return queryString ? `${endpoint}?${queryString}` : endpoint;
}

export function apiPost(endpoint, body) {
    return request(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
    });
}

export function apiPostForm(endpoint, formData) {
    return request(endpoint, {
        method: "POST",
        body: formData,
    });
}

export function apiPatch(endpoint, body) {
    return request(endpoint, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

export function apiDelete(endpoint) {
    return request(endpoint, {
        method: "DELETE",
    });
}

export function apiGetBlob(endpoint) {
    return request(endpoint, {
        responseType: "blob",
    });
}
