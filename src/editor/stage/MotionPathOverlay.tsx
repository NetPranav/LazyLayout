"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import type { StageElement } from "./types";
import type { Layer, Clip, Composition, SpatialMode } from "@/core/document/schema";
import { clipTimeInComposition, MAIN_COMPOSITION_ID } from "@/core/document/compositions";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useDocument, documentCommands, type DocumentTransaction } from "@/core/store/useDocumentStore";
import { useTransportTime } from "@/core/time/useTransportTime";
import { getSpatialTrajectory } from "@/core/kernel/evaluate";
import { extractClipWaypoints, type ResolvedWaypoint } from "@/core/timeline/keyframeOps";

export interface MotionPathOverlayProps {
  /** Selected layer IDs (defaults to useSelectionStore) */
  selectedIds?: string[];
  /** Elements on artboard (for base placement and dimensions) */
  elements?: Record<string, StageElement>;
  /** Document layers (for frame fallback coordinates) */
  layers?: Record<string, Layer>;
  /** Document clips (defaults to useDocument) */
  clips?: Record<string, Clip>;
  /** Document compositions (defaults to useDocument) */
  compositions?: Record<string, Composition>;
  /** Active composition ID (default: MAIN_COMPOSITION_ID) */
  compositionId?: string;
  /** Current composition playback or scrub time in seconds (defaults to useTransportTime) */
  currentTime?: number;
  /** Composition FPS for velocity tick sampling (default 60) */
  fps?: number;
  /** Current stage zoom scale for scale-invariant handle sizing (default 1) */
  zoom?: number;
  /** Active editor mode ("design" | "motion" | "code") */
  mode?: "design" | "motion" | "code";
  /** Anchor point mode for trajectory origin: center of element or top-left (default "center") */
  anchorMode?: "center" | "top-left";
  /** Whether to render per-frame velocity ticks along the ribbon (default true) */
  showTicks?: boolean;
  /** Whether to render tangent arms and control point handles (default true) */
  showTangents?: boolean;
  /** Whether to render current playhead position indicator (default true) */
  showPlayhead?: boolean;
  /** Whether interactive waypoint and tangent editing is enabled (default true) */
  interactive?: boolean;
  /** Currently selected waypoint ID (controlled) */
  selectedWaypointId?: string | null;
  /** Callback fired when a waypoint is selected or deselected */
  onSelectWaypoint?: (waypointId: string | null) => void;
  /** Callback fired during or after waypoint position updates */
  onWaypointChange?: (clipId: string, waypointId: string, pos: { x: number; y: number }) => void;
  /** Callback fired during or after tangent handle updates */
  onTangentChange?: (
    clipId: string,
    waypointId: string,
    patch: { spatialIn?: { x: number; y: number }; spatialOut?: { x: number; y: number } }
  ) => void;
  /** Optional custom CSS classes */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
}

interface RenderableTrajectory {
  clipId: string;
  clipName: string;
  layerId: string;
  originX: number;
  originY: number;
  svgPath: string;
  waypoints: ResolvedWaypoint[];
  frameTicks: Array<{ time: number; point: { x: number; y: number } }>;
  currentPoint: { x: number; y: number } | null;
}

interface DragGesture {
  type: "waypoint" | "tangent-in" | "tangent-out";
  clipId: string;
  waypointId: string;
  startClientX: number;
  startClientY: number;
  initialWpX: number;
  initialWpY: number;
  initialHandleX: number;
  initialHandleY: number;
  initialOpposingX?: number;
  initialOpposingY?: number;
  mode?: SpatialMode;
  handleStyle?: string;
}

/**
 * Phase 69: Motion paths on the canvas (Milestones 4 & 5).
 * Renders SVG motion path ribbons, per-frame velocity ticks, keyframe waypoint handles,
 * tangent control handles, and playhead position markers for layers with 2D spatial trajectories.
 * Supports interactive dragging of waypoints and tangent handles backed by atomic document transactions.
 */
export const MotionPathOverlay: React.FC<MotionPathOverlayProps> = ({
  selectedIds: controlledSelectedIds,
  elements = {},
  layers: controlledLayers,
  clips: controlledClips,
  compositions: controlledCompositions,
  compositionId,
  currentTime: controlledCurrentTime,
  fps = 60,
  zoom = 1,
  mode: _mode,
  anchorMode = "center",
  showTicks = true,
  showTangents = true,
  showPlayhead = true,
  interactive = true,
  selectedWaypointId: controlledSelectedWaypointId,
  onSelectWaypoint,
  onWaypointChange,
  onTangentChange,
  className = "",
  style,
}) => {
  // Store subscriptions (fallback when props are not explicitly provided)
  const storeSelectedIds = useSelectionStore((s) => s.selectedIds);
  const storeLayers = useDocument((d) => d.layers);
  const storeClips = useDocument((d) => d.clips);
  const storeCompositions = useDocument((d) => d.compositions);
  const storeCurrentTime = useTransportTime({ maxHz: 30 });

  const selectedIds = controlledSelectedIds ?? storeSelectedIds;
  const layers = controlledLayers ?? storeLayers;
  const clips = controlledClips ?? storeClips;
  const compositions = controlledCompositions ?? storeCompositions;
  const currentTime = controlledCurrentTime ?? storeCurrentTime;
  const activeCompId = compositionId ?? MAIN_COMPOSITION_ID;
  const comp = compositions?.[activeCompId];

  // Scale factor: keep handles and ticks visually crisp and comfortable regardless of canvas zoom
  const scale = Math.max(0.05, zoom);
  const waypointRadius = 4 / scale;
  const waypointHitRadius = Math.max(waypointRadius, 10 / scale);
  const tangentRadius = 3 / scale;
  const tangentHitRadius = Math.max(tangentRadius, 8 / scale);
  const playheadInnerRadius = 4.5 / scale;
  const playheadOuterRadius = 7.5 / scale;
  const tickRadius = 1.5 / scale;

  // Waypoint selection state (controlled vs uncontrolled)
  const [internalSelectedWaypointId, setInternalSelectedWaypointId] = useState<string | null>(null);
  const activeWaypointId = controlledSelectedWaypointId !== undefined ? controlledSelectedWaypointId : internalSelectedWaypointId;

  const handleSelectWaypoint = useCallback(
    (waypointId: string | null) => {
      if (controlledSelectedWaypointId === undefined) {
        setInternalSelectedWaypointId(waypointId);
      }
      onSelectWaypoint?.(waypointId);
    },
    [controlledSelectedWaypointId, onSelectWaypoint]
  );

  // Gesture state & transaction reference
  const txRef = useRef<DocumentTransaction | null>(null);
  const gestureRef = useRef<DragGesture | null>(null);
  const [isGesturing, setIsGesturing] = useState(false);

  // Compile renderable trajectories for selected layers
  const trajectories = useMemo<RenderableTrajectory[]>(() => {
    if (!selectedIds || selectedIds.length === 0 || !clips) return [];

    const result: RenderableTrajectory[] = [];

    for (const layerId of selectedIds) {
      const layer = layers?.[layerId];
      const layerClips = Object.values(clips).filter(
        (c) => c.layerId === layerId && c.enabled !== false
      );

      for (const clip of layerClips) {
        const spatialMeta = clip.spatialTrajectories?.transform;
        if (!spatialMeta || spatialMeta.enabled === false) continue;
        if (!spatialMeta.waypoints || spatialMeta.waypoints.length < 2) continue;

        // Retrieve or compile geometry via the single canonical evaluation authority
        const geom = getSpatialTrajectory(clip, layer?.properties);
        if (!geom || geom.segments.length === 0) continue;

        // Compute origin anchor in artboard coordinates
        const el = elements[layerId];
        const baseX = el?.x ?? (typeof layer?.properties?.["frame.x"] === "number" ? layer.properties["frame.x"] : 0);
        const baseY = el?.y ?? (typeof layer?.properties?.["frame.y"] === "number" ? layer.properties["frame.y"] : 0);
        const baseW = el?.width ?? (typeof layer?.properties?.["frame.width"] === "number" ? layer.properties["frame.width"] : 0);
        const baseH = el?.height ?? (typeof layer?.properties?.["frame.height"] === "number" ? layer.properties["frame.height"] : 0);

        const originX = anchorMode === "top-left" ? baseX : baseX + baseW / 2;
        const originY = anchorMode === "top-left" ? baseY : baseY + baseH / 2;

        const svgPath = geom.toSvgPath();
        const waypoints = extractClipWaypoints(clip, layer?.properties);
        const frameTicks = showTicks ? geom.sampleFrameTicks(fps) : [];

        // Canonical composition-to-clip time mapping matching evaluate() kernel
        let currentPoint: { x: number; y: number } | null = null;
        if (showPlayhead) {
          const placement = comp?.clips.find((p) => p.clipId === clip.id);
          if (comp && placement) {
            const timing = clipTimeInComposition(comp, clip, currentTime);
            if (timing && timing.phase === "active") {
              currentPoint = geom.evaluateAtTime(timing.time);
            }
          } else {
            // Standalone clip fallback when no composition placement is specified
            if (currentTime >= 0 && currentTime <= clip.duration) {
              currentPoint = geom.evaluateAtTime(currentTime);
            }
          }
        }

        result.push({
          clipId: clip.id,
          clipName: clip.name,
          layerId,
          originX,
          originY,
          svgPath,
          waypoints,
          frameTicks,
          currentPoint,
        });
      }
    }

    return result;
  }, [
    selectedIds,
    layers,
    clips,
    comp,
    elements,
    currentTime,
    fps,
    anchorMode,
    showTicks,
    showPlayhead,
  ]);

  // Pointer gesture handlers
  const handleWaypointPointerDown = useCallback(
    (clipId: string, w: ResolvedWaypoint, e: React.PointerEvent) => {
      if (!interactive) return;
      e.stopPropagation();
      e.preventDefault();

      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture fallback
      }

      handleSelectWaypoint(w.id);

      const tx = documentCommands.begin("Move motion path waypoint");
      txRef.current = tx;
      gestureRef.current = {
        type: "waypoint",
        clipId,
        waypointId: w.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        initialWpX: w.x,
        initialWpY: w.y,
        initialHandleX: 0,
        initialHandleY: 0,
      };
      setIsGesturing(true);
    },
    [interactive, handleSelectWaypoint]
  );

  const handleTangentPointerDown = useCallback(
    (
      clipId: string,
      w: ResolvedWaypoint,
      handleType: "in" | "out",
      e: React.PointerEvent
    ) => {
      if (!interactive) return;
      e.stopPropagation();
      e.preventDefault();

      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture fallback
      }

      handleSelectWaypoint(w.id);

      const tx = documentCommands.begin("Edit motion path tangent");
      txRef.current = tx;

      const activeVector = handleType === "in" ? w.spatialIn : w.spatialOut;
      const opposingVector = handleType === "in" ? w.spatialOut : w.spatialIn;

      gestureRef.current = {
        type: handleType === "in" ? "tangent-in" : "tangent-out",
        clipId,
        waypointId: w.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        initialWpX: w.x,
        initialWpY: w.y,
        initialHandleX: activeVector?.x ?? 0,
        initialHandleY: activeVector?.y ?? 0,
        initialOpposingX: opposingVector?.x,
        initialOpposingY: opposingVector?.y,
        mode: w.mode,
        handleStyle: w.handleStyle,
      };
      setIsGesturing(true);
    },
    [interactive, handleSelectWaypoint]
  );

  // Global pointer move, pointer up, and keyboard cancellation
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;

      const deltaX = (e.clientX - gesture.startClientX) / scale;
      const deltaY = (e.clientY - gesture.startClientY) / scale;

      if (gesture.type === "waypoint") {
        const nextX = Math.round(gesture.initialWpX + deltaX);
        const nextY = Math.round(gesture.initialWpY + deltaY);
        documentCommands.updateWaypointPosition(gesture.clipId, gesture.waypointId, { x: nextX, y: nextY });
        onWaypointChange?.(gesture.clipId, gesture.waypointId, { x: nextX, y: nextY });
      } else if (gesture.type === "tangent-in" || gesture.type === "tangent-out") {
        const isIn = gesture.type === "tangent-in";
        const rawX = gesture.initialHandleX + deltaX;
        const rawY = gesture.initialHandleY + deltaY;
        const activeVec = { x: Math.round(rawX), y: Math.round(rawY) };

        let patch: {
          spatialIn?: { x: number; y: number };
          spatialOut?: { x: number; y: number };
        };

        if (gesture.mode === "continuous") {
          // Collinear opposite angle
          const actLen = Math.hypot(activeVec.x, activeVec.y);
          let oppVec: { x: number; y: number };

          if (actLen < 1e-4) {
            oppVec = { x: 0, y: 0 };
          } else {
            const angle = Math.atan2(activeVec.y, activeVec.x);
            const oppAngle = angle + Math.PI;

            let oppLen = actLen;
            if (gesture.handleStyle !== "symmetric" && gesture.initialOpposingX !== undefined && gesture.initialOpposingY !== undefined) {
              const initOpp = Math.hypot(gesture.initialOpposingX, gesture.initialOpposingY);
              if (initOpp > 1e-4) oppLen = initOpp;
            }

            oppVec = {
              x: Math.round(Math.cos(oppAngle) * oppLen),
              y: Math.round(Math.sin(oppAngle) * oppLen),
            };
          }

          if (isIn) {
            patch = { spatialIn: activeVec, spatialOut: oppVec };
          } else {
            patch = { spatialOut: activeVec, spatialIn: oppVec };
          }
        } else {
          // Independent tangent arms in bezier / broken mode
          if (isIn) {
            patch = { spatialIn: activeVec };
          } else {
            patch = { spatialOut: activeVec };
          }
        }

        documentCommands.updateWaypointTangents(gesture.clipId, gesture.waypointId, patch);
        onTangentChange?.(gesture.clipId, gesture.waypointId, patch);
      }
    };

    const handlePointerUp = () => {
      if (gestureRef.current) {
        gestureRef.current = null;
        setIsGesturing(false);
        try {
          txRef.current?.commit();
        } finally {
          txRef.current = null;
        }
      }
    };

    const handlePointerCancel = () => {
      if (gestureRef.current) {
        gestureRef.current = null;
        setIsGesturing(false);
        try {
          txRef.current?.cancel();
        } finally {
          txRef.current = null;
        }
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      if (txRef.current) {
        txRef.current.cancel();
        txRef.current = null;
      }
    };
  }, [scale, onWaypointChange, onTangentChange]);

  if (trajectories.length === 0) {
    return null;
  }

  return (
    <svg
      data-testid="motion-path-overlay"
      className={`ll-motion-path-overlay ll:absolute ll:inset-0 ll:w-full ll:h-full ll:pointer-events-none ll:overflow-visible ${className}`}
      style={{
        zIndex: 25,
        ...style,
      }}
      aria-label="Motion paths overlay"
      aria-hidden="true"
    >
      {trajectories.map((traj) => (
        <g
          key={traj.clipId}
          data-testid="motion-path-group"
          data-clip-id={traj.clipId}
          data-layer-id={traj.layerId}
          transform={`translate(${traj.originX}, ${traj.originY})`}
        >
          {/* 1. High-contrast underlay stroke for visibility over varied backgrounds */}
          <path
            d={traj.svgPath}
            fill="none"
            stroke="var(--ll-surface-canvas, #ffffff)"
            strokeWidth={4 / scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.65}
            vectorEffect="non-scaling-stroke"
          />

          {/* 2. Trajectory Ribbon (smooth SVG spline) */}
          <path
            data-testid="motion-path-ribbon"
            d={traj.svgPath}
            fill="none"
            stroke="var(--ll-label-1, #7A8A9C)"
            strokeWidth={1.5 / scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* 3. Per-frame velocity ticks (spacing reveals acceleration/velocity) */}
          {showTicks &&
            traj.frameTicks.map((tick, i) => (
              <circle
                key={`tick-${i}`}
                data-testid="motion-path-tick"
                cx={tick.point.x}
                cy={tick.point.y}
                r={tickRadius}
                fill="var(--ll-text-secondary, #55554F)"
                opacity={0.75}
              />
            ))}

          {/* 4. Tangent arms and control handles */}
          {traj.waypoints.map((w) => {
            const isSelected = activeWaypointId === w.id;
            const shouldShowTangents = showTangents || isSelected;
            if (!shouldShowTangents || w.mode === "linear") return null;

            return (
              <g key={`tangents-${w.id}`}>
                {/* Incoming tangent handle */}
                {w.spatialIn && (
                  <g data-testid="motion-path-tangent-in-group">
                    <line
                      x1={w.x}
                      y1={w.y}
                      x2={w.x + w.spatialIn.x}
                      y2={w.y + w.spatialIn.y}
                      stroke="var(--ll-text-muted, #66665F)"
                      strokeWidth={1 / scale}
                      strokeDasharray={`${3 / scale},${3 / scale}`}
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* Interactive hit area */}
                    {interactive && (
                      <circle
                        cx={w.x + w.spatialIn.x}
                        cy={w.y + w.spatialIn.y}
                        r={tangentHitRadius}
                        fill="transparent"
                        style={{ pointerEvents: "all", cursor: isGesturing ? "grabbing" : "grab" }}
                        onPointerDown={(e) => handleTangentPointerDown(traj.clipId, w, "in", e)}
                      />
                    )}
                    <circle
                      data-testid="motion-path-tangent-in"
                      cx={w.x + w.spatialIn.x}
                      cy={w.y + w.spatialIn.y}
                      r={tangentRadius}
                      fill={isSelected ? "var(--ll-accent, #3B82F6)" : "var(--ll-label-1, #7A8A9C)"}
                      stroke="var(--ll-surface-panel, #F4F3EF)"
                      strokeWidth={1.5 / scale}
                      style={{ pointerEvents: interactive ? "all" : "none", cursor: isGesturing ? "grabbing" : "grab" }}
                      onPointerDown={(e) => handleTangentPointerDown(traj.clipId, w, "in", e)}
                    />
                  </g>
                )}

                {/* Outgoing tangent handle */}
                {w.spatialOut && (
                  <g data-testid="motion-path-tangent-out-group">
                    <line
                      x1={w.x}
                      y1={w.y}
                      x2={w.x + w.spatialOut.x}
                      y2={w.y + w.spatialOut.y}
                      stroke="var(--ll-text-muted, #66665F)"
                      strokeWidth={1 / scale}
                      strokeDasharray={`${3 / scale},${3 / scale}`}
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* Interactive hit area */}
                    {interactive && (
                      <circle
                        cx={w.x + w.spatialOut.x}
                        cy={w.y + w.spatialOut.y}
                        r={tangentHitRadius}
                        fill="transparent"
                        style={{ pointerEvents: "all", cursor: isGesturing ? "grabbing" : "grab" }}
                        onPointerDown={(e) => handleTangentPointerDown(traj.clipId, w, "out", e)}
                      />
                    )}
                    <circle
                      data-testid="motion-path-tangent-out"
                      cx={w.x + w.spatialOut.x}
                      cy={w.y + w.spatialOut.y}
                      r={tangentRadius}
                      fill={isSelected ? "var(--ll-accent, #3B82F6)" : "var(--ll-label-1, #7A8A9C)"}
                      stroke="var(--ll-surface-panel, #F4F3EF)"
                      strokeWidth={1.5 / scale}
                      style={{ pointerEvents: interactive ? "all" : "none", cursor: isGesturing ? "grabbing" : "grab" }}
                      onPointerDown={(e) => handleTangentPointerDown(traj.clipId, w, "out", e)}
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* 5. Keyframe waypoint handles */}
          {traj.waypoints.map((w) => {
            const isLinear = w.mode === "linear";
            const isSelected = activeWaypointId === w.id;

            return (
              <g
                key={`wp-${w.id}`}
                data-testid="motion-path-waypoint"
                data-waypoint-id={w.id}
                data-waypoint-time={w.time}
                data-waypoint-mode={w.mode ?? "catmull"}
                data-selected={isSelected ? "true" : "false"}
              >
                {/* Selection accent ring */}
                {isSelected && (
                  <circle
                    data-testid="motion-path-waypoint-selection-ring"
                    cx={w.x}
                    cy={w.y}
                    r={waypointRadius + 3.5 / scale}
                    fill="none"
                    stroke="var(--ll-accent, #3B82F6)"
                    strokeWidth={2 / scale}
                    strokeDasharray={isLinear ? undefined : `${2 / scale},${2 / scale}`}
                  />
                )}

                {/* Hit area */}
                {interactive && (
                  <circle
                    cx={w.x}
                    cy={w.y}
                    r={waypointHitRadius}
                    fill="transparent"
                    style={{ pointerEvents: "all", cursor: isGesturing ? "grabbing" : "grab" }}
                    onPointerDown={(e) => handleWaypointPointerDown(traj.clipId, w, e)}
                  />
                )}

                {isLinear ? (
                  // Square waypoint dot for linear corner segments
                  <rect
                    x={w.x - waypointRadius}
                    y={w.y - waypointRadius}
                    width={waypointRadius * 2}
                    height={waypointRadius * 2}
                    fill={isSelected ? "var(--ll-accent, #3B82F6)" : "var(--ll-surface-panel, #F4F3EF)"}
                    stroke="var(--ll-control-primary-bg, #22231E)"
                    strokeWidth={1.5 / scale}
                    rx={1 / scale}
                    style={{ pointerEvents: interactive ? "all" : "none", cursor: isGesturing ? "grabbing" : "grab" }}
                    onPointerDown={(e) => handleWaypointPointerDown(traj.clipId, w, e)}
                  />
                ) : (
                  // Circular waypoint dot for curved Bezier / Catmull-Rom segments
                  <circle
                    cx={w.x}
                    cy={w.y}
                    r={waypointRadius}
                    fill={isSelected ? "var(--ll-accent, #3B82F6)" : "var(--ll-surface-panel, #F4F3EF)"}
                    stroke="var(--ll-control-primary-bg, #22231E)"
                    strokeWidth={1.5 / scale}
                    style={{ pointerEvents: interactive ? "all" : "none", cursor: isGesturing ? "grabbing" : "grab" }}
                    onPointerDown={(e) => handleWaypointPointerDown(traj.clipId, w, e)}
                  />
                )}
              </g>
            );
          })}

          {/* 6. Playhead position indicator */}
          {showPlayhead && traj.currentPoint && (
            <g
              data-testid="motion-path-playhead-group"
              transform={`translate(${traj.currentPoint.x}, ${traj.currentPoint.y})`}
            >
              <circle
                r={playheadOuterRadius}
                fill="none"
                stroke="var(--ll-label-6, #8F85BE)"
                strokeWidth={1.5 / scale}
                opacity={0.6}
              />
              <circle
                data-testid="motion-path-playhead"
                r={playheadInnerRadius}
                fill="var(--ll-label-6, #8F85BE)"
                stroke="var(--ll-surface-panel, #F4F3EF)"
                strokeWidth={1.5 / scale}
              />
            </g>
          )}
        </g>
      ))}
    </svg>
  );
};
