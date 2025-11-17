/**
 * GeoGameHUD Component
 *
 * Displays game status information:
 * - Current level
 * - Lives (hearts)
 * - Streak
 * - XP
 * - Optional: Timer for Time Rush mode
 */

import React from "react";

interface GeoGameHUDProps {
  currentLevel: number;
  totalLevels: number;
  lives: number;
  maxLives: number;
  streak: number;
  xp: number;
  timer?: number | null;  // Seconds remaining (Time Rush mode)
}

export function GeoGameHUD(props: GeoGameHUDProps) {
  const { currentLevel, totalLevels, lives, maxLives, streak, xp, timer } = props;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm sticky top-0 z-10">
      <div className="max-w-[800px] mx-auto">
        <div className="flex items-center justify-between gap-4 text-sm">
          {/* Left: Level */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">
              Level {currentLevel}/{totalLevels}
            </span>
          </div>

          {/* Center: Lives */}
          <div className="flex items-center gap-1">
            {Array.from({ length: maxLives }).map((_, i) => (
              <span
                key={i}
                className="text-xl"
                style={{ opacity: i < lives ? 1 : 0.2 }}
              >
                ❤️
              </span>
            ))}
          </div>

          {/* Right: Streak & XP */}
          <div className="flex items-center gap-4">
            {/* Streak */}
            {streak > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                <span className="text-base">⚡</span>
                <span className="font-semibold">{streak}</span>
              </div>
            )}

            {/* XP */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              <span className="text-base">✨</span>
              <span className="font-semibold">{xp} XP</span>
            </div>

            {/* Timer (Time Rush mode) */}
            {timer !== null && timer !== undefined && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700">
                <span className="text-base">⏱️</span>
                <span className="font-semibold">{timer}s</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
