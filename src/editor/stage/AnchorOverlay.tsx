"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { StageElement } from "./types";
import type { Layer } from "@/core/document/schema";
import type { PropValue } from "@/core/document/registry";
import {
  PRESET_PIN_NAMES,
  PRESET_PIN_ALIASES,
  resolveLayerAnchor,
  resolvePresetPinPosition,
  findNearestPresetPin,
  formatCssTransformOrigin,
} from "@/core/geometry/pins";
import { compensateTransformForAnchorChange } from "@/core/geometry/transforms";
import { setLayerProps } from "@/core/editing/editOps";
import { useSelectionStore } from "@/core/store/useSelectionStore";

interface AnchorOverlayProps {
  selectedIds: string[];
  elements: Record<string, StageElement>;
  layers?: Record<string, Layer>;
  zoom?: number;
  onUpdateAnchor?: (
    layerId: string,
    origin: string,
    compensated?: { x: number; y: number }
  ) => void;
}

interface DragState {
  layerId: string;
  startX: number;
  startY: number;
  currentLocalX: number;
  currentLocalY: number;
  snappedPreset: string | null;
  oldAnchor: [number, number];
  rotation: number;
  scaleX: number;
  scaleY: number;
  transformX: number;
  transformY: number;
  layerWidth: number;
  layerHeight: number;
  layerX: number;
  layerY: number;
}

export const AnchorOverlay: React.FC<AnchorOverlayProps> = ({
  selectedIds,
  elements,
  layers,
  zoom = 1,
  onUpdateAnchor,
}) => {
  // The middle of a layer belongs to the layer: clicking selects it and dragging moves it (in Motion, that drag is how
  // keys are recorded). So the anchor is a marker, and is dragged with Ctrl (Cmd on a Mac) held, the way After
  // Effects keeps it on its own tool. It also waits for the press that selected the layer to be over, so that press's
  // release still lands on the layer.
  const [armedFor, setArmedFor] = useState<string | null>(null);
  const [modifier, setModifier] = useState(false);
  useEffect(() => {
    const track = (e: PointerEvent) => setModifier(e.ctrlKey || e.metaKey);
    window.addEventListener("pointermove", track);
    window.addEventListener("pointerdown", track, true);
    return () => {
      window.removeEventListener("pointermove", track);
      window.removeEventListener("pointerdown", track, true);
    };
  }, []);
  useEffect(() => {
    // read the store, not props: a click selects inside its own handler, before this listener runs
    const settle = () => setArmedFor(useSelectionStore.getState().selectedIds[0] ?? null);
    window.addEventListener("pointerup", settle);
    window.addEventListener("click", settle);
    return () => {
      window.removeEventListener("pointerup", settle);
      window.removeEventListener("click", settle);
    };
  }, []);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // Zoom compensation so the handle stays 14px on screen
  const keep = zoom > 0 && zoom < 1 ? 1 / zoom : 1;

  // Listen for pointer move and up during dragging
  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      const dxScreen = (e.clientX - state.startX) / (zoom || 1);
      const dyScreen = (e.clientY - state.startY) / (zoom || 1);

      // Invert rotation to convert screen displacement into layer-local displacement
      const rad = (-state.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const localDx = (dxScreen * cos - dyScreen * sin) / (state.scaleX || 1);
      const localDy = (dxScreen * sin + dyScreen * cos) / (state.scaleY || 1);

      let targetX = state.oldAnchor[0] + localDx;
      let targetY = state.oldAnchor[1] + localDy;

      // Check snapping to the 9 preset pins
      const snap = findNearestPresetPin(
        [targetX, targetY],
        state.layerWidth,
        state.layerHeight,
        10
      );

      let snappedPreset: string | null = null;
      if (snap) {
        targetX = snap.position[0];
        targetY = snap.position[1];
        snappedPreset = snap.name;
      }

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              currentLocalX: targetX,
              currentLocalY: targetY,
              snappedPreset,
            }
          : null
      );
    },
    [zoom]
  );

  const handlePointerUp = useCallback(() => {
    const state = dragStateRef.current;
    if (!state) return;

    const newAnchor: [number, number] = [
      state.currentLocalX,
      state.currentLocalY,
    ];

    // Determine the origin property value
    const originValue =
      state.snappedPreset ||
      `${Math.round(newAnchor[0])}px ${Math.round(newAnchor[1])}px`;

    // Compute compensated transform to avoid visual jumps if rotated/scaled
    const [compTx, compTy] = compensateTransformForAnchorChange(
      state.oldAnchor,
      newAnchor,
      state.rotation,
      state.scaleX,
      state.scaleY,
      [state.transformX, state.transformY]
    );

    const patch: Record<string, PropValue | null> = {
      "transform.origin": originValue,
    };

    // If already rotated or scaled, apply translation compensation
    if (
      state.rotation !== 0 ||
      state.scaleX !== 1 ||
      state.scaleY !== 1
    ) {
      patch["transform.x"] = compTx;
      patch["transform.y"] = compTy;
    }

    setLayerProps([state.layerId], patch, "Move anchor point");
    onUpdateAnchor?.(state.layerId, originValue, { x: compTx, y: compTy });

    setDragState(null);
  }, [onUpdateAnchor]);

  useEffect(() => {
    if (dragState) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [dragState, handlePointerMove, handlePointerUp]);

  // Only render for primary selected element (or single selection)
  if (selectedIds.length === 0) return null;

  const targetId = selectedIds[0] === "subtitle" ? "headline" : selectedIds[0];
  const el = elements[targetId];
  const layer = layers ? layers[targetId] : undefined;
  if (!el) return null;

  // A centred anchor is the default and needs no mark: it is shown once it has been moved, while Ctrl/Cmd is held to
  // grab it, and during a drag. (Otherwise it would sit on top of the middle of every selected layer.)
  const origin = layer?.properties?.["transform.origin"];
  const offCentre = typeof origin === "string" && origin !== "" && origin !== "center";
  if (!offCentre && !modifier && !dragState) return null;

  const width = el.width;
  const height = el.height;

  // Active anchor coordinates
  const currentAnchor = dragState
    ? [dragState.currentLocalX, dragState.currentLocalY]
    : resolveLayerAnchor(layer, width, height);

  const rot = typeof layer?.properties?.["transform.rotate"] === "number"
    ? (layer.properties["transform.rotate"] as number)
    : 0;
  const scale = typeof layer?.properties?.["transform.scale"] === "number"
    ? (layer.properties["transform.scale"] as number)
    : 1;
  const scaleX = (typeof layer?.properties?.["transform.scaleX"] === "number"
    ? (layer.properties["transform.scaleX"] as number)
    : 1) * scale;
  const scaleY = (typeof layer?.properties?.["transform.scaleY"] === "number"
    ? (layer.properties["transform.scaleY"] as number)
    : 1) * scale;
  const tx = typeof layer?.properties?.["transform.x"] === "number"
    ? (layer.properties["transform.x"] as number)
    : 0;
  const ty = typeof layer?.properties?.["transform.y"] === "number"
    ? (layer.properties["transform.y"] as number)
    : 0;

  // Calculate position on canvas (including layer transform)
  // When anchor is local (ax, ay), its position on canvas relative to layer origin is:
  // Since CSS transform-origin is set to currentAnchor, anchor is at el.x + tx + ax, el.y + ty + ay
  const anchorCanvasX = el.x + tx + currentAnchor[0];
  const anchorCanvasY = el.y + ty + currentAnchor[1];

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    setDragState({
      layerId: targetId,
      startX: e.clientX,
      startY: e.clientY,
      currentLocalX: currentAnchor[0],
      currentLocalY: currentAnchor[1],
      snappedPreset: null,
      oldAnchor: [currentAnchor[0], currentAnchor[1]],
      rotation: rot,
      scaleX,
      scaleY,
      transformX: tx,
      transformY: ty,
      layerWidth: width,
      layerHeight: height,
      layerX: el.x,
      layerY: el.y,
    });
  };

  return (
    <div
      data-testid="anchor-overlay"
      className="ll:absolute ll:inset-0 ll:pointer-events-none ll:overflow-visible ll:z-30"
      aria-hidden="true"
    >
      {/* While dragging: Render all 9 preset target pins for visual snapping */}
      {dragState && (
        <div
          className="ll:absolute ll:pointer-events-none"
          style={{
            left: el.x + tx,
            top: el.y + ty,
            width,
            height,
            transform: `rotate(${rot}deg) scale(${scaleX}, ${scaleY})`,
            transformOrigin: formatCssTransformOrigin(dragState.oldAnchor),
          }}
        >
          {PRESET_PIN_NAMES.map((pinName) => {
            const [px, py] = resolvePresetPinPosition(pinName, width, height);
            const isSnapped = dragState.snappedPreset === pinName;
            return (
              <div
                key={pinName}
                data-testid="preset-pin-target"
                data-pin-name={pinName}
                data-snapped={isSnapped ? "true" : "false"}
                className={`ll:absolute ll:rounded-full ll:pointer-events-none ll:-translate-x-1/2 ll:-translate-y-1/2 ${
                  isSnapped
                    ? "ll:bg-accent ll:ring-2 ll:ring-primary"
                    : "ll:bg-muted/60 ll:border ll:border-surface-panel"
                }`}
                style={{
                  left: px,
                  top: py,
                  width: isSnapped ? 8 * keep : 6 * keep,
                  height: isSnapped ? 8 * keep : 6 * keep,
                  transition: "all 0.1s ease-out",
                }}
              />
            );
          })}
        </div>
      )}

      {/* The Anchor Point Handle: Interactive Bullseye Crosshair ⨁ */}
      <div
        data-testid="anchor-point-handle"
        data-anchor-x={Math.round(currentAnchor[0])}
        data-anchor-y={Math.round(currentAnchor[1])}
        data-anchor-preset={(() => {
          const raw = dragState?.snappedPreset || (typeof layer?.properties?.["transform.origin"] === "string" ? layer.properties["transform.origin"] : "center");
          return PRESET_PIN_ALIASES[raw] ?? raw;
        })()}
        data-interactive={modifier && armedFor === selectedIds[0] ? "true" : "false"}
        className={`ll:absolute ll:group ll:select-none ${modifier && armedFor === selectedIds[0] ? "ll:pointer-events-auto ll:cursor-grab active:ll:cursor-grabbing" : "ll:pointer-events-none"}`}
        style={{
          left: anchorCanvasX,
          top: anchorCanvasY,
          width: 16 * keep,
          height: 16 * keep,
          transform: `translate(-50%, -50%) scale(${keep})`,
        }}
        onPointerDown={handlePointerDown}
      >
        {/* Outer Ring */}
        <div
          className="ll:absolute ll:inset-0 ll:rounded-full ll:border-2 ll:border-accent ll:bg-surface-canvas/80 ll:shadow-sm group-hover:ll:scale-110 ll:transition-transform"
          style={{ boxSizing: "border-box" }}
        />
        {/* Crosshair Horizontal Line */}
        <div
          className="ll:absolute ll:top-1/2 ll:left-0 ll:w-full ll:h-0.5 ll:bg-accent ll:-translate-y-1/2 ll:pointer-events-none"
        />
        {/* Crosshair Vertical Line */}
        <div
          className="ll:absolute ll:left-1/2 ll:top-0 ll:h-full ll:w-0.5 ll:bg-accent ll:-translate-x-1/2 ll:pointer-events-none"
        />
        {/* Center Pivot Dot */}
        <div
          className="ll:absolute ll:inset-1/2 ll:w-1.5 ll:h-1.5 ll:rounded-full ll:bg-primary ll:-translate-x-1/2 ll:-translate-y-1/2 ll:pointer-events-none"
        />
      </div>
    </div>
  );
};
