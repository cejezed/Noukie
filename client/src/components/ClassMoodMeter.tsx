import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Heart, Calendar, Award } from "lucide-react";

/**
 * ClassMoodMeter Component
 * Shows aggregate stats for the classroom
 * Features:
 * - Total compliments in class
 * - Average per student
 * - Weekly/monthly trends
 * - No personal identifiers (for privacy)
 */
export default function ClassMoodMeter() {
  const { user, getAuthHeaders } = useAuth();

  // Fetch classroom stats
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["compliments-stats", user?.id],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/compliments/stats", { headers });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Klas Sfeer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">Laden...</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  // Calculate mood level based on compliments
  const getMoodLevel = () => {
    const avgPerStudent = parseFloat(stats.avg_per_student);
    if (avgPerStudent >= 5) return { label: "Geweldig! 🎉", color: "text-green-600" };
    if (avgPerStudent >= 3) return { label: "Goed 😊", color: "text-blue-600" };
    if (avgPerStudent >= 1) return { label: "Redelijk 🙂", color: "text-yellow-600" };
    return { label: "Start nu! 💪", color: "text-gray-600" };
  };

  const mood = getMoodLevel();

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Klas Sfeer Meter
        </CardTitle>
        <CardDescription>
          Zie hoe positief jullie klas is!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mood indicator */}
        <div className="text-center p-6 bg-white rounded-lg shadow-sm">
          <Award className="w-12 h-12 mx-auto mb-3 text-blue-600" />
          <p className={`text-3xl font-bold ${mood.color}`}>{mood.label}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Gemiddelde klas sfeer
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-pink-500" />
              <p className="text-xs text-muted-foreground">Totaal Complimenten</p>
            </div>
            <p className="text-2xl font-bold text-pink-600">{stats.total_compliments}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Studenten in Klas</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.total_students}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-purple-500" />
              <p className="text-xs text-muted-foreground">Deze Week</p>
            </div>
            <p className="text-2xl font-bold text-purple-600">{stats.this_week}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Deze Maand</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.this_month}</p>
          </div>
        </div>

        {/* Average */}
        <div className="text-center p-4 bg-white rounded-lg shadow-sm">
          <p className="text-sm text-muted-foreground mb-1">
            Gemiddeld per student
          </p>
          <p className="text-3xl font-bold text-blue-600">
            {stats.avg_per_student}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            complimenten per persoon
          </p>
        </div>

        {/* Encouragement message */}
        {stats.total_compliments < 10 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-center text-yellow-800">
              💡 <strong>Tip:</strong> Probeer elke dag minstens één compliment te geven.
              Maak jullie klas een fijnere plek!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
