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
 * Kid-friendly interface to add friends using invite codes
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
        title: "🎉 Jullie zijn nu vrienden!",
        description: "Je kunt nu complimentjes naar elkaar sturen bij Complimenten",
      });

      // Invalidate friends list to refresh
      queryClient.invalidateQueries({ queryKey: ["friends", user?.id] });

      // Clear input
      setCode("");
    },
    onError: (error: Error) => {
      // Generic, kid-friendly error message
      toast({
        title: "❌ Deze code werkt nu niet",
        description: "Check de code nog een keer of vraag je vriend(in) om opnieuw te sturen",
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
        title: "⚠️ Vul een code in",
        description: "Typ de geheime code van je vriend(in)",
        variant: "destructive",
      });
      return;
    }

    // Basic format validation (should be XXXX-XXXX-XXXX)
    if (trimmedCode.length < 8) {
      toast({
        title: "⚠️ Code te kort",
        description: "De code moet er ongeveer zo uitzien: K3F9-PL7Q-MN8R",
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
        <CardTitle className="flex items-center gap-2 text-lg">
          ➕ Vriend toevoegen
        </CardTitle>
        <CardDescription className="text-sm">
          Kreeg je een geheime code van iemand?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Code input */}
          <div>
            <Label htmlFor="invite-code" className="text-sm">Geheime code</Label>
            <Input
              id="invite-code"
              type="text"
              placeholder="xxxx-xxxx-xxxx"
              value={code}
              onChange={handleInputChange}
              maxLength={14} // 12 characters + 2 hyphens
              className="font-mono text-lg text-center tracking-wider mt-1"
              disabled={redeemCode.isPending}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Typ de code precies over, inclusief streepjes
            </p>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium"
            disabled={redeemCode.isPending || !code.trim()}
          >
            {redeemCode.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Bezig...
              </>
            ) : (
              <>
                👥 Vriend toevoegen
              </>
            )}
          </Button>

          {/* Help text */}
          <div className="bg-green-100 p-3 rounded-lg">
            <p className="text-xs text-green-800 text-center">
              💬 Na het toevoegen kun je complimentjes naar elkaar sturen!
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
