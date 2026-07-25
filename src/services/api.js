import { supabase } from "../lib/supabaseClient";

const API_BASE = import.meta.env.VITE_API_URL || "";

async function resolveAuthToken(account) {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return data.session.access_token;
    }
  }

  if (account?.email && import.meta.env.DEV) {
    return `dev:${account.email}`;
  }

  return null;
}

export async function apiRequest(path, { account, method = "GET", body, headers = {} } = {}) {
  const token = await resolveAuthToken(account);
  const requestHeaders = {
    Accept: "application/json",
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...headers,
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || "Request failed.";
    const details = payload?.errors ? Object.values(payload.errors).flat().join(" ") : "";
    throw new Error(details ? `${message} ${details}` : message);
  }

  return payload;
}

export async function checkApiHealth() {
  return apiRequest("/api/health");
}
