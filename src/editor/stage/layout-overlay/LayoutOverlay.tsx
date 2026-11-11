"use client";

import React, { useRef, useState } from "react";
import type { Layer } from "@/core/document/schema";
import type { PropValue } from "@/core/document/registry";
import { isGrid, readStack, setGrid } from "@/core/editing/layoutOps";
import { useStackDropStore } from "@/core/store/useStackDropStore";
import type { StageElement } from "../types";
import { usePresence } from "./usePresence";
import { useValueDrag, type ValueDrag } from "./useValueDrag";
import { MIN_TRACK, resizeTrack, templateOf, trackSet, type Axis, type TrackSet } from "./gridTracks";

interface LayoutOverlayProps {
  selectedIds: string[];
  elements: Record<string, StageElement>;
  layers?: Record<string, Layer>;
  zoom?: number;
  /** A stage gesture (move, resize) is running: the bands step aside. */
  isGesturing?: boolean;
}

type Side = "top" | "right" | "bottom" | "left";
const SIDES: readonly Side[] = ["top", "right", "bottom", "left"];
const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const INK = "var(--ll-pen-mark)";
const SHADE = `color-mix(in srgb, ${INK} 13%, transparent)`;
const SHADE_ON = `color-mix(in srgb, ${INK} 26%, transparent)`;
const LINE = `color-mix(in srgb, ${INK} 50%, transparent)`;
const GRAB = 8; // px on screen: how thick the grab zone of a band's edge is
const KEEP_OUT = 10; // px on screen kept free at the ends of an edge for the resize handles

/** Draw order: shading first, then the gap zones, then the padding zones (a band's edge beats the strip beside it), then the track handles. */
const layered = (parts: React.ReactNode[]): React.ReactNode[] => {
  const rank = (n: React.ReactNode) => {
    const key = React.isValidElement(n) ? String(n.key) : "";
    if (key.startsWith("zone-pad")) return 2;
    if (key.startsWith("zone-")) return 1;
    if (key.startsWith("handle-") || key.startsWith("add-")) return 3;
    if (key.startsWith("chip-")) return 4;
    return 0;
  };
  return parts.filter(Boolean).sort((a, c) => rank(a) - rank(c));
};

/**
 * Padding and gap of the selected stack or grid frame, drawn on the canvas: shaded bands inside its edges, shaded strips between
 * its children, and for a grid the tracks. Only the edge of a band, a gap strip or a track handle takes the pointer; the middle of
 * every layer (and of the frame) stays the layer's own, so clicking selects and dragging moves.
 */
export const LayoutOverlay: React.FC<LayoutOverlayProps> = ({ selectedIds, elements, layers, zoom = 1, isGesturing = false }) => {
  const inv = zoom > 0 ? 1 / zoom : 1;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const { live, start } = useValueDrag(zoom);

  const id = selectedIds.length === 1 ? selectedIds[0] : null;
  const layer = id && layers ? layers[id] : undefined;
  const frame = id ? elements[id] : undefined;
  const grid = isGrid(layer);
  const active = !!layer && !!frame && !frame.mirrorId && !frame.rotation && (grid || layer.properties["layout.auto"] === true);
  usePresence(rootRef, active && !isGesturing);
  if (!active || !layer || !frame || !id) return <div ref={rootRef} aria-hidden="true" style={{ visibility: "hidden" }} />;

  const spec = readStack(layer);
  const pad = spec.padding;
  const num = (k: string, d = 0) => (typeof layer.properties[k] === "number" ? (layer.properties[k] as number) : d);
  const colGap = num("layout.columnGap");
  const rowGap = num("layout.rowGap");
  const px = (n: number) => n * inv;
  const flowKids = layer.children
    .filter((cid) => layers?.[cid]?.visible !== false && layers?.[cid]?.properties.positioning !== "absolute" && elements[cid])
    .map((cid) => elements[cid]);
  const rel = flowKids.map((k) => ({ x: k.x - frame.x, y: k.y - frame.y, w: k.width, h: k.height }));

  const label = (key: string) => (live?.key === key ? live.value : null);
  const on = (key: string) => hover === key || live?.key === key;

  /** A small mono value tag, kept the same size on screen at any zoom. */
  const chip = (key: string, x: number, y: number, value: number, force = false) => {
    const shown = force || on(key) || value > 0;
    if (!shown) return null;
    const dragging = live?.key === key;
    return (
      <div
        key={`chip-${key}`}
        data-testid="layout-chip"
        className="ll:absolute ll:pointer-events-none ll:select-none ll:whitespace-nowrap"
        style={{
          left: x,
          top: y,
          transform: `translate(-50%, -50%) scale(${inv})`,
          font: "500 10px/14px var(--ll-font-mono)",
          padding: "0 4px",
          borderRadius: "var(--ll-radius-sm)",
          border: "1px solid var(--ll-border)",
          backgroundColor: dragging ? "var(--ll-control-primary-bg)" : "var(--ll-surface-panel)",
          color: dragging ? "var(--ll-control-primary-fg)" : "var(--ll-text-primary)",
        }}
      >
        {Math.round(value)}
      </div>
    );
  };

  const band = (key: string, r: { x: number; y: number; w: number; h: number }) => (
    <div
      key={`band-${key}`}
      data-testid="layout-band"
      data-band={key}
      className="ll:absolute ll:pointer-events-none"
      style={{ left: r.x, top: r.y, width: r.w, height: r.h, backgroundColor: on(key) ? SHADE_ON : SHADE }}
    />
  );

  /** The part of a band that takes the pointer: a thin zone, so a layer's middle is never covered. */
  const zone = (key: string, r: { x: number; y: number; w: number; h: number }, cursor: string, drag: ValueDrag, title: string) => (
    <div
      key={`zone-${key}`}
      data-testid="layout-handle"
      data-layout-grab=""
      data-handle={key}
      title={title}
      className="ll:absolute ll:pointer-events-auto"
      style={{ left: r.x, top: r.y, width: r.w, height: r.h, cursor, touchAction: "none" }}
      onPointerEnter={() => setHover(key)}
      onPointerLeave={() => setHover((h) => (h === key ? null : h))}
      onPointerDown={(e) => start(e, key, drag)}
      onClick={(e) => e.stopPropagation()}
    />
  );

  const parts: React.ReactNode[] = [];

  // Padding: a band along each inner edge; its inner edge is the grab zone. Shift: all four sides, Alt: this side alone, otherwise the opposite pair.
  const padWrite = (side: Side) => (v: number, m: { shift: boolean; alt: boolean }) => {
    const sides = m.shift ? SIDES : m.alt ? [side] : [side, OPPOSITE[side]];
    const out: Record<string, PropValue> = {};
    for (const s of sides) out[`layout.padding${cap(s)}`] = v;
    return out;
  };
  const g = px(GRAB);
  const keep = px(KEEP_OUT);
  for (const side of SIDES) {
    const p = pad[side];
    const shown = label(`pad-${side}`) ?? p;
    const horizontal = side === "top" || side === "bottom";
    const r = horizontal
      ? { x: frame.x, y: side === "top" ? frame.y : frame.y + frame.height - p, w: frame.width, h: p }
      : { x: side === "left" ? frame.x : frame.x + frame.width - p, y: frame.y, w: p, h: frame.height };
    const edge = side === "top" ? frame.y + p : side === "bottom" ? frame.y + frame.height - p : side === "left" ? frame.x + p : frame.x + frame.width - p;
    const z = horizontal
      ? { x: frame.x + keep, y: edge - g / 2, w: Math.max(0, frame.width - keep * 2), h: g }
      : { x: edge - g / 2, y: frame.y + keep, w: g, h: Math.max(0, frame.height - keep * 2) };
    const key = `pad-${side}`;
    parts.push(band(key, r));
    parts.push(
      zone(key, z, horizontal ? "row-resize" : "col-resize", {
        id,
        label: "Change padding",
        axis: horizontal ? "y" : "x",
        sign: side === "top" || side === "left" ? 1 : -1,
        base: p,
        scale: true,
        write: padWrite(side),
      }, `Padding ${side} (Shift: all sides, Alt: this side only)`),
    );
    // off the middle of the edge, where the resize handle of the selection sits
    parts.push(chip(key, horizontal ? frame.x + frame.width * 0.25 : r.x + r.w / 2, horizontal ? r.y + r.h / 2 : frame.y + frame.height * 0.25, shown));
  }

  const innerX = frame.x + pad.left;
  const innerY = frame.y + pad.top;
  const innerW = Math.max(0, frame.width - pad.left - pad.right);
  const innerH = Math.max(0, frame.height - pad.top - pad.bottom);

  if (!grid) {
    // Gap: a strip between each two neighbouring children (a stack that wraps has no single gap, one that spaces its items itself has no gap to drag).
    const row = spec.direction === "row";
    const spaced = spec.justify === "space-between" || spec.justify === "space-around" || spec.justify === "space-evenly";
    if (!spec.wrap) {
      for (let i = 0; i < flowKids.length - 1; i++) {
        const a = flowKids[i];
        const b = flowKids[i + 1];
        const size = row ? b.x - (a.x + a.width) : b.y - (a.y + a.height);
        if (size < 0.5) continue;
        const key = `gap-${i}`;
        const r = row ? { x: a.x + a.width, y: innerY, w: size, h: innerH } : { x: innerX, y: a.y + a.height, w: innerW, h: size };
        parts.push(band(key, r));
        if (!spaced) {
          const zr = row ? { x: r.x + r.w / 2 - Math.max(r.w, g) / 2, y: r.y, w: Math.max(r.w, g), h: r.h } : { x: r.x, y: r.y + r.h / 2 - Math.max(r.h, g) / 2, w: r.w, h: Math.max(r.h, g) };
          parts.push(
            zone(key, zr, row ? "col-resize" : "row-resize", {
              id,
              label: "Change gap",
              axis: row ? "x" : "y",
              sign: 1,
              base: spec.gap,
              scale: true,
              write: (v) => ({ "layout.gap": v }),
            }, "Gap"),
          );
        }
        parts.push(chip(key, r.x + r.w / 2, r.y + r.h / 2, label(key) ?? size));
      }
    }
  } else {
    const count = (k: string, d: number) => num(k, d);
    const cols = trackSet(layer.properties["layout.gridTemplateColumns"] as string | undefined, count("layout.gridColumns", 2), "col", frame.width, colGap, pad.left, pad.right, rel);
    const rows = trackSet(layer.properties["layout.gridTemplateRows"] as string | undefined, count("layout.gridRows", 2), "row", frame.height, rowGap, pad.top, pad.bottom, rel);

    const sets: { axis: Axis; set: TrackSet; gap: number }[] = [
      { axis: "col", set: cols, gap: colGap },
      { axis: "row", set: rows, gap: rowGap },
    ];
    for (const { axis, set, gap } of sets) {
      const isCol = axis === "col";
      const gapProp = isCol ? "layout.columnGap" : "layout.rowGap";
      set.spans.forEach((s, i) => {
        // faint dashed track lines at the start of each track and the end of the last
        const lineAt = (at: number, k: string) =>
          parts.push(
            <div
              key={`line-${axis}-${k}`}
              data-testid="layout-track-line"
              className="ll:absolute ll:pointer-events-none"
              style={{
                left: isCol ? frame.x + at : innerX,
                top: isCol ? innerY : frame.y + at,
                width: isCol ? 0 : innerW,
                height: isCol ? innerH : 0,
                borderLeft: isCol ? `${px(1)}px dashed ${LINE}` : undefined,
                borderTop: isCol ? undefined : `${px(1)}px dashed ${LINE}`,
              }}
            />,
          );
        lineAt(s.pos, `${i}s`);
        if (i === set.spans.length - 1) lineAt(s.pos + s.len, "end");

        // the gap strip after this track
        const next = set.spans[i + 1];
        if (next && next.pos - (s.pos + s.len) >= 0.5) {
          const key = `${axis}gap-${i}`;
          const r = isCol
            ? { x: frame.x + s.pos + s.len, y: innerY, w: next.pos - (s.pos + s.len), h: innerH }
            : { x: innerX, y: frame.y + s.pos + s.len, w: innerW, h: next.pos - (s.pos + s.len) };
          parts.push(band(key, r));
          const zr = isCol ? { x: r.x + r.w / 2 - Math.max(r.w, g) / 2, y: r.y, w: Math.max(r.w, g), h: r.h } : { x: r.x, y: r.y + r.h / 2 - Math.max(r.h, g) / 2, w: r.w, h: Math.max(r.h, g) };
          parts.push(
            zone(key, zr, isCol ? "col-resize" : "row-resize", {
              id,
              label: "Change gap",
              axis: isCol ? "x" : "y",
              sign: 1,
              base: gap,
              scale: true,
              write: (v, m) => (m.shift ? { "layout.columnGap": v, "layout.rowGap": v } : { [gapProp]: v }),
            }, isCol ? "Column gap (Shift: both)" : "Row gap (Shift: both)"),
          );
          parts.push(chip(key, r.x + r.w / 2, r.y + r.h / 2, label(key) ?? gap));
        }

        // the track's resize handle: a small square outside the frame, level with the track's far edge
        const key = `track-${axis}-${i}`;
        const edge = s.pos + s.len;
        const size = px(8);
        const hr = isCol ? { x: frame.x + edge - size / 2, y: frame.y - px(18), w: size, h: size } : { x: frame.x - px(18), y: frame.y + edge - size / 2, w: size, h: size };
        const tracksKey = isCol ? "layout.gridTemplateColumns" : "layout.gridTemplateRows";
        parts.push(
          <div
            key={`stub-${key}`}
            className="ll:absolute ll:pointer-events-none"
            style={{ left: isCol ? frame.x + edge : hr.x + size, top: isCol ? hr.y + size : frame.y + edge, width: isCol ? 0 : px(10), height: isCol ? px(10) : 0, borderLeft: isCol ? `${px(1)}px solid ${LINE}` : undefined, borderTop: isCol ? undefined : `${px(1)}px solid ${LINE}` }}
          />,
        );
        parts.push(
          <div
            key={`handle-${key}`}
            data-testid="layout-track-handle"
            data-layout-grab=""
            data-handle={key}
            title={isCol ? "Column width" : "Row height"}
            className="ll:absolute ll:pointer-events-auto"
            style={{
              left: hr.x,
              top: hr.y,
              width: hr.w,
              height: hr.h,
              boxSizing: "border-box",
              backgroundColor: on(key) ? "var(--ll-control-primary-bg)" : "var(--ll-surface-panel)",
              border: `${px(1)}px solid ${INK}`,
              cursor: isCol ? "col-resize" : "row-resize",
              touchAction: "none",
            }}
            onPointerEnter={() => setHover(key)}
            onPointerLeave={() => setHover((h) => (h === key ? null : h))}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) =>
              start(e, key, {
                id,
                label: isCol ? "Resize column" : "Resize row",
                axis: isCol ? "x" : "y",
                sign: 1,
                base: s.len,
                scale: false,
                min: MIN_TRACK,
                write: (v) => ({ [tracksKey]: templateOf(resizeTrack(set, i, v)) }),
              })
            }
          />,
        );
        if (live?.key === key) parts.push(chip(key, isCol ? frame.x + edge : frame.x - px(30), isCol ? frame.y - px(34) : frame.y + edge, live.value, true));
      });

      // add a track: a plus beyond the last handle
      const key = `add-${axis}`;
      const last = set.spans[set.spans.length - 1];
      const size = px(14);
      const at = last ? last.pos + last.len : 0;
      const pos = isCol ? { x: frame.x + at + px(10), y: frame.y - px(21) } : { x: frame.x - px(21), y: frame.y + at + px(10) };
      parts.push(
        <button
          key={key}
          type="button"
          data-testid="layout-add-track"
          data-axis={axis}
          aria-label={isCol ? "Add column" : "Add row"}
          title={isCol ? "Add column" : "Add row"}
          className="ll:absolute ll:pointer-events-auto ll:grid ll:place-items-center ll:cursor-pointer ll:p-0"
          style={{
            left: pos.x,
            top: pos.y,
            width: size,
            height: size,
            boxSizing: "border-box",
            border: `${px(1)}px solid ${INK}`,
            borderRadius: "var(--ll-radius-sm)",
            backgroundColor: on(key) ? "var(--ll-control-primary-bg)" : "var(--ll-surface-panel)",
            color: on(key) ? "var(--ll-control-primary-fg)" : INK,
          }}
          onPointerEnter={() => setHover(key)}
          onPointerLeave={() => setHover((h) => (h === key ? null : h))}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (isCol) setGrid([id], { columns: set.tracks.length + 1, columnsTemplate: `${templateOf(set.tracks)} 1fr` });
            else {
              const written = layer.properties["layout.gridTemplateRows"];
              const base = !set.measured && typeof written === "string" && written.trim() ? written.trim() : set.measured ? templateOf(set.tracks) : `repeat(${set.tracks.length}, auto)`;
              setGrid([id], { rows: set.tracks.length + 1, rowsTemplate: `${base} auto` });
            }
          }}
        >
          <svg width={size * 0.55 * zoom} height={size * 0.55 * zoom} viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true" style={{ transform: `scale(${inv})`, transformOrigin: "center" }}>
            <path d="M4 0.5v7M0.5 4h7" />
          </svg>
        </button>,
      );
    }
  }

  return (
    <div
      ref={rootRef}
      data-testid="layout-overlay"
      data-layout={grid ? "grid" : "stack"}
      className="ll-layout-overlay ll:absolute ll:inset-0 ll:pointer-events-none ll:overflow-visible"
      style={{ opacity: 0, visibility: "hidden", transformOrigin: `${frame.x + frame.width / 2}px ${frame.y + frame.height / 2}px` }}
    >
      {layered(parts)}
    </div>
  );
};

/** The line where a layer dragged inside a stack or grid would land (a thin ink bar between the neighbours). */
export const FlowDropLine: React.FC<{ zoom?: number }> = ({ zoom = 1 }) => {
  const line = useStackDropStore((s) => s.line);
  if (!line) return null;
  const t = zoom > 0 ? 2 / zoom : 2;
  const vertical = Math.abs(line.x2 - line.x1) < Math.abs(line.y2 - line.y1);
  return (
    <div
      data-testid="flow-drop-line"
      aria-hidden="true"
      className="ll:absolute ll:pointer-events-none"
      style={{
        left: vertical ? line.x1 - t / 2 : Math.min(line.x1, line.x2),
        top: vertical ? Math.min(line.y1, line.y2) : line.y1 - t / 2,
        width: vertical ? t : Math.abs(line.x2 - line.x1),
        height: vertical ? Math.abs(line.y2 - line.y1) : t,
        backgroundColor: "var(--ll-pen-mark)",
      }}
    />
  );
};
