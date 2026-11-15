/**
 * ROADMAP Phase 85: morphing one path into another, sub-path by sub-path, with automatic point matching.
 *
 * `PathMorphSolver.morph` (the kernel's morph until now) treats a path as one run of segments, so an icon made of several
 * strokes (a menu's three bars turning into a cross) was joined into a single line, and a closed shape always started
 * its morph from wherever each path happened to begin, which twists it. Here:
 *
 * - each sub-path is matched with the sub-path of the same number in the other path; one with no partner grows from, or
 *   shrinks to, a point at its own centre;
 * - both sides are cut into the same number of cubics without changing their shape (the longest piece is halved until
 *   the counts agree);
 * - for a pair of closed sub-paths the start point and the direction of the second are chosen so the points travel the
 *   least (the sum of squared distances between matched points), which is what stops the twist; for a pair of open
 *   ones only the direction is chosen;
 * - `startOffset` then moves the start point on by that many points and `reverse` flips the direction, for the cases
 *   the automatic choice gets wrong.
 *
 * At t = 0 the result draws exactly the first path and at t = 1 exactly the second (cutting a cubic, moving the start
 * of a closed path and reversing a path all leave the shape alone). Pure: no DOM, the same answer in every browser.
 */
import { lerp, splitSubpaths, type BezPath, type Cubic, type Pt, type Segment } from "../geometry/bezpath";
import { pathDataToBez } from "./bezBridge";

export const MORPH_MATCHES = ["auto", "order"] as const;
export type MorphMatch = (typeof MORPH_MATCHES)[number];

export interface MorphOptions {
  /** `auto` chooses the start point and direction that move the points least; `order` keeps both paths as written. */
  match: MorphMatch;
  /** Moves the second path's start point on by this many points (closed sub-paths only), after the automatic choice. */
  startOffset: number;
  /** Flips the second path's direction, after the automatic choice. */
  reverse: boolean;
}
export const MORPH_DEFAULTS: MorphOptions = { match: "auto", startOffset: 0, reverse: false };

/** A layer's morph settings (`morph.match`, `morph.startOffset`, `morph.reverse`), with the defaults for any it doesn't set. */
export function morphOptions(own?: Readonly<Record<string, unknown>>): MorphOptions {
  if (!own) return MORPH_DEFAULTS;
  const match = own["morph.match"];
  const offset = own["morph.startOffset"];
  const reverse = own["morph.reverse"];
  if (match === undefined && offset === undefined && reverse === undefined) return MORPH_DEFAULTS;
  return { match: match === "order" ? "order" : "auto", startOffset: typeof offset === "number" && Number.isFinite(offset) ? Math.round(offset) : 0, reverse: reverse === true };
}

/** The most cubics a sub-path is cut into (the matching is quadratic in this). */
export const MORPH_MAX_POINTS = 256;

interface Sub {
  cubics: Cubic[];
  closed: boolean;
}

const toCubic = (s: Segment): Cubic => {
  if (s.kind === "cubic") return { p0: s.p0, p1: s.p1, p2: s.p2, p3: s.p3 };
  if (s.kind === "quad") return { p0: s.p0, p1: lerp(s.p0, s.p1, 2 / 3), p2: lerp(s.p2, s.p1, 2 / 3), p3: s.p2 };
  return { p0: s.p0, p1: lerp(s.p0, s.p1, 1 / 3), p2: lerp(s.p0, s.p1, 2 / 3), p3: s.p1 };
};
const reverseCubic = (c: Cubic): Cubic => ({ p0: c.p3, p1: c.p2, p2: c.p1, p3: c.p0 });
/** A cubic's length, near enough to pick the longest (the chord and the control polygon, averaged). */
const roughLength = (c: Cubic): number =>
  (Math.hypot(c.p3.x - c.p0.x, c.p3.y - c.p0.y) + Math.hypot(c.p1.x - c.p0.x, c.p1.y - c.p0.y) + Math.hypot(c.p2.x - c.p1.x, c.p2.y - c.p1.y) + Math.hypot(c.p3.x - c.p2.x, c.p3.y - c.p2.y)) / 2;
/** De Casteljau at the middle: two cubics that draw exactly what one did. */
function halve(c: Cubic): [Cubic, Cubic] {
  const a = lerp(c.p0, c.p1, 0.5);
  const b = lerp(c.p1, c.p2, 0.5);
  const d = lerp(c.p2, c.p3, 0.5);
  const ab = lerp(a, b, 0.5);
  const bd = lerp(b, d, 0.5);
  const mid = lerp(ab, bd, 0.5);
  return [{ p0: c.p0, p1: a, p2: ab, p3: mid }, { p0: mid, p1: bd, p2: d, p3: c.p3 }];
}

function subsOf(path: BezPath): Sub[] {
  const out: Sub[] = [];
  for (const sp of splitSubpaths(path)) {
    const closed = sp.els.some((e) => e.t === "Z");
    const cubics = sp.segments().map(toCubic);
    if (cubics.length === 0) {
      // a lone "M x y": a point
      const m = sp.els.find((e): e is { t: "M"; p: Pt } => e.t === "M");
      if (!m) continue;
      cubics.push({ p0: m.p, p1: m.p, p2: m.p, p3: m.p });
    }
    out.push({ cubics, closed });
  }
  return out;
}

function centre(sub: Sub): Pt {
  let x = 0;
  let y = 0;
  for (const c of sub.cubics) {
    x += c.p0.x;
    y += c.p0.y;
  }
  const last = sub.cubics[sub.cubics.length - 1].p3;
  if (!sub.closed) {
    x += last.x;
    y += last.y;
  }
  const n = sub.cubics.length + (sub.closed ? 0 : 1);
  return { x: x / n, y: y / n };
}

/** A sub-path with nothing to pair with becomes a point at the other one's centre, so that one grows from (or shrinks to) its middle. */
const pointLike = (of: Sub): Sub => {
  const c = centre(of);
  return { cubics: [{ p0: c, p1: c, p2: c, p3: c }], closed: of.closed };
};

/** Cuts the longest cubic in half until there are `count` (the shape is unchanged). */
function cutTo(cubics: Cubic[], count: number): Cubic[] {
  const out = cubics.slice();
  while (out.length < count) {
    let longest = 0;
    let best = -1;
    for (let i = 0; i < out.length; i++) {
      const len = roughLength(out[i]);
      if (len > best) {
        best = len;
        longest = i;
      }
    }
    out.splice(longest, 1, ...halve(out[longest]));
  }
  return out;
}

const rotate = (cubics: Cubic[], by: number): Cubic[] => {
  const n = cubics.length;
  const k = ((by % n) + n) % n;
  return k === 0 ? cubics : [...cubics.slice(k), ...cubics.slice(0, k)];
};
const reversed = (cubics: Cubic[]): Cubic[] => cubics.map(reverseCubic).reverse();
/** How far the points travel: squared distance between matched points (starts, and the last end for an open pair). */
function travel(a: Cubic[], b: Cubic[], closed: boolean): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i].p0.x - b[i].p0.x) ** 2 + (a[i].p0.y - b[i].p0.y) ** 2;
  if (!closed) {
    const ea = a[a.length - 1].p3;
    const eb = b[b.length - 1].p3;
    sum += (ea.x - eb.x) ** 2 + (ea.y - eb.y) ** 2;
  }
  return sum;
}

export interface MatchedPair {
  from: Cubic[];
  to: Cubic[];
  closed: boolean;
  /** What the automatic choice did to the second sub-path: its start moved on by `rotation` points, and whether it was reversed. */
  rotation: number;
  reversed: boolean;
}

function pair(a: Sub, b: Sub, options: MorphOptions): MatchedPair {
  const count = Math.min(MORPH_MAX_POINTS, Math.max(a.cubics.length, b.cubics.length));
  const from = cutTo(a.cubics.length > count ? a.cubics.slice(0, count) : a.cubics, count);
  let to = cutTo(b.cubics.length > count ? b.cubics.slice(0, count) : b.cubics, count);
  const bothClosed = a.closed && b.closed;
  let rotation = 0;
  let flipped = false;
  if (options.match === "auto") {
    let best = travel(from, to, bothClosed);
    const consider = (candidate: Cubic[], r: number, f: boolean) => {
      const cost = travel(from, candidate, bothClosed);
      // only a clearly shorter journey wins, so equal choices (a square onto a square) keep the path as written
      if (cost < best - 1e-9) {
        best = cost;
        rotation = r;
        flipped = f;
      }
    };
    const back = reversed(to);
    if (bothClosed) {
      for (let r = 1; r < count; r++) consider(rotate(to, r), r, false);
      for (let r = 0; r < count; r++) consider(rotate(back, r), r, true);
    } else if (!a.closed && !b.closed) consider(back, 0, true);
    to = rotate(flipped ? back : to, rotation);
  }
  // the manual fixes, on top of whatever was chosen
  if (options.reverse) to = reversed(to);
  if (bothClosed && Math.round(options.startOffset) !== 0) to = rotate(to, Math.round(options.startOffset));
  return { from, to, closed: a.closed || b.closed, rotation, reversed: flipped !== options.reverse };
}

const cache = new Map<string, MatchedPair[] | null>();
const CACHE_SIZE = 200;

/** The matched sub-path pairs of two paths, or null when either doesn't parse. Cached: a morph asks for the same pair every frame. */
export function matchPaths(from: string, to: string, options: Partial<MorphOptions> = {}): MatchedPair[] | null {
  const o: MorphOptions = { ...MORPH_DEFAULTS, ...options };
  const key = `${o.match}|${Math.round(o.startOffset)}|${o.reverse ? 1 : 0}|${from}|${to}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const a = pathDataToBez(from);
  const b = pathDataToBez(to);
  let result: MatchedPair[] | null = null;
  if (a && b) {
    const subsA = subsOf(a);
    const subsB = subsOf(b);
    if (subsA.length > 0 && subsB.length > 0) {
      result = [];
      for (let i = 0; i < Math.max(subsA.length, subsB.length); i++) {
        const sa = subsA[i];
        const sb = subsB[i];
        result.push(pair(sa ?? pointLike(sb), sb ?? pointLike(sa), o));
      }
    }
  }
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  cache.set(key, result);
  return result;
}

const fmt = (n: number): string => String(Math.round(n * 1000) / 1000);
const xy = (p: Pt): string => `${fmt(p.x)} ${fmt(p.y)}`;

/** The pairs at `t` as path data: one `M … C … [Z]` per sub-path. */
export function serialiseMatched(pairs: readonly MatchedPair[], t: number): string {
  const parts: string[] = [];
  for (const p of pairs) {
    let d = `M${xy(lerp(p.from[0].p0, p.to[0].p0, t))}`;
    for (let i = 0; i < p.from.length; i++) d += ` C${xy(lerp(p.from[i].p1, p.to[i].p1, t))} ${xy(lerp(p.from[i].p2, p.to[i].p2, t))} ${xy(lerp(p.from[i].p3, p.to[i].p3, t))}`;
    if (p.closed) d += " Z";
    parts.push(d);
  }
  return parts.join(" ");
}

/**
 * `from` morphed into `to` at `t` (clamped to 0..1). A path that doesn't parse can't be morphed: the result is then
 * `from` until the end and `to` at the end, as for any value that can't be mixed.
 */
export function morphPath(from: string, to: string, t: number, options: Partial<MorphOptions> = {}): string {
  const u = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const pairs = matchPaths(from, to, options);
  if (!pairs) return u < 1 ? from : to;
  return serialiseMatched(pairs, u);
}

/** How many sub-paths a path has (0 when it doesn't parse). */
export function subpathCount(d: string): number {
  const path = pathDataToBez(d);
  return path ? splitSubpaths(path).filter((sp) => sp.els.length > 0).length : 0;
}

/** The sub-paths of a path as separate path data strings, in order (empty when it doesn't parse). */
export function subpathData(d: string): string[] {
  const path = pathDataToBez(d);
  return path ? splitSubpaths(path).map((sp) => sp.toSvg(3)) : [];
}
