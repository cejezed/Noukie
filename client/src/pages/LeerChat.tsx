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

interface Message {
  id: number;
  sender: "user" | "ai";
  text: string;
  imageUrl?: string;
  audioUrl?: string;
}
interface ChatSession {
  id: string;
  created_at: string;
  updated_at: string;
  vak: string;
  berichten: Message[];
}

export default function LeerChat() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [opgave, setOpgave] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [ocrState, setOcrState] = useState<{ status: "idle" | "ok" | "none" | "error"; chars?: number; msg?: string }>({ status: "idle" });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("new");

  const [courseOptions, setCourseOptions] = useState<string[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const startNewChat = () => {
    setMessages([]);
    setSelectedSessionId("new");
    setCurrentSessionId(null);
    setOpgave("");
    setOcrState({ status: "idle" });
    toast({ title: "Nieuwe chat gestart" });
  };

  // Auto-resize textarea tot max 6 regels
  const autoResize = () => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 6 * 22;
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  };
  useEffect(() => { autoResize(); }, [opgave]);

  // Vakken laden
  useEffect(() => {
    const loadCourseOptions = async () => {
      if (!user) { setCourseOptions([]); return; }
      setLoadingCourses(true);
      try {
        const { data: courses, error } = await supabase
          .from("courses").select("name")
          .eq("user_id", user.id)
          .order("name", { ascending: true });
        if (error) throw error;
        const names = (courses ?? []).map((c) => c.name).filter(Boolean);
        setCourseOptions(names);
        if (selectedCourse && !names.includes(selectedCourse)) setSelectedCourse("");
      } catch (e: any) {
        console.error(e);
        toast({ title: "Fout", description: "Kon vakken niet laden.", variant: "destructive" });
      } finally { setLoadingCourses(false); }
    };
    loadCourseOptions();
  }, [user, toast, selectedCourse]);

  // Chatsessies laden per vak
  useEffect(() => {
    const loadChatSessions = async () => {
      if (!user || !selectedCourse) { setChatSessions([]); setSelectedSessionId("new"); setMessages([]); return; }
      try {
        const { data, error } = await supabase
          .from("chatsessies").select("*")
          .eq("user_id", user.id)
          .eq("vak", selectedCourse)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        const sessions = data as ChatSession[];
        setChatSessions(sessions);
        if (sessions.length > 0) {
          const mostRecent = sessions[0];
          setSelectedSessionId(mostRecent.id);
          setCurrentSessionId(mostRecent.id);
          setMessages(mostRecent.berichten || []);
        } else {
          setSelectedSessionId("new");
          setMessages([]);
          setCurrentSessionId(null);
        }
      } catch (error) {
        console.error(error);
        toast({ title: "Fout", description: "Kon chatgeschiedenis niet laden.", variant: "destructive" });
      }
    };
    loadChatSessions();
  }, [selectedCourse, user, toast]);

  useEffect(() => {
    if (selectedSessionId === "new") { setMessages([]); setCurrentSessionId(null); }
    else {
      const s = chatSessions.find((x) => x.id === selectedSessionId);
      if (s) { setMessages(s.berichten || []); setCurrentSessionId(s.id); }
    }
  }, [selectedSessionId, chatSessions]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  // Chat sturen
  const handleSendMessage = async (imageUrl?: string) => {
    if (isGenerating) return;
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
    const userMessage: Message = { id: Date.now(), sender: "user", text: visibleUserText, imageUrl };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setOpgave("");
    setOcrState({ status: "idle" });
    setIsGenerating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const history = newMessages.map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      }));
      const context = { vak: selectedCourse, image_url: imageUrl || undefined };

      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mode: "studeren", message: visibleUserText, history, context }),
      });

      const rawText = await resp.text();
      if (!resp.ok) throw new Error(rawText || `HTTP ${resp.status}`);
      const data = rawText ? JSON.parse(rawText) : {};
      const reply: string = data?.reply ?? "Oké—kun je iets specifieker vertellen?";
      const aiMessage: Message = { id: Date.now() + 1, sender: "ai", text: reply, audioUrl: data?.audioUrl };
      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);

      if (currentSessionId) {
        await supabase.from("chatsessies").update({
          berichten: finalMessages,
          updated_at: new Date().toISOString()
        }).eq("id", currentSessionId);
      } else {
        const { data: ins } = await supabase.from("chatsessies")
          .insert({ user_id: user.id, vak: selectedCourse, berichten: finalMessages })
          .select("id").single();
        if (ins) setCurrentSessionId(ins.id);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "AI fout", description: error.message });
      setMessages(messages);
    } finally {
      setIsGenerating(false);
    }
  };

  // Upload + OCR
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    setOcrState({ status: "idle" });

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;

    try {
      const { error: uploadError } = await supabase.storage.from("uploads").upload(fileName, file);
      if (uploadError) throw uploadError;
      const res = supabase.storage.from("uploads").getPublicUrl(fileName) as any;
      const publicUrl: string = res?.data?.publicUrl ?? res?.publicURL;
      if (!publicUrl) throw new Error("Public URL niet gevonden. Check je 'uploads' bucket policy.");

      // OCR proberen (optioneel)
      try {
        const fd = new FormData();
        fd.append("image", file);
        const r = await fetch("/api/ocr", { method: "POST", body: fd });
        if (r.ok) {
          const j = await r.json();
          const recognized = (j?.text || "").trim();
          if (recognized) {
            setOpgave(recognized);
            setOcrState({ status: "ok", chars: recognized.length, msg: "Tekst herkend" });
            toast({ title: "Tekst herkend", description: "Controleer de OCR-tekst en druk op Verstuur." });
          } else {
            setOcrState({ status: "none", msg: "Geen tekst herkend" });
            toast({ title: "Afbeelding geüpload", description: "Geen tekst herkend (je kunt de foto wel versturen)." });
          }
        } else {
          setOcrState({ status: "error", msg: "OCR niet beschikbaar" });
        }
      } catch {
        setOcrState({ status: "error", msg: "OCR fout" });
      }

      // Stuur meteen de foto mee (de herkende tekst staat al in het veld)
      await handleSendMessage(publicUrl);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload mislukt", description: error.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ============= UI =============
  return (
    <div
      className="
        flex flex-col min-h-[100dvh] p-2 sm:p-3 md:p-4 bg-slate-50
        pb-[calc(92px+env(safe-area-inset-bottom))]
      "
    >
      {/* max-w op laptop 1600px, minimale zijkant padding */}
      <div className="mx-auto w-full max-w-[1600px] px-2 sm:px-3 md:px-4">
        <ScrollArea className="flex-1 mb-2 sm:mb-3 md:mb-4 p-2 sm:p-3 md:p-4 border rounded-lg bg-white" ref={scrollAreaRef}>
          <div className="space-y-3 sm:space-y-4">
            {messages.length === 0 && !isGenerating && (
              <div className="text-center text-muted-foreground min-h-[260px] sm:min-h-[300px] flex flex-col items-center justify-center px-2">
                <p className="font-medium">Kies een vak, stel je vraag of upload een foto (OCR).</p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[95%] sm:max-w-[85%] md:max-w-[75%] p-2 sm:p-3 rounded-lg shadow-sm",
                  msg.sender === "user" ? "bg-primary text-primary-foreground" : "bg-background border"
                )}>
                  <p className="font-bold text-xs mb-1">{msg.sender === "user" ? "Jij" : "AI Tutor"}</p>
                  {msg.imageUrl && <img src={msg.imageUrl} alt="Opgave" className="rounded-md my-2 max-w-full" />}
                  <p className="whitespace-pre-wrap text-sm sm:text-base">{msg.text}</p>
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex justify-start">
                <div className="p-2 sm:p-3 rounded-lg bg-background border shadow-sm">
                  <p className="font-bold text-xs mb-1">AI Tutor</p>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce delay-150" />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce delay-300" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Sticky composer — compact, volle breedte, knoppen rechts naast Verstuur */}
      <div
        className="
          fixed bottom-[calc(60px+env(safe-area-inset-bottom))] left-0 right-0 z-40
          md:static md:bottom-auto
          bg-slate-50/90 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60
          px-2 sm:px-3 md:px-4
        "
      >
        <div className="mx-auto w-full max-w-[1600px]">
          <Card className="mt-1 md:mt-2 flex-shrink-0 overflow-hidden">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-end gap-2">
                {/* Foto + vakkeuze links, compact */}
                <div className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isGenerating}
                    title="Foto toevoegen"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  </Button>

                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger className="w-36 h-9">
                      <SelectValue placeholder={loadingCourses ? "Vakken…" : "Kies vak"} />
                    </SelectTrigger>
                    <SelectContent>
                      {courseOptions.length > 0
                        ? courseOptions.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))
                        : <div className="px-3 py-2 text-sm text-muted-foreground">Geen vakken</div>}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tekstveld in het midden – zo breed mogelijk */}
                <div className="flex-1 min-w-[160px]">
                  <Label htmlFor="opgave-text" className="sr-only">Vraag</Label>
                  <Textarea
                    id="opgave-text"
                    ref={textRef}
                    value={opgave}
                    onChange={(e) => setOpgave(e.target.value)}
                    rows={1}
                    onInput={autoResize}
                    placeholder="Typ je vraag of plak OCR-tekst…"
                    className="w-full h-auto min-h-[40px] max-h-[132px] overflow-auto resize-none text-sm sm:text-base"
                  />
                  {/* OCR-status compact */}
                  {ocrState.status !== "idle" && (
                    <div className="mt-1 text-[11px] flex items-center gap-2">
                      {ocrState.status === "ok" && (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" /> OCR: {ocrState.chars} tekens
                        </span>
                      )}
                      {ocrState.status === "none" && (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertCircle className="w-4 h-4" /> Geen tekst herkend
                        </span>
                      )}
                      {ocrState.status === "error" && (
                        <span className="inline-flex items-center gap-1 text-rose-700">
                          <AlertCircle className="w-4 h-4" /> {ocrState.msg || "OCR niet beschikbaar"}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Rechter cluster: Verstuur + i + pijl (nieuwe chat) */}
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={isGenerating || !selectedCourse || (!opgave.trim())}
                    size="default"
                    className="shrink-0"
                    title="Verstuur"
                  >
                    <Send className="w-5 h-5 mr-2" />
                    Verstuur
                  </Button>

                  {/* i-knop (info) direct naast Verstuur */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" title="Tips">
                        <Info className="w-5 h-5 text-muted-foreground" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Snelle tips</DialogTitle></DialogHeader>
                      <ul className="space-y-3 pt-2 text-sm">
                        <li><strong>Foto recht & scherp</strong> → betere OCR.</li>
                        <li><strong>Wees concreet</strong> (“Wat is suburbanisatie?”).</li>
                        <li><strong>Vraag om oefenvragen</strong> na de uitleg.</li>
                      </ul>
                    </DialogContent>
                  </Dialog>

                  {/* Pijlknop alleen als hij de reset-functie heeft */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={startNewChat}
                    title="Nieuwe chat"
                  >
                    <Repeat className="w-5 h-5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
