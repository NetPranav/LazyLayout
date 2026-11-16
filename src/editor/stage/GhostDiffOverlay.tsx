"use client";

import React from "react";
import { useGhostDiffStore } from "@/ai/llm/ghostDiffStore";

/**
 * Phase 243 Canvas Ghost Diff Overlay:
 * Renders pending AI layer/motion/effect proposals over the stage with
 * per-layer Accept / Discard controls without mutating the active document.
 */
export const GhostDiffOverlay: React.FC = () => {
  const pending = useGhostDiffStore((s) => s.pending);
  const acceptLayer = useGhostDiffStore((s) => s.acceptLayer);
  const discardLayer = useGhostDiffStore((s) => s.discardLayer);

  if (!pending) return null;
  const diffs = Object.values(pending.layerDiffs);
  if (diffs.length === 0) return null;

  return (
    <div
      aria-label="AI ghost diff overlay"
      data-testid="ghost-diff-overlay"
      className="ll:pointer-events-none ll:absolute ll:inset-0 ll:z-30 ll:overflow-hidden"
    >
      {diffs.map((diff) => (
        <div
          key={diff.layerId}
          data-ghost-layer={diff.layerId}
          style={{
            left: `${Math.max(16, diff.x)}px`,
            top: `${Math.max(16, diff.y)}px`,
            width: `${Math.max(160, diff.width)}px`,
            height: `${Math.max(64, diff.height)}px`,
          }}
          className="ll:pointer-events-auto ll:absolute ll:border ll:border-dashed ll:border-border-active ll:bg-surface-panel/40 ll:rounded-sm ll:p-2 ll:flex ll:flex-col ll:justify-between"
        >
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-1 ll:text-nano ll:text-primary ll:font-sans">
            <span className="ll:truncate ll:font-medium">
              {diff.layerName} ({diff.kind})
            </span>
            {diff.backend && (
              <span className="ll:px-1 ll:rounded-xs ll:bg-surface-bar ll:border ll:border-border ll:text-secondary ll:uppercase">
                {diff.backend}
              </span>
            )}
          </div>

          <div className="ll:flex ll:items-center ll:justify-end ll:gap-1">
            <button
              type="button"
              onClick={() => discardLayer(diff.layerId)}
              className="ll:h-5 ll:px-1.5 ll:rounded-xs ll:border ll:border-border ll:bg-surface-panel ll:text-nano ll:text-secondary ll:hover:text-primary ll:cursor-pointer"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => acceptLayer(diff.layerId)}
              className="ll:h-5 ll:px-1.5 ll:rounded-xs ll:bg-control-primary-bg ll:text-control-primary-fg ll:text-nano ll:font-medium ll:cursor-pointer"
            >
              Accept
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
