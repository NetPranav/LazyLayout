"use client";

import React, { useRef, useMemo } from "react";
import { Icon } from "@/editor/components/Icon";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Type,
  Square,
  Image as ImageIcon,
  Layers,
  Circle,
  Minus,
  Sparkles,
  Diamond,
} from "lucide-react";
import {
  useMotionModel,
  motionActions,
  X,
  Fx,
  lblOf,
  layerName,
  layerType,
  isGrp,
  PROPS,
  formatValue,
  valueAt,
  snapT,
} from "@/editor/motion-model";
import type { MotionLayer, PropId, Keyframe } from "@/editor/motion-model";
import type { ContextMenuState } from "./types";

export interface TimelineLaneProps {
  layer?: MotionLayer;
  isChild?: boolean;
  childLayers?: MotionLayer[];
  trackWidth?: number;
  pps?: number;
  laneWidth?: number;
  isSelected?: boolean;
  onSelectLayer?: (id: string) => void;
  onOpenContextMenu?: (ctx: ContextMenuState) => void;
  // Legacy compatibility props
  track?: {
    id: string;
    name: string;
    property?: string;
    clip?: { id: string; name?: string; start: number; duration: number };
    keyframes: { id: string; time: number; value?: unknown; ease?: string }[];
  };
  pixelsPerSecond?: number;
  contentWidth?: number;
  duration?: number;
  isSelectedTrack?: boolean;
  selectedKeyframeId?: string | null;
  onSelectTrack?: (id: string) => void;
  onSelectKeyframe?: (id: string | null) => void;
  onUpdateKeyframeTime?: (trackId: string, kfId: string, time: number) => void;
  onAddKeyframe?: (trackId: string) => void;
  onSlideClip?: (trackId: string, deltaSec: number) => void;
  onSeek?: (timeSec: number) => void;
}

export const TimelineLane: React.FC<TimelineLaneProps> = ({
  layer: propLayer,
  isChild = false,
  childLayers,
  trackWidth = 264,
  pps: propPps,
  laneWidth: _laneWidth,
  isSelected: propIsSelected,
  onSelectLayer: propSelectLayer,
  onOpenContextMenu = () => {},
  track: legacyTrack,
  pixelsPerSecond: legacyPps,
  isSelectedTrack: legacyIsSelected,
  onSelectTrack: legacySelectTrack,
}) => {
  const pps = propPps ?? legacyPps ?? 100;
  const isSelected = propIsSelected ?? legacyIsSelected ?? false;
  const onSelectLayer = propSelectLayer ?? legacySelectTrack ?? (() => {});

  const fallbackLayer: MotionLayer = useMemo(() => {
    if (propLayer) return propLayer;
    if (legacyTrack) {
      return {
        id: legacyTrack.id,
        lbl: 1,
        gopen: true,
        clips: [
          {
            s: Math.round((legacyTrack.clip?.start ?? 0) * 60),
            e: Math.round(((legacyTrack.clip?.start ?? 0) + (legacyTrack.clip?.duration ?? 4)) * 60),
          },
        ],
        open: true,
        mute: false,
        lock: false,
        solo: false,
        trig: "On load",
        ease: "Ease out",
        rep: "Once",
        rn: 1,
        yoyo: false,
        ss: "top 80%",
        se: "bottom 20%",
        scrub: false,
        pin: false,
        sprev: 0,
        stag: 0,
        sfrom: "Start",
        tr: [
          {
            p: "opacity",
            keys: legacyTrack.keyframes.map((k) => ({
              id: k.id,
              t: Math.round(k.time * 60),
              v: 100,
              ease: "Ease out",
            })),
          },
        ],
      };
    }
    return {
      id: "headline",
      lbl: 1,
      gopen: true,
      clips: [{ s: 0, e: 300 }],
      open: false,
      mute: false,
      lock: false,
      solo: false,
      trig: "On load",
      ease: "Ease out",
      rep: "Once",
      rn: 1,
      yoyo: false,
      ss: "top 80%",
      se: "bottom 20%",
      scrub: false,
      pin: false,
      sprev: 0,
      stag: 0,
      sfrom: "Start",
      tr: [],
    };
  }, [propLayer, legacyTrack]);

  const layer = propLayer ?? fallbackLayer;
  const dur = useMotionModel((s) => s.comp.dur);
  const fps = useMotionModel((s) => s.fps);
  const t0 = useMotionModel((s) => s.t0);
  const playhead = useMotionModel((s) => s.playhead);
  const selectedKeys = useMotionModel((s) => s.selectedKeys);
  const tool = useMotionModel((s) => s.tool);
  const snap = useMotionModel((s) => s.snap);
  const comp = useMotionModel((s) => s.comp);
  const selectedProp = useMotionModel((s) => s.selectedProp);

  const laneRowRef = useRef<HTMLDivElement | null>(null);

  const isGroup = isGrp(layer) && !!childLayers;
  const labelNum = lblOf(layer);

  // Determine span of group or layer
  let minStart = 0;
  let maxEnd = dur;
  if (isGroup && childLayers && childLayers.length > 0) {
    minStart = Math.min(...childLayers.flatMap((k) => k.clips.map((c) => c.s)));
    maxEnd = Math.max(...childLayers.flatMap((k) => k.clips.map((c) => c.e)));
  } else if (layer.clips.length > 0) {
    minStart = Math.min(...layer.clips.map((c) => c.s));
    maxEnd = Math.max(...layer.clips.map((c) => c.e));
  }

  // Layer icon
  const typeKey = layerType(layer.id);
  const LayerIconComp =
    typeKey === "text"
      ? Type
      : typeKey === "button"
      ? Square
      : typeKey === "image"
      ? ImageIcon
      : typeKey === "circle"
      ? Circle
      : typeKey === "divider"
      ? Minus
      : isGroup
      ? Layers
      : Sparkles;

  // Keyframe ticks for clips
  const allLayerKeyframes = isGroup && childLayers
    ? childLayers.flatMap((c) => c.tr.flatMap((t) => t.keys))
    : layer.tr.flatMap((t) => t.keys);

  // Clip drag handler (move or trim)
  const handleClipPointerDown = (
    e: React.PointerEvent,
    clipIndex: number,
    clip: { s: number; e: number },
    mode: "move" | "s" | "e"
  ) => {
    if (e.button !== 0 || layer.lock) return;
    e.stopPropagation();
    e.preventDefault();

    onSelectLayer(layer.id);

    if (tool === "split") {
      const rect = laneRowRef.current?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : 0;
      const atF = Math.round(Fx(x, pps, t0, 24, fps));
      motionActions.splitClip(layer.id, clipIndex, atF);
      return;
    }

    const startX = e.clientX;
    const initialStart = clip.s;
    const initialEnd = clip.e;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaPx = ev.clientX - startX;
      const deltaF = Math.round((deltaPx / pps) * fps);

      if (mode === "move") {
        const rawS = initialStart + deltaF;
        const res = snapT(rawS, comp, snap, pps, fps, undefined, clip, false, playhead);
        motionActions.moveClip(layer.id, clipIndex, res.snapped);
      } else if (mode === "s") {
        const rawS = initialStart + deltaF;
        const res = snapT(rawS, comp, snap, pps, fps, undefined, clip, false, playhead);
        motionActions.trimClip(layer.id, clipIndex, "s", res.snapped);
      } else {
        const rawE = initialEnd + deltaF;
        const res = snapT(rawE, comp, snap, pps, fps, undefined, clip, false, playhead);
        motionActions.trimClip(layer.id, clipIndex, "e", res.snapped);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Keyframe drag handler (supports single and multi-selection drag with snapping)
  const handleKeyframePointerDown = (
    e: React.PointerEvent,
    keyframe: Keyframe,
    _track: { p: PropId }
  ) => {
    if (e.button !== 0 || layer.lock) return;
    e.stopPropagation();
    e.preventDefault();

    const mod = e.shiftKey || e.metaKey || e.ctrlKey;
    const currentSelected = useMotionModel.getState().selectedKeys;
    const wasSelected = !!currentSelected[keyframe.id];

    if (mod) {
      motionActions.selectKeys([keyframe.id], true);
    } else if (!wasSelected) {
      motionActions.selectKeys([keyframe.id], false);
    }

    const startX = e.clientX;
    let didMove = false;

    // Gather all selected keys across all comp layers
    const selMap = useMotionModel.getState().selectedKeys;
    const allSelectedList: { id: string; t: number }[] = [];
    comp.layers.forEach((l) => {
      if (l.lock) return;
      l.tr.forEach((t) => {
        t.keys.forEach((k) => {
          if (selMap[k.id]) {
            allSelectedList.push({ id: k.id, t: k.t });
          }
        });
      });
    });

    const isMulti = allSelectedList.length > 1;
    const baseTimes = new Map<string, number>(allSelectedList.map((item) => [item.id, item.t]));
    const initialT = keyframe.t;
    const minBaseT = Math.min(...allSelectedList.map((item) => item.t));
    const maxBaseT = Math.max(...allSelectedList.map((item) => item.t));

    const onPointerMove = (ev: PointerEvent) => {
      const deltaPx = ev.clientX - startX;
      if (Math.abs(deltaPx) > 2) didMove = true;

      const deltaF = Math.round((deltaPx / pps) * fps);

      if (isMulti) {
        const rawT = initialT + deltaF;
        const res = snapT(rawT, comp, snap, pps, fps, selMap, undefined, false, playhead);
        let effectiveDelta = res.snapped - initialT;
        // Clamp so no key goes < 0 or > comp.dur
        effectiveDelta = Math.max(-minBaseT, Math.min(comp.dur - maxBaseT, effectiveDelta));

        allSelectedList.forEach((item) => {
          const orig = baseTimes.get(item.id) ?? item.t;
          motionActions.setKeyTime(item.id, orig + effectiveDelta);
        });
      } else {
        const rawT = initialT + deltaF;
        const res = snapT(rawT, comp, snap, pps, fps, { [keyframe.id]: true }, undefined, false, playhead);
        motionActions.setKeyTime(keyframe.id, Math.max(0, Math.min(comp.dur, res.snapped)));
      }
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      if (!didMove && !mod && allSelectedList.length > 1) {
        motionActions.selectKeys([keyframe.id], false);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Marquee drag handler on property lane
  const handleLanePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest(".kfb, .ll-kfb")) return;
    e.preventDefault();

    const mod = e.shiftKey || e.metaKey || e.ctrlKey;
    const baseSelected = mod ? { ...useMotionModel.getState().selectedKeys } : {};

    const startClientX = e.clientX;
    const startClientY = e.clientY;

    let mqEl: HTMLDivElement | null = null;
    let didMove = false;

    const onPointerMove = (ev: PointerEvent) => {
      const x = Math.min(startClientX, ev.clientX);
      const y = Math.min(startClientY, ev.clientY);
      const w = Math.abs(ev.clientX - startClientX);
      const h = Math.abs(ev.clientY - startClientY);

      if (w > 3 || h > 3) didMove = true;
      if (!didMove) return;

      if (!mqEl) {
        mqEl = document.createElement("div");
        mqEl.className = "mq";
        mqEl.style.position = "fixed";
        mqEl.style.zIndex = "40";
        mqEl.style.pointerEvents = "none";
        mqEl.style.border = "1px solid var(--ll-border-strong, var(--ll-border-primary, #666))";
        mqEl.style.backgroundColor = "var(--ll-surface-hover, rgba(255,255,255,0.08))";
        mqEl.style.opacity = "0.75";
        document.body.appendChild(mqEl);
      }

      mqEl.style.left = `${x}px`;
      mqEl.style.top = `${y}px`;
      mqEl.style.width = `${w}px`;
      mqEl.style.height = `${h}px`;

      const allKfElements = document.querySelectorAll<HTMLElement>(".kfb, .ll-kfb");
      const nextSelected: Record<string, boolean> = { ...baseSelected };

      allKfElements.forEach((kEl) => {
        const kId = kEl.dataset.k || kEl.dataset.keyId;
        if (!kId) return;
        const rect = kEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const hit = cx >= x && cx <= x + w && cy >= y && cy <= y + h;
        if (hit) {
          nextSelected[kId] = true;
        } else if (!mod) {
          delete nextSelected[kId];
        }
      });

      motionActions.selectKeys(Object.keys(nextSelected), false);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      if (mqEl) {
        mqEl.remove();
        mqEl = null;
      }

      if (!didMove && !mod) {
        motionActions.clearKeySelection();
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Readout scrub handler
  const handleScrubReadout = (e: React.PointerEvent, p: PropId) => {
    if (e.button !== 0 || layer.lock) return;
    e.preventDefault();
    e.stopPropagation();

    const initialVal = valueAt(layer, p, playhead);
    const startX = e.clientX;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaPx = ev.clientX - startX;
      const factor = ev.shiftKey ? 5 : 1;
      const nextVal = initialVal + deltaPx * factor;
      motionActions.addKey(layer.id, p, playhead, nextVal);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const isLayerOpen = isGroup ? layer.gopen : layer.open;

  return (
    <div
      data-l={layer.id}
      className={`tlgrp ll-tlgrp ${isSelected ? "on ll:on" : ""} ${isLayerOpen ? "open" : ""} ll:flex ll:flex-col ll:shrink-0 ll:relative ll:transition-opacity`}
    >
      {/* Embedded CSS rules for tree guide hairlines, layer stripes, action buttons, and trim handles */}
      <style>{`
        .tlrow.prp .tlhc { --gx: 18px; position: relative; gap: 2px; padding-left: calc(var(--gx) + 14px); }
        .tlrow.prp.kid .tlhc { --gx: 30px; padding-left: calc(var(--gx) + 14px); }
        .tlrow.prp .tlhc::before { content: ""; position: absolute; left: var(--gx); top: 0; bottom: 0; width: 1px; background: var(--ll-border, var(--border)); }
        .tlrow.prp .tlhc::after { content: ""; position: absolute; left: var(--gx); top: 50%; width: 8px; height: 1px; background: var(--ll-border, var(--border)); }
        .tlgrp > .tlrow.prp:last-child .tlhc::before { bottom: 50%; }
        .tlrow.lay .tlhc { position: relative; }
        .tlrow.lay .tlhc::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--lc); }
        .tlhc .act .ib.add { display: none; }
        .tlrow:hover .act .ib.add { display: flex; }
        .tlhc .act .ib { opacity: 0.5; }
        .tlrow:hover .act .ib, .tlhc:focus-within .act .ib, .tlrow.on .act .ib, .tlrow[data-on] .act .ib, .tlhc .act .ib[aria-pressed="true"] { opacity: 1; }
        .ch::after { content: ""; position: absolute; left: 3px; top: 4px; bottom: 4px; width: 2px; background: var(--ll-text-primary, var(--text)); opacity: 0; transition: opacity 0.12s; border-radius: 1px; }
        .ch.r::after { left: auto; right: 3px; }
        .clip:hover .ch::after { opacity: 0.6; }
        #tl[data-focus] .tlgrp:not(.on) { opacity: 0.45; }
        #tl[data-focus] .tlgrp:not(.on):hover { opacity: 0.8; }
      `}</style>

      {/* 1. Main Layer Row */}
      <div
        data-testid="timeline-lane"
        data-layer-id={layer.id}
        data-l={layer.id}
        data-selected={isSelected ? "true" : "false"}
        data-on={isSelected ? "" : undefined}
        style={{
          ["--lc" as any]: `var(--ll-label-${labelNum})`,
          ["--lt" as any]: `var(--ll-label-${labelNum}-tint)`,
          gridTemplateColumns: `var(--hw, ${trackWidth}px) minmax(0, 1fr)`,
        }}
        className={`tlrow lay ${isGroup ? "grp ll-grp" : ""} ${isChild ? "kid ll-kid" : ""} ${
          layer.mute ? "muted ll-muted ll:opacity-50" : ""
        } ${layer.lock ? "locked" : ""} ll-tlrow ll:relative ll:grid ll:h-8 ll:border-b ll:border-border ll:shrink-0 ll:transition-colors ${
          isSelected ? "ll:bg-selection ll:text-selection-fg" : "ll:bg-surface-panel ll:text-primary"
        }`}
      >
        {/* Track header column */}
        <div
          onClick={() => onSelectLayer(layer.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            onOpenContextMenu({
              kind: "track",
              x: e.clientX,
              y: e.clientY,
              frame: playhead,
              layerId: layer.id,
            });
          }}
          className={`tlhc ll-tlhc ll:flex ll:items-center ll:gap-1.5 ll:pr-2 ll:border-r ll:border-border ll:cursor-pointer ll:select-none ${
            isChild ? "ll:pl-5" : "ll:pl-2"
          }`}
        >
          {/* Expand/collapse button */}
          <button
            type="button"
            data-la={isGroup ? "gopen" : "open"}
            data-l={layer.id}
            aria-expanded={isGroup ? layer.gopen : layer.open}
            aria-label={`${(isGroup ? layer.gopen : layer.open) ? "Collapse" : "Expand"} ${layerName(layer.id)}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isGroup) {
                motionActions.toggleLayerGroupOpen(layer.id);
              } else {
                motionActions.toggleLayerOpen(layer.id);
              }
            }}
            className="ib tlch ll:w-5 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:text-muted ll:hover:text-primary ll:transition-colors"
          >
            <Icon
              icon={(isGroup ? layer.gopen : layer.open) ? ChevronDown : ChevronRight}
              size={12}
            />
          </button>

          {/* Type icon */}
          <Icon icon={LayerIconComp} size={14} className="lty ll:text-muted ll:shrink-0 ll:mr-1" />

          {/* Layer name */}
          <button
            type="button"
            data-la="sel"
            data-l={layer.id}
            onClick={() => onSelectLayer(layer.id)}
            data-testid="timeline-lane-name"
            className="tlnm ll-tlnm ll:flex-1 ll:min-w-0 ll:truncate ll:font-sans ll:text-xs ll:font-medium ll:text-left ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:text-inherit"
          >
            {layerName(layer.id)}
          </button>

          {/* Action icons (Add, Mute, Lock, Solo) */}
          <span className="act ll-act ll:flex ll:items-center ll:gap-0.5 ll:shrink-0" onClick={(e) => e.stopPropagation()}>
            {!isGroup && (
              <button
                type="button"
                data-la="add"
                data-l={layer.id}
                title="Add track"
                aria-label={`Add track to ${layerName(layer.id)}`}
                onClick={(e) => {
                  onOpenContextMenu({
                    kind: "track",
                    x: e.clientX,
                    y: e.clientY,
                    frame: playhead,
                    layerId: layer.id,
                  });
                }}
                className="ib add ll:w-6 ll:h-6 ll:items-center ll:justify-center ll:rounded-xs ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
              >
                <Icon icon={Plus} size={12} />
              </button>
            )}

            <button
              type="button"
              data-la="mute"
              data-l={layer.id}
              aria-pressed={layer.mute}
              onClick={() => motionActions.toggleLayerMute(layer.id)}
              title={layer.mute ? "Unmute animation" : "Mute animation"}
              className={`ib ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:transition-colors ${
                layer.mute
                  ? "ll:text-control-active"
                  : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
              }`}
            >
              <Icon icon={layer.mute ? EyeOff : Eye} size={12} />
            </button>

            <button
              type="button"
              data-la="lock"
              data-l={layer.id}
              aria-pressed={layer.lock}
              onClick={() => motionActions.toggleLayerLock(layer.id)}
              title={layer.lock ? "Unlock" : "Lock"}
              className={`ib ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:transition-colors ${
                layer.lock
                  ? "ll:text-control-active"
                  : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
              }`}
            >
              <Icon icon={Lock} size={12} />
            </button>

            <button
              type="button"
              data-la="solo"
              data-l={layer.id}
              aria-pressed={layer.solo}
              onClick={() => motionActions.toggleLayerSolo(layer.id)}
              title="Solo"
              className={`ib s ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:font-mono ll:text-nano ll:font-semibold ll:transition-colors ${
                layer.solo
                  ? "ll:text-control-active"
                  : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
              }`}
            >
              S
            </button>
          </span>
        </div>

        {/* Lane column with clip(s) */}
        <div
          ref={laneRowRef}
          onContextMenu={(e) => {
            e.preventDefault();
            const rect = laneRowRef.current?.getBoundingClientRect();
            const x = rect ? e.clientX - rect.left : 0;
            const f = Math.round(Fx(x, pps, t0, 24, fps));
            onOpenContextMenu({
              kind: "lane",
              x: e.clientX,
              y: e.clientY,
              frame: f,
              layerId: layer.id,
            });
          }}
          className="tlln ll-tlln ll:relative ll:h-full ll:overflow-hidden ll:bg-surface-panel"
        >
          {isGroup ? (
            /* Group clip representation */
            <div
              data-testid="timeline-clip"
              data-layer-id={layer.id}
              data-grp={layer.id}
              style={{
                left: `${X(minStart, pps, t0, 24, fps)}px`,
                width: `${Math.max(6, X(maxEnd, pps, t0, 24, fps) - X(minStart, pps, t0, 24, fps))}px`,
                backgroundColor: `var(--ll-label-${labelNum}-tint)`,
                boxShadow: `inset 0 0 0 1px var(--ll-label-${labelNum})`,
              }}
              className={`clip grp ${isSelected ? "on" : ""} ll-clip ll-grp ll:absolute ll:top-1 ll:bottom-1 ll:rounded-sm ll:overflow-hidden ll:cursor-default`}
            >
              {allLayerKeyframes.map((k) => (
                <i
                  key={k.id}
                  style={{
                    left: `${X(k.t, pps, t0, 24, fps) - X(minStart, pps, t0, 24, fps)}px`,
                  }}
                  className="ckt ll-ckt ll:absolute ll:bottom-0 ll:w-0.5 ll:h-1.5 ll:bg-primary ll:opacity-55 ll:pointer-events-none"
                />
              ))}
              <span
                className="cn ll-cn ll:absolute ll:top-0 ll:bottom-0 ll:flex ll:items-center ll:gap-1 ll:font-sans ll:text-nano ll:font-medium ll:text-primary ll:pointer-events-none"
                style={{ left: `${8 + Math.max(0, -X(minStart, pps, t0, 24, fps))}px` }}
              >
                <Icon icon={Layers} size={11} className="ll:text-secondary" />
                <span className="ll:truncate">{layerName(layer.id)}</span>
              </span>
            </div>
          ) : (
            /* Normal layer clip(s) */
            layer.clips.map((clip, idx) => {
              const x0 = X(clip.s, pps, t0, 24, fps);
              const x1 = X(clip.e, pps, t0, 24, fps);
              const width = Math.max(6, x1 - x0);

              return (
                <div
                  key={`clip-${idx}`}
                  data-testid="timeline-clip"
                  data-layer-id={layer.id}
                  data-clip={layer.id}
                  data-ci={idx}
                  data-start={clip.s}
                  data-end={clip.e}
                  onPointerDown={(e) => handleClipPointerDown(e, idx, clip, "move")}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onOpenContextMenu({
                      kind: "clip",
                      x: e.clientX,
                      y: e.clientY,
                      frame: playhead,
                      layerId: layer.id,
                      clipIndex: idx,
                    });
                  }}
                  style={{
                    left: `${x0}px`,
                    width: `${width}px`,
                    backgroundColor: `var(--ll-label-${labelNum}-tint)`,
                    boxShadow: `inset 0 0 0 1px var(--ll-label-${labelNum})`,
                  }}
                  className={`clip ${isSelected ? "on" : ""} ll-clip ll:absolute ll:top-1 ll:bottom-1 ll:rounded-sm ll:overflow-hidden ll:cursor-grab ll:active:cursor-grabbing ll:group`}
                >
                  {/* Left trim handle */}
                  <i
                    data-trim="s"
                    onPointerDown={(e) => handleClipPointerDown(e, idx, clip, "s")}
                    className="ch ll-ch ll:absolute ll:left-0 ll:top-0 ll:bottom-0 ll:w-2 ll:cursor-ew-resize ll:z-10"
                  />

                  {/* Keyframe tick marks inside clip */}
                  {allLayerKeyframes
                    .filter((k) => k.t >= clip.s && k.t <= clip.e)
                    .map((k) => (
                      <i
                        key={k.id}
                        style={{
                          left: `${X(k.t, pps, t0, 24, fps) - x0}px`,
                        }}
                        className="ckt ll-ckt ll:absolute ll:bottom-0 ll:w-0.5 ll:h-1.5 ll:bg-primary ll:opacity-55 ll:pointer-events-none"
                      />
                    ))}

                  {/* Clip label */}
                  <span
                    className="cn ll-cn ll:absolute ll:top-0 ll:bottom-0 ll:flex ll:items-center ll:gap-1 ll:font-sans ll:text-nano ll:font-medium ll:text-primary ll:pointer-events-none"
                    style={{ left: `${8 + Math.max(0, -x0)}px` }}
                  >
                    <Icon icon={LayerIconComp} size={11} className="ll:text-secondary" />
                    <span className="ll:truncate">{layerName(layer.id)}</span>
                  </span>

                  {/* Right trim handle */}
                  <i
                    data-trim="e"
                    onPointerDown={(e) => handleClipPointerDown(e, idx, clip, "e")}
                    className="ch r ll-ch ll-r ll:absolute ll:right-0 ll:top-0 ll:bottom-0 ll:w-2 ll:cursor-ew-resize ll:z-10"
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Expanded Property Rows (if not group and layer is open) */}
      {!isGroup &&
        layer.open &&
        layer.tr.map((track, j) => {
          const spec = PROPS[track.p];
          const isTrackSelected =
            selectedProp?.layerId === layer.id && selectedProp?.p === track.p;
          const currentValue = valueAt(layer, track.p, playhead);
          const hasKeyAtPlayhead = track.keys.some((k) => k.t === playhead);

          return (
            <div
              key={track.p}
              data-testid="timeline-prop-lane"
              data-layer-id={layer.id}
              data-l={layer.id}
              data-p={track.p}
              data-prop={track.p}
              data-selected={isTrackSelected ? "true" : "false"}
              data-on={isTrackSelected ? "" : undefined}
              style={{
                gridTemplateColumns: `var(--hw, ${trackWidth}px) minmax(0, 1fr)`,
              }}
              className={`tlrow prp ${isChild ? "kid ll-kid" : ""} ${j % 2 === 1 ? "alt" : ""} ${
                layer.lock ? "locked" : ""
              } ll-tlrow ll-prp ll:grid ll:h-7 ll:border-b ll:border-border ll:shrink-0 ll:transition-colors ${
                isTrackSelected ? "ll:bg-surface-hover" : "ll:bg-surface-panel"
              }`}
            >
              {/* Property Header Column */}
              <div
                onClick={() =>
                  motionActions.setSelectedProp(layer.id, track.p)
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  onOpenContextMenu({
                    kind: "track",
                    x: e.clientX,
                    y: e.clientY,
                    frame: playhead,
                    layerId: layer.id,
                    prop: track.p,
                  });
                }}
                className="tlhc ll-tlhc ll:flex ll:items-center ll:gap-1.5 ll:pr-2 ll:border-r ll:border-border ll:cursor-pointer ll:select-none"
              >
                <button
                  type="button"
                  data-pa="sel"
                  data-l={layer.id}
                  data-p={track.p}
                  className="tlnm ll-tlnm ll:flex-1 ll:min-w-0 ll:truncate ll:font-sans ll:text-nano ll:text-secondary ll:bg-transparent ll:border-0 ll:p-0 ll:text-left ll:cursor-pointer"
                >
                  {spec.n}
                </button>

                {/* Scrubbable readout */}
                <span
                  data-testid="timeline-prop-value"
                  onPointerDown={(e) => handleScrubReadout(e, track.p)}
                  title="Drag to change value at playhead"
                  className="rd ll-rd ll:min-w-10 ll:text-right ll:font-mono ll:text-nano ll:text-primary ll:cursor-ew-resize ll:px-1 ll:rounded-xs ll:hover:bg-surface-segmented"
                >
                  {formatValue(track.p, currentValue)}
                </span>

                {/* Nav buttons */}
                <div className="nav ll-nav ll:flex ll:items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const prev = [...track.keys]
                        .reverse()
                        .find((k) => k.t < playhead);
                      if (prev) motionActions.setPlayhead(prev.t);
                    }}
                    title="Previous keyframe"
                    className="ib ll:w-4.5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:text-muted ll:hover:text-primary"
                  >
                    <Icon icon={ChevronLeft} size={11} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (hasKeyAtPlayhead) {
                        const hit = track.keys.find((k) => k.t === playhead);
                        if (hit) motionActions.deleteKeys([hit.id]);
                      } else {
                        motionActions.addKey(layer.id, track.p, playhead);
                      }
                    }}
                    title={
                      hasKeyAtPlayhead ? "Remove keyframe" : "Add keyframe"
                    }
                    aria-pressed={hasKeyAtPlayhead}
                    className={`ib kt ${
                      hasKeyAtPlayhead
                        ? "on ll:text-control-active"
                        : "ll:text-muted ll:hover:text-primary"
                    } ll:w-4.5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:transition-colors`}
                  >
                    <Icon icon={Diamond} size={10} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = track.keys.find((k) => k.t > playhead);
                      if (next) motionActions.setPlayhead(next.t);
                    }}
                    title="Next keyframe"
                    className="ib ll:w-4.5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:text-muted ll:hover:text-primary"
                  >
                    <Icon icon={ChevronRight} size={11} />
                  </button>
                </div>
              </div>

              {/* Property Lane Column with Keyframes, segments, and marquee selection */}
              <div
                onPointerDown={handleLanePointerDown}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const f = Math.round(Fx(x, pps, t0, 24, fps));
                  onOpenContextMenu({
                    kind: "lane",
                    x: e.clientX,
                    y: e.clientY,
                    frame: f,
                    layerId: layer.id,
                    prop: track.p,
                  });
                }}
                className="tlln ll-tlln ll:relative ll:h-full ll:overflow-hidden ll:bg-surface-panel"
              >
                {/* Connecting lines between keyframes */}
                {track.keys.map((k, idx) => {
                  if (idx >= track.keys.length - 1) return null;
                  const nextK = track.keys[idx + 1];
                  const x0 = X(k.t, pps, t0, 24, fps);
                  const x1 = X(nextK.t, pps, t0, 24, fps);
                  return (
                    <i
                      key={`kseg-${k.id}`}
                      style={{
                        left: `${x0}px`,
                        width: `${Math.max(0, x1 - x0)}px`,
                      }}
                      className="kseg ll-kseg ll:absolute ll:top-1/2 ll:h-0.5 ll:-translate-y-1/2 ll:bg-muted ll:opacity-40 ll:pointer-events-none"
                    />
                  );
                })}

                {/* Keyframe diamonds */}
                {track.keys.map((k) => {
                  const x = X(k.t, pps, t0, 24, fps);
                  const isKeySelected = !!selectedKeys[k.id];

                  return (
                    <div
                      key={k.id}
                      data-testid="keyframe"
                      data-k={k.id}
                      data-key-id={k.id}
                      data-time={k.t}
                      data-prop={track.p}
                      data-layer-id={layer.id}
                      data-selected={isKeySelected ? "true" : "false"}
                      onPointerDown={(e) =>
                        handleKeyframePointerDown(e, k, track)
                      }
                      onContextMenu={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onOpenContextMenu({
                          kind: "keyframe",
                          x: e.clientX,
                          y: e.clientY,
                          frame: k.t,
                          layerId: layer.id,
                          prop: track.p,
                          keyId: k.id,
                          currentEase: k.ease,
                        });
                      }}
                      style={{
                        left: `${x}px`,
                      }}
                      title={`${spec.n} at ${k.t}`}
                      className={`kfb ll-kfb ${isKeySelected ? "sel" : ""} ll:absolute ll:top-1/2 ll:w-4 ll:h-4 ll:-translate-x-1/2 ll:-translate-y-1/2 ll:flex ll:items-center ll:justify-center ll:cursor-grab ll:active:cursor-grabbing ll:z-10`}
                    >
                      <i
                        style={{
                          width: isKeySelected ? "11px" : "9px",
                          height: isKeySelected ? "11px" : "9px",
                          backgroundColor: isKeySelected
                            ? "var(--ll-control-primary-bg)"
                            : "var(--ll-text-secondary)",
                          boxShadow: isKeySelected
                            ? "0 0 0 2px var(--ll-surface-panel), 0 0 0 3px var(--ll-control-primary-bg)"
                            : "none",
                        }}
                        className="ll:rotate-45 ll:pointer-events-none ll:transition-colors hover:ll:bg-primary"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

      {/* 3. Add Property Row (when open and not group) */}
      {!isGroup && layer.open && (
        <div
          data-l={layer.id}
          style={{
            gridTemplateColumns: `var(--hw, ${trackWidth}px) minmax(0, 1fr)`,
          }}
          className={`tlrow prp add ${isChild ? "kid" : ""} ll-tlrow ll:grid ll:h-7 ll:border-b ll:border-border ll:shrink-0 ll:bg-surface-panel`}
        >
          <div className="tlhc ll-tlhc ll:flex ll:items-center ll:pr-2 ll:border-r ll:border-border">
            <button
              type="button"
              data-la="add"
              data-l={layer.id}
              aria-haspopup="listbox"
              aria-expanded="false"
              onClick={(e) => {
                onOpenContextMenu({
                  kind: "track",
                  x: e.clientX,
                  y: e.clientY,
                  frame: playhead,
                  layerId: layer.id,
                });
              }}
              className="tlnm ll-tlnm ll:flex ll:items-center ll:gap-1 ll:font-sans ll:text-nano ll:text-muted ll:hover:text-primary ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer"
            >
              <Icon icon={Plus} size={12} />
              <span>Add property</span>
            </button>
          </div>
          <div className="tlln ll-tlln ll:relative ll:h-full ll:bg-surface-panel" />
        </div>
      )}
    </div>
  );
};
