"use client";

import React, { useMemo } from "react";
import { CANVAS_CHROME_SIZES } from "./constants";

export interface RulersProps {
  showRulers?: boolean;
  zoom?: number;
}

/**
 * Top and left canvas rulers with tick marks and the origin corner (.ll-rc0).
 * Tick positions adapt proportionally to the canvas zoom level.
 */
export const Rulers: React.FC<RulersProps> = ({
  showRulers = true,
  zoom = 0.59,
}) => {
  if (!showRulers) return null;

  // Generate horizontal ticks covering typical monitor widths in steps from constants
  const horizontalTicks = useMemo(() => {
    const ticks: { val: number; left: number }[] = [];
    const step = CANVAS_CHROME_SIZES.rulerTickStep;
    for (
      let i = CANVAS_CHROME_SIZES.rulerHorizontalMin;
      i <= CANVAS_CHROME_SIZES.rulerHorizontalMax;
      i += step
    ) {
      ticks.push({
        val: i,
        left: Math.round((i + step) * zoom),
      });
    }
    return ticks;
  }, [zoom]);

  // Generate vertical ticks covering typical canvas heights in steps from constants
  const verticalTicks = useMemo(() => {
    const ticks: { val: number; top: number }[] = [];
    const step = CANVAS_CHROME_SIZES.rulerTickStep;
    for (
      let j = CANVAS_CHROME_SIZES.rulerVerticalMin;
      j <= CANVAS_CHROME_SIZES.rulerVerticalMax;
      j += step
    ) {
      ticks.push({
        val: j,
        top: Math.round(j * zoom),
      });
    }
    return ticks;
  }, [zoom]);

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