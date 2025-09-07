// client/src/pages/Vandaag.tsx
import * as React from "react";
import { useRef, useState } from "react";
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

const fmtDate = (d?: string | null) => (d ? d.slice(0, 10) : "");
const todayIso = () => new Date().toISOString().slice(0, 10);

// -------- opname helpers
const pickMimeType = () => {
  const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", ""];
  for (const t of opts) {
    // @ts-expect-error: isTypeSupported kan ontbreken in type defs
    if (!t || (window.MediaRecorder?.isTypeSupported?.(t) ?? false)) return t;
  }
  return "";
};
const stopTracks = (stream?: MediaStream | null) => {
  stream?.getTracks()?.forEach((t) => t.stop());
};

export default function Vandaag() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();

  // ---------- nieuw taak formulier
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>(todayIso());
  const [notes, setNotes] = useState("");

  // ---------- opname state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState("");
  const [sending, setSending] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timeoutRef = useRef<number | null>(null);

  // ---------- data
  const { data: courses } = useQuery<Course[]>({
    queryKey: ["courses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/courses/${userId}`);
      return res.json();
    },
  });

  const { data: tasksToday, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["tasks", userId, "today"],
    enabled: !!userId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tasks/${userId}?date=${todayIso()}`);
      return res.json();
    },
  });

  // ---------- mutaties taken
  const createTask = useMutation({
    mutationFn: async (body: Partial<Task>) => {
      const res = await apiRequest("POST", "/api/tasks", body);
      if (!res.ok) throw new Error(`Task create failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Taak aangemaakt", description: "Je taak staat bij vandaag." });
      setCreateOpen(false);
      setTitle(""); setNotes("");
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

  // ---------- handlers taken
  const handleCreateTask = () => {
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

  // ---------- handlers opname
  const startRecording = async () => {
    try {
      if (!("MediaRecorder" in window) || !navigator.mediaDevices?.getUserMedia) {
        toast({
          title: "Opnemen niet ondersteund",
          variant: "destructive",
          description: "Probeer Chrome/Edge op desktop of een recente mobiele browser."
        });
        return;
      }

      // UI meteen laten reageren
      setIsRecording(true);
      setAudioBlob(null);
      setTranscript("");
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mr.onerror = (ev) => {
        console.error("MediaRecorder error", ev);
        toast({ title: "Opnamefout", variant: "destructive", description: "Kon niet opnemen." });
        setIsRecording(false);
        stopTracks(stream);
      };
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        try {
          const type = mimeType || (chunksRef.current[0] as any)?.type || "audio/webm";
          const blob = new Blob(chunksRef.current, { type });
          setAudioBlob(blob);
        } finally {
          stopTracks(stream); // microfoon vrijgeven
        }
      };

      mr.start();
      mediaRecorderRef.current = mr;
      (mediaRecorderRef.current as any).__stream = stream;

      // Max 60s safeguard
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          toast({ title: "Opname gestopt", description: "Maximale duur (60s) bereikt." });
        }
      }, 60_000);
    } catch (e: any) {
      console.error(e);
      setIsRecording(false);
      toast({
        title: "Kan microfoon niet starten",
        variant: "destructive",
        description:
          e?.name === "NotAllowedError"
            ? "Toestemming geweigerd. Sta microfoontoegang toe."
            : e?.message ?? "Onbekende fout"
      });
    }
  };

  const stopRecording = () => {
    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const mr = mediaRecorderRef.current;
      if (mr?.state === "recording") {
        mr.stop();
      } else {
        // geen recording, maar sluit eventueel open stream
        stopTracks((mr as any)?.__stream);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRecording(false);
    }
  };

  const sendRecording = async () => {
    if (!audioBlob) {
      toast({ title: "Geen opname", variant: "destructive", description: "Neem eerst iets op." });
      return;
    }
    try {
      setSending(true);
      // webm → .webm, mp4 → .m4a voor nette bestandsnaam
      const filename = audioBlob.type?.includes("mp4") ? "opname.m4a" : "opname.webm";
      const fd = new FormData();
      fd.append("audio", audioBlob, filename);

      const res = await fetch("/api/asr", { method: "POST", body: fd });
      const txt = await res.text();

      if (!res.ok) {
        console.error("ASR error", res.status, txt);
        throw new Error(`ASR ${res.status} ${txt || ""}`.trim());
      }

      // probeer JSON, anders plain text
      try {
        const j = JSON.parse(txt);
        const t = j?.text || j?.transcript || "";
        setTranscript(t);
        toast({ title: "Transcriptie gelukt", description: t || "Geen tekst gedetecteerd." });
      } catch {
        setTranscript(txt);
        toast({ title: "Transcriptie gelukt", description: txt || "Geen tekst gedetecteerd." });
      }
    } catch (e: any) {
      toast({ title: "Versturen mislukt", variant: "destructive", description: e?.message ?? "Onbekende fout" });
    } finally {
      setSending(false);
    }
  };

  // ---------- render
  if (authLoading) {
    return (
      <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Bezig met inloggen…
      </div>
    );
  }

  return (
    <div className="p-4 space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Vandaag</h1>
          <p className="text-sm text-muted-foreground">Taken en spraaknotities</p>
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

      {/* Opnemen + Versturen */}
      <div className="space-y-2">
        <h2 className="text-base font-medium">Snel opnemen</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={startRecording} disabled={isRecording}>
            <Mic className="h-4 w-4 mr-2" /> Opnemen
          </Button>
          <Button type="button" onClick={stopRecording} disabled={!isRecording} variant="secondary">
            <Square className="h-4 w-4 mr-2" /> Stop
          </Button>
          <Button type="button" onClick={sendRecording} disabled={!audioBlob || sending} variant="outline">
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Verstuur
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

        {!("MediaRecorder" in window) && (
          <Alert>
            <AlertDescription>
              MediaRecorder wordt niet ondersteund in deze browser. Probeer Chrome of Edge op desktop.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
