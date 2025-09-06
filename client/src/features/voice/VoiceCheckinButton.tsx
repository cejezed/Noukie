import * as React from "react";

type Props = {
  userId?: string;
  onComplete?: (result: { text?: string; url?: string } | null) => void;
  className?: string;
};

export default function VoiceCheckinButton({ userId, onComplete, className }: Props) {
  const [recorder, setRecorder] = React.useState<MediaRecorder | null>(null);
  const [chunks, setChunks] = React.useState<BlobPart[]>([]);
  const [isRec, setIsRec] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (recorder && recorder.state !== "inactive") recorder.stop();
    };
  }, [recorder]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const localChunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data && localChunks.push(e.data);
      rec.onstop = async () => {
        setIsRec(false);
        setRecorder(null);
        try {
          const blob = new Blob(localChunks, { type: rec.mimeType || "audio/webm" });
          setBusy(true);
          const fd = new FormData();
          fd.append("file", blob, `checkin-${Date.now()}.webm`);
          if (userId) fd.append("userId", userId);

          // Belangrijk: geen custom headers; FormData laat de browser boundary zetten
          const resp = await fetch("/api/asr", { method: "POST", body: fd });
          const json = await resp.json().catch(() => ({}));
          onComplete?.(json ?? null);
        } catch {
          onComplete?.(null);
        } finally {
          setBusy(false);
          setChunks([]);
          // stop alle tracks
          stream.getTracks().forEach((t) => t.stop());
        }
      };
      rec.start();
      setRecorder(rec);
      setChunks(localChunks);
      setIsRec(true);

      // auto-stop na 60s (projectlimiet)
      timeoutRef.current = window.setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 60_000);
    } catch (err) {
      console.error("Mic start failed", err);
      onComplete?.(null);
    }
  }

  function stop() {
    if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (recorder && recorder.state === "recording") recorder.stop();
  }

  return (
    <button
      type="button"
      onClick={isRec ? stop : start}
      disabled={busy}
      className={
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 border " +
        (isRec ? "bg-red-600 text-white border-red-700" : "bg-white hover:bg-muted border-gray-300") +
        (busy ? " opacity-60 cursor-not-allowed" : "") +
        (className ? ` ${className}` : "")
      }
      title={isRec ? "Stop opname" : "Start opname"}
    >
      <span aria-hidden>🎙️</span>
      {busy ? "Uploaden…" : isRec ? "Stop" : "Opnemen"}
    </button>
  );
}
