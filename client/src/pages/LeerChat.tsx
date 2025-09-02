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
import { useToast } from "@/components/ui/use-toast"; // <-- DIT IS DE CORRECTIE
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

// Structuur van een chatbericht, nu met optionele imageUrl
interface Message {
  id: number;
  sender: 'user' | 'ai';
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
  const [isUploading, setIsUploading] = useState(false); // State voor foto upload
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const [audioStatus, setAudioStatus] = useState<'idle' | 'playing' | 'paused'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref voor de verborgen file input

  const courses = ["Wiskunde A", "Biologie", "Economie", "Nederlands"];

  // Effect om chatgeschiedenis te laden
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!user || !selectedCourse) {
        setMessages([]);
        setCurrentSessionId(null);
        return;
      }

      const { data, error } = await supabase
        .from('chatsessies')
        .select('id, berichten')
        .eq('user_id', user.id)
        .eq('vak', selectedCourse)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (data && data.berichten) {
        setMessages(data.berichten as Message[]);
        setCurrentSessionId(data.id);
      } else {
        setMessages([]);
        setCurrentSessionId(null);
      }
    };

    loadChatHistory();
  }, [selectedCourse, user]);

  // Effect om naar beneden te scrollen
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  // Functie om de vraag te versturen naar de AI
  const handleSendMessage = async (imageUrl?: string) => {
    // Verstuur alleen als er tekst of een afbeelding is
    if ((!opgave.trim() && !imageUrl) || isGenerating || !user || !selectedCourse) return;

    const userMessage: Message = { 
      id: Date.now(), 
      sender: 'user', 
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          opgave: userMessage.text, 
          poging, 
          course: selectedCourse,
          imageUrl // Stuur de URL van de afbeelding mee
        })
      });

      if (!response.ok) throw new Error('De AI-assistent kon niet worden bereikt.');

      const { aiResponseText, aiAudioUrl } = await response.json();
      const aiMessage: Message = { id: Date.now() + 1, sender: 'ai', text: aiResponseText, audioUrl: aiAudioUrl };
      
      const finalMessagesList = [...newMessagesList, aiMessage];
      setMessages(finalMessagesList);

      // Sla het gesprek op in Supabase
      if (currentSessionId) {
        await supabase.from('chatsessies').update({ berichten: finalMessagesList, updated_at: new Date().toISOString() }).eq('id', currentSessionId);
      } else {
        const { data } = await supabase.from('chatsessies').insert({ userId: user.id, vak: selectedCourse, berichten: finalMessagesList }).select('id').single();
        if (data) setCurrentSessionId(data.id);
      }

    } catch (error) {
      console.error("Fout in handleSendMessage:", error);
      toast({ variant: "destructive", title: "Oeps! Er ging iets mis.", description: "Kon geen antwoord krijgen. Probeer het later opnieuw." });
      setMessages(messages); // Zet de berichten terug naar de vorige staat bij een fout
    } finally {
      setIsGenerating(false);
    }
  };

  // Functie voor het uploaden van een afbeelding
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    const fileName = `${user.id}/${Date.now()}-${file.name}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('uploads').getPublicUrl(fileName);
      
      await handleSendMessage(data.publicUrl);

    } catch (error) {
      console.error("Fout bij het uploaden:", error);
      toast({ variant: "destructive", title: "Upload mislukt", description: "De afbeelding kon niet worden geüpload." });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Functies voor audio-playback
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === 'ai' && lastMessage.audioUrl) {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(lastMessage.audioUrl);
      audioRef.current = audio;
      audio.play().catch(e => console.error("Audio kon niet automatisch afspelen:", e));
      setAudioStatus('playing');
      audio.onended = () => setAudioStatus('idle');
      audio.onpause = () => { if (!audio.ended) setAudioStatus('paused'); };
    }
  }, [messages]);

  const handleAudioControl = () => {
    if (audioRef.current) {
      if (audioStatus === 'playing') {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
        setAudioStatus('playing');
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
            <div key={msg.id} className={cn("flex", msg.sender === 'user' ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-xl p-3 rounded-lg shadow-sm", msg.sender === 'user' ? "bg-primary text-primary-foreground" : "bg-background border")}>
                 <p className="font-bold text-sm mb-1">{msg.sender === 'user' ? "Jij" : "AI Tutor"}</p>
                 {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="Geüploade opgave" className="rounded-md my-2 max-w-xs cursor-pointer" onClick={() => window.open(msg.imageUrl, '_blank')} />
                 )}
                 <p className="whitespace-pre-wrap">{msg.text}</p>
                 {msg.poging && <p className="text-xs italic mt-2 border-t border-t-white/20 pt-2">Mijn poging: "{msg.poging}"</p>}
                 {msg.sender === 'ai' && msg.audioUrl && (
                    <div className="mt-3">
                        <Button onClick={handleAudioControl} size="icon" variant={msg.sender === 'user' ? 'secondary' : 'outline'} className="h-8 w-8">
                           {audioStatus === 'playing' && <Pause className="w-4 h-4" />}
                           {audioStatus === 'paused' && <Play className="w-4 h-4" />}
                           {audioStatus === 'idle' && <Repeat className="w-4 h-4" />}
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
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-150"></span>
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-300"></span>
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
                    <Button variant="ghost" size="icon"><Info className="w-5 h-5 text-muted-foreground" /></Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>💡 Tips voor Goede Hulp</DialogTitle></DialogHeader>
                    <ul className="space-y-3 pt-2 text-sm">
                        <li className="flex items-start"><span className="mr-2">1.</span><strong>Wees Specifiek:</strong> Vraag niet "Ik snap het niet", maar "Hoe bereken je de omtrek van een cirkel?".</li>
                        <li className="flex items-start"><span className="mr-2">2.</span><strong>Laat je Werk Zien:</strong> De beste hulp krijg je als je invult wat je zelf al hebt geprobeerd. Fouten zijn leermomenten!</li>
                        <li className="flex items-start"><span className="mr-2">3.</span><strong>Gebruik een Foto:</strong> Maak een duidelijke foto van een wiskundesom, een diagram of een lastige alinea in je boek.</li>
                        <li className="flex items-start"><span className="mr-2">4.</span><strong>Stel Vervolgvragen:</strong> Als je de eerste hint niet snapt, vraag dan gewoon om meer uitleg. Ik ben je persoonlijke tutor.</li>
                        <li className="flex items-start text-xs text-amber-800 p-2 bg-amber-50 rounded-md mt-2"><strong className="mr-1">Let op:</strong> Ik ben een AI. Controleer belangrijke antwoorden altijd met je boek of docent.</li>
                    </ul>
                </DialogContent>
            </Dialog>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="opgave-text">Opgave of Begrip</Label>
              <Textarea id="opgave-text" value={opgave} onChange={(e) => setOgave(e.target.value)} placeholder="Typ of plak hier de opgave..." rows={3}/>
            </div>
            <div>
              <Label htmlFor="poging-text">Mijn eigen poging (optioneel)</Label>
              <Textarea id="poging-text" value={poging} onChange={(e) => setPoging(e.target.value)} placeholder="Wat heb je zelf al geprobeerd?" rows={3}/>
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
                <SelectTrigger className="w-40"><SelectValue placeholder="Kies een vak" /></SelectTrigger>
                <SelectContent>{courses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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

