// client/src/features/chat/HandsfreeVoice.tsx
import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

type Props = {
  onFinalText: (text: string) => void;   // definitieve zinnen
  onPartialText?: (text: string) => void; // live ondertiteling (optioneel)
  lang?: string;                         // "nl-NL"
};

export default function HandsfreeVoice({ onFinalText, onPartialText, lang = "nl-NL" }: Props) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const recogRef = useRef<any>(null);

  useEffect(() => {
    return () => { try { recogRef.current?.stop(); } catch {} };
  }, []);

  function isSupported() {
    return typeof (window as any).webkitSpeechRecognition !== "undefined";
  }

  async function start() {
    if (!isSupported()) {
      alert("Spraakherkenning (continuous) wordt in deze browser niet ondersteund. Probeer Chrome/Edge desktop.");
      return;
    }
    setBusy(true);
    const Ctor = (window as any).webkitSpeechRecognition;
    const rec: any = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => { setBusy(false); setActive(true); onPartialText?.(""); };
    rec.onerror = (e: any) => { console.warn("ASR error", e?.error); };
    rec.onend = () => { setActive(false); onPartialText?.(""); };

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
        onPartialText?.("");            // wis ondertiteling bij definitieve zin
        onFinalText(finalChunk.trim()); // stuur door
      }
    };

    recogRef.current = rec;
    try { rec.start(); } catch (e) { setBusy(false); console.error(e); }
  }

  function stop() {
    try { recogRef.current?.stop(); } catch {}
  }

  if (busy) {
    return (
      <button type="button" className="inline-flex items-center px-3 py-2 rounded-md border" disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starten…
      </button>
    );
  }

  return active ? (
    <button type="button" onClick={stop} className="inline-flex items-center px-3 py-2 rounded-md border bg-red-50">
      <Square className="w-4 h-4 mr-2" /> Stop luisteren
    </button>
  ) : (
    <button type="button" onClick={start} className="inline-flex items-center px-3 py-2 rounded-md border">
      <Mic className="w-4 h-4 mr-2" /> Handenvrij praten
    </button>
  );
}
