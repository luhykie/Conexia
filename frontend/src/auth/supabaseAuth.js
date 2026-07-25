import { supabase } from "../supabaseConfig";

const roleKeyMap = {
  super_admin: "super",
  iro_admin: "admin",
  iro_staff: "staff",
  legal_counsel: "legal",
  department_staff: "department",
};

export async function loginWithSupabase(email, password) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (authError) {
    return {
      ok: false,
      message: authError.message,
    };
  }

  const user = authData.user;

  const { data: profile, error: profileError } =
    await supabase
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
      .single();

  if (profileError) {
    await supabase.auth.signOut();

    return {
      ok: false,
      message: "Your account profile could not be loaded.",
    };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();

    return {
      ok: false,
      message: "Your account has been deactivated.",
    };
  }

  const roleKey = roleKeyMap[profile.role];

  if (!roleKey) {
    await supabase.auth.signOut();

    return {
      ok: false,
      message: "Your account has an invalid role.",
    };
  }

  return {
    ok: true,
    account: {
      id: profile.id,
      name: profile.full_name,
      email: profile.email,
      databaseRole: profile.role,
      roleKey,
      departmentId: profile.department_id,
    },
  };
}

export async function logoutFromSupabase() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Supabase logout failed:", error);
  }
}