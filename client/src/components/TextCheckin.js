import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
export default function TextCheckin() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [inputText, setInputText] = useState("");
    const planMutation = useMutation({
        mutationFn: async (text) => {
            const planResponse = await apiRequest("POST", "/api/plan", {
                transcript: text,
                date: new Date().toISOString(),
                userId: user?.id
            });
            return await planResponse.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Check-in voltooid!",
                description: `${data.tasks.length} nieuwe taken aangemaakt.`,
            });
            setInputText("");
            queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
        },
        onError: (error) => {
            console.error("Planning error:", error);
            toast({
                title: "Fout bij verwerken",
                description: "Probeer het opnieuw.",
                variant: "destructive",
            });
        }
    });
    const handleSubmit = () => {
        if (!inputText.trim())
            return;
        planMutation.mutate(inputText.trim());
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(Textarea, { value: inputText, onChange: (e) => setInputText(e.target.value), placeholder: "Vertel wat je vandaag wilt doen... bijvoorbeeld: 'Ik moet voor wiskunde hoofdstuk 3 leren, nederlands essay schrijven en voor de toets van maandag studeren'", className: "min-h-[100px] resize-none", "data-testid": "input-checkin-text" }), _jsx(Button, { onClick: handleSubmit, disabled: planMutation.isPending || !inputText.trim(), className: "w-full", "data-testid": "button-submit-checkin", children: planMutation.isPending ? ("Bezig met planning maken...") : (_jsxs(_Fragment, { children: [_jsx(Send, { className: "w-4 h-4 mr-2" }), "Planning maken"] })) })] }));
}
