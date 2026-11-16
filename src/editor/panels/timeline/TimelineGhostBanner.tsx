"use client";

import React from "react";
import { useGhostDiffStore } from "@/ai/llm/ghostDiffStore";

/**
 * Phase 243 Timeline Ghost Diff Strip:
 * Surfaces pending AI motion clips and engine choices inside the timeline
 * so users can accept or discard before committing to undo history.
 */
export const TimelineGhostBanner: React.FC = () => {
  const pending = useGhostDiffStore((s) => s.pending);
  const acceptAll = useGhostDiffStore((s) => s.acceptAll);
  const discardAll = useGhostDiffStore((s) => s.discardAll);

  if (!pending) return null;

  const diffs = Object.values(pending.layerDiffs);
  const totalClips = diffs.reduce((acc, d) => acc + d.addedClipNames.length, 0);
  const totalEffects = diffs.reduce((acc, d) => acc + d.effectNames.length, 0);

  return (
    <div
      role="status"
      aria-label="Timeline AI ghost diff"
      data-testid="timeline-ghost-banner"
      className="ll:px-3 ll:py-1.5 ll:bg-surface-bar ll:border-b ll:border-dashed ll:border-border-active ll:flex ll:items-center ll:justify-between ll:gap-2 ll:text-small ll:font-sans"
    >
      <div className="ll:min-w-0 ll:flex ll:items-center ll:gap-2">
        <span className="ll:text-primary ll:font-medium ll:truncate">
          AI Ghost: {pending.summary}
        </span>
        <span className="ll:text-nano ll:text-muted ll:shrink-0">
          {totalClips} clip(s) · {totalEffects} effect(s)
        </span>
      </div>

      <div className="ll:flex ll:items-center ll:gap-1.5 ll:shrink-0">
        <button
          type="button"
          onClick={discardAll}
          className="ll:h-6 ll:px-2 ll:rounded-sm ll:border ll:border-border ll:bg-surface-panel ll:text-nano ll:text-secondary ll:hover:text-primary ll:cursor-pointer"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={() => acceptAll()}
          className="ll:h-6 ll:px-2 ll:rounded-sm ll:bg-control-primary-bg ll:text-control-primary-fg ll:text-nano ll:font-medium ll:cursor-pointer"
        >
          Accept all
        </button>
      </div>
    </div>
  );
};
