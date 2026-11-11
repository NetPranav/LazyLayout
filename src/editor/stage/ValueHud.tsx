"use client";

import React from "react";
import type { StageElement } from "./types";
import type { Layer } from "@/core/document/schema";
import { useTimelineUiStore } from "@/core/store/useTimelineUiStore";
import { getTransport } from "@/core/time/transport";
import { getDocument } from "@/core/store/documentState";
import { evaluate } from "@/core/kernel/evaluate";
import { useMotionModel, useOverlayFrame, useOverlayTime } from "@/editor/motion-model";
import { STAGE_CONSTANTS } from "./constants";

export interface ValueHudProps {
  selectedIds: string[];
  elements: Record<string, StageElement>;
  layers?: Record<string, Layer>;
  isGesturing?: boolean;
  forceVisible?: boolean;
  /** How much the artboard is scaled on screen; the chip is drawn against it so it keeps its size at any zoom. */
  zoom?: number;
}

export const ValueHud: React.FC<ValueHudProps> = ({
  selectedIds,
  elements,
  layers,
  isGesturing = false,
  forceVisible = false,
  zoom = 1,
}) => {
  const isPlaying = useMotionModel((s) => s.playing);
  const storeScrubbing = useTimelineUiStore((s) => s.isScrubbing);
  const isScrubbing = storeScrubbing || useTimelineUiStore.getState().isScrubbing;
  // ROADMAP Phase 55: Value HUD reads the frame and time published in the "overlay" phase
  // during playback, and current time when paused/scrubbing, so it stays in lockstep with the stage canvas.
  const overlayFrame = useOverlayFrame();
  const overlayTime = useOverlayTime();
  const currentFrame = isPlaying ? overlayFrame : Math.round(getTransport().time * (getTransport().fps || 60));
  const currentTime = isPlaying ? overlayTime : getTransport().time;

  const shouldShow = forceVisible || ((isScrubbing || isGesturing || isPlaying) && selectedIds.length > 0);
  if (!shouldShow || selectedIds.length === 0) return null;

  const activeId = selectedIds[0] === "subtitle" ? "headline" : selectedIds[0];
  const el = elements[activeId];
  if (!el) return null;

  const compId = getTransport().compositionId;
  const doc = getDocument();

  let evaluated: Record<string, unknown> = {};
  try {
    evaluated = evaluate(doc, compId, activeId, currentTime);
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

  // Scale: the artboard is drawn zoomed, so the chip is divided by the zoom (1 screen px = 1 unit of inv).
  const scale = zoom > 0 ? zoom : 1;
  const inv = 1 / scale;
  // The frame's title (the size label) is drawn above the frame, scaled to stay readable when zoomed out.
  const titleScale = scale < 1 ? 1 / scale : 1;
  const selectedLayer = layers?.[activeId];
  const parentLayer = selectedLayer?.parentId ? layers?.[selectedLayer.parentId] : undefined;
  const isTopFrame = selectedLayer?.archetype === "container" && !!parentLayer && parentLayer.parentId == null;
  // Sit above the selection with an 8px gap; a top-level frame sits above its title row instead, so the title and handles stay clear.
  const titleTop = el.y + STAGE_CONSTANTS.sizeLabelOffsetTop + STAGE_CONSTANTS.sizeLabelHeight - STAGE_CONSTANTS.sizeLabelHeight * titleScale;
  const hudLeft = isTopFrame ? el.x + STAGE_CONSTANTS.sizeLabelOffsetLeft : el.x;
  const hudBottom = (isTopFrame ? titleTop : el.y) - 8 * inv;
  // The chip is 16px tall on screen. With no room above (the frame is near the top of the canvas), it drops below the selection instead.
  const flipBelow = hudBottom - 16 * inv < 0;
  const hudTop = flipBelow ? el.y + el.height + 8 * inv : hudBottom;

  return (
    <div
      data-testid="stage-value-hud"
      data-frame={currentFrame}
      data-x={valX}
      data-y={valY}
      data-rotation={valRot}
      data-opacity={valOpacity}
      className="ll-value-hud ll:absolute ll:pointer-events-none ll:z-30 ll:flex ll:items-center ll:gap-2 ll:whitespace-nowrap"
      style={{
        left: hudLeft,
        // above: the chip's bottom edge sits at hudTop and it grows upward, so it never reaches the title or the handles; flipped: it hangs below the selection
        top: hudTop,
        transform: flipBelow ? `scale(${inv})` : `translateY(-100%) scale(${inv})`,
        transformOrigin: flipBelow ? "left top" : "left bottom",
        font: "500 11px/16px var(--ll-font-mono)",
        backgroundColor: "var(--ll-control-primary-bg)",
        color: "var(--ll-control-primary-fg)",
        padding: "0 6px",
        borderRadius: "var(--ll-radius-sm)",
      }}
    >
      <div className="ll:flex ll:items-center ll:gap-1">
        <span style={{ opacity: 0.6 }}>X</span>
        <span data-testid="value-hud-x">{valX}</span>
      </div>
      <span className="ll:w-px ll:h-3" style={{ backgroundColor: "currentColor", opacity: 0.3 }} aria-hidden="true" />
      <div className="ll:flex ll:items-center ll:gap-1">
        <span style={{ opacity: 0.6 }}>Y</span>
        <span data-testid="value-hud-y">{valY}</span>
      </div>
      <span className="ll:w-px ll:h-3" style={{ backgroundColor: "currentColor", opacity: 0.3 }} aria-hidden="true" />
      <div className="ll:flex ll:items-center ll:gap-1">
        <span style={{ opacity: 0.6 }}>R</span>
        <span data-testid="value-hud-rotation">{valRot}°</span>
      </div>
      <span className="ll:w-px ll:h-3" style={{ backgroundColor: "currentColor", opacity: 0.3 }} aria-hidden="true" />
      <div className="ll:flex ll:items-center ll:gap-1">
        <span style={{ opacity: 0.6 }}>O</span>
        <span data-testid="value-hud-opacity">{valOpacity}%</span>
      </div>
    </div>
  );
};
