/**
 * PowerUpButton Component
 *
 * Reusable button for power-ups (Hint, Joker, Extra Life).
 * Shows icon, label, and remaining amount.
 */

import React from "react";
import type { PowerUpType } from "@/types/game";

// ============================================
// TYPES
// ============================================

export interface PowerUpButtonProps {
  type: PowerUpType;
  amount: number;
  disabled?: boolean;
  onUse: () => void;
}

// ============================================
// HELPER DATA
// ============================================

const POWERUP_CONFIG: Record<
  PowerUpType,
  { icon: string; label: string; color: string; description: string }
> = {
  hint: {
    icon: "💡",
    label: "Hint",
    color: "#f59e0b", // amber-500
    description: "Grijst één fout antwoord uit",
  },
  joker: {
    icon: "🎯",
    label: "Joker",
    color: "#8b5cf6", // violet-500
    description: "Verwijdert twee foute antwoorden",
  },
  extra_life: {
    icon: "❤️",
    label: "Extra Leben",
    color: "#ef4444", // red-500
    description: "Voegt één hart toe",
  },
};

// ============================================
// COMPONENT
// ============================================

export default function PowerUpButton(props: PowerUpButtonProps) {
  const { type, amount, disabled = false, onUse } = props;

  const config = POWERUP_CONFIG[type];
  const isDisabled = disabled || amount <= 0;

  return (
    <button
      onClick={onUse}
      disabled={isDisabled}
      className={`
        relative flex items-center gap-2 px-4 py-3 rounded-xl border-2 font-semibold
        transition-all duration-200
        ${
          isDisabled
            ? "opacity-40 cursor-not-allowed border-gray-300 bg-gray-100"
            : "hover:scale-105 hover:shadow-lg border-gray-400 bg-white"
        }
      `}
      title={config.description}
      style={{
        borderColor: isDisabled ? "#d1d5db" : config.color,
      }}
    >
      {/* Icon */}
      <span className="text-2xl">{config.icon}</span>

      {/* Label */}
      <div className="flex flex-col items-start">
        <span className="text-sm font-bold" style={{ color: isDisabled ? "#6b7280" : config.color }}>
          {config.label}
        </span>
        <span className="text-xs text-gray-600">×{amount}</span>
      </div>

      {/* Badge showing amount (optional, for visual emphasis) */}
      {amount > 0 && !isDisabled && (
        <div
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: config.color }}
        >
          {amount}
        </div>
      )}
    </button>
  );
}
