import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

async function authedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers || {});
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}

export default function CoachChat() {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!input.trim() || pending) return;
    setError(null);
    const userMsg = { role: "user" as const, content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setPending(true);
    try {
      const res = await authedFetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content }),
      });

      const text = await res.text(); // eerst als tekst lezen
      if (!res.ok) {
        // Toon servertekst als die leesbaar is
        setError(text?.slice(0, 400) || `Serverfout (${res.status})`);
        return;
      }

      let data: any = null;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        // Geen geldige JSON → laat tekst zien
        setError(text?.slice(0, 400) || "Ongeldig antwoord van server (geen JSON)");
        return;
      }

      const reply = data?.reply || data?.message || data?.text || "(geen antwoord)";
      setMessages((m) => [...m, { role: "assistant", content: String(reply) }]);
    } catch (e: any) {
      setError(e?.message ?? "Onbekende fout bij versturen");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "bg-primary/10 px-2 py-1 rounded" : "bg-muted px-2 py-1 rounded"}>
            {m.role === "user" ? "Jij: " : "Coach: "}{m.content}
          </div>
        ))}
      </div>
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-2 py-1 text-sm"
          placeholder="Schrijf hier... (Enter om te sturen)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
        />
        <button
          className="border rounded px-3 text-sm"
          onClick={send}
          disabled={pending}
        >
          Stuur
        </button>
      </div>
    </div>
  );
}
