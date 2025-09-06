import * as React from "react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Task, Course, Schedule } from "@shared/schema";


// 👉 In de VOLGENDE stap leveren we dit bestand:
import CoachChat from "@/features/chat/CoachChat";

export default function Vandaag() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  // Na aanmaken taak via modaal → refresh tasks
  function onTasksCreated(n: number) {
    if (n > 0) {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    }
  }

  return (
    <div className="p-6 space-y-8" data-testid="page-vandaag">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vandaag</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Taak toevoegen
        </Button>
      </div>

      {/* Planning-overzicht (read-only + toggles) */}
      <section aria-label="Planning">
        <PlanningOverview />
      </section>

      {/* Coach chat (volgende stap leveren we het component) */}
      <section aria-label="Coach" className="pt-2 border-t">
        <h3 className="text-lg font-medium mb-2">Coach</h3>
        <div className="text-sm text-muted-foreground mb-3">
          Vertel elke dag hoe het ging, wat lastig was en wat gedaan moet worden. De coach helpt met uitleg en kan taken voor je inplannen.
        </div>
   <CoachChat onTasksCreated={onTasksCreated} />


      </section>

      {/* Eenvoudige modaal voor + Taak toevoegen (zodat de knop werkt) */}
      {createOpen && (
        <CreateTaskModal
          onClose={() => setCreateOpen(false)}
          onCreated={(n) => {
            setCreateOpen(false);
            onTasksCreated(n);
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------
   PlanningOverview (read-only + toggles)
   - Geen invulvelden hier, alleen weekweergave, vinken en navigatie
-------------------------------------------- */

function startOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function getISOWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

function PlanningOverview() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  const today = startOfDayLocal(new Date());
  const monday = (() => {
    const d = new Date(today);
    const dow = d.getDay() === 0 ? 7 : d.getDay(); // 1..7
    d.setDate(d.getDate() - (dow - 1) + currentWeekOffset * 7);
    return startOfDayLocal(d);
  })();
  const sunday = startOfDayLocal(addDays(monday, 6));
  const endExclusive = startOfDayLocal(addDays(sunday, 1));

  const weekKey = `${ymd(monday)}-${ymd(sunday)}`;

  // Tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["tasks", user?.id, "week", weekKey],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .gte("due_at", monday.toISOString())
        .lt("due_at", endExclusive.toISOString())
        .order("due_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Courses
  const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["courses", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  // Schedule
  const { data: schedule = [], isLoading: scheduleLoading } = useQuery<Schedule[]>({
    queryKey: ["schedule", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("schedule")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const formatWeekRange = (start: Date, end: Date) => {
    const opt: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
    return `${start.toLocaleDateString("nl-NL", opt)} - ${end.toLocaleDateString("nl-NL", opt)} ${end.getFullYear()}`;
  };

  const daysNL = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = startOfDayLocal(addDays(monday, i));

      const dayTasks = tasks.filter((t) => {
        if (!t.due_at) return false;
        return ymd(new Date(t.due_at)) === ymd(date);
      });

      const daySchedule = schedule.filter((item) => {
        if (item.date) {
          return ymd(new Date(item.date)) === ymd(date);
        }
        const dow = date.getDay() === 0 ? 7 : date.getDay();
        return item.day_of_week === dow;
      });

      days.push({
        date,
        name: daysNL[date.getDay()],
        formattedDate: date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
        tasks: dayTasks,
        schedule: daySchedule,
      });
    }
    return days;
  };

  const getCourseById = (courseId: string | null) => (courseId ? courses.find((c) => c.id === courseId) : undefined);
  const formatTime = (timeString: string) => timeString?.slice(0, 5) ?? "";
  const getCompletionPercentage = () => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    return total ? Math.round((done / total) * 100) : 0;
  };

  const weekDays = getWeekDays();

  const handleTaskToggle = async (taskId: string, currentStatus: string) => {
    if (!user?.id) return;
    const newStatus = currentStatus === "done" ? "todo" : "done";

    // Optimistic update
    queryClient.setQueryData<Task[]>(["tasks", user.id, "week", weekKey], (prev) =>
      (prev ?? []).map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId)
      .eq("user_id", user.id);

    if (error) {
      // rollback
      queryClient.setQueryData<Task[]>(["tasks", user.id, "week", weekKey], (prev) =>
        (prev ?? []).map((t) => (t.id === taskId ? { ...t, status: currentStatus } : t))
      );
      console.error("Supabase error updating task:", error);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["tasks", user.id, "week", weekKey] });
  };

  // Loading
  if (isLoading || tasksLoading || coursesLoading || scheduleLoading) {
    return (
      <div className="flex justify-center items-center h-full p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p>Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="planning-overview">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Planning</h2>
        <div className="text-sm text-muted-foreground" data-testid="week-progress">
          Week {getISOWeekNumber(monday)} • {getCompletionPercentage()}% voltooid
        </div>
      </div>

      {/* Week navigatie */}
      <div className="flex items-center justify-between mb-6" data-testid="week-navigation">
        <Button variant="ghost" size="icon" onClick={() => setCurrentWeekOffset((v) => v - 1)} data-testid="button-previous-week">
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <h3 className="text-lg font-medium" data-testid="text-current-week">
          {formatWeekRange(monday, sunday)}
        </h3>

        <Button variant="ghost" size="icon" onClick={() => setCurrentWeekOffset((v) => v + 1)} data-testid="button-next-week">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Weekoverzicht */}
      <div className="space-y-4">
        {weekDays.map((day, index) => (
          <div key={index} className="border border-border rounded-lg overflow-hidden" data-testid={`day-card-${index}`}>
            <div className="bg-muted/50 px-4 py-2 border-b border-border">
              <div className="flex items-center justify-between">
                <h4 className="font-medium capitalize" data-testid={`day-name-${index}`}>
                  {day.name} {day.formattedDate}
                </h4>
                <span className="text-sm text-muted-foreground" data-testid={`task-count-${index}`}>
                  {day.tasks.length} taken
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Rooster items */}
              {day.schedule.map((item: any, scheduleIndex: number) => {
                const course = getCourseById(item.course_id);

                const getKindLabel = (kind: string) => {
                  switch (kind) {
                    case "les":
                      return "Les";
                    case "toets":
                      return "TOETS";
                    case "sport":
                      return "Sport/Training";
                    case "werk":
                      return "Bijbaan/Werk";
                    case "afspraak":
                      return "Afspraak";
                    case "hobby":
                      return "Hobby/Activiteit";
                    case "anders":
                      return "Anders";
                    default:
                      return kind || "Les";
                  }
                };

                const getKindColor = (kind: string) => {
                  switch (kind) {
                    case "les":
                      return "bg-blue-500";
                    case "toets":
                      return "bg-red-500";
                    case "sport":
                      return "bg-green-500";
                    case "werk":
                      return "bg-purple-500";
                    case "afspraak":
                      return "bg-orange-500";
                    case "hobby":
                      return "bg-pink-500";
                    case "anders":
                      return "bg-gray-500";
                    default:
                      return "bg-muted-foreground";
                  }
                };

                return (
                  <div key={scheduleIndex} className="flex items-center space-x-3 text-sm" data-testid={`schedule-item-${index}-${scheduleIndex}`}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getKindColor(item.kind || "les")}`} />
                    <span className="text-muted-foreground w-16">
                      {item.start_time && formatTime(item.start_time)}
                    </span>
                    <span>
                      {item.title || course?.name || "Activiteit"} - {getKindLabel(item.kind || "les")}
                    </span>
                    {course && item.title && <span className="text-xs text-muted-foreground">({course.name})</span>}
                  </div>
                );
              })}

              {/* Taken */}
              {day.tasks.length > 0 && (
                <div className="pt-2 border-t border-border space-y-2">
                  {day.tasks.map((task: Task) => {
                    const course = getCourseById(task.course_id);
                    return (
                      <div key={task.id} className="flex items-center space-x-3" data-testid={`task-item-${task.id}`}>
                        <Checkbox
                          checked={task.status === "done"}
                          onCheckedChange={() => handleTaskToggle(task.id, task.status)}
                          className="w-4 h-4"
                          data-testid={`checkbox-task-${task.id}`}
                        />
                        <span className={`flex-1 text-sm ${task.status === "done" ? "line-through opacity-60" : ""}`}>
                          {task.title}
                        </span>
                        {course && <span className="text-xs text-muted-foreground">{course.name}</span>}
                        {task.est_minutes && <span className="text-xs text-muted-foreground">{task.est_minutes}m</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty */}
              {day.schedule.length === 0 && day.tasks.length === 0 && (
                <p className="text-sm text-muted-foreground italic" data-testid={`empty-day-${index}`}>
                  Geen activiteiten gepland
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------
   Eenvoudige modaal voor + Taak toevoegen
   (compact; geen luxe validatie — werkt stabiel)
-------------------------------------------- */

function CreateTaskModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (count: number) => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState<string>("16:00");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const due = new Date(`${date}T${time}:00`);
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title: title.trim(),
        status: "todo",
        due_at: due.toISOString(),
      });
      if (error) throw error;
      onCreated(1);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-background border rounded-lg w-full max-w-md p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Nieuwe taak</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Sluiten
          </Button>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1">
            <Label htmlFor="title">Titel</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Wiskunde par. 3.2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="date">Datum</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="time">Tijd</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuleren
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy ? "Opslaan…" : "Opslaan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
