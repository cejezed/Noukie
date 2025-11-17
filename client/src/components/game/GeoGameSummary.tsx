/**
 * GeoGameSummary Component (Multi-Subject Support)
 *
 * End screen after completing a gameified quiz for any subject.
 * Shows score, XP earned, rank progress, and navigation options.
 *
 * Supports: aardrijkskunde, geschiedenis, wiskunde, duits, engels
 */

import React from "react";
import type { SubjectGameConfig, RankInfo } from "@/types/game";

// ============================================
// TYPES
// ============================================

export interface GeoGameSummaryProps {
  quizTitle?: string;

  // Session stats
  totalQuestions: number;
  correctAnswers: number;
  xpEarned: number;
  bestStreak: number;
  scorePercentage: number;

  // Profile/rank info
  rankInfo: RankInfo;
  config: SubjectGameConfig;

  // Actions
  onRestart?: () => void;
  onBackToOverview: () => void;
}

// ============================================
// COMPONENT
// ============================================

export default function GeoGameSummary(props: GeoGameSummaryProps) {
  const {
    quizTitle,
    totalQuestions,
    correctAnswers,
    xpEarned,
    bestStreak,
    scorePercentage,
    rankInfo,
    config,
    onRestart,
    onBackToOverview,
  } = props;

  const { primaryColor, secondaryColor, icon, displayName } = config;
  const { rankLabel, nextRankXp, xpToNextRank, progressPercent } = rankInfo;

  // Grade based on percentage
  const getGrade = (pct: number): { emoji: string; text: string; color: string } => {
    if (pct >= 90) return { emoji: "🎉", text: "Uitstekend!", color: "text-emerald-600" };
    if (pct >= 75) return { emoji: "⭐", text: "Goed gedaan!", color: "text-blue-600" };
    if (pct >= 60) return { emoji: "👍", text: "Prima!", color: "text-yellow-600" };
    return { emoji: "📚", text: "Blijf oefenen!", color: "text-orange-600" };
  };

  const grade = getGrade(scorePercentage);

  return (
    <main className="mx-auto max-w-[800px] px-6 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-6xl mb-4">{grade.emoji}</div>
          <h1 className={`text-3xl font-bold ${grade.color}`}>{grade.text}</h1>
          <p className="text-gray-600">{quizTitle}</p>
        </div>

        {/* Score Card */}
        <div
          className="rounded-2xl p-6 space-y-6"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor})`,
            borderLeft: `4px solid ${primaryColor}`,
          }}
        >
          {/* Main score */}
          <div className="text-center">
            <div className="text-6xl font-bold" style={{ color: primaryColor }}>
              {scorePercentage}%
            </div>
            <div className="text-sm text-gray-600 mt-2">
              {correctAnswers} / {totalQuestions} correct
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-white rounded-xl border">
              <div className="text-3xl font-bold text-purple-600">{xpEarned} XP</div>
              <div className="text-sm text-gray-600 mt-1">Verdiend</div>
            </div>
            <div className="text-center p-4 bg-white rounded-xl border">
              <div className="text-3xl font-bold text-orange-600">{bestStreak}</div>
              <div className="text-sm text-gray-600 mt-1">Beste Streak ⚡</div>
            </div>
          </div>
        </div>

        {/* Rank Card */}
        <div className="bg-white border-2 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{icon}</span>
            <div className="flex-1">
              <h2 className="text-xl font-bold" style={{ color: primaryColor }}>
                {rankLabel}
              </h2>
              <p className="text-sm text-gray-600">{displayName}</p>
            </div>
            <div
              className="px-4 py-2 rounded-full text-sm font-semibold"
              style={{ backgroundColor: primaryColor, color: "white" }}
            >
              Rank {rankInfo.rankIndex + 1}
            </div>
          </div>

          {/* Progress bar to next rank */}
          {nextRankXp !== null && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Voortgang naar volgende rank</span>
                <span className="font-semibold">
                  {rankInfo.currentXp} / {nextRankXp} XP
                </span>
              </div>
              <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: primaryColor,
                  }}
                />
              </div>
              {xpToNextRank !== null && (
                <p className="text-xs text-gray-500 text-center">
                  Nog {xpToNextRank} XP nodig voor de volgende rank!
                </p>
              )}
            </div>
          )}

          {nextRankXp === null && (
            <div className="text-center py-4">
              <p className="text-lg font-semibold" style={{ color: primaryColor }}>
                🏆 Maximale rank bereikt!
              </p>
              <p className="text-sm text-gray-600 mt-1">Je bent een {rankLabel}!</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          {onRestart && (
            <button
              onClick={onRestart}
              className="w-full py-4 rounded-xl font-semibold text-white shadow-md hover:opacity-90 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              🎮 Speel Opnieuw
            </button>
          )}

          <button
            onClick={onBackToOverview}
            className="w-full py-4 rounded-xl font-semibold bg-white border-2 hover:bg-gray-50 transition-colors"
            style={{ borderColor: primaryColor, color: primaryColor }}
          >
            Terug naar Toetsen
          </button>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-500">
          Je voortgang is automatisch opgeslagen
        </p>
      </div>
    </main>
  );
}
