import { supabase } from "../supabaseConfig";

const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:8000/api";

async function request(endpoint, options = {}) {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    const isFormData =
        options.body instanceof FormData;

    const headers = {
        ...(isFormData
            ? {}
            : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
    };

    if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
    }
    
    const response = await fetch(
        `${API_URL}${endpoint}`,
        {
            ...options,
            headers,
        }
    );

    if (!response.ok) {
        let message = "Request failed.";

        try {
            const body = await response.json();
            message = body.message || message;
        } catch {}

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
