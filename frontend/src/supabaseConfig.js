import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseKey =
  supabasePublishableKey || supabaseAnonKey;

if (!supabaseUrl) {
  console.error(
    "Missing VITE_SUPABASE_URL. The CONEXIA frontend will not be able to authenticate until it is configured.",
  );
}

if (!supabaseKey) {
  console.error(
    "Missing VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY. The CONEXIA frontend will load, but authentication calls will fail until a public Supabase key is configured.",
  );
}

export const supabase = createClient(
  supabaseUrl || "http://127.0.0.1",
  supabaseKey || "public-anon-key",
);
