import * as React from "react";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Square, RefreshCcw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Schedule, Course, Task } from "@shared/schema";
import CoachChat from "@/features/chat/CoachChat";

const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : "");
async function authedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers || {});
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}

export default function Vandaag() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  // ====== Spraak check-in (bovenaan) ======
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

  // ====== Vandaag ======
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

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["courses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("user_id", userId);
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

  const todayItems = useMemo(() => {
    const arr = (schedule as any[]).filter((it) => {
      const notCancelled = (it.status || "active") !== "cancelled";
      const isWeeklyToday = it.is_recurring && it.day_of_week === today.dow;
      const isSingleToday = !it.is_recurring && it.date === today.iso;
      return notCancelled && (isWeeklyToday || isSingleToday);
    });
    return arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }, [schedule, today]);

  const { data: tasksToday = [] } = useQuery<Task[]>({
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

  // ====== Mutations ======
  const addTaskMutation = useMutation({
    mutationFn: async (input: {
      title: string;
      courseId: string | null;
      dueTime: string | null;
      estMinutes: number | null;
      notes: string | null;
    }) => {
      const { title, courseId, dueTime, estMinutes, notes } = input;
      const dueDate = new Date(today.date);
      const [h, m] = (dueTime ?? "20:00").split(":").map((x) => parseInt(x));
      dueDate.setHours(h || 20, m || 0, 0, 0);
      const row = {
        user_id: userId,
        title,
        status: "todo",
        due_at: dueDate.toISOString(),
        course_id: courseId,
        est_minutes: estMinutes,
        notes,
      };
      const { error } = await supabase.from("tasks").insert(row);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks-today", userId, today.iso] });
      toast({ title: "Taak toegevoegd" });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (task: Task) => {
      const next = task.status === "done" ? "todo" : "done";
      const { error } = await supabase.from("tasks").update({ status: next }).eq("id", (task as any).id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks-today", userId, today.iso] }),
  });

  // ====== Quick add state (zoals eerder) ======
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState("20:00");
  const [estMinutes, setEstMinutes] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const onAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Titel is verplicht", variant: "destructive" });
      return;
    }
    addTaskMutation.mutate({
      title: title.trim(),
      courseId,
      dueTime,
      estMinutes: estMinutes ? Number(estMinutes) : null,
      notes: notes || null,
    });
    setTitle(""); setCourseId(null); setDueTime("20:00"); setEstMinutes(""); setNotes("");
  };

  return (
    <div className="p-6 space-y-8" data-testid="page-vandaag">
      {/* 1) Spraak check-in BOVENAAN */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Spraak check-in</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center">
              {!isRecording ? (
                <Button onClick={startRecording} disabled={isUploading}>
                  <Mic className="w-4 h-4 mr-2" /> Opnemen
                </Button>
              ) : (
                <Button variant="destructive" onClick={stopRecording}>
                  <Square className="w-4 h-4 mr-2" /> Stoppen ({seconds}s)
                </Button>
              )}
              {isUploading && (
                <div className="text-sm text-muted-foreground flex items-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploaden...
                </div>
              )}
              {!isRecording && transcript && (
                <Button variant="outline" size="sm" onClick={() => setTranscript(null)}>
                  <RefreshCcw className="w-4 h-4 mr-2" /> Nieuwe opname
                </Button>
              )}
            </div>
            {transcript && (
              <div className="mt-3 p-3 rounded bg-muted text-sm whitespace-pre-wrap">
                {transcript}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 2) Coach (clean) */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Coach</h2>
        <CoachChat />
      </section>

      {/* 3) Quick add taak — groter invoerveld + velden zoals eerder */}
      <section aria-labelledby="add-task-title" className="space-y-3">
        <h2 id="add-task-title" className="text-lg font-semibold">Nieuwe taak</h2>

        <form onSubmit={onAddTask} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-start">
          <div className="md:col-span-3">
            <Label htmlFor="t-title">Titel / omschrijving</Label>
            <Textarea
              id="t-title"
              placeholder="Bijv. Wiskunde §2.3 oefenen, samenvatting par. 4.1, etc."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={3}
              className="min-h-24 text-base"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="t-course">Vak (optioneel)</Label>
            <Select value={courseId ?? ""} onValueChange={(v) => setCourseId(v || null)}>
              <SelectTrigger id="t-course">
                <SelectValue placeholder="Kies vak" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="t-time">Tijd</Label>
            <Input id="t-time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="t-min">Duur (min)</Label>
            <Input id="t-min" type="number" min={5} step={5} placeholder="30" value={estMinutes} onChange={(e) => setEstMinutes(e.target.value)} />
          </div>

          <div className="md:col-span-5">
            <Label htmlFor="t-notes">Notities (optioneel)</Label>
            <Textarea
              id="t-notes"
              placeholder="Waar ga je precies mee aan de slag?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="md:col-span-6 flex justify-end">
            <Button type="submit">
              <Plus className="w-4 h-4 mr-2" /> Toevoegen
            </Button>
          </div>
        </form>
      </section>

      {/* 4) Vandaag items */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Vandaag</h2>
        {scheduleLoading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <div className="space-y-2">
            {(todayItems as any[]).map((item) => (
              <div key={item.id} className="border rounded p-3">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{item.title || "Activiteit"}</div>
                    <div className="text-sm text-muted-foreground">
                      {fmtTime(item.start_time)}{item.end_time ? ` - ${fmtTime(item.end_time)}` : ""}
                    </div>
                  </div>
                  <span className="text-xs bg-muted px-2 rounded">{item.kind}</span>
                </div>
              </div>
            ))}
            {tasksToday.map((task) => (
              <div key={task.id} className="flex items-center gap-2 border rounded p-2">
                <Checkbox
                  checked={task.status === "done"}
                  onCheckedChange={() => toggleTaskMutation.mutate(task)}
                />
                <span className={task.status === "done" ? "line-through" : ""}>{task.title}</span>
              </div>
            ))}
            {(todayItems as any[]).length === 0 && tasksToday.length === 0 && (
              <Alert><AlertDescription>Geen items vandaag.</AlertDescription></Alert>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
