// client/src/pages/Vandaag.tsx
import * as React from "react";
import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Trash2, Info, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Schedule, Course, Task } from "@shared/schema";
import CoachChat, { type CoachChatHandle } from "@/features/chat/CoachChat";
import VoiceCheckinButton from "@/features/voice/VoiceCheckinButton";

const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : "");

// ── Daggrenzen in lokale tijd (Europe/Amsterdam) → naar UTC ISO strings ──
function getLocalDayBounds(dateLike: Date | string) {
  const d = typeof dateLike === "string" ? new Date(dateLike) : new Date(dateLike);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);              // lokale 00:00
  const end = new Date(start);
  end.setDate(end.getDate() + 1);          // lokale 24:00 (volgende dag)
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

// Type voor coach_memory rijen (lichtgewicht)
type CoachMemory = {
  id: string;
  user_id: string;
  course: string;
  status: string | null;       // "moeilijk" | "ging beter" | "ok" | null
  note: string | null;
  last_update: string | null;  // ISO
};

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

  const todayItems = useMemo(() => {
    const arr = (schedule as Schedule[]).filter((it) => {
      const notCancelled = (it.status || "active") !== "cancelled";
      const isWeeklyToday = it.is_recurring && it.day_of_week === today.dow;
      const isSingleToday = !it.is_recurring && it.date === today.iso;
      return notCancelled && (isWeeklyToday || isSingleToday);
    });
    return arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }, [schedule, today]);

  const getCourseById = (courseId: string | null) => courses.find((c) => c.id === courseId);

  // === Taken vandaag ===
  const { data: tasksToday = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["tasks-today", userId, today.iso],
    enabled: !!userId,
    queryFn: async () => {
      const { startISO, endISO } = getLocalDayBounds(today.iso);
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .gte("due_at", startISO)
        .lt("due_at", endISO)
        .order("due_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data as Task[];
    },
  });

  // === Coach-memory (voor proactieve opvolging) ===
  const { data: coachMemory = [] } = useQuery<CoachMemory[]>({
    queryKey: ["coach-memory", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_memory")
        .select("*")
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return data as CoachMemory[];
    },
  });

  // === Taken mutations ===
  const qcKey = ["tasks-today", userId, today.iso] as const;

  const addTaskMutation = useMutation({
    mutationFn: async (input: { title: string; courseId: string | null; estMinutes: number | null }) => {
      const { startISO } = getLocalDayBounds(today.iso);
      const dueLocal = new Date(startISO);
      dueLocal.setHours(20, 0, 0, 0);
      const { error } = await supabase.from("tasks").insert({
        user_id: userId,
        title: input.title,
        status: "todo",
        due_at: dueLocal.toISOString(),
        course_id: input.courseId,
        est_minutes: input.estMinutes,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qcKey as any });
      toast({ title: "Taak toegevoegd" });
    },
    onError: (e: any) => {
      toast({ title: "Toevoegen mislukt", variant: "destructive", description: e?.message ?? "Onbekende fout" });
    },
  });

  const toggleDone = useMutation({
    mutationFn: async (task: Task) => {
      const next = task.status === "done" ? "todo" : "done";
      const { error } = await supabase.from("tasks").update({ status: next }).eq("id", (task as any).id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qcKey as any }),
  });

  const delTask = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await supabase.from("tasks").delete().eq("id", taskId);
      if (res.error) throw new Error(res.error.message);
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

  // === CoachChat externe composer ===
  const coachRef = useRef<CoachChatHandle>(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const text = msg.trim();
    if (!text) {
      toast({ title: "Leeg bericht", description: "Typ eerst je bericht.", variant: "destructive" });
      return;
    }
    if (!coachRef.current?.sendMessage) {
      toast({ title: "Chat niet klaar", description: "CoachChat is nog niet geladen.", variant: "destructive" });
      return;
    }
    try {
      setSending(true);
      // Belangrijk: geen extra args; signatuur is (text: string) => void|Promise
      const maybePromise = coachRef.current.sendMessage(text);
      if (maybePromise && typeof (maybePromise as any).then === "function") {
        await (maybePromise as Promise<any>);
      }
      setMsg("");
    } catch (err: any) {
      toast({ title: "Versturen mislukt", description: err?.message ?? "Onbekende fout", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  // === Context voor Noukie (CoachChat) ===
  const coachContext = {
    todayDate: today.iso,
    todaySchedule: todayItems.map((i) => ({
      kind: i.kind,
      course: getCourseById(i.course_id)?.name ?? i.title ?? "Activiteit",
      start: i.start_time,
      end: i.end_time,
    })),
    openTasks: tasksToday.map((t) => ({ id: t.id, title: t.title, status: t.status, courseId: t.course_id })),
    difficulties: coachMemory.map((m) => ({
      course: m.course,
      status: m.status,
      note: m.note,
      lastUpdate: m.last_update,
    })),
  };

  // === Proactieve openingsvraag (natuurlijker, geen vaste blokken) ===
  const difficultSet = new Set(
    coachMemory
      .filter((m) => (m.status ?? "").toLowerCase() === "moeilijk")
      .map((m) => (m.course ?? "").toLowerCase().trim())
  );
  const todayCourseNames = todayItems
    .map((i) => (getCourseById(i.course_id)?.name ?? i.title ?? "").trim())
    .filter(Boolean);
  const flaggedToday = todayCourseNames.filter((n) => difficultSet.has(n.toLowerCase()));

  const initialCoachMsg = flaggedToday.length
    ? `Ik zie vandaag ${flaggedToday.join(" en ")} op je rooster — dat voelde eerder lastig. Wat zou nu het meest helpen?`
    : tasksToday.length
    ? `Wat wil je als eerste oppakken? Ik denk even mee als je wilt.`
    : `Waar heb je vandaag zin in of juist tegenzin? Beginnen we klein.`;

  const coachingSystemHintSafe = (s: string | undefined) => {
    const t = (s || "").trim();
    return t.length ? t : "Je bent een vriendelijke studiecoach. Wees proactief, positief en kort.";
  };

  const coachSystemHint = `
Je bent Noukie, een vriendelijke studiecoach. Reageer kort, natuurlijk en in het Nederlands.
- Gebruik context (rooster/taken/memory) alleen als het helpt; noem het niet expliciet tenzij relevant.
- Bied GEEN vaste blokken of schema's aan, tenzij de gebruiker daar duidelijk om vraagt.
- Max 2-3 zinnen. Hoogstens 1 vraag terug als dat nodig is.
- Vier kleine successen. Als de gebruiker planning vraagt: doe 1- of 2 concrete vervolgstappen (geen “3 blokken”-sjabloon).
`.trim();

  return (
    <div className="p-6 space-y-10 pointer-events-auto" data-testid="page-vandaag">
      {/* 1) Uitleg + Chat met Noukie (composer bovenaan met opnemen + Stuur) */}
      <section className="rounded-2xl border p-4 space-y-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 mt-0.5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">Vandaag</h1>
            <p className="text-sm text-muted-foreground">
              Dit is je Noukie-dagstart: maak snel een spraaknotitie, stuur een bericht, check je rooster en werk je taken af.
            </p>
          </div>
        </div>

        <CoachChat
          ref={coachRef}
          systemHint={coachingSystemHintSafe(coachSystemHint)}
          context={coachContext}
          size="large"
          hideComposer
          initialAssistantMessage={initialCoachMsg}
          threadKey={`today:${userId || 'anon'}`}
        />

        {/* Externe composer met Voice + Stuur */}
        <form onSubmit={handleSend} className="space-y-3">
          <Textarea
            placeholder="Wat wil je oefenen of afronden? Schrijf het hier."
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={4}
            className="min-h-28 text-base"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <VoiceCheckinButton
              userId={userId}
              onComplete={async (res) => {
                const t = res?.text?.trim();
                if (!t) return;
                // plak transcript in het tekstvak
                setMsg((prev) => (prev ? prev + (prev.endsWith("\n") ? "" : "\n") + t : t));
                // optioneel: log check-in in coach_memory
                try {
                  const { error } = await supabase.from("coach_memory").insert({
                    user_id: userId,
                    course: "algemeen",
                    status: null,
                    note: t,
                  });
                  if (!error) toast({ title: "Check-in opgeslagen", description: t });
                } catch (e: any) {
                  toast({ title: "Opslaan mislukt", description: e?.message ?? "Onbekende fout", variant: "destructive" });
                }
              }}
              labelIdle="🎙️ Opnemen"
              labelStop="Stop"
            />
            <Button type="submit" disabled={sending}>
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {sending ? "Versturen…" : "Stuur"}
            </Button>
          </div>
        </form>
      </section>

      {/* 2) Vandaag: rooster + taken */}
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

        {/* Taken — knoppen altijd zichtbaar */}
        {tasksLoading ? (
          <div className="text-center py-3"><Loader2 className="w-5 h-5 animate-spin inline-block" /></div>
        ) : (
          <div className="space-y-2">
            {tasksToday.map((task) => {
              const isDone = task.status === "done";
              return (
                <div key={task.id} className={`border rounded px-3 py-2 flex items-center justify-between ${isDone ? "opacity-70" : ""}`}>
                  <div className={`text-sm ${isDone ? "line-through" : ""}`}>{task.title}</div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      title={isDone ? "Markeer als niet afgerond" : "Markeer als afgerond"}
                      onClick={() => toggleDone.mutate(task)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      title="Verwijderen"
                      onClick={() => delTask.mutate(task.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {tasksToday.length === 0 && <Alert><AlertDescription>Geen taken voor vandaag.</AlertDescription></Alert>}
          </div>
        )}
      </section>

      {/* 3) Nieuwe taak */}
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
              <Label htmlFor="t-course">Vak (optie)</Label>
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
