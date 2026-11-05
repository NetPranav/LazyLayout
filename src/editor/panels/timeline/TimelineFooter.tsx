"use client";

import React, { useState, useRef } from "react";
import { Icon } from "@/editor/components/Icon";
import {
  Magnet,
  Scan,
  ChevronDown,
} from "lucide-react";
import { Menu, MenuItem } from "@/editor/components/Menu";
import {
  useMotionModel,
  motionActions,
  timecode,
  layerName,
  isGrp,
  lblOf,
  allKeys,
  clampN,
} from "@/editor/motion-model";
import { FPS_OPTIONS } from "./constants";

export interface TimelineFooterProps {
  trackWidth: number;
}

export const TimelineFooter: React.FC<TimelineFooterProps> = ({ trackWidth }) => {
  const comp = useMotionModel((s) => s.comp);
  const playhead = useMotionModel((s) => s.playhead);
  const fps = useMotionModel((s) => s.fps);
  const zoom = useMotionModel((s) => s.zoom);
  const t0 = useMotionModel((s) => s.t0);
  const wa = useMotionModel((s) => s.wa);
  const snap = useMotionModel((s) => s.snap);
  const frames = useMotionModel((s) => s.frames);
  const selectedKeys = useMotionModel((s) => s.selectedKeys);

  const [fpsMenuOpen, setFpsMenuOpen] = useState(false);
  const [fpsAnchor, setFpsAnchor] = useState<{ x: number; y: number } | null>(null);

  const minimapRef = useRef<HTMLDivElement | null>(null);

  // 1. Selection summary text
  const selKeyIds = Object.keys(selectedKeys);
  let summaryText = "Nothing selected";

  if (selKeyIds.length > 0) {
    const times: number[] = [];
    for (const l of comp.layers) {
      for (const tr of l.tr) {
        for (const k of tr.keys) {
          if (selectedKeys[k.id]) times.push(k.t);
        }
      }
    }
    if (times.length === 1) {
      const tStr = frames ? String(times[0]) : timecode(times[0], fps);
      summaryText = `1 keyframe · ${tStr}`;
    } else if (times.length > 1) {
      const minT = Math.min(...times);
      const maxT = Math.max(...times);
      const tMinStr = frames ? String(minT) : timecode(minT, fps);
      const tMaxStr = frames ? String(maxT) : timecode(maxT, fps);
      summaryText = `${times.length} keyframes · ${tMinStr} – ${tMaxStr}`;
    }
  } else if (comp.layers.length > 0) {
    const firstLayer = comp.layers[0];
    const grp = isGrp(firstLayer);
    summaryText = `${layerName(firstLayer.id)} · ${
      grp ? "group" : `${firstLayer.clips.length} clip${firstLayer.clips.length > 1 ? "s" : ""}`
    }`;
  }

  // Work area text
  const waLength = wa.b - wa.a;
  const waStr = frames ? String(waLength) : timecode(waLength, fps);

  // Mini-map calculations
  const totalSecs = comp.dur / fps;
  const windowLeftPct = Math.max(0, (t0 / totalSecs) * 100);
  const windowWidthPct = Math.min(100, (100 / zoom));
  const playheadPct = (playhead / comp.dur) * 100;

  // Mini-map pointer down (window drag or edge zoom)
  const handleMinimapPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !minimapRef.current) return;
    e.preventDefault();

    const rect = minimapRef.current.getBoundingClientRect();
    const handleEl = (e.target as HTMLElement).closest(".tmh");
    const edge = handleEl?.getAttribute("data-e");

    const getFraction = (clientX: number) => {
      return clampN((clientX - rect.left) / rect.width, 0, 1);
    };

    const L0 = t0 / totalSecs;
    const R0 = L0 + 1 / zoom;

    if (edge === "l") {
      const onPointerMove = (ev: PointerEvent) => {
        const p = getFraction(ev.clientX);
        const nextZoom = clampN(1 / (R0 - Math.min(p, R0 - 1 / 32)), 1, 32);
        const nextT0 = (R0 - 1 / nextZoom) * totalSecs;
        motionActions.setZoom(nextZoom);
        motionActions.setT0(nextT0);
      };
      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      return;
    }

    if (edge === "r") {
      const onPointerMove = (ev: PointerEvent) => {
        const p = getFraction(ev.clientX);
        const nextZoom = clampN(1 / (Math.max(p, L0 + 1 / 32) - L0), 1, 32);
        motionActions.setZoom(nextZoom);
      };
      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      return;
    }

    // Window pan or click to jump
    const startFrac = getFraction(e.clientX);
    const isInsideWindow = startFrac >= L0 && startFrac <= R0;
    const offset = isInsideWindow ? startFrac - L0 : 0.5 / zoom;

    const updatePan = (clientX: number) => {
      const p = getFraction(clientX);
      const nextT0 = (p - offset) * totalSecs;
      motionActions.setT0(nextT0);
    };

    updatePan(e.clientX);

    const onPointerMove = (ev: PointerEvent) => {
      updatePan(ev.clientX);
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
      role="region"
      aria-label="Timeline footer"
      className="ll-tlf ll:h-7 ll:flex ll:items-center ll:gap-3 ll:px-3 ll:border-t ll:border-border ll:bg-surface-panel ll:font-mono ll:text-micro ll:text-muted ll:shrink-0 ll:min-w-0 ll:select-none"
    >
      {/* 1. Selection summary */}
      <span
        style={{ width: `${trackWidth - 24}px` }}
        className="ll-tfs ll:shrink-0 ll:truncate ll:text-muted"
        aria-live="polite"
      >
        {summaryText}
      </span>

      {/* 2. Mini-map overview */}
      <div
        ref={minimapRef}
        onPointerDown={handleMinimapPointerDown}
        title="Timeline overview. Drag window to pan, drag edges to zoom."
        className="ll-tmm ll:relative ll:flex-1 ll:min-w-20 ll:h-5 ll:bg-surface-panel ll:border ll:border-border ll:rounded-xs ll:overflow-hidden ll:cursor-pointer"
      >
        {/* Background clips summary */}
        <div className="ll-tmc ll:absolute ll:inset-0 ll:pointer-events-none">
          {comp.layers.map((l, i) => {
            const rh = Math.max(2, Math.min(4, Math.floor(16 / Math.max(1, comp.layers.length))));
            const lbl = lblOf(l);
            return l.clips.map((c, j) => {
              const leftPct = (c.s / comp.dur) * 100;
              const widthPct = Math.max(1, ((c.e - c.s) / comp.dur) * 100);
              return (
                <i
                  key={`mc-${l.id}-${j}`}
                  style={{
                    top: `${2 + i * rh}px`,
                    height: `${rh - 1}px`,
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    backgroundColor: `var(--ll-label-${lbl})`,
                  }}
                  className="ll:absolute ll:rounded-2xs ll:opacity-75"
                />
              );
            });
          })}
        </div>

        {/* Draggable viewport window */}
        <div
          style={{
            left: `${windowLeftPct}%`,
            width: `${windowWidthPct}%`,
          }}
          className="ll-tmw ll:absolute ll:top-0 ll:bottom-0 ll:bg-primary/10 ll:border ll:border-primary/30 ll:rounded-2xs ll:cursor-grab ll:active:cursor-grabbing"
        >
          {/* Left handle */}
          <i
            data-e="l"
            className="tmh ll:absolute ll:left-0 ll:top-0 ll:bottom-0 ll:w-1.5 ll:cursor-ew-resize ll:hover:bg-primary/30"
          />
          {/* Right handle */}
          <i
            data-e="r"
            className="tmh ll:absolute ll:right-0 ll:top-0 ll:bottom-0 ll:w-1.5 ll:cursor-ew-resize ll:hover:bg-primary/30"
          />
        </div>

        {/* Mini-map playhead line */}
        <i
          style={{ left: `${playheadPct}%` }}
          className="ll-tmp ll:absolute ll:top-0 ll:bottom-0 ll:w-px ll:bg-primary ll:pointer-events-none"
        />
      </div>

      {/* 3. Zoom Slider */}
      <div className="ll:flex ll:items-center ll:w-20 ll:shrink-0">
        <input
          type="range"
          min="0"
          max="5"
          step="0.01"
          value={Math.log2(zoom)}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            motionActions.setZoom(Math.pow(2, val));
          }}
          title="Timeline zoom"
          aria-label="Timeline zoom"
          className="ll-sld ll:w-full ll:h-1 ll:accent-primary ll:cursor-pointer"
        />
      </div>

      {/* 4. Fit Timeline Button */}
      <button
        type="button"
        onClick={() => {
          motionActions.setZoom(1);
          motionActions.setT0(0);
        }}
        aria-label="Fit the timeline"
        title="Fit the timeline (\\)"
        className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
      >
        <Icon icon={Scan} size={13} />
      </button>

      <span className="ll:w-px ll:h-3.5 ll:bg-border ll:mx-0.5" aria-hidden="true" />

      {/* 5. Frame rate dropdown button */}
      <button
        type="button"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setFpsAnchor({ x: rect.left, y: rect.top - 4 });
          setFpsMenuOpen(true);
        }}
        aria-label="Frame rate"
        title="Frame rate"
        className="ll-tfb ll:h-6 ll:px-1.5 ll:flex ll:items-center ll:gap-1 ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
      >
        <span>{fps} fps</span>
        <Icon icon={ChevronDown} size={11} className="ll:text-muted" />
      </button>

      {fpsMenuOpen && fpsAnchor && (
        <Menu
          open={fpsMenuOpen}
          onClose={() => setFpsMenuOpen(false)}
          position={fpsAnchor}
        >
          {FPS_OPTIONS.map((f) => (
            <MenuItem
              key={f}
              onClick={() => {
                motionActions.setComp({ fps: f });
                setFpsMenuOpen(false);
              }}
            >
              {f} fps
            </MenuItem>
          ))}
        </Menu>
      )}

      {/* 6. Snapping toggle button */}
      <button
        type="button"
        onClick={() => motionActions.toggleSnap()}
        aria-pressed={snap}
        aria-label={`Snapping ${snap ? "on" : "off"}`}
        title={`Snapping ${snap ? "on" : "off"}`}
        className={`ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${
          snap
            ? "ll:text-control-active ll:bg-surface-hover"
            : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
        }`}
      >
        <Icon icon={Magnet} size={13} />
      </button>

      {/* 7. Work area button */}
      <button
        type="button"
        onClick={() => motionActions.resetWorkArea()}
        title="Work area length. Click to clear work area."
        className="ll-tfb ll:h-6 ll:px-1.5 ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
      >
        Work area {waStr}
      </button>
    </div>
  );
};
