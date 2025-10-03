// client/src/features/chat/VoiceButton.tsx
import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

type Props = {
  onTranscript: (text: string) => void;
  lang?: string;
};

export default function VoiceButton({ onTranscript, lang = "nl" }: Props) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaRec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);

  useEffect(() => {
    return () => {
      if (mediaRec.current && mediaRec.current.state !== "inactive") {
        mediaRec.current.stop();
      }
    };
  }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunks.current = [];
      
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.current.push(e.data);
        }
      };
      
      rec.onstop = async () => {
        try {
          setBusy(true);
          const blob = new Blob(chunks.current, { type: "audio/webm" });
          const fd = new FormData();
          fd.append("audio", blob, "voice.webm");
          fd.append("lang", lang);

          // Prefer VITE_API_BASE; fallback naar /api
          const base = (import.meta.env.VITE_API_BASE as string) || "/api";
          const res = await fetch(`${base}/asr`, { method: "POST", body: fd });
          
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || "Transcriptie mislukt");
          }
          
          const data = await res.json();
          const text = data.transcript || data.text; // Support both formats
          
          if (text) {
            onTranscript(text);
          } else {
            console.warn("No transcript received from server");
          }
        } catch (e: any) {
          console.error("Transcription error:", e);
          alert(`Spraakherkenning mislukt: ${e.message}`);
        } finally {
          setBusy(false);
          // Stop all tracks
          stream.getTracks().forEach(t => t.stop());
        }
      };
      
      mediaRec.current = rec;
      rec.start();
      setRecording(true);
    } catch (e: any) {
      console.error("Mic access error:", e);
      alert("Kon geen toegang krijgen tot de microfoon. Geef toestemming in je browser instellingen.");
    }
  }

  function stop() {
    if (mediaRec.current && mediaRec.current.state !== "inactive") {
      mediaRec.current.stop();
      setRecording(false);
    }
  }

  if (busy) {
    return (
      <button 
        type="button" 
        className="inline-flex items-center px-3 py-2 rounded-md border bg-slate-50" 
        disabled
      >
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verwerken…
      </button>
    );
  }

  return recording ? (
    <button 
      type="button" 
      onClick={stop} 
      className="inline-flex items-center px-3 py-2 rounded-md border bg-red-50 hover:bg-red-100"
    >
      <Square className="w-4 h-4 mr-2 text-red-600" /> Stop opname
    </button>
  ) : (
    <button 
      type="button" 
      onClick={start} 
      className="inline-flex items-center px-3 py-2 rounded-md border hover:bg-slate-50"
    >
      <Mic className="w-4 h-4 mr-2" /> Spreek in
    </button>
  );
}