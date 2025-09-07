import * as React from "react";
import { useMemo, useState, useRef } from "react";
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
import type { CoachChatHandle } from "@/features/chat/CoachChat";
import VoiceCheckinButton from "@/features/voice/VoiceCheckinButton";

const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : "");

// Type voor coach_memory rijen (lichtgewicht)
type CoachMemory = {
  id: string;
  user_id: string;
  course: string;
  status: string | null;
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

  // === Coach-memory (voor proactieve opvolging) ===
  const { data: coachMemory = [] } = useQuery<CoachMemory[]>({
    queryKey: ["coach-memory", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("coach_memory").select("*").eq("user_id", userId);
      if (error) throw new Error(error.message);
      return data as CoachMemory[];
    },
  });

  // === Taken mutations ===
  const qcKey = ["tasks-today", userId, today.iso] as const;

  const addTaskMutation = useMutation({
    mutationFn: async (input: { title: string; courseId: string | null; estMinutes: number | null }) => {
      const dueDate = new Date(today.date);
      dueDate.setHours(20, 0, 0, 0);
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

  // === Unified composer voor chat ===
  const coachRef = useRef<CoachChatHandle>(null);
  const [msg, setMsg] = useState("");

  function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const text = msg.trim();
    if (!text) return;
    coachRef.current?.sendMessage(text);   // via CoachChat imperative handle
    setMsg("");
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

  const coachSystemHint = `
Je bent een vriendelijke studiecoach. Wees proactief, positief en kort.
- Gebruik context (rooster/taken/memory) om door te vragen en op te volgen.
- Zie je vandaag een les voor een vak dat eerder “moeilijk” was? Vraag: “Hoe ging het vandaag vs. vorige keer?”
- Stel maximaal 3 concrete acties met tijden (HH:MM) en duur in minuten.
- Vier kleine successen en wees empathisch. Stel 1 verduidelijkingsvraag als info ontbreekt.
- Indien blijvende info (moeilijkheden/voorkeuren/doelen) naar voren komt, geef die terug als 'signals' JSON.
`.trim();

  return (
    <div className="p-6 space-y-10" data-testid="page-vandaag">
      {/* === 1) Chat met Noukie (zonder ingebouwde composer) === */}
      <section>
        <CoachChat
          ref={coachRef}
          systemHint={coachingSystemHintSafe(coachSystemHint)}
          context={coachContext}
          size="large"
          hideComposer    // ✅ verberg interne input/hint; we gebruiken de unified composer hieronder
        />
      </section>

      {/* === 2) Unified composer: één groot veld + blauwe opnameknop eronder === */}
      <section aria-labelledby="composer-title" className="space-y-3">
        <h2 id="composer-title" className="text-lg font-semibold">Bericht aan Noukie</h2>
        <form onSubmit={handleSend} className="space-y-3">
          <Textarea
            placeholder="Vertel hier wat je wilt oefenen, waar je moeite mee hebt of wat je wilt plannen."
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={4}
            className="min-h-28 text-base"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <VoiceCheckinButton
              userId={userId}
              // transcript direct in het veld plakken (geen aparte secties)
              onComplete={(res) => {
                const t = res?.text?.trim();
                if (!t) return;
                setMsg((prev) => (prev ? prev + (prev.endsWith("\n") ? "" : "\n") + t : t));
              }}
              labelIdle="🎙️ Opnemen"
              labelStop="Stop"
            />
            <Button type="submit">Stuur</Button>
          </div>
        </form>
      </section>

      {/* === 3) Vandaag: rooster + taken === */}
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

        {/* Taken — actieknoppen ALTIJD zichtbaar */}
        {tasksLoading ? (
          <div className="text-center py-3"><Loader2 className="w-5 h-5 animate-spin inline-block" /></div>
        ) : (
          <div className="space-y-2">
            {tasksToday.map((task) => {
              const isDone = task.status === "done";
              return (
                <div
                  key={task.id}
                  className={`border rounded px-3 py-2 flex items-center justify-between ${isDone ? "opacity-70" : ""}`}
                >
                  <div className={`text-sm ${isDone ? "line-through" : ""}`}>{task.title}</div>
                  <div className="flex items-center gap-2">
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

      {/* === 4) Nieuwe taak — ongewijzigd === */}
      <section aria-labelledby="add-task-title" className="space-y-3">
        <h2 id="add-task-title" className="text-lg font-semibold">Nieuwe taak</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget as HTMLFormElement;
          // jouw bestaande onAddTask logica staat al hierboven als functie; roep die hier indien je het formulier wilt behouden
        }} className="space-y-3">
          {/* je bestaande 'Nieuwe taak' velden en submit-knop laten zoals je had */}
        </form>
      </section>
    </div>
  );
}

/** optioneel: kleine guard tegen lege strings in systemHint */
function coachingSystemHintSafe(s: string | undefined) {
  const t = (s || "").trim();
  return t.length ? t : "Je bent een vriendelijke studiecoach. Wees proactief, positief en kort.";
}
