import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Camera, Upload, Mic, Square } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import HelpModal from "@/components/HelpModal";
export default function Help() {
    const [textInput, setTextInput] = useState("");
    const [selectedCourse, setSelectedCourse] = useState("");
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [helpData, setHelpData] = useState(null);
    const courses = ["Wiskunde A", "Biologie", "Economie", "Nederlands"];
    const handleVoiceRecording = (audioBlob) => {
        // Convert audio to help data
        setHelpData({
            mode: "voice",
            audioBlob,
            course: selectedCourse,
        });
        setShowHelpModal(true);
    };
    // Voice recording
    const { isRecording, startRecording, stopRecording, recordingTime } = useVoiceRecorder({
        maxDuration: 60,
        onRecordingComplete: handleVoiceRecording,
        onStatusChange: (status) => {
            console.log("Voice recording status:", status);
        }
    });
    const handleFileUpload = (type) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = type === "photo" ? "image/*" : ".pdf";
        input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (file) {
                // Set up help modal with file data
                setHelpData({
                    mode: "image",
                    file,
                    course: selectedCourse,
                });
                setShowHelpModal(true);
            }
        };
        input.click();
    };
    const handleTextHelp = () => {
        if (!textInput.trim()) {
            return;
        }
        setHelpData({
            mode: "text",
            text: textInput,
            course: selectedCourse,
        });
        setShowHelpModal(true);
    };
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')} / 1:00`;
    };
    return (_jsxs("div", { className: "p-6", "data-testid": "page-help", children: [_jsx("h2", { className: "text-xl font-semibold mb-6", children: "Ik snap dit niet" }), _jsxs("div", { className: "grid grid-cols-3 gap-3 mb-6", children: [_jsxs(Button, { variant: "outline", className: "h-24 flex flex-col items-center justify-center space-y-1 border-dashed hover:border-primary transition-colors", onClick: () => handleFileUpload("photo"), "data-testid": "button-upload-photo", children: [_jsx(Camera, { className: "w-5 h-5" }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-xs font-medium", children: "Foto" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Opgave" })] })] }), _jsxs(Button, { variant: "outline", className: "h-24 flex flex-col items-center justify-center space-y-1 border-dashed hover:border-primary transition-colors", onClick: isRecording ? stopRecording : startRecording, "data-testid": "button-voice-help", children: [isRecording ? _jsx(Square, { className: "w-5 h-5 text-destructive" }) : _jsx(Mic, { className: "w-5 h-5" }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-xs font-medium", children: isRecording ? "Stop" : "Vraag" }), _jsx("p", { className: "text-xs text-muted-foreground", children: isRecording ? formatTime(recordingTime) : "Inspreek" })] })] }), _jsxs(Button, { variant: "outline", className: "h-24 flex flex-col items-center justify-center space-y-1 border-dashed hover:border-primary transition-colors", onClick: () => handleFileUpload("pdf"), "data-testid": "button-upload-pdf", children: [_jsx(Upload, { className: "w-5 h-5" }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-xs font-medium", children: "PDF" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Document" })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { className: "text-lg", children: "Of beschrijf wat je niet snapt" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "help-text", children: "Beschrijving" }), _jsx(Textarea, { id: "help-text", value: textInput, onChange: (e) => setTextInput(e.target.value), placeholder: "Bijv. Ik snap niet hoe je de sinus van een hoek berekent...", className: "resize-none", rows: 4, "data-testid": "textarea-help-text" })] }), _jsxs("div", { className: "flex items-end justify-between", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(Label, { htmlFor: "course", children: "Vak" }), _jsxs(Select, { value: selectedCourse, onValueChange: setSelectedCourse, children: [_jsx(SelectTrigger, { className: "w-40", "data-testid": "select-course", children: _jsx(SelectValue, { placeholder: "Selecteer vak" }) }), _jsx(SelectContent, { children: courses.map((course) => (_jsx(SelectItem, { value: course, children: course }, course))) })] })] }), _jsx(Button, { onClick: handleTextHelp, disabled: !textInput.trim(), "data-testid": "button-get-help", children: "Help krijgen" })] })] })] }), _jsx(Card, { className: "mt-6", children: _jsxs(CardContent, { className: "pt-6", children: [_jsx("h3", { className: "font-medium mb-3", children: "Tips voor betere hulp:" }), _jsxs("ul", { className: "space-y-2 text-sm text-muted-foreground", children: [_jsxs("li", { className: "flex items-start space-x-2", children: [_jsx("span", { className: "text-primary", children: "\u2022" }), _jsx("span", { children: "Wees zo specifiek mogelijk over wat je niet snapt" })] }), _jsxs("li", { className: "flex items-start space-x-2", children: [_jsx("span", { className: "text-primary", children: "\u2022" }), _jsx("span", { children: "Bij foto's: zorg voor goede belichting en scherpte" })] }), _jsxs("li", { className: "flex items-start space-x-2", children: [_jsx("span", { className: "text-primary", children: "\u2022" }), _jsx("span", { children: "Selecteer het juiste vak voor betere uitleg" })] }), _jsxs("li", { className: "flex items-start space-x-2", children: [_jsx("span", { className: "text-primary", children: "\u2022" }), _jsx("span", { children: "Probeer eerst zelf te begrijpen voordat je de uitleg vraagt" })] })] }), _jsx("div", { className: "mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md", children: _jsxs("p", { className: "text-sm text-amber-800", children: [_jsx("strong", { children: "\u26A0\uFE0F Belangrijk:" }), " Controleer belangrijke informatie altijd met je schoolboek, docent of andere betrouwbare bronnen. AI kan soms fouten maken."] }) })] }) }), _jsx(HelpModal, { open: showHelpModal, onOpenChange: setShowHelpModal, helpData: helpData })] }));
}
