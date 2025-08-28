import * as React from "react";
import { useState, useRef, useCallback } from "react";

interface UseVoiceRecorderProps {
  maxDuration?: number; // in seconds
  onRecordingComplete?: (audioBlob: Blob) => void;
  onStatusChange?: (status: string) => void;
}

export function useVoiceRecorder({
  maxDuration = 60,
  onRecordingComplete,
  onStatusChange,
}: UseVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const updateStatus = useCallback((status: string) => {
    onStatusChange?.(status);
  }, [onStatusChange]);

  const startRecording = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      // Create MediaRecorder instance with supported format
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Set up event listeners
      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });
        onRecordingComplete?.(audioBlob);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
      });

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);
      updateStatus("Aan het opnemen...");

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          
          // Auto-stop at max duration
          if (newTime >= maxDuration) {
            stopRecording();
          }
          
          return newTime;
        });
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      updateStatus("Microfoon toegang geweigerd");
      
      // Show helpful error message
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          updateStatus("Geef toegang tot je microfoon in browserinstellingen");
        } else if (error.name === 'NotFoundError') {
          updateStatus("Geen microfoon gevonden");
        } else {
          updateStatus("Fout bij toegang tot microfoon");
        }
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      updateStatus("Opname gestopt, bezig met verwerken...");
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Clean up on component unmount
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  return {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    cleanup,
  };
}
