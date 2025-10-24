import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
export default function LeerChat() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [opgave, setOpgave] = useState("");
    const [poging, setPoging] = useState("");
    const [selectedCourse, setSelectedCourse] = useState("");
    const [messages, setMessages] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [chatSessions, setChatSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState("new");
    const [courseOptions, setCourseOptions] = useState([]);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const scrollAreaRef = useRef(null);
    const fileInputRef = useRef(null);
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
                const courseNames = (courses ?? []).map((c) => c.name).filter(Boolean);
                setCourseOptions(courseNames);
                if (selectedCourse && !courseNames.includes(selectedCourse))
                    setSelectedCourse("");
            }
            catch (e) {
                console.error("Kon vakken niet laden:", e);
                toast({ title: "Fout", description: "Kon de lijst met vakken niet laden.", variant: "destructive" });
            }
            finally {
                setLoadingCourses(false);
            }
        };
        loadCourseOptions();
    }, [user, toast, selectedCourse]);
    // === Chatsessies laden ===
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
                    const mostRecentSession = sessions[0];
                    setSelectedSessionId(mostRecentSession.id);
                    setCurrentSessionId(mostRecentSession.id);
                    setMessages(mostRecentSession.berichten || []);
                }
                else {
                    setSelectedSessionId("new");
                    setMessages([]);
                    setCurrentSessionId(null);
                }
            }
            catch (error) {
                console.error("Kon chatgeschiedenis niet laden:", error);
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
            const session = chatSessions.find((s) => s.id === selectedSessionId);
            if (session) {
                setMessages(session.berichten || []);
                setCurrentSessionId(session.id);
            }
        }
    }, [selectedSessionId, chatSessions]);
    useEffect(() => {
        const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
        if (viewport)
            viewport.scrollTop = viewport.scrollHeight;
    }, [messages]);
    // === Chat sturen ===
    const handleSendMessage = async (imageUrl) => {
        if (isGenerating)
            return;
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
        const userMessage = {
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
            if (!resp.ok)
                throw new Error(rawText || `HTTP ${resp.status}`);
            const data = rawText ? JSON.parse(rawText) : {};
            const reply = data?.reply ?? "Oké—kun je iets specifieker vertellen?";
            const aiMessage = { id: Date.now() + 1, sender: "ai", text: reply, audioUrl: data?.audioUrl };
            const finalMessagesList = [...newMessagesList, aiMessage];
            setMessages(finalMessagesList);
            if (currentSessionId) {
                await supabase.from("chatsessies").update({
                    berichten: finalMessagesList,
                    updated_at: new Date().toISOString()
                }).eq("id", currentSessionId);
            }
            else {
                const { data: ins } = await supabase.from("chatsessies")
                    .insert({ user_id: user.id, vak: selectedCourse, berichten: finalMessagesList })
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
    // === Nieuwe image upload (public bucket) ===
    const handleImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file || !user)
            return;
        setIsUploading(true);
        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
        const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;
        try {
            const { error: uploadError } = await supabase.storage.from("uploads").upload(fileName, file);
            if (uploadError)
                throw uploadError;
            const res = supabase.storage.from("uploads").getPublicUrl(fileName);
            const publicUrl = res?.data?.publicUrl ?? res?.publicURL;
            if (!publicUrl || !publicUrl.includes("/public/"))
                throw new Error("Bucket niet public of URL ongeldig.");
            await handleSendMessage(publicUrl);
        }
        catch (error) {
            toast({ variant: "destructive", title: "Upload mislukt", description: error.message });
        }
        finally {
            setIsUploading(false);
            if (fileInputRef.current)
                fileInputRef.current.value = "";
        }
    };
    return (_jsx("div", { className: "flex flex-col min-h-screen p-4 bg-slate-50", children: _jsxs("div", { className: "mx-auto w-full max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8", children: [_jsx(ScrollArea, { className: "flex-1 mb-4 p-4 border rounded-lg bg-white", ref: scrollAreaRef, children: _jsxs("div", { className: "space-y-4", children: [messages.length === 0 && !isGenerating && (_jsxs("div", { className: "text-center text-muted-foreground min-h-[420px] flex flex-col items-center justify-center px-4", children: [_jsx("p", { className: "font-medium text-lg", children: "Welkom bij de AI Tutor!" }), _jsx("p", { className: "text-sm mt-1", children: "Kies een vak en stel je vraag." }), _jsx("p", { className: "text-sm mt-2 text-blue-700", children: "Ik leg stap voor stap uit, maak een korte samenvatting en geef oefenvragen \uD83C\uDF93" })] })), messages.map((msg) => (_jsx("div", { className: cn("flex", msg.sender === "user" ? "justify-end" : "justify-start"), children: _jsxs("div", { className: cn("max-w-xl p-3 rounded-lg shadow-sm", msg.sender === "user" ? "bg-primary text-primary-foreground" : "bg-background border"), children: [_jsx("p", { className: "font-bold text-sm mb-1", children: msg.sender === "user" ? "Jij" : "AI Tutor" }), msg.imageUrl && _jsx("img", { src: msg.imageUrl, alt: "Opgave", className: "rounded-md my-2 max-w-xs" }), _jsx("p", { className: "whitespace-pre-wrap", children: msg.text })] }) }, msg.id))), isGenerating && (_jsx("div", { className: "flex justify-start", children: _jsxs("div", { className: "p-3 rounded-lg bg-background border shadow-sm", children: [_jsx("p", { className: "font-bold text-sm mb-1", children: "AI Tutor" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-primary animate-bounce" }), _jsx("span", { className: "w-2 h-2 rounded-full bg-primary animate-bounce delay-150" }), _jsx("span", { className: "w-2 h-2 rounded-full bg-primary animate-bounce delay-300" })] })] }) }))] }) }), _jsxs(Card, { className: "mt-4 flex-shrink-0 overflow-hidden", children: [_jsxs(CardHeader, { className: "flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-lg", children: "Stel je vraag" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: startNewChat, title: "Nieuwe chat", children: _jsx(Repeat, { className: "w-5 h-5 text-muted-foreground" }) }), _jsxs(Dialog, { children: [_jsx(DialogTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", title: "Tips voor goede hulp", children: _jsx(Info, { className: "w-5 h-5 text-muted-foreground" }) }) }), _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Tips voor Goede Hulp" }) }), _jsxs("ul", { className: "space-y-3 pt-2 text-sm", children: [_jsxs("li", { children: [_jsx("strong", { children: "1. Stel een duidelijke vraag:" }), " Hoe specifieker je vraag, hoe beter de uitleg. Bijvoorbeeld: \u201CHoe bereken ik de omtrek van een cirkel?\u201D i.p.v. \u201CIk snap het niet\u201D."] }), _jsxs("li", { children: [_jsx("strong", { children: "2. Laat zien wat je al hebt geprobeerd:" }), " Schrijf je eigen stappen of idee\u00EBn op. De AI kan dan gericht feedback geven en je verder helpen."] }), _jsxs("li", { children: [_jsx("strong", { children: "3. Gebruik een foto:" }), " Upload een duidelijke foto van je opgave of aantekeningen. Handig bij lastige sommen of tekstvragen."] }), _jsxs("li", { children: [_jsx("strong", { children: "4. Oefenvragen:" }), " Vraag na de uitleg om extra oefenvragen. De AI kan oefenopgaven bedenken om te checken of je het snapt."] }), _jsxs("li", { children: [_jsx("strong", { children: "5. Ezelsbruggetjes & tips:" }), " De AI kan handige trucjes geven om iets te onthouden, of de stof in stappen uitleggen."] }), _jsxs("li", { className: "text-xs text-blue-800 p-2 bg-blue-50 rounded-md", children: [_jsx("strong", { children: "Let op:" }), " De uitlegcoach werkt op basis van jouw vraag en foto. Hoe beter je input, hoe beter de hulp \uD83C\uDF93"] })] })] })] })] })] }), _jsxs(CardContent, { className: "p-4 pt-0 space-y-4 pb-4", children: [_jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "opgave-text", children: "Opgave of Begrip" }), _jsx(Textarea, { id: "opgave-text", value: opgave, onChange: (e) => setOpgave(e.target.value), rows: 4, placeholder: "Typ of plak hier de opgave..." })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "poging-text", children: "Mijn eigen poging (optioneel)" }), _jsx(Textarea, { id: "poging-text", value: poging, onChange: (e) => setPoging(e.target.value), rows: 4, placeholder: "Wat heb je zelf al geprobeerd?" })] })] }), _jsxs("div", { className: "flex flex-wrap items-end justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("input", { type: "file", accept: "image/*", ref: fileInputRef, onChange: handleImageUpload, className: "hidden" }), _jsx(Button, { variant: "outline", size: "icon", onClick: () => fileInputRef.current?.click(), disabled: isUploading || isGenerating, children: isUploading ? _jsx(Loader2, { className: "w-4 h-4 animate-spin" }) : _jsx(Camera, { className: "w-4 h-4" }) }), _jsxs(Select, { value: selectedCourse, onValueChange: setSelectedCourse, children: [_jsx(SelectTrigger, { className: "w-40", children: _jsx(SelectValue, { placeholder: loadingCourses ? "Vakken laden..." : "Kies een vak" }) }), _jsx(SelectContent, { children: courseOptions.length > 0
                                                                ? courseOptions.map((c) => (_jsx(SelectItem, { value: c, children: c }, c)))
                                                                : _jsx("div", { className: "px-3 py-2 text-sm text-muted-foreground", children: "Geen vakken gevonden" }) })] })] }), _jsxs(Button, { onClick: () => handleSendMessage(), disabled: isGenerating || !selectedCourse || (!opgave.trim() && !(fileInputRef.current?.files?.length)), size: "lg", className: "shrink-0 sm:w-auto w-full", children: [_jsx(Send, { className: "w-5 h-5 mr-2" }), "Verstuur"] })] })] })] })] }) }));
}
