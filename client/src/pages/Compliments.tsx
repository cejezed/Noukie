import React from "react";
import ComplimentDailyGive from "@/components/ComplimentDailyGive";
import ComplimentsWall from "@/components/ComplimentsWall";
import ClassMoodMeter from "@/components/ClassMoodMeter";

/**
 * Compliments Page
 * Main page for the compliments feature
 *
 * Layout:
 * - Top: ComplimentDailyGive (send compliments + streak info)
 * - Middle: ComplimentsWall (received compliments)
 * - Bottom: ClassMoodMeter (classroom stats)
 */
export default function Compliments() {
  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      {/* Page Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Complimenten 💌</h1>
        <p className="text-muted-foreground">
          Maak iemands dag mooier met een vriendelijk woord
        </p>
      </div>

      {/* Send compliment section */}
      <ComplimentDailyGive />

      {/* Received compliments */}
      <ComplimentsWall />

      {/* Class stats */}
      <ClassMoodMeter />
    </div>
  );
}
