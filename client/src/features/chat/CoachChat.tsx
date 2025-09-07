import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  memo,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Info } from "lucide-react";

export type CoachChatHandle = {
  /** Laat van buitenaf een user-bericht versturen (Voor unified composer op Vandaag) */
  sendMessage: (text: string) => void;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
};

type CoachChatProps = {
  systemHint?: string;
  context?: any;
  size?: "small" | "large";
  /** Verberg interne composer; we gebruiken de unified composer op de pagina zelf */
  hideComposer?: boolean;
  /** Eenmalige openingsboodschap van de coach, vóór de eerste user input */
  initialAssistantMessage?: string;
};

function uid() {
  return Math.random().toString(36).slice(2);
}

const INFO_TEXT = `
**Welkom bij Noukie!** 😊
Ik help je plannen, prioriteren en bijhouden wat lastig was of juist goed ging.

**Zo werk ik:**
- Ik kijk mee naar je **rooster**, **taken** en eerdere **coach-notities**.
- Ik stel **korte, haalbare stappen** voor (met tijden en duur).
- Ik volg op bij vakken die eerder **“moeilijk”** waren.
- Jij kunt **typen** of **insprekken** (via de opnameknop op de pagina).

**Tips:**
- Schrijf wat je vandaag wilt doen, of wat lastig voelt.
- Na een les of oefensessie: noteer kort hoe het ging; dan pas ik je plan aan.
`;

const CoachChat = memo(
  forwardRef<CoachChatHandle, CoachChatProps>(function CoachChat(
    { systemHint, context, size = "large", hideComposer, initialAssistantMessage }: CoachChatProps,
    ref
  ) {
    const [showInfo, setShowInfo] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
      const seed: ChatMessage[] = [];
      if (initialAssistantMessage?.trim()) {
        seed.push({
          id: uid(),
          role: "assistant",
          content: initialAssistantMessage.trim(),
        });
      } else {
        // Zachte intro (kort), echte uitgebreide info zit achter ℹ️
        seed.push({
          id: uid(),
          role: "assistant",
          content:
            "Hoi! Ik ben **Noukie**. Vertel wat je wilt oefenen of plannen. Ik kijk mee naar je rooster en stel korte, haalbare stappen voor.",
        });
      }
      return seed;
    });
    const [busy, setBusy] = useState(false);
    const localInputRef = useRef<HTMLTextAreaElement | null>(null);

    // Exporteer een imperative handle zodat de pagina van buiten berichten kan sturen
    useImperativeHandle(ref, () => ({
      sendMessage: (text: string) => {
        const content = (text || "").trim();
        if (!content) return;
        pushUserAndAsk(content);
      },
    }));

    async function pushUserAndAsk(text: string) {
      const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);

      try {
        setBusy(true);
        // Minimalistische backend call — gebruik jouw bestaande endpoint
        const resp = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemHint,
            context,
            message: text,
            history: messages
              .filter((m) => m.role !== "system")
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        const data = await resp.json().catch(() => ({}));
        const reply: string =
          data?.reply ??
          data?.message ??
          data?.content ??
          "Oké! Laten we dit opsplitsen in 2–3 haalbare stappen. Wat is het eerste mini-doel?";

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: String(reply),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (e) {
        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content:
            "Er ging iets mis met het ophalen van mijn antwoord. Probeer het zo nog eens, of formuleer je vraag opnieuw.",
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } finally {
        setBusy(false);
      }
    }

    // Interne composer (wordt meestal verborgen op Vandaag)
    const [draft, setDraft] = useState("");
    function onSubmitInternal(e: React.FormEvent) {
      e.preventDefault();
      const t = draft.trim();
      if (!t) return;
      setDraft("");
      pushUserAndAsk(t);
    }

    return (
      <div
        className={`rounded-lg border p-4 ${size === "large" ? "space-y-3" : "space-y-2"}`}
        data-testid="coach-chat"
      >
        {/* Header + Info */}
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">Chat met Noukie</h3>
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            title="Uitleg"
            aria-label="Uitleg"
          >
            <Info className="w-4 h-4" />
            <span className="hidden sm:inline">Info</span>
          </button>
        </div>

        {showInfo && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm leading-6">
            <div dangerouslySetInnerHTML={{ __html: INFO_TEXT.replace(/\n/g, "<br/>") }} />
          </div>
        )}

        {/* Messages */}
        <div className="space-y-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[95%] sm:max-w-[80%] rounded-md px-3 py-2 text-sm ${
                m.role === "assistant"
                  ? "bg-muted"
                  : "bg-primary text-primary-foreground ml-auto"
              }`}
            >
              {m.role === "assistant" ? <b>Noukie: </b> : null}
              <span>{m.content}</span>
            </div>
          ))}
          {busy && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              Noukie is aan het nadenken…
            </div>
          )}
        </div>

        {/* Interne composer (meestal uit) */}
        {!hideComposer && (
          <form onSubmit={onSubmitInternal} className="space-y-2">
            <Textarea
              ref={localInputRef}
              placeholder="Typ hier je bericht…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button type="submit" disabled={busy}>
                Stuur
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  })
);

export default CoachChat;
