// server/services/supabase.ts
// Tolerante service: geen throws bij ontbreken van env.
// Gebruikt de supabase client uit ../db (die zelf tolerant is).
import { supabase } from "../db";
// ---- Auth wrappers (veelgebruikte functies) ----
export async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
}
export async function signUp(email, password) {
    return supabase.auth.signUp({ email, password });
}
export async function signOut() {
    return supabase.auth.signOut();
}
export async function getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error)
        throw error;
    return data.user ?? null;
}
export async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error)
        throw error;
    return data.session ?? null;
}
// Exporteer ook de client zelf (named + default), voor bestaande imports
export { supabase };
export default supabase;
