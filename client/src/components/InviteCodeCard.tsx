import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Loader2 } from "lucide-react";

/**
 * InviteCodeCard Component
 * Displays the user's invite code and provides sharing functionality
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
        description: "Je uitnodigingscode is gekopieerd naar het klembord",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Kopiëren mislukt",
        description: "Probeer het opnieuw",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (!inviteCode?.code) return;

    const shareText = `Voeg mij toe als vriend op Noukie! Gebruik deze code: ${inviteCode.code}`;

    // Check if Web Share API is available
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Noukie Uitnodiging",
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
      <Card className="border-red-200">
        <CardContent className="py-4">
          <p className="text-sm text-red-600">
            Kon uitnodigingscode niet laden. Probeer het later opnieuw.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="w-5 h-5 text-blue-500" />
          Jouw Uitnodigingscode
        </CardTitle>
        <CardDescription>
          Deel deze code met vrienden om ze toe te voegen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Invite code display */}
        <div className="bg-white p-4 rounded-lg border-2 border-blue-200 text-center">
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
            <Copy className="w-4 h-4 mr-2" />
            {copied ? "Gekopieerd!" : "Kopiëren"}
          </Button>
          <Button
            onClick={handleShare}
            className="w-full bg-blue-500 hover:bg-blue-600"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Delen
          </Button>
        </div>

        {/* Help text */}
        <p className="text-xs text-muted-foreground text-center">
          Je vrienden kunnen deze code invoeren om jou als vriend toe te voegen
        </p>
      </CardContent>
    </Card>
  );
}
