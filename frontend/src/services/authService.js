import { supabase } from "../supabaseConfig";

function oldRoleToRoleKey(role) {
  return {
    super_admin: "super",
    iro_admin: "admin",
    iro_staff: "staff",
    legal_counsel: "legal",
    department_staff: "department",
  }[String(role || "").trim().toLowerCase()] || "";
}

function isMissingRoleKey(error) {
  return error?.code === "42703" ||
    String(error?.message || "").includes("profiles.role_key does not exist");
}

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

  return loadAccountForUser(authData.user);
}

export async function loadAccountForUser(user) {
  let { data: profile, error: profileError } = await supabase
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
    .eq("id", user.id)
    .single();

  // Keep login working while the shared Supabase project transitions from
  // the original Laravel profile columns to the group Supabase schema.
  if (profileError && isMissingRoleKey(profileError)) {
    ({ data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        role,
        department_id,
        is_active
      `)
      .eq("id", user.id)
      .single());
  }

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

  const isActive = "status" in profile
    ? profile.status === "active"
    : Boolean(profile.is_active);

  if (!isActive) {
    await supabase.auth.signOut();
    throw new Error("This account is inactive.");
  }

  let office = profile.office || "No assigned office";

  if (!profile.office && profile.department_id) {
    const { data: department } = await supabase
      .from("departments")
      .select("name")
      .eq("id", profile.department_id)
      .maybeSingle();
    office = department?.name || office;
  }

  const roleKey = profile.role_key
    ? (profile.role_key === "super_admin" ? "super" : profile.role_key)
    : oldRoleToRoleKey(profile.role);

  if (!roleKey) {
    await supabase.auth.signOut();
    throw new Error(`Unsupported profile role: ${profile.role}`);
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: user.email,
    role: profile.role,
    roleKey,
    departmentId: profile.department_id,
    department: profile.department,
    office,
  };
}

export async function signOutFromSupabase() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
