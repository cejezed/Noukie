// client/src/features/chat/SmartVoiceInput.tsx
import { useState, useEffect } from "react";
import HandsfreeVoice from "./HandsfreeVoice";
import VoiceButton from "./VoiceButton";

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function supportsWebSpeech() {
  // Check of Web Speech API beschikbaar is
  return typeof (window as any).webkitSpeechRecognition !== "undefined" ||
         typeof (window as any).SpeechRecognition !== "undefined";
}

type Props = {
  onTranscript: (text: string) => void;
  onPartialText?: (text: string) => void;
  lang?: string;
};

export default function SmartVoiceInput({ 
  onTranscript, 
  onPartialText,
  lang = "nl-NL" 
}: Props) {
  const [method, setMethod] = useState<"handsfree" | "button">("button");

  useEffect(() => {
    const canUseHandsfree = supportsWebSpeech();
    setMethod(canUseHandsfree ? "handsfree" : "button");
    
    console.log('🎤 Voice input method:', canUseHandsfree ? 'Web Speech API (handsfree)' : 'Server transcription (button)');
    console.log('📱 Is mobile:', isMobile());
    console.log('🔊 Web Speech available:', supportsWebSpeech());
  }, []);

  // Gebruik Web Speech API (handsfree, continuous) als beschikbaar
  if (method === "handsfree") {
    return (
      <HandsfreeVoice 
        onFinalText={onTranscript}
        onPartialText={onPartialText}
        lang={lang}
      />
    );
  }

  // Fallback: gebruik server-side transcriptie (push-to-talk)
  return (
    <VoiceButton 
      onTranscript={onTranscript}
      lang={lang.split("-")[0]} // "nl-NL" -> "nl"
    />
  );
}