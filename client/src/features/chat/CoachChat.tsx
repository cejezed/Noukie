import React, { useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ==== Types ====
type Role = "user" | "assistant" | "system";
type Msg = { role: Role; content: string };

type CoachChatProps = {
  /** Tekst die vooraf in het invoerveld moet komen (bijv. transcript uit spraak). */
  prefill?: string;
  /** Wordt aangeroepen zodra prefill is overgenomen in het invoerveld. */
  onPrefillConsumed?: () => void;
  /** System prompt voor Noukie (rol/gedrag/positieve toon). */
  systemHint?: string;
  /** Extra context (rooster/taken/memory) die Noukie proactief helpt. */
  context?: any;
  /** "large" geeft het grote invoerveld (min-h-24), "normal" houdt het klein. */
  size?: "large" | "normal";
  /** Optioneel: eigen endpoint i.p.v. /api/plan */
  endpoint?: string;
};

async function authedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers || {});
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}

export default function CoachChat({
  prefill,
  onPrefillConsumed,
  systemHint,
  context,
  size = "large",
  endpoint = "/api/plan",
}: CoachChatProps) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hoi! Ik ben **Noukie** 😊. Vertel wat je wilt oefenen of plannen. Ik denk met je mee, hou rekening met je rooster en stel korte, haalbare stappen voor.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Prefill → invoerveld
  useEffect(() => {
    if (prefill && prefill.trim()) {
      setInput(prefill.trim());
      onPrefillConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  // Auto-scroll naar beneden bij nieuwe berichten
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  // System-prompt samenstellen (fallback als er geen meegegeven is)
  const effectiveSystem = useMemo(() => {
    const fallback = `
Je bent Noukie, een vriendelijke studiecoach. Wees proactief, positief en kort.
- Gebruik context (rooster/taken/memory) om door te vragen en op te volgen.
- Zie je vandaag een les voor een vak dat eerder “moeilijk” was? Vraag: “Hoe ging het vandaag vs. vorige keer?”
- Stel maximaal 3 concrete acties met tijden (HH:MM) en duur in minuten.
- Vier kleine successen en wees empathisch. Stel 1 verduidelijkingsvraag als info ontbreekt.
`.trim();
    return systemHint?.trim() || fallback;
  }, [systemHint]);

  async function send() {
    if (!input.trim() || pending) return;
    setError(null);

    const userMsg: Msg = { role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setPending(true);

    try {
      // Stuur korte history mee (laatste ~8 berichten excl. system)
      const shortHistory = messages
        .filter((m) => m.role !== "system")
        .slice(-8)
        .map(({ role, content }) => ({ role, content }));

      const payload = {
        message: userMsg.content,
        history: shortHistory,     // voor gesprekscontinuïteit
        systemHint: effectiveSystem,
        context: context ?? {},    // bv. { todaySchedule, openTasks, difficulties }
        coachName: "Noukie",       // zodat backend naam kan gebruiken
      };

      const res = await authedFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await res.text(); // eerst als tekst
      if (!res.ok) {
        setError(raw?.slice(0, 400) || `Serverfout (${res.status})`);
        return;
      }

      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setError(raw?.slice(0, 400) || "Ongeldig antwoord van server (geen JSON)");
        return;
      }

      const reply: string = data?.reply || data?.message || data?.text || "(geen antwoord)";
      setMessages((m) => [...m, { role: "assistant", content: String(reply) }]);

      // Optioneel: signalen/memory die backend heeft geëxtraheerd (bv. “wiskunde = moeilijk”)
      // if (data?.signals) { ... supabase upsert naar coach_memory ... }

    } catch (e: any) {
      setError(e?.message ?? "Onbekende fout bij versturen");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-md border">
      {/* Header met i-icoon: Noukie */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="font-medium">Chat met Noukie</div>
        <div className="group relative">
          <button
            className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted"
            aria-label="Over Noukie"
            title="Over Noukie"
          >
            <Info className="h-4 w-4" />
          </button>
          {/* simpele tooltip */}
          <div className="absolute right-0 z-10 hidden group-hover:block w-72 text-xs bg-popover text-popover-foreground border rounded p-3 shadow">
            <div className="font-semibold mb-1">Over Noukie</div>
            <p>
              Noukie helpt je plannen, oefenen en volhouden. Ze kijkt mee naar je rooster en onthoudt wat lastig was.
              Verwacht korte, positieve berichten, gerichte vragen en kleine, haalbare stappen.
            </p>
          </div>
        </div>
      </div>

      {/* Berichten */}
      <div ref={listRef} className="max-h-[40vh] overflow-auto px-3 py-3 space-y-2">
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div
              key={`${i}-${m.role}`}
              className={`max-w-[85%] rounded px-3 py-2 text-sm leading-relaxed ${
                isUser ? "ml-auto bg-primary/10" : "bg-muted"
              }`}
            >
              {isUser ? <span className="font-medium">Jij: </span> : <span className="font-medium">Noukie: </span>}
              <span className="[&_strong]:font-semibold" dangerouslySetInnerHTML={{ __html: escapeHtml(m.content) }} />
            </div>
          );
        })}
        {pending && (
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Noukie is aan het typen…
          </div>
        )}
      </div>

      {/* Foutmelding */}
      {error && (
        <div className="mx-3 mb-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      {/* Invoer */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <textarea
            className={`flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              size === "large" ? "min-h-24 text-base" : ""
            }`}
            placeholder="Vertel hier wat je wilt oefenen, waar je moeite mee hebt of wat je wilt plannen. Je kunt ook inspreken."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            className="border rounded px-3 text-sm bg-primary text-primary-foreground hover:opacity-90"
            onClick={send}
            disabled={pending || !input.trim()}
            title="Stuur naar Noukie"
          >
            Stuur
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Tip: Enter = sturen • Shift+Enter = nieuwe regel</p>
      </div>
    </div>
  );
}

/** heel simpele HTML-escape zodat vetgedrukte **stukjes** veilig gerenderd kunnen worden */
function escapeHtml(str: string) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
