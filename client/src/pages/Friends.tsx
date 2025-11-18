import React from "react";
import { useNavigate } from "react-router-dom";
import InviteCodeCard from "@/components/InviteCodeCard";
import AddFriendForm from "@/components/AddFriendForm";
import FriendsList from "@/components/FriendsList";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

/**
 * Friends Page
 * Kid-friendly interface for managing friends in Noukie
 *
 * Layout (3 blocks):
 * 1. "Samen Noukie spelen" - Invite code to share
 * 2. "Vriend toevoegen" - Enter friend's code
 * 3. "Mijn vrienden" - Friends list
 */
export default function Friends() {
  const navigate = useNavigate();

  return (
    <div className="container max-w-6xl mx-auto p-4 space-y-6 pb-8">
      {/* Page Header */}
      <div className="text-center space-y-3 py-4">
        <div className="text-5xl">👥</div>
        <h1 className="text-2xl font-bold text-foreground">Samen Noukie spelen</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Voeg vrienden toe en stuur complimenten naar elkaar, ook als jullie niet in dezelfde klas zitten!
        </p>
      </div>

      {/* Quick action: Go to compliments */}
      <div className="flex justify-center">
        <Button
          onClick={() => navigate("/compliments")}
          variant="outline"
          className="gap-2 bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200 hover:bg-pink-100"
        >
          💌 Naar Complimenten
        </Button>
      </div>

      {/* Blok 1 & 2: Invite and Add Friend Cards (side by side on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InviteCodeCard />
        <AddFriendForm />
      </div>

      {/* Blok 3: Friends List */}
      <FriendsList />
    </div>
  );
}
