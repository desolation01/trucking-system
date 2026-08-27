import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl === "your_supabase_project_url_here") {
  if (import.meta.env.DEV)
    console.warn(
      "[Supabase] VITE_SUPABASE_URL not configured. Calculator will use localStorage fallback."
    );
}

if (!supabaseAnonKey || supabaseAnonKey === "your_supabase_anon_key_here") {
  if (import.meta.env.DEV)
    console.warn(
      "[Supabase] VITE_SUPABASE_ANON_KEY not configured. Calculator will use localStorage fallback."
    );
}

const isConfigured =
  supabaseUrl &&
  supabaseUrl !== "your_supabase_project_url_here" &&
  supabaseAnonKey &&
  supabaseAnonKey !== "your_supabase_anon_key_here";

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export { isConfigured };