import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

type Props = {
  onTranscript: (text: string) => void;   // callback met herkende tekst
  lang?: string;                           // bv. "nl"
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
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
        if (!res.ok) throw new Error(await res.text());
        const { text } = await res.json();
        if (text) onTranscript(text);
      } catch (e) {
        console.error(e);
      } finally {
        setBusy(false);
      }
    };
    mediaRec.current = rec;
    rec.start();
    setRecording(true);
  }

  function stop() {
    mediaRec.current?.stop();
    mediaRec.current?.stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }

  if (busy) {
    return (
      <button type="button" className="inline-flex items-center px-3 py-2 rounded-md border" disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verwerken…
      </button>
    );
  }

  return recording ? (
    <button type="button" onClick={stop} className="inline-flex items-center px-3 py-2 rounded-md border bg-red-50">
      <Square className="w-4 h-4 mr-2" /> Stop
    </button>
  ) : (
    <button type="button" onClick={start} className="inline-flex items-center px-3 py-2 rounded-md border">
      <Mic className="w-4 h-4 mr-2" /> Spreek in
    </button>
  );
}
