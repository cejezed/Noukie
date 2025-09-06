import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Task, Course } from "@shared/schema";

// ---------- Helpers ----------
async function authedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers || {});
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}

type ScheduleItem = {
  id: string;
  date: string | null;       // ISO voor incidentele items
  dayOfWeek: number | null;  // 1=ma..7=zo voor herhalend
  startTime: string | null;  // "HH:MM:SS"
  endTime: string | null;
  courseId: string | null;
  kind: string | null;       // "les" | "toets" | ...
  title: string | null;
};

const formatTime = (t?: string | null) => (t ? t.slice(0, 5) : "");
const sameYMD = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function Planning() {
  const { user } = useAuth();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Weekberekening (ma → zo)
  const getWeekDates = (offset: number) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const js = today.getDay(); // 0=zo..6=za
    const mondayShift = (js === 0 ? -6 : 1 - js) + offset * 7;
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(today.getDate() + mondayShift);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return { startOfWeek, endOfWeek };
  };

  const { startOfWeek, endOfWeek } = getWeekDates(currentWeekOffset);
  const weekKey = `${startOfWeek.toISOString().split("T")[0]}-${endOfWeek.toISOString().split("T")[0]}`;

  // TAKEN (server endpoint → Authorization header mee)
  const {
    data: tasks = [],
    isLoading: tasksLoading,
    error: tasksError,
  } = useQuery<Task[]>({
    queryKey: ["/api/tasks", user?.id, "week", weekKey],
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await authedFetch(
        `/api/tasks/${user?.id}/week/${startOfWeek.toISOString()}/${endOfWeek.toISOString()}`
      );
      if (!res.ok) throw new Error("Kon taken niet ophalen");
      return res.json();
    },
  });

  // VAKKEN (server endpoint → Authorization header mee)
  const {
    data: courses = [],
    isLoading: coursesLoading,
    error: coursesError,
  } = useQuery<Course[]>({
    queryKey: ["/api/courses", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await authedFetch(`/api/courses/${user?.id}`);
      if (!res.ok) throw new Error("Kon vakken niet ophalen");
      return res.json();
    },
  });

  // ROOSTER (server endpoint → Authorization header mee + normalisatie snake_case → camelCase)
  const {
    data: schedule = [],
    isLoading: scheduleLoading,
    error: scheduleError,
  } = useQuery<ScheduleItem[]>({
    queryKey: ["/api/schedule", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await authedFetch(`/api/schedule/${user?.id}`);
      if (!res.ok) throw new Error("Kon rooster niet ophalen");
      const raw = await res.json();
      const toCamel = (r: any): ScheduleItem => ({
        id: r.id,
        date: r.date ?? r.scheduled_date ?? null,
        dayOfWeek: r.dayOfWeek ?? r.day_of_week ?? null,
        startTime: r.startTime ?? r.start_time ?? null,
        endTime: r.endTime ?? r.end_time ?? null,
        courseId: r.courseId ?? r.course_id ?? null,
        kind: r.kind ?? r.type ?? "les",
        title: r.title ?? r.note ?? null,
      });
      return (Array.isArray(raw) ? raw : []).map(toCamel);
    },
  });

  const formatWeekRange = (start: Date, end: Date) => {
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
    return `${start.toLocaleDateString("nl-NL", opts)} - ${end.toLocaleDateString("nl-NL", opts)} ${end.getFullYear()}`;
  };

  const getDayName = (date: Date) => {
    const days = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
    return days[date.getDay()];
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);

      // Tasks op de dag
      const dayTasks = tasks.filter((task) => {
        if (!task.dueAt) return false;
        const taskDate = new Date(task.dueAt);
        return sameYMD(taskDate, date);
      });

      // Rooster op de dag (datum of weekdag)
      const daySchedule = (schedule as ScheduleItem[]).filter((item) => {
        if (item.date) {
          const d = new Date(item.date);
          return sameYMD(d, date);
        }
        const js = date.getDay(); // 0..6
        const dow = js === 0 ? 7 : js; // 1..7
        return item.dayOfWeek === dow;
      });

      days.push({
        date,
        name: getDayName(date),
        formattedDate: date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
        tasks: dayTasks,
        schedule: daySchedule,
      });
    }
    return days;
  };

  const getCourseById = (courseId: string | null | undefined) => {
    if (!courseId) return undefined;
    return courses.find((c) => c.id === courseId);
  };

  const getCompletionPercentage = () => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  const calcWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  };

  const weekDays = getWeekDays();
  const isLoading = tasksLoading || scheduleLoading || coursesLoading;
  const hasError = tasksError || scheduleError || coursesError;

  return (
    <div className="p-6" data-testid="page-planning">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Planning</h2>
        <div className="text-sm text-muted-foreground" data-testid="week-progress">
          Week {calcWeekNumber(startOfWeek)} • {getCompletionPercentage()}% voltooid
        </div>
      </div>

      {/* Weeknavigatie */}
      <div className="flex items-center justify-between mb-6" data-testid="week-navigation">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentWeekOffset((n) => n - 1)}
          data-testid="button-previous-week"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <h3 className="text-lg font-medium" data-testid="text-current-week">
          {formatWeekRange(startOfWeek, endOfWeek)}
        </h3>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentWeekOffset((n) => n + 1)}
          data-testid="button-next-week"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Status / fouten */}
      {hasError && (
        <div className="mb-4 text-sm text-red-600">
          Er ging iets mis bij het ophalen van data. Controleer je login en probeer te herladen.
        </div>
      )}

      {/* Weekoverzicht */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden animate-pulse" data-testid={`day-skeleton-${i}`}>
              <div className="bg-muted/50 h-12" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
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
                {/* Roosteritems */}
                {day.schedule.map((item: ScheduleItem, scheduleIndex: number) => {
                  const course = getCourseById(item.courseId ?? undefined);

                  const kindLabels: Record<string, string> = {
                    les: "Les",
                    toets: "TOETS",
                    sport: "Sport/Training",
                    werk: "Bijbaan/Werk",
                    afspraak: "Afspraak",
                    hobby: "Hobby/Activiteit",
                    anders: "Anders",
                  };
                  const kindColors: Record<string, string> = {
                    les: "bg-blue-500",
                    toets: "bg-red-500",
                    sport: "bg-green-500",
                    werk: "bg-purple-500",
                    afspraak: "bg-orange-500",
                    hobby: "bg-pink-500",
                    anders: "bg-gray-500",
                  };

                  const kind = (item.kind ?? "les").toLowerCase();
                  const kindLabel = kindLabels[kind] || item.kind || "Activiteit";
                  const dotColor = kindColors[kind] || "bg-muted-foreground";

                  return (
                    <div key={scheduleIndex} className="flex items-center space-x-3 text-sm" data-testid={`schedule-item-${index}-${scheduleIndex}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                      <span className="text-muted-foreground w-16">
                        {formatTime(item.startTime)}
                      </span>
                      <span>
                        {item.title || course?.name || "Activiteit"} - {kindLabel}
                      </span>
                      {course && item.title && (
                        <span className="text-xs text-muted-foreground">({course.name})</span>
                      )}
                    </div>
                  );
                })}

                {/* Taken */}
                {day.tasks.length > 0 && (
                  <div className="pt-2 border-t border-border space-y-2">
                    {day.tasks.map((task) => {
                      const course = getCourseById(task.courseId ?? undefined);
                      return (
                        <div key={task.id} className="flex items-center space-x-3" data-testid={`task-item-${task.id}`}>
                          <Checkbox
                            checked={task.status === "done"}
                            className="w-4 h-4"
                            data-testid={`checkbox-task-${task.id}`}
                            disabled
                          />
                          <span className={`flex-1 text-sm ${task.status === "done" ? "line-through opacity-60" : ""}`}>
                            {task.title}
                          </span>
                          {task.estMinutes && (
                            <span className="text-xs text-muted-foreground">{task.estMinutes}m</span>
                          )}
                          {course && <span className="text-xs text-muted-foreground">• {course.name}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Lege staat */}
                {day.schedule.length === 0 && day.tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground italic" data-testid={`empty-day-${index}`}>
                    Geen activiteiten gepland
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
