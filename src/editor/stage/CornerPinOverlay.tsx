"use client";

/**
 * Corner pin on the canvas: four handles on the corners of a pinned layer, and a grid drawn across the surface it lies on,
 * so you can see how it is laid out and drag each corner onto the corners of a road, a wall or a screen.
 */

import React, { useRef } from "react";
import { documentCommands } from "@/core/store/useDocumentStore";
import { formatPin, isConvex, mapUnit, parsePin, type Quad } from "@/core/geometry/cornerPin";
import { parseMesh } from "@/core/geometry/meshWarp";
import type { Layer } from "@/core/document/schema";
import type { StageElement } from "./types";

const CORNERS = ["top left", "top right", "bottom right", "bottom left"] as const;
const GRID = 4;

interface Props {
  selectedIds: string[];
  elements: Record<string, StageElement>;
  layers?: Record<string, Layer>;
  zoom: number;
}

export const CornerPinOverlay: React.FC<Props> = ({ selectedIds, elements, layers, zoom }) => {
  const drag = useRef<{ index: number; startX: number; startY: number; quad: Quad; tx: ReturnType<typeof documentCommands.begin> } | null>(null);
  const id = selectedIds.length === 1 ? selectedIds[0] : null;
  const layer = id && layers ? layers[id] : undefined;
  const el = id ? elements[id] : undefined;
  const pin = parsePin(layer?.properties["transform.pin"]);
  const mesh = parseMesh(layer?.properties["transform.mesh"]);
  if (!id || !layer || !el || !pin || mesh) return null;
  const ox = el.ox ?? 0;
  const oy = el.oy ?? 0;
  const page = pin.map(([x, y]) => [x + ox, y + oy]) as Quad;
  const size = 14 / zoom;

  const lines: string[] = [];
  for (let i = 0; i <= GRID; i++) {
    const t = i / GRID;
    const across = Array.from({ length: GRID * 4 + 1 }, (_, k) => mapUnit(page, k / (GRID * 4), t));
    const down = Array.from({ length: GRID * 4 + 1 }, (_, k) => mapUnit(page, t, k / (GRID * 4)));
    lines.push(across.map(([x, y]) => `${x},${y}`).join(" "), down.map(([x, y]) => `${x},${y}`).join(" "));
  }

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const next = d.quad.map((p) => [...p]) as Quad;
    next[d.index] = [d.quad[d.index][0] + (e.clientX - d.startX) / zoom, d.quad[d.index][1] + (e.clientY - d.startY) / zoom];
    if (isConvex(next)) documentCommands.updateProps(id, { "transform.pin": formatPin(next) });
  };
  const end = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    d.tx.commit(); // the whole drag is one undo step
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div data-testid="corner-pin-overlay" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 40 }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden="true">
        <polygon points={page.map(([x, y]) => `${x},${y}`).join(" ")} fill="rgba(47,107,255,0.10)" stroke="#2F6BFF" strokeWidth={1.5 / zoom} />
        {lines.map((points, i) => (
          <polyline key={i} points={points} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`} />
        ))}
      </svg>
      {page.map(([x, y], index) => (
        <button
          key={CORNERS[index]}
          type="button"
          aria-label={`Corner pin ${CORNERS[index]}`}
          title="Drag onto a corner of the surface"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { index, startX: e.clientX, startY: e.clientY, quad: pin, tx: documentCommands.begin("Corner pin") };
          }}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, padding: 0, borderRadius: "50%", background: "#fff", border: `${2 / zoom}px solid #2F6BFF`, cursor: "crosshair", pointerEvents: "auto", touchAction: "none" }}
        />
      ))}
    </div>
  );
};
