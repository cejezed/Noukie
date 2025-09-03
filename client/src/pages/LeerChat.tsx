import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Send, Mic, Camera, Play, Pause, Repeat, Info, Loader2 } from "lucide-react";
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

interface Message {
  id: number;
  sender: "user" | "ai";
  text: string;
  poging?: string;
  imageUrl?: string;
  audioUrl?: string;
}

export default function LeerChat() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [opgave, setOgave] = useState("");
  const [poging, setPoging] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [courseOptions, setCourseOptions] = useState<string[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const [audioStatus, setAudioStatus] = useState<"idle" | "playing" | "paused">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Vakken laden: 2-staps aanpak + fallback (schedule.title)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadCourseOptions = async () => {
      if (!user) { setCourseOptions([]); return; }
      setLoadingCourses(true);
      try {
        // Stap 1: lees alle roosterregels voor deze gebruiker
        const { data: sched, error: sErr } = await supabase
          .from("schedule")
          .select("course_id, title")
          .eq("user_id", user.id);

        if (sErr) throw sErr;

        const courseIds = Array.from(
          new Set((sched ?? []).map(r => r.course_id).filter(Boolean))
        ) as string[];

        // Stap 2: haal namen op uit courses
        let names: string[] = [];
        if (courseIds.length) {
          const { data: courses, error: cErr } = await supabase
            .from("courses")
            .select("name")
            .in("id", courseIds)
            .order("name", { ascending: true });
          if (cErr) throw cErr;
          names = (courses ?? []).map(c => c.name).filter(Boolean);
        }

        // Fallback: titles zonder gekoppelde course_id
        const titles = Array.from(
          new Set(
            (sched ?? [])
              .filter(r => !r.course_id && r.title)
              .map(r => r.title as string)
          )
        );

        const merged = Array.from(new Set([...names, ...titles]))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "nl"));

        setCourseOptions(merged);

        // Reset selectie als huidige keuze niet (meer) bestaat
        if (selectedCourse && !merged.includes(selectedCourse)) {
          setSelectedCourse("");
        }
      } catch (e) {
        console.error("Kon vakopties niet laden:", e);
        setCourseOptions([]);
      } finally {
        setLoadingCourses(false);
      }
    };

    loadCourseOptions();
  }, [user, selectedCourse]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Chatgeschiedenis laden (let op: tabelnaam is case-sensitive: "Chatsessies")
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!user || !selectedCourse) {
        setMessages([]);
        setCurrentSessionId(null);
        return;
      }

      const { data, error } = await supabase
        .from("Chatsessies")
        .select("id, berichten")
        .eq("user_id", user.id)
        .eq("vak", selectedCourse)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Kon chatgeschiedenis niet laden:", error);
        setMessages([]);
        setCurrentSessionId(null);
        return;
      }

      if (data?.berichten) {
        setMessages(data.berichten as Message[]);
        setCurrentSessionId(data.id);
      } else {
        setMessages([]);
        setCurrentSessionId(null);
      }
    };

    loadChatHistory();
  }, [selectedCourse, user]);

  // Altijd naar onderen scrollen bij nieuwe berichten
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  // Veilige fetch helper: verwacht JSON en toont duidelijke errors
  async function safeJsonFetch(url: string, init?: RequestInit) {
    const res = await fetch(url, init);
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status} ${res.statusText} • ${text.slice(0, 200)}`);
    }
    if (!ct.includes("application/json")) {
      const text = await res.text();
      throw new Error(`Expected JSON but got "${ct}". Body: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  // Vraag versturen (met optionele imageUrl)
  const handleSendMessage = async (imageUrl?: string) => {
    if ((!opgave.trim() && !imageUrl) || isGenerating || !user || !selectedCourse) return;

    const userMessage: Message = {
      id: Date.now(),
      sender: "user",
      text: opgave || (imageUrl ? "Kun je me helpen met deze afbeelding?" : ""),
      poging,
      imageUrl,
    };
    const newMessagesList = [...messages, userMessage];
    setMessages(newMessagesList);
    setOgave("");
    setPoging("");
    setIsGenerating(true);

    try {
      const { aiResponseText, aiAudioUrl } = await safeJsonFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opgave: userMessage.text,
          poging,
          course: selectedCourse,
          imageUrl,
        }),
      });

      const aiMessage: Message = {
        id: Date.now() + 1,
        sender: "ai",
        text: aiResponseText,
        audioUrl: aiAudioUrl,
      };

      const finalMessagesList = [...newMessagesList, aiMessage];
      setMessages(finalMessagesList);

      // Opslaan in Supabase (case-sensitive tabelnaam!)
      if (currentSessionId) {
        const { error: upErr } = await supabase
          .from("Chatsessies")
          .update({ berichten: finalMessagesList, updated_at: new Date().toISOString() })
          .eq("id", currentSessionId);
        if (upErr) throw upErr;
      } else {
        const { data: ins, error: insErr } = await supabase
          .from("Chatsessies")
          .insert({ user_id: user.id, vak: selectedCourse, berichten: finalMessagesList })
          .select("id")
          .single();
        if (insErr) throw insErr;
        if (ins) setCurrentSessionId(ins.id);
      }
    } catch (error: any) {
      console.error("Fout in handleSendMessage:", error);
      toast({
        variant: "destructive",
        title: "Oeps! Er ging iets mis.",
        description: String(error?.message ?? error),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Afbeelding uploaden
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    const fileName = `${user.id}/${Date.now()}-${file.name}`;

    try {
      const { error: uploadError } = await supabase.storage.from("uploads").upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("uploads").getPublicUrl(fileName);
      await handleSendMessage(data.publicUrl);
    } catch (error: any) {
      console.error("Fout bij het uploaden:", error);
      toast({ variant: "destructive", title: "Upload mislukt", description: String(error?.message ?? error) });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Audio-playback
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === "ai" && lastMessage.audioUrl) {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(lastMessage.audioUrl);
      audioRef.current = audio;
      audio.play().catch(e => console.error("Audio kon niet automatisch afspelen:", e));
      setAudioStatus("playing");
      audio.onended = () => setAudioStatus("idle");
      audio.onpause = () => {
        if (!audio.ended) setAudioStatus("paused");
      };
    }
  }, [messages]);

  const handleAudioControl = () => {
    if (audioRef.current) {
      if (audioStatus === "playing") audioRef.current.pause();
      else {
        audioRef.current.play();
        setAudioStatus("playing");
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] p-4 bg-slate-50" data-testid="page-leer-chat">
      <ScrollArea className="flex-grow mb-4 p-4 border rounded-lg bg-white" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.length === 0 && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
              <p className="font-medium text-lg mb-2">Welkom bij de AI Tutor!</p>
              <p className="text-sm">Kies een vak en stel je vraag om te beginnen.</p>
              <p className="text-sm">Hier komt je gesprek te staan.</p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-xl p-3 rounded-lg shadow-sm",
                  msg.sender === "user" ? "bg-primary text-primary-foreground" : "bg-background border"
                )}
              >
                <p className="font-bold text-sm mb-1">{msg.sender === "user" ? "Jij" : "AI Tutor"}</p>
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="Geüploade opgave"
                    className="rounded-md my-2 max-w-xs cursor-pointer"
                    onClick={() => window.open(msg.imageUrl, "_blank")}
                  />
                )}
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.poging && (
                  <p className="text-xs italic mt-2 border-t border-t-white/20 pt-2">Mijn poging: "{msg.poging}"</p>
                )}
                {msg.sender === "ai" && msg.audioUrl && (
                  <div className="mt-3">
                    <Button
                      onClick={handleAudioControl}
                      size="icon"
                      variant={msg.sender === "user" ? "secondary" : "outline"}
                      className="h-8 w-8"
                    >
                      {audioStatus === "playing" && <Pause className="w-4 h-4" />}
                      {audioStatus === "paused" && <Play className="w-4 h-4" />}
                      {audioStatus === "idle" && <Repeat className="w-4 h-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="flex justify-start">
              <div className="max-w-md p-3 rounded-lg bg-background border shadow-sm">
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Stel je vraag</CardTitle>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Info className="w-5 h-5 text-muted-foreground" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>💡 Tips voor Goede Hulp</DialogTitle>
              </DialogHeader>
              <ul className="space-y-3 pt-2 text-sm">
                <li className="flex items-start">
                  <span className="mr-2">1.</span>
                  <strong>Wees Specifiek:</strong> Vraag niet "Ik snap het niet", maar "Hoe bereken je de omtrek van een cirkel?".
                </li>
                <li className="flex items-start">
                  <span className="mr-2">2.</span>
                  <strong>Laat je Werk Zien:</strong> De beste hulp krijg je als je invult wat je zelf al hebt geprobeerd.
                </li>
                <li className="flex items-start">
                  <span className="mr-2">3.</span>
                  <strong>Gebruik een Foto:</strong> Maak een duidelijke foto van een som, diagram of alinea in je boek.
                </li>
                <li className="flex items-start text-xs text-amber-800 p-2 bg-amber-50 rounded-md mt-2">
                  <strong className="mr-1">Let op:</strong> Ik ben een AI. Controleer belangrijke antwoorden altijd met je boek of docent.
                </li>
              </ul>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="opgave-text">Opgave of Begrip</Label>
              <Textarea
                id="opgave-text"
                value={opgave}
                onChange={e => setOgave(e.target.value)}
                placeholder="Typ of plak hier de opgave..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="poging-text">Mijn eigen poging (optioneel)</Label>
              <Textarea
                id="poging-text"
                value={poging}
                onChange={e => setPoging(e.target.value)}
                placeholder="Wat heb je zelf al geprobeerd?"
                rows={3}
              />
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
              <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isGenerating}>
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="icon" disabled>
                <Mic className="w-4 h-4" />
              </Button>

              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={loadingCourses ? "Vakken laden..." : "Kies een vak"} />
                </SelectTrigger>
                <SelectContent>
                  {courseOptions.length === 0 && !loadingCourses && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Geen vakken gevonden</div>
                  )}
                  {courseOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => handleSendMessage()} disabled={(!opgave.trim() && !isUploading) || isGenerating || !selectedCourse} size="lg">
              <Send className="w-5 h-5 mr-2" />
              Verstuur
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
