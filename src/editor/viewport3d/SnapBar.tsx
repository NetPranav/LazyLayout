"use client";

/**
 * ============================================================================
 * 3D SNAP BAR (ROADMAP Phase 3D-017)
 * ============================================================================
 * Header toolbar strip for the 3D viewport containing:
 *   - Magnet toggle for snapping on/off (Shift+Tab)
 *   - Snap target dropdown: Grid, Vertex, Edge, Face, Increment
 *   - Pivot point dropdown: Median, Individual Origins, 3D Cursor, Active Element
 *   - Transform orientation dropdown: Global, Local, Normal, View, Cursor
 *
 * Built strictly according to UI_RULES.md:
 *   - Rectangular with modest radii, solid neutrals, hairline borders.
 *   - Tokens only (`--ll-*`), Tailwind classes prefixed with `ll:`.
 *   - Reuses LazyLayout design system components (IconButton, Select).
 * ============================================================================
 */

import React from "react";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import type { SnapTarget } from "@/core/3d/snap/snap";
import type { PivotKind } from "@/core/3d/snap/pivot";
import type { OrientationKind } from "@/core/3d/snap/orientation";
import { IconButton } from "@/editor/components/IconButton";
import { Select, type SelectOption } from "@/editor/components/Select";

const SNAP_TARGET_OPTIONS: readonly SelectOption[] = [
  { value: "grid", label: "Snap: Grid" },
  { value: "vertex", label: "Snap: Vertex" },
  { value: "edge", label: "Snap: Edge" },
  { value: "face", label: "Snap: Face" },
  { value: "increment", label: "Snap: Increment" },
];

const PIVOT_OPTIONS: readonly SelectOption[] = [
  { value: "median", label: "Pivot: Median" },
  { value: "individual", label: "Pivot: Individual" },
  { value: "cursor", label: "Pivot: 3D Cursor" },
  { value: "active", label: "Pivot: Active" },
];

const ORIENTATION_OPTIONS: readonly SelectOption[] = [
  { value: "global", label: "Global" },
  { value: "local", label: "Local" },
  { value: "normal", label: "Normal" },
  { value: "view", label: "View" },
  { value: "cursor", label: "Cursor" },
];

export interface SnapBarProps {
  className?: string;
}

export const SnapBar: React.FC<SnapBarProps> = ({ className = "" }) => {
  const snap = useViewportStore((s) => s.snap);
  const setSnap = useViewportStore((s) => s.setSnap);

  const pivot = useViewportStore((s) => s.pivot);
  const setPivot = useViewportStore((s) => s.setPivot);

  const orientation = useViewportStore((s) => s.orientation);
  const setOrientation = useViewportStore((s) => s.setOrientation);

  const handleToggleSnap = () => {
    setSnap((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleTargetChange = (val: string) => {
    setSnap({ target: val as SnapTarget });
  };

  const handlePivotChange = (val: string) => {
    setPivot(val as PivotKind);
  };

  const handleOrientationChange = (val: string) => {
    setOrientation(val as OrientationKind);
  };

  return (
    <div
      data-testid="snap-bar"
      className={`ll:flex ll:items-center ll:gap-1.5 ll:p-1 ll:pointer-events-auto ${className}`}
      style={{
        backgroundColor: "var(--ll-surface-panel, #FDFCF8)",
        border: "1px solid var(--ll-border-color, #CECDC8)",
        borderRadius: 4,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Magnet Snap Toggle */}
      <IconButton
        aria-label="Toggle 3D Snapping (Shift+Tab)"
        tooltip="Toggle Snapping (Shift+Tab)"
        size="sm"
        variant={snap.enabled ? "secondary" : "ghost"}
        pressed={snap.enabled}
        onClick={handleToggleSnap}
        icon={
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: snap.enabled
                ? "var(--ll-brand, #3b82f6)"
                : "var(--ll-text-secondary, #64748b)",
            }}
          >
            <path d="M4 7V4h16v3" />
            <path d="M5 11a4 4 0 0 1 7 0v6a4 4 0 0 0 7 0v-6a4 4 0 0 0-7 0v6a4 4 0 0 1-7 0v-6z" />
          </svg>
        }
      />

      {/* Snap Target */}
      <div style={{ width: 110 }}>
        <Select
          options={SNAP_TARGET_OPTIONS}
          value={snap.target}
          onChange={handleTargetChange}
          size="sm"
          variant="default"
          aria-label="Snap Target"
        />
      </div>

      <div
        style={{
          width: 1,
          height: 16,
          backgroundColor: "var(--ll-border-color, #CECDC8)",
          margin: "0 2px",
        }}
      />

      {/* Pivot Point */}
      <div style={{ width: 115 }}>
        <Select
          options={PIVOT_OPTIONS}
          value={pivot}
          onChange={handlePivotChange}
          size="sm"
          variant="default"
          aria-label="Pivot Point"
        />
      </div>

      <div
        style={{
          width: 1,
          height: 16,
          backgroundColor: "var(--ll-border-color, #CECDC8)",
          margin: "0 2px",
        }}
      />

      {/* Transform Orientation */}
      <div style={{ width: 95 }}>
        <Select
          options={ORIENTATION_OPTIONS}
          value={orientation}
          onChange={handleOrientationChange}
          size="sm"
          variant="default"
          aria-label="Transform Orientation"
        />
      </div>
    </div>
  );
};

export default SnapBar;
