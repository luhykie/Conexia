import { supabase } from "../lib/supabaseClient";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function resolveAuthToken(account) {
  if (account?.email && import.meta.env.DEV) {
    return `dev:${account.email}`;
  }

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return data.session.access_token;
    }
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

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(`Unable to reach the backend at ${API_BASE}. ${error.message}`);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || "Request failed.";
    const details = payload?.errors ? Object.values(payload.errors).flat().join(" ") : "";
    throw new Error(`HTTP ${response.status}: ${details ? `${message} ${details}` : message}`);
  }

  return payload;
}

export async function checkApiHealth() {
  return apiRequest("/api/health");
}
