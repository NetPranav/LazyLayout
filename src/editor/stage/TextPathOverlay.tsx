"use client";

/**
 * Text on a path, on the canvas (Phase 124): while one text on a path is selected, a handle sits where the text starts
 * along its path. Drag it along the path to move the text (one undo step); the path is drawn faintly so you can see
 * where it runs.
 */

import React, { useMemo, useRef } from "react";
import { documentCommands, useDocument } from "@/core/store/useDocumentStore";
import { pathDataToBez } from "@/core/paths/bezBridge";
import { polylines } from "@/core/geometry/measure";
import { parseTextPath, textPathD } from "@/core/text/textFeatures";
import { setTextPath } from "@/core/text/textOps";
import { nearestOn } from "./WidthOverlay";
import type { StageElement } from "./types";

interface Props {
  selectedIds: string[];
  elements: Record<string, StageElement>;
  zoom: number;
  editingText: string | null;
}

type P = { x: number; y: number };

export const TextPathOverlay: React.FC<Props> = ({ selectedIds, elements, zoom, editingText }) => {
  const id = selectedIds.length === 1 ? selectedIds[0] : null;
  const layer = useDocument((d) => (id ? d.layers[id] : undefined));
  const path = layer?.archetype === "text" ? parseTextPath(layer.properties["typography.textPath"]) : null;
  const line = useMemo(() => {
    const bez = path ? pathDataToBez(textPathD(path)) : null;
    return bez ? polylines(bez)?.find((l) => l.length() > 1e-6) ?? null : null;
  }, [path]);
  const el = id ? elements[id] : undefined;
  if (!id || !layer || !path || !line || !el || editingText === id) return null;
  const own = layer.properties["typography.textPathStart"];
  const start = typeof own === "number" && Number.isFinite(own) ? Math.min(1, Math.max(0, own / 100)) : path.start;
  const at = line.at(start);
  if (!at) return null;
  const q = { x: el.x + at.point.x, y: el.y + at.point.y };
  const d = Array.from({ length: 97 }, (_, i) => line.at(i / 96)!).map((a, i) => `${i ? "L" : "M"}${el.x + a.point.x} ${el.y + a.point.y}`).join(" ");
  return (
    <div data-testid="text-path-overlay" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 40 }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden="true">
        <path d={d} fill="none" stroke="#2F6BFF" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} opacity={0.7} />
      </svg>
      <StartHandle at={q} zoom={zoom} onDrag={(to) => setTextPath([id], { start: nearestOn(line, { x: to.x - el.x, y: to.y - el.y }).t })} />
    </div>
  );
};

function StartHandle({ at, zoom, onDrag }: { at: P; zoom: number; onDrag: (to: P) => void }) {
  const drag = useRef<{ start: P; client: P; tx: ReturnType<typeof documentCommands.begin> } | null>(null);
  const end = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    d.tx.commit();
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };
  const size = 12 / zoom;
  return (
    <button
      type="button"
      aria-label="Text start on path"
      data-text-path-handle=""
      title="Drag along the path to move the text"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { start: at, client: { x: e.clientX, y: e.clientY }, tx: documentCommands.begin("Move text along path") };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) onDrag({ x: d.start.x + (e.clientX - d.client.x) / zoom, y: d.start.y + (e.clientY - d.client.y) / zoom });
      }}
      onPointerUp={end}
      onPointerCancel={end}
      style={{
        position: "absolute",
        left: at.x - size / 2,
        top: at.y - size / 2,
        width: size,
        height: size,
        transform: "rotate(45deg)",
        background: "#2F6BFF",
        border: `${1.5 / zoom}px solid #ffffff`,
        pointerEvents: "auto",
        cursor: "grab",
        padding: 0,
      }}
    />
  );
}
