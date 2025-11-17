import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import GeoGameScreen from "@/components/game/GeoGameScreen";
import { isGameEnabled } from "@/config/gameSubjects";

function useUserId() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => { if (alive) setId(data.user?.id ?? null); });
    return () => { alive = false; };
  }, []);
  return id;
}

function getQueryParam(name: string) {
  try { return new URLSearchParams(window.location.search).get(name); }
  catch { return null; }
}

function normalizeChoices(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.map(String) : [s];
    } catch {
      if (s.includes("\n")) return s.split("\n").map(t=>t.trim()).filter(Boolean);
      if (s.includes(";")) return s.split(";").map(t=>t.trim()).filter(Boolean);
      if (s.includes(",")) return s.split(",").map(t=>t.trim()).filter(Boolean);
      return [s];
    }
  }
  try { return JSON.parse(String(raw)); } catch { return [String(raw)]; }
}

function eq(a?: string | null, b?: string | null) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

export default function StudyPlay() {
  // 🔴 ULTRA MINIMAL TEST - Dit MOET zichtbaar zijn als component mount
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      fontWeight: 'bold',
      zIndex: 99999,
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '72px', marginBottom: '20px' }}>🎮</div>
      <div style={{ marginBottom: '10px' }}>STUDYPLAY COMPONENT WERKT!</div>
      <div style={{ fontSize: '14px', marginTop: '20px', opacity: 0.9 }}>
        URL: {typeof window !== 'undefined' ? window.location.href : 'loading...'}
      </div>
      <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.9 }}>
        Als je dit ziet, dan mount de component correct ✓
      </div>
    </div>
  );
}
