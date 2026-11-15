"use client";

/**
 * A variable font's axes on the canvas (Phase 125): while switched on for the selected text, a small bar above it has a
 * slider per axis (weight, then the font's own). Dragging one shows the change on the text as it goes; letting go is
 * one undo step.
 */

import React, { useRef } from "react";
import { documentCommands, useDocument } from "@/core/store/useDocumentStore";
import { getDocument } from "@/core/store/documentState";
import { setLayerProps } from "@/core/editing/editOps";
import { Slider } from "@/editor/components/Slider";
import { axisPatch, axisSliders, axisValue } from "@/editor/panels/details/options/typeAxes";
import { useAxesEditStore } from "./axesEditStore";
import type { StageElement } from "./types";

interface Props {
  selectedIds: string[];
  elements: Record<string, StageElement>;
  zoom: number;
}

export const AxesOverlay: React.FC<Props> = ({ selectedIds, elements, zoom }) => {
  const layerId = useAxesEditStore((s) => s.layerId);
  const layer = useDocument((d) => (layerId ? d.layers[layerId] : undefined));
  const tx = useRef<ReturnType<typeof documentCommands.begin> | null>(null);
  const el = layerId ? elements[layerId] : undefined;
  if (!layerId || !layer || layer.archetype !== "text" || !el || !selectedIds.includes(layerId)) return null;
  const family = typeof layer.properties["typography.fontFamily"] === "string" ? String(layer.properties["typography.fontFamily"]).split(",")[0].replace(/["']/g, "").trim() : null;
  const axes = axisSliders(family);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 45 }}>
      <div
        role="toolbar"
        aria-label="Font axes"
        data-stage-chrome=""
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="ll:flex ll:flex-col ll:gap-1 ll:p-2 ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:text-micro ll:text-secondary"
        style={{ position: "absolute", left: el.x, top: el.y, transform: `translateY(calc(-100% - ${8 / zoom}px)) scale(${1 / zoom})`, transformOrigin: "0 100%", width: 240, pointerEvents: "auto" }}
      >
        {axes.map((a) => (
          <label key={a.tag} className="ll:flex ll:items-center ll:gap-2">
            <span className="ll:w-14 ll:shrink-0">{a.name}</span>
            <Slider
              ariaLabel={`Canvas font axis ${a.name}`}
              min={a.min}
              max={a.max}
              step={a.tag === "wght" ? 1 : 0.5}
              value={axisValue(layer.properties, a)}
              onChange={(v) => {
                tx.current ??= documentCommands.begin(`Font ${a.name.toLowerCase()}`);
                setLayerProps([layerId], axisPatch(getDocument().layers[layerId].properties, a, v), `Font ${a.name.toLowerCase()}`);
              }}
              onCommit={(v) => {
                setLayerProps([layerId], axisPatch(getDocument().layers[layerId].properties, a, v), `Font ${a.name.toLowerCase()}`);
                tx.current?.commit();
                tx.current = null;
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
};
