import {
  AuthenticationError,
  apiGet,
  clearApiAccessToken,
  primeApiAccessToken,
} from "../api/apiClient";
import {
  supabase,
  isSupabaseConfigured,
} from "../supabaseConfig";
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
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      message:
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env.",
    };
  }

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
    // If the backend is unreachable (network error), fall back to
    // a frontend-only authenticated flow using the Supabase user
    // so the developer can still sign in while the Laravel API
    // is offline. Do not change backend auth architecture.
    reportClientError(
      "Unable to load CONEXIA profile, falling back to Supabase user:",
      error,
    );

    const user = data?.user || null;

    // If this looks like a network error, return a best-effort
    // account constructed from the Supabase user session so the
    // frontend can continue to the dashboard.
    if (
      user &&
      (error?.message?.includes("fetch") || error instanceof TypeError)
    ) {
      const fallbackAccount = {
        id: user.id,
        email: user.email,
        name:
          (user.user_metadata && user.user_metadata.full_name) ||
          user.email,
        // Prefer a role from user metadata if present, otherwise
        // choose a safe default so navigation works.
        roleKey:
          (user.user_metadata && user.user_metadata.roleKey) ||
          "department",
      };

      return {
        ok: true,
        account: fallbackAccount,
        _frontendFallback: true,
      };
    }

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
  if (!isSupabaseConfigured) {
    return null;
  }

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

    try {
      const response = await loadAuthenticatedProfile();

      return response?.account || null;
    } catch (error) {
      reportClientError(
        "Unable to restore CONEXIA profile, falling back to Supabase user:",
        error,
      );

      // Network error: construct a best-effort account from the
      // Supabase session user so the app can continue in offline
      // or backend-down scenarios.
      const user = session?.user || null;

      if (user && (error?.message?.includes("fetch") || error instanceof TypeError)) {
        return {
          id: user.id,
          email: user.email,
          name:
            (user.user_metadata && user.user_metadata.full_name) ||
            user.email,
          roleKey:
            (user.user_metadata && user.user_metadata.roleKey) ||
            "department",
        };
      }

      throw error;
    }
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
  if (!isSupabaseConfigured) {
    return () => {};
  }

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

  if (!isSupabaseConfigured) {
    return;
  }

  const { error } =
    await supabase.auth.signOut();

  if (error) {
    reportClientError(
      "Supabase logout failed:",
      error,
    );
  }
}
