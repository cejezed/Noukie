import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Trash2 } from "lucide-react";
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
import CoachChat from "@/features/chat/CoachChat";

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

  // === Taken mutations ===
  const qcKey = ["tasks-today", userId, today.iso] as const;

  const addTaskMutation = useMutation({
    mutationFn: async (input: { title: string; courseId: string | null; estMinutes: number | null }) => {
      const dueDate = new Date(today.date);
      dueDate.setHours(20, 0, 0, 0); // neutraal tijdstip voor dagfilter
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

  // === Context voor Noukie (optioneel, kan je in CoachChat gebruiken) ===
  const coachContext = {
    todayDate: today.iso,
    todaySchedule: todayItems.map((i) => ({
      kind: i.kind,
      course: getCourseById(i.course_id)?.name ?? i.title ?? "Activiteit",
      start: i.start_time,
      end: i.end_time,
    })),
    openTasks: tasksToday.map((t) => ({ id: t.id, title: t.title, status: t.status, courseId: t.course_id })),
  };

  const coachSystemHint = `
Je bent Noukie, een vriendelijke studiecoach. Wees proactief, positief en kort.
- Gebruik context (rooster/taken/memory) om door te vragen en op te volgen.
- Zie je vandaag een les voor een vak dat eerder “moeilijk” was? Vraag: “Hoe ging het vandaag vs. vorige keer?”
- Stel maximaal 3 concrete acties met tijden (HH:MM) en duur in minuten.
- Vier kleine successen en wees empathisch. Stel 1 verduidelijkingsvraag als info ontbreekt.
`.trim();

  return (
    <div className="p-6 space-y-10" data-testid="page-vandaag">
      {/* === 1) ÉÉN blok: Chat met Noukie === */}
      <section>
        <CoachChat
          // Je kunt transcript hier als prefill meegeven als je spraak in CoachChat hebt ingebouwd
          systemHint={coachSystemHint}
          context={coachContext}
          size="large"
        />
      </section>

      {/* === 2) Vandaag: rooster + taken === */}
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

      {/* === 3) Nieuwe taak (rustig, breed titelveld; daaronder vak & duur) === */}
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
