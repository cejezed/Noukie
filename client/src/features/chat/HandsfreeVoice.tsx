// client/src/features/chat/HandsfreeVoice.tsx
import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Info, Radio } from "lucide-react";

type Props = {
  onFinalText: (text: string) => void;
  onPartialText?: (text: string) => void;
  lang?: string;
};

export default function HandsfreeVoice({ onFinalText, onPartialText, lang = "nl-NL" }: Props) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isListening, setIsListening] = useState(false);
  const recogRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      try {
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        recogRef.current?.stop();
      } catch {}
    };
  }, []);

  function isSupported() {
    return typeof (window as any).webkitSpeechRecognition !== "undefined" ||
           typeof (window as any).SpeechRecognition !== "undefined";
  }

  function explainError(code?: string) {
    switch (code) {
      case "not-allowed":
        return "Toestemming geweigerd. Sta microfoontoegang toe en probeer opnieuw.";
      case "service-not-allowed":
        return "Microfoon niet toegestaan door systeeminstelling.";
      case "no-speech":
        return "Geen spraak gedetecteerd. Probeer dichter bij de microfoon te praten.";
      case "audio-capture":
        return "Geen microfoon gevonden of niet beschikbaar.";
      case "aborted":
        return "Luisteren is afgebroken.";
      case "network":
        return "Netwerkfout tijdens spraakherkenning.";
      default:
        return "Spraakherkenning mislukte. Probeer het opnieuw of gebruik de tekstinvoer.";
    }
  }

  async function start() {
    setErrorMsg("");

    if (!isSupported()) {
      setErrorMsg("Spraakherkenning wordt niet ondersteund in deze browser. Probeer Chrome of Edge op desktop.");
      return;
    }

    // Check microfoon permissions eerst
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop meteen weer
    } catch (permError: any) {
      setErrorMsg("Microfoontoestemming is vereist. Geef toestemming in je browser.");
      console.error("Mic permission error:", permError);
      return;
    }

    try {
      setBusy(true);
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const rec: any = new SpeechRecognition();

      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        console.log("Speech recognition started");
        setBusy(false);
        setActive(true);
        setIsListening(true);
        onPartialText?.("");
      };

      rec.onend = () => {
        console.log("Speech recognition ended");
        setActive(false);
        setIsListening(false);
        onPartialText?.("");

        // Auto-restart als we nog actief waren (tenzij gebruiker stopte)
        if (active && recogRef.current === rec) {
          console.log("Auto-restarting recognition...");
          restartTimeoutRef.current = setTimeout(() => {
            try {
              rec.start();
            } catch (e) {
              console.warn("Could not restart:", e);
            }
          }, 100);
        }
      };

      rec.onerror = (e: any) => {
        console.warn("ASR error:", e?.error, e);

        // Negeer 'no-speech' errors tijdens actieve sessie
        if (e?.error === "no-speech" && active) {
          console.log("No speech detected, continuing...");
          return;
        }

        // Negeer 'aborted' als we zelf stopten
        if (e?.error === "aborted" && !active) {
          return;
        }

        setBusy(false);
        setActive(false);
        setIsListening(false);
        onPartialText?.("");
        setErrorMsg(explainError(e?.error));
      };

      rec.onresult = (event: any) => {
        console.log("Got result, resultIndex:", event.resultIndex);
        setIsListening(true); // Bevestig dat we actief luisteren

        let finalChunk = "";
        let interim = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          const transcript = r[0].transcript;

          if (r.isFinal) {
            finalChunk += transcript.trim() + " ";
            console.log("Final transcript:", transcript);
          } else {
            interim = transcript;
            console.log("Interim transcript:", transcript);
          }
        }

        if (interim) {
          onPartialText?.(interim);
        }

        if (finalChunk.trim()) {
          onPartialText?.("");
          onFinalText(finalChunk.trim());
        }
      };

      rec.onspeechstart = () => {
        console.log("Speech detected");
        setIsListening(true);
      };

      rec.onspeechend = () => {
        console.log("Speech ended");
        setIsListening(false);
      };

      recogRef.current = rec;

      // Start recognition
      try {
        rec.start();
        console.log("Starting speech recognition...");
      } catch (e: any) {
        console.error("Start error:", e);
        setBusy(false);
        setActive(false);
        setErrorMsg(explainError(e?.name || e?.message));
      }
    } catch (e: any) {
      console.error("Setup error:", e);
      setBusy(false);
      setActive(false);
      setErrorMsg(explainError(e?.name || e?.message));
    }
  }

  function stop() {
    console.log("Stopping speech recognition...");
    setActive(false);
    setIsListening(false);
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    try {
      recogRef.current?.stop();
    } catch (e) {
      console.warn("Stop error:", e);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {busy ? (
        <button type="button" className="inline-flex items-center px-3 py-2 rounded-md border" disabled>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starten…
        </button>
      ) : active ? (
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center px-3 py-2 rounded-md border bg-red-50 hover:bg-red-100 transition-colors"
        >
          {isListening ? (
            <Radio className="w-4 h-4 mr-2 text-red-600 animate-pulse" />
          ) : (
            <Square className="w-4 h-4 mr-2" />
          )}
          Stop luisteren
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          className="inline-flex items-center px-3 py-2 rounded-md border hover:bg-accent transition-colors"
        >
          <Mic className="w-4 h-4 mr-2" /> Handenvrij praten
        </button>
      )}

      {!!errorMsg && (
        <div className="flex items-start gap-1 text-xs text-muted-foreground max-w-[32rem] p-2 bg-amber-50 rounded border border-amber-200">
          <Info className="w-3.5 h-3.5 mt-0.5 text-amber-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
