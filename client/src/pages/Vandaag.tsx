import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import TextCheckin from "@/components/TextCheckin";
import TaskCard from "@/components/TaskCard";
import VoiceRecorder from "@/components/VoiceRecorder";
import AppIntroModal from "@/components/AppIntroModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Plus, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { Task, Course } from "@shared/schema";

export default function Vandaag() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    course_id: "",
    est_minutes: 30,
    priority: 1,
    due_at: new Date().toISOString().split("T")[0],
  });

  React.useEffect(() => {
    const key = `hasSeenIntro_${userId}`;
    if (userId && !localStorage.getItem(key)) {
      setShowIntroModal(true);
      localStorage.setItem(key, 'true');
    }
  }, [userId]);

  // === QUERIES (direct naar Supabase) ===
  const { data: todayTasks = [], isLoading: tasksLoading, isError: tasksError } = useQuery<Task[]>({
    enabled: !!userId,
    queryKey: ["tasks", "today", userId],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .gte('due_at', start.toISOString())
        .lt('due_at', end.toISOString());
      if (error) throw new Error(error.message);
      return data || [];
    },
    staleTime: 0,
  });

  const { data: courses = [] } = useQuery<Course[]>({
    enabled: !!userId,
    queryKey: ["courses", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select('*').eq('user_id', userId);
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  // === MUTATION (direct naar Supabase) ===
  const createTaskMutation = useMutation({
    mutationFn: async (newTask: Omit<Task, 'id' | 'created_at' | 'status'>) => {
      const { error } = await supabase.from('tasks').insert(newTask);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Taak aangemaakt!", description: "Je nieuwe taak is toegevoegd." });
      setShowTaskForm(false);
      setTaskForm({ title: "", course_id: "", est_minutes: 30, priority: 1, due_at: new Date().toISOString().split("T")[0] });
    },
    onError: (error) => {
      toast({ title: "Fout bij aanmaken taak", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim() || !userId) return;
    createTaskMutation.mutate({
      ...taskForm,
      course_id: taskForm.course_id || null,
      user_id: userId,
    });
  };

  const completedTasks = todayTasks.filter((t) => t.status === "done");
  const pendingTasks = todayTasks.filter((t) => t.status !== "done");

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {showIntroModal && <AppIntroModal isOpen={showIntroModal} onClose={() => setShowIntroModal(false)} />}
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Vandaag</h1>
          <p className="text-muted-foreground">{new Date().toLocaleDateString("nl-NL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <VoiceRecorder />
        <div className="grid grid-cols-2 gap-4">
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{completedTasks.length}</div><div className="text-sm text-muted-foreground">Voltooid</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{pendingTasks.length}</div><div className="text-sm text-muted-foreground">Te doen</div></CardContent></Card>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Taken voor Vandaag</CardTitle>
              <Button onClick={() => setShowTaskForm(true)} size="sm" className="flex items-center gap-1"><Plus className="w-4 h-4" />Taak Toevoegen</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasksLoading ? (
              <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
            ) : tasksError ? (
              <div className="text-center py-8 text-red-500">Kon taken niet laden.</div>
            ) : todayTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="w-8 h-8 mx-auto mb-2" /><p>Geen taken voor vandaag</p>
              </div>
            ) : (
              todayTasks.map((task) => <TaskCard key={task.id} task={task} course={courses.find(c => c.id === task.course_id)} />)
            )}
          </CardContent>
        </Card>
        {showTaskForm && (
          <Card>
            <CardHeader><div className="flex items-center justify-between"><CardTitle>Nieuwe Taak</CardTitle><Button variant="ghost" size="sm" onClick={() => setShowTaskForm(false)}><X className="w-4 h-4" /></Button></div></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div><Label htmlFor="title">Titel</Label><Input id="title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required /></div>
                <div>
                  <Label htmlFor="course">Vak</Label>
                  <Select value={taskForm.course_id} onValueChange={(value) => setTaskForm({ ...taskForm, course_id: value })}>
                    <SelectTrigger><SelectValue placeholder="Selecteer een vak" /></SelectTrigger>
                    <SelectContent>{courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="minutes">Geschatte tijd (minuten)</Label><Input id="minutes" type="number" value={taskForm.est_minutes} onChange={(e) => setTaskForm({ ...taskForm, est_minutes: parseInt(e.target.value) || 0 })} min="1" /></div>
                <div><Label htmlFor="dueAt">Deadline</Label><Input id="dueAt" type="date" value={taskForm.due_at} onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })} /></div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createTaskMutation.isPending}>{createTaskMutation.isPending ? "Bezig..." : "Taak Aanmaken"}</Button>
                  <Button type="button" variant="outline" onClick={() => setShowTaskForm(false)}>Annuleren</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        <TextCheckin />
      </div>
    </div>
  );
}

