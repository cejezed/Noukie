// client/src/pages/Vandaag.tsx
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mic, Square, Send, Plus, Loader2, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import type { Task, Course } from "@shared/schema";

// Kleine helpers
const fmtDate = (d?: string | null) => (d ? d.slice(0, 10) : "");
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function Vandaag() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();

  // -----------------------------
  // STATE: nieuw taak-formulier
  // -----------------------------
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>(todayIso());
  const [notes, setNotes] = useState("");

  // -----------------------------
  // STATE: opname / ASR
  // -----------------------------
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordTimeoutRef = useRef<number | null>(null);

  // -----------------------------
  // DATA: courses + taken vandaag
  // -----------------------------
  const { data: courses } = useQuery<Course[]>({
    queryKey: ["courses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/courses/${userId}`);
      return res.json();
    },
  });

  const { data: tasksToday, isLoading: tasksLoading, refetch: refetchTasks } = useQuery<Task[]>({
    queryKey: ["tasks", userId, "today"],
    enabled: !!userId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tasks/${userId}?date=${todayIso()}`);
      return res.json();
    },
  });

  // -----------------------------
  // MUTATIES
  // -----------------------------
  const createTask = useMutation({
    mutationFn: async (body: Partial<Task>) => {
      const res = await apiRequest("POST", "/api/tasks", body);
      if (!res.ok) throw new Error(`Task create failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Taak aangemaakt", description: "Je taak staat bij vandaag." });
      setCreateOpen(false);
      setTitle("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["tasks", userId, "today"] });
    },
    onError: (e: any) => {
      toast({ title: "Mislukt", variant: "destructive", description: e?.message ?? "Onbekende fout" });
    },
  });

  const toggleDone = useMutation({
    mutationFn: async (task: Task) => {
      const res = await apiRequest("PATCH", `/api/tasks/${task.id}`, { isDone: !task.isDone });
      if (!res.ok) throw new Error(`Task update failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", userId, "today"] }),
  });

  const delTask = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("DELETE", `/api/tasks/${taskId}`);
      if (!res.ok) throw new Error(`Task delete failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", userId, "today"] }),
  });

  // -----------------------------
  // HANDLERS: taak aanmaken
  // -----------------------------
  const handleCreateTask = async () => {
    if (!userId) {
      toast({ title: "Niet ingelogd", variant: "destructive", description: "Log eerst in om taken te kunnen maken." });
      return;
    }
    if (!title.trim()) {
      toast({ title: "Titel ontbreekt", variant: "destructive", description: "Geef je taak een korte titel." });
      return;
    }
    createTask.mutate({
      userId,
      title: title.trim(),
      dueDate,
      courseId: courseId || null,
      notes: notes || null,
      isDone: false,
    } as Partial<Task>);
  };

  // -----------------------------
  // HANDLERS: opname
  // -----------------------------
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast({ title: "Opnemen niet ondersteund", variant: "destructive", description: "Deze browser ondersteunt geen microfoon-opname." });
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recordChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);

      // max 60s
      recordTimeoutRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          toast({ title: "Opname gestopt", description: "Maximale duur (60s) bereikt." });
        }
      }, 60_000);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Kan microfoon niet starten", variant: "destructive", description: e?.message ?? "Onbekende fout" });
    }
  };

  const stopRecording = () => {
    try {
      if (recordTimeoutRef.current) {
        clearTimeout(recordTimeoutRef.current);
        recordTimeoutRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } catch (e) {
      console.error(e);
    }
  };

  const sendRecording = async () => {
    try {
      if (!audioBlob) {
        toast({ title: "Geen opname", variant: "destructive", description: "Neem eerst iets op." });
        return;
      }
      const fd = new FormData();
      fd.append("audio", audioBlob, "opname.webm");

      const res = await fetch("/api/asr", { method: "POST", body: fd });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`ASR ${res.status}: ${txt || "geen details"}`);
      }
      const data = await res.json();
      const t = data?.text || data?.transcript || "";
      setTranscript(t);

      toast({ title: "Transcriptie gelukt", description: t || "Geen tekst gedetecteerd." });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Versturen mislukt", variant: "destructive", description: e?.message ?? "Onbekende fout" });
    }
  };

  // -----------------------------
  // RENDER
  // -----------------------------
  if (authLoading) {
    return (
      <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Bezig met inloggen…
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Vandaag</h1>
          <p className="text-sm text-muted-foreground">Taken en snelle spraaknotities</p>
        </div>
        <Button type="button" onClick={() => setCreateOpen((v) => !v)} variant="secondary">
          <Plus className="h-4 w-4 mr-2" /> Nieuwe taak
        </Button>
      </div>

      {/* Taak maken */}
      {createOpen && (
        <div className="rounded-2xl border p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Titel</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Wiskunde paragraaf 4.2" />
            </div>
            <div>
              <Label>Vak (optioneel)</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue placeholder="Kies vak" /></SelectTrigger>
                <SelectContent>
                  {(courses ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                  <SelectItem value="">—</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Datum</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Notities</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Extra info…" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleCreateTask} disabled={createTask.isPending}>
              {createTask.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Opslaan
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Annuleren</Button>
          </div>
        </div>
      )}

      {/* Taken vandaag */}
      <div className="space-y-2">
        <h2 className="text-base font-medium">Vandaag ({todayIso()})</h2>
        {tasksLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : (tasksToday?.length ?? 0) === 0 ? (
          <Alert><AlertDescription>Geen taken voor vandaag. Maak er eentje met “Nieuwe taak”.</AlertDescription></Alert>
        ) : (
          <ul className="divide-y rounded-2xl border">
            {tasksToday!.map((t) => (
              <li key={t.id} className="p-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleDone.mutate(t)}
                  className={`h-6 w-6 rounded border flex items-center justify-center ${t.isDone ? "bg-green-500/10 border-green-500" : "bg-transparent"}`}
                  title={t.isDone ? "Markeer als niet gedaan" : "Markeer als gedaan"}
                >
                  {t.isDone ? <Check className="h-4 w-4" /> : null}
                </button>
                <div className="flex-1">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.courseName ? `${t.courseName} · ` : ""}{fmtDate(t.dueDate)}
                    {t.notes ? ` · ${t.notes}` : ""}
                  </div>
                </div>
                <Button type="button" size="icon" variant="ghost" onClick={() => delTask.mutate(String(t.id))} title="Verwijderen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Opnemen */}
      <div className="space-y-2">
        <h2 className="text-base font-medium">Snel opnemen</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={startRecording} disabled={isRecording} variant="default">
            <Mic className="h-4 w-4 mr-2" /> Opnemen
          </Button>
          <Button type="button" onClick={stopRecording} disabled={!isRecording} variant="secondary">
            <Square className="h-4 w-4 mr-2" /> Stop
          </Button>
          <Button type="button" onClick={sendRecording} disabled={!audioBlob} variant="outline">
            <Send className="h-4 w-4 mr-2" /> Stuur
          </Button>
          <div className="text-sm text-muted-foreground">
            {isRecording ? "Bezig met opnemen… (max 60s)" : audioBlob ? "Klaar om te versturen" : "Nog geen opname"}
          </div>
        </div>
        {transcript ? (
          <div className="rounded-xl border p-3 text-sm">
            <div className="mb-1 font-medium">Transcriptie</div>
            <p className="whitespace-pre-wrap">{transcript}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
