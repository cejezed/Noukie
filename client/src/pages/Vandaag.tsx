import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Mic, Square, RefreshCcw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Schedule, Course } from "@shared/schema";

// 👉 Coach bovenaan (duidelijke sectie + uitleg)
import CoachChat from "@/features/chat/CoachChat";

export default function Vandaag() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id ?? "";

  // ====== MICROFOON OPNAME (max 60s) ======
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  function getPreferredAudioMime(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    for (const t of candidates) {
      if ((window as any).MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
    }
    return "audio/webm"; // fallback
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getPreferredAudioMime();
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      setTranscript(null);

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await uploadAudio(blob);
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setSeconds(0);

      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s >= 59) {
            stopRecording();
            return 60;
          }
          return s + 1;
        });
      }, 1000) as unknown as number;
    } catch (err: any) {
      toast({ title: "Microfoon geweigerd", description: err?.message ?? "Kan microfoon niet openen.", variant: "destructive" });
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
    setIsRecording(false);
  }

  async function uploadAudio(blob: Blob) {
    try {
      setIsUploading(true);
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      form.append("audio", blob, `checkin.${ext}`);
      const res = await fetch("/api/asr", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Upload mislukt (${res.status})`);
      const data = await res.json().catch(() => ({}));
      const text = data?.text || data?.transcript || "(geen transcript ontvangen)";
      setTranscript(text);
      toast({ title: "Opname verwerkt", description: "Transcript is binnen." });
    } catch (e: any) {
      toast({ title: "Fout bij uploaden", description: e?.message ?? "Onbekende fout", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }

  // ====== VANDAAGSE ITEMS ======
  const today = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    const js = d.getDay();
    const dow = js === 0 ? 7 : js; // 1..7
    return { iso, dow };
  }, []);

  const { data: schedule = [], isLoading: scheduleLoading } = useQuery<Schedule[]>({
    queryKey: ["schedule", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule")
        .select("*")
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return data as Schedule[];
    },
    enabled: !!userId,
  });

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["courses", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("user_id", userId);
      if (error) throw new Error(error.message);
      return data as Course[];
    },
    enabled: !!userId,
  });

  const todayItems = useMemo(() => {
    const arr = schedule.filter((it) => {
      const notCancelled = (it.status || "active") !== "cancelled";
      const isWeeklyToday = it.is_recurring && it.day_of_week === today.dow;
      const isSingleToday = !it.is_recurring && it.date === today.iso;
      return notCancelled && (isWeeklyToday || isSingleToday);
    });
    return arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }, [schedule, today]);

  const getCourseById = (courseId: string | null) => courses.find((c) => c.id === courseId);
  const formatTime = (t?: string | null) => (t ? t.slice(0, 5) : "");
  const getKindLabel = (k?: string | null) => ({
    les: "Les",
    toets: "Toets",
    sport: "Sport",
    werk: "Werk",
    afspraak: "Afspraak",
    hobby: "Hobby",
    anders: "Anders",
  }[k || "les"]);

  return (
    <div className="p-6" data-testid="page-vandaag">
      {/* 1) Coach bovenaan */}
      <section aria-labelledby="coach-title" className="mb-6">
        <div className="mb-2">
          <div className="flex items-center justify-between">
  <h2 id="coach-title" className="text-lg font-semibold">Coach</h2>
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Uitleg coach">
        <Info className="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Hoe haal je het meeste uit de coach?</DialogTitle>
        <DialogDescription>Een paar snelle tips en voorbeeldzinnen.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="font-medium">Wees concreet</span>: noem vak/onderwerp, doel, tijd/duur en deadline.</li>
          <li><span className="font-medium">1 taak per bericht</span> werkt vaak duidelijker dan alles tegelijk.</li>
          <li><span className="font-medium">Gebruik tijden</span> zodat plannen automatisch kan (bijv. “vandaag 19:30–20:00”).</li>
          <li><span className="font-medium">Zeg wat lastig is</span>, dan krijg je uitleg of een oefenplan.</li>
        </ul>
        <div className="rounded-md bg-muted p-3">
          <div className="font-medium mb-1">Voorbeelden</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>“Maak voor vandaag een plan: 19:30–20:00 wiskunde H2 oefenen, 20:10–20:30 Engels woordjes H2.”</li>
            <li>“Ik snap paragraaf 4.1 over grafieken niet. Leg uit en stel 3 oefenvragen.”</li>
            <li>“Toets vrijdag biologie H3: stel 4 korte leersessies voor deze week.”</li>
          </ul>
        </div>
        <p className="text-muted-foreground">Tip: heb je iets ingesproken bij <span className="font-medium">Spraak check-in</span>? Plak de transcript hier als bericht om direct feedback te krijgen.</p>
      </div>
    </DialogContent>
  </Dialog>
</div>
<p className="text-sm text-muted-foreground">Chat direct met je coach. Gebruik het i-icoon voor uitleg en voorbeelden.</p>
        </div>
        <CoachChat />
      </section>

      {/* 2) Opnamekaart */}
      <section aria-labelledby="speech-title" className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle id="speech-title">Spraak check-in</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {!isRecording ? (
                <Button onClick={startRecording} disabled={isUploading}>
                  <Mic className="w-4 h-4 mr-2" /> Opnemen (max 60s)
                </Button>
              ) : (
                <Button variant="destructive" onClick={stopRecording}>
                  <Square className="w-4 h-4 mr-2" /> Stoppen ({seconds}s)
                </Button>
              )}
              {isUploading && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploaden/verwerken…
                </div>
              )}
              {!isRecording && transcript && (
                <Button variant="outline" size="sm" onClick={() => setTranscript(null)}>
                  <RefreshCcw className="w-4 h-4 mr-2" /> Nieuwe opname
                </Button>
              )}
            </div>

            {transcript ? (
              <div className="mt-4 p-3 rounded-md bg-muted text-sm whitespace-pre-wrap">
                {transcript}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Vertel kort wat je vandaag gaat doen of wat lastig is. Ik maak er een transcript van.</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 3) Vandaagse items */}
      <section aria-labelledby="today-title">
        <h2 id="today-title" className="text-lg font-semibold mb-3">Vandaag</h2>
        {scheduleLoading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : todayItems.length ? (
          <div className="space-y-2">
            {todayItems.map((item) => {
              const course = getCourseById(item.course_id);
              return (
                <div key={item.id} className="bg-card border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{item.title || course?.name || "Activiteit"}</h3>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted">{getKindLabel(item.kind)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatTime(item.start_time)}{item.end_time ? ` – ${formatTime(item.end_time)}` : ""}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Alert className="bg-muted/40">
            <AlertDescription>Geen items voor vandaag.</AlertDescription>
          </Alert>
        )}
      </section>
    </div>
  );
}
