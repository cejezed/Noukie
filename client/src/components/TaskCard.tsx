import * as React from "react";
import { useState } from "react";
import { HelpCircle, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import HelpModal from "@/components/HelpModal";
import type { Task, Course } from "@shared/schema";

interface TaskCardProps {
  task: Task;
  course?: Course;
}

export default function TaskCard({ task, course }: TaskCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showHelpModal, setShowHelpModal] = useState(false);
  const isCompleted = task.status === "done";

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      const newStatus = isCompleted ? "todo" : "done";
      await apiRequest("PATCH", `/api/tasks/${task.id}/status`, { status: newStatus });
      return newStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: isCompleted ? "Taak heropend" : "Taak voltooid!",
        description: isCompleted ? "Je kunt weer aan deze taak werken." : "Goed gedaan!",
      });
    },
    onError: (error) => {
      console.error("Task status update error:", error);
      toast({
        title: "Fout",
        description: "Kon taakstatus niet bijwerken.",
        variant: "destructive",
      });
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/tasks/${task.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: "Taak verwijderd",
        description: "De voltooide taak is verwijderd.",
      });
    },
    onError: (error) => {
      console.error("Task delete error:", error);
      toast({
        title: "Fout bij verwijderen",
        description: "Kon taak niet verwijderen. Probeer opnieuw.",
        variant: "destructive",
      });
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
      <div className={`task-card bg-card border border-border rounded-lg p-4 ${isCompleted ? 'opacity-70' : ''}`} data-testid={`task-card-${task.id}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                {course?.name || "Algemeen"}
              </span>
              {task.priority && task.priority > 0 && (
                <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                  {getPriorityLabel(task.priority)}
                </span>
              )}
            </div>
            <h4 className={`font-medium mb-1 ${isCompleted ? 'line-through' : ''}`}>
              {task.title}
            </h4>
            {task.estMinutes && (
              <p className="text-sm text-muted-foreground">± {task.estMinutes} minuten</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-accent p-1"
              onClick={() => setShowHelpModal(true)}
              data-testid={`button-help-${task.id}`}
              title="Ik snap dit niet"
            >
              <HelpCircle className="w-5 h-5" />
            </Button>
            {isCompleted && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive p-1"
                onClick={() => deleteTaskMutation.mutate()}
                disabled={deleteTaskMutation.isPending}
                data-testid={`button-delete-${task.id}`}
                title="Verwijder voltooide taak"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className={`w-6 h-6 border-2 rounded transition-colors ${
                isCompleted 
                  ? 'border-primary bg-primary text-primary-foreground' 
                  : 'border-border hover:border-primary'
              }`}
              onClick={() => toggleStatusMutation.mutate()}
              disabled={toggleStatusMutation.isPending}
              data-testid={`button-toggle-${task.id}`}
            >
              {isCompleted && <Check className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      </div>

      <HelpModal
        open={showHelpModal}
        onOpenChange={setShowHelpModal}
        task={task}
        course={course}
      />
    </>
  );
}
