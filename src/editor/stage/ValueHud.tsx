"use client";

import React, { useRef, useEffect } from "react";
import type { StageElement } from "./types";
import type { Layer } from "@/core/document/schema";
import { useTimelineUiStore } from "@/core/store/useTimelineUiStore";
import { getTransport } from "@/core/time/transport";
import { frameScheduler } from "@/core/time/scheduler";
import { getDocument } from "@/core/store/documentState";
import { evaluate } from "@/core/kernel/evaluate";
import { useMotionModel } from "@/editor/motion-model";

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
  // While playing, ValueHud is driven by direct DOM updates from frameScheduler "overlay" phase (ROADMAP Phase 56).
  // We subscribe only to paused time so React does not commit every frame during playback.
  const pausedPlayhead = useMotionModel((s) => (s.playing ? 0 : s.playhead));
  const currentFrame = isPlaying ? 0 : Math.round(getTransport().time * (getTransport().fps || 60));
  const currentTime = isPlaying ? 0 : getTransport().time;

  const hudRef = useRef<HTMLDivElement | null>(null);
  const selectedIdsRef = useRef(selectedIds);
  const elementsRef = useRef(elements);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
    elementsRef.current = elements;
  }, [selectedIds, elements]);

  useEffect(() => {
    return frameScheduler.register("overlay", () => {
      const t = getTransport();
      if (!t.playing) return;
      const hudEl = hudRef.current;
      if (!hudEl) return;
      const sel = selectedIdsRef.current;
      if (!sel || sel.length === 0) return;
      const activeId = sel[0] === "subtitle" ? "headline" : sel[0];
      const el = elementsRef.current[activeId];
      if (!el) return;

      const fps = t.fps || 60;
      const f = Math.round(t.time * fps);
      const doc = getDocument();
      const compId = getTransport().compositionId;
      let evaluated: Record<string, unknown> = {};
      try {
        evaluated = evaluate(doc, compId, activeId, t.time);
      } catch {
        // fallback
      }

      const ox = el.ox ?? 0;
      const oy = el.oy ?? 0;
      const baseFrameX = typeof evaluated["frame.x"] === "number" ? (evaluated["frame.x"] as number) : (el.x - ox);
      const transX = typeof evaluated["transform.x"] === "number" ? (evaluated["transform.x"] as number) : 0;
      const valX = Math.round(baseFrameX + ox + transX);

      const baseFrameY = typeof evaluated["frame.y"] === "number" ? (evaluated["frame.y"] as number) : (el.y - oy);
      const transY = typeof evaluated["transform.y"] === "number" ? (evaluated["transform.y"] as number) : 0;
      const valY = Math.round(baseFrameY + oy + transY);

      const frameRot = typeof evaluated["frame.rotation"] === "number" ? (evaluated["frame.rotation"] as number) : 0;
      const transRot = typeof evaluated["transform.rotate"] === "number" ? (evaluated["transform.rotate"] as number) : 0;
      const valRot = Math.round(frameRot + transRot);

      const opacityProp = evaluated["appearance.opacity"];
      const rawOpacity = typeof opacityProp === "number" ? opacityProp : 1;
      const valOpacity = Math.round(rawOpacity <= 1 ? rawOpacity * 100 : rawOpacity);

      hudEl.setAttribute("data-frame", String(f));
      hudEl.setAttribute("data-x", String(valX));
      hudEl.setAttribute("data-y", String(valY));
      hudEl.setAttribute("data-rotation", String(valRot));
      hudEl.setAttribute("data-opacity", String(valOpacity));

      const xEl = hudEl.querySelector('[data-testid="value-hud-x"]');
      if (xEl) xEl.textContent = String(valX);
      const yEl = hudEl.querySelector('[data-testid="value-hud-y"]');
      if (yEl) yEl.textContent = String(valY);
      const rotEl = hudEl.querySelector('[data-testid="value-hud-rotation"]');
      if (rotEl) rotEl.textContent = `${valRot}°`;
      const opEl = hudEl.querySelector('[data-testid="value-hud-opacity"]');
      if (opEl) opEl.textContent = `${valOpacity}%`;
    });
  }, []);

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

  // Position relative to layer (above, or below if near artboard top)
  const hudLeft = el.x;
  const hudTop = el.y >= 32 ? el.y - 28 : el.y + el.height + 26;

  return (
    <div
      ref={hudRef}
      data-testid="stage-value-hud"
      data-frame={currentFrame}
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
