import { createClient } from "@supabase/supabase-js";

export function supabaseForRequest(accessToken?: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!, // géén service_role hier
    { global: { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} } }
  );
}
