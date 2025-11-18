import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { useState, useEffect } from "react";
import { Camera, Upload, Volume2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/hooks/use-audio";
export default function HelpModal({ open, onOpenChange, task, course, helpData }) {
    const { toast } = useToast();
    const { playAudio } = useAudio();
    const [textInput, setTextInput] = useState(helpData?.text || "");
    const [selectedCourse, setSelectedCourse] = useState(helpData?.course || course?.name || "");
    const [explanation, setExplanation] = useState(null);
    const [selectedAnswer, setSelectedAnswer] = useState("");
    const [currentTopic, setCurrentTopic] = useState("");
    const courses = ["Wiskunde A", "Biologie", "Economie", "Nederlands"];
    // Auto-start help request when helpData is provided
    useEffect(() => {
        if (helpData && open && !explanation) {
            if (helpData.mode === "text" && helpData.text) {
                helpMutation.mutate({
                    mode: "text",
                    text: helpData.text,
                    course: helpData.course,
                });
            }
        }
    }, [helpData, open, explanation]);
    // Reset explanation when modal closes
    useEffect(() => {
        if (!open) {
            setExplanation(null);
            setSelectedAnswer("");
        }
    }, [open]);
    const helpMutation = useMutation({
        mutationFn: async (data) => {
            const response = await apiRequest("POST", "/api/explain", data);
            return await response.json();
        },
        onSuccess: (data) => {
            setExplanation(data);
            // If no currentTopic is set (edge case), use the first step as topic
            if (!currentTopic && data.steps.length > 0) {
                setCurrentTopic(data.steps[0].substring(0, 50)); // First 50 chars of first step
            }
            // Play coach audio
            if (data.coach_text) {
                playTTSAudio(data.coach_text);
            }
        },
        onError: (error) => {
            console.error("Help error:", error);
            toast({
                title: "Fout bij uitleg",
                description: "Probeer het opnieuw.",
                variant: "destructive",
            });
        }
    });
    const ttsAudioMutation = useMutation({
        mutationFn: async (text) => {
            const response = await apiRequest("POST", "/api/tts", { text });
            return await response.json();
        },
        onSuccess: (data) => {
            if (data.audioUrl) {
                playAudio(data.audioUrl);
            }
        }
    });
    const playTTSAudio = (text) => {
        if (text && text.trim()) {
            ttsAudioMutation.mutate(text);
        }
    };
    // Expand explanation mutation
    const expandMutation = useMutation({
        mutationFn: async () => {
            if (!explanation || !currentTopic || !selectedCourse) {
                throw new Error("Missing data for expansion");
            }
            console.log("Sending expand request:", {
                topic: currentTopic,
                course: selectedCourse,
                hasExplanation: !!explanation
            });
            const response = await apiRequest("POST", "/api/explain/expand", {
                originalExplanation: explanation,
                topic: currentTopic,
                course: selectedCourse
            });
            if (!response.ok) {
                const errorData = await response.text();
                console.error("Expand API error:", errorData);
                throw new Error(`Server error: ${response.status}`);
            }
            return await response.json();
        },
        onSuccess: (data) => {
            setExplanation(data);
            setSelectedAnswer(""); // Reset quiz answer
            // Play new coach audio
            if (data.coach_text) {
                playTTSAudio(data.coach_text);
            }
            toast({
                title: "Uitgebreide uitleg",
                description: "Je hebt nu meer gedetailleerde stappen en een moeilijkere vraag!"
            });
        },
        onError: (error) => {
            console.error("Expand error:", error);
            toast({
                title: "Fout",
                description: "Kon geen uitgebreide uitleg genereren. Probeer opnieuw.",
                variant: "destructive"
            });
        }
    });
    const handleTextHelp = () => {
        if (!textInput.trim()) {
            toast({
                title: "Geen tekst",
                description: "Typ eerst wat je niet snapt.",
                variant: "destructive",
            });
            return;
        }
        setCurrentTopic(textInput); // Store the topic for potential expansion
        helpMutation.mutate({
            mode: "text",
            text: textInput,
            course: selectedCourse,
        });
    };
    const handleMoreExplanation = () => {
        console.log("More explanation clicked:", { explanation: !!explanation, currentTopic, selectedCourse });
        if (explanation && currentTopic && selectedCourse) {
            expandMutation.mutate();
        }
        else {
            console.log("Missing data for expansion:", {
                hasExplanation: !!explanation,
                currentTopic,
                selectedCourse
            });
            toast({
                title: "Fout",
                description: "Kan geen uitgebreide uitleg genereren. Probeer eerst nieuwe hulp te vragen.",
                variant: "destructive"
            });
        }
    };
    const handleFileUpload = (type) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = type === "photo" ? "image/*" : ".pdf";
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file)
                return;
            const formData = new FormData();
            formData.append("image", file);
            try {
                const ocrResponse = await apiRequest("POST", "/api/ocr", formData);
                const { text } = await ocrResponse.json();
                setCurrentTopic(text); // Store OCR text as topic for expansion
                helpMutation.mutate({
                    mode: "image",
                    text,
                    course: selectedCourse,
                });
            }
            catch (error) {
                console.error("OCR error:", error);
                toast({
                    title: "Fout bij verwerken",
                    description: "Kon bestand niet verwerken.",
                    variant: "destructive",
                });
            }
        };
        input.click();
    };
    const checkQuizAnswer = () => {
        if (!explanation || !selectedAnswer)
            return;
        const isCorrect = selectedAnswer === explanation.quiz.answer;
        toast({
            title: isCorrect ? "Goed gedaan!" : "Niet helemaal juist",
            description: isCorrect
                ? "Je hebt het goede antwoord gekozen."
                : `Het juiste antwoord is ${explanation.quiz.answer}.`,
            variant: isCorrect ? "default" : "destructive",
        });
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-w-md mx-auto max-h-[90vh] overflow-y-auto", "data-testid": "help-modal", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Ik snap dit niet" }), explanation && (_jsx("div", { className: "bg-amber-50 border border-amber-200 rounded-md p-3 mt-2", children: _jsxs("p", { className: "text-sm text-amber-800", children: ["\u26A0\uFE0F ", _jsx("strong", { children: "Verificatie aanbevolen:" }), " Controleer belangrijke informatie altijd met je schoolboek of vraag het na bij je docent."] }) }))] }), !explanation && !helpMutation.isPending ? (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs(Button, { variant: "outline", className: "h-24 flex flex-col items-center justify-center space-y-2 border-dashed", onClick: () => handleFileUpload("photo"), "data-testid": "button-upload-photo", children: [_jsx(Camera, { className: "w-6 h-6" }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-sm font-medium", children: "Foto maken" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Van opgave of boek" })] })] }), _jsxs(Button, { variant: "outline", className: "h-24 flex flex-col items-center justify-center space-y-2 border-dashed", onClick: () => handleFileUpload("pdf"), "data-testid": "button-upload-pdf", children: [_jsx(Upload, { className: "w-6 h-6" }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-sm font-medium", children: "PDF uploaden" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Digitaal bestand" })] })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Of beschrijf wat je niet snapt" }), _jsx(Textarea, { value: textInput, onChange: (e) => setTextInput(e.target.value), placeholder: "Bijv. Ik snap niet hoe je de sinus van een hoek berekent...", className: "resize-none", rows: 3, "data-testid": "textarea-help-text" })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Vak" }), _jsxs(Select, { value: selectedCourse, onValueChange: setSelectedCourse, children: [_jsx(SelectTrigger, { className: "w-32", "data-testid": "select-course", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: courses.map((courseName) => (_jsx(SelectItem, { value: courseName, children: courseName }, courseName))) })] })] }), _jsx(Button, { onClick: handleTextHelp, disabled: helpMutation.isPending, "data-testid": "button-get-help", children: helpMutation.isPending ? "Bezig..." : "Help krijgen" })] })] })] })) : helpMutation.isPending ? (_jsxs("div", { className: "flex items-center justify-center py-8", children: [_jsx("div", { className: "animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" }), _jsx("span", { className: "ml-3", children: "Bezig met uitleg genereren..." })] })) : (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h3", { className: "font-medium", children: ["Uitleg: ", task?.title || "Algemene hulp"] }), _jsx(Button, { variant: "outline", size: "icon", onClick: () => playTTSAudio(explanation?.coach_text || ''), disabled: ttsAudioMutation.isPending, "data-testid": "button-play-explanation", children: _jsx(Volume2, { className: "w-4 h-4" }) })] }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium mb-2", children: "Stappen:" }), _jsx("ol", { className: "space-y-2 text-sm", children: explanation?.steps?.map((step, index) => (_jsxs("li", { className: "flex", "data-testid": `step-${index}`, children: [_jsx("span", { className: "w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0", children: index + 1 }), _jsx("span", { children: step })] }, index))) })] }), _jsxs("div", { className: "bg-muted/50 rounded-lg p-3", "data-testid": "example-section", children: [_jsx("h4", { className: "text-sm font-medium mb-2", children: "Voorbeeld:" }), _jsx("p", { className: "text-sm mb-2", children: explanation?.example?.prompt || 'Geen voorbeeld beschikbaar' }), _jsx("p", { className: "text-sm font-mono bg-background px-2 py-1 rounded", children: explanation?.example?.solution || 'Geen oplossing beschikbaar' })] }), _jsxs("div", { className: "border border-border rounded-lg p-3", "data-testid": "quiz-section", children: [_jsx("h4", { className: "text-sm font-medium mb-3", children: "Controle vraag:" }), _jsx("p", { className: "text-sm mb-3", children: explanation?.quiz?.question || 'Geen vraag beschikbaar' }), _jsx("div", { className: "space-y-2 mb-4", children: explanation?.quiz?.choices?.map((choice, index) => (_jsxs("label", { className: "flex items-center space-x-2 text-sm cursor-pointer", children: [_jsx("input", { type: "radio", name: "quiz-answer", value: choice.charAt(0), checked: selectedAnswer === choice.charAt(0), onChange: (e) => setSelectedAnswer(e.target.value), className: "text-primary", "data-testid": `radio-answer-${choice.charAt(0)}` }), _jsx("span", { children: choice })] }, index))) }), _jsxs("div", { className: "flex space-x-2", children: [_jsx(Button, { className: "flex-1", onClick: checkQuizAnswer, disabled: !selectedAnswer, "data-testid": "button-check-answer", children: "Controleren" }), _jsx(Button, { variant: "outline", onClick: handleMoreExplanation, disabled: expandMutation.isPending, "data-testid": "button-more-explanation", children: expandMutation.isPending ? "Bezig..." : "Meer uitleg" }), _jsx(Button, { variant: "outline", onClick: () => onOpenChange(false), "data-testid": "button-understood", children: "Snap ik nu" })] })] }), explanation?.resources && explanation.resources.length > 0 && (_jsxs("div", { className: "border-t pt-4", children: [_jsxs("h4", { className: "text-sm font-medium mb-3 flex items-center", children: [_jsx(ExternalLink, { className: "w-4 h-4 mr-2" }), "Meer leren:"] }), _jsx("div", { className: "space-y-2", children: explanation.resources.map((resource, index) => (_jsxs("a", { href: resource.url, target: "_blank", rel: "noopener noreferrer", className: "flex items-center text-sm text-primary hover:text-primary/80 underline transition-colors", "data-testid": `resource-link-${index}`, children: [_jsx(ExternalLink, { className: "w-3 h-3 mr-1 flex-shrink-0" }), resource.title] }, index))) })] }))] }))] }) }));
}
