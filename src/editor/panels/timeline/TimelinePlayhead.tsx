"use client";

import React, { forwardRef, useCallback } from "react";
import {
  PLAYHEAD_KNOB_WIDTH_PX,
  PLAYHEAD_KNOB_HEIGHT_PX,
  PLAYHEAD_KNOB_OFFSET_PX,
  PLAYHEAD_LINE_WIDTH_PX,
} from "./constants";

export interface TimelinePlayheadProps {
  duration: number;
  pixelsPerSecond: number;
  currentTime?: number;
  onSeek: (timeSec: number) => void;
}

export const TimelinePlayhead = forwardRef<HTMLDivElement, TimelinePlayheadProps>(
  function TimelinePlayhead({ duration, pixelsPerSecond, currentTime = 0, onSeek }, ref) {
    const handleKnobPointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();

        const startClientX = e.clientX;
        const needleEl = (e.currentTarget.parentElement) as HTMLElement | null;
        const initialTransform = needleEl?.style.transform || "";
        const match = /translateX\(([-\d.]+)px\)/.exec(initialTransform);
        const initialX = match ? parseFloat(match[1]) : 0;

        const handlePointerMove = (ev: PointerEvent) => {
          const deltaPx = ev.clientX - startClientX;
          const currentX = initialX + deltaPx;
          const time = Math.max(0, Math.min(duration, currentX / pixelsPerSecond));
          onSeek(time);
        };

        const handlePointerUp = () => {
          window.removeEventListener("pointermove", handlePointerMove);
          window.removeEventListener("pointerup", handlePointerUp);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
      },
      [duration, onSeek, pixelsPerSecond]
    );

    return (
      <div
        ref={ref}
        data-timeline-needle="true"
        className="ll-head2 ll:absolute ll:top-0 ll:bottom-0 ll:left-0 ll:pointer-events-none ll:z-20 ll:transition-none"
      >
        {/* Playhead Knob on ruler */}
        <div
          role="slider"
          aria-label="Playhead knob"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          onPointerDown={handleKnobPointerDown}
          style={{
            width: `${PLAYHEAD_KNOB_WIDTH_PX}px`,
            height: `${PLAYHEAD_KNOB_HEIGHT_PX}px`,
            left: `${PLAYHEAD_KNOB_OFFSET_PX}px`,
            top: 0,
          }}
          className="ll:absolute ll:bg-control-primary ll:rounded-xs ll:pointer-events-auto ll:cursor-ew-resize ll:shadow-sm"
        />

        {/* 1px Playhead Needle line */}
        <div
          style={{ width: `${PLAYHEAD_LINE_WIDTH_PX}px` }}
          className="ll:h-full ll:bg-control-primary"
        />
      </div>
    );
  }
);
