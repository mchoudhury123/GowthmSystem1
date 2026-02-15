// Browser-side Supabase client (uses anon key)
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase environment variables not found. Running in demo mode or API routes will fail."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
