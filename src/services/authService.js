import { supabase } from "../supabaseConfig";

function mapRoleToRoleKey(role) {
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  switch (normalizedRole) {
    case "super_admin":
      return "super";

    case "iro_admin":
      return "admin";

    case "iro_staff":
      return "staff";

    case "legal_counsel":
      return "legal";

    case "department_staff":
      return "department";

    default:
      throw new Error(`Unsupported role: ${role}`);
  }
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      email,
      role,
      department_id,
      is_active
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

  if (!profile.is_active) {
    await supabase.auth.signOut();
    throw new Error("This account is inactive.");
  }

  let office = "No assigned office";

  if (profile.department_id) {
    const { data: department, error: departmentError } =
      await supabase
        .from("departments")
        .select("name")
        .eq("id", profile.department_id)
        .maybeSingle();

    if (departmentError) {
      console.error(
        "Department lookup failed:",
        departmentError
      );
    } else if (department?.name) {
      office = department.name;
    }
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    roleKey: mapRoleToRoleKey(profile.role),
    departmentId: profile.department_id,
    office,
  };
}

export async function signOutFromSupabase() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}