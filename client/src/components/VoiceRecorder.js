import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
export default function VoiceRecorder() {
    const { toast } = useToast();
    const [status, setStatus] = useState("Tik om op te nemen");
    const { isRecording, recordingTime, startRecording, stopRecording } = useVoiceRecorder({
        maxDuration: 60,
        onRecordingComplete: (audioBlob) => {
            handleRecording(audioBlob);
        },
        onStatusChange: (newStatus) => {
            setStatus(newStatus);
        }
    });
    const voiceMutation = useMutation({
        mutationFn: async (audioBlob) => {
            const formData = new FormData();
            const fileExtension = audioBlob.type.includes('wav') ? 'wav' :
                audioBlob.type.includes('ogg') ? 'ogg' :
                    audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
            formData.append("audio", audioBlob, `recording.${fileExtension}`);
            const response = await apiRequest("POST", "/api/ingest", formData);
            return await response.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Voice check-in voltooid!",
                description: data.agentReply,
                duration: 8000,
            });
        },
        onError: (error) => {
            console.error("Voice error:", error);
            toast({
                title: "Fout bij verwerken",
                description: "Probeer het opnieuw.",
                variant: "destructive",
            });
        }
    });
    const handleRecording = (audioBlob) => {
        voiceMutation.mutate(audioBlob);
    };
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')} / 1:00`;
    };
    return (_jsx("section", { className: "p-6 border rounded-lg bg-card", "data-testid": "voice-recorder", children: _jsxs("div", { className: "text-center", children: [_jsx("h2", { className: "text-xl font-semibold mb-2", children: "Voice Check-in" }), _jsx("p", { className: "text-muted-foreground mb-6", children: "Vertel me over je taken en huiswerk" }), _jsxs("div", { className: "relative", children: [_jsx(Button, { className: `voice-button w-20 h-20 rounded-full text-white font-semibold transition-all duration-200 relative overflow-hidden ${isRecording
                                ? 'bg-destructive hover:bg-destructive/90 animate-pulse'
                                : 'bg-primary hover:bg-primary/90'}`, onClick: isRecording ? stopRecording : startRecording, disabled: voiceMutation.isPending, "data-testid": isRecording ? "button-stop-recording" : "button-start-recording", children: voiceMutation.isPending ? (_jsx("div", { className: "animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" })) : isRecording ? (_jsx(Square, { className: "w-8 h-8" })) : (_jsx(Mic, { className: "w-8 h-8" })) }), _jsx("div", { className: "mt-3", children: _jsx("div", { className: "text-sm text-muted-foreground", "data-testid": "recording-time", children: formatTime(recordingTime) }) })] }), _jsx("div", { className: "mt-4 text-sm", "data-testid": "recording-status", children: voiceMutation.isPending ? (_jsx("span", { className: "text-primary", children: "Bezig met verwerken..." })) : isRecording ? (_jsx("span", { className: "text-destructive", children: "Aan het opnemen..." })) : recordingTime > 0 && !voiceMutation.isPending ? (_jsx("span", { className: "text-primary", children: "Opname voltooid" })) : (_jsx("span", { className: "text-muted-foreground", children: status })) }), voiceMutation.isSuccess && voiceMutation.data && (_jsxs("div", { className: "mt-4 p-4 bg-muted rounded-lg text-left", children: [_jsx("div", { className: "text-sm font-medium text-muted-foreground mb-2", children: "Transcript:" }), _jsx("div", { className: "text-sm mb-3 italic", children: voiceMutation.data.text }), _jsx("div", { className: "text-sm font-medium text-muted-foreground mb-2", children: "Coach:" }), _jsx("div", { className: "text-sm", children: voiceMutation.data.agentReply })] }))] }) }));
}
