"use client";

import React, { useMemo } from "react";
import { useStageOriginStore } from "./stageOrigin";

export interface RulersProps {
  showRulers?: boolean;
  zoom?: number;
}

/** Ticks a comfortable distance apart at this zoom, covering what is on screen. */
function ticksFor(zoom: number, origin: number, length: number, key: "left" | "top"): Array<{ val: number; left: number; top: number }> {
  const z = zoom > 0 ? zoom : 1;
  const step = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find((s) => s * z >= 90) ?? 10000;
  const from = Math.floor(-origin / z / step) * step;
  const to = Math.ceil((length - origin) / z / step) * step;
  const out: Array<{ val: number; left: number; top: number }> = [];
  for (let v = from; v <= to && out.length < 200; v += step) {
    const at = Math.round(origin + v * z);
    out.push({ val: v, left: key === "left" ? at : 0, top: key === "top" ? at : 0 });
  }
  return out;
}

/**
 * Top and left canvas rulers with tick marks and the origin corner (.ll-rc0).
 * Tick positions adapt proportionally to the canvas zoom level.
 */
export const Rulers: React.FC<RulersProps> = ({
  showRulers = true,
  zoom = 0.59,
}) => {
  // The page's corner on screen, in the rulers' own space: the ticks follow pan and zoom, and 0 is the page's edge.
  const origin = useStageOriginStore((o) => o.origin);
  const horizontalTicks = useMemo(() => ticksFor(zoom, origin.x, origin.width, "left"), [zoom, origin.x, origin.width]);
  const verticalTicks = useMemo(() => ticksFor(zoom, origin.y, origin.height, "top"), [zoom, origin.y, origin.height]);

  if (!showRulers) return null;

  return (
    <>
      {/* Origin Corner (.ll-rc0) */}
      <div
        className="ll-rc0 ll:absolute ll:left-0 ll:top-0 ll:w-ruler ll:h-ruler ll:bg-surface-panel ll:border-r ll:border-b ll:border-border ll:z-20 ll:pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Horizontal Ruler (.ll-rt) */}
      <div
        data-ruler="horizontal"
        className="ll-rt ll:absolute ll:left-ruler ll:right-0 ll:top-0 ll:h-ruler ll:bg-surface-panel ll:border-b ll:border-border ll:overflow-hidden ll:select-none ll:z-10"
        aria-hidden="true"
      >
        {horizontalTicks.map(({ val, left }) => (
          <span
            key={val}
            className="ll:absolute ll:top-0.5 ll:pl-1 ll:border-l ll:border-muted ll:h-full ll:text-nano ll:font-mono ll:font-medium ll:text-muted ll:leading-none ll:pointer-events-none"
            style={{ left }}
          >
            {val}
          </span>
        ))}
      </div>

      {/* Left Vertical Ruler (.ll-rl) */}
      <div
        data-ruler="vertical"
        className="ll-rl ll:absolute ll:left-0 ll:top-ruler ll:bottom-0 ll:w-ruler ll:bg-surface-panel ll:border-r ll:border-border ll:overflow-hidden ll:select-none ll:z-10"
        aria-hidden="true"
      >
        {verticalTicks.map(({ val, top }) => (
          <span
            key={val}
            className="ll:absolute ll:left-0 ll:w-full ll:border-t ll:border-muted ll:pt-0.5 ll:text-nano ll:font-mono ll:font-medium ll:text-muted ll:leading-none ll:pointer-events-none"
            style={{ top }}
          >
            <b
              className="ll:block ll:font-medium ll:ml-1"
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
              }}
            >
              {val}
            </b>
          </span>
        ))}
      </div>
    </>
  );
};