import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;


// const supabaseUrl = "https://tyeucfdcisthohupippl.supabase.co"
// const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5ZXVjZmRjaXN0aG9odXBpcHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0NzU0NjEsImV4cCI6MjA2MzA1MTQ2MX0.vBFoyAZAN8lxsjIXPEtuc0_NooxMkyZ812qEWxyB2R8"



if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
