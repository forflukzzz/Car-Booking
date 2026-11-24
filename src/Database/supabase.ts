import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "https://iapbqixzambfswnwkfqg.supabase.co").trim().replace(/\/+$/, "");
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhcGJxaXh6YW1iZnN3bndrZnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NDI1NjQsImV4cCI6MjEwODAxODU2NH0.vT7Ub8FuLq7HnWnw5XxssV_wYd4tz8JtWMTb-Zzb30s").trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
