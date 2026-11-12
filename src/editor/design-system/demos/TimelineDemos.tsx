"use client";

import React, { useState } from "react";
import { TimelinePanel } from "@/editor/panels/timeline/TimelinePanel";
import { TimelineTransport } from "@/editor/panels/timeline/TimelineTransport";
import { TimelineFooter } from "@/editor/panels/timeline/TimelineFooter";
import { ParityBadge } from "@/editor/components/ParityBadge";
import { TimelineCompositionTabs } from "@/editor/panels/timeline/TimelineCompositions";
import { parityStore } from "@/core/engine/stage/parity";
import { Button } from "@/editor/components/Button";
import { BudgetMeter } from "@/editor/components/BudgetMeter";
import type { FeatureCost } from "@/core/gpu/tiers";

/**
 * 1. Default Timeline Workstation Demo
 * Full timeline workstation showing the 44px header, 32px sticky ruler,
 * 264px resizable track column, group layer (Hero) mirroring Layers panel,
 * sub-tracks, clips with label colors (--ll-label-1..6), keyframes, and 28px footer.
 */
export function TimelineDefaultDemo() {
  return (
    <div className="ll:w-full ll:h-80 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel">
      <TimelinePanel height="100%" />
    </div>
  );
}

/**
 * 2. Graph View (Value Curves & Bezier Tangents) Demo
 * Shows the Graph editor mode of the timeline workstation plotting keyframe
 * curve, grid lines, and interactive tangent handles.
 */
export function TimelineGraphDemo() {
  return (
    <div className="ll:w-full ll:h-80 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel">
      <TimelinePanel height="100%" />
    </div>
  );
}

/**
 * 3. Compact / High-Density Mode Demo
 * Shows the timeline with compact rows and full-width mode.
 */
export function TimelineCompactDemo() {
  return (
    <div className="ll:w-full ll:h-72 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel">
      <TimelinePanel height="100%" fullWidth={true} />
    </div>
  );
}

/**
 * 4. Timeline Header & Transport Demo
 * Shows the 44px transport header in isolation with timecode, playback controls,
 * speed dropdown, tool selector, and export action.
 */
export function TimelineTransportDemo() {
  const [fw, setFw] = useState(true);

  return (
    <div className="ll:w-full ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel">
      <TimelineTransport
        fullWidth={fw}
        onToggleFullWidth={(v) => setFw(v)}
      />
    </div>
  );
}

/**
 * 5. Timeline Footer & Mini-Map Demo
 * Shows the 28px timeline footer with the mini-map overview, zoom slider,
 * frame rate selector, snapping toggle, and work area indicator.
 */
export function TimelineFooterDemo() {
  return (
    <div className="ll:w-full ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel">
      <TimelineFooter trackWidth={264} />
    </div>
  );
}

/**
 * Engine parity badge (Phase 60): idle, OK and drift, set by hand here. Shown in the timeline footer in dev builds.
 */
export function ParityBadgeDemo() {
  const set = (status: "idle" | "ok" | "drift") =>
    parityStore.setState({
      status,
      checked: status === "idle" ? 0 : 3,
      samples: 1,
      drifts: status === "drift" ? [{ layerId: "headline", property: "opacity", expected: "0.5", actual: "0.2" }] : [],
    } as ReturnType<typeof parityStore.getState>);
  return (
    <div className="ll:flex ll:items-center ll:gap-3">
      <ParityBadge />
      <Button size="sm" onClick={() => set("idle")}>Idle</Button>
      <Button size="sm" onClick={() => set("ok")}>OK</Button>
      <Button size="sm" onClick={() => set("drift")}>Drift</Button>
    </div>
  );
}

/** Phase 65: the composition tab strip and breadcrumbs, on the live document (Main, interactions, opened precomps). */
export function TimelineCompositionTabsDemo() {
  return (
    <div className="ll:w-full ll:max-w-2xl ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
      <TimelineCompositionTabs />
    </div>
  );
}

/** ROADMAP_3D 3D-005: a sample scene against the three device tiers. */
const SAMPLE_SCENE: FeatureCost[] = [
  { id: "mesh", label: "Geometry", cost: { frameMs: 3, gpuMB: 60, drawCalls: 60, kTriangles: 90, simMs: 0 } },
  { id: "shadows", label: "Soft shadows", dropOrder: 1, downgrade: "hard shadows", cost: { frameMs: 2, gpuMB: 40, drawCalls: 20, kTriangles: 0, simMs: 0 } },
  { id: "cloth", label: "Live cloth", dropOrder: 2, downgrade: "baked", cost: { frameMs: 1, gpuMB: 16, drawCalls: 0, kTriangles: 0, simMs: 2.5 } },
  { id: "bloom", label: "Bloom", dropOrder: 3, downgrade: "off", cost: { frameMs: 1.2, gpuMB: 24, drawCalls: 4, kTriangles: 0, simMs: 0 } },
];
export function BudgetMeterDemo() {
  return (
    <div className="ll:w-72">
      <BudgetMeter features={SAMPLE_SCENE} />
    </div>
  );
}
