// client/src/lib/chat.ts
import { supabase } from "@/lib/supabase";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
export type ChatMode = "chat" | "studeren";
export type ChatReply = { reply: string; mode?: ChatMode };

export async function sendChat(
  message: string,
  history: ChatMessage[] = [],
  mode: ChatMode = "chat",
  systemHint?: string,
  context?: unknown
): Promise<ChatReply> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) throw new Error("Geen geldige sessie. Log in om te chatten.");
  const token = data.session.access_token;

  const envBase = import.meta.env.VITE_API_BASE as string | undefined;
  const base =
    envBase ??
    (location.hostname === "localhost" && location.port === "5173"
      ? "http://localhost:8787/api"
      : "/api");

  // kies endpoint via env (coach of chat), default coach
  const endpoint = (import.meta.env.VITE_CHAT_ENDPOINT as string) || "coach";

  console.log("API_BASE=", base, "ENDPOINT=", endpoint);


  const res = await fetch(`${base}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode, systemHint, context, message, history }),
  });

  if (!res.ok) {
    let errTxt = await res.text().catch(() => "");
    try { const j = JSON.parse(errTxt); errTxt = j.error || errTxt; } catch {}
    throw new Error(`Chat API ${res.status}: ${errTxt || res.statusText}`);
  }
  return (await res.json()) as ChatReply;
}
