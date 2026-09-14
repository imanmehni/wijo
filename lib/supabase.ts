import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Warn if missing, but don't crash on build (Vercel build might not have these)
if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "Supabase credentials are missing. Make sure to set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder"
);
