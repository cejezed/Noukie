import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // ---- DEV/TEST pad: geen Supabase geconfigureerd ----
    useEffect(() => {
        if (!supabase) {
            // Kies: dummy user (voorkomt redirect naar <Login/> en laat je /voice-test gebruiken)
            const dummy = {
                id: "dev-user",
                email: "dev@example.com",
                user_metadata: { role: "student", name: "Dev Tester" },
            };
            setUser(dummy); // of: setUser(null) als je guest-mode wilt
            setLoading(false);
            return;
        }
        // ---- PROD pad: echte Supabase aanwezig ----
        let unsub;
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });
        unsub = () => subscription.unsubscribe();
        return () => unsub?.();
    }, []);
    const signIn = async (email, password) => {
        if (!supabase) {
            // no-op in voice-test mode
            return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error)
            throw error;
    };
    const signUp = async (email, password, name, role, educationLevel, grade) => {
        if (!supabase) {
            // no-op in voice-test mode
            return;
        }
        const userData = { name, role };
        if (role === "student" && educationLevel && grade) {
            userData.educationLevel = educationLevel;
            userData.grade = grade;
        }
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: userData },
        });
        if (error)
            throw error;
    };
    const signOut = async () => {
        if (!supabase) {
            // no-op in voice-test mode
            return;
        }
        const { error } = await supabase.auth.signOut();
        if (error)
            throw error;
    };
    const value = {
        user,
        loading,
        signIn,
        signUp,
        signOut,
    };
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
