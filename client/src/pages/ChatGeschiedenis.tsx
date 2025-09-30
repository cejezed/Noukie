import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, MessageSquare, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

interface Message { id: number; sender: "user" | "ai"; text: string; }
interface ChatSession { id: string; created_at: string; updated_at: string; vak: string; berichten: Message[]; }

export default function ChatGeschiedenis() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // NIEUWE STATE: Houd de geselecteerde sessie ID bij
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);

  // Query voor de lijst met alle sessies
  const { data: sessions = [], isLoading: isHistoryLoading } = useQuery<ChatSession[]>({
    queryKey: ["chatsessies", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chatsessies")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as ChatSession[];
    },
  });

  // NIEUWE QUERY: Laadt de details van een specifieke sessie
  const { data: selectedSession, isLoading: isSessionLoading } = useQuery<ChatSession>({
    queryKey: ["chat-sessie-detail", selectedSessionId],
    enabled: !!selectedSessionId, // Voer de query alleen uit als er een sessie is geselecteerd
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chatsessies")
        .select("*")
        .eq("id", selectedSessionId)
        .single();
      if (error) throw new Error(error.message);
      return data as ChatSession;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chatsessies").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatsessies", userId] });
      toast({ title: "Verwijderd", description: "De chatsessie is verwijderd." });
    },
    onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });

  // Render de details van de geselecteerde sessie
  if (selectedSessionId) {
    if (isSessionLoading) {
      return (
        <div className="p-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sessie laden...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground">Een moment geduld alstublieft.</div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (!selectedSession) {
      return (
        <div className="p-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sessie niet gevonden</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">De gevraagde chatsessie kon niet worden geladen.</p>
              <Button onClick={() => setSelectedSessionId(null)} className="mt-4">
                Terug naar geschiedenis
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Hoofdweergave voor een geopende sessie
    return (
      <div className="p-6 space-y-4" data-testid="page-chat-detail">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedSessionId(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">{selectedSession.vak || "Algemeen"}</h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {selectedSession.berichten.map((message) => (
                <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-lg max-w-[75%] ${message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render de geschiedenislijst als er geen sessie is geselecteerd
  return (
    <div className="p-6 space-y-4" data-testid="page-chat-history">
      <Card>
        <CardHeader>
          <CardTitle>Chatgeschiedenis</CardTitle>
        </CardHeader>
        <CardContent>
          {isHistoryLoading ? (
            <div className="text-muted-foreground">Laden…</div>
          ) : sessions.length === 0 ? (
            <div className="text-muted-foreground">Nog geen chats.</div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => {
                const last = s.berichten?.[s.berichten.length - 1];
                const subtitle = last?.text?.slice(0, 120) ?? "";
                return (
                  <div key={s.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{s.vak || "Algemeen"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.updated_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
                        {subtitle ? ` • ${subtitle}${last!.text.length > 120 ? "…" : ""}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedSessionId(s.id)}>
                        <MessageSquare className="w-4 h-4 mr-1" /> Open
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive"
                        onClick={() => {
                          if (confirm("Deze chatsessie verwijderen?")) deleteMutation.mutate(s.id);
                        }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
