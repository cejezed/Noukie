import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Loader2 } from "lucide-react";

/**
 * InviteCodeCard Component
 * Displays the user's invite code in a kid-friendly way
 * Kids can share their secret code to make friends in Noukie
 */
export default function InviteCodeCard() {
  const { user, getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Fetch user's invite code
  const { data: inviteCode, isLoading, error } = useQuery<{ code: string }>({
    queryKey: ["invite-code", user?.id],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/friends/invite-code", { headers });
      if (!response.ok) throw new Error("Failed to fetch invite code");
      return response.json();
    },
    enabled: !!user?.id,
  });

  const handleCopy = async () => {
    if (!inviteCode?.code) return;

    try {
      await navigator.clipboard.writeText(inviteCode.code);
      setCopied(true);
      toast({
        title: "Gekopieerd! 📋",
        description: "Je geheime code is gekopieerd",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Oeps!",
        description: "Probeer het nog een keer",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (!inviteCode?.code) return;

    const shareText = `Hé! Gebruik mijn geheime Noukie-code: ${inviteCode.code}\n\nDownload Noukie en vul deze code in bij "Vriend toevoegen" 😊`;

    // Check if Web Share API is available
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Kom ook naar Noukie!",
          text: shareText,
        });
      } catch (error) {
        // User cancelled or error occurred, fallback to copy
        handleCopy();
      }
    } else {
      // Fallback to copy
      handleCopy();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="py-4 text-center">
          <p className="text-sm text-yellow-800">
            Je geheime code kan nu niet worden geladen.
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            Probeer het later nog een keer.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          🎟️ Nodig een vriend(in) uit
        </CardTitle>
        <CardDescription className="text-sm">
          Deel je geheime code en word vrienden in Noukie
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Label above code */}
        <p className="text-xs font-medium text-blue-700 text-center">
          Jouw geheime code
        </p>

        {/* Invite code display */}
        <div className="bg-white p-4 rounded-lg border-2 border-blue-300 text-center shadow-sm">
          <p className="text-3xl font-mono font-bold text-blue-600 tracking-wider">
            {inviteCode?.code || "XXXX-XXXX-XXXX"}
          </p>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleCopy}
            variant="outline"
            className="w-full"
          >
            {copied ? "✓ Gekopieerd!" : "📋 Kopieer code"}
          </Button>
          <Button
            onClick={handleShare}
            className="w-full bg-blue-500 hover:bg-blue-600"
          >
            📲 Deel code
          </Button>
        </div>

        {/* Help text */}
        <div className="bg-blue-100 p-3 rounded-lg">
          <p className="text-xs text-blue-800 text-center">
            💡 <strong>Tip:</strong> Vertel erbij: "Download Noukie en vul deze code in bij Vriend toevoegen"
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
