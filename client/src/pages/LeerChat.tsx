import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Send, Camera, Repeat, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import UploadOcrExplain from "@/features/explain/UploadOcrExplain";

interface Message {
  id: number;
  sender: "user" | "ai";
  text: string;
  poging?: string;
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

export default function UitlegTab() {
  return (
    <div className="space-y-4">
      <UploadOcrExplain />
    </div>
  );
}

export default function LeerChat() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [opgave, setOpgave] = useState("");
  const [poging, setPoging] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("new");

  const [courseOptions, setCourseOptions] = useState<string[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startNewChat = () => {
    setMessages([]);
    setSelectedSessionId("new");
    setCurrentSessionId(null);
    setOpgave("");
    setPoging("");
    toast({ title: "Nieuwe chat gestart", description: "Je kunt nu een nieuwe vraag stellen." });
  };

  // === Vakken laden ===
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
        const courseNames = (courses ?? []).map((c) => c.name).filter(Boolean);
        setCourseOptions(courseNames);
        if (selectedCourse && !courseNames.includes(selectedCourse)) setSelectedCourse("");
      } catch (e: any) {
        console.error("Kon vakken niet laden:", e);
        toast({ title: "Fout", description: "Kon de lijst met vakken niet laden.", variant: "destructive" });
      } finally { setLoadingCourses(false); }
    };
    loadCourseOptions();
  }, [user, toast, selectedCourse]);

  // === Chatsessies laden ===
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
          const mostRecentSession = sessions[0];
          setSelectedSessionId(mostRecentSession.id);
          setCurrentSessionId(mostRecentSession.id);
          setMessages(mostRecentSession.berichten || []);
        } else {
          setSelectedSessionId("new");
          setMessages([]);
          setCurrentSessionId(null);
        }
      } catch (error) {
        console.error("Kon chatgeschiedenis niet laden:", error);
        toast({ title: "Fout", description: "Kon chatgeschiedenis niet laden.", variant: "destructive" });
      }
    };
    loadChatSessions();
  }, [selectedCourse, user, toast]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  // === Chat sturen ===
  const handleSendMessage = async (imageUrl?: string) => {
    if (isGenerating) return;
    const hasText = opgave.trim().length > 0;
    const hasImage = !!imageUrl;
    if (!hasText && !hasImage) {
      toast({ title: "Leeg bericht", description: "Typ een opgave of upload een afbeelding.", variant: "destructive" });
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
    const userMessage: Message = {
      id: Date.now(),
      sender: "user",
      text: visibleUserText,
      poging: poging || undefined,
      imageUrl,
    };
    const newMessagesList = [...messages, userMessage];
    setMessages(newMessagesList);
    setOpgave("");
    setPoging("");
    setIsGenerating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const history = newMessagesList.map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const context = { vak: selectedCourse, poging: poging || undefined, image_url: imageUrl || undefined };

      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mode: "studeren", message: visibleUserText, history, context }),
      });

      const rawText = await resp.text();
      if (!resp.ok) throw new Error(rawText || `HTTP ${resp.status}`);
      const data = rawText ? JSON.parse(rawText) : {};
      const reply: string = data?.reply ?? "Oké—kun je iets specifieker vertellen?";
      const aiMessage: Message = { id: Date.now() + 1, sender: "ai", text: reply, audioUrl: data?.audioUrl };
      const finalMessagesList = [...newMessagesList, aiMessage];
      setMessages(finalMessagesList);

      if (currentSessionId) {
        await supabase.from("chatsessies").update({
          berichten: finalMessagesList,
          updated_at: new Date().toISOString()
        }).eq("id", currentSessionId);
      } else {
        const { data: ins } = await supabase.from("chatsessies")
          .insert({ user_id: user.id, vak: selectedCourse, berichten: finalMessagesList })
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

  // === Image upload (+ optionele OCR) ===
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;
    try {
      // 1) Upload naar public bucket
      const { error: uploadError } = await supabase.storage.from("uploads").upload(fileName, file);
      if (uploadError) throw uploadError;
      const res = supabase.storage.from("uploads").getPublicUrl(fileName) as any;
      const publicUrl: string = res?.data?.publicUrl ?? res?.publicURL;
      if (!publicUrl || !publicUrl.includes("/public/")) throw new Error("Bucket niet public of URL ongeldig.");

      // 2) Probeer OCR (optioneel) – fallback: als /api/ocr ontbreekt of faalt, sturen we gewoon de foto mee
      let recognized = "";
      try {
        const fd = new FormData();
        fd.append("image", file);
        const r = await fetch("/api/ocr", { method: "POST", body: fd });
        if (r.ok) {
          const j = await r.json();
          if (j?.text?.trim()) recognized = j.text.trim();
        }
      } catch {
        // OCR niet beschikbaar of faalt → negeren
      }

      if (recognized) {
        setOpgave(recognized);
        toast({
          title: "Tekst herkend",
          description: "De herkende tekst staat nu in het tekstvak. Controleer en druk op Verstuur.",
        });
      } else {
        toast({
          title: "Afbeelding geüpload",
          description: "Geen tekst herkend (of OCR niet actief). Je kunt de foto zo versturen.",
        });
      }

      // 3) Stuur bericht met image + (optioneel) herkende tekst
      await handleSendMessage(publicUrl);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload mislukt", description: error.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ================== UI ==================
  return (
    <div
      className="
        flex flex-col min-h-[100dvh] p-4 bg-slate-50
        pb-[calc(110px+env(safe-area-inset-bottom))]  /* ruimte voor sticky composer + mobiele tabbar */
      "
    >
      {/* responsieve breedte zoals Layout */}
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8">
        <ScrollArea className="flex-1 mb-4 p-4 border rounded-lg bg-white" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.length === 0 && !isGenerating && (
              <div className="text-center text-muted-foreground min-h-[420px] flex flex-col items-center justify-center px-4">
                <p className="font-medium text-lg">Welkom bij de AI Tutor!</p>
                <p className="text-sm mt-1">Kies een vak en stel je vraag.</p>
                <p className="text-sm mt-2 text-blue-700">
                  Ik leg stap voor stap uit, maak een korte samenvatting en geef oefenvragen 🎓
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-xl p-3 rounded-lg shadow-sm", msg.sender === "user" ? "bg-primary text-primary-foreground" : "bg-background border")}>
                  <p className="font-bold text-sm mb-1">{msg.sender === "user" ? "Jij" : "AI Tutor"}</p>
                  {msg.imageUrl && <img src={msg.imageUrl} alt="Opgave" className="rounded-md my-2 max-w-xs" />}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex justify-start">
                <div className="p-3 rounded-lg bg-background border shadow-sm">
                  <p className="font-bold text-sm mb-1">AI Tutor</p>
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

      {/* Sticky composer: altijd boven de mobiele tabbar en safe-area */}
      <div
        className="
          fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-40
          md:static md:bottom-auto md:left-auto md:right-auto
          bg-slate-50/90 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60
          px-4
        "
      >
        <div className="mx-auto w-full max-w-7xl">
          <Card className="mt-4 flex-shrink-0 overflow-hidden">
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Stel je vraag</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={startNewChat} title="Nieuwe chat">
                  <Repeat className="w-5 h-5 text-muted-foreground" />
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" title="Tips voor goede hulp">
                      <Info className="w-5 h-5 text-muted-foreground" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Tips voor Goede Hulp</DialogTitle>
                    </DialogHeader>
                    <ul className="space-y-3 pt-2 text-sm">
                      <li>
                        <strong>1. Stel een duidelijke vraag:</strong> Hoe specifieker je vraag, hoe beter de uitleg.
                        Bijvoorbeeld: “Hoe bereken ik de omtrek van een cirkel?” i.p.v. “Ik snap het niet”.
                      </li>
                      <li>
                        <strong>2. Laat zien wat je al hebt geprobeerd:</strong> Schrijf je eigen stappen of ideeën op.
                        De AI kan dan gericht feedback geven en je verder helpen.
                      </li>
                      <li>
                        <strong>3. Gebruik een foto:</strong> Upload een duidelijke foto van je opgave of aantekeningen.
                        Handig bij lastige sommen of tekstvragen.
                      </li>
                      <li>
                        <strong>4. Oefenvragen:</strong> Vraag na de uitleg om extra oefenvragen.
                        De AI kan oefenopgaven bedenken om te checken of je het snapt.
                      </li>
                      <li>
                        <strong>5. Ezelsbruggetjes & tips:</strong> De AI kan handige trucjes geven om iets te onthouden,
                        of de stof in stappen uitleggen.
                      </li>
                      <li className="text-xs text-blue-800 p-2 bg-blue-50 rounded-md">
                        <strong>Let op:</strong> De uitlegcoach werkt op basis van jouw vraag en foto. Hoe beter je input,
                        hoe beter de hulp 🎓
                      </li>
                    </ul>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-0 space-y-4 pb-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="opgave-text">Opgave of Begrip</Label>
                  <Textarea
                    id="opgave-text"
                    value={opgave}
                    onChange={(e) => setOpgave(e.target.value)}
                    rows={4}
                    placeholder="Typ of plak hier de opgave..."
                  />
                </div>
                <div>
                  <Label htmlFor="poging-text">Mijn eigen poging (optioneel)</Label>
                  <Textarea
                    id="poging-text"
                    value={poging}
                    onChange={(e) => setPoging(e.target.value)}
                    rows={4}
                    placeholder="Wat heb je zelf al geprobeerd?"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                  <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isGenerating}>
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  </Button>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={loadingCourses ? "Vakken laden..." : "Kies een vak"} />
                    </SelectTrigger>
                    <SelectContent>
                      {courseOptions.length > 0
                        ? courseOptions.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))
                        : <div className="px-3 py-2 text-sm text-muted-foreground">Geen vakken gevonden</div>}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => handleSendMessage()}
                  disabled={isGenerating || !selectedCourse || (!opgave.trim() && !(fileInputRef.current?.files?.length))}
                  size="lg"
                  className="shrink-0 sm:w-auto w-full"
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
