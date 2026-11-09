/**
 * Adapting a frame to a narrower breakpoint, automatically: what is designed at Desktop lands sensibly at Tablet and
 * Mobile with nothing moved by hand. Pure, derived from the base each time (never stored), so every Desktop edit carries
 * over, and the canvas and the export (which both read `resolveDocumentAt`) can't disagree.
 *
 * The free layers of the frame are read the way a person reads the page, top to bottom:
 * - layers that overlap belong together (a label on a card) and are scaled as one group;
 * - a layer covering most of the frame is its background: it takes the new width and the new height;
 * - groups side by side are a row. A row stays side by side when it still fits (at its own size, else scaled, as long
 *   as each column stays usable); otherwise it stacks;
 * - large type scales down gently, text is re-wrapped, pictures keep their shape, and space between rows follows.
 *
 * What the designer decided wins: a layer moved at this breakpoint (an override), or pinned by a constraint other than
 * left/top, keeps its place and is left out of the flow.
 */

import type { Layer } from "../document/schema";
import type { PropValue } from "../document/registry";
import { readHorizontal, readVertical } from "../layout/constraints";

const MIN_COLUMN = 200;
const MIN_PAD = 16;
const STACK_GAP = 16;
/** Their height is theirs, whatever their width (a button is as tall on a phone). */
const KEEP_HEIGHT = new Set<string>(["button", "fab", "badge", "input", "textarea", "select", "toggle", "checkbox", "divider", "line"]);

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const round = (n: number) => Math.round(n * 100) / 100;

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Cluster extends Box {
  members: Box[];
}

const textOf = (l: Layer): string => (typeof l.properties["content.text"] === "string" ? (l.properties["content.text"] as string) : l.name);
const fontOf = (l: Layer): number => num(l.properties["typography.fontSize"]) ?? 16;
const leadingOf = (l: Layer): number => num(l.properties["typography.lineHeight"]) ?? 1.4;

/** Large type comes down gently (a square root of the width change); body text stays readable as it is. */
export function adaptedFontSize(size: number, ratio: number): number {
  if (ratio >= 1 || size <= 18) return size;
  return Math.max(18, Math.round(size * Math.sqrt(ratio)));
}

/** The height a text needs at a width. An estimate (no page here): 0.55em a character, rounded up a line at a time. */
export function estimateTextHeight(text: string, fontSize: number, leading: number, width: number): number {
  const perLine = Math.max(1, Math.floor(width / (fontSize * 0.55)));
  const lines = text.split("\n").reduce((n, p) => n + Math.max(1, Math.ceil(p.length / perLine)), 0);
  return Math.ceil(lines * fontSize * leading);
}

function boxOf(l: Layer): Box {
  const p = l.properties;
  const w = num(p["frame.width"]) ?? (l.archetype === "text" ? textOf(l).length * fontOf(l) * 0.55 : 0);
  const h = num(p["frame.height"]) ?? (l.archetype === "text" ? fontOf(l) * leadingOf(l) : 0);
  return { id: l.id, x: num(p["frame.x"]) ?? 0, y: num(p["frame.y"]) ?? 0, w, h };
}

const overlaps = (a: Box, b: Box) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1;

/** Layers that overlap, directly or through another, as groups. */
function clusterOf(boxes: Box[]): Cluster[] {
  const groups: Box[][] = [];
  for (const box of boxes) {
    const touching = groups.filter((g) => g.some((m) => overlaps(m, box)));
    const merged = [box, ...touching.flat()];
    for (const t of touching) groups.splice(groups.indexOf(t), 1);
    groups.push(merged);
  }
  return groups.map((members) => {
    const x = Math.min(...members.map((m) => m.x));
    const y = Math.min(...members.map((m) => m.y));
    return { id: members[0].id, x, y, w: Math.max(...members.map((m) => m.x + m.w)) - x, h: Math.max(...members.map((m) => m.y + m.h)) - y, members };
  });
}

/** Groups side by side (sharing at least 40% of the shorter's height) are a row; rows from the top, each left to right. */
function rowsOf(clusters: Cluster[]): Cluster[][] {
  const rows: { top: number; bottom: number; items: Cluster[] }[] = [];
  for (const c of [...clusters].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find((r) => Math.min(r.bottom, c.y + c.h) - Math.max(r.top, c.y) >= 0.4 * Math.min(r.bottom - r.top, c.h));
    if (row) {
      row.items.push(c);
      row.top = Math.min(row.top, c.y);
      row.bottom = Math.max(row.bottom, c.y + c.h);
    } else rows.push({ top: c.y, bottom: c.y + c.h, items: [c] });
  }
  return rows.sort((a, b) => a.top - b.top).map((r) => r.items.sort((a, b) => a.x - b.x));
}

/**
 * Adapts the free layers of a frame from one width to a narrower one, writing the layers it changes into `out`.
 * `pinned` says which layers the designer has placed at this breakpoint. Returns the height the frame now needs.
 */
export function adaptFrame(
  layers: Record<string, Layer>,
  frameId: string,
  fromW: number,
  toW: number,
  out: Record<string, Layer>,
  pinned: (layer: Layer) => boolean,
  depth = 0,
): number {
  const frame = out[frameId] ?? layers[frameId];
  const frameH = num(frame?.properties["frame.height"]) ?? 0;
  if (!frame || depth > 16 || toW >= fromW || fromW <= 0) return frameH;

  const kids = frame.children.map((id) => layers[id]).filter((l): l is Layer => !!l && l.visible !== false && l.properties["render.role"] !== "helper");

  // A stack lays itself out: a row that no longer fits becomes a column.
  const inFlow = kids.filter((l) => l.properties.positioning !== "absolute");
  if (inFlow.length > 0 && kids.every((l) => l.properties.positioning !== "absolute")) {
    const gap = num(frame.properties["layout.gap"]) ?? 0;
    const sizes = inFlow.map(boxOf);
    const row = frame.properties["layout.flexDirection"] === "row";
    if (!row || sizes.reduce((s, b) => s + b.w, 0) + gap * (sizes.length - 1) <= toW) return frameH;
    const height = sizes.reduce((s, b) => s + b.h, 0) + gap * (sizes.length - 1);
    out[frameId] = { ...frame, properties: { ...frame.properties, "layout.flexDirection": "column" } };
    return Math.max(frameH, height);
  }

  const free = kids.filter(
    (l) => l.properties.positioning === "absolute" && !pinned(l) && readHorizontal(l.properties["constraints.horizontal"]) === "start" && readVertical(l.properties["constraints.vertical"]) === "start",
  );
  if (free.length === 0) return frameH;

  const ratio = toW / fromW;
  const soft = Math.sqrt(ratio);
  const all = free.map(boxOf);
  const lowest = Math.max(...all.map((b) => b.y + b.h));

  // a layer covering most of the frame, with others on it, is its background
  const isBackground = (b: Box) => all.length > 1 && b.w >= 0.9 * fromW && b.h >= 0.6 * Math.max(frameH, lowest) && all.some((o) => o !== b && overlaps(o, b));
  const backgrounds = all.filter(isBackground);
  const flow = all.filter((b) => !isBackground(b));

  const write = (id: string, patch: Record<string, PropValue>) => {
    const l = out[id] ?? layers[id];
    out[id] = { ...l, properties: { ...l.properties, ...patch } };
  };

  /** Places one layer at a new box; returns the height it takes. */
  const place = (b: Box, x: number, y: number, w: number, scale: number): number => {
    const l = layers[b.id];
    const patch: Record<string, PropValue> = { "frame.x": round(x), "frame.y": round(y), "frame.width": round(w) };
    let h = KEEP_HEIGHT.has(l.archetype) ? b.h : b.h * scale;
    if (l.archetype === "text") {
      const size = adaptedFontSize(fontOf(l), ratio);
      h = estimateTextHeight(textOf(l), size, leadingOf(l), w);
      if (size !== fontOf(l)) patch["typography.fontSize"] = size;
      patch["text.sizing"] = "autoHeight";
    }
    patch["frame.height"] = round(h);
    write(b.id, patch);
    if (l.archetype === "container" && l.children.length > 0 && w < b.w) {
      h = adaptFrame(layers, b.id, b.w, w, out, pinned, depth + 1);
      write(b.id, { "frame.height": round(h) });
    }
    return h;
  };

  const placeCluster = (c: Cluster, x: number, y: number, w: number): number => {
    const scale = c.w > 0 ? w / c.w : 1;
    if (c.members.length === 1) return place(c.members[0], x, y, w, scale);
    let bottom = y;
    for (const m of c.members) {
      const my = y + (m.y - c.y) * scale;
      bottom = Math.max(bottom, my + place(m, x + (m.x - c.x) * scale, my, m.w * scale, scale));
    }
    return bottom - y;
  };

  const clusters = clusterOf(flow);
  const rows = rowsOf(clusters);
  const left = clusters.length > 0 ? Math.min(...clusters.map((c) => c.x)) : 0;
  const right = clusters.length > 0 ? Math.max(...clusters.map((c) => c.x + c.w)) : 0;
  const pad = Math.max(MIN_PAD, Math.round(left * ratio));
  const avail = Math.max(1, toW - 2 * pad);
  const scaleX = right > left ? Math.min(1, avail / (right - left)) : 1;
  const centred = (c: Cluster) => Math.abs(c.x + c.w / 2 - fromW / 2) < fromW * 0.03;

  let y = rows.length > 0 ? Math.round(Math.min(...rows[0].map((c) => c.y)) * soft) : 0;
  let lastBaseBottom = 0;
  rows.forEach((row, i) => {
    const top = Math.min(...row.map((c) => c.y));
    if (i > 0) y += Math.max(STACK_GAP, Math.round(Math.max(0, top - lastBaseBottom) * soft));
    lastBaseBottom = Math.max(...row.map((c) => c.y + c.h));
    const widths = row.map((c) => c.w);
    const gaps = row.slice(1).map((c, k) => Math.max(0, c.x - (row[k].x + row[k].w)));
    const natural = widths.reduce((s, w) => s + w, 0) + gaps.reduce((s, g) => s + g, 0);
    let height = 0;
    if (row.length === 1) {
      const c = row[0];
      const w = Math.min(c.w, avail);
      const x = centred(c) ? (toW - w) / 2 : Math.min(pad + (c.x - left) * scaleX, toW - pad - w);
      height = placeCluster(c, x, y, w);
    } else if (natural <= avail) {
      let x = Math.min(pad + (row[0].x - left) * scaleX, toW - pad - natural);
      row.forEach((c, k) => {
        height = Math.max(height, placeCluster(c, x, y, c.w));
        x += c.w + (gaps[k] ?? 0);
      });
    } else {
      const rowLeft = row[0].x;
      const rowWidth = row[row.length - 1].x + row[row.length - 1].w - rowLeft;
      const fit = avail / rowWidth;
      if (widths.every((w) => w * fit >= MIN_COLUMN)) {
        row.forEach((c) => {
          height = Math.max(height, placeCluster(c, pad + (c.x - rowLeft) * fit, y, c.w * fit));
        });
      } else {
        row.forEach((c, k) => {
          if (k > 0) height += STACK_GAP;
          const w = Math.min(c.w, avail);
          height += placeCluster(c, pad, y + height, w);
        });
      }
    }
    y += height;
  });

  const below = frameH > lastBaseBottom ? frameH - lastBaseBottom : 0;
  const needed = flow.length > 0 ? y + Math.max(MIN_PAD, Math.round(below * soft)) : frameH;
  for (const b of backgrounds) {
    write(b.id, { "frame.x": round(b.x * ratio), "frame.y": round(b.y * soft), "frame.width": round(b.w * ratio), "frame.height": round(b.h >= 0.95 * frameH ? needed : b.h * soft) });
  }
  return needed;
}
