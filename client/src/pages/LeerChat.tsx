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

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const [tabbarH, setTabbarH] = useState<number>(64);
  const [composerH, setComposerH] = useState<number>(0);
  const composerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const tb = document.querySelector('[data-tabbar], nav[role="tablist"], footer[data-bottom-nav]');
    const update = () => setTabbarH(tb instanceof HTMLElement ? tb.offsetHeight : 64);
    update();
    const ro = new ResizeObserver(update);
    if (tb instanceof HTMLElement) ro.observe(tb);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setComposerH(composerRef.current?.offsetHeight || 0);
    update();
    const ro = new ResizeObserver(update);
    if (composerRef.current) ro.observe(composerRef.current);
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

  const autoResize = () => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 6 * 22;
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  };
  useEffect(() => { autoResize(); }, [opgave]);

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
        toast({ title: "Fout", description: "Kon vakken niet laden.", variant: "destructive" });
      } finally { setLoadingCourses(false); }
    };
    loadCourseOptions();
  }, [user, toast, selectedCourse]);

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
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, composerH, tabbarH]);

  const handleSendMessage = async (imageUrl?: string) => {
    if (isGenerating) return;
    const hasText = opgave.trim().length > 0;
    const hasImage = !!imageUrl;
    if (!hasText && !hasImage) {
      toast({ title: "Leeg bericht", description: "Typ een vraag of upload een foto.", variant: "destructive" });
      return;
    }
    if (!user) { toast({ title: "Niet ingelogd", description: "Log in om de tutor te gebruiken.", variant: "destructive" }); return; }
    if (!selectedCourse) { toast({ title: "Geen vak", description: "Kies eerst een vak.", variant: "destructive" }); return; }

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

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: visibleUserText,
          imageUrl: imageUrl || null,
          chatSessionId: currentSessionId,
          vak: selectedCourse,
          userId: user.id,
        }),
      });

      if (!response.ok) throw new Error("Antwoord niet ontvangen");

      const aiMessage: Message = {
        id: Date.now() + 1,
        sender: "ai",
        text: await response.text(),
      };

      setMessages([...newMessages, aiMessage]);

      if (!currentSessionId) {
        const { data: newSession, error } = await supabase
          .from("chatsessies")
          .insert([{ user_id: user.id, vak: selectedCourse, berichten: [userMessage, aiMessage] }])
          .select()
          .single();

        if (!error && newSession) {
          setCurrentSessionId(newSession.id);
        }
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fout", description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ VOLLEDIG WERKENDE IMAGEUPLOAD MET OCR
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Stap 1: Maak preview/data URL van de afbeelding
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const imageData = e.target?.result as string;

        try {
          // Stap 2: OCR uitvoeren met Tesseract.js
          setOcrState({ status: "idle" });
          
          const result = await Tesseract.recognize(
            imageData,
            'nld', // Nederlands
            {
              logger: (m) => {
                if (m.status === 'recognizing') {
                  // Optioneel: toon progress
                }
              }
            }
          );

          const extractedText = result.data.text.trim();

          if (extractedText.length > 0) {
            // ✅ Zet OCR-tekst in het tekstveld
            setOpgave(extractedText);
            setOcrState({ status: "ok", chars: extractedText.length });
            toast({ title: "OCR geslaagd", description: `${extractedText.length} tekens herkend` });
          } else {
            setOcrState({ status: "none", msg: "Geen tekst herkend in foto" });
            toast({ title: "Geen tekst gevonden", description: "Probeer een scherpere foto", variant: "destructive" });
          }

          // Stap 3: Upload afbeelding naar Supabase als je dat wilt
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("chat-images")
            .upload(`uploads/${Date.now()}-${file.name}`, file);

          if (!uploadError && uploadData) {
            const { data: publicUrl } = supabase.storage
              .from("chat-images")
              .getPublicUrl(uploadData.path);
            
            // Optioneel: stuur meteen bericht met foto
            // await handleSendMessage(publicUrl.publicUrl);
          }

        } catch (ocrError) {
          console.error("OCR Error:", ocrError);
          setOcrState({ status: "error", msg: "OCR niet beschikbaar" });
          toast({ title: "OCR fout", description: "Kon tekst niet herkennen", variant: "destructive" });
        }
      };

      reader.readAsDataURL(file);

    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload mislukt", description: error.message });
      setOcrState({ status: "error", msg: error.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const bottomSpacer = tabbarH + composerH + 16;

  return (
    <div className="relative min-h-[100dvh] bg-slate-50">
      <div className="mx-auto w-full max-w-[1600px] px-2 sm:px-3 md:px-4" style={{ paddingBottom: bottomSpacer }}>
        <ScrollArea className="h-[100dvh] pt-2 sm:pt-3 md:pt-4" ref={scrollerRef}>
          <div ref={(outer) => {
            if (!outer) return;
            const vp = outer.querySelector('div[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
            if (vp) viewportRef.current = vp;
          }}>
            <div className="space-y-3 sm:space-y-4 px-1 pb-4">
              {messages.length === 0 && !isGenerating && (
                <div className="text-center text-muted-foreground min-h-[220px] sm:min-h-[280px] flex flex-col items-center justify-center px-2">
                  <p className="font-medium">Kies een vak, typ je vraag of upload een foto van de tekst die je moet leren.</p>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[92%] sm:max-w-[80%] md:max-w-[70%] p-2 sm:p-3 rounded-2xl shadow-sm",
                      msg.sender === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-white border rounded-bl-sm"
                    )}
                  >
                    <p className="sr-only">{msg.sender === "user" ? "Jij" : "AI"}</p>
                    {msg.imageUrl ? (
                      <img src={msg.imageUrl} alt="Opgave" className="rounded-md my-2 max-w-full" />
                    ) : null}
                    <p className="whitespace-pre-wrap text-sm sm:text-base leading-6">{msg.text}</p>
                  </div>
                </div>
              ))}

              {isGenerating && (
                <div className="flex justify-start">
                  <div className="p-2 sm:p-3 rounded-2xl bg-white border shadow-sm rounded-bl-sm">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce delay-150" />
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce delay-300" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      <div ref={composerRef} className="fixed left-0 right-0 z-50" style={{ bottom: `calc(${tabbarH}px + env(safe-area-inset-bottom))` }}>
        <div className="mx-auto w-full max-w-[1600px] px-2 sm:px-3 md:px-4">
          <Card className="shadow-lg border-t border-slate-200 overflow-hidden">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-2 mb-2">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isGenerating}
                  title="Foto toevoegen (OCR)"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                </Button>

                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue placeholder={loadingCourses ? "Vakken…" : "Kies vak"} />
                  </SelectTrigger>
                  <SelectContent>
                    {courseOptions.length > 0
                      ? courseOptions.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))
                      : <div className="px-3 py-2 text-sm text-muted-foreground">Geen vakken</div>}
                  </SelectContent>
                </Select>

                <div className="ml-auto flex items-center">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" title="Tips">
                        <Info className="w-5 h-5 text-muted-foreground" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Snelle tips</DialogTitle></DialogHeader>
                      <ul className="space-y-3 pt-2 text-sm">
                        <li><strong>📸 Camera-knop</strong> → Foto van boek uploaden, tekst automatisch herkend!</li>
                        <li><strong>Foto recht & scherp</strong> → betere OCR.</li>
                        <li><strong>Vraag concreet</strong> ("Wat is suburbanisatie?").</li>
                        <li><strong>Oefenvragen</strong> helpen checken.</li>
                      </ul>
                    </DialogContent>
                  </Dialog>

                  <Button variant="ghost" size="icon" onClick={startNewChat} title="Nieuwe chat">
                    <Repeat className="w-5 h-5 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              <Label htmlFor="opgave-text" className="sr-only">Vraag</Label>
              <Textarea
                id="opgave-text"
                ref={textRef}
                value={opgave}
                onChange={(e) => setOpgave(e.target.value)}
                rows={1}
                onInput={autoResize}
                placeholder="Typ je vraag of plak OCR-tekst…"
                className="w-full h-auto min-h-[42px] max-h-[132px] overflow-auto resize-none text-[15px]"
              />

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

              <div className="mt-2">
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={isGenerating || !selectedCourse || (!opgave.trim())}
                  size="default"
                  className="w-full sm:w-auto"
                  title="Verstuur"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Verstuur
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}