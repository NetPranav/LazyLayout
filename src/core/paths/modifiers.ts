/**
 * ============================================================================
 * MODIFIER STACK (ROADMAP Phases 109 and 110)
 * ============================================================================
 * A layer's outline can pass through an ordered, non-destructive list of modifiers (as in Blender, Cavalry or After
 * Effects' shape layers), stored on the layer as `shape.modifiers` (JSON). Each modifier can be switched off; the
 * layer's own geometry is never changed, so switching every modifier off gives the original path back exactly.
 *
 * Phase 110's modifiers: Repeat (line, circle, grid), Trim (start, end, offset), Offset and Round corners. They follow
 * After Effects' shape-layer rules where it has them (the repeater's per-copy transform, trim's offset in turns of
 * the path, round corners on sharp vertices only).
 *
 * Pure functions, no DOM. A path here is in the layer's own box (px), with the box's size given for the operations that
 * need its centre.
 * ============================================================================
 */

import { BezPath, segmentEval, segmentStart, splitSubpaths, type Pt, type Segment } from "../geometry/bezpath";
import { offsetPath } from "./pathTools";
import { bend, puckerBloat, spherize, twist, wiggle, zigzag } from "./warps";
import { cells, flow, grid, rings, scatter } from "./generators";

export type ModifierType = "repeat" | "trim" | "offset" | "round" | "twist" | "bend" | "wiggle" | "zigzag" | "pucker" | "spherize" | "scatter" | "cells" | "grid" | "rings" | "flow";
export const MODIFIER_TYPES: readonly ModifierType[] = ["repeat", "trim", "offset", "round", "twist", "bend", "wiggle", "zigzag", "pucker", "spherize", "scatter", "cells", "grid", "rings", "flow"];

export interface Modifier {
  id: string;
  type: ModifierType;
  /** Switched on (default) or off. */
  on: boolean;
  params: Record<string, number | string>;
}

/** What a modifier works on and gives back: a path, and whether it is a closed shape (a fill) or open (a line). */
export interface ModPath {
  path: BezPath;
  closed: boolean;
}

interface ParamDef {
  key: string;
  label: string;
  /** A number with its range and default, or one of a set of choices. */
  kind: "number" | "choice";
  min?: number;
  max?: number;
  default: number | string;
  unit?: string;
  choices?: readonly string[];
  /** Shown on the Simple face (at most 7 per modifier, Law 6); the rest only in Pro. */
  simple: boolean;
}

export interface ModifierDef {
  type: ModifierType;
  label: string;
  params: readonly ParamDef[];
  apply: (input: ModPath, p: Readonly<Record<string, number | string>>, box: { w: number; h: number }) => ModPath;
}

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// --- repeat ---------------------------------------------------------------------------------------------------------

/**
 * After Effects' repeater: copy i (0 is the original) is the original transformed i times by the step: moved by the
 * position step, turned by the rotation step and scaled by the scale step (compounding), about the anchor (the box's
 * centre). `circle` places the copies round the centre at `radius` instead, each turned to face out; `grid` lays out
 * `count` columns and `rows` rows `gap` apart.
 */
function repeat(input: ModPath, p: Readonly<Record<string, number | string>>, box: { w: number; h: number }): ModPath {
  const mode = p.mode === "circle" || p.mode === "grid" ? p.mode : "line";
  const count = Math.round(clamp(num(p.count, 3), 1, 500));
  const c = { x: box.w / 2, y: box.h / 2 };
  const out = new BezPath();
  const place = (dx: number, dy: number, turnDeg: number, s: number) => {
    const a = (turnDeg * Math.PI) / 180;
    const cos = Math.cos(a) * s;
    const sin = Math.sin(a) * s;
    out.extend(input.path.map((q) => ({ x: c.x + (q.x - c.x) * cos - (q.y - c.y) * sin + dx, y: c.y + (q.x - c.x) * sin + (q.y - c.y) * cos + dy })));
  };
  if (mode === "grid") {
    const rows = Math.round(clamp(num(p.rows, 3), 1, 500));
    const gx = num(p.gapX, box.w + 10);
    const gy = num(p.gapY, box.h + 10);
    for (let r = 0; r < rows && r * count < 10_000; r++) for (let k = 0; k < count; k++) place(k * gx, r * gy, 0, 1);
  } else if (mode === "circle") {
    const radius = num(p.radius, Math.max(box.w, box.h));
    const sweep = num(p.sweep, 360);
    // a full turn shares its last step with the first copy, a partial sweep reaches both ends
    const steps = Math.abs(sweep) >= 360 ? count : Math.max(1, count - 1);
    for (let i = 0; i < count; i++) {
      const t = (sweep * i) / steps;
      const a = ((t - 90) * Math.PI) / 180;
      place(Math.cos(a) * radius, radius + Math.sin(a) * radius, t, 1);
    }
  } else {
    const sx = num(p.stepX, box.w + 10);
    const sy = num(p.stepY, 0);
    const rot = num(p.rotate, 0);
    const scale = clamp(num(p.scale, 100), 1, 1000) / 100;
    for (let i = 0; i < count; i++) place(i * sx, i * sy, i * rot, scale ** i);
  }
  return { path: out, closed: input.closed };
}

// --- trim -----------------------------------------------------------------------------------------------------------

/** Samples per curve for its length table: the length of a curve a few hundred px long comes out within 0.01 px. */
const LUT = 48;

/** A segment's cumulative length at evenly spaced parameters (a line needs only its ends). */
function lengthTable(s: Segment): number[] {
  if (s.kind === "line") return [0, Math.hypot(s.p1.x - s.p0.x, s.p1.y - s.p0.y)];
  // one sample per ~4 px of the control polygon (a short arc needs only a few), at most LUT
  const ctrl = s.kind === "quad" ? [s.p0, s.p1, s.p2] : [s.p0, s.p1, s.p2, s.p3];
  let poly = 0;
  for (let k = 1; k < ctrl.length; k++) poly += Math.hypot(ctrl[k].x - ctrl[k - 1].x, ctrl[k].y - ctrl[k - 1].y);
  const steps = Math.max(6, Math.min(LUT, Math.ceil(poly / 4)));
  const out = [0];
  let prev = segmentEval(s, 0);
  for (let i = 1; i <= steps; i++) {
    const q = segmentEval(s, i / steps);
    out.push(out[i - 1] + Math.hypot(q.x - prev.x, q.y - prev.y));
    prev = q;
  }
  return out;
}

/** The parameter at which a segment has run `len` of its length, read off its length table. */
function paramAt(table: readonly number[], len: number): number {
  const n = table.length - 1;
  if (len <= 0) return 0;
  if (len >= table[n]) return 1;
  let lo = 0;
  let hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid] < len) lo = mid;
    else hi = mid;
  }
  const span = table[hi] - table[lo];
  return (lo + (span > 0 ? (len - table[lo]) / span : 0)) / n;
}

/** A segment between two parameters, as a segment of its own (de Casteljau). */
function cut(s: Segment, t0: number, t1: number): Segment {
  if (s.kind === "line") return { kind: "line", p0: segmentEval(s, t0), p1: segmentEval(s, t1) };
  const c = s.kind === "quad"
    ? { p0: s.p0, p1: { x: s.p0.x + (2 / 3) * (s.p1.x - s.p0.x), y: s.p0.y + (2 / 3) * (s.p1.y - s.p0.y) }, p2: { x: s.p2.x + (2 / 3) * (s.p1.x - s.p2.x), y: s.p2.y + (2 / 3) * (s.p1.y - s.p2.y) }, p3: s.p2 }
    : { p0: s.p0, p1: s.p1, p2: s.p2, p3: s.p3 };
  const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  // split at t1, keep the first part, then split that at t0 / t1
  const split = (q: { p0: Pt; p1: Pt; p2: Pt; p3: Pt }, t: number) => {
    const a = lerp(q.p0, q.p1, t);
    const b = lerp(q.p1, q.p2, t);
    const d = lerp(q.p2, q.p3, t);
    const e = lerp(a, b, t);
    const f = lerp(b, d, t);
    const g = lerp(e, f, t);
    return [{ p0: q.p0, p1: a, p2: e, p3: g }, { p0: g, p1: f, p2: d, p3: q.p3 }] as const;
  };
  const first = t1 >= 1 ? c : split(c, t1)[0];
  const piece = t0 <= 0 ? first : split(first, t1 > 0 ? t0 / t1 : 0)[1];
  return { kind: "cubic", ...piece };
}

/** The part of a subpath's segments from length `a` to `b` (0 ≤ a ≤ b ≤ total). */
function between(segs: readonly Segment[], tables: readonly number[][], a: number, b: number, out: BezPath): void {
  const lens = tables.map((tb) => tb[tb.length - 1]);
  let start = 0;
  let moved = false;
  for (let i = 0; i < segs.length; i++) {
    const end = start + lens[i];
    const from = Math.max(a, start);
    const to = Math.min(b, end);
    if (to > from + 1e-9 || (lens[i] === 0 && from === to && to > a && to < b)) {
      const t0 = lens[i] > 0 ? paramAt(tables[i], from - start) : 0;
      const t1 = lens[i] > 0 ? paramAt(tables[i], to - start) : 1;
      const piece = t0 <= 1e-9 && t1 >= 1 - 1e-9 ? segs[i] : cut(segs[i], t0, t1);
      if (!moved) out.moveTo(segmentStart(piece));
      moved = true;
      if (piece.kind === "line") out.lineTo(piece.p1);
      else if (piece.kind === "quad") out.quadTo(piece.p1, piece.p2);
      else out.curveTo(piece.p1, piece.p2, piece.p3);
    }
    start = end;
  }
}

/**
 * After Effects' Trim Paths, each subpath on its own ("simultaneously"): only the stretch from `start`% to `end`% of
 * its length is kept, the window moved round by `offset` degrees (360 is the whole path). On a closed path the window
 * wraps round the closing point. A trimmed path is open (a line); keeping 0–100% gives the path back unchanged.
 */
function trim(input: ModPath, p: Readonly<Record<string, number | string>>): ModPath {
  let s = clamp(num(p.start, 0), 0, 100) / 100;
  let e = clamp(num(p.end, 100), 0, 100) / 100;
  if (s > e) [s, e] = [e, s];
  const off = num(p.offset, 0) / 360;
  if (s <= 0 && e >= 1) return input;
  const out = new BezPath();
  for (const sp of splitSubpaths(input.path)) {
    const segs = sp.segments();
    const tables = segs.map(lengthTable);
    const total = tables.reduce((a, tb) => a + tb[tb.length - 1], 0);
    if (total <= 0 || e - s <= 0) continue;
    let a = (s + off) % 1;
    if (a < 0) a += 1;
    const span = (e - s) * total;
    const from = a * total;
    const to = from + span;
    const closed = sp.els[sp.els.length - 1]?.t === "Z";
    if (to <= total + 1e-9) between(segs, tables, from, Math.min(to, total), out);
    else if (closed) {
      // wraps round the closing point: the end of the loop, then on from its start, as one line
      between(segs.concat(segs), tables.concat(tables), from, to, out);
    } else {
      between(segs, tables, from, total, out);
      between(segs, tables, 0, to - total, out);
    }
  }
  return { path: out, closed: false };
}

// --- offset and round ---------------------------------------------------------------------------------------------

function offset(input: ModPath, p: Readonly<Record<string, number | string>>): ModPath {
  if (!input.closed) return input;
  const d = num(p.distance, 4);
  const join = p.join === "miter" || p.join === "bevel" ? p.join : "round";
  const out = offsetPath(input.path, d, join, num(p.miterLimit, 4));
  return { path: out, closed: true };
}

/**
 * After Effects' Round Corners: every sharp vertex (where the path turns, not where it runs smoothly through) is rounded
 * by the radius, shrunk to fit in half of each neighbouring segment; curves are cut where the arc meets them.
 */
function round(input: ModPath, p: Readonly<Record<string, number | string>>): ModPath {
  const r = Math.max(0, num(p.radius, 8));
  if (r <= 0) return input;
  const out = new BezPath();
  for (const sp of splitSubpaths(input.path)) roundSubpath(sp, r, out);
  return { path: out, closed: input.closed };
}

const unit = (v: Pt): Pt => {
  const l = Math.hypot(v.x, v.y);
  return l > 1e-12 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
};
/** The direction a segment leaves its start (`end` false) or arrives at its end, taken a hair inside when a handle has no length. */
function direction(s: Segment, end: boolean): Pt {
  const a = segmentEval(s, end ? 0.999 : 0);
  const b = segmentEval(s, end ? 1 : 0.001);
  const ctrl = s.kind === "line" ? null : end ? (s.kind === "quad" ? s.p1 : s.p2) : s.p1;
  const tip = end ? segmentEval(s, 1) : segmentEval(s, 0);
  if (ctrl && Math.hypot(ctrl.x - tip.x, ctrl.y - tip.y) > 1e-9) return unit(end ? { x: tip.x - ctrl.x, y: tip.y - ctrl.y } : { x: ctrl.x - tip.x, y: ctrl.y - tip.y });
  return unit({ x: b.x - a.x, y: b.y - a.y });
}

function emit(out: BezPath, s: Segment): void {
  if (s.kind === "line") out.lineTo(s.p1);
  else if (s.kind === "quad") out.quadTo(s.p1, s.p2);
  else out.curveTo(s.p1, s.p2, s.p3);
}

/** One subpath with its sharp joints rounded: each pair of neighbours is cut back and an arc put between them. */
function roundSubpath(sp: BezPath, r: number, out: BezPath): void {
  const closed = sp.els[sp.els.length - 1]?.t === "Z";
  const segs = sp.segments().filter((s) => s.kind !== "line" || Math.hypot(s.p1.x - s.p0.x, s.p1.y - s.p0.y) > 1e-9);
  const n = segs.length;
  if (n === 0) return;
  const tables = segs.map(lengthTable);
  const len = tables.map((tb) => tb[tb.length - 1]);
  // how far each segment is cut back at its start and at its end, and the arc at each joint
  const cutStart = new Array<number>(n).fill(0);
  const cutEnd = new Array<number>(n).fill(0);
  const arcs: ({ a: Pt; b: Pt; c1: Pt; c2: Pt } | null)[] = new Array(n).fill(null);
  const joints = closed ? n : n - 1;
  for (let j = 0; j < joints; j++) {
    const s1 = segs[j];
    const s2 = segs[(j + 1) % n];
    const d1 = direction(s1, true);
    const d2 = direction(s2, false);
    const turn = Math.acos(Math.max(-1, Math.min(1, d1.x * d2.x + d1.y * d2.y)));
    if (turn < 1e-3 || Math.PI - turn < 1e-3) continue; // runs smoothly through, or doubles straight back
    const interior = Math.PI - turn;
    let tLen = r / Math.tan(interior / 2);
    const fit = Math.min(len[j], len[(j + 1) % n]) / 2;
    let rr = r;
    if (tLen > fit) {
      rr = (r * fit) / tLen;
      tLen = fit;
    }
    if (tLen <= 1e-9) continue;
    cutEnd[j] = tLen;
    cutStart[(j + 1) % n] = tLen;
    const a = segmentEval(s1, paramAt(tables[j], len[j] - tLen));
    const b = segmentEval(s2, paramAt(tables[(j + 1) % n], tLen));
    const k = (4 / 3) * Math.tan(turn / 4) * rr;
    arcs[j] = { a, b, c1: { x: a.x + d1.x * k, y: a.y + d1.y * k }, c2: { x: b.x - d2.x * k, y: b.y - d2.y * k } };
  }
  const piece = (i: number): Segment => {
    if (cutStart[i] <= 0 && cutEnd[i] <= 0) return segs[i];
    return cut(segs[i], paramAt(tables[i], cutStart[i]), paramAt(tables[i], len[i] - cutEnd[i]));
  };
  // a closed path starts after the last joint's arc, so it ends on that arc
  const first = piece(0);
  out.moveTo(closed && arcs[n - 1] ? arcs[n - 1]!.b : segmentEval(first, 0));
  for (let i = 0; i < n; i++) {
    emit(out, piece(i));
    const arc = arcs[i];
    if (arc && (closed || i < n - 1)) out.curveTo(arc.c1, arc.c2, arc.b);
  }
  if (closed) out.closePath();
}

// --- the registry ---------------------------------------------------------------------------------------------------

export const MODIFIER_DEFS: Readonly<Record<ModifierType, ModifierDef>> = {
  repeat: {
    type: "repeat",
    label: "Repeat",
    params: [
      { key: "mode", label: "Layout", kind: "choice", choices: ["line", "circle", "grid"], default: "line", simple: true },
      { key: "count", label: "Copies", kind: "number", min: 1, max: 500, default: 3, simple: true },
      { key: "stepX", label: "Step X", kind: "number", min: -5000, max: 5000, default: 0, unit: "px", simple: true },
      { key: "stepY", label: "Step Y", kind: "number", min: -5000, max: 5000, default: 0, unit: "px", simple: true },
      { key: "rotate", label: "Turn each", kind: "number", min: -360, max: 360, default: 0, unit: "°", simple: true },
      { key: "scale", label: "Scale each", kind: "number", min: 1, max: 1000, default: 100, unit: "%", simple: true },
      { key: "radius", label: "Radius", kind: "number", min: 0, max: 5000, default: 100, unit: "px", simple: false },
      { key: "sweep", label: "Sweep", kind: "number", min: -360, max: 360, default: 360, unit: "°", simple: false },
      { key: "rows", label: "Rows", kind: "number", min: 1, max: 500, default: 3, simple: false },
      { key: "gapX", label: "Gap X", kind: "number", min: -5000, max: 5000, default: 0, unit: "px", simple: false },
      { key: "gapY", label: "Gap Y", kind: "number", min: -5000, max: 5000, default: 0, unit: "px", simple: false },
    ],
    apply: repeat,
  },
  trim: {
    type: "trim",
    label: "Trim",
    params: [
      { key: "start", label: "Start", kind: "number", min: 0, max: 100, default: 0, unit: "%", simple: true },
      { key: "end", label: "End", kind: "number", min: 0, max: 100, default: 50, unit: "%", simple: true },
      { key: "offset", label: "Offset", kind: "number", min: -3600, max: 3600, default: 0, unit: "°", simple: true },
    ],
    apply: (i, p) => trim(i, p),
  },
  offset: {
    type: "offset",
    label: "Offset",
    params: [
      { key: "distance", label: "Distance", kind: "number", min: -2000, max: 2000, default: 4, unit: "px", simple: true },
      { key: "join", label: "Corners", kind: "choice", choices: ["round", "miter", "bevel"], default: "round", simple: true },
      { key: "miterLimit", label: "Miter limit", kind: "number", min: 1, max: 100, default: 4, simple: false },
    ],
    apply: (i, p) => offset(i, p),
  },
  round: {
    type: "round",
    label: "Round corners",
    params: [{ key: "radius", label: "Radius", kind: "number", min: 0, max: 5000, default: 8, unit: "px", simple: true }],
    apply: (i, p) => round(i, p),
  },
  // Phase 111: warps (core/paths/warps.ts)
  twist: {
    type: "twist",
    label: "Twist",
    params: [{ key: "angle", label: "Amount", kind: "number", min: -1080, max: 1080, default: 90, unit: "°", simple: true }],
    apply: twist,
  },
  bend: {
    type: "bend",
    label: "Bend",
    params: [{ key: "angle", label: "Amount", kind: "number", min: -359, max: 359, default: 45, unit: "°", simple: true }],
    apply: bend,
  },
  wiggle: {
    type: "wiggle",
    label: "Wiggle",
    params: [
      { key: "size", label: "Amount", kind: "number", min: 0, max: 500, default: 4, unit: "px", simple: true },
      { key: "detail", label: "Detail", kind: "number", min: 0.1, max: 200, default: 6, simple: true },
      { key: "seed", label: "Seed", kind: "number", min: 0, max: 1_000_000, default: 1, simple: true },
      { key: "speed", label: "Speed", kind: "number", min: 0, max: 100, default: 0, simple: false },
    ],
    apply: (i, p) => wiggle(i, p),
  },
  zigzag: {
    type: "zigzag",
    label: "Zig-zag",
    params: [
      { key: "size", label: "Amount", kind: "number", min: 0, max: 500, default: 6, unit: "px", simple: true },
      { key: "ridges", label: "Ridges", kind: "number", min: 1, max: 200, default: 5, simple: true },
      { key: "points", label: "Points", kind: "choice", choices: ["corner", "smooth"], default: "corner", simple: true },
    ],
    apply: (i, p) => zigzag(i, p),
  },
  pucker: {
    type: "pucker",
    label: "Pucker & bloat",
    params: [{ key: "amount", label: "Amount", kind: "number", min: -200, max: 200, default: 30, unit: "%", simple: true }],
    apply: puckerBloat,
  },
  spherize: {
    type: "spherize",
    label: "Spherize",
    params: [{ key: "amount", label: "Amount", kind: "number", min: -100, max: 100, default: 50, unit: "%", simple: true }],
    apply: spherize,
  },
  // Phase 112: generators (core/paths/generators.ts); Seed is the Shuffle
  scatter: {
    type: "scatter",
    label: "Scatter",
    params: [
      { key: "count", label: "Copies", kind: "number", min: 1, max: 5000, default: 50, simple: true },
      { key: "shape", label: "Shape", kind: "choice", choices: ["circle", "star", "square", "triangle"], default: "circle", simple: true },
      { key: "size", label: "Size", kind: "number", min: 0.1, max: 1000, default: 8, unit: "px", simple: true },
      { key: "place", label: "Place", kind: "choice", choices: ["inside", "along"], default: "inside", simple: true },
      { key: "variety", label: "Variety", kind: "number", min: 0, max: 100, default: 50, unit: "%", simple: true },
      { key: "seed", label: "Seed", kind: "number", min: 0, max: 1_000_000, default: 1, simple: true },
    ],
    apply: (i, p) => scatter(i, p),
  },
  cells: {
    type: "cells",
    label: "Cells",
    params: [
      { key: "mode", label: "Cells", kind: "choice", choices: ["voronoi", "triangles"], default: "voronoi", simple: true },
      { key: "count", label: "Pieces", kind: "number", min: 2, max: 600, default: 24, simple: true },
      { key: "gap", label: "Gap", kind: "number", min: 0, max: 200, default: 2, unit: "px", simple: true },
      { key: "variety", label: "Variety", kind: "number", min: 0, max: 100, default: 100, unit: "%", simple: true },
      { key: "seed", label: "Seed", kind: "number", min: 0, max: 1_000_000, default: 1, simple: true },
    ],
    apply: (i, p) => cells(i, p),
  },
  grid: {
    type: "grid",
    label: "Grid",
    params: [
      { key: "kind", label: "Cells", kind: "choice", choices: ["square", "hex", "triangle"], default: "square", simple: true },
      { key: "size", label: "Size", kind: "number", min: 2, max: 2000, default: 20, unit: "px", simple: true },
      { key: "gap", label: "Gap", kind: "number", min: 0, max: 200, default: 2, unit: "px", simple: true },
    ],
    apply: (i, p) => grid(i, p),
  },
  rings: {
    type: "rings",
    label: "Rings",
    params: [
      { key: "count", label: "Rings", kind: "number", min: 1, max: 200, default: 5, simple: true },
      { key: "inner", label: "Smallest", kind: "number", min: 0, max: 100, default: 10, unit: "%", simple: true },
    ],
    apply: rings,
  },
  flow: {
    type: "flow",
    label: "Flow lines",
    params: [
      { key: "count", label: "Lines", kind: "number", min: 1, max: 2000, default: 40, simple: true },
      { key: "length", label: "Length", kind: "number", min: 1, max: 5000, default: 80, unit: "px", simple: true },
      { key: "scale", label: "Swirl size", kind: "number", min: 1, max: 5000, default: 60, unit: "px", simple: true },
      { key: "variety", label: "Variety", kind: "number", min: 0, max: 100, default: 50, unit: "%", simple: true },
      { key: "seed", label: "Seed", kind: "number", min: 0, max: 1_000_000, default: 1, simple: true },
    ],
    apply: (i, p) => flow(i, p),
  },
};

/** The most modifiers a layer keeps. */
export const MAX_MODIFIERS = 32;

/** A stack read from `shape.modifiers`: unknown types and junk dropped, parameters clamped to their ranges. */
export function parseModifiers(raw: unknown): Modifier[] {
  if (typeof raw !== "string" || raw.trim() === "" || raw.length > 100_000) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  const out: Modifier[] = [];
  for (const m of list.slice(0, MAX_MODIFIERS)) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    const def = MODIFIER_DEFS[o.type as ModifierType];
    if (!def) continue;
    const given = o.params && typeof o.params === "object" ? (o.params as Record<string, unknown>) : {};
    const params: Record<string, number | string> = {};
    for (const d of def.params) {
      const v = given[d.key];
      if (d.kind === "choice") params[d.key] = typeof v === "string" && d.choices!.includes(v) ? v : d.default;
      else params[d.key] = typeof v === "number" && Number.isFinite(v) ? clamp(v, d.min ?? -Infinity, d.max ?? Infinity) : d.default;
    }
    out.push({ id: typeof o.id === "string" && o.id ? o.id.slice(0, 64) : `m${out.length}`, type: def.type, on: o.on !== false, params });
  }
  return out;
}

export const serializeModifiers = (stack: readonly Modifier[]): string => (stack.length ? JSON.stringify(stack.slice(0, MAX_MODIFIERS)) : "");

/** Whether a stack changes anything (at least one modifier switched on). */
export const hasActiveModifiers = (stack: readonly Modifier[]): boolean => stack.some((m) => m.on);

/** A new modifier of a type with its defaults. */
export function newModifier(type: ModifierType, id: string): Modifier {
  const def = MODIFIER_DEFS[type];
  return { id, type, on: true, params: Object.fromEntries(def.params.map((d) => [d.key, d.default])) };
}

/** Runs the stack top to bottom over a path. Modifiers that are off are skipped; with none on, the input comes back as it is. */
export function applyModifiers(input: ModPath, stack: readonly Modifier[], box: { w: number; h: number }): ModPath {
  let cur = input;
  for (const m of stack) {
    if (!m.on || cur.path.isEmpty()) continue;
    cur = MODIFIER_DEFS[m.type].apply(cur, m.params, box);
  }
  return cur;
}

