import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { HelpCircle, Check, Trash2 } from "lucide-react";
import HelpModal from "@/components/HelpModal";
export default function TaskCard({ task, course, onStart, isStarting }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showHelpModal, setShowHelpModal] = useState(false);
    const isCompleted = task.status === "done";
    // CORRECTIE: Mutation praat nu direct met Supabase
    const toggleStatusMutation = useMutation({
        mutationFn: async (newStatus) => {
            const { error } = await supabase
                .from('tasks')
                .update({ status: newStatus })
                .eq('id', task.id)
                .eq('user_id', user.id);
            if (error)
                throw new Error(error.message);
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
                .eq('user_id', user.id);
            if (error)
                throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            toast({ title: "Taak verwijderd", description: "De voltooide taak is verwijderd." });
        },
        onError: (error) => {
            toast({ title: "Fout bij verwijderen", description: `Kon taak niet verwijderen: ${error.message}`, variant: "destructive" });
        }
    });
    const getPriorityLabel = (priority) => {
        if (priority >= 2)
            return "Hoge prioriteit";
        if (priority >= 1)
            return "Normale prioriteit";
        return "";
    };
    const getPriorityColor = (priority) => {
        if (priority >= 2)
            return "text-destructive";
        if (priority >= 1)
            return "text-accent";
        return "text-muted-foreground";
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: `task-card bg-card border border-border rounded-lg p-4 ${isCompleted ? 'opacity-70' : ''}`, "data-testid": `task-card-${task.id}`, children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-2", children: [_jsx("span", { className: "text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded", children: course?.name || "Algemeen" }), task.priority > 0 && (_jsx("span", { className: `text-xs font-medium ${getPriorityColor(task.priority)}`, children: getPriorityLabel(task.priority) }))] }), _jsx("h4", { className: `font-medium mb-1 ${isCompleted ? 'line-through' : ''}`, children: task.title }), task.est_minutes && (_jsxs("p", { className: "text-sm text-muted-foreground", children: ["\u00B1 ", task.est_minutes, " minuten"] }))] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Button, { variant: "ghost", size: "icon", className: "text-muted-foreground hover:text-accent p-1", onClick: () => setShowHelpModal(true), title: "Ik snap dit niet", children: _jsx(HelpCircle, { className: "w-5 h-5" }) }), isCompleted && (_jsx(Button, { variant: "ghost", size: "icon", className: "text-muted-foreground hover:text-destructive p-1", onClick: () => deleteTaskMutation.mutate(), disabled: deleteTaskMutation.isPending, title: "Verwijder voltooide taak", children: _jsx(Trash2, { className: "w-4 h-4" }) })), _jsx(Button, { variant: "outline", size: "icon", className: `w-6 h-6 border-2 rounded transition-colors ${isCompleted ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'}`, onClick: () => toggleStatusMutation.mutate(isCompleted ? 'todo' : 'done'), disabled: toggleStatusMutation.isPending, children: isCompleted && _jsx(Check, { className: "w-3 h-3" }) })] })] }) }), _jsx(HelpModal, { open: showHelpModal, onOpenChange: setShowHelpModal, task: task, course: course })] }));
}
