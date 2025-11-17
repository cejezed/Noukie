import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

/**
 * ComplimentsWall Component
 * Displays all compliments received by the current user
 * Features:
 * - Beautiful card layout
 * - Sort by newest first
 * - Shows time received
 * - Empty state when no compliments
 */
export default function ComplimentsWall() {
  const { user } = useAuth();

  // Fetch received compliments
  const { data: compliments = [], isLoading } = useQuery<any[]>({
    queryKey: ["compliments-received", user?.id],
    queryFn: async () => {
      const response = await fetch("/api/compliments/mine", {
        headers: { "x-user-id": user?.id || "" },
      });
      if (!response.ok) throw new Error("Failed to fetch compliments");
      return response.json();
    },
    enabled: !!user?.id,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          Mijn Complimenten
        </CardTitle>
        <CardDescription>
          Alle lieve woorden die je hebt ontvangen van klasgenoten
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Complimenten laden...
          </div>
        ) : compliments.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <Heart className="w-16 h-16 mx-auto text-gray-300" />
            <div>
              <p className="text-lg font-medium text-muted-foreground">
                Nog geen complimenten ontvangen
              </p>
              <p className="text-sm text-muted-foreground">
                Je klasgenoten kunnen je anoniem complimenten sturen!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {compliments.map((compliment) => (
              <div
                key={compliment.id}
                className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-lg p-4 space-y-2 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <Heart className="w-5 h-5 text-pink-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm md:text-base text-gray-800 leading-relaxed">
                      {compliment.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(compliment.created_at), {
                        addSuffix: true,
                        locale: nl,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats footer */}
        {compliments.length > 0 && (
          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-pink-600">{compliments.length}</span>{" "}
              {compliments.length === 1 ? "compliment" : "complimenten"} ontvangen
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
