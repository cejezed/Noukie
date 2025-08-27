import * as React from "react";
import { useState, useRef } from "react";

export function useAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = async (url: string) => {
    try {
      // Don't play if no URL provided (dummy/disabled audio)
      if (!url) {
        console.log("No audio URL provided, skipping playback");
        return;
      }

      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Create new audio element
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener('loadstart', () => {
        setIsPlaying(true);
      });

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        audioRef.current = null;
      });

      audio.addEventListener('error', (error) => {
        console.error('Audio playback error:', error);
        setIsPlaying(false);
        audioRef.current = null;
      });

      await audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      setIsPlaying(false);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
    }
  };

  return {
    playAudio,
    stopAudio,
    isPlaying,
  };
}
