// client/src/pages/Vandaag.tsx
import * as React from "react";
import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Trash2, Info, Clock, Calendar } from "lucide-react";
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

  const today = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    const js = d.getDay();
    const dow = js === 0 ? 7 : js;
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
- Vier kleine successen. Als de gebruiker planning vraagt: doe 1-2 concrete vervolgstappen (geen sjablonen).
`.trim();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Chat sectie - rustig en luchtig */}
        <section className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-slate-200/50 p-6 space-y-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="text-lg font-medium text-slate-700">Praat met Noukie</h2>
              <p className="text-sm text-slate-500 mt-1">
                Je studiecoach helpt je graag met planning en motivatie
              </p>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
                  <Info className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Tips voor Vandaag</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2 text-sm text-slate-600">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 font-semibold">1</div>
                    <div>
                      <div className="font-medium text-slate-700">Start klein</div>
                      <div>Kies één ding om nu te doen</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600 font-semibold">2</div>
                    <div>
                      <div className="font-medium text-slate-700">Chat voor planning</div>
                      <div>Vraag om 1-2 concrete vervolgstappen</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-purple-600 font-semibold">3</div>
                    <div>
                      <div className="font-medium text-slate-700">Leren of uitleg?</div>
                      <div>Ga naar de Uitleg-tab voor stap-voor-stap begeleiding</div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <CoachChat
            ref={coachRef}
            systemHint={coachSystemHint}
            context={coachContext}
            size="large"
            hideComposer
            threadKey={`today:${userId || "anon"}`}
          />

          <form onSubmit={handleSend} className="space-y-3">
            <Textarea
              placeholder="Hoe ging het op school? Waar kan ik je mee helpen?"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={3}
              className="min-h-24 text-base border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl"
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
                labelIdle="Opnemen"
                labelStop="Stop"
              />
              <Button type="submit" disabled={sending} className="bg-slate-800 hover:bg-slate-700 rounded-xl">
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {sending ? "Versturen..." : "Stuur"}
              </Button>
            </div>
            <div className="text-sm text-slate-500">
              Zoek je hulp bij leren of studeren?
              <a href="/LeerChat" className="text-blue-600 hover:underline ml-1">
                Ga naar Uitleg
              </a>
            </div>
          </form>
        </section>

        {/* Rooster en taken - side by side op desktop */}
        <div className="grid lg:grid-cols-2 gap-6">
          
          {/* Rooster */}
          <section className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-slate-200/50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-medium text-slate-700">Je rooster</h2>
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
                    <div key={item.id} className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                      <div className="font-medium text-slate-700">{item.title || course?.name || "Activiteit"}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-slate-500">
                          {fmtTime(item.start_time)}{item.end_time ? ` - ${fmtTime(item.end_time)}` : ""}
                        </span>
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                          {item.kind || "les"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                Geen activiteiten gepland
              </div>
            )}
          </section>

          {/* Taken */}
          <section className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-slate-200/50 p-6">
            <h2 className="text-lg font-medium text-slate-700 mb-4">Je taken</h2>
            
            {tasksLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin inline-block text-slate-400" />
              </div>
            ) : (
              <div className="space-y-2">
                {tasksToday.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    Geen taken voor vandaag
                  </div>
                ) : (
                  tasksToday.map((task) => {
                    const isDone = task.status === "done";
                    return (
                      <div key={task.id} className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 flex items-center justify-between gap-3">
                        <div className={`flex-1 text-sm ${isDone ? "line-through text-slate-400" : "text-slate-700"}`}>
                          {task.title}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-green-600 hover:bg-green-50"
                            onClick={() => toggleDone.mutate(task)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
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
          </section>
        </div>

        {/* Nieuwe taak toevoegen */}
        <section className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-slate-200/50 p-6">
          <h2 className="text-lg font-medium text-slate-700 mb-4">Nieuwe taak toevoegen</h2>
          <form onSubmit={onAddTask} className="space-y-4">
            <div>
              <Label htmlFor="t-title" className="text-slate-600">Wat moet je doen?</Label>
              <Textarea
                id="t-title"
                placeholder="Bijv. Wiskunde §2.3 oefenen, Engelse woordjes H2, samenvatting H4"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                rows={2}
                className="mt-1.5 border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="t-course" className="text-slate-600">Vak (optioneel)</Label>
                <Select value={courseId ?? "none"} onValueChange={(v) => setCourseId(v === "none" ? null : v)}>
                  <SelectTrigger id="t-course" className="mt-1.5 border-slate-200 rounded-xl">
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
                <Label htmlFor="t-min" className="text-slate-600">Duur (min)</Label>
                <Input
                  id="t-min"
                  type="number"
                  min={5}
                  step={5}
                  placeholder="30"
                  value={estMinutes}
                  onChange={(e) => setEstMinutes(e.target.value)}
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
        </section>
      </div>
    </div>
  );
}