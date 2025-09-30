// client/src/features/chat/CoachChat.tsx
import * as React from "react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { sendChat, type ChatMessage } from "@/lib/chat";
import { speak, stopSpeak } from "@/lib/speech";
import HandsfreeVoice from "./HandsfreeVoice";
// (optioneel) laat staan als je ook de push-to-talk knop gebruikt
// import VoiceButton from "./VoiceButton";

type Mode = "chat" | "studeren";

export type CoachChatHandle = {
  sendMessage: (text: string) => Promise<void>;
};

type Msg = { id: string; role: "user" | "assistant"; content: string };

type Props = {
  systemHint?: string;
  context?: unknown;
  mode?: Mode;
  size?: "compact" | "large";
  hideComposer?: boolean;
  initialAssistantMessage?: string;
  threadKey?: string;
  className?: string;
};

const CoachChat = forwardRef<CoachChatHandle, Props>(function CoachChat(
  {
    systemHint,
    context,
    mode = "chat",
    size = "compact",
    hideComposer = false,
    initialAssistantMessage,
    threadKey = "coachchat_default",
    className,
  },
  ref
) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Nieuw: live ondertiteling + cooldown
  const [livePartial, setLivePartial] = useState("");
  const lastSendRef = useRef(0);
  const cooldownMs = 1000;

  const viewportRef = useRef<HTMLDivElement | null>(null);

  const sz = useMemo(() => {
    return size === "large"
      ? { bubbleText: "text-base", pad: "px-3 py-2", inputRows: 4 }
      : { bubbleText: "text-sm", pad: "px-3 py-1.5", inputRows: 3 };
  }, [size]);

  // Load thread
  useEffect(() => {
    try {
      const raw = localStorage.getItem(threadKey);
      if (raw) setMessages(JSON.parse(raw) as Msg[]);
      else if (initialAssistantMessage)
        setMessages([{ id: crypto.randomUUID(), role: "assistant", content: initialAssistantMessage }]);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadKey]);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(threadKey, JSON.stringify(messages));
    } catch {}
  }, [messages, threadKey]);

  // Autoscroll
  useEffect(() => {
    const vp = viewportRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (vp) vp.scrollTop = vp.scrollHeight;
  }, [messages, sending]);

  function sendWithCooldown(text: string) {
    const now = Date.now();
    const wait = Math.max(0, cooldownMs - (now - lastSendRef.current));
    const fire = () => {
      lastSendRef.current = Date.now();
      void sendCore(text);
    };
    wait === 0 ? fire() : setTimeout(fire, wait);
  }

  async function sendCore(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: trimmed }]);
    setInput("");
    setSending(true);

    try {
      const history: ChatMessage[] = [...messages, { id: "tmp", role: "user", content: trimmed }].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { reply } = await sendChat(trimmed, history, mode, systemHint, context);

      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: reply }]);

      // TTS: eerst zeker stoppen, dan spreken (geen overlap)
      stopSpeak();
      speak(reply, "nl-NL", 1);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Chatfout",
        description: e?.message ?? "Kon geen antwoord ophalen.",
      });
    } finally {
      setSending(false);
    }
  }

  useImperativeHandle(ref, () => ({
    sendMessage: async (text: string) => {
      await sendCore(text);
    },
  }));

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim()) return;
    await sendCore(input);
  }

  return (
    <div className={cn("rounded-lg border border-border/60 bg-card", className)}>
      {/* Chat viewport */}
      <ScrollArea className="h-64 sm:h-72 md:h-80 border-b border-border/60" ref={viewportRef as any}>
        <div className="p-3 space-y-2">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              <p className={cn("font-medium", size === "large" ? "text-base" : "text-sm")}>
                Nog geen gesprek. Zeg hallo! 👋
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-md border border-border/60",
                    sz.pad,
                    sz.bubbleText,
                    m.role === "user" ? "bg-primary/10" : "bg-background"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <div className={cn("rounded-md border border-border/60 bg-background", sz.pad, sz.bubbleText)}>
                <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin align-[-2px]" />
                Denkt na…
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {!hideComposer && (
        <form onSubmit={onSubmit} className="p-3 space-y-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={sz.inputRows}
            placeholder={mode === "studeren" ? "Vraag uitleg of oefenvragen…" : "Typ je bericht…"}
            className="text-base"
          />

          {/* Live ondertiteling onder de invoer (optioneel) */}
          {livePartial && (
            <div className="text-sm text-muted-foreground italic">
              🎙️ {livePartial}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            {/* Handenvrij praten: elke definitieve zin wordt na cooldown verstuurd */}
            <HandsfreeVoice
              onFinalText={(t) => {
                setInput(t);
                sendWithCooldown(t);
              }}
              onPartialText={(p) => setLivePartial(p)}
              lang="nl-NL"
            />

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={stopSpeak}>🔈 Stop</Button>
              <Button type="submit" disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {sending ? "Versturen…" : "Stuur"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
});

export default CoachChat;
