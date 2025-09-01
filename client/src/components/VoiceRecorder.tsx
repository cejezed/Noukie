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
  const [status, setStatus] = useState<string>("Tik om op te nemen");
  
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
    mutationFn: async (audioBlob: Blob) => {
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

  const handleRecording = (audioBlob: Blob) => {
    voiceMutation.mutate(audioBlob);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')} / 1:00`;
  };

  return (
    <section className="p-6 border rounded-lg bg-card" data-testid="voice-recorder">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Voice Check-in</h2>
        <p className="text-muted-foreground mb-6">Vertel me over je taken en huiswerk</p>
        
        <div className="relative">
          <Button
            className={`voice-button w-20 h-20 rounded-full text-white font-semibold transition-all duration-200 relative overflow-hidden ${
              isRecording 
                ? 'bg-destructive hover:bg-destructive/90 animate-pulse' 
                : 'bg-primary hover:bg-primary/90'
            }`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={voiceMutation.isPending}
            data-testid={isRecording ? "button-stop-recording" : "button-start-recording"}
          >
            {voiceMutation.isPending ? (
              <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
            ) : isRecording ? (
              <Square className="w-8 h-8" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </Button>
          
          <div className="mt-3">
            <div className="text-sm text-muted-foreground" data-testid="recording-time">
              {formatTime(recordingTime)}
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-sm" data-testid="recording-status">
          {voiceMutation.isPending ? (
            <span className="text-primary">Bezig met verwerken...</span>
          ) : isRecording ? (
            <span className="text-destructive">Aan het opnemen...</span>
          ) : recordingTime > 0 && !voiceMutation.isPending ? (
            <span className="text-primary">Opname voltooid</span>
          ) : (
            <span className="text-muted-foreground">{status}</span>
          )}
        </div>

        {voiceMutation.isSuccess && voiceMutation.data && (
          <div className="mt-4 p-4 bg-muted rounded-lg text-left">
            <div className="text-sm font-medium text-muted-foreground mb-2">Transcript:</div>
            <div className="text-sm mb-3 italic">{voiceMutation.data.text}</div>
            <div className="text-sm font-medium text-muted-foreground mb-2">Coach:</div>
            <div className="text-sm">{voiceMutation.data.agentReply}</div>
          </div>
        )}
      </div>
    </section>
  );
}