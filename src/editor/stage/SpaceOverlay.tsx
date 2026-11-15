"use client";

/**
 * 2.5D spaces on the canvas (Phase 127). With a space (or a layer in one) selected:
 * - a cross at the **vanishing point**: drag it to move where the depth runs to;
 * - beside a selected layer in the space, a **depth** handle: drag it up to bring the layer closer, down to push it back;
 * - with **Orbit** on, dragging over the space turns the view around it, a look only (nothing is saved); selecting
 *   something outside the space ends it and the space shows as it is set.
 * Each drag is one undo step.
 */

import React, { useEffect, useRef } from "react";
import { documentCommands, useDocument } from "@/core/store/useDocumentStore";
import { getDocument } from "@/core/store/documentState";
import { isSpace, setDepth, setSpace, spaceOf, vanishingPoint } from "@/core/editing/spaceOps";
import { useSpaceViewStore } from "./spaceViewStore";
import type { StageElement } from "./types";

interface Props {
  selectedIds: string[];
  elements: Record<string, StageElement>;
  zoom: number;
}

type P = { x: number; y: number };

function useDrag(onMove: (dx: number, dy: number, start: { client: P }) => void, label: string) {
  const d = useRef<{ client: P; tx: ReturnType<typeof documentCommands.begin> | null } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      d.current = { client: { x: e.clientX, y: e.clientY }, tx: label ? documentCommands.begin(label) : null };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = d.current;
      if (s) onMove(e.clientX - s.client.x, e.clientY - s.client.y, s);
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = d.current;
      d.current = null;
      s?.tx?.commit();
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    },
  };
}

export const SpaceOverlay: React.FC<Props> = ({ selectedIds, elements, zoom }) => {
  const id = selectedIds.length === 1 ? selectedIds[0] : null;
  const layers = useDocument((d) => d.layers);
  const sel = id ? layers[id] : undefined;
  const spaceId = sel && isSpace(sel) ? id : id ? spaceOf(id) : null;
  const space = spaceId ? layers[spaceId] : undefined;
  const orbiting = useSpaceViewStore((s) => s.orbiting);
  const ox = useSpaceViewStore((s) => s.x);
  const oy = useSpaceViewStore((s) => s.y);
  const turn = useSpaceViewStore((s) => s.turn);
  const stop = useSpaceViewStore((s) => s.stop);
  const startVp = useRef<P>({ x: 50, y: 50 });
  const startZ = useRef(0);
  const startTurn = useRef<P>({ x: 0, y: 0 });

  // editing something outside the orbiting space goes back to the space as it is set
  useEffect(() => {
    if (orbiting && spaceId !== orbiting) stop();
  }, [orbiting, spaceId, stop]);

  // the orbit preview: an extra turn on the drawn space, put back when it ends (or React draws it again)
  useEffect(() => {
    if (!orbiting) return;
    const el = document.querySelector<HTMLElement>(`[data-stage=artboard] [data-archetype][data-element-id="${orbiting}"]`);
    if (!el) return;
    const base = el.style.transform;
    el.style.transform = `${base} rotateX(${-oy}deg) rotateY(${ox}deg)`;
    el.dataset.spaceOrbit = "";
    return () => {
      el.style.transform = base;
      delete el.dataset.spaceOrbit;
    };
  });

  const vpDrag = useDrag((dx, dy) => {
    const el = spaceId ? elements[spaceId] : undefined;
    if (!spaceId || !el || el.width <= 0 || el.height <= 0) return;
    setSpace(spaceId, { vanishX: startVp.current.x + (dx / zoom / el.width) * 100, vanishY: startVp.current.y + (dy / zoom / el.height) * 100 });
  }, "Move vanishing point");
  const depthDrag = useDrag((_dx, dy) => {
    if (id && spaceOf(id)) setDepth([id], { z: Math.round(startZ.current - (dy / zoom) * 2) });
  }, "Change depth");
  const orbitDrag = useDrag((dx, dy) => turn(startTurn.current.x + dx / 3, startTurn.current.y + dy / 3), "");

  const el = spaceId ? elements[spaceId] : undefined;
  if (!spaceId || !space || !el) return null;
  const vp = vanishingPoint(space);
  const vx = el.x + (vp.x / 100) * el.width;
  const vy = el.y + (vp.y / 100) * el.height;
  const s = 14 / zoom;
  const child = id && id !== spaceId ? elements[id] : undefined;
  return (
    <div data-testid="space-overlay" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 40 }}>
      {orbiting === spaceId && (
        <div
          aria-label="Orbit around the space"
          data-space-orbit-area=""
          data-stage-chrome=""
          {...orbitDrag}
          onPointerDown={(e) => {
            startTurn.current = { x: ox, y: oy };
            orbitDrag.onPointerDown(e);
          }}
          style={{ position: "absolute", left: el.x, top: el.y, width: el.width, height: el.height, pointerEvents: "auto", cursor: "grab", outline: `${1 / zoom}px dashed #2F6BFF` }}
        />
      )}
      <button
        type="button"
        aria-label="Vanishing point"
        data-space-vanish=""
        data-stage-chrome=""
        title="Drag to move the vanishing point"
        {...vpDrag}
        onPointerDown={(e) => {
          startVp.current = vanishingPoint(getDocument().layers[spaceId]!);
          vpDrag.onPointerDown(e);
        }}
        style={{ position: "absolute", left: vx - s / 2, top: vy - s / 2, width: s, height: s, padding: 0, border: 0, background: "transparent", pointerEvents: "auto", cursor: "move" }}
      >
        <svg width="100%" height="100%" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="#2F6BFF" strokeWidth="1.5" />
          <path d="M7 0v14M0 7h14" stroke="#2F6BFF" strokeWidth="1.5" />
        </svg>
      </button>
      {child && (
        <button
          type="button"
          aria-label="Depth"
          data-space-depth=""
          data-stage-chrome=""
          title="Drag up to bring it closer, down to push it back"
          {...depthDrag}
          onPointerDown={(e) => {
            startZ.current = Number(getDocument().layers[id!]?.properties["transform.translateZ"] ?? 0) || 0;
            depthDrag.onPointerDown(e);
          }}
          style={{ position: "absolute", left: child.x + child.width + 8 / zoom, top: child.y + child.height / 2 - (24 / zoom) / 2, width: 8 / zoom, height: 24 / zoom, padding: 0, borderRadius: 4 / zoom, border: `${1.5 / zoom}px solid #ffffff`, background: "#2F6BFF", pointerEvents: "auto", cursor: "ns-resize" }}
        />
      )}
    </div>
  );
};
