import * as React from "react";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Square, RefreshCcw, Info, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Schedule, Course, Task } from "@shared/schema";
import CoachChat from "@/features/chat/CoachChat";

// geauthenticeerde fetch (voor /api/asr)
async function authedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers || {});
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}

const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : "");

export default function Vandaag() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  // === Datum helpers ===
  const today = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    const js = d.getDay();
    const dow = js === 0 ? 7 : js; // 1..7
    return { date: d, iso, dow };
  }, []);

  // === Courses & Schedule ===
  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["courses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("user_id", userId).order("name");
      if (error) throw new Error(error.message);
      return data as Course[];
    },
  });

  const { data: schedule = [], isLoading: scheduleLoading } = useQuery<Schedule[]>({
    queryKey: ["schedule", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("schedule").select("*").eq("user_id", userId);
      if (error) throw new Error(error.message);
      return data as Schedule[];
    },
  });

  const todayItems = React.useMemo(() => {
    const arr = (schedule as Schedule[]).filter((it) => {
      const notCancelled = (it.status || "active") !== "cancelled";
      the: {
        const isWeeklyToday = it.is_recurring && it.day_of_week === today.dow;
        const isSingleToday = !it.is_recurring && it.date === today.iso;
        if (notCancelled && (isWeeklyToday || isSingleToday)) return true;
      }
      return false;
    });
    return arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }, [schedule, today]);

  const getCourseById = (courseId: string | null) => courses.find((c) => c.id === courseId);

  // === Taken vandaag ===
  const { data: tasksToday = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["tasks-today", userId, today.iso],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .gte("due_at", `${today.iso}T00:00:00.000Z`)
        .lte("due_at", `${today.iso}T23:59:59.999Z`)
        .order("due_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data as Task[];
    },
  });

  // === Coach + Spraak ===
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [coachPrefill, setCoachPrefill] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  function getPreferredAudioMime(): string {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    for (const t of candidates) {
      if ((window as any).MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
    }
    return "audio/webm";
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getPreferredAudioMime();
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      setTranscript(null);

      mr.ondataavailable = (e) => e.data && e.data.size > 0 && chunksRef.current.push(e.data);
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
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    setIsRecording(false);
  }

  async function uploadAudio(blob: Blob) {
    try {
      setIsUploading(true);
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      form.append("audio", blob, `checkin.${ext}`);
      const res = await authedFetch("/api/asr", { method: "POST", body: form });
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

  // === Taken mutations ===
  const qcKey = ["tasks-today", userId, today.iso] as const;

  const addTaskMutation = useMutation({
    mutationFn: async (input: { title: string; courseId: string | null; estMinutes: number | null }) => {
      const dueDate = new Date(today.date);
      dueDate.setHours(20, 0, 0, 0);
      const { error } = await supabase.from("tasks").insert({
        user_id: userId,
        title: input.title,
        status: "todo",
        due_at: dueDate.toISOString(),
        course_id: input.courseId,
        est_minutes: input.estMinutes,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qcKey as any });
      toast({ title: "Taak toegevoegd" });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (task: Task) => {
      const next = task.status === "done" ? "todo" : "done";
      const { error } = await supabase.from("tasks").update({ status: next }).eq("id", (task as any).id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qcKey as any }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await supabase.from("tasks").delete().eq("id", (task as any).id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qcKey as any }),
  });

  // === Quick add taak ===
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [estMinutes, setEstMinutes] = useState<string>("");

  const onAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Titel is verplicht", variant: "destructive" });
      return;
    }
    addTaskMutation.mutate({
      title: title.trim(),
      courseId,
      estMinutes: estMinutes ? Number(estMinutes) : null,
    });
    setTitle(""); setCourseId(null); setEstMinutes("");
  };

  const coachSystemHint = `
Je bent een studiecoach. Integreer opvolging:
- Verwijs naar eerdere sessies (bv. “vorige keer was wiskunde lastig — hoe ging het nu?”).
- Stel korte, concrete vervolgstappen met realistische duur.
- Tekst via spraak is gewoon een normaal gebruikersbericht.
  `.trim();

  return (
    <div className="p-6 space-y-10" data-testid="page-vandaag">

      {/* === 1) COACH === */}
      <section>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Coach</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Uitleg coach">
                      <Info className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Hoe gebruik je de coach?</DialogTitle>
                      <DialogDescription>
                        Typ of spreek in wat je wilt leren, plannen of vragen.  
                        De coach onthoudt eerdere gesprekken en volgt op.
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </div>

              {!isRecording ? (
                <Button onClick={startRecording} size="sm" variant="default" disabled={isUploading}>
                  <Mic className="w-4 h-4 mr-2" /> Spreek in
                </Button>
              ) : (
                <Button variant="destructive" size="sm" onClick={stopRecording}>
                  <Square className="w-4 h-4 mr-2" /> Stop ({seconds}s)
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {transcript && (
              <div className="mb-3 p-3 rounded-md bg-muted text-sm whitespace-pre-wrap">
                {transcript}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => setCoachPrefill(transcript)}>Naar coach sturen</Button>
                  <Button variant="outline" size="sm" onClick={() => setTranscript(null)}>Opnieuw opnemen</Button>
                </div>
              </div>
            )}

            {/* Groot invoerveld voor de coach */}
            <Textarea
              placeholder="Vertel wat je wilt oefenen, waar je moeite mee hebt of wat je wilt plannen. Je kunt ook inspreken."
              className="min-h-24 text-base"
              value={coachPrefill}
              onChange={(e) => setCoachPrefill(e.target.value)}
            />

            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => {
                  if (coachPrefill.trim()) setCoachPrefill(coachPrefill.trim());
                }}
              >
                Verstuur naar coach
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6">
          <CoachChat
            prefill={coachPrefill}
            onPrefillConsumed={() => setCoachPrefill("")}
            systemHint={coachSystemHint}
            size="large"
          />
        </div>
      </section>

      {/* === 2) VANDAAG === */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Vandaag</h2>

        {/* Roosteritems */}
        {scheduleLoading ? (
          <div className="text-center py-3"><Loader2 className="w-5 h-5 animate-spin inline-block" /></div>
        ) : todayItems.length ? (
          <div className="space-y-2 mb-4">
            {todayItems.map((item) => {
              const course = getCourseById(item.course_id);
              return (
                <div key={item.id} className="border rounded p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{item.title || course?.name || "Activiteit"}</div>
                    <div className="text-sm text-muted-foreground">
                      {fmtTime(item.start_time)}{item.end_time ? ` – ${fmtTime(item.end_time)}` : ""}
                    </div>
                  </div>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{item.kind || "les"}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <Alert className="mb-4"><AlertDescription>Geen roosteritems voor vandaag.</AlertDescription></Alert>
        )}

        {/* Taken */}
        {tasksLoading ? (
          <div className="text-center py-3"><Loader2 className="w-5 h-5 animate-spin inline-block" /></div>
        ) : (
          <div className="space-y-2">
            {tasksToday.map((task) => {
              const isDone = task.status === "done";
              return (
                <div
                  key={task.id}
                  className={`group border rounded px-3 py-2 flex items-center justify-between ${isDone ? "opacity-60" : ""}`}
                >
                  <div className={`text-sm ${isDone ? "line-through" : ""}`}>{task.title}</div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="icon"
                      title={isDone ? "Markeer als niet afgerond" : "Markeer als afgerond"}
                      onClick={() => toggleTaskMutation.mutate(task)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      title="Verwijderen"
                      onClick={() => deleteTaskMutation.mutate(task)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {tasksToday.length === 0 && (
              <Alert><AlertDescription>Geen taken voor vandaag.</AlertDescription></Alert>
            )}
          </div>
        )}
      </section>

      {/* === 3) NIEUWE TAAK === */}
      <section aria-labelledby="add-task-title" className="space-y-3">
        <h2 id="add-task-title" className="text-lg font-semibold">Nieuwe taak</h2>

        <form onSubmit={onAddTask} className="space-y-3">
          <div>
            <Label htmlFor="t-title">Titel / omschrijving</Label>
            <Textarea
              id="t-title"
              placeholder="Bijv. Wiskunde §2.3 oefenen, Engelse woordjes H2, samenvatting H4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={3}
              className="min-h-24 text-base"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="t-course">Vak (optioneel)</Label>
              <Select value={courseId ?? "none"} onValueChange={(v) => setCourseId(v === "none" ? null : v)}>
                <SelectTrigger id="t-course">
                  <SelectValue placeholder="Kies vak" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen vak</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="t-min">Duur (min, opt.)</Label>
              <Input
                id="t-min"
                type="number"
                min={5}
                step={5}
                placeholder="30"
                value={estMinutes}
                onChange={(e) => setEstMinutes(e.target.value)}
              />
            </div>

            <div className="sm:col-span-1 flex items-end justify-start sm:justify-end">
              <Button type="submit" disabled={addTaskMutation.isPending} className="w-full sm:w-auto">
                {addTaskMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {addTaskMutation.isPending ? "Toevoegen…" : "Toevoegen"}
              </Button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
