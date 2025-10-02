// client/src/features/chat/HandsfreeVoice.tsx
import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Info } from "lucide-react";

type Props = {
  onFinalText: (text: string) => void;    // definitieve zinnen
  onPartialText?: (text: string) => void; // live ondertiteling (optioneel)
  lang?: string;                          // "nl-NL"
};

export default function HandsfreeVoice({ onFinalText, onPartialText, lang = "nl-NL" }: Props) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const recogRef = useRef<any>(null);

  useEffect(() => {
    return () => { try { recogRef.current?.stop(); } catch {} };
  }, []);

  function isSupported() {
    return typeof (window as any).webkitSpeechRecognition !== "undefined";
  }

  function explainError(code?: string) {
    switch (code) {
      case "not-allowed": return "Toestemming geweigerd. Sta microfoontoegang toe en probeer opnieuw.";
      case "service-not-allowed": return "Microfoon niet toegestaan door systeeminstelling.";
      case "no-speech": return "Geen spraak gedetecteerd. Probeer dichter bij de microfoon te praten.";
      case "audio-capture": return "Geen microfoon gevonden of niet beschikbaar.";
      case "aborted": return "Luisteren is afgebroken.";
      case "network": return "Netwerkfout tijdens spraakherkenning.";
      default: return "Spraakherkenning mislukte. Probeer het opnieuw of gebruik de tekstinvoer.";
    }
  }

  async function start() {
    setErrorMsg("");
    if (!isSupported()) {
      setErrorMsg("Spraakherkenning wordt niet ondersteund in deze browser. Probeer Chrome of Edge op desktop.");
      return;
    }
    try {
      setBusy(true);
      const Ctor = (window as any).webkitSpeechRecognition;
      const rec: any = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => { setBusy(false); setActive(true); onPartialText?.(""); };
      rec.onend = () => { setActive(false); onPartialText?.(""); };
      rec.onerror = (e: any) => {
        console.warn("ASR error", e?.error);
        setBusy(false);
        setActive(false);
        onPartialText?.("");
        setErrorMsg(explainError(e?.error));
      };

      rec.onresult = (event: any) => {
        let finalChunk = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalChunk += r[0].transcript.trim() + " ";
          else interim = r[0].transcript;
        }
        if (interim) onPartialText?.(interim);
        if (finalChunk.trim()) {
          onPartialText?.("");
          onFinalText(finalChunk.trim());
        }
      };

      recogRef.current = rec;

      // Sommige browsers gooien direct een exception (geen user gesture / permission)
      try {
        rec.start();
      } catch (e: any) {
        setBusy(false);
        setActive(false);
        setErrorMsg(explainError(e?.name || e?.message));
      }
    } catch (e: any) {
      setBusy(false);
      setActive(false);
      setErrorMsg(explainError(e?.name || e?.message));
    }
  }

  function stop() {
    try { recogRef.current?.stop(); } catch {}
  }

  return (
    <div className="flex flex-col gap-1">
      {busy ? (
        <button type="button" className="inline-flex items-center px-3 py-2 rounded-md border" disabled>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starten…
        </button>
      ) : active ? (
        <button type="button" onClick={stop} className="inline-flex items-center px-3 py-2 rounded-md border bg-red-50">
          <Square className="w-4 h-4 mr-2" /> Stop luisteren
        </button>
      ) : (
        <button type="button" onClick={start} className="inline-flex items-center px-3 py-2 rounded-md border">
          <Mic className="w-4 h-4 mr-2" /> Handenvrij praten
        </button>
      )}

      {!!errorMsg && (
        <div className="flex items-start gap-1 text-xs text-muted-foreground max-w-[32rem]">
          <Info className="w-3.5 h-3.5 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
