import * as React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  userId?: string;
  onComplete?: (result: { text?: string; url?: string } | null) => void;
  className?: string;
  labelIdle?: string;   // "Opnemen" (default)
  labelBusy?: string;   // "Uploaden…"
  labelStop?: string;   // "Stop"
};

export default function VoiceCheckinButton({
  userId,
  onComplete,
  className,
  labelIdle = "Opnemen",
  labelBusy = "Uploaden…",
  labelStop = "Stop",
}: Props) {
  const [recorder, setRecorder] = React.useState<MediaRecorder | null>(null);
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
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        setIsRec(false);
        setRecorder(null);
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          setBusy(true);
          const fd = new FormData();
          fd.append("file", blob, `checkin-${Date.now()}.webm`);
          if (userId) fd.append("userId", userId);
          const resp = await fetch("/api/asr", { method: "POST", body: fd });
          const json = await resp.json().catch(() => ({}));
          onComplete?.(json ?? null);
        } catch {
          onComplete?.(null);
        } finally {
          setBusy(false);
          try { (rec.stream as MediaStream)?.getTracks().forEach((t) => t.stop()); } catch {}
        }
      };
      rec.start();
      setRecorder(rec);
      setIsRec(true);
      timeoutRef.current = window.setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 60_000);
    } catch {
      onComplete?.(null);
    }
  }

  function stop() {
    if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (recorder && recorder.state === "recording") recorder.stop();
  }

  const isDisabled = busy;

  return (
    <Button
      type="button"
      onClick={isRec ? stop : start}
      disabled={isDisabled}
      className={[
        isRec ? "bg-red-600 hover:bg-red-700" : "", // rood tijdens opnemen
        className ?? "",
      ].join(" ")}
      title={isRec ? "Stop opname" : "Start opname"}
    >
      <span aria-hidden>🎙️</span>
      {busy ? labelBusy : isRec ? labelStop : labelIdle}
    </Button>
  );
}
