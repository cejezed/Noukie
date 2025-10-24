// client/src/pages/Vandaag.tsx
import * as React from "react";
import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Trash2, Info, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import SmartVoiceInput from "@/features/chat/SmartVoiceInput";

const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : "");

function getLocalDayBounds(dateLike: Date | string) {
  const d = typeof dateLike === "string" ? new Date(dateLike) : new Date(dateLike);
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

type CoachMemory = {
  id: string; user_id: string; course: string;
  status: string | null; note: string | null; last_update: string | null;
};

export default function Vandaag() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  const today = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    const js = d.getDay(); const dow = js === 0 ? 7 : js;
    return { date: d, iso, dow };
  }, []);

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

  const { data: coachMemory = [] } = useQuery<CoachMemory[]>({
    queryKey: ["coach-memory", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("coach_memory").select("*").eq("user_id", userId);
      if (error) throw new Error(error.message);
      return data as CoachMemory[];
    },
  });

  const qcKey = ["tasks-today", userId, today.iso] as const;

  const addTaskMutation = useMutation({
    mutationFn: async (input: { title: string; courseId: string | null; estMinutes: number | null }) => {
      const { startISO } = getLocalDayBounds(today.iso);
      const dueLocal = new Date(startISO); dueLocal.setHours(20, 0, 0, 0);
      const { error } = await supabase.from("tasks").insert({
        user_id: userId, title: input.title, status: "todo",
        due_at: dueLocal.toISOString(), course_id: input.courseId, est_minutes: input.estMinutes,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qcKey as any }); toast({ title: "Taak toegevoegd" }); },
    onError: (e: any) => { toast({ title: "Toevoegen mislukt", variant: "destructive", description: e?.message ?? "Onbekende fout" }); },
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

  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [estMinutes, setEstMinutes] = useState<string>("");

  const onAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast({ title: "Titel is verplicht", variant: "destructive" });
    addTaskMutation.mutate({ title: title.trim(), courseId, estMinutes: estMinutes ? Number(estMinutes) : null });
    setTitle(""); setCourseId(null); setEstMinutes("");
  };

  // --- Coach chat ---
  const coachRef = useRef<CoachChatHandle>(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const text = msg.trim();
    if (!text) return toast({ title: "Leeg bericht", description: "Typ eerst je bericht.", variant: "destructive" });
    if (!coachRef.current?.sendMessage) return toast({ title: "Chat niet klaar", description: "CoachChat is nog niet geladen.", variant: "destructive" });
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

  const coachContext = {
    todayDate: today.iso,
    todaySchedule: todayItems.map((i) => ({
      kind: i.kind,
      course: getCourseById(i.course_id)?.name ?? i.title ?? "Activiteit",
      start: i.start_time, end: i.end_time,
    })),
    openTasks: tasksToday.map((t) => ({ id: t.id, title: t.title, status: t.status, courseId: t.course_id })),
    difficulties: coachMemory.map((m) => ({ course: m.course, status: m.status, note: m.note, lastUpdate: m.last_update })),
  };

  const coachSystemHint = `
Je bent Noukie, een vriendelijke studiecoach. Reageer kort, natuurlijk en in het Nederlands.
- Gebruik context (rooster/taken/memory) alleen als het helpt; noem het niet expliciet tenzij relevant.
- Max 2-3 zinnen. Hoogstens 1 vraag terug als dat nodig is.
- Vier kleine successen. Als de gebruiker planning vraagt: doe 1-2 concrete vervolgstappen.
`.trim();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 👇 MAX 1600px, minimale zij-paddings voor maximale chatbreedte */}
      <div className="max-w-[1600px] mx-auto px-2 sm:px-3 md:px-4 py-3 md:py-4 space-y-4">
        {/* (Versienummer helemaal verwijderd) */}

        {/* CHAT — zo breed mogelijk, compact UI */}
        <section className="bg-white rounded-2xl border border-slate-200 p-3 md:p-4 space-y-3">
          <div className="flex items-center justify-between">
            {/* Titel verwijderd voor meer ruimte; alleen een subtiele label + info-knop */}
            <div className="text-sm text-slate-600">Praat met Noukie</div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
                  <Info className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader><DialogTitle>Tips</DialogTitle></DialogHeader>
                <div className="space-y-3 text-sm text-slate-600 pt-1">
                  <div>Vraag om 1–2 concrete vervolgstappen.</div>
                  <div>Houd berichten kort; dan blijft de chat overzichtelijk.</div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* CoachChat op volle breedte */}
          <div className="w-full">
            <CoachChat
              ref={coachRef}
              systemHint={coachSystemHint}
              context={coachContext}
              size="large"
              hideComposer
              threadKey={`today:${userId || "anon"}`}
            />
          </div>

          {/* Composer compact */}
          <form onSubmit={handleSend} className="space-y-2">
            <Textarea
              placeholder="Waarmee kan ik je helpen?"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={2}
              className="min-h-[44px] text-base border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <SmartVoiceInput
                onTranscript={(text) => { setMsg(text); handleSend(); }}
                lang="nl-NL"
              />
              <Button type="submit" disabled={sending} className="bg-slate-800 hover:bg-slate-700 rounded-xl">
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {sending ? "Versturen..." : "Stuur"}
              </Button>
            </div>
          </form>
        </section>

        {/* ROOSTER & TAKEN — behoud, maar compacter en naast elkaar, volle breedte */}
        <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
          {/* Rooster */}
          <section className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <h2 className="text-base font-medium text-slate-700">Je rooster</h2>
            </div>
            {scheduleLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin inline-block text-slate-400" />
              </div>
            ) : todayItems.length ? (
              <div className="space-y-2">
                {todayItems.map((item) => {
                  const course = getCourseById(item.course_id);
                  return (
                    <div key={item.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="font-medium text-slate-700">{item.title || course?.name || "Activiteit"}</div>
                      <div className="text-sm text-slate-500 mt-0.5">
                        {fmtTime(item.start_time)}{item.end_time ? ` - ${fmtTime(item.end_time)}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">Geen activiteiten gepland</div>
            )}
          </section>

          {/* Taken */}
          <TasksPanel
            courses={courses}
            tasksToday={tasksToday}
            tasksLoading={tasksLoading}
            addTaskMutation={addTaskMutation}
            toggleDone={toggleDone}
            delTask={delTask}
            title={title}
            setTitle={setTitle}
            courseId={courseId}
            setCourseId={setCourseId}
            estMinutes={estMinutes}
            setEstMinutes={setEstMinutes}
            onAddTask={onAddTask}
          />
        </div>
      </div>
    </div>
  );
}

/** Takenpaneel losgetrokken voor leesbaarheid */
function TasksPanel(props: {
  courses: Course[]; tasksToday: Task[]; tasksLoading: boolean;
  addTaskMutation: any; toggleDone: any; delTask: any;
  title: string; setTitle: (v: string) => void;
  courseId: string | null; setCourseId: (v: string | null) => void;
  estMinutes: string; setEstMinutes: (v: string) => void;
  onAddTask: (e: React.FormEvent) => void;
}) {
  const {
    courses, tasksToday, tasksLoading,
    addTaskMutation, toggleDone, delTask,
    title, setTitle, courseId, setCourseId, estMinutes, setEstMinutes, onAddTask
  } = props;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4">
      <h2 className="text-base font-medium text-slate-700 mb-3">Je taken</h2>
      {tasksLoading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin inline-block text-slate-400" /></div>
      ) : (
        <div className="space-y-2">
          {tasksToday.length === 0 ? (
            <div className="text-center py-8 text-slate-400">Geen taken voor vandaag</div>
          ) : (
            tasksToday.map((task) => {
              const isDone = task.status === "done";
              return (
                <div key={task.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between gap-3">
                  <div className={`flex-1 text-sm ${isDone ? "line-through text-slate-400" : "text-slate-700"}`}>{task.title}</div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-green-600 hover:bg-green-50"
                      onClick={() => toggleDone.mutate(task)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => delTask.mutate(task.id)}
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

      {/* Toevoegen */}
      <div className="mt-4">
        <h3 className="text-sm font-medium text-slate-700 mb-2">Nieuwe taak toevoegen</h3>
        <form onSubmit={onAddTask} className="space-y-3">
          <div>
            <Label htmlFor="t-title" className="text-slate-600">Wat moet je doen?</Label>
            <Textarea
              id="t-title" rows={2}
              placeholder="Bijv. Wiskunde §2.3 oefenen, Engelse woordjes H2"
              value={title} onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="t-course" className="text-slate-600">Vak (optioneel)</Label>
              <Select value={courseId ?? "none"} onValueChange={(v) => setCourseId(v === "none" ? null : v)}>
                <SelectTrigger id="t-course" className="mt-1.5 border-slate-200 rounded-xl">
                  <SelectValue placeholder="Kies vak" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen vak</SelectItem>
                  {courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="t-min" className="text-slate-600">Duur (min)</Label>
              <Input
                id="t-min" type="number" min={5} step={5} placeholder="30"
                value={estMinutes} onChange={(e) => setEstMinutes(e.target.value)}
                className="mt-1.5 border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                disabled={addTaskMutation.isPending}
                className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl"
              >
                {addTaskMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {addTaskMutation.isPending ? "Toevoegen..." : "Toevoegen"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
