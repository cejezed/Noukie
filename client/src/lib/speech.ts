// client/src/lib/speech.ts
export function speak(text: string, lang = "nl-NL", rate = 1) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    window.speechSynthesis.cancel(); // stop vorige
    window.speechSynthesis.speak(u);
  } catch {}
}

export function stopSpeak() {
  try { window.speechSynthesis.cancel(); } catch {}
}
