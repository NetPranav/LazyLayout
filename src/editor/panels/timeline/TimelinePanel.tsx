"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { frameScheduler } from "@/core/time/scheduler";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import {
  useMotionModel,
  motionActions,
  isGrp,
  Fx,
  snapT,
  DUR,
  FPS,
} from "@/editor/motion-model";
import { TimelineTransport } from "./TimelineTransport";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineLane } from "./TimelineLane";
import { TimelineCurveGraph } from "./TimelineCurveGraph";
import { TimelineFooter } from "./TimelineFooter";
import { TimelinePlayhead } from "./TimelinePlayhead";
import { TimelineMenus } from "./TimelineMenus";
import type { TimelinePanelProps, ContextMenuState } from "./types";
import {
  TIMELINE_TRACK_COLUMN_DEFAULT_PX,
  TIMELINE_TRACK_COLUMN_MIN_PX,
  TIMELINE_TRACK_COLUMN_MAX_PX,
  TIMELINE_ZOOM_STEP_FACTOR,
} from "./constants";

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  fullWidth,
  onToggleFullWidth,
  height = "var(--ll-size-bottom-motion-h)",
  className = "",
  style,
  onExport,
  onOpenPresets: _onOpenPresets,
}) => {
  // Motion store subscriptions
  const comp = useMotionModel((s) => s.comp);
  const playhead = useMotionModel((s) => s.playhead);
  const playing = useMotionModel((s) => s.playing);
  const speed = useMotionModel((s) => s.speed);
  const loop = useMotionModel((s) => s.loop);
  const dir = useMotionModel((s) => s.dir);
  const shuttle = useMotionModel((s) => s.shuttle);
  const fps = useMotionModel((s) => s.fps);
  const zoom = useMotionModel((s) => s.zoom);
  const t0 = useMotionModel((s) => s.t0);
  const wa = useMotionModel((s) => s.wa);
  const view = useMotionModel((s) => s.view);
  const storeTrackWidth = useMotionModel((s) => s.trackWidth);

  // Selection store subscription
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const selectElement = useSelectionStore((s) => s.select);
  const clearSelection = useSelectionStore((s) => s.clearSelection);

  // Local interaction states
  const [trackWidth, setTrackWidth] = useState<number>(storeTrackWidth || TIMELINE_TRACK_COLUMN_DEFAULT_PX);
  const [containerWidth, setContainerWidth] = useState<number>(1000);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverFrame, setHoverFrame] = useState<number | null>(null);
  const [snapFlashFrame, setSnapFlashFrame] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isDropOver, setIsDropOver] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Synchronize track width with localStorage on mount (hydration-safe)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ll-tlhw");
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (parsed >= TIMELINE_TRACK_COLUMN_MIN_PX && parsed <= TIMELINE_TRACK_COLUMN_MAX_PX) {
          setTrackWidth(parsed);
          motionActions.setTrackWidth(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Update container width observer
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const updateWidth = () => {
      setContainerWidth(el.clientWidth);
    };
    updateWidth();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateWidth) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  // Calculate pixels per second (pps)
  const laneAvailableWidth = Math.max(300, containerWidth - trackWidth);
  const pps = (laneAvailableWidth / (comp.dur / fps)) * zoom;

  // 60fps Playback Engine via frameScheduler
  useEffect(() => {
    if (!playing) return;

    const unregister = frameScheduler.register("evaluate", (info) => {
      const dt = Math.min(0.1, Math.max(0, info.dt));

      const currentT = useMotionModel.getState().playhead;
      const currentWa = useMotionModel.getState().wa;
      const currentSpeed = useMotionModel.getState().speed;
      const currentDir = useMotionModel.getState().dir;
      const currentShuttle = useMotionModel.getState().shuttle;
      const currentLoop = useMotionModel.getState().loop;

      const effectiveSpeed = currentShuttle !== 0 ? Math.abs(currentShuttle) * currentSpeed : currentSpeed;
      const effectiveDir = currentShuttle < 0 ? -1 : currentDir;

      let nextT = currentT + dt * fps * effectiveSpeed * effectiveDir;

      if (effectiveDir > 0 && nextT >= currentWa.b) {
        if (currentLoop === 1) {
          nextT = currentWa.a + ((nextT - currentWa.b) % Math.max(1, currentWa.b - currentWa.a));
        } else if (currentLoop === 2) {
          nextT = Math.max(currentWa.a, currentWa.b - (nextT - currentWa.b));
          useMotionModel.setState({ dir: -1 });
        } else {
          motionActions.setPlayhead(currentWa.b);
          motionActions.setPlaying(false);
          return;
        }
      } else if (effectiveDir < 0 && nextT <= currentWa.a) {
        if (currentLoop === 1) {
          nextT = currentWa.b - ((currentWa.a - nextT) % Math.max(1, currentWa.b - currentWa.a));
        } else if (currentLoop === 2) {
          nextT = Math.min(currentWa.b, currentWa.a + (currentWa.a - nextT));
          useMotionModel.setState({ dir: 1 });
        } else {
          motionActions.setPlayhead(currentWa.a);
          motionActions.setPlaying(false);
          return;
        }
      }

      motionActions.setPlayhead(nextT);
    });

    return () => {
      unregister();
    };
  }, [playing, fps, loop, dir, speed, shuttle]);

  // Track Column Resize Drag Handle
  const handleSeparatorPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX;
    const initialW = trackWidth;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startX;
      const nextW = Math.max(
        TIMELINE_TRACK_COLUMN_MIN_PX,
        Math.min(TIMELINE_TRACK_COLUMN_MAX_PX, initialW + deltaX)
      );
      setTrackWidth(nextW);
      motionActions.setTrackWidth(nextW);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Double click on column separator resets to 264px
  const handleSeparatorDoubleClick = () => {
    setTrackWidth(TIMELINE_TRACK_COLUMN_DEFAULT_PX);
    motionActions.setTrackWidth(TIMELINE_TRACK_COLUMN_DEFAULT_PX);
  };

  // Hover Line & Tooltip over Lane Area
  const handleLanePointerMove = (e: React.PointerEvent) => {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - trackWidth;

    if (x < 0) {
      setHoverX(null);
      setHoverFrame(null);
      return;
    }

    setHoverX(x);
    const f = Math.round(Fx(x, pps, t0, 24, fps));
    setHoverFrame(Math.max(0, Math.min(comp.dur, f)));
  };

  const handleLanePointerLeave = () => {
    setHoverX(null);
    setHoverFrame(null);
  };

  // Zoom on Ctrl/Cmd + Wheel
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? TIMELINE_ZOOM_STEP_FACTOR : 1 / TIMELINE_ZOOM_STEP_FACTOR;
        const rect = scrollRef.current?.getBoundingClientRect();
        const anchorX = rect ? e.clientX - rect.left - trackWidth : 0;
        motionActions.zoomAt(factor, anchorX, pps, 24);
      } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        const delta = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        motionActions.setT0(t0 + delta / pps);
      }
    },
    [pps, t0, trackWidth]
  );

  // Keyboard Shortcuts (Space, J K L, Home, End, Arrows, I O, U, M, V, C, Delete)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const key = e.key;
      const mod = e.ctrlKey || e.metaKey;

      if (key === " ") {
        e.preventDefault();
        motionActions.setPlaying(!useMotionModel.getState().playing);
      } else if (key === "Home") {
        e.preventDefault();
        motionActions.setPlayhead(wa.a);
      } else if (key === "End") {
        e.preventDefault();
        motionActions.setPlayhead(wa.b);
      } else if (key === "ArrowLeft") {
        e.preventDefault();
        if (e.altKey) motionActions.jumpKey(-1);
        else motionActions.stepFrame(e.shiftKey ? -10 : -1);
      } else if (key === "ArrowRight") {
        e.preventDefault();
        if (e.altKey) motionActions.jumpKey(1);
        else motionActions.stepFrame(e.shiftKey ? 10 : 1);
      } else if (mod && (key === "d" || key === "D")) {
        e.preventDefault();
        motionActions.duplicateKeys();
      } else if (key === "k" || key === "K") {
        e.preventDefault();
        const isCurrentlyPlaying = useMotionModel.getState().playing;
        if (isCurrentlyPlaying) {
          motionActions.setPlaying(false);
        } else {
          const firstLayer = comp.layers.find((l) => !isGrp(l));
          if (firstLayer) {
            motionActions.addKey(firstLayer.id, firstLayer.tr[0]?.p ?? "opacity", playhead);
          }
        }
      } else if (key === "j" || key === "J") {
        e.preventDefault();
        motionActions.shuttle(-1);
      } else if (key === "l" || key === "L") {
        e.preventDefault();
        motionActions.shuttle(1);
      } else if (key === "i" || key === "I") {
        e.preventDefault();
        motionActions.setWorkArea(playhead, wa.b);
      } else if (key === "o" || key === "O") {
        e.preventDefault();
        motionActions.setWorkArea(wa.a, playhead);
      } else if (key === "u" || key === "U") {
        e.preventDefault();
        const nonGroupLayers = comp.layers.filter((l) => !isGrp(l));
        const allOpen = nonGroupLayers.every((l) => l.open);
        nonGroupLayers.forEach((l) => {
          motionActions.setLayer(l.id, { open: !allOpen });
        });
      } else if (key === "+" || key === "=") {
        e.preventDefault();
        motionActions.zoomAt(1.25, laneAvailableWidth / 2, pps);
      } else if (key === "-" || key === "_") {
        e.preventDefault();
        motionActions.zoomAt(0.8, laneAvailableWidth / 2, pps);
      } else if (key === "\\") {
        e.preventDefault();
        motionActions.setZoom(1);
        motionActions.setT0(0);
      } else if (key === "m" || key === "M") {
        e.preventDefault();
        motionActions.addMarker(playhead);
      } else if (key === "v" || key === "V") {
        motionActions.setTool("select");
      } else if (key === "c" || key === "C") {
        motionActions.setTool("split");
      } else if (key === "Delete" || key === "Backspace") {
        const selIds = Object.keys(useMotionModel.getState().selectedKeys);
        if (selIds.length > 0) {
          e.preventDefault();
          motionActions.deleteKeys(selIds);
        }
      } else if (key === "Escape") {
        motionActions.clearKeySelection();
        clearSelection();
      }
    },
    [clearSelection, comp.layers, laneAvailableWidth, playhead, pps, wa]
  );

  // Split layers into hierarchical tree matching Layers panel (hero -> headline, subtitle, button, image)
  const treeLayers = useMemo(() => {
    const heroLayer = comp.layers.find((l) => l.id === "hero");
    const childLayers = comp.layers.filter((l) => l.id !== "hero");

    return {
      hero: heroLayer,
      children: childLayers,
    };
  }, [comp.layers]);

  // Focus Dimming: if a layer is selected, others dim to 45%
  const hasSelection = selectedIds.length > 0;

  return (
    <section
      id="bottom"
      ref={panelRef}
      tabIndex={0}
      role="region"
      aria-label="Motion Timeline"
      onKeyDown={handleKeyDown}
      style={{
        height,
        ...style,
      }}
      className={`ll-timeline ll-bottom ll:flex ll:flex-col ll:border-t ll:border-border ll:bg-surface-panel ll:overflow-hidden ll:select-none ll:min-w-0 ll:outline-none ll:relative ${className}`}
    >
      {/* 1. Header Toolbar (44px) */}
      <TimelineTransport
        onExport={onExport}
        fullWidth={fullWidth}
        onToggleFullWidth={onToggleFullWidth}
      />

      {/* 2. Combined Timeline Scroller Area */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        onPointerMove={handleLanePointerMove}
        onPointerLeave={handleLanePointerLeave}
        className="ll-tl ll:flex-1 ll:min-h-0 ll:relative ll:overflow-y-auto ll:overflow-x-hidden"
      >
        {/* Track Column Resizer Divider Handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize track column"
          onPointerDown={handleSeparatorPointerDown}
          onDoubleClick={handleSeparatorDoubleClick}
          style={{ left: `${trackWidth - 4}px` }}
          className="ll-hwsizer ll:absolute ll:top-0 ll:bottom-0 ll:w-2 ll:cursor-col-resize ll:z-30 ll:hover:bg-primary/20"
        />

        {/* Content Container */}
        <div className="ll-tlc ll:relative ll:min-h-full ll:flex ll:flex-col">
          {/* Sticky Ruler Row (32px) */}
          <TimelineRuler
            laneWidth={laneAvailableWidth}
            pps={pps}
            trackWidth={trackWidth}
            onContextMenu={(e, frame) => {
              setContextMenu({
                kind: "ruler",
                x: e.clientX,
                y: e.clientY,
                frame,
              });
            }}
          />

          {/* Main Content: Graph View or Tracks View */}
          {view === "graph" ? (
            <TimelineCurveGraph
              trackWidth={trackWidth}
              laneWidth={laneAvailableWidth}
              pps={pps}
              selectedLayerId={selectedIds[0]}
            />
          ) : (
            <div role="rowgroup" className="ll:flex ll:flex-col">
              {/* Group: Hero frame track */}
              {treeLayers.hero && (
                <div
                  style={{
                    opacity: hasSelection && !selectedIds.includes("hero") ? 0.45 : 1,
                    transition: "opacity 0.2s ease-out",
                  }}
                >
                  <TimelineLane
                    key={treeLayers.hero.id}
                    layer={treeLayers.hero}
                    childLayers={treeLayers.children}
                    trackWidth={trackWidth}
                    pps={pps}
                    laneWidth={laneAvailableWidth}
                    isSelected={selectedIds.includes("hero")}
                    onSelectLayer={(id) => selectElement(id, "element")}
                    onOpenContextMenu={(ctx) => setContextMenu(ctx)}
                  />
                </div>
              )}

              {/* Children rows (if hero group is expanded) */}
              {(!treeLayers.hero || treeLayers.hero.gopen) &&
                treeLayers.children.map((layer) => {
                  const isSelected = selectedIds.includes(layer.id);
                  const isDimmed = hasSelection && !isSelected;

                  return (
                    <div
                      key={layer.id}
                      style={{
                        opacity: isDimmed ? 0.45 : 1,
                        transition: "opacity 0.2s ease-out",
                      }}
                    >
                      <TimelineLane
                        layer={layer}
                        isChild={true}
                        trackWidth={trackWidth}
                        pps={pps}
                        laneWidth={laneAvailableWidth}
                        isSelected={isSelected}
                        onSelectLayer={(id) => selectElement(id, "element")}
                        onOpenContextMenu={(ctx) => setContextMenu(ctx)}
                      />
                    </div>
                  );
                })}

              {/* Drop Zone: Drag a layer here to animate it */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDropOver(true);
                }}
                onDragLeave={() => setIsDropOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDropOver(false);
                  const layerId = e.dataTransfer.getData("text/plain");
                  if (layerId) {
                    motionActions.addProperty(layerId, "opacity");
                    selectElement(layerId, "element");
                  }
                }}
                style={{ gridTemplateColumns: `${trackWidth}px minmax(0, 1fr)` }}
                className="ll-tldz ll:grid ll:min-h-14 ll:shrink-0"
              >
                <div />
                <div
                  className={`ll-dzr ll:m-2 ll:flex ll:items-center ll:justify-center ll:border ll:border-dashed ll:rounded-md ll:font-sans ll:text-xs ll:transition-colors ${
                    isDropOver
                      ? "ll:border-primary ll:bg-surface-hover ll:text-primary"
                      : "ll:border-transparent ll:text-muted"
                  }`}
                >
                  Drag a layer here to animate it
                </div>
              </div>
            </div>
          )}

          {/* Spring-Driven Playhead and Needle Overlay */}
          <TimelinePlayhead
            laneWidth={laneAvailableWidth}
            trackWidth={trackWidth}
            pps={pps}
            hoverX={hoverX}
            hoverFrame={hoverFrame}
            snapFlashFrame={snapFlashFrame}
          />
        </div>
      </div>

      {/* 3. Footer (28px) */}
      <TimelineFooter trackWidth={trackWidth} />

      {/* 4. Timeline Context Menus */}
      <TimelineMenus
        ctx={contextMenu}
        onClose={() => setContextMenu(null)}
      />
    </section>
  );
};

export default TimelinePanel;
