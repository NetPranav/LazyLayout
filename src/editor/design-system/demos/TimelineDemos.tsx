"use client";

import React, { useState } from "react";
import { TimelinePanel } from "@/editor/panels/timeline/TimelinePanel";
import { TimelineTransport } from "@/editor/panels/timeline/TimelineTransport";
import { TimelineFooter } from "@/editor/panels/timeline/TimelineFooter";

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
