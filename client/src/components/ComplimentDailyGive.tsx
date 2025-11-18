import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Send, Flame, Trophy, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * ComplimentDailyGive Component
 * Allows students to send one anonymous compliment per day to a classmate
 * Features:
 * - Shows current streak
 * - Preset compliment templates
 * - Custom message option
 * - Daily limit enforcement
 * - Badge display
 */
export default function ComplimentDailyGive() {
  const { user, getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedClassmate, setSelectedClassmate] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [usePreset, setUsePreset] = useState<boolean>(true);

  // Preset compliment templates
  const presetCompliments = [
    "Je bent altijd vrolijk en dat werkt aanstekelijk! 😊",
    "Je hebt me echt geholpen vandaag, dankjewel! 🙏",
    "Je bent super creatief, ik vind je ideeën geweldig! 💡",
    "Je luistert altijd goed en dat waardeer ik! 👂",
    "Je bent een topper, blijf zo doorgaan! ⭐",
    "Je maakt altijd leuke grappen, je bent grappig! 😄",
    "Je bent een goede vriend(in), bedankt daarvoor! 🤝",
    "Je bent heel slim, je snapt alles snel! 🧠",
    "Je bent aardig tegen iedereen, dat vind ik mooi! ❤️",
    "Je bent heel sportief, respect! 🏆",
  ];

  // Fetch classmates
  const { data: classmates = [] } = useQuery<any[]>({
    queryKey: ["classmates", user?.id],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/compliments/classmates", { headers });
      if (!response.ok) throw new Error("Failed to fetch classmates");
      return response.json();
    },
    enabled: !!user?.id && open,
  });

  // Fetch streak data
  const { data: streak } = useQuery<any>({
    queryKey: ["compliment-streak", user?.id],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/compliments/streak", { headers });
      if (!response.ok) throw new Error("Failed to fetch streak");
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Send compliment mutation
  const sendCompliment = useMutation({
    mutationFn: async (data: { to_user: string; message: string }) => {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/compliments", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send compliment");
      }

      return result;
    },
    onSuccess: () => {
      toast({
        title: "Compliment verzonden! 💌",
        description: "Je klasgenoot zal blij zijn met deze mooie woorden!",
      });
      queryClient.invalidateQueries({ queryKey: ["compliment-streak"] });
      setOpen(false);
      setSelectedClassmate("");
      setMessage("");
      setUsePreset(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Kon compliment niet versturen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!selectedClassmate) {
      toast({
        title: "Selecteer een klasgenoot",
        description: "Kies iemand om een compliment te geven",
        variant: "destructive",
      });
      return;
    }

    if (!message || message.trim().length < 3) {
      toast({
        title: "Schrijf een compliment",
        description: "Je bericht moet minimaal 3 tekens bevatten",
        variant: "destructive",
      });
      return;
    }

    sendCompliment.mutate({
      to_user: selectedClassmate,
      message: message.trim(),
    });
  };

  // Badge icons
  const getBadgeIcon = (badge: string) => {
    switch (badge) {
      case "week_warrior":
        return <Flame className="w-4 h-4 text-orange-500" />;
      case "fortnight_friend":
        return <Trophy className="w-4 h-4 text-yellow-500" />;
      case "monthly_motivator":
        return <Star className="w-4 h-4 text-purple-500" />;
      default:
        return null;
    }
  };

  const getBadgeName = (badge: string) => {
    switch (badge) {
      case "week_warrior":
        return "Week Warrior";
      case "fortnight_friend":
        return "Fortnight Friend";
      case "monthly_motivator":
        return "Monthly Motivator";
      default:
        return badge;
    }
  };

  return (
    <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-purple-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              Geef een Compliment
            </CardTitle>
            <CardDescription>Maak iemands dag mooier met een vriendelijk woord</CardDescription>
          </div>
          {streak && streak.current_streak > 0 && (
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
              <Flame className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold text-orange-600">{streak.current_streak}</p>
                <p className="text-xs text-muted-foreground">dagen streak</p>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        {streak && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-3 rounded-lg text-center shadow-sm">
              <p className="text-2xl font-bold text-blue-600">{streak.total_sent}</p>
              <p className="text-xs text-muted-foreground">Verzonden</p>
            </div>
            <div className="bg-white p-3 rounded-lg text-center shadow-sm">
              <p className="text-2xl font-bold text-green-600">{streak.points}</p>
              <p className="text-xs text-muted-foreground">Punten</p>
            </div>
            <div className="bg-white p-3 rounded-lg text-center shadow-sm">
              <p className="text-2xl font-bold text-purple-600">{streak.longest_streak}</p>
              <p className="text-xs text-muted-foreground">Langste streak</p>
            </div>
          </div>
        )}

        {/* Badges */}
        {streak && streak.badges && streak.badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {streak.badges.map((badge: string) => (
              <Badge key={badge} variant="secondary" className="flex items-center gap-1">
                {getBadgeIcon(badge)}
                {getBadgeName(badge)}
              </Badge>
            ))}
          </div>
        )}

        {/* Send button */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600">
              <Heart className="w-4 h-4 mr-2" />
              Compliment Geven
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Stuur een Compliment 💌</DialogTitle>
              <DialogDescription>
                Kies een klasgenoot en stuur een positief bericht. Je kunt één compliment per dag versturen!
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Select classmate */}
              <div>
                <Label>Aan wie?</Label>
                <Select value={selectedClassmate} onValueChange={setSelectedClassmate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kies een klasgenoot" />
                  </SelectTrigger>
                  <SelectContent>
                    {classmates.map((classmate) => (
                      <SelectItem key={classmate.id} value={classmate.id}>
                        {classmate.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preset or custom toggle */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={usePreset ? "default" : "outline"}
                  onClick={() => setUsePreset(true)}
                  className="flex-1"
                >
                  Voorbeelden
                </Button>
                <Button
                  type="button"
                  variant={!usePreset ? "default" : "outline"}
                  onClick={() => setUsePreset(false)}
                  className="flex-1"
                >
                  Eigen tekst
                </Button>
              </div>

              {/* Message input */}
              {usePreset ? (
                <div>
                  <Label>Kies een compliment</Label>
                  <Select value={message} onValueChange={setMessage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer een compliment" />
                    </SelectTrigger>
                    <SelectContent>
                      {presetCompliments.map((compliment, index) => (
                        <SelectItem key={index} value={compliment}>
                          {compliment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>Jouw compliment</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Schrijf een vriendelijk en positief bericht..."
                    maxLength={500}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {message.length}/500 tekens
                  </p>
                </div>
              )}

              {/* Send button */}
              <Button
                onClick={handleSend}
                disabled={sendCompliment.isPending || !selectedClassmate || !message}
                className="w-full"
              >
                {sendCompliment.isPending ? (
                  "Versturen..."
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Verzenden
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
