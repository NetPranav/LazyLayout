/**
 * Explode (Design track D19): moves each part of a model from its place outward by one progress value, with stagger. Pure: parts are
 * given as their rest positions (and an optional own axis); the generator returns each part's offset for a progress 0..1. The same
 * function serves a 3D model's parts (Lane C's import gives the parts) and 2D layers.
 *
 * Modes: `radial` (away from the centre of all parts), `axis` (along each part's own axis, or one shared axis), `path` (along a
 * polyline, each part further along by its order). At progress 0 every offset is exactly zero, so parts return to their place.
 */
export type Vec = [number, number, number];
export type ExplodeMode = "radial" | "axis" | "path";

export interface Part {
  id: string;
  /** Rest position (the part's centre). */
  at: Vec;
  /** The part's own direction for `axis` mode (need not be unit length). */
  axis?: Vec;
}

export interface ExplodeOptions {
  mode: ExplodeMode;
  /** How far a part moves at progress 1 (scene units, or px for layers). */
  distance: number;
  /** 0..1: how much of the progress range each part waits for the one before. 0 moves all together. */
  stagger?: number;
  /** `axis` mode: one axis for every part instead of each part's own. */
  axis?: Vec;
  /** `path` mode: the polyline parts travel along (offsets from their rest positions follow its shape). */
  path?: Vec[];
  /** Order parts by distance from the centre (outer first) instead of as given. */
  outerFirst?: boolean;
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec) => Math.hypot(a[0], a[1], a[2]);
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a: Vec): Vec => {
  const l = len(a);
  return l > 1e-12 ? scale(a, 1 / l) : [0, 0, 0];
};

export function centreOf(parts: readonly Part[]): Vec {
  if (parts.length === 0) return [0, 0, 0];
  const s = parts.reduce<Vec>((acc, p) => [acc[0] + p.at[0], acc[1] + p.at[1], acc[2] + p.at[2]], [0, 0, 0]);
  return scale(s, 1 / parts.length);
}

/** Smoothstep: parts ease out of place and settle. */
const ease = (t: number) => t * t * (3 - 2 * t);

/** Each part's own progress, 0..1, for a global progress (stagger spreads the start times; the last part ends at 1). */
export function partProgress(index: number, count: number, progress: number, stagger = 0): number {
  const p = Math.min(1, Math.max(0, progress));
  if (count <= 1 || stagger <= 0) return p;
  const s = Math.min(0.95, stagger);
  const span = 1 - s; // each part takes this much of the range
  const start = count > 1 ? (s * index) / (count - 1) : 0;
  return Math.min(1, Math.max(0, (p - start) / span));
}

/** A point along a polyline at a fraction of its length. */
function along(path: readonly Vec[], f: number): Vec {
  if (path.length === 0) return [0, 0, 0];
  if (path.length === 1) return path[0];
  const seg = path.slice(1).map((p, i) => len(sub(p, path[i])));
  const total = seg.reduce((a, b) => a + b, 0);
  let d = Math.min(1, Math.max(0, f)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const t = seg[i] > 0 ? Math.min(1, d / seg[i]) : 0;
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t, path[i][2] + (path[i + 1][2] - path[i][2]) * t];
    }
    d -= seg[i];
  }
  return path[path.length - 1];
}

/** Every part's offset from its rest position at `progress`. */
export function explodeOffsets(parts: readonly Part[], progress: number, o: ExplodeOptions): Map<string, Vec> {
  const out = new Map<string, Vec>();
  const c = centreOf(parts);
  const order = o.outerFirst ? [...parts].sort((a, b) => len(sub(b.at, c)) - len(sub(a.at, c))) : [...parts];
  order.forEach((part, i) => {
    const t = ease(partProgress(i, order.length, progress, o.stagger ?? 0));
    if (t === 0) {
      out.set(part.id, [0, 0, 0]);
      return;
    }
    let dir: Vec;
    if (o.mode === "radial") {
      dir = unit(sub(part.at, c));
      if (len(dir) === 0) dir = [0, 1, 0]; // a part at the centre rises
    } else if (o.mode === "axis") {
      dir = unit(o.axis ?? part.axis ?? [0, 1, 0]);
    } else {
      const path = o.path ?? [[0, 0, 0], [0, 1, 0]];
      const start = path[0];
      const p = along(path, t * (o.distance > 0 ? 1 : 0));
      out.set(part.id, scale(sub(p, start), Math.abs(o.distance) / Math.max(1e-12, pathLength(path))));
      return;
    }
    out.set(part.id, scale(dir, o.distance * t));
  });
  return out;
}

export const pathLength = (path: readonly Vec[]): number => path.slice(1).reduce((s, p, i) => s + len(sub(p, path[i])), 0);
