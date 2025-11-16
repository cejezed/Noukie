import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Send, Camera, Repeat, Info, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import Tesseract from 'tesseract.js';
export default function LeerChat() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [opgave, setOpgave] = useState("");
    const [selectedCourse, setSelectedCourse] = useState("");
    const [messages, setMessages] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [ocrState, setOcrState] = useState({ status: "idle" });
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [chatSessions, setChatSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState("new");
    const [courseOptions, setCourseOptions] = useState([]);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const scrollerRef = useRef(null);
    const viewportRef = useRef(null);
    const fileInputRef = useRef(null);
    const textRef = useRef(null);
    // Measure bottom tabbar height to anchor composer above it
    const [tabbarH, setTabbarH] = useState(64); // fallback
    const [composerH, setComposerH] = useState(0);
    const composerRef = useRef(null);
    useEffect(() => {
        const tb = document.querySelector('[data-tabbar], nav[role="tablist"], footer[data-bottom-nav]');
        const update = () => setTabbarH(tb instanceof HTMLElement ? tb.offsetHeight : 64);
        update();
        const ro = new ResizeObserver(update);
        if (tb instanceof HTMLElement)
            ro.observe(tb);
        return () => ro.disconnect();
    }, []);
    useEffect(() => {
        const update = () => setComposerH(composerRef.current?.offsetHeight || 0);
        update();
        const ro = new ResizeObserver(update);
        if (composerRef.current)
            ro.observe(composerRef.current);
        return () => ro.disconnect();
    }, [opgave, selectedCourse, isUploading]);
    const startNewChat = () => {
        setMessages([]);
        setSelectedSessionId("new");
        setCurrentSessionId(null);
        setOpgave("");
        setOcrState({ status: "idle" });
        toast({ title: "Nieuwe chat gestart" });
    };
    // textarea auto-resize (1–6 lines)
    const autoResize = () => {
        const el = textRef.current;
        if (!el)
            return;
        el.style.height = "auto";
        const max = 6 * 22;
        el.style.height = Math.min(el.scrollHeight, max) + "px";
    };
    useEffect(() => { autoResize(); }, [opgave]);
    // Load courses
    useEffect(() => {
        const loadCourseOptions = async () => {
            if (!user) {
                setCourseOptions([]);
                return;
            }
            setLoadingCourses(true);
            try {
                const { data: courses, error } = await supabase
                    .from("courses").select("name")
                    .eq("user_id", user.id)
                    .order("name", { ascending: true });
                if (error)
                    throw error;
                const names = (courses ?? []).map((c) => c.name).filter(Boolean);
                setCourseOptions(names);
                if (selectedCourse && !names.includes(selectedCourse))
                    setSelectedCourse("");
            }
            catch (e) {
                toast({ title: "Fout", description: "Kon vakken niet laden.", variant: "destructive" });
            }
            finally {
                setLoadingCourses(false);
            }
        };
        loadCourseOptions();
    }, [user, toast, selectedCourse]);
    // Load sessions per subject
    useEffect(() => {
        const loadChatSessions = async () => {
            if (!user || !selectedCourse) {
                setChatSessions([]);
                setSelectedSessionId("new");
                setMessages([]);
                return;
            }
            try {
                const { data, error } = await supabase
                    .from("chatsessies").select("*")
                    .eq("user_id", user.id)
                    .eq("vak", selectedCourse)
                    .order("updated_at", { ascending: false });
                if (error)
                    throw error;
                const sessions = data;
                setChatSessions(sessions);
                if (sessions.length > 0) {
                    const mostRecent = sessions[0];
                    setSelectedSessionId(mostRecent.id);
                    setCurrentSessionId(mostRecent.id);
                    setMessages(mostRecent.berichten || []);
                }
                else {
                    setSelectedSessionId("new");
                    setMessages([]);
                    setCurrentSessionId(null);
                }
            }
            catch (error) {
                toast({ title: "Fout", description: "Kon chatgeschiedenis niet laden.", variant: "destructive" });
            }
        };
        loadChatSessions();
    }, [selectedCourse, user, toast]);
    useEffect(() => {
        if (selectedSessionId === "new") {
            setMessages([]);
            setCurrentSessionId(null);
        }
        else {
            const s = chatSessions.find((x) => x.id === selectedSessionId);
            if (s) {
                setMessages(s.berichten || []);
                setCurrentSessionId(s.id);
            }
        }
    }, [selectedSessionId, chatSessions]);
    // Scroll to bottom when messages change
    useEffect(() => {
        const viewport = viewportRef.current;
        if (viewport)
            viewport.scrollTop = viewport.scrollHeight;
    }, [messages, composerH, tabbarH]);
    // Send message
    const handleSendMessage = async (imageUrl) => {
        if (isGenerating)
            return;
        const hasText = opgave.trim().length > 0;
        const hasImage = !!imageUrl;
        if (!hasText && !hasImage) {
            toast({ title: "Leeg bericht", description: "Typ een vraag of upload een foto.", variant: "destructive" });
            return;
        }
        if (!user) {
            toast({ title: "Niet ingelogd", description: "Log in om de tutor te gebruiken.", variant: "destructive" });
            return;
        }
        if (!selectedCourse) {
            toast({ title: "Geen vak", description: "Kies eerst een vak.", variant: "destructive" });
            return;
        }
        const visibleUserText = hasText ? opgave : "Kun je helpen met deze opgave/foto?";
        const userMessage = { id: Date.now(), sender: "user", text: visibleUserText, imageUrl };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setOpgave("");
        setOcrState({ status: "idle" });
        setIsGenerating(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const history = newMessages.map(m => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text }));
            const context = { vak: selectedCourse, image_url: imageUrl || undefined };
            const resp = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ mode: "studeren", message: visibleUserText, history, context }),
            });
            const rawText = await resp.text();
            if (!resp.ok)
                throw new Error(rawText || `HTTP ${resp.status}`);
            const data = rawText ? JSON.parse(rawText) : {};
            const reply = data?.reply ?? "Oké—kun je iets specifieker vertellen?";
            const aiMessage = { id: Date.now() + 1, sender: "ai", text: reply, audioUrl: data?.audioUrl };
            const finalMessages = [...newMessages, aiMessage];
            setMessages(finalMessages);
            if (currentSessionId) {
                await supabase.from("chatsessies").update({ berichten: finalMessages, updated_at: new Date().toISOString() }).eq("id", currentSessionId);
            }
            else {
                const { data: ins } = await supabase.from("chatsessies")
                    .insert({ user_id: user.id, vak: selectedCourse, berichten: finalMessages })
                    .select("id").single();
                if (ins)
                    setCurrentSessionId(ins.id);
            }
        }
        catch (error) {
            toast({ variant: "destructive", title: "AI fout", description: error.message });
            setMessages(messages);
        }
        finally {
            setIsGenerating(false);
        }
    };
    // ✅ GEFIXT: handleImageUpload met betere error handling & progress
    const handleImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file || !user)
            return;
        setIsUploading(true);
        setOcrState({ status: "idle" });
        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
        const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;
        let publicUrl = "";
        try {
            // Stap 1: Upload foto naar Supabase
            const { error: uploadError } = await supabase.storage.from("uploads").upload(fileName, file);
            if (uploadError)
                throw uploadError;
            const res = supabase.storage.from("uploads").getPublicUrl(fileName);
            publicUrl = res?.data?.publicUrl ?? res?.publicURL;
            if (!publicUrl)
                throw new Error("Public URL niet gevonden");
            // Stap 2: OCR met Tesseract.js - met timeout & progress
            setOcrState({ status: "idle" });
            toast({ title: "OCR bezig...", description: "Tekst wordt herkend (kan 30-60 sec duren)" });
            const imageData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result);
                reader.onerror = () => reject(new Error("File read error"));
                reader.readAsDataURL(file);
            });
            // Tesseract met progress feedback
            const result = await Tesseract.recognize(imageData, "nld", {
                logger: (m) => {
                    if (m.status === "recognizing") {
                        const progress = Math.round(m.progress * 100);
                        setOcrState({ status: "idle", msg: `OCR: ${progress}%` });
                    }
                },
            });
            const recognized = (result.data.text || "").trim();
            if (recognized.length > 0) {
                setOpgave(recognized);
                setOcrState({ status: "ok", chars: recognized.length });
                toast({ title: "✅ Tekst herkend!", description: `${recognized.length} tekens` });
            }
            else {
                setOcrState({ status: "none", msg: "Geen tekst gevonden" });
                toast({ title: "Geen tekst", description: "Foto bevat geen tekst", variant: "destructive" });
            }
        }
        catch (error) {
            console.error("OCR/Upload Error:", error);
            setOcrState({ status: "error", msg: error.message });
            toast({
                variant: "destructive",
                title: "Fout",
                description: error.message || "OCR kon niet starten"
            });
        }
        finally {
            setIsUploading(false);
            if (fileInputRef.current)
                fileInputRef.current.value = "";
        }
    };
    // layout paddings so bubbles don't hide under composer/tabbar
    const bottomSpacer = tabbarH + composerH + 16;
    return (_jsxs("div", { className: "relative min-h-[100dvh] bg-slate-50", children: [_jsx("div", { className: "mx-auto w-full max-w-[1600px] px-2 sm:px-3 md:px-4", style: { paddingBottom: bottomSpacer }, children: _jsx(ScrollArea, { className: "h-[100dvh] pt-2 sm:pt-3 md:pt-4", ref: scrollerRef, children: _jsx("div", { ref: (outer) => {
                            if (!outer)
                                return;
                            const vp = outer.querySelector('div[data-radix-scroll-area-viewport]');
                            if (vp)
                                viewportRef.current = vp;
                        }, children: _jsxs("div", { className: "space-y-3 sm:space-y-4 px-1 pb-4", children: [messages.length === 0 && !isGenerating && (_jsx("div", { className: "text-center text-muted-foreground min-h-[220px] sm:min-h-[280px] flex flex-col items-center justify-center px-2", children: _jsx("p", { className: "font-medium", children: "Kies een vak, typ je vraag of upload een foto van een tekst uit een boek en deze verschijnt vanzelf in het venster, naar gelang van de hoeveelheid tekst kan het wat langer duren." }) })), messages.map((msg) => (_jsx("div", { className: cn("flex", msg.sender === "user" ? "justify-end" : "justify-start"), children: _jsxs("div", { className: cn("max-w-[92%] sm:max-w-[80%] md:max-w-[70%] p-2 sm:p-3 rounded-2xl shadow-sm", msg.sender === "user"
                                            ? "bg-primary text-primary-foreground rounded-br-sm"
                                            : "bg-white border rounded-bl-sm"), children: [_jsx("p", { className: "sr-only", children: msg.sender === "user" ? "Jij" : "AI" }), msg.imageUrl ? (_jsx("img", { src: msg.imageUrl, alt: "Opgave", className: "rounded-md my-2 max-w-full" })) : null, _jsx("p", { className: "whitespace-pre-wrap text-sm sm:text-base leading-6", children: msg.text })] }) }, msg.id))), isGenerating && (_jsx("div", { className: "flex justify-start", children: _jsx("div", { className: "p-2 sm:p-3 rounded-2xl bg-white border shadow-sm rounded-bl-sm", children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-primary animate-bounce" }), _jsx("span", { className: "w-2 h-2 rounded-full bg-primary animate-bounce delay-150" }), _jsx("span", { className: "w-2 h-2 rounded-full bg-primary animate-bounce delay-300" })] }) }) }))] }) }) }) }), _jsx("div", { ref: composerRef, className: "fixed left-0 right-0 z-50", style: { bottom: `calc(${tabbarH}px + env(safe-area-inset-bottom))` }, children: _jsx("div", { className: "mx-auto w-full max-w-[1600px] px-2 sm:px-3 md:px-4", children: _jsx(Card, { className: "shadow-lg border-t border-slate-200 overflow-hidden", children: _jsxs(CardContent, { className: "p-2 sm:p-3", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: handleImageUpload, className: "hidden" }), _jsx(Button, { variant: "outline", size: "icon", onClick: () => fileInputRef.current?.click(), disabled: isUploading || isGenerating, title: "Foto toevoegen", children: isUploading ? _jsx(Loader2, { className: "w-4 h-4 animate-spin" }) : _jsx(Camera, { className: "w-4 h-4" }) }), _jsxs(Select, { value: selectedCourse, onValueChange: setSelectedCourse, children: [_jsx(SelectTrigger, { className: "h-9 w-40", children: _jsx(SelectValue, { placeholder: loadingCourses ? "Vakken…" : "Kies vak" }) }), _jsx(SelectContent, { children: courseOptions.length > 0
                                                        ? courseOptions.map((c) => (_jsx(SelectItem, { value: c, children: c }, c)))
                                                        : _jsx("div", { className: "px-3 py-2 text-sm text-muted-foreground", children: "Geen vakken" }) })] }), _jsxs("div", { className: "ml-auto flex items-center", children: [_jsxs(Dialog, { children: [_jsx(DialogTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", title: "Tips", children: _jsx(Info, { className: "w-5 h-5 text-muted-foreground" }) }) }), _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Snelle tips" }) }), _jsxs("ul", { className: "space-y-3 pt-2 text-sm", children: [_jsxs("li", { children: [_jsx("strong", { children: "\uD83D\uDCF8 Camera-knop" }), " \u2192 Foto uploaden, tekst automatisch herkend!"] }), _jsxs("li", { children: [_jsx("strong", { children: "Foto recht & scherp" }), " \u2192 betere OCR."] }), _jsxs("li", { children: [_jsx("strong", { children: "Eerst keer OCR" }), " \u2192 kan 1-2 minuten duren (workers download)"] }), _jsxs("li", { children: [_jsx("strong", { children: "Vraag concreet" }), " (\"Wat is suburbanisatie?\")."] })] })] })] }), _jsx(Button, { variant: "ghost", size: "icon", onClick: startNewChat, title: "Nieuwe chat", children: _jsx(Repeat, { className: "w-5 h-5 text-muted-foreground" }) })] })] }), _jsx(Label, { htmlFor: "opgave-text", className: "sr-only", children: "Vraag" }), _jsx(Textarea, { id: "opgave-text", ref: textRef, value: opgave, onChange: (e) => setOpgave(e.target.value), rows: 1, onInput: autoResize, placeholder: "Typ je vraag of plak OCR-tekst\u2026", className: "w-full h-auto min-h-[42px] max-h-[132px] overflow-auto resize-none text-[15px]" }), ocrState.status !== "idle" && (_jsxs("div", { className: "mt-1 text-[11px] flex items-center gap-2", children: [ocrState.status === "ok" && (_jsxs("span", { className: "inline-flex items-center gap-1 text-emerald-700", children: [_jsx(CheckCircle2, { className: "w-4 h-4" }), " OCR: ", ocrState.chars, " tekens"] })), ocrState.status === "none" && (_jsxs("span", { className: "inline-flex items-center gap-1 text-amber-700", children: [_jsx(AlertCircle, { className: "w-4 h-4" }), " ", ocrState.msg] })), ocrState.status === "error" && (_jsxs("span", { className: "inline-flex items-center gap-1 text-rose-700", children: [_jsx(AlertCircle, { className: "w-4 h-4" }), " ", ocrState.msg || "OCR fout"] }))] })), _jsx("div", { className: "mt-2", children: _jsxs(Button, { onClick: () => handleSendMessage(), disabled: isGenerating || !selectedCourse || (!opgave.trim()), size: "default", className: "w-full sm:w-auto", title: "Verstuur", children: [_jsx(Send, { className: "w-5 h-5 mr-2" }), "Verstuur"] }) })] }) }) }) })] }));
}
