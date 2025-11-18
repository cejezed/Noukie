import * as React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    name: string,
    role: "student" | "parent",
    educationLevel?: string,
    grade?: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  getAuthHeaders: () => Promise<HeadersInit>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- DEV/TEST pad: geen Supabase geconfigureerd ----
  useEffect(() => {
    if (!supabase) {
      // Kies: dummy user (voorkomt redirect naar <Login/> en laat je /voice-test gebruiken)
      const dummy = {
        id: "dev-user",
        email: "dev@example.com",
        user_metadata: { role: "student", name: "Dev Tester" },
      } as unknown as User;

      setUser(dummy);     // of: setUser(null) als je guest-mode wilt
      setLoading(false);
      return;
    }

    // ---- PROD pad: echte Supabase aanwezig ----
    let unsub: (() => void) | undefined;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    unsub = () => subscription.unsubscribe();
    return () => unsub?.();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      // no-op in voice-test mode
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: "student" | "parent",
    educationLevel?: string,
    grade?: string
  ) => {
    if (!supabase) {
      // no-op in voice-test mode
      return;
    }
    const userData: any = { name, role };
    if (role === "student" && educationLevel && grade) {
      userData.educationLevel = educationLevel;
      userData.grade = grade;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: userData },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!supabase) {
      // no-op in voice-test mode
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  /**
   * Get authentication headers with JWT Bearer token for API calls
   * Returns proper Authorization header for secure backend requests
   */
  const getAuthHeaders = async (): Promise<HeadersInit> => {
    if (!supabase) {
      // Dev mode fallback
      return { "x-user-id": user?.id || "" };
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("No active session");
    }

    return {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    getAuthHeaders,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
