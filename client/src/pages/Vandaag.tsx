import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import TextCheckin from "@/components/TextCheckin";
import TaskCard from "@/components/TaskCard";
import VoiceRecorder from "@/components/VoiceRecorder";
import AppIntroModal from "@/components/AppIntroModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Plus, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task, Course } from "@shared/schema";

export default function Vandaag() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Task form state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [hasSeenIntro, setHasSeenIntro] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    course_id: "",
    est_minutes: 30,
    priority: 1,
    // server normaliseert string → Date; dit is prima
    due_at: new Date().toISOString().split("T")[0], // YYYY-MM-DD
  });

  // Intro modal once per user
  React.useEffect(() => {
    const key = `hasSeenIntro_${user?.id}`;
    const seen = localStorage.getItem(key);
    if (!seen && user?.id) {
      setShowIntroModal(true);
      setHasSeenIntro(false);
    } else {
      setHasSeenIntro(true);
    }
  }, [user?.id]);

  // === Queries ===
  const userId = user?.id ?? "";

  // Tasks for today (server heeft /api/tasks/:userId/today)
  const {
    data: todayTasks = [],
    isLoading: tasksLoading,
    isError: tasksError,
  } = useQuery({
    enabled: !!userId,
    queryKey: ["tasks", "today", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tasks/${userId}/today`);
      if (!res.ok) throw new Error("Failed to fetch today's tasks");
      return res.json() as Promise<Task[]>;
    },
    // je haalt al per dag op, dus snelle refresh is ok
    staleTime: 0,
  });

  // Courses for select (server heeft /api/courses/:userId)
  const { data: courses = [] } = useQuery({
    enabled: !!userId,
    queryKey: ["courses", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/courses/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch courses");
      return res.json() as Promise<Course[]>;
    },
  });

  // === Mutations ===
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: typeof taskForm & { user_id: string }) => {
      const res = await apiRequest("POST", "/api/tasks", taskData);
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      // Invalideer zowel 'today' als een eventuele all-tasks lijst
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Taak aangemaakt!",
        description: "Je nieuwe taak is toegevoegd aan je lijst.",
      });
      setShowTaskForm(false);
      setTaskForm({
        title: "",
        course_id: "",
        est_minutes: 30,
        priority: 1,
        due_at: new Date().toISOString().split("T")[0],
      });
    },
    onError: () => {
      toast({
        title: "Fout bij aanmaken taak",
        description: "Probeer het opnieuw.",
        variant: "destructive",
      });
    },
  });

  // NB: jouw server heeft (nog) geen sessions endpoints; UI uitgezet
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim() || !userId) return;

    const payload = {
      ...taskForm,
      course_id: taskForm.course_id || null,
      user_id: userId,
    };
    createTaskMutation.mutate(payload);
  };

  // Server gebruikt status: 'todo' | 'doing' | 'done'
  const completedTasks = todayTasks.filter((t) => t.status === "done");
  const pendingTasks = todayTasks.filter((t) => t.status !== "done");

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {showIntroModal && (
        <AppIntroModal isOpen={showIntroModal} onClose={() => setShowIntroModal(false)} />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Vandaag</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString("nl-NL", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Voice Recorder */}
        <VoiceRecorder />

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{completedTasks.length}</div>
              <div className="text-sm text-muted-foreground">Voltooid</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{pendingTasks.length}</div>
              <div className="text-sm text-muted-foreground">Te doen</div>
            </CardContent>
          </Card>
        </div>

        {/* Today's Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Taken voor Vandaag</CardTitle>
              <Button onClick={() => setShowTaskForm(true)} size="sm" className="flex items-center gap-1">
                <Plus className="w-4 h-4" />
                Taak Toevoegen
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasksLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : tasksError ? (
              <div className="text-center py-8 text-red-500">Kon taken niet laden.</div>
            ) : todayTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="w-8 h-8 mx-auto mb-2" />
                <p>Geen taken voor vandaag</p>
                <p className="text-sm">Voeg een nieuwe taak toe om te beginnen!</p>
              </div>
            ) : (
              todayTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  // Sessions ontbreken nog → knop kan disabled of later koppelen
                  onStart={() => {}}
                  isStarting={false}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Add Task Form */}
        {showTaskForm && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Nieuwe Taak</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowTaskForm(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <Label htmlFor="title">Titel</Label>
                  <Input
                    id="title"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="Bijv. Wiskunde hoofdstuk 5 lezen"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="course">Vak</Label>
                  <Select
                    value={taskForm.course_id}
                    onValueChange={(value) => setTaskForm({ ...taskForm, course_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer een vak" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="minutes">Geschatte tijd (minuten)</Label>
                  <Input
                    id="minutes"
                    type="number"
                    value={taskForm.est_minutes}
                    onChange={(e) => setTaskForm({ ...taskForm, est_minutes: parseInt(e.target.value) || 0 })}
                    min="1"
                  />
                </div>

                <div>
                  <Label htmlFor="dueAt">Deadline</Label>
                  <Input
                    id="dueAt"
                    type="date"
                    value={taskForm.due_at}
                    onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={createTaskMutation.isPending}>
                    {createTaskMutation.isPending ? "Bezig..." : "Taak Aanmaken"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowTaskForm(false)}>
                    Annuleren
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Text Check-in */}
        <TextCheckin />
      </div>
    </div>
  );
}
