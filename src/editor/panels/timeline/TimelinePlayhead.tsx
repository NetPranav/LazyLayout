"use client";

import React, { useRef, useEffect } from "react";
import { frameScheduler } from "@/core/time/scheduler";
import { getTransport } from "@/core/time/transport";
import {
  useMotionModel,
  X,
  timecode,
} from "@/editor/motion-model";

export interface TimelinePlayheadProps {
  laneWidth?: number;
  trackWidth?: number;
  pps?: number;
  hoverX?: number | null;
  hoverFrame?: number | null;
  snapFlashFrame?: number | null;
  // Legacy compatibility props
  duration?: number;
  pixelsPerSecond?: number;
  currentTime?: number;
  onSeek?: (timeSec: number) => void;
}

export const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  laneWidth = 600,
  trackWidth = 264,
  pps: propPps,
  hoverX = null,
  hoverFrame = null,
  snapFlashFrame = null,
  pixelsPerSecond: legacyPps,
}) => {
  const dur = useMotionModel((s) => s.comp.dur);
  const fps = useMotionModel((s) => s.fps);
  const t0 = useMotionModel((s) => s.t0);
  const wa = useMotionModel((s) => s.wa);
  const isPlaying = useMotionModel((s) => s.playing);
  // While playing, needle position is driven by direct DOM updates from frameScheduler "overlay" phase.
  // We subscribe only to paused playhead so React does not commit every frame during playback.
  const pausedPlayhead = useMotionModel((s) => (s.playing ? 0 : s.playhead));
  const playhead = isPlaying ? Math.round(getTransport().time * (getTransport().fps || 60)) : pausedPlayhead;
  const markers = useMotionModel((s) => s.comp.markers);
  const frames = useMotionModel((s) => s.frames);

  const pps = propPps ?? legacyPps ?? 100;

  const needleRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);

  const ppsRef = useRef(pps);
  const t0Ref = useRef(t0);
  const laneWidthRef = useRef(laneWidth);
  const fpsRef = useRef(fps);

  useEffect(() => {
    ppsRef.current = pps;
    t0Ref.current = t0;
    laneWidthRef.current = laneWidth;
    fpsRef.current = fps;
  }, [pps, t0, laneWidth, fps]);

  // Direct DOM updates for playhead needle during playback (ROADMAP Phase 56)
  useEffect(() => {
    return frameScheduler.register("overlay", () => {
      const t = getTransport();
      if (!t.playing) return;
      const curFps = fpsRef.current || 60;
      const currentFrame = Math.round(t.time * curFps);
      const ppsVal = ppsRef.current;
      const t0Val = t0Ref.current;
      const laneWidthVal = laneWidthRef.current;

      const phX = X(currentFrame, ppsVal, t0Val, 24, curFps);
      const needle = needleRef.current;
      if (needle) {
        needle.style.transform = `translateX(${phX}px)`;
        needle.setAttribute("data-frame", String(currentFrame));
        needle.setAttribute("data-time", String(currentFrame));
        const isVisible = phX >= -6 && phX <= laneWidthVal + 6;
        needle.style.display = isVisible ? "" : "none";
      }
      const layer = layerRef.current;
      if (layer) {
        layer.setAttribute("data-frame", String(currentFrame));
        layer.setAttribute("data-time", String(currentFrame));
      }
    });
  }, []);

  const phX = X(playhead, pps, t0, 24, fps);
  const waX0 = X(wa.a, pps, t0, 24, fps);
  const waX1 = X(wa.b, pps, t0, 24, fps);
  const endX = X(dur, pps, t0, 24, fps);

  const isPhVisible = phX >= -6 && phX <= laneWidth + 6;

  return (
    <>
      {/* 1. Playhead and Markers Overlay */}
      <div
        ref={layerRef}
        style={{ left: `${trackWidth}px` }}
        data-testid="timeline-playhead-layer"
        data-time={Math.round(playhead)}
        data-frame={Math.round(playhead)}
        className="ll-tlhd ll:absolute ll:right-0 ll:top-0 ll:bottom-0 ll:pointer-events-none ll:overflow-hidden ll:z-20"
      >
        {/* Work area dimming left */}
        {wa.a > 0 && (
          <div
            style={{ left: 0, width: `${Math.max(0, waX0)}px` }}
            className="ll-wad ll:absolute ll:top-8 ll:bottom-0 ll:bg-surface-canvas/60"
          />
        )}

        {/* Work area dimming right */}
        {wa.b < dur && (
          <div
            style={{ left: `${waX1}px`, right: 0 }}
            className="ll-wad ll:absolute ll:top-8 ll:bottom-0 ll:bg-surface-canvas/60"
          />
        )}

        {/* Markers vertical lines */}
        {markers.map((m) => {
          const mx = X(m.t, pps, t0, 24, fps);
          return (
            <i
              key={`mkl-${m.id}`}
              style={{ left: `${mx}px` }}
              className="ll-mkl ll:absolute ll:top-8 ll:bottom-0 ll:w-px ll:bg-muted/50"
            />
          );
        })}

        {/* End of composition line */}
        <i
          style={{ left: `${endX}px` }}
          className="ll-endl ll:absolute ll:top-8 ll:bottom-0 ll:w-px ll:bg-border"
        />

        {/* Playhead needle (direct DOM updated at 60fps while playing; React rendered when paused) */}
        <div
          ref={needleRef}
          style={{
            transform: `translateX(${phX}px)`,
            ...(isPhVisible ? {} : { display: "none" }),
          }}
          data-testid="timeline-playhead"
          data-time={Math.round(playhead)}
          data-frame={Math.round(playhead)}
          className="ll-phl ll:absolute ll:left-0 ll:top-0 ll:bottom-0 ll:w-px ll:bg-control-active ll:will-change-transform"
        >
          {/* Playhead Knob on ruler */}
          <div className="ll:absolute ll:-left-1.5 ll:top-2 ll:w-3 ll:h-3 ll:bg-control-active ll:rounded-xs ll:shadow-xs" />
        </div>
      </div>

      {/* 2. Hover Guide Line & Tooltip */}
      {hoverX !== null && hoverFrame !== null && (
        <>
          <i
            style={{
              left: `${trackWidth}px`,
              transform: `translateX(${hoverX}px)`,
            }}
            className="ll-hvl ll:absolute ll:top-8 ll:bottom-0 ll:w-px ll:bg-muted/60 ll:pointer-events-none ll:z-20"
          />
          <span
            style={{
              left: `${trackWidth}px`,
              transform: `translateX(${Math.min(hoverX + 6, laneWidth - 60)}px)`,
            }}
            className="ll-hvt ll:absolute ll:top-1 ll:h-4.5 ll:px-1.5 ll:flex ll:items-center ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:font-mono ll:text-nano ll:text-primary ll:shadow-sm ll:pointer-events-none ll:z-30 ll:whitespace-nowrap"
          >
            {frames ? String(hoverFrame) : timecode(hoverFrame, fps)}
          </span>
        </>
      )}

      {/* 3. Snapping indicator flash line */}
      {snapFlashFrame !== null && (
        <i
          style={{
            left: `${trackWidth}px`,
            transform: `translateX(${X(snapFlashFrame, pps, t0, 24, fps)}px)`,
          }}
          className="ll-snl ll-snl-on ll:absolute ll:top-0 ll:bottom-0 ll:w-px ll:bg-primary ll:pointer-events-none ll:z-30"
        />
      )}
    </>
  );
};
