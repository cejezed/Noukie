import * as React from "react";
import { useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

export default function VoiceRecorder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const planMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      // First, transcribe the audio
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      
      const asrResponse = await apiRequest("POST", "/api/asr", formData);
      const { transcript } = await asrResponse.json();
      
      // Then, create a plan
      const planResponse = await apiRequest("POST", "/api/plan", {
        transcript,
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
      
      // Invalidate tasks cache
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

  const handleRecording = (audioBlob: Blob) => {
    planMutation.mutate(audioBlob);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')} / 1:00`;
  };

  return (
    <section className="p-6" data-testid="voice-recorder">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Dagelijkse Check-in</h2>
        <p className="text-muted-foreground mb-6">Vertel me over je taken en huiswerk</p>
        
        <div className="relative">
          <Button
            className={`voice-button w-20 h-20 rounded-full text-white font-semibold transition-all duration-200 relative overflow-hidden ${
              isRecording ? 'recording-pulse' : ''
            }`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={planMutation.isPending}
            data-testid={isRecording ? "button-stop-recording" : "button-start-recording"}
          >
            {planMutation.isPending ? (
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
          {planMutation.isPending ? (
            <span className="text-primary">Bezig met verwerken...</span>
          ) : isRecording ? (
            <span className="text-destructive">Aan het opnemen...</span>
          ) : recordingTime > 0 && !planMutation.isPending ? (
            <span className="text-primary">Opname voltooid</span>
          ) : (
            <span className="text-muted-foreground">{status}</span>
          )}
        </div>
      </div>
    </section>
  );
}
