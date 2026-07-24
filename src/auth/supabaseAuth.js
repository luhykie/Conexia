import { supabase } from "../lib/supabaseClient";
import { authenticateDevAccount } from "./devAccounts";

// Signs in with email/password and returns the merged auth + profile account,
// matching the shape components already expect (roleKey, office, fullName, etc.).
export async function signInWithEmail(email, password) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (authError) {
    const devResult = authenticateDevAccount(normalizedEmail, password);
    if (devResult.ok) {
      return { ok: true, account: devResult.account };
    }

    return { ok: false, message: authError.message };
  }

  const profile = await fetchProfile(authData.user.id);

  if (!profile) {
    const devResult = authenticateDevAccount(normalizedEmail, password);
    if (devResult.ok) {
      return { ok: true, account: devResult.account };
    }

    return { ok: false, message: "No profile found for this account. Contact your Super Admin." };
  }

  return { ok: true, account: profile };
}

// Fetches the profiles row for a given auth user id and reshapes it
// into the account object the rest of the app already relies on.
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, role_key, office, department, status")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    role: data.role,
    roleKey: data.role_key,
    office: data.office,
    department: data.department,
    status: data.status,
  };
}

export async function signOut() {
  await supabase.auth.signOut();
}