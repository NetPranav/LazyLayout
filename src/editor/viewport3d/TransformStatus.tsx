"use client";

/**
 * ============================================================================
 * 3D TRANSFORM STATUS HUD (ROADMAP Phase 3D-016)
 * ============================================================================
 * HUD status line displayed in the viewport while a modal transform session
 * (G / R / S) is active. Shows active mode, axis constraints, and typed value:
 *   e.g. "Move X 2.00 m", "Rotate Z 45.00°", "Scale 1.50"
 * ============================================================================
 */

import React from "react";
import type { ModalTransformState } from "./types";

export interface TransformStatusProps {
  state: ModalTransformState | null;
  className?: string;
}

export const TransformStatus: React.FC<TransformStatusProps> = ({
  state,
  className = "",
}) => {
  if (!state) return null;

  return (
    <div
      data-testid="transform-status"
      className={`ll:pointer-events-none ll:select-none ${className}`}
      style={{
        backgroundColor: "var(--ll-surface-panel, #FDFCF8)",
        border: "1px solid var(--ll-border-color, #CECDC8)",
        borderRadius: 4,
        padding: "3px 8px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 12,
        fontWeight: 500,
        color: "var(--ll-text-primary, #1e293b)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 1,
          backgroundColor:
            state.mode === "translate"
              ? "#ef4444"
              : state.mode === "rotate"
              ? "#22c55e"
              : "#3b82f6",
        }}
      />
      <span>{state.statusText}</span>
    </div>
  );
};

export default TransformStatus;
