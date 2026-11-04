"use client";

import React, { useCallback, useRef } from "react";
import {
  TIMELINE_RULER_HEIGHT_PX,
  RULER_MIN_TICK_DISTANCE_PX,
} from "./constants";

export interface TimelineRulerProps {
  duration: number;
  pixelsPerSecond: number;
  contentWidth: number;
  currentTime?: number;
  onSeek: (timeSec: number) => void;
}

const STEP_CANDIDATES = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60] as const;

function calculateTickStep(pixelsPerSecond: number): number {
  for (const step of STEP_CANDIDATES) {
    if (step * pixelsPerSecond >= RULER_MIN_TICK_DISTANCE_PX) {
      return step;
    }
  }
  return 1;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  duration,
  pixelsPerSecond,
  contentWidth,
  currentTime = 0,
  onSeek,
}) => {
  const rulerRef = useRef<HTMLDivElement | null>(null);

  const tickStep = calculateTickStep(pixelsPerSecond);
  const ticks: Array<{ time: number; left: number; label: string }> = [];

  for (let t = 0; t <= duration + 0.0001; t += tickStep) {
    const rounded = Math.round(t * 1000) / 1000;
    const label = Number.isInteger(rounded)
      ? `${rounded}s`
      : `${rounded.toFixed(1)}s`;
    ticks.push({
      time: rounded,
      left: rounded * pixelsPerSecond,
      label,
    });
  }

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !rulerRef.current) return;
      e.preventDefault();

      const updateSeek = (clientX: number) => {
        if (!rulerRef.current) return;
        const rect = rulerRef.current.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const time = offsetX / pixelsPerSecond;
        onSeek(time);
      };

      updateSeek(e.clientX);

      const handlePointerMove = (ev: PointerEvent) => {
        updateSeek(ev.clientX);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [onSeek, pixelsPerSecond]
  );

  return (
    <div
      ref={rulerRef}
      role="slider"
      aria-label="Timeline time ruler"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      onPointerDown={handlePointerDown}
      style={{
        height: `${TIMELINE_RULER_HEIGHT_PX}px`,
        width: `${contentWidth}px`,
      }}
      className="ll-truler ll:relative ll:h-6 ll:border-b ll:border-border ll:bg-surface-panel ll:cursor-pointer ll:select-none ll:shrink-0 ll:overflow-hidden"
    >
      {ticks.map((tick) => (
        <span
          key={`tick-${tick.time}`}
          style={{ left: `${tick.left}px` }}
          className="ll:absolute ll:top-1.5 ll:pl-1 ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:pointer-events-none ll:select-none"
        >
          {tick.label}
        </span>
      ))}
    </div>
  );
};
