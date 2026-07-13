export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || "https://oqxcokxpyoxsgxbxyema.supabase.co",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
};

export const isSupabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey);
