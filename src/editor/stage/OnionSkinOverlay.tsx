"use client";

import React, { useMemo } from "react";
import type { StageElement } from "./types";
import type { Layer, Composition } from "@/core/document/schema";
import { MAIN_COMPOSITION_ID } from "@/core/document/compositions";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { getDocument } from "@/core/store/documentState";
import { useTransportTime } from "@/core/time/useTransportTime";
import { useTimelineUiStore } from "@/core/store/useTimelineUiStore";
import type { MotionDocument } from "@/core/document/schema";
import {
  sampleLayerGhosts,
  type OnionSkinConfig,
  type GhostSample,
} from "@/core/timeline/onionSkin";

export interface OnionSkinOverlayProps {
  /** Optional explicit document (defaults to useDocument) */
  doc?: MotionDocument;
  /** Selected layer IDs (defaults to useSelectionStore) */
  selectedIds?: string[];
  /** Elements on artboard (for base placement and dimensions) */
  elements?: Record<string, StageElement>;
  /** Document layers (for frame fallback coordinates) */
  layers?: Record<string, Layer>;
  /** Document compositions (defaults to useDocument) */
  compositions?: Record<string, Composition>;
  /** Active composition ID (default: MAIN_COMPOSITION_ID) */
  compositionId?: string;
  /** Current composition playback or scrub time in seconds (defaults to useTransportTime) */
  currentTime?: number;
  /** Composition FPS (default 60) */
  fps?: number;
  /** Composition duration in seconds (default 10) */
  duration?: number;
  /** Onion skin configuration (defaults to useTimelineUiStore) */
  config?: OnionSkinConfig;
  /** Optional custom CSS classes */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
}

/**
 * Phase 71: Onion skin stage overlay.
 * Renders N ghost frames before and after the playhead at adjustable opacity,
 * drawn from canonical evaluate(). Positioned behind live element gestures and
 * transform overlays with pointer-events-none to prevent interaction interference.
 */
export const OnionSkinOverlay: React.FC<OnionSkinOverlayProps> = ({
  doc: propDoc,
  selectedIds: controlledSelectedIds,
  elements = {},
  layers: controlledLayers,
  compositions: controlledCompositions,
  compositionId = MAIN_COMPOSITION_ID,
  currentTime: controlledCurrentTime,
  fps = 60,
  duration = 10,
  config: controlledConfig,
  className = "",
  style,
}) => {
  const storeSelectedIds = useSelectionStore((s) => s.selectedIds);
  const selectedIds = controlledSelectedIds ?? storeSelectedIds;

  const doc = propDoc ?? getDocument();
  const storeConfig = useTimelineUiStore((s) => s.onionSkin);
  const config = controlledConfig ?? storeConfig;

  const storeTime = useTransportTime();
  const currentTime = controlledCurrentTime ?? storeTime;

  const effectiveDoc = useMemo(() => {
    if (!config.enabled || selectedIds.length === 0) return doc;
    if (controlledLayers || controlledCompositions) {
      return {
        ...doc,
        ...(controlledLayers ? { layers: controlledLayers } : {}),
        ...(controlledCompositions ? { compositions: controlledCompositions } : {}),
      };
    }
    return doc;
  }, [config.enabled, selectedIds.length, doc, controlledLayers, controlledCompositions]);

  // Sample ghosts for each selected layer
  const ghostsByLayer: Array<{ layerId: string; ghosts: GhostSample[] }> = useMemo(() => {
    if (!config.enabled || selectedIds.length === 0) return [];
    return selectedIds.map((layerId: string) => {
      const el = elements[layerId];
      const parentOrigin = el ? { ox: el.ox ?? 0, oy: el.oy ?? 0 } : undefined;
      const ghosts = sampleLayerGhosts({
        doc: effectiveDoc,
        compositionId,
        layerId,
        currentTime,
        fps,
        duration,
        config,
        parentOrigin,
      });
      return { layerId, ghosts };
    });
  }, [selectedIds, elements, effectiveDoc, compositionId, currentTime, fps, duration, config]);

  // Short-circuit: zero DOM when disabled, nothing selected, or no ghosts
  if (!config.enabled || selectedIds.length === 0) {
    return null;
  }

  const totalGhosts = ghostsByLayer.reduce((acc, l) => acc + l.ghosts.length, 0);
  if (totalGhosts === 0) return null;

  return (
    <div
      data-testid="onion-skin-overlay"
      className={`ll:pointer-events-none ll:absolute ll:inset-0 ll:overflow-visible ${className}`}
      style={{ zIndex: 12, ...style }}
    >
      {ghostsByLayer.flatMap(({ layerId, ghosts }) =>
        ghosts.map((ghost, idx) => {
          const isBefore = ghost.direction === "before";
          const borderStyle = isBefore
            ? "1.5px dashed var(--ll-text-secondary, rgba(120, 120, 120, 0.6))"
            : "1.5px solid var(--ll-border, rgba(160, 160, 160, 0.6))";
          const bgStyle = isBefore
            ? "var(--ll-surface-panel-bg, rgba(150, 150, 150, 0.04))"
            : "var(--ll-control-primary-bg, rgba(100, 100, 100, 0.05))";

          return (
            <div
              key={`ghost-${layerId}-${ghost.frameOffset}-${idx}`}
              data-testid="onion-ghost"
              data-layer-id={layerId}
              data-ghost-direction={ghost.direction}
              data-frame-offset={ghost.frameOffset}
              data-time={ghost.time.toFixed(3)}
              data-x={Math.round(ghost.canvasX)}
              data-y={Math.round(ghost.canvasY)}
              data-opacity={ghost.opacity.toFixed(3)}
              className="ll:absolute ll:rounded-sm ll:pointer-events-none ll:box-border"
              style={{
                left: ghost.canvasX,
                top: ghost.canvasY,
                width: ghost.width,
                height: ghost.height,
                opacity: ghost.opacity * ghost.layerOpacity,
                transform: `rotate(${ghost.rotation}deg) scale(${ghost.scaleX}, ${ghost.scaleY})`,
                transformOrigin: "center center",
                border: borderStyle,
                backgroundColor: bgStyle,
              }}
            >
              {/* Subtle frame offset indicator */}
              <span
                className="ll:absolute ll:bottom-0.5 ll:right-1 ll:text-micro ll:font-mono ll:select-none ll:text-muted"
                style={{ opacity: 0.85, fontSize: "9px", lineHeight: "10px" }}
              >
                {ghost.frameOffset > 0 ? `+${ghost.frameOffset}` : ghost.frameOffset}f
              </span>
            </div>
          );
        })
      )}
    </div>
  );
};
