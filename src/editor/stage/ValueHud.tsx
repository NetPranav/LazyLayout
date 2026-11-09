"use client";

import React from "react";
import type { StageElement } from "./types";
import type { Layer } from "@/core/document/schema";
import { useTimelineUiStore } from "@/core/store/useTimelineUiStore";
import { getTransport } from "@/core/time/transport";
import { getDocument } from "@/core/store/documentState";
import { evaluate } from "@/core/kernel/evaluate";
import { useMotionModel, useOverlayFrame, useOverlayTime } from "@/editor/motion-model";

export interface ValueHudProps {
  selectedIds: string[];
  elements: Record<string, StageElement>;
  layers?: Record<string, Layer>;
  isGesturing?: boolean;
  forceVisible?: boolean;
}

export const ValueHud: React.FC<ValueHudProps> = ({
  selectedIds,
  elements,
  layers: _layers,
  isGesturing = false,
  forceVisible = false,
}) => {
  const isPlaying = useMotionModel((s) => s.playing);
  const storeScrubbing = useTimelineUiStore((s) => s.isScrubbing);
  const isScrubbing = storeScrubbing || useTimelineUiStore.getState().isScrubbing;
  // ROADMAP Phase 55: Value HUD reads the frame and time published in the "overlay" phase
  // so it stays in lockstep with the stage canvas
  const overlayFrame = useOverlayFrame();
  const overlayTime = useOverlayTime();

  const shouldShow = forceVisible || ((isScrubbing || isGesturing || isPlaying) && selectedIds.length > 0);
  if (!shouldShow || selectedIds.length === 0) return null;

  const activeId = selectedIds[0] === "subtitle" ? "headline" : selectedIds[0];
  const el = elements[activeId];
  if (!el) return null;

  const compId = getTransport().compositionId;
  const doc = getDocument();

  let evaluated: Record<string, unknown> = {};
  try {
    evaluated = evaluate(doc, compId, activeId, overlayTime);
  } catch {
    // Evaluation fallback
  }

  const ox = el.ox ?? 0;
  const oy = el.oy ?? 0;

  // X coordinate
  const baseFrameX = typeof evaluated["frame.x"] === "number" ? (evaluated["frame.x"] as number) : (el.x - ox);
  const transX = typeof evaluated["transform.x"] === "number" ? (evaluated["transform.x"] as number) : 0;
  const valX = isGesturing ? Math.round(el.x) : Math.round(baseFrameX + ox + transX);

  // Y coordinate
  const baseFrameY = typeof evaluated["frame.y"] === "number" ? (evaluated["frame.y"] as number) : (el.y - oy);
  const transY = typeof evaluated["transform.y"] === "number" ? (evaluated["transform.y"] as number) : 0;
  const valY = isGesturing ? Math.round(el.y) : Math.round(baseFrameY + oy + transY);

  // Rotation in degrees
  const frameRot = typeof evaluated["frame.rotation"] === "number" ? (evaluated["frame.rotation"] as number) : 0;
  const transRot = typeof evaluated["transform.rotate"] === "number" ? (evaluated["transform.rotate"] as number) : 0;
  const valRot = Math.round(frameRot + transRot);

  // Opacity percentage (0-100%)
  const opacityProp = evaluated["appearance.opacity"];
  const rawOpacity = typeof opacityProp === "number" ? opacityProp : 1;
  const valOpacity = Math.round(rawOpacity <= 1 ? rawOpacity * 100 : rawOpacity);

  // Position relative to layer (above, or below if near artboard top)
  const hudLeft = el.x;
  const hudTop = el.y >= 32 ? el.y - 28 : el.y + el.height + 26;

  return (
    <div
      data-testid="stage-value-hud"
      data-frame={overlayFrame}
      data-x={valX}
      data-y={valY}
      data-rotation={valRot}
      data-opacity={valOpacity}
      className="ll-value-hud ll:absolute ll:pointer-events-none ll:z-30 ll:flex ll:items-center ll:gap-2 ll:px-2 ll:py-1 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:shadow-sm ll:font-mono ll:text-nano ll:text-primary ll:whitespace-nowrap"
      style={{
        left: hudLeft,
        top: hudTop,
      }}
    >
      <div className="ll:flex ll:items-center ll:gap-1">
        <span className="ll:text-muted">X</span>
        <span data-testid="value-hud-x">{valX}</span>
      </div>
      <span className="ll:w-px ll:h-3 ll:bg-border" aria-hidden="true" />
      <div className="ll:flex ll:items-center ll:gap-1">
        <span className="ll:text-muted">Y</span>
        <span data-testid="value-hud-y">{valY}</span>
      </div>
      <span className="ll:w-px ll:h-3 ll:bg-border" aria-hidden="true" />
      <div className="ll:flex ll:items-center ll:gap-1">
        <span className="ll:text-muted">R</span>
        <span data-testid="value-hud-rotation">{valRot}°</span>
      </div>
      <span className="ll:w-px ll:h-3 ll:bg-border" aria-hidden="true" />
      <div className="ll:flex ll:items-center ll:gap-1">
        <span className="ll:text-muted">O</span>
        <span data-testid="value-hud-opacity">{valOpacity}%</span>
      </div>
    </div>
  );
};
