// server/db.ts — tolerant voor voice-test zonder Supabase
import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabase = (() => {
    if (SUPABASE_URL && (SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY)) {
        const KEY = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY;
        return createClient(SUPABASE_URL, KEY);
    }
    console.warn("[db] ⚠️ Supabase niet geconfigureerd — VOICE-ONLY testmodus.");
    return new Proxy({}, {
        get() { throw new Error("Supabase niet geconfigureerd (VOICE-ONLY mode)."); }
    });
})();
