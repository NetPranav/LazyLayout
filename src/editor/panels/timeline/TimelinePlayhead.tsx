"use client";

import React, { useEffect, useRef } from "react";
import {
  useMotionModel,
  X,
  timecode,
} from "@/editor/motion-model";
import { Spring } from "@/editor/motion/spring";
import { simAdd, simRemove } from "@/editor/motion/loop";
import { MOTION_PRESETS } from "@/editor/motion/presets";
import { getFeel } from "@/editor/motion/feel";
import { prefersReducedMotion } from "@/editor/motion/reducedMotion";

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
  const playhead = useMotionModel((s) => s.playhead);
  const playheadGlide = useMotionModel((s) => s.playheadGlide);
  const markers = useMotionModel((s) => s.comp.markers);
  const frames = useMotionModel((s) => s.frames);

  const pps = propPps ?? legacyPps ?? 100;

  const needleRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);

  // Damped spring instance for playhead gliding (matching P: M.ph = new Spring(M.T, mo().hl))
  const phSpringRef = useRef<Spring | null>(null);
  if (!phSpringRef.current) {
    const feel = getFeel();
    phSpringRef.current = new Spring(playhead, MOTION_PRESETS[feel].hl);
  }

  const waX0 = X(wa.a, pps, t0, 24, fps);
  const waX1 = X(wa.b, pps, t0, 24, fps);
  const endX = X(dur, pps, t0, 24, fps);

  // Direct DOM update function avoiding React re-render overhead at 60fps (Rule 4)
  const updateNeedle = (f: number) => {
    const x = X(f, pps, t0, 24, fps);
    if (needleRef.current) {
      needleRef.current.style.transform = `translateX(${x.toFixed(2)}px)`;
      needleRef.current.style.visibility = x < -6 || x > laneWidth + 6 ? "hidden" : "visible";
      needleRef.current.setAttribute("data-time", String(Math.round(f)));
    }
    if (layerRef.current) {
      layerRef.current.setAttribute("data-time", String(Math.round(f)));
    }

    // Hide ruler tick label under playhead head (matching P line 4708)
    const rulerLabels = document.querySelectorAll<HTMLElement>(".ll-tkl");
    rulerLabels.forEach((el) => {
      const lx = Number(el.dataset.x ?? 0);
      const lw = Number(el.dataset.w ?? 24);
      const hid = x + 9 > lx && x - 9 < lx + lw;
      el.classList.toggle("ll-hid", hid);
      el.style.visibility = hid ? "hidden" : "visible";
    });

    // Update mini-map playhead needle
    const miniNeedle = document.querySelector<HTMLElement>(".ll-tmp, #tmp");
    if (miniNeedle && dur > 0) {
      miniNeedle.style.left = `${((f / dur) * 100).toFixed(2)}%`;
    }
  };

  useEffect(() => {
    const sp = phSpringRef.current;
    if (!sp) return;

    if (playheadGlide && !prefersReducedMotion()) {
      const feel = getFeel();
      sp.tune(MOTION_PRESETS[feel].hl);
      sp.to = playhead;

      const sim = {
        sp: [sp],
        apply: () => {
          updateNeedle(sp.x);
        },
        rest: () => {
          updateNeedle(playhead);
          useMotionModel.setState({ playheadGlide: false });
        },
      };

      simAdd(sim);
      return () => {
        simRemove(sim);
      };
    } else {
      sp.jump(playhead);
      updateNeedle(playhead);
    }
  }, [playhead, playheadGlide, pps, t0, fps, laneWidth, dur]);

  const initX = X(playhead, pps, t0, 24, fps);
  const isPhVisible = initX >= -6 && initX <= laneWidth + 6;

  return (
    <>
      {/* 1. Playhead and Markers Overlay */}
      <div
        id="tlhd"
        ref={layerRef}
        style={{ left: `${trackWidth}px` }}
        data-testid="timeline-playhead-layer"
        data-time={Math.round(playhead)}
        className="ll-tlhd ll:absolute ll:right-0 ll:top-0 ll:bottom-0 ll:pointer-events-none ll:overflow-hidden ll:z-20"
      >
        {/* Work area dimming left */}
        {wa.a > 0 && (
          <div
            style={{ left: 0, width: `${Math.max(0, waX0)}px` }}
            className="ll-wad ll:absolute ll:top-8 ll:bottom-0 ll:bg-surface-panel/60"
          />
        )}

        {/* Work area dimming right */}
        {wa.b < dur && (
          <div
            style={{ left: `${waX1}px`, right: 0 }}
            className="ll-wad ll:absolute ll:top-8 ll:bottom-0 ll:bg-surface-panel/60"
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

        {/* Playhead needle (spanning ruler + all tracks) */}
        <div
          id="tlph"
          ref={needleRef}
          style={{
            transform: `translateX(${initX.toFixed(2)}px)`,
            visibility: isPhVisible ? "visible" : "hidden",
          }}
          data-testid="timeline-playhead"
          data-time={Math.round(playhead)}
          className="ll-phl ll:absolute ll:left-0 ll:top-0 ll:bottom-0 ll:w-px ll:bg-control-primary-bg ll:will-change-transform"
        >
          {/* Playhead Knob on ruler */}
          <div className="ll-phl-knob ll:absolute ll:top-playhead-knob ll:left-playhead-knob ll:w-playhead-knob ll:h-playhead-knob ll:bg-control-primary-bg ll:rounded-playhead-knob" />
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
            className="ll-hvt ll:absolute ll:top-0.5 ll:h-4.5 ll:px-1.5 ll:flex ll:items-center ll:bg-surface-raised ll:border ll:border-border ll:rounded-sm ll:font-mono ll:text-nano ll:font-medium ll:text-primary ll:shadow-sm ll:pointer-events-none ll:z-30 ll:whitespace-nowrap"
          >
            {frames ? String(hoverFrame) : timecode(hoverFrame, fps)}
          </span>
        </>
      )}

      {/* 3. Snapping indicator flash line */}
      {snapFlashFrame !== null && (
        <i
          id="snl"
          style={{
            left: `${trackWidth}px`,
            transform: `translateX(${X(snapFlashFrame, pps, t0, 24, fps).toFixed(1)}px)`,
          }}
          className="ll-snl ll-snl-on ll:absolute ll:top-0 ll:bottom-0 ll:w-px ll:bg-primary ll:pointer-events-none ll:z-30"
        />
      )}
    </>
  );
};
