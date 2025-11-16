import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// client/src/features/chat/VoiceButton.tsx
import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, AlertCircle } from "lucide-react";
export default function VoiceButton({ onTranscript, lang = "nl" }) {
    const [recording, setRecording] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [debugInfo, setDebugInfo] = useState("");
    const mediaRec = useRef(null);
    const chunks = useRef([]);
    useEffect(() => {
        const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
        setDebugInfo(`getUserMedia: ${hasGetUserMedia}, MediaRecorder: ${hasMediaRecorder}`);
        return () => {
            if (mediaRec.current && mediaRec.current.state !== "inactive") {
                mediaRec.current.stop();
            }
        };
    }, []);
    async function start() {
        console.log('🎤 Start button clicked');
        setError("");
        try {
            console.log('🎤 Requesting mic access...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('✅ Mic access granted');
            const mimeTypes = [
                'audio/mp4', // Probeer eerst MP4 (beste compatibiliteit)
                'audio/mpeg', // MP3
                'audio/webm;codecs=opus',
                'audio/ogg;codecs=opus',
                'audio/webm',
                'audio/wav',
            ];
            let selectedMime = 'audio/webm';
            let filename = 'voice.webm';
            for (const mime of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mime)) {
                    selectedMime = mime;
                    console.log(`✅ Using MIME type: ${mime}`);
                    if (selectedMime.includes('ogg'))
                        filename = 'voice.ogg';
                    else if (selectedMime.includes('mp4'))
                        filename = 'voice.mp4';
                    else if (selectedMime.includes('wav'))
                        filename = 'voice.wav';
                    else if (selectedMime.includes('mpeg'))
                        filename = 'voice.mp3';
                    else
                        filename = 'voice.webm';
                    break;
                }
            }
            const rec = new MediaRecorder(stream, { mimeType: selectedMime });
            chunks.current = [];
            rec.ondataavailable = (e) => {
                console.log(`📦 Data chunk: ${e.data.size} bytes`);
                if (e.data.size > 0) {
                    chunks.current.push(e.data);
                }
            };
            rec.onstop = async () => {
                console.log(`🛑 Recording stopped. Total chunks: ${chunks.current.length}`);
                try {
                    setBusy(true);
                    const blob = new Blob(chunks.current, { type: selectedMime });
                    console.log(`📤 Blob size: ${blob.size} bytes, filename: ${filename}`);
                    if (blob.size === 0) {
                        throw new Error('Geen audio opgenomen');
                    }
                    const fd = new FormData();
                    fd.append("audio", blob, filename);
                    fd.append("lang", lang);
                    const base = import.meta.env.VITE_API_BASE || "/api";
                    const url = `${base}/asr`;
                    console.log(`📤 Uploading to: ${url}`);
                    const res = await fetch(url, { method: "POST", body: fd });
                    console.log(`📥 Response status: ${res.status}`);
                    if (!res.ok) {
                        const errorText = await res.text();
                        console.error('❌ Server error:', errorText);
                        throw new Error(errorText || "Transcriptie mislukt");
                    }
                    const data = await res.json();
                    console.log('✅ Response data:', data);
                    const text = data.transcript || data.text;
                    if (text) {
                        console.log(`✅ Transcript: "${text}"`);
                        onTranscript(text);
                    }
                    else {
                        console.warn('⚠️ No transcript in response');
                        setError('Geen tekst ontvangen van server');
                    }
                }
                catch (e) {
                    console.error("❌ Transcription error:", e);
                    setError(`Fout: ${e.message}`);
                }
                finally {
                    setBusy(false);
                    stream.getTracks().forEach(t => {
                        console.log('🔇 Stopping track:', t.kind);
                        t.stop();
                    });
                }
            };
            rec.onerror = (e) => {
                console.error('❌ MediaRecorder error:', e);
                setError(`Opname fout: ${e.error?.message || 'onbekend'}`);
            };
            mediaRec.current = rec;
            rec.start();
            console.log('🔴 Recording started');
            setRecording(true);
        }
        catch (e) {
            console.error("❌ Mic access error:", e);
            setError(`Microfoon fout: ${e.message}`);
        }
    }
    function stop() {
        console.log('⏹️ Stop button clicked');
        if (mediaRec.current && mediaRec.current.state !== "inactive") {
            mediaRec.current.stop();
            setRecording(false);
        }
    }
    if (busy) {
        return (_jsxs("div", { className: "space-y-2", children: [_jsxs("button", { type: "button", className: "inline-flex items-center px-3 py-2 rounded-md border bg-slate-50", disabled: true, children: [_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }), " Verwerken\u2026"] }), debugInfo && _jsx("div", { className: "text-xs text-slate-500", children: debugInfo })] }));
    }
    return (_jsxs("div", { className: "space-y-2", children: [recording ? (_jsxs("button", { type: "button", onClick: stop, className: "inline-flex items-center px-3 py-2 rounded-md border bg-red-50 hover:bg-red-100", children: [_jsx(Square, { className: "w-4 h-4 mr-2 text-red-600" }), " Stop opname"] })) : (_jsxs("button", { type: "button", onClick: start, className: "inline-flex items-center px-3 py-2 rounded-md border hover:bg-slate-50", children: [_jsx(Mic, { className: "w-4 h-4 mr-2" }), " Spreek in"] })), error && (_jsxs("div", { className: "flex items-start gap-2 text-xs text-red-600 bg-red-50 p-2 rounded", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0 mt-0.5" }), _jsx("span", { children: error })] })), debugInfo && !error && (_jsx("div", { className: "text-xs text-slate-500", children: debugInfo }))] }));
}
