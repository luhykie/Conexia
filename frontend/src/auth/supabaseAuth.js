import {
  AuthenticationError,
  apiGet,
  clearApiAccessToken,
  primeApiAccessToken,
} from "../api/apiClient";
import { supabase } from "../supabaseConfig";
import { reportClientError } from "../utils/reportClientError";

let profileRequestPromise = null;

async function loadAuthenticatedProfile() {
  if (!profileRequestPromise) {
    profileRequestPromise = apiGet("/me").finally(() => {
      profileRequestPromise = null;
    });
  }

  return profileRequestPromise;
}

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
    data,
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

  primeApiAccessToken(data.session);

  try {
    const response = await loadAuthenticatedProfile();

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
    clearApiAccessToken();
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
      clearApiAccessToken();
      return null;
    }

    primeApiAccessToken(session);

    const response = await loadAuthenticatedProfile();

    return response?.account || null;
  } catch (error) {
    reportClientError(
      "Unable to restore authenticated account:",
      error,
    );

    if (error instanceof AuthenticationError) {
      clearApiAccessToken();
      await supabase.auth.signOut();
    }

    return null;
  }
}

export function subscribeToAuthChanges(onAccountChange) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") {
      if (session) {
        primeApiAccessToken(session);
      }

      return;
    }

    if (event === "SIGNED_OUT" || !session) {
      clearApiAccessToken();
      onAccountChange(null);
      return;
    }

    primeApiAccessToken(session);

    window.setTimeout(async () => {
      const account = await getAuthenticatedAccount();
      onAccountChange(account);
    }, 0);
  });

  return () => subscription.unsubscribe();
}

export async function logoutFromSupabase() {
  clearApiAccessToken();

  const { error } =
    await supabase.auth.signOut();

  if (error) {
    reportClientError(
      "Supabase logout failed:",
      error,
    );
  }
}
