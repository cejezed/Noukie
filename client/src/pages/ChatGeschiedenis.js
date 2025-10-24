import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, MessageSquare, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
export default function ChatGeschiedenis() {
    const { user } = useAuth();
    const userId = user?.id ?? "";
    const { toast } = useToast();
    const queryClient = useQueryClient();
    // NIEUWE STATE: Houd de geselecteerde sessie ID bij
    const [selectedSessionId, setSelectedSessionId] = React.useState(null);
    // Query voor de lijst met alle sessies
    const { data: sessions = [], isLoading: isHistoryLoading } = useQuery({
        queryKey: ["chatsessies", userId],
        enabled: !!userId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("chatsessies")
                .select("*")
                .eq("user_id", userId)
                .order("updated_at", { ascending: false });
            if (error)
                throw new Error(error.message);
            return data;
        },
    });
    // NIEUWE QUERY: Laadt de details van een specifieke sessie
    const { data: selectedSession, isLoading: isSessionLoading } = useQuery({
        queryKey: ["chat-sessie-detail", selectedSessionId],
        enabled: !!selectedSessionId, // Voer de query alleen uit als er een sessie is geselecteerd
        queryFn: async () => {
            const { data, error } = await supabase
                .from("chatsessies")
                .select("*")
                .eq("id", selectedSessionId)
                .single();
            if (error)
                throw new Error(error.message);
            return data;
        },
    });
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from("chatsessies").delete().eq("id", id);
            if (error)
                throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["chatsessies", userId] });
            toast({ title: "Verwijderd", description: "De chatsessie is verwijderd." });
        },
        onError: (e) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
    });
    // Render de details van de geselecteerde sessie
    if (selectedSessionId) {
        if (isSessionLoading) {
            return (_jsx("div", { className: "p-6 space-y-4", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Sessie laden..." }) }), _jsx(CardContent, { children: _jsx("div", { className: "text-muted-foreground", children: "Een moment geduld alstublieft." }) })] }) }));
        }
        if (!selectedSession) {
            return (_jsx("div", { className: "p-6 space-y-4", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Sessie niet gevonden" }) }), _jsxs(CardContent, { children: [_jsx("p", { className: "text-muted-foreground", children: "De gevraagde chatsessie kon niet worden geladen." }), _jsx(Button, { onClick: () => setSelectedSessionId(null), className: "mt-4", children: "Terug naar geschiedenis" })] })] }) }));
        }
        // Hoofdweergave voor een geopende sessie
        return (_jsxs("div", { className: "p-6 space-y-4", "data-testid": "page-chat-detail", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: () => setSelectedSessionId(null), children: _jsx(ArrowLeft, { className: "w-5 h-5" }) }), _jsx("h1", { className: "text-lg font-semibold", children: selectedSession.vak || "Algemeen" })] }), _jsx(Card, { children: _jsx(CardContent, { className: "pt-6", children: _jsx("div", { className: "space-y-4", children: selectedSession.berichten.map((message) => (_jsx("div", { className: `flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`, children: _jsx("div", { className: `p-3 rounded-lg max-w-[75%] ${message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`, children: message.text }) }, message.id))) }) }) })] }));
    }
    // Render de geschiedenislijst als er geen sessie is geselecteerd
    return (_jsx("div", { className: "p-6 space-y-4", "data-testid": "page-chat-history", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Chatgeschiedenis" }) }), _jsx(CardContent, { children: isHistoryLoading ? (_jsx("div", { className: "text-muted-foreground", children: "Laden\u2026" })) : sessions.length === 0 ? (_jsx("div", { className: "text-muted-foreground", children: "Nog geen chats." })) : (_jsx("div", { className: "space-y-2", children: sessions.map(s => {
                            const last = s.berichten?.[s.berichten.length - 1];
                            const subtitle = last?.text?.slice(0, 120) ?? "";
                            return (_jsxs("div", { className: "border rounded-lg p-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: s.vak || "Algemeen" }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [new Date(s.updated_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" }), subtitle ? ` • ${subtitle}${last.text.length > 120 ? "…" : ""}` : ""] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => setSelectedSessionId(s.id), children: [_jsx(MessageSquare, { className: "w-4 h-4 mr-1" }), " Open"] }), _jsx(Button, { variant: "ghost", size: "icon", className: "text-destructive", onClick: () => {
                                                    if (confirm("Deze chatsessie verwijderen?"))
                                                        deleteMutation.mutate(s.id);
                                                }, children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }, s.id));
                        }) })) })] }) }));
}
