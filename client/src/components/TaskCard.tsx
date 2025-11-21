import * as React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { HelpCircle, Check, Trash2 } from "lucide-react";
import HelpModal from "@/components/HelpModal";
import type { Task, Course } from "@shared/schema";

interface TaskCardProps {
  task: Task;
  course?: Course;
  onStart: () => void;
  isStarting: boolean;
}

export default function TaskCard({ task, course, onStart, isStarting }: TaskCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showHelpModal, setShowHelpModal] = useState(false);
  const isCompleted = task.status === "done";

  // CORRECTIE: Mutation praat nu direct met Supabase
  const toggleStatusMutation = useMutation({
    mutationFn: async (newStatus: 'done' | 'todo') => {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id)
        .eq('user_id', user!.id);
      if (error) throw new Error(error.message);
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: newStatus === 'done' ? "Taak voltooid!" : "Taak heropend",
        description: newStatus === 'done' ? "Goed gedaan!" : "Je kunt weer aan deze taak werken.",
      });
    },
    onError: (error) => {
      toast({ title: "Fout", description: `Kon taakstatus niet bijwerken: ${error.message}`, variant: "destructive" });
    }
  });

  // CORRECTIE: Mutation praat nu direct met Supabase
  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id)
        .eq('user_id', user!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: "Taak verwijderd", description: "De voltooide taak is verwijderd." });
    },
    onError: (error) => {
      toast({ title: "Fout bij verwijderen", description: `Kon taak niet verwijderen: ${error.message}`, variant: "destructive" });
    }
  });

  const getPriorityLabel = (priority: number) => {
    if (priority >= 2) return "Hoge prioriteit";
    if (priority >= 1) return "Normale prioriteit";
    return "";
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 2) return "text-destructive";
    if (priority >= 1) return "text-accent";
    return "text-muted-foreground";
  };

  return (
    <>
      <>
        <div className={`glass-card p-4 ${isCompleted ? 'opacity-60' : ''}`} data-testid={`task-card-${task.id}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-xs font-medium text-white bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm">
                  {course?.name || "Algemeen"}
                </span>
                {task.priority > 0 && (
                  <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                    {getPriorityLabel(task.priority)}
                  </span>
                )}
              </div>
              <h4 className={`font-medium mb-1 text-white ${isCompleted ? 'line-through text-white/50' : ''}`}>{task.title}</h4>
              {task.est_minutes && (
                <p className="text-sm text-white/60">± {task.est_minutes} minuten</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="text-white/60 hover:text-accent hover:bg-white/10 p-1" onClick={() => setShowHelpModal(true)} title="Ik snap dit niet">
                <HelpCircle className="w-5 h-5" />
              </Button>
              {isCompleted && (
                <Button variant="ghost" size="icon" className="text-white/60 hover:text-destructive hover:bg-white/10 p-1" onClick={() => deleteTaskMutation.mutate()} disabled={deleteTaskMutation.isPending} title="Verwijder voltooide taak">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                className={`w-6 h-6 border-2 rounded transition-colors ${isCompleted ? 'border-accent bg-accent text-white' : 'border-white/30 hover:border-accent bg-transparent text-transparent'}`}
                onClick={() => toggleStatusMutation.mutate(isCompleted ? 'todo' : 'done')}
                disabled={toggleStatusMutation.isPending}
              >
                {isCompleted && <Check className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </div>
        <HelpModal open={showHelpModal} onOpenChange={setShowHelpModal} task={task} course={course} />
      </>
      );
}

