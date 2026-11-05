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
    const clipLen = initialEnd - initialStart;

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

  // Keyframe drag handler
  const handleKeyframePointerDown = (
    e: React.PointerEvent,
    keyframe: Keyframe,
    _track: { p: PropId }
  ) => {
    if (e.button !== 0 || layer.lock) return;
    e.stopPropagation();
    e.preventDefault();

    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      motionActions.selectKeys([keyframe.id], true);
    } else {
      motionActions.selectKeys([keyframe.id], false);
    }

    const startX = e.clientX;
    const initialT = keyframe.t;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaPx = ev.clientX - startX;
      const deltaF = Math.round((deltaPx / pps) * fps);
      const rawT = initialT + deltaF;
      const res = snapT(rawT, comp, snap, pps, fps, { [keyframe.id]: true }, undefined, false, playhead);
      motionActions.setKeyTime(keyframe.id, res.snapped);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Readout scrub handler
  const handleScrubReadout = (e: React.PointerEvent, p: PropId) => {
    if (e.button !== 0 || layer.lock) return;
    e.preventDefault();
    e.stopPropagation();

    const spec = PROPS[p];
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

  return (
    <div className={`ll-tlgrp ${isSelected ? "ll:on" : ""}`}>
      {/* 1. Main Layer Row */}
      <div
        style={{
          gridTemplateColumns: `${trackWidth}px minmax(0, 1fr)`,
        }}
        className={`ll-tlrow ll:relative ${isGroup ? "ll-grp" : ""} ${isChild ? "ll-kid" : ""} ${
          layer.mute ? "ll-muted ll:opacity-50" : ""
        } ll:grid ll:h-8 ll:border-b ll:border-border ll:shrink-0 ll:transition-colors ${
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
          style={{ boxShadow: `inset 3px 0 0 var(--ll-label-${labelNum})` }}
          className={`ll-tlhc ll:flex ll:items-center ll:gap-1.5 ll:pr-2 ll:border-r ll:border-border ll:cursor-pointer ll:select-none ${
            isChild ? "ll:pl-5" : "ll:pl-2"
          }`}
        >
          {/* Expand/collapse button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isGroup) {
                motionActions.toggleLayerGroupOpen(layer.id);
              } else {
                motionActions.toggleLayerOpen(layer.id);
              }
            }}
            className="ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:text-muted ll:hover:text-primary ll:transition-colors"
          >
            <Icon
              icon={(isGroup ? layer.gopen : layer.open) ? ChevronDown : ChevronRight}
              size={13}
            />
          </button>

          {/* Type icon */}
          <Icon icon={LayerIconComp} size={13} className="ll:text-muted ll:shrink-0" />

          {/* Layer name */}
          <span className="ll-tlnm ll:flex-1 ll:min-w-0 ll:truncate ll:font-sans ll:text-xs ll:font-medium">
            {layerName(layer.id)}
          </span>

          {/* Action icons (Add, Mute, Lock, Solo) */}
          <div className="ll-act ll:flex ll:items-center ll:gap-0.5 ll:shrink-0" onClick={(e) => e.stopPropagation()}>
            {!isGroup && (
              <button
                type="button"
                onClick={(e) => {
                  onOpenContextMenu({
                    kind: "track",
                    x: e.clientX,
                    y: e.clientY,
                    frame: playhead,
                    layerId: layer.id,
                  });
                }}
                title="Add property"
                className="ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
              >
                <Icon icon={Plus} size={12} />
              </button>
            )}

            <button
              type="button"
              onClick={() => motionActions.toggleLayerMute(layer.id)}
              title={layer.mute ? "Unmute" : "Mute"}
              className={`ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:transition-colors ${
                layer.mute
                  ? "ll:text-control-active"
                  : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
              }`}
            >
              <Icon icon={layer.mute ? EyeOff : Eye} size={12} />
            </button>

            <button
              type="button"
              onClick={() => motionActions.toggleLayerLock(layer.id)}
              title={layer.lock ? "Unlock" : "Lock"}
              className={`ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:transition-colors ${
                layer.lock
                  ? "ll:text-control-active"
                  : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
              }`}
            >
              <Icon icon={Lock} size={12} />
            </button>

            <button
              type="button"
              onClick={() => motionActions.toggleLayerSolo(layer.id)}
              title="Solo"
              className={`ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:font-mono ll:text-nano ll:font-semibold ll:transition-colors ${
                layer.solo
                  ? "ll:text-control-active"
                  : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
              }`}
            >
              S
            </button>
          </div>
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
          className="ll-tlln ll:relative ll:h-full ll:overflow-hidden ll:bg-surface-panel"
        >
          {isGroup ? (
            /* Group clip representation */
            <div
              style={{
                left: `${X(minStart, pps, t0, 24, fps)}px`,
                width: `${Math.max(6, X(maxEnd, pps, t0, 24, fps) - X(minStart, pps, t0, 24, fps))}px`,
                backgroundColor: `var(--ll-label-${labelNum}-tint)`,
                outline: `1px solid var(--ll-label-${labelNum})`,
              }}
              className="ll-clip ll-grp ll:absolute ll:top-1 ll:bottom-1 ll:rounded-xs ll:overflow-hidden ll:cursor-default"
            >
              {allLayerKeyframes.map((k) => (
                <i
                  key={k.id}
                  style={{
                    left: `${X(k.t, pps, t0, 24, fps) - X(minStart, pps, t0, 24, fps)}px`,
                  }}
                  className="ll-ckt ll:absolute ll:bottom-0 ll:w-0.5 ll:h-1.5 ll:bg-primary ll:opacity-50 ll:pointer-events-none"
                />
              ))}
              <span className="ll-cn ll:absolute ll:left-2 ll:top-0 ll:bottom-0 ll:flex ll:items-center ll:gap-1 ll:font-sans ll:text-nano ll:font-medium ll:text-primary ll:pointer-events-none">
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
                    outline: `1px solid var(--ll-label-${labelNum})`,
                  }}
                  className="ll-clip ll:absolute ll:top-1 ll:bottom-1 ll:rounded-xs ll:overflow-hidden ll:cursor-grab ll:active:cursor-grabbing ll:group"
                >
                  {/* Left trim handle */}
                  <i
                    onPointerDown={(e) => handleClipPointerDown(e, idx, clip, "s")}
                    className="ll-ch ll:absolute ll:left-0 ll:top-0 ll:bottom-0 ll:w-2 ll:cursor-ew-resize ll:z-10 ll:group-hover:bg-primary/20"
                  />

                  {/* Right trim handle */}
                  <i
                    onPointerDown={(e) => handleClipPointerDown(e, idx, clip, "e")}
                    className="ll-ch ll-r ll:absolute ll:right-0 ll:top-0 ll:bottom-0 ll:w-2 ll:cursor-ew-resize ll:z-10 ll:group-hover:bg-primary/20"
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
                        className="ll-ckt ll:absolute ll:bottom-0 ll:w-0.5 ll:h-1.5 ll:bg-primary ll:opacity-50 ll:pointer-events-none"
                      />
                    ))}

                  {/* Clip label */}
                  <span className="ll-cn ll:absolute ll:left-2 ll:top-0 ll:bottom-0 ll:flex ll:items-center ll:gap-1 ll:font-sans ll:text-nano ll:font-medium ll:text-primary ll:pointer-events-none">
                    <Icon icon={LayerIconComp} size={11} className="ll:text-secondary" />
                    <span className="ll:truncate">{layerName(layer.id)}</span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Expanded Property Rows (if not group and layer is open) */}
      {!isGroup &&
        layer.open &&
        layer.tr.map((track) => {
          const spec = PROPS[track.p];
          const isTrackSelected =
            selectedProp?.layerId === layer.id && selectedProp?.p === track.p;
          const currentValue = valueAt(layer, track.p, playhead);
          const hasKeyAtPlayhead = track.keys.some((k) => k.t === playhead);

          return (
            <div
              key={track.p}
              style={{
                gridTemplateColumns: `${trackWidth}px minmax(0, 1fr)`,
              }}
              className={`ll-tlrow ll-prp ${isChild ? "ll-kid" : ""} ll:grid ll:h-6 ll:border-b ll:border-border ll:shrink-0 ll:transition-colors ${
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
                className={`ll-tlhc ll:flex ll:items-center ll:gap-1.5 ll:pr-2 ll:border-r ll:border-border ll:cursor-pointer ll:select-none ${
                  isChild ? "ll:pl-8" : "ll:pl-6"
                }`}
              >
                <span className="ll-tlnm ll:flex-1 ll:min-w-0 ll:truncate ll:font-sans ll:text-nano ll:text-secondary">
                  {spec.n}
                </span>

                {/* Scrubbable readout */}
                <span
                  onPointerDown={(e) => handleScrubReadout(e, track.p)}
                  title="Drag to change value at playhead"
                  className="ll-rd ll:min-w-9 ll:text-right ll:font-mono ll:text-nano ll:text-primary ll:cursor-ew-resize ll:px-1 ll:rounded-xs ll:hover:bg-surface-segmented"
                >
                  {formatValue(track.p, currentValue)}
                </span>

                {/* Nav buttons */}
                <div className="ll-nav ll:flex ll:items-center ll:gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const prev = [...track.keys]
                        .reverse()
                        .find((k) => k.t < playhead);
                      if (prev) motionActions.setPlayhead(prev.t);
                    }}
                    title="Previous keyframe"
                    className="ll:w-4 ll:h-4 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:text-muted ll:hover:text-primary"
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
                    className={`ll:w-4 ll:h-4 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:transition-colors ${
                      hasKeyAtPlayhead
                        ? "ll:text-control-active"
                        : "ll:text-muted ll:hover:text-primary"
                    }`}
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
                    className="ll:w-4 ll:h-4 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:text-muted ll:hover:text-primary"
                  >
                    <Icon icon={ChevronRight} size={11} />
                  </button>
                </div>
              </div>

              {/* Property Lane Column with Keyframes and segments */}
              <div
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
                className="ll-tlln ll:relative ll:h-full ll:overflow-hidden ll:bg-surface-panel"
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
                      className="ll-kseg ll:absolute ll:top-1/2 ll:h-0.5 ll:-translate-y-1/2 ll:bg-muted ll:opacity-40 ll:pointer-events-none"
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
                      className={`ll-kfb ll:absolute ll:top-1/2 ll:w-4 ll:h-4 ll:-translate-x-1/2 ll:-translate-y-1/2 ll:flex ll:items-center ll:justify-center ll:cursor-grab ll:active:cursor-grabbing ll:z-10`}
                    >
                      <i
                        className={`ll:w-2 ll:h-2 ll:rotate-45 ll:rounded-2xs ll:transition-transform ${
                          isKeySelected
                            ? "ll:bg-control-active ll:scale-125 ll:ring-2 ll:ring-control-active"
                            : "ll:bg-secondary ll:hover:bg-primary"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
};
