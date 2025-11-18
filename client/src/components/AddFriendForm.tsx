import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";

/**
 * AddFriendForm Component
 * Allows users to redeem invite codes to add friends
 */
export default function AddFriendForm() {
  const { user, getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");

  // Redeem invite code mutation
  const redeemCode = useMutation({
    mutationFn: async (inviteCode: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/friends/redeem", {
        method: "POST",
        headers,
        body: JSON.stringify({ code: inviteCode }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to redeem code");
      }

      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "Vriendschap aangemaakt! 🎉",
        description: data.message || "Je hebt een nieuwe vriend toegevoegd!",
      });

      // Invalidate friends list to refresh
      queryClient.invalidateQueries({ queryKey: ["friends", user?.id] });

      // Clear input
      setCode("");
    },
    onError: (error: Error) => {
      toast({
        title: "Code inwisselen mislukt",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedCode) {
      toast({
        title: "Voer een code in",
        description: "De uitnodigingscode mag niet leeg zijn",
        variant: "destructive",
      });
      return;
    }

    // Basic format validation (should be XXXX-XXXX-XXXX)
    if (trimmedCode.length < 8) {
      toast({
        title: "Ongeldige code",
        description: "De code moet minimaal 8 tekens bevatten",
        variant: "destructive",
      });
      return;
    }

    // Redeem code
    redeemCode.mutate(trimmedCode);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-format: add hyphens and convert to uppercase
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    setCode(value);
  };

  return (
    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-green-500" />
          Vriend Toevoegen
        </CardTitle>
        <CardDescription>
          Voer de uitnodigingscode van je vriend in
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Code input */}
          <div>
            <Label htmlFor="invite-code">Uitnodigingscode</Label>
            <Input
              id="invite-code"
              type="text"
              placeholder="XXXX-XXXX-XXXX"
              value={code}
              onChange={handleInputChange}
              maxLength={14} // 12 characters + 2 hyphens
              className="font-mono text-lg text-center tracking-wider"
              disabled={redeemCode.isPending}
            />
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600"
            disabled={redeemCode.isPending || !code.trim()}
          >
            {redeemCode.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verwerken...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Vriend Toevoegen
              </>
            )}
          </Button>

          {/* Help text */}
          <p className="text-xs text-muted-foreground text-center">
            Je kunt complimenten uitwisselen met je vrienden, ook als jullie niet in dezelfde klas zitten
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
