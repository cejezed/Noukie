import React from "react";
import { useNavigate } from "react-router-dom";
import InviteCodeCard from "@/components/InviteCodeCard";
import AddFriendForm from "@/components/AddFriendForm";
import FriendsList from "@/components/FriendsList";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

/**
 * Friends Page
 * Main page for the friends and invite system
 *
 * Layout:
 * - Top: Page header with link to compliments
 * - Row 1: InviteCodeCard | AddFriendForm (side by side)
 * - Row 2: FriendsList (full width)
 */
export default function Friends() {
  const navigate = useNavigate();

  return (
    <div className="container max-w-6xl mx-auto p-4 space-y-6">
      {/* Page Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Vrienden 👥</h1>
        <p className="text-muted-foreground">
          Voeg vrienden toe en wissel complimenten uit, zelfs als jullie niet in dezelfde klas zitten
        </p>
      </div>

      {/* Quick action: Go to compliments */}
      <div className="flex justify-center">
        <Button
          onClick={() => navigate("/compliments")}
          variant="outline"
          className="gap-2"
        >
          <Heart className="w-4 h-4" />
          Naar Complimenten
        </Button>
      </div>

      {/* Invite and Add Friend Cards (side by side on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InviteCodeCard />
        <AddFriendForm />
      </div>

      {/* Friends List */}
      <FriendsList />
    </div>
  );
}
