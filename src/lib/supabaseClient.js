import { createClient } from "@supabase/supabase-js";
import { supabaseConfig, isSupabaseConfigured } from "../supabaseConfig";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;
