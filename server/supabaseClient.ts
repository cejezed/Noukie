import { createClient } from "@supabase/supabase-js";

export function supabaseForRequest(accessToken?: string) {
  return createClient(
    // Gebruik hier OOK de variabelen met de VITE_ prefix
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    { global: { headers: accessToken? { Authorization: `Bearer ${accessToken}` } : {} } }
  );
}
