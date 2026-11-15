/**
 * Text that fills a shape (ROADMAP Phase 125). The shape's outline (path data in the text's own box, `text.shape`) is
 * cut into thin rows; each row keeps the widest span inside the outline, pulled in by the inset. The text then lays
 * out between two CSS floats whose `shape-outside` polygons follow the spans' left and right edges, so the browser
 * wraps the lines inside the shape (live, as the words change, on the stage and in the export alike).
 *
 * The rows above the first one wide enough for a line are kept out by padding the text down instead (a float would
 * push a line down by its own rules); `bandOf` gives the span a line of text gets, which the tests' reference uses.
 */

import { pathDataToBez } from "../paths/bezBridge";
import { polylines } from "../geometry/measure";

export interface TextShape {
  /** SVG path data in the text box's own space. */
  d: string;
  /** How far the text keeps from the outline (px). */
  inset: number;
  /** The layer the outline was taken from, when it was. */
  source?: string;
}

export function parseTextShape(json: unknown): TextShape | null {
  if (typeof json !== "string" || !json || json.length > 100_000) return null;
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    if (!v || typeof v.d !== "string" || !pathDataToBez(v.d)) return null;
    const inset = typeof v.inset === "number" && Number.isFinite(v.inset) ? Math.min(500, Math.max(0, v.inset)) : 0;
    return { d: v.d, inset, ...(typeof v.source === "string" && v.source.length <= 64 ? { source: v.source } : {}) };
  } catch {
    return null;
  }
}

/** One row of the shape: at height `y`, the span [l, r] text may use (l ≥ r: none). */
export interface Row {
  y: number;
  l: number;
  r: number;
}

/** Rows every this many px down the box. */
export const ROW_STEP = 2;

/** The shape's rows, top to bottom, every `ROW_STEP` px (and at the bottom edge), in a `w` × `h` box. */
export function shapeRows(shape: TextShape, w: number, h: number): Row[] {
  const lines = polylines(pathDataToBez(shape.d)!) ?? [];
  const edges: [number, number, number, number][] = [];
  for (const line of lines) {
    const pts = line.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (i === pts.length - 1 && !line.closed && Math.hypot(a.x - b.x, a.y - b.y) < 1e-9) continue;
      edges.push([a.x, a.y, b.x, b.y]);
    }
  }
  const rows: Row[] = [];
  const count = Math.ceil(h / ROW_STEP);
  for (let k = 0; k <= count; k++) {
    const y = Math.min(h, k * ROW_STEP);
    // where the row crosses the outline (half-open on y, so a vertex is counted once), sorted
    const xs: number[] = [];
    for (const [x1, y1, x2, y2] of edges) {
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    let best: [number, number] | null = null;
    for (let i = 0; i + 1 < xs.length; i += 2) if (!best || xs[i + 1] - xs[i] > best[1] - best[0]) best = [xs[i], xs[i + 1]];
    rows.push(best ? { y, l: Math.max(0, best[0] + shape.inset), r: Math.min(w, best[1] - shape.inset) } : { y, l: w / 2, r: w / 2 });
  }
  // the inset from the top and bottom: rows within it of a row with no room get none either
  if (shape.inset > 0) {
    const reach = Math.ceil(shape.inset / ROW_STEP);
    const open = rows.map((r) => r.r - r.l > 0);
    rows.forEach((r, k) => {
      for (let j = Math.max(0, k - reach); j <= Math.min(rows.length - 1, k + reach); j++)
        if (!open[j]) {
          r.l = w / 2;
          r.r = w / 2;
          break;
        }
    });
  }
  return rows;
}

/** The span a line from `top` to `bottom` gets: the narrowest the rows (linearly between them) are across it. */
export function bandOf(rows: readonly Row[], top: number, bottom: number): { l: number; r: number } {
  const at = (y: number): Row => {
    const k = Math.min(rows.length - 2, Math.max(0, Math.floor(y / ROW_STEP)));
    const a = rows[k];
    const b = rows[k + 1] ?? a;
    const u = b.y > a.y ? Math.min(1, Math.max(0, (y - a.y) / (b.y - a.y))) : 0;
    return { y, l: a.l + (b.l - a.l) * u, r: a.r + (b.r - a.r) * u };
  };
  let l = -Infinity;
  let r = Infinity;
  const ys = [top, bottom, ...rows.filter((x) => x.y > top && x.y < bottom).map((x) => x.y)];
  for (const y of ys) {
    const p = at(y);
    l = Math.max(l, p.l);
    r = Math.min(r, p.r);
  }
  return { l, r };
}

export interface ShapeFloats {
  /** Padding above the text: down to the first line that fits `minWidth`. */
  top: number;
  left: { width: number; polygon: string };
  right: { width: number; polygon: string };
}

const f = (n: number) => String(Math.round(n * 100) / 100);

/**
 * The two floats that keep text inside the shape: the left one's polygon runs down the spans' left edges, the right
 * one's down their right edges (each in its own box). `lineHeight` and `minWidth` (px) place the first line.
 */
export function shapeFloats(rows: readonly Row[], w: number, h: number, lineHeight: number, minWidth: number): ShapeFloats {
  let top = 0;
  while (top + lineHeight <= h) {
    const b = bandOf(rows, top, top + lineHeight);
    if (b.r - b.l >= minWidth) break;
    top += ROW_STEP;
  }
  if (top + lineHeight > h) top = 0;
  // the floats start where the text does (below the padding), so their rows are shifted up by it
  const below = rows.filter((r) => r.y >= top);
  const lw = Math.max(0.01, ...below.map((r) => Math.max(0, r.l)));
  const rw = Math.max(0.01, ...below.map((r) => w - Math.min(w, r.r)));
  const height = Math.max(0.01, h - top);
  const left = [`0 0`, ...below.map((r) => `${f(Math.max(0, r.l))}px ${f(r.y - top)}px`), `0 ${f(height)}px`];
  const right = [`${f(rw)}px 0`, ...below.map((r) => `${f(Math.max(0, r.r - (w - rw)))}px ${f(r.y - top)}px`), `${f(rw)}px ${f(height)}px`];
  return { top, left: { width: lw, polygon: `polygon(${left.join(", ")})` }, right: { width: rw, polygon: `polygon(${right.join(", ")})` } };
}
