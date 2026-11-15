"use client";

/**
 * Mesh gradient points on the canvas (Phase 115): while a mesh fill is being edited (its popover's "Edit points on
 * canvas"), each colour point is a handle. Drag one to move the colour; click one to pick it, and its colour shows in
 * the fill's popover. The whole drag is one undo step. The grid between the points is drawn so you can see the cells.
 */

import React, { useRef } from "react";
import { documentCommands, useDocument } from "@/core/store/useDocumentStore";
import { fillsOf, setFills } from "@/core/paint/paintOps";
import { updatePaint } from "@/core/paint/paintEdits";
import type { MeshPaint } from "@/core/paint/paints";
import { useMeshEditStore } from "./meshEditStore";
import type { StageElement } from "./types";

interface Props {
  selectedIds: string[];
  elements: Record<string, StageElement>;
  zoom: number;
}

export const MeshOverlay: React.FC<Props> = ({ selectedIds, elements, zoom }) => {
  const layerId = useMeshEditStore((s) => s.layerId);
  const fillIndex = useMeshEditStore((s) => s.fill);
  const picked = useMeshEditStore((s) => s.point);
  const pick = useMeshEditStore((s) => s.pick);
  useDocument((d) => (layerId ? d.layers[layerId] : null)); // redraw when the layer changes
  const drag = useRef<{ index: number; startX: number; startY: number; mesh: MeshPaint; tx: ReturnType<typeof documentCommands.begin> } | null>(null);
  const el = layerId ? elements[layerId] : undefined;
  if (!layerId || !el || !selectedIds.includes(layerId)) return null;
  const paint = fillsOf(layerId)[fillIndex];
  if (!paint || paint.type !== "mesh") return null;
  const at = (i: number) => ({ x: el.x + paint.points[i].x * el.width, y: el.y + paint.points[i].y * el.height });
  const size = 12 / zoom;
  const lines: string[] = [];
  for (let r = 0; r < paint.rows; r++) lines.push(Array.from({ length: paint.cols }, (_, c) => at(r * paint.cols + c)).map((p) => `${p.x},${p.y}`).join(" "));
  for (let c = 0; c < paint.cols; c++) lines.push(Array.from({ length: paint.rows }, (_, r) => at(r * paint.cols + c)).map((p) => `${p.x},${p.y}`).join(" "));

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / zoom / el.width;
    const dy = (e.clientY - d.startY) / zoom / el.height;
    const points = d.mesh.points.map((p, i) => (i === d.index ? { ...p, x: Math.min(2, Math.max(-1, p.x + dx)), y: Math.min(2, Math.max(-1, p.y + dy)) } : p));
    setFills([layerId], updatePaint(fillsOf(layerId), fillIndex, (p) => (p.type === "mesh" ? { ...p, points } : p)));
  };
  const end = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    d.tx.commit();
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div data-testid="mesh-overlay" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 40 }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden="true">
        {lines.map((points, i) => (
          <polyline key={i} points={points} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={1 / zoom} strokeDasharray={`${3 / zoom} ${3 / zoom}`} />
        ))}
      </svg>
      {paint.points.map((p, index) => {
        const q = at(index);
        return (
          <button
            key={index}
            type="button"
            aria-label={`Mesh point ${index + 1}`}
            aria-pressed={picked === index}
            title="Drag to move this colour; click to pick it"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              pick(index);
              drag.current = { index, startX: e.clientX, startY: e.clientY, mesh: paint, tx: documentCommands.begin("Move mesh point") };
            }}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            style={{
              position: "absolute",
              left: q.x - size / 2,
              top: q.y - size / 2,
              width: size,
              height: size,
              borderRadius: "50%",
              background: p.color,
              border: `${(picked === index ? 2.5 : 1.5) / zoom}px solid ${picked === index ? "#2F6BFF" : "#ffffff"}`,
              boxShadow: `0 0 0 ${1 / zoom}px rgba(0,0,0,0.35)`,
              pointerEvents: "auto",
              cursor: "move",
              padding: 0,
            }}
          />
        );
      })}
    </div>
  );
};
