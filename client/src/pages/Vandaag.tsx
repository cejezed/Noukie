// client/src/pages/Vandaag.tsx
import * as React from "react";
import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Schedule, Course, Task } from "@shared/schema";
import CoachChat, { type CoachChatHandle } from "@/features/chat/CoachChat";
import VoiceCheckinButton from "@/features/voice/VoiceCheckinButton";

const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : "");

// Daggrenzen (lokale tijd) -> ISO
function getLocalDayBounds(dateLike: Date | string) {
  const d = typeof dateLike === "string" ? new Date(dateLike) : new Date(dateLike);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

type CoachMemory = {
  id: string;
  user_id: string;
  course: string;
  status: string | null;
  note: string | null;
  last_update: string | null;
};

export default function Vandaag() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  // Datum helpers
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

  // Courses & schedule
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

  // Taken vandaag
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

  // Coach memory
  const { data: coachMemory = [] } = useQuery<CoachMemory[]>({
    queryKey: ["coach-memory", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("coach_memory").select("*").eq("user_id", userId);
      if (error) throw new Error(error.message);
      return data as CoachMemory[];
    },
  });

  // Taken mutations
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

  // Quick add taak
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

  // CoachChat via externe composer
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
      const p = coachRef.current.sendMessage(text);
      if (p && typeof (p as any).then === "function") await (p as Promise<any>);
      setMsg("");
    } catch (err: any) {
      toast({ title: "Versturen mislukt", description: err?.message ?? "Onbekende fout", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  // Context voor Noukie (CoachChat)
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

  const coachSystemHint = `
Je bent Noukie, een vriendelijke studiecoach. Reageer kort, natuurlijk en in het Nederlands.
- Gebruik context (rooster/taken/memory) alleen als het helpt; noem het niet expliciet tenzij relevant.
- Bied GEEN vaste blokken of schema's aan, tenzij de gebruiker daar duidelijk om vraagt.
- Max 2-3 zinnen. Hoogstens 1 vraag terug als dat nodig is.
- Vier kleine successen. Als de gebruiker planning vraagt: doe 1–2 concrete vervolgstappen (geen sjablonen).
`.trim();

  return (
    <div className="p-6 space-y-8" data-testid="page-vandaag">
      {/* 1) Chatsectie */}
      <section className="rounded-xl border border-border/60 p-4 space-y-4 bg-card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">Vandaag</h1>
            <p className="text-sm text-muted-foreground">
              Je dagstart met Noukie: stuur een bericht of spreek snel iets in.
            </p>
          </div>

          {/* Info als popup */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Tips & uitleg">
                <Info className="h-5 w-5 text-muted-foreground" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tips voor Vandaag</DialogTitle>
              </DialogHeader>
              <ul className="space-y-3 pt-2 text-sm">
                <li><strong>1. Start klein:</strong> kies één ding om nu te doen.</li>
                <li><strong>2. Chat voor planning/motivatie:</strong> vraag om 1–2 concrete vervolgstappen.</li>
                <li><strong>3. Leren of uitleg nodig?</strong> Ga naar de <strong>Uitleg</strong>-tab. Daar werkt de leercoach in studeer-modus met stap-voor-stap uitleg en oefenvragen.</li>
              </ul>
            </DialogContent>
          </Dialog>
        </div>

        {/* Chat (zonder openingsbubbel) */}
        <CoachChat
          ref={coachRef}
          systemHint={coachSystemHint}
          context={coachContext}
          size="large"
          hideComposer
          threadKey={`today:${userId || "anon"}`}
        />

        {/* Externe composer */}
        <form onSubmit={handleSend} className="space-y-3">
          <Textarea
            placeholder="Hoe ging het op school? Waar kan ik je mee helpen?"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={3}
            className="min-h-24 text-base"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <VoiceCheckinButton
              userId={userId}
              onComplete={async (res) => {
                const t = res?.text?.trim();
                if (!t) return;
                setMsg((prev) => (prev ? `${prev}\n${t}` : t));
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
          </div><div className="text-sm text-muted-foreground mt-2">
  Zoek je hulp bij leren of studeren?
  <a
    href="/LeerChat"
    className="text-blue-600 hover:underline ml-1"
  >
    Ga naar Uitleg →
  </a>
</div>
        </form>
      </section>

      {/* 2) Vandaag – rooster (subtiele lijnen) */}
      <section aria-labelledby="vandaag-rooster">
        <h2 id="vandaag-rooster" className="text-lg font-semibold mb-3">Vandaag</h2>
        {scheduleLoading ? (
          <div className="text-center py-3"><Loader2 className="w-5 h-5 animate-spin inline-block" /></div>
        ) : todayItems.length ? (
          <ul className="rounded-lg border border-border/60 divide-y divide-border/60 overflow-hidden mb-4">
            {todayItems.map((item) => {
              const course = getCourseById(item.course_id);
              return (
                <li key={item.id} className="px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{item.title || course?.name || "Activiteit"}</div>
                    <div className="text-sm text-muted-foreground">
                      {fmtTime(item.start_time)}{item.end_time ? ` – ${fmtTime(item.end_time)}` : ""}
                    </div>
                  </div>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{item.kind || "les"}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <Alert className="mb-4"><AlertDescription>Geen activiteiten gepland.</AlertDescription></Alert>
        )}

        {/* 3) Taken – subtiele lijst */}
        {tasksLoading ? (
          <div className="text-center py-3"><Loader2 className="w-5 h-5 animate-spin inline-block" /></div>
        ) : (
          <div className="rounded-lg border border-border/60 divide-y divide-border/60 overflow-hidden">
            {tasksToday.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Geen taken voor vandaag.</div>
            ) : (
              tasksToday.map((task) => {
                const isDone = task.status === "done";
                return (
                  <div key={task.id} className="px-3 py-2 flex items-center justify-between">
                    <div className={`text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </div>
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
              })
            )}
          </div>
        )}
      </section>

      {/* 4) Nieuwe taak */}
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
