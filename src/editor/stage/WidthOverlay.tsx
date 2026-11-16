"use client";

/**
 * Stroke width handles on the canvas (Phase 119): while a stroke's width is being edited (the stroke popover's "On
 * canvas"), each width point shows as a pair of handles, one on each side of the path, as far out as the stroke is
 * wide there. Drag a handle to make the stroke wider or narrower there and to slide the point along the path; with
 * Alt, only that side changes. Click the path to add a point; double-click a handle to remove its point. Each drag is
 * one undo step.
 */

import React, { useMemo, useRef } from "react";
import { documentCommands, useDocument } from "@/core/store/useDocumentStore";
import { layerSpine } from "@/core/editing/layerOutline";
import { polylines, type Polyline } from "@/core/geometry/measure";
import { insertWidthPointHere, parseWidthProfile, pointSides, setWidthPoint, setWidthSide, widthPoint, type WidthPoint } from "@/core/paths/strokes";
import { setStrokeSettings } from "@/core/paint/paintOps";
import { useWidthEditStore } from "./widthEditStore";
import type { StageElement } from "./types";

interface Props {
  selectedIds: string[];
  elements: Record<string, StageElement>;
  zoom: number;
}

type P = { x: number; y: number };

/** The t (0..1) of the point on `line` nearest to `p`, and how far `p` is from it. */
export function nearestOn(line: Polyline, p: P): { t: number; dist: number } {
  let best = { t: 0, dist: Infinity };
  const n = 256;
  for (let i = 0; i <= n; i++) {
    const a = line.at(i / n);
    if (!a) continue;
    const d = Math.hypot(a.point.x - p.x, a.point.y - p.y);
    if (d < best.dist) best = { t: i / n, dist: d };
  }
  // refine between the neighbouring samples
  let lo = Math.max(0, best.t - 1 / n);
  let hi = Math.min(1, best.t + 1 / n);
  for (let k = 0; k < 24; k++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    const d = (t: number) => {
      const a = line.at(t);
      return a ? Math.hypot(a.point.x - p.x, a.point.y - p.y) : Infinity;
    };
    if (d(m1) < d(m2)) hi = m2;
    else lo = m1;
  }
  const t = (lo + hi) / 2;
  const a = line.at(t);
  return { t, dist: a ? Math.hypot(a.point.x - p.x, a.point.y - p.y) : best.dist };
}

export const WidthOverlay: React.FC<Props> = ({ selectedIds, elements, zoom }) => {
  const layerId = useWidthEditStore((s) => s.layerId);
  const layer = useDocument((d) => (layerId ? d.layers[layerId] : undefined));
  const all = useDocument((d) => d.layers);
  const line = useMemo(() => {
    if (!layer) return null;
    const spine = layerSpine(layer, all);
    return spine ? polylines(spine)?.find((l) => l.length() > 1e-6) ?? null : null;
  }, [layer, all]);
  const el = layerId ? elements[layerId] : undefined;
  if (!layerId || !layer || !el || !line || !selectedIds.includes(layerId)) return null;
  const weight = Math.max(0.5, Number(layer.properties["svg.strokeWidth"] ?? 1) || 1);
  const profile = parseWidthProfile(layer.properties["stroke.widthProfile"]) ?? [widthPoint(0, 1), widthPoint(1, 1)];
  const toStage = (p: P): P => ({ x: el.x + p.x, y: el.y + p.y });
  const write = (pts: WidthPoint[] | null) => pts && setStrokeSettings([layerId], { widthProfile: pts });
  const handle = (i: number, side: "left" | "right") => {
    const p = profile[i];
    const at = line.at(p.t)!;
    const [l, r] = pointSides(p);
    // the right side is along the normal, the left against it (as the outliner draws)
    const off = side === "right" ? (0.5 * weight * r) : -(0.5 * weight * l);
    return toStage({ x: at.point.x + at.normal.x * off, y: at.point.y + at.normal.y * off });
  };
  const size = 10 / zoom;
  const spineD = Array.from({ length: 129 }, (_, i) => line.at(i / 128)!).map((a, i) => `${i ? "L" : "M"}${toStage(a.point).x} ${toStage(a.point).y}`).join(" ");

  /** Drag point `index` of `pts` so its `side` handle sits at stage point `to` (Alt: that side only). */
  const dragTo = (pts: WidthPoint[], index: number, side: "left" | "right", to: P, alt: boolean) => {
    const near = nearestOn(line, { x: to.x - el.x, y: to.y - el.y });
    const scale = (2 * near.dist) / weight;
    const moved = setWidthPoint(pts, index, near.t);
    write(moved ? (alt ? setWidthSide(moved, index, side, scale) : setWidthPoint(moved, index, undefined, scale)) : null);
  };

  return (
    <div data-testid="width-overlay" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 40 }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path
          d={spineD}
          fill="none"
          stroke="transparent"
          strokeWidth={8 / zoom}
          data-width-spine=""
          aria-label="Add a width point"
          role="button"
          style={{ pointerEvents: "stroke", cursor: "copy" }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            const svg = (e.currentTarget.ownerSVGElement ?? e.currentTarget) as SVGGraphicsElement;
            const box = svg.getBoundingClientRect();
            const p = { x: (e.clientX - box.left) / zoom - el.x, y: (e.clientY - box.top) / zoom - el.y };
            write(insertWidthPointHere(profile, nearestOn(line, p).t).points);
          }}
        />
        <path d={spineD} fill="none" stroke="#2F6BFF" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} pointerEvents="none" />
        {profile.map((_, i) => {
          const a = handle(i, "left");
          const b = handle(i, "right");
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2F6BFF" strokeWidth={1 / zoom} pointerEvents="none" />;
        })}
      </svg>
      {profile.flatMap((_, i) =>
        (["left", "right"] as const).map((side) => (
          <WidthHandle
            key={`${i}-${side}`}
            index={i}
            side={side}
            at={handle(i, side)}
            size={size}
            zoom={zoom}
            profile={profile}
            onDrag={(pts, to, alt) => dragTo(pts, i, side, to, alt)}
            onRemove={() => profile.length > 2 && write(profile.filter((__, j) => j !== i))}
          />
        )),
      )}
    </div>
  );
};

function WidthHandle({ index, side, at: q, size, zoom, profile, onDrag, onRemove }: { index: number; side: "left" | "right"; at: P; size: number; zoom: number; profile: WidthPoint[]; onDrag: (pts: WidthPoint[], to: P, alt: boolean) => void; onRemove: () => void }) {
  const drag = useRef<{ start: P; client: P; pts: WidthPoint[]; tx: ReturnType<typeof documentCommands.begin> } | null>(null);
  const end = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    d.tx.commit();
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };
  return (
    <button
      type="button"
      aria-label={`Width point ${index + 1}, ${side} side`}
      data-width-handle={`${index}-${side}`}
      title="Drag to change the width here (Alt: this side only); double-click to remove"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { start: q, client: { x: e.clientX, y: e.clientY }, pts: profile, tx: documentCommands.begin("Change stroke width") };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) onDrag(d.pts, { x: d.start.x + (e.clientX - d.client.x) / zoom, y: d.start.y + (e.clientY - d.client.y) / zoom }, e.altKey);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      style={{
        position: "absolute",
        left: q.x - size / 2,
        top: q.y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#ffffff",
        border: `${1.5 / zoom}px solid #2F6BFF`,
        pointerEvents: "auto",
        cursor: "grab",
        padding: 0,
      }}
    />
  );
}
