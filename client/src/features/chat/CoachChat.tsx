// client/src/features/chat/CoachChat.tsx
import * as React from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type Msg = { role: "user" | "assistant"; content: string; created_at?: string };

async function getAuthHeader() {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function CoachChat({
  onTasksCreated,
}: {
  onTasksCreated?: (n: number) => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  // Scroll naar onder bij nieuwe berichten
  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Historie laden (userId meesturen)
  React.useEffect(() => {
    (async () => {
      if (!user?.id) return;
      try {
        const headers = await getAuthHeader();
        const r = await fetch(`/api/chat/history?userId=${encodeURIComponent(user.id)}`, { headers });
        if (!r.ok) return;
        const j = await r.json();
        const m = (j.messages ?? []).map((x: any) => ({
          role: x.role as "user" | "assistant",
          content: x.content as string,
          created_at: x.created_at as string,
        }));
        setMessages(m);
      } catch {
        // stil falen; we tonen gewoon de intro prompt
      }
    })();
  }, [user?.id]);

  async function send() {
    if (!input.trim() || busy || !user?.id) return;
    const text = input.trim();
    setInput("");

    // Optimistisch toevoegen
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);

    try {
      const headers = { "Content-Type": "application/json", ...(await getAuthHeader()) };
      const r = await fetch("/api/chat/coach", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId: user.id, message: text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || r.statusText);

      // Antwoord tonen
      setMessages((m) => [...m, { role: "assistant", content: j.reply ?? "" }]);

      // Indien taken aangemaakt → Planning refreshen
      if (j.created_count && onTasksCreated) onTasksCreated(j.created_count as number);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Er ging iets mis: ${e?.message || String(e)}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  // Voorbeeld-quick actions om gebruiker te helpen starten
  function QuickButton({ text }: { text: string }) {
    return (
      <button
        type="button"
        className="text-xs px-2 py-1 border rounded hover:bg-muted"
        onClick={() => setInput(text)}
      >
        {text}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Tips/quick actions */}
      <div className="flex flex-wrap gap-2">
        <QuickButton text="Vandaag ging het zo: ..." />
        <QuickButton text="Morgen 19:00 wiskunde 3.2 oefenen (30 min)" />
        <QuickButton text="Engels woordjes H2 plannen voor vrijdag" />
        <QuickButton text="Ik snap paragraaf 4.1 niet, leg uit" />
      </div>

      {/* Berichten */}
      <div
        ref={listRef}
        className="space-y-2 max-h-80 overflow-auto border rounded p-3 bg-background"
      >
        {messages.length === 0 ? (
          <div className="text-sm italic text-muted-foreground">
            Vertel kort hoe je schooldag ging en wat je wilt plannen. Voorbeeld:
            “Vandaag ging wiskunde lastig. Morgen 20:00 paragraaf 3.2 oefenen (30 min).”
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "assistant"
                  ? "text-sm leading-relaxed"
                  : "text-sm font-medium leading-relaxed"
              }
            >
              <span className="text-muted-foreground mr-1">
                {m.role === "assistant" ? "Coach:" : "Jij:"}
              </span>
              {m.content}
            </div>
          ))
        )}
      </div>

      {/* Invoer */}
      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-2 flex-1"
          placeholder='Schrijf hier… (Enter om te sturen)'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && !!user?.id && send()}
          disabled={!user?.id}
        />
        <button
          className="border rounded px-3 py-2"
          onClick={send}
          disabled={busy || !input.trim() || !user?.id}
          aria-label="Stuur"
          title="Stuur"
        >
          {busy ? "…" : "Stuur"}
        </button>
      </div>

      {!user?.id && (
        <p className="text-xs text-muted-foreground">
          Log in om te chatten en automatisch taken te laten aanmaken.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Tip: noem een tijd en duur om taken automatisch in te plannen
        (bijv. “morgen 19:30 25 min. wiskunde 3.2”).
      </p>
    </div>
  );
}
