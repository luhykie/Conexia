import { supabase } from "../supabaseConfig";

export async function signInWithSupabase(email, password) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (authError) {
    throw authError;
  }

  if (!authData.user) {
    throw new Error(
      "Supabase did not return an authenticated user."
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      role,
      role_key,
      office,
      department,
      status
    `)
    .eq("id", authData.user.id)
    .single();

  if (profileError) {
    await supabase.auth.signOut();
    throw profileError;
  }

  if (!profile) {
    await supabase.auth.signOut();

    throw new Error(
      "No profile is linked to this authenticated user."
    );
  }

  if (profile.status !== "active") {
    await supabase.auth.signOut();
    throw new Error("This account is inactive.");
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: authData.user.email,
    role: profile.role,
    roleKey: profile.role_key === "super_admin"
      ? "super"
      : profile.role_key,
    department: profile.department,
    office: profile.office,
  };
}

export async function signOutFromSupabase() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
