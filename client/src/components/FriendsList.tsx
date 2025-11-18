import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Users, UserMinus, Loader2 } from "lucide-react";

interface Friend {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

/**
 * FriendsList Component
 * Kid-friendly display of user's friends with ability to remove
 */
export default function FriendsList() {
  const { user, getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch friends list
  const { data: friends = [], isLoading, error } = useQuery<Friend[]>({
    queryKey: ["friends", user?.id],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/friends", { headers });
      if (!response.ok) throw new Error("Failed to fetch friends");
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Remove friend mutation
  const removeFriend = useMutation({
    mutationFn: async (friendId: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/friends/${friendId}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Failed to remove friend");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "✓ Vriend verwijderd",
        description: "Jullie zijn nu geen vrienden meer in Noukie",
      });

      // Invalidate friends list to refresh
      queryClient.invalidateQueries({ queryKey: ["friends", user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Oeps!",
        description: "Probeer het nog een keer",
        variant: "destructive",
      });
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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
            Je vrienden kunnen nu niet worden geladen.
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            Probeer het later nog een keer.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          👥 Mijn vrienden
          {friends.length > 0 && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {friends.length} {friends.length === 1 ? "vriend" : "vrienden"}
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-sm">
          Vrienden met wie je complimenten kunt uitwisselen
        </CardDescription>
      </CardHeader>
      <CardContent>
        {friends.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-base font-medium text-muted-foreground mb-2">
              Je hebt nog geen vrienden toegevoegd
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Vraag iemand om jouw geheime code te gebruiken of vul een code in die je kreeg
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-100 hover:border-purple-200 transition-colors shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={friend.avatar_url} alt={friend.name} />
                    <AvatarFallback className="bg-purple-100 text-purple-600">
                      {getInitials(friend.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{friend.name}</p>
                    <p className="text-xs text-purple-600">💌 Kan complimenten van jou krijgen</p>
                  </div>
                </div>

                {/* Remove friend button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Vriend verwijderen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Weet je zeker dat je {friend.name} wilt verwijderen als vriend?
                        Jullie kunnen dan geen complimenten meer naar elkaar sturen.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Nee, toch niet</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removeFriend.mutate(friend.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Ja, verwijder vriend
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
