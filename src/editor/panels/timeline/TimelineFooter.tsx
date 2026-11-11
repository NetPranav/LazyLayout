"use client";

import React, { useState, useRef } from "react";
import { Icon } from "@/editor/components/Icon";
import {
  Magnet,
  Scan,
  ChevronDown,
} from "lucide-react";
import { Menu, MenuItem } from "@/editor/components/Menu";
import { Slider } from "@/editor/components/Slider";
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
import { AutoKeyIcon, OnionSkinIcon } from "./icons";

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
  const autoKey = useMotionModel((s) => s.autoKey);
  const onionSkin = useMotionModel((s) => s.onionSkin);
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

  // Zoom slider calculations
  const logZoom = Math.log2(zoom);

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
      id="tlf"
      role="region"
      aria-label="Timeline footer"
      className="ll-tlf ll:h-7 ll:flex ll:items-center ll:gap-3 ll:px-3 ll:border-t ll:border-border ll:bg-surface-panel ll:font-mono ll:text-micro ll:font-body ll:text-muted ll:shrink-0 ll:min-w-0 ll:select-none"
    >
      {/* 1. Selection summary */}
      <span
        id="tfs"
        style={{ width: `${trackWidth - 24}px` }}
        className="ll-tfs ll:shrink-0 ll:truncate ll:text-muted"
        aria-live="polite"
      >
        {summaryText}
      </span>

      {/* 2. Mini-map overview */}
      <div
        id="tmm"
        ref={minimapRef}
        onPointerDown={handleMinimapPointerDown}
        title="Timeline overview. Drag the window to scroll, drag its edges to zoom."
        style={{ height: "20px" }}
        className="ll-tmm ll:relative ll:flex-1 ll:min-w-20 ll:h-5 ll:bg-surface-panel ll:cursor-pointer ll:touch-none"
      >
        {/* Background clips summary with 1px grid lines */}
        <div
          id="tmc"
          style={{
            background: `repeating-linear-gradient(90deg, color-mix(in srgb, var(--ll-text-muted) 22%, transparent) 0 1px, transparent 1px ${(100 / totalSecs).toFixed(2)}%)`,
          }}
          className="ll-tmc ll:absolute ll:inset-0 ll:pointer-events-none"
        >
          {comp.layers.map((l, i) => {
            const rh = Math.max(2, Math.min(4, Math.floor(16 / Math.max(1, comp.layers.length))));
            const lbl = lblOf(l);
            return l.clips.map((c, j) => {
              const leftPct = (c.s / comp.dur) * 100;
              const widthPct = Math.max(0.8, ((c.e - c.s) / comp.dur) * 100);
              return (
                <i
                  key={`mc-${l.id}-${j}`}
                  style={{
                    top: `${2 + i * rh}px`,
                    height: `${rh - 1}px`,
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    backgroundColor: `color-mix(in srgb, var(--ll-label-${lbl}) 55%, var(--ll-label-${lbl}-tint))`,
                  }}
                  className="ll:absolute ll:rounded-2xs"
                />
              );
            });
          })}
        </div>

        {/* Draggable viewport window */}
        <div
          id="tmw"
          style={{
            left: `${windowLeftPct}%`,
            width: `${windowWidthPct}%`,
            background: "color-mix(in srgb, var(--ll-text-primary) 7%, transparent)",
            boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--ll-text-primary) 28%, transparent)",
          }}
          className="ll-tmw ll:absolute ll:top-0 ll:bottom-0 ll:rounded-sm ll:cursor-grab ll:active:cursor-grabbing"
        >
          {/* Left handle with center tick */}
          <i
            data-e="l"
            className="tmh l ll:absolute ll:left--1 ll:top-0 ll:bottom-0 ll:w-2 ll:cursor-ew-resize"
          >
            <span
              style={{
                content: '""',
                position: "absolute",
                top: "5px",
                bottom: "5px",
                left: "3px",
                width: "2px",
                borderRadius: "1px",
                background: "var(--ll-text-muted)",
                opacity: 0.7,
              }}
            />
          </i>
          {/* Right handle with center tick */}
          <i
            data-e="r"
            className="tmh r ll:absolute ll:right--1 ll:top-0 ll:bottom-0 ll:w-2 ll:cursor-ew-resize"
          >
            <span
              style={{
                content: '""',
                position: "absolute",
                top: "5px",
                bottom: "5px",
                left: "3px",
                width: "2px",
                borderRadius: "1px",
                background: "var(--ll-text-muted)",
                opacity: 0.7,
              }}
            />
          </i>
        </div>

        {/* Mini-map playhead line */}
        <i
          id="tmp"
          style={{ left: `${playheadPct}%` }}
          className="ll-tmp ll:absolute ll:top-0 ll:bottom-0 ll:w-px ll:bg-primary ll:pointer-events-none"
        />
      </div>

      {/* 3. Zoom slider (the shared Slider, logarithmic 1x to 32x) */}
      <div className="ll:flex-none ll:w-zoom-slider" id="tzoom">
        <Slider
          min={0}
          max={5}
          step={0.01}
          keyStep={0.1}
          value={+logZoom.toFixed(2)}
          onChange={(v) => motionActions.setZoom(Math.pow(2, v))}
          formatValue={(v) => `${Math.pow(2, v).toFixed(1)}×`}
          ariaLabel="Timeline zoom"
        />
      </div>

      {/* 4. Fit Timeline Button */}
      <button
        type="button"
        data-ta="zfit"
        onClick={() => {
          motionActions.setZoom(1);
          motionActions.setT0(0);
        }}
        aria-label="Fit the timeline"
        title="Fit the timeline"
        className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
      >
        <Icon icon={Scan} size={14} />
      </button>

      <span className="ll:w-px ll:h-3.5 ll:bg-border ll:mx-0.5" aria-hidden="true" />

      {/* 5. Frame rate dropdown button */}
      <button
        type="button"
        id="tfps"
        data-ta="fps"
        aria-haspopup="listbox"
        aria-expanded={fpsMenuOpen}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setFpsAnchor({ x: rect.left, y: rect.top - 4 });
          setFpsMenuOpen(true);
        }}
        aria-label="Frame rate"
        title="Frame rate"
        className="ll-tfb ll:h-6 ll:px-1.5 ll:flex ll:items-center ll:gap-1 ll:rounded-sm ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
      >
        <span>{fps} fps</span>
        <Icon icon={ChevronDown} size={12} className="ll:text-muted" />
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

      {/* 6. Auto-key toggle button */}
      <button
        type="button"
        data-tb="auto"
        onClick={() => motionActions.toggleAutoKey()}
        aria-pressed={autoKey}
        aria-label="Auto-key"
        title="Auto-key"
        className={`ll-tbt ll:w-timeline-footer-btn ll:h-timeline-footer-btn ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:transition-colors ${
          autoKey
            ? "ll:text-select-fg ll:bg-select-bg"
            : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
        }`}
      >
        <Icon icon={AutoKeyIcon} size={16} />
      </button>

      {/* 7. Onion skin toggle button */}
      <button
        type="button"
        data-tb="onion"
        onClick={() => motionActions.toggleOnionSkin()}
        aria-pressed={onionSkin}
        aria-label="Onion skin"
        title="Onion skin"
        className={`ll-tbt ll:w-timeline-footer-btn ll:h-timeline-footer-btn ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:transition-colors ${
          onionSkin
            ? "ll:text-select-fg ll:bg-select-bg"
            : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
        }`}
      >
        <Icon icon={OnionSkinIcon} size={16} />
      </button>

      {/* 8. Snapping toggle button */}
      <button
        type="button"
        id="tsnap"
        data-ta="snap"
        onClick={() => motionActions.toggleSnap()}
        aria-pressed={snap}
        aria-label={`Snapping ${snap ? "on" : "off"}`}
        title={`Snapping ${snap ? "on" : "off"}`}
        className={`ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ${
          snap
            ? "ll:text-select-fg ll:bg-select-bg"
            : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
        }`}
      >
        <Icon icon={Magnet} size={14} />
      </button>

      {/* 9. Work area button */}
      <button
        type="button"
        id="twa"
        data-ta="wa"
        onClick={() => motionActions.resetWorkArea()}
        title="Work area length. Click to clear the work area."
        className="ll-tfb ll:h-6 ll:px-1.5 ll:rounded-sm ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
      >
        Work area {waStr}
      </button>
    </div>
  );
};
