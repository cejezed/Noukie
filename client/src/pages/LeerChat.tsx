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
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  // 👇 dynamische offset voor tabbar-hoogte
  const [tabbarH, setTabbarH] = useState<number>(64); // fallback
  const [composerH, setComposerH] = useState<number>(0);
  const composerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // probeer een element te vinden dat je tabbar is (pas evt. selector aan)
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

  // auto-resize textarea (1–6 regels)
  const autoResize = () => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 6 * 22;
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  };
  useEffect(() => { autoResize(); }, [opgave]);

  // vakken
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

  // sessies
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

  // scrol altijd naar onder
  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, composerH, tabbarH]);

  // chat sturen
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

      const history = newMessages.map(m => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text }));
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
        await supabase.from("chatsessies").update({ berichten: finalMessages, updated_at: new Date().toISOString() }).eq("id", currentSessionId);
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

  // upload + OCR
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
          }
        } else {
          setOcrState({ status: "error", msg: "OCR niet beschikbaar" });
        }
      } catch {
        setOcrState({ status: "error", msg: "OCR fout" });
      }

      await handleSendMessage(publicUrl);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload mislukt", description: error.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ============= UI =============
  // bereken een veilige ondermarge voor de scroller, zodat bubbles niet onder de composer/tabbar vallen
  const bottomSpacer = tabbarH + composerH + 16; // 16px extra lucht

  return (
    <div className="relative min-h-[100dvh] bg-slate-50">
      {/* SCROLLER (zoals WhatsApp): volledige hoogte, onderaan extra ruimte */}
      <div
        className="mx-auto w-full max-w-[1600px] px-2 sm:px-3 md:px-4"
        style={{ paddingBottom: bottomSpacer }}
      >
        <ScrollArea className="h-[100dvh] pt-2 sm:pt-3 md:pt-4">
          <div ref={(el) => { if (el) scrollViewportRef.current = el.querySelector('div[data-radix-scroll-area-viewport]') as HTMLDivElement; }}>
            <div className="space-y-3 sm:space-y-4 px-1 pb-4">
              {messages.length === 0 && !isGenerating && (
                <div className="text-center text-muted-foreground min-h-[220px] sm:min-h-[280px] flex flex-col items-center justify-center px-2">
                  <p className="font-medium">Kies een vak, typ je vraag of upload een foto — de rest voelt als WhatsApp 🙂</p>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[92%] sm:max-w-[80%] md:max-w-[70%] p-2 sm:p-3 rounded-2xl shadow-sm",
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-white border rounded-bl-sm"
                  )}>
                    <p className="sr-only">{msg.sender === "user" ? "Jij" : "AI"}</p>
                    {msg.imageUrl && <img src={msg.imageUrl} alt="Opgave" className="rounded-md my-2 max-w-full" />}
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
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* FIXED COMPOSER — boven de tabbar, 100% breed, knop ONDER het veld */}
      <div
        ref={composerRef}
        className="fixed left-0 right-0 z-50"
        style={{ bottom: `calc(${tabbarH}px + env(safe-area-inset-bottom))` }}
      >
        <div className="mx-auto w-full max-w-[1600px] px-2 sm:px-3 md:px-4">
          <Card className="shadow-lg border-t border-slate-200 overflow-hidden">
            <CardContent className="p-2 sm:p-3">
              {/* bovenste rij: foto + vak (klein) */}
              <div className="flex items-center gap-2 mb-2">
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
                        <li><strong>Foto recht & scherp</strong> → betere OCR.</li>
                        <li><strong>Vraag concreet</strong> (“Wat is suburbanisatie?”).</li>
                        <li><strong>Oefenvragen</strong> na de uitleg helpen checken.</li>
                      </ul>
                    </DialogContent>
                  </Dialog>

                  <Button variant="ghost" size="icon" onClick={startNewChat} title="Nieuwe chat">
                    <Repeat className="w-5 h-5 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {/* vraagveld: 100% breed */}
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

              {/* ocr status (compact) */}
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

              {/* knop ONDER het veld, volle breedte op mobiel */}
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
