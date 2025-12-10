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

const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : "");

function getLocalDayBounds(dateLike: Date | string) {
  const d = typeof dateLike === "string" ? new Date(dateLike) : new Date(dateLike);
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

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
  type ChatMessage = { id: number; sender: "user" | "ai"; text: string };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const chatViewportRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat to bottom
  React.useEffect(() => {
    if (chatViewportRef.current) {
      chatViewportRef.current.scrollTop = chatViewportRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const text = msg.trim();
    if (!text) return toast({ title: "Leeg bericht", description: "Typ eerst je bericht.", variant: "destructive" });

    const userMessage: ChatMessage = { id: Date.now(), sender: "user", text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setMsg("");
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const history = newMessages.map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      }));

      const context = {
        todayDate: today.iso,
        todaySchedule: todayItems.map((i) => ({
          kind: i.kind,
          course: getCourseById(i.course_id)?.name ?? i.title ?? "Activiteit",
          start: i.start_time, end: i.end_time,
        })),
        openTasks: tasksToday.map((t) => ({ id: t.id, title: t.title, status: t.status })),
      };

      const systemHint = `Je bent Noukie, een vriendelijke studiecoach. Reageer kort, natuurlijk en in het Nederlands.
- Gebruik context (rooster/taken) alleen als het helpt; noem het niet expliciet tenzij relevant.
- Max 2-3 zinnen. Hoogstens 1 vraag terug als dat nodig is.
- Vier kleine successen. Als de gebruiker planning vraagt: doe 1-2 concrete vervolgstappen.`;

      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mode: "chat", message: text, history, context, systemHint }),
      });

      const rawText = await resp.text();
      if (!resp.ok) throw new Error(rawText || `HTTP ${resp.status}`);
      const data = rawText ? JSON.parse(rawText) : {};
      const reply: string = data?.reply ?? "Oké, vertel me meer.";

      const aiMessage: ChatMessage = { id: Date.now() + 1, sender: "ai", text: reply };
      setMessages([...newMessages, aiMessage]);
    } catch (err: any) {
      toast({ title: "Versturen mislukt", description: err?.message ?? "Onbekende fout", variant: "destructive" });
      setMessages(messages);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* 👇 MAX 1600px, minimale zij-paddings voor maximale chatbreedte */}
      <div className="max-w-[1600px] mx-auto px-2 sm:px-3 md:px-4 py-3 md:py-4 space-y-4">

        {/* CHAT — zo breed mogelijk, compact UI */}
        <section className="bg-white rounded-2xl shadow border border-border p-3 md:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">Praat met Noukie</div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white">
                <DialogHeader><DialogTitle>Tips</DialogTitle></DialogHeader>
                <div className="space-y-3 text-sm text-muted-foreground pt-1">
                  <div>Vraag om 1–2 concrete vervolgstappen.</div>
                  <div>Houd berichten kort; dan blijft de chat overzichtelijk.</div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Chat messages */}
          <div
            ref={chatViewportRef}
            className="h-64 overflow-y-auto space-y-2 rounded-xl bg-slate-50 border border-border p-3"
          >
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                <p className="text-sm">Nog geen gesprek. Zeg hallo! 👋</p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl p-3 text-sm ${
                      m.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-white border border-border text-foreground"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white border border-border rounded-xl p-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce delay-150" />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce delay-300" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Composer compact */}
          <form onSubmit={handleSend} className="space-y-2">
            <Textarea
              placeholder="Waarmee kan ik je helpen?"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={2}
              className="min-h-[44px] text-base"
            />
            <Button type="submit" disabled={sending} className="voice-button rounded-xl w-full">
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {sending ? "Versturen..." : "Stuur"}
            </Button>
          </form>
        </section>

        {/* ROOSTER & TAKEN — behoud, maar compacter en naast elkaar, volle breedte */}
        <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
          {/* Rooster */}
          <section className="bg-white rounded-2xl shadow border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-base font-medium text-foreground">Je rooster</h2>
            </div>
            {scheduleLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin inline-block text-muted-foreground" />
              </div>
            ) : todayItems.length ? (
              <div className="space-y-2">
                {todayItems.map((item) => {
                  const course = getCourseById(item.course_id);
                  return (
                    <div key={item.id} className="bg-slate-50 rounded-xl p-3 border border-border hover:bg-slate-100 transition-colors">
                      <div className="font-medium text-foreground">{item.title || course?.name || "Activiteit"}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {fmtTime(item.start_time)}{item.end_time ? ` - ${fmtTime(item.end_time)}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Geen activiteiten gepland</div>
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
    <section className="bg-white rounded-2xl shadow border border-border p-4">
      <h2 className="text-base font-medium text-foreground mb-3">Je taken</h2>
      {tasksLoading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin inline-block text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {tasksToday.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Geen taken voor vandaag</div>
          ) : (
            tasksToday.map((task) => {
              const isDone = task.status === "done";
              return (
                <div key={task.id} className="bg-slate-50 rounded-xl p-3 border border-border flex items-center justify-between gap-3 hover:bg-slate-100 transition-colors">
                  <div className={`flex-1 text-sm ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-green-600 hover:bg-green-50"
                      onClick={() => toggleDone.mutate(task)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
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
        <h3 className="text-sm font-medium text-foreground mb-2">Nieuwe taak toevoegen</h3>
        <form onSubmit={onAddTask} className="space-y-3">
          <div>
            <Label htmlFor="t-title">Wat moet je doen?</Label>
            <Textarea
              id="t-title" rows={2}
              placeholder="Bijv. Wiskunde §2.3 oefenen, Engelse woordjes H2"
              value={title} onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="t-course">Vak (optioneel)</Label>
              <Select value={courseId ?? "none"} onValueChange={(v) => setCourseId(v === "none" ? null : v)}>
                <SelectTrigger id="t-course" className="mt-1.5">
                  <SelectValue placeholder="Kies vak" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen vak</SelectItem>
                  {courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="t-min">Duur (min)</Label>
              <Input
                id="t-min" type="number" min={5} step={5} placeholder="30"
                value={estMinutes} onChange={(e) => setEstMinutes(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                disabled={addTaskMutation.isPending}
                className="w-full voice-button rounded-xl"
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
