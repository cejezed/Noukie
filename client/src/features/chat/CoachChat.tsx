import React, {
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
  memo,
  useEffect,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Info } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useChatStore, type ChatMessage } from "./chatStore";

export type CoachChatHandle = {
  /** Laat van buitenaf een user-bericht versturen (Voor unified composer op Vandaag) */
  sendMessage: (text: string) => Promise<void>;
};

type Props = {
  systemHint?: string;
  context?: any;
  size?: "small" | "large";
  /** Verberg interne composer; we gebruiken de unified composer op de pagina zelf */
  hideComposer?: boolean;
  /** Eenmalige openingsboodschap van de coach, vóór de eerste user input */
  initialAssistantMessage?: string;
  /** Unieke sleutel per chat-venster; bv. "today:<userId>" */
  threadKey?: string;
};

function uid() {
  return Math.random().toString(36).slice(2);
}

const DEFAULT_THREAD = "default";

const INFO_TEXT_MINI = `
<b>Noukie</b> reageert kort en natuurlijk. Jij typt of spreekt in; ik denk mee met je rooster en taken als dat helpt.
`;

const CoachChat = memo(
  forwardRef<CoachChatHandle, Props>(function CoachChat(
    {
      systemHint,
      context,
      size = "large",
      hideComposer,
      initialAssistantMessage,
      threadKey = DEFAULT_THREAD,
    }: Props,
    ref
  ) {
    const { user } = useAuth();
    const [showInfo, setShowInfo] = useState(false);
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState("");
    const localInputRef = useRef<HTMLTextAreaElement | null>(null);

    // Zustand store
    const { byThread, setThreadMessages, appendToThread } = useChatStore();
    const messages = byThread[threadKey] ?? [];

    // Seed één opener als de thread leeg is
    useEffect(() => {
      if (messages.length === 0) {
        const opener: ChatMessage = {
          id: uid(),
          role: "assistant",
          content:
            (initialAssistantMessage?.trim() ||
              "Hoi! Ik ben Noukie. Waar wil je mee beginnen?")!,
        };
        setThreadMessages(threadKey, [opener]);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [threadKey]);

    async function pushUserAndAsk(text: string): Promise<void> {
      const content = (text || "").trim();
      if (!content) return;

      if (!user?.id) {
        appendToThread(threadKey, {
          id: uid(),
          role: "assistant",
          content: "Je bent niet ingelogd. Log eerst in om verder te chatten.",
        });
        return;
      }

      // Optimistic UI
      const userMsg: ChatMessage = { id: uid(), role: "user", content };
      appendToThread(threadKey, userMsg);

      try {
        setBusy(true);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("Geen autorisatie token beschikbaar");

        // History op basis van huidige thread + net bericht
        const history = [...(byThread[threadKey] ?? []), userMsg]
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content }));

        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: user.id,
            systemHint,
            context,
            message: content,
            history,
          }),
        });

        if (!resp.ok) throw new Error(`API error: ${resp.status} ${resp.statusText}`);

        const data = await resp.json().catch(() => ({} as any));
        const reply: string =
          data?.reply ?? data?.message ?? data?.content ?? "Oké. Vertel nog iets meer, dan kijk ik mee.";

        appendToThread(threadKey, {
          id: uid(),
          role: "assistant",
          content: String(reply),
        });
      } catch (e: any) {
        appendToThread(threadKey, {
          id: uid(),
          role: "assistant",
          content: (e?.message || "Er ging iets mis") + " — probeer het zo nog eens.",
        });
      } finally {
        setBusy(false);
      }
    }

    useImperativeHandle(ref, () => ({
      sendMessage: (t: string) => pushUserAndAsk(t),
    }));

    function onSubmitInternal(e: React.FormEvent) {
      e.preventDefault();
      const t = draft.trim();
      if (!t) return;
      setDraft("");
      void pushUserAndAsk(t);
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
            <div dangerouslySetInnerHTML={{ __html: INFO_TEXT_MINI.replace(/\n/g, "<br/>") }} />
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

        {/* Interne composer (optioneel) */}
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
              <Button type="submit" disabled={busy || !user?.id}>
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
