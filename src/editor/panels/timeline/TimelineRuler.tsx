"use client";

import React, { useRef } from "react";
import { useTimelineUiStore } from "@/core/store/useTimelineUiStore";
import { Icon } from "@/editor/components/Icon";
import { X as CloseIcon } from "lucide-react";
import {
  useMotionModel,
  motionActions,
  majorOf,
  minorOf,
  X,
  Fx,
  snapT,
} from "@/editor/motion-model";

export interface TimelineRulerProps {
  laneWidth?: number;
  pps?: number;
  trackWidth?: number;
  onSnapFlash?: (frame: number) => void;
  onContextMenu?: (e: React.MouseEvent, frame: number) => void;
  // Legacy compatibility props
  duration?: number;
  pixelsPerSecond?: number;
  contentWidth?: number;
  currentTime?: number;
  onSeek?: (timeSec: number) => void;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  laneWidth = 600,
  pps: propPps,
  trackWidth = 264,
  onSnapFlash,
  onContextMenu,
  duration: legacyDur,
  pixelsPerSecond: legacyPps,
  contentWidth: _contentWidth,
  currentTime: _currentTime,
  onSeek: legacySeek,
}) => {
  const storeDur = useMotionModel((s) => s.comp.dur);
  const dur = legacyDur ? Math.round(legacyDur * 60) : storeDur;
  const pps = propPps ?? legacyPps ?? 100;
  const fps = useMotionModel((s) => s.fps);
  const t0 = useMotionModel((s) => s.t0);
  const wa = useMotionModel((s) => s.wa);
  const markers = useMotionModel((s) => s.comp.markers);
  const frames = useMotionModel((s) => s.frames);
  const view = useMotionModel((s) => s.view);
  const snap = useMotionModel((s) => s.snap);
  const comp = useMotionModel((s) => s.comp);
  const playhead = useMotionModel((s) => s.playhead);

  const rulerRef = useRef<HTMLDivElement | null>(null);

  const maj = majorOf(pps, fps);
  const min = minorOf(maj);

  // Generate tick candidates
  const startF = Math.max(0, Math.floor(Fx(-12, pps, t0, 24, fps) / min) * min);
  const ticks: Array<{ f: number; isMajor: boolean; x: number; label?: string; lw?: number }> = [];

  for (let f = startF; f <= dur; f += min) {
    const x = X(f, pps, t0, 24, fps);
    if (x > laneWidth + 12) break;

    const isMajor = f % maj === 0;
    let label: string | undefined;
    let lw: number | undefined;

    if (isMajor) {
      if (frames) {
        label = String(f);
      } else {
        const s = f / fps;
        label = s >= 60 && f % fps === 0 ? `${Math.floor(s / 60)}:${(s % 60 < 10 ? "0" : "") + (s % 60)}` : `${+s.toFixed(2)}s`;
      }
      lw = label.length * 6.6;
      // In P line 4609: suppress label if it would overflow or collide with a marker
      const markerCollision = markers.some((m) => {
        const mx = X(m.t, pps, t0, 24, fps);
        return mx < x + 5 + (lw ?? 24) && mx + 20 > x + 5;
      });
      if (x + 5 < 2 || x + 5 + (lw ?? 24) > laneWidth - 4 || markerCollision) {
        label = undefined;
      }
    }

    ticks.push({ f, isMajor, x, label, lw });
  }

  // Work area positions
  const waX0 = X(wa.a, pps, t0, 24, fps);
  const waX1 = X(wa.b, pps, t0, 24, fps);

  // Ruler pointer down handler (seek & drag)
  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !rulerRef.current) return;
    if ((e.target as HTMLElement).closest(".wah") || (e.target as HTMLElement).closest(".mk")) return;
    e.preventDefault();

    useTimelineUiStore.getState().setIsScrubbing(true);

    // Pause playback immediately if playing (matching P line 4962)
    if (useMotionModel.getState().playing) {
      motionActions.setPlaying(false);
    }

    const startClientX = e.clientX;

    const getFrame = (clientX: number) => {
      const rect = rulerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const x = clientX - rect.left;
      const rawF = Fx(x, pps, t0, 24, fps);
      const res = snapT(rawF, comp, snap, pps, fps, undefined, undefined, true, playhead);
      if (res.hit) {
        onSnapFlash?.(res.snapped);
      }
      return Math.round(res.snapped);
    };

    const initialF = getFrame(e.clientX);
    // Click seek glides on spring (matching P line 4963: seek(..., true))
    motionActions.setPlayhead(initialF, true);
    legacySeek?.(initialF / 60);

    const onPointerMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startClientX) > 2) {
        // Dragging scrubs immediately without glide (matching P line 4964)
        const f = getFrame(ev.clientX);
        motionActions.setPlayhead(f, false);
        legacySeek?.(f / 60);
      }
    };

    const onPointerUp = () => {
      useTimelineUiStore.getState().setIsScrubbing(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  // Work area handle drag
  const handleWaHandleDown = (e: React.PointerEvent, handle: "a" | "b") => {
    e.stopPropagation();
    e.preventDefault();

    const getFrame = (clientX: number) => {
      const rect = rulerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const x = clientX - rect.left;
      const rawF = Fx(x, pps, t0, 24, fps);
      const res = snapT(rawF, comp, snap, pps, fps, undefined, undefined, true, playhead);
      if (res.hit) {
        onSnapFlash?.(res.snapped);
      }
      return Math.round(res.snapped);
    };

    const onPointerMove = (ev: PointerEvent) => {
      const f = getFrame(ev.clientX);
      if (handle === "a") {
        motionActions.setWorkArea(Math.min(f, wa.b - 1), wa.b);
      } else {
        motionActions.setWorkArea(wa.a, Math.max(f, wa.a + 1));
      }
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div
      role="row"
      style={{ gridTemplateColumns: `${trackWidth}px minmax(0, 1fr)` }}
      className="ll-tlrow ll-tlrul ll:grid ll:h-8 ll:sticky ll:top-0 ll:z-10 ll:bg-surface-panel ll:border-b ll:border-border ll:shrink-0 ll:select-none"
    >
      {/* 1. Header Column (sticky top-left) */}
      <div className="ll-tlhc ll-tlhh ll:flex ll:items-center ll:pl-4 ll:pr-2 ll:border-r ll:border-border ll:bg-surface-panel ll:text-muted">
        <span className="ll:font-mono ll:text-micro ll:font-micro ll:uppercase">
          {view === "graph" ? "Properties" : "Layers"}
        </span>
      </div>

      {/* 2. Lane Ruler Area */}
      <div
        ref={rulerRef}
        id="tlruler"
        data-testid="timeline-ruler"
        data-pps={pps}
        data-t0={t0}
        data-fps={fps}
        onPointerDown={handleRulerPointerDown}
        onContextMenu={(e) => {
          const rect = rulerRef.current?.getBoundingClientRect();
          const x = rect ? e.clientX - rect.left : 0;
          const f = Math.round(Fx(x, pps, t0, 24, fps));
          onContextMenu?.(e, f);
        }}
        className="ll-tlln ll-tlruler ll:relative ll:h-full ll:cursor-pointer ll:overflow-hidden ll:bg-surface-panel"
      >
        {/* Ticks and labels */}
        {ticks.map((t, idx) => (
          <React.Fragment key={`tick-${t.f}-${idx}`}>
            <i
              style={{
                left: `${t.x}px`,
                height: t.isMajor ? "9px" : "5px",
              }}
              className={`ll-tk ${t.isMajor ? "M" : ""} ll:absolute ll:bottom-0 ll:w-px ll:bg-muted ll:pointer-events-none ${
                t.isMajor ? "ll:opacity-100" : "ll:opacity-60"
              }`}
            />
            {t.isMajor && t.label && (
              <span
                data-x={t.x + 5}
                data-w={t.lw ?? 24}
                style={{
                  left: `${t.x + 5}px`,
                  top: "13px",
                  lineHeight: "1",
                }}
                className="ll-tkl ll:absolute ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:pointer-events-none ll:whitespace-nowrap"
              >
                {t.label}
              </span>
            )}
          </React.Fragment>
        ))}

        {/* Work area bar */}
        <div
          style={{
            left: `${waX0}px`,
            width: `${Math.max(0, waX1 - waX0)}px`,
          }}
          className="ll-wa ll:absolute ll:top-0.5 ll:h-1 ll:bg-secondary ll:pointer-events-none"
        />

        {/* Work area handle Left */}
        <i
          onPointerDown={(e) => handleWaHandleDown(e, "a")}
          title="Work area start (I)"
          style={{ left: `${waX0 - 3}px` }}
          className="ll-wah ll:absolute ll:top-0 ll:w-1.5 ll:h-2 ll:bg-secondary ll:cursor-ew-resize ll:z-10"
        />

        {/* Work area handle Right */}
        <i
          onPointerDown={(e) => handleWaHandleDown(e, "b")}
          title="Work area end (O)"
          style={{ left: `${waX1 - 3}px` }}
          className="ll-wah ll:absolute ll:top-0 ll:w-1.5 ll:h-2 ll:bg-secondary ll:cursor-ew-resize ll:z-10"
        />

        {/* Markers */}
        {markers.map((m, i) => {
          const mx = X(m.t, pps, t0, 24, fps);
          return (
            <div
              key={m.id}
              style={{ left: `${mx}px`, top: "11px", height: "14px" }}
              className="ll-mk ll:group ll:absolute ll:flex ll:items-center ll:z-20"
            >
              <button
                type="button"
                data-mk="seek"
                data-m={m.id}
                onClick={(e) => {
                  e.stopPropagation();
                  motionActions.setPlayhead(m.t, true);
                }}
                title={`${m.name}, frame ${m.t}`}
                aria-label={`${m.name} at frame ${m.t}`}
                className="ll-mkb ll:min-w-3.5 ll:px-0.75 ll:bg-control-active ll:text-control-active-fg ll:font-mono ll:text-nano ll:font-medium ll:leading-3.5 ll:rounded-xs ll:text-center ll:group-hover:rounded-r-none"
              >
                {i + 1}
              </button>
              <button
                type="button"
                data-mk="del"
                data-m={m.id}
                onClick={(e) => {
                  e.stopPropagation();
                  motionActions.deleteMarker(m.id);
                }}
                title="Delete marker"
                aria-label={`Delete ${m.name}`}
                className="ll-mkx ll:hidden ll:group-hover:flex ll:items-center ll:justify-center ll:w-3.5 ll:h-3.5 ll:bg-control-active ll:text-control-active-fg ll:rounded-r-xs"
              >
                <Icon icon={CloseIcon} size={10} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
