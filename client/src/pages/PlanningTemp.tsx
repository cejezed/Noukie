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

interface ChatSession {
    id: string;
    created_at: string;
    updated_at: string;
    vak: string;
    berichten: Message[];
}

export default function LeerChat() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  const [opgave, setOgave] = useState("");
  const [poging, setPoging] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Staat voor het beheren van sessies
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('new');

  const [courseOptions, setCourseOptions] = useState<string[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const [audioStatus, setAudioStatus] = useState<"idle" | "playing" | "paused">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Haal vakken op zodra gebruiker en selectedCourse beschikbaar zijn
  useEffect(() => {
    const loadCourseOptions = async () => {
      if (!user || isLoading) {
        setCourseOptions([]);
        return;
      }
      setLoadingCourses(true);
      try {
        // Haal alle vakken direct op uit de 'courses' tabel voor de ingelogde gebruiker
        const { data: courses, error } = await supabase
          .from("courses")
          .select("name")
          .eq("user_id", user.id)
          .order("name", { ascending: true });

        if (error) throw error;

        const courseNames = (courses ?? []).map(c => c.name).filter(Boolean);
        setCourseOptions(courseNames);

        // Reset de selectie als het geselecteerde vak niet meer in de lijst voorkomt
        if (selectedCourse && !courseNames.includes(selectedCourse)) {
          setSelectedCourse("");
        }
      } catch (e: any) {
        console.error("Kon vakken niet laden:", e);
        setCourseOptions([]);
        toast({
          title: "Fout",
          description: "Kon de lijst met vakken niet laden.",
          variant: "destructive",
        });
      } finally {
        setLoadingCourses(false);
      }
    };

    loadCourseOptions();
  }, [user, isLoading]); // Zorg ervoor dat het wacht tot de gebruiker is geladen

// Chatsessies laden en bijwerken
useEffect(() => {
    const loadChatSessions = async () => {
        if (!user || isLoading || !selectedCourse) {
            setChatSessions([]);
            setSelectedSessionId('new');
            setMessages([]);
            return;
        }

        const { data, error } = await supabase
            .from("chatsessies")
            .select("*")
            .eq("user_id", user.id)
            .eq("vak", selectedCourse)
            .order("updated_at", { ascending: false });

        if (error) {
            console.error("Kon chatgeschiedenis niet laden:", error);
            return;
        }

        const sessions = data as ChatSession[];
        setChatSessions(sessions);
        
        // Laad de meest recente sessie of start een nieuwe
        if (sessions.length > 0) {
            const mostRecentSession = sessions[0];
            setSelectedSessionId(mostRecentSession.id);
            setCurrentSessionId(mostRecentSession.id);
            setMessages(mostRecentSession.berichten);
        } else {
            setSelectedSessionId('new');
            setMessages([]);
            setCurrentSessionId(null);
        }
    };
    loadChatSessions();
}, [selectedCourse, user, isLoading]); // Zorg ervoor dat het wacht tot de gebruiker is geladen

// Luister naar geselecteerde sessie en update berichten
useEffect(() => {
    if (selectedSessionId === 'new') {
        setMessages([]);
        setCurrentSessionId(null);
    } else {
        const session = chatSessions.find(s => s.id === selectedSessionId);
        if (session) {
            setMessages(session.berichten);
            setCurrentSessionId(session.id);
        }
    }
}, [selectedSessionId, chatSessions]);


  // Altijd naar onderen scrollen bij nieuwe berichten
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  // Vraag versturen naar de AI
  const handleSendMessage = async (imageUrl?: string) => {
    if ((!opgave.trim() && !imageUrl) || isGenerating || !user || !selectedCourse) return;

    const userMessage: Message = { id: Date.now(), sender: "user", text: opgave || "Kun je helpen met deze afbeelding?", poging, imageUrl };
    const newMessagesList = [...messages, userMessage];
    setMessages(newMessagesList);
    setOgave("");
    setPoging("");
    setIsGenerating(true);

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      // Haal de chatgeschiedenis op, maar filter onnodige data
      const historyToSend = messages.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          text: msg.text
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          opgave: userMessage.text, 
          poging: userMessage.poging, 
          course: selectedCourse, 
          imageUrl,
          history: historyToSend,
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Er is een fout opgetreden');

      const { aiResponseText, aiAudioUrl } = await response.json();
      const aiMessage: Message = { id: Date.now() + 1, sender: "ai", text: aiResponseText, audioUrl: aiAudioUrl };
      const finalMessagesList = [...newMessagesList, aiMessage];
      setMessages(finalMessagesList);

      // Opslaan in Supabase
      if (currentSessionId) {
        await supabase.from("chatsessies").update({ berichten: finalMessagesList, updated_at: new Date().toISOString() }).eq("id", currentSessionId);
      } else {
        const { data: ins } = await supabase.from("chatsessies").insert({ user_id: user.id, vak: selectedCourse, berichten: finalMessagesList }).select("id").single();
        if (ins) setCurrentSessionId(ins.id);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Oeps! Er ging iets mis.", description: error.message });
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
      await supabase.storage.from("uploads").upload(fileName, file);
      const { data } = supabase.storage.from("uploads").getPublicUrl(fileName);
      await handleSendMessage(data.publicUrl);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload mislukt", description: error.message });
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
      audio.play().catch(e => console.warn("Audio kon niet automatisch afspelen:", e));
      setAudioStatus("playing");
      audio.onended = () => setAudioStatus("idle");
      audio.onpause = () => { if (!audio.ended) setAudioStatus("paused"); };
    }
  }, [messages]);

  const handleAudioControl = () => {
    if (audioRef.current) {
      if (audioStatus === "playing") audioRef.current.pause();
      else { audioRef.current.play(); setAudioStatus("playing"); }
    }
  };
  
  const handleNewChat = () => {
      setMessages([]);
      setCurrentSessionId(null);
      setSelectedSessionId('new');
      setOgave("");
      setPoging("");
      toast({
          title: "Nieuwe chatsessie",
          description: "Je kunt nu een nieuwe vraag stellen.",
      });
  };

  // Loading state
  if (isLoading || loadingCourses) {
    return (
      <div className="flex justify-center items-center h-full p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] p-4 bg-slate-50">
      <ScrollArea className="flex-grow mb-4 p-4 border rounded-lg bg-white" ref={scrollAreaRef}>
        <div className="space-y-4">
          {/* Welkomstbericht */}
          {messages.length === 0 && !isGenerating && (
            <div className="text-center text-muted-foreground pt-12">
              <p className="font-medium text-lg">Welkom bij de AI Tutor!</p>
              <p className="text-sm">Kies een vak en stel je vraag.</p>
            </div>
          )}
          {/* Berichten */}
          {messages.map(msg => (
            <div key={msg.id} className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-xl p-3 rounded-lg shadow-sm", msg.sender === "user" ? "bg-primary text-primary-foreground" : "bg-background border")}>
                <p className="font-bold text-sm mb-1">{msg.sender === "user" ? "Jij" : "AI Tutor"}</p>
                {msg.imageUrl && <img src={msg.imageUrl} alt="Opgave" className="rounded-md my-2 max-w-xs" />}
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.poging && <p className="text-xs italic mt-2 border-t pt-2">Mijn poging: "{msg.poging}"</p>}
                {msg.sender === "ai" && msg.audioUrl && (
                  <div className="mt-3">
                    <Button onClick={handleAudioControl} size="icon" variant="outline" className="h-8 w-8">
                      {audioStatus === 'playing' && <Pause className="w-4 h-4" />}
                      {audioStatus === 'paused' && <Play className="w-4 h-4" />}
                      {audioStatus === 'idle' && <Repeat className="w-4 h-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {/* Laad-indicator */}
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
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Stel je vraag</CardTitle>
          <div className="flex items-center gap-2">
            
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId} disabled={!selectedCourse}>
              <SelectTrigger className="w-48 text-left">
                <SelectValue placeholder="Kies een sessie..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Nieuwe chat</SelectItem>
                {chatSessions.map(session => (
                  <SelectItem key={session.id} value={session.id}>
                    {new Date(session.updated_at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog>
              <DialogTrigger asChild><Button variant="ghost" size="icon"><Info className="w-5 h-5 text-muted-foreground" /></Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>💡 Tips voor Goede Hulp</DialogTitle></DialogHeader>
                <ul className="space-y-3 pt-2 text-sm">
                  <li><strong>1. Wees Specifiek:</strong> Vraag "Hoe bereken je de omtrek?" i.p.v. "Ik snap het niet".</li>
                  <li><strong>2. Laat je Werk Zien:</strong> Vul in wat je zelf al hebt geprobeerd.</li>
                  <li><strong>3. Gebruik een Foto:</strong> Maak een duidelijke foto van je opgave.</li>
                  <li className="text-xs text-amber-800 p-2 bg-amber-50 rounded-md"><strong>Let op:</strong> Controleer belangrijke antwoorden altijd.</li>
                </ul>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="opgave-text">Opgave of Begrip</Label>
              <Textarea id="opgave-text" value={opgave} onChange={e => setOgave(e.target.value)} placeholder="Typ of plak hier de opgave..." rows={3} />
            </div>
            <div>
              <Label htmlFor="poging-text">Mijn eigen poging (optioneel)</Label>
              <Textarea id="poging-text" value={poging} onChange={e => setPoging(e.target.value)} placeholder="Wat heb je zelf al geprobeerd?" rows={3} />
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
              <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isGenerating}>
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="icon" disabled><Mic className="w-4 h-4" /></Button>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={loadingCourses ? "Vakken laden..." : "Kies een vak"} />
                </SelectTrigger>
                <SelectContent>
                  {courseOptions.length > 0 ? courseOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>) : <div className="px-3 py-2 text-sm text-muted-foreground">Geen vakken gevonden</div>}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => handleSendMessage()} disabled={!opgave.trim() || isGenerating || !selectedCourse} size="lg">
              <Send className="w-5 h-5 mr-2" />
              Verstuur
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
