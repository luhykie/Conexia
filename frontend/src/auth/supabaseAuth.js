import { apiGet } from "../api/apiClient";
import { supabase } from "../supabaseConfig";
import { reportClientError } from "../utils/reportClientError";

/**
 * Sign in through Supabase Auth, then load the authorised
 * CONEXIA profile through Laravel.
 */
export async function loginWithSupabase(
  email,
  password,
) {
  const normalizedEmail = email
    .trim()
    .toLowerCase();

  const {
    error: authError,
  } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (authError) {
    return {
      ok: false,
      message: authError.message,
    };
  }

  try {
    const response = await apiGet("/me");

    if (
      !response?.ok ||
      !response?.account
    ) {
      await supabase.auth.signOut();

      return {
        ok: false,
        message:
          "Your CONEXIA account could not be loaded.",
      };
    }

    if (!response.account.roleKey) {
      await supabase.auth.signOut();

      return {
        ok: false,
        message:
          "Your account has an invalid system role.",
      };
    }

    return {
      ok: true,
      account: response.account,
    };
  } catch (error) {
    await supabase.auth.signOut();

    return {
      ok: false,
      message:
        error.message ||
        "Your CONEXIA profile could not be loaded.",
    };
  }
}

export async function getAuthenticatedAccount() {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      return null;
    }

    const response = await apiGet("/me");

    return response?.account || null;
  } catch (error) {
    reportClientError(
      "Unable to restore authenticated account:",
      error,
    );

    return null;
  }
}

export async function logoutFromSupabase() {
  const { error } =
    await supabase.auth.signOut();

  if (error) {
    reportClientError(
      "Supabase logout failed:",
      error,
    );
  }
}
