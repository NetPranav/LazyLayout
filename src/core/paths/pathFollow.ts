/**
 * ROADMAP Phase 86: a layer travelling along a path at constant speed.
 *
 * A path's own parameter runs fast through long curves and slowly through short ones, so a layer moved by it would
 * speed up and slow down. Here the path is measured: every segment is cut into short straight pieces, their lengths are
 * added up, and a position is asked for as a share of the whole length (0 at the start, 1 at the end). Equal steps of
 * that share are equal distances, whatever the shape. The direction at a point is the direction of the piece it is on,
 * which is what "turn along the path" follows.
 *
 * Pure: no DOM (`getPointAtLength` would give a slightly different answer in each browser), so the stage, the export
 * and the tests agree to the last digit.
 */
import { splitSubpaths, type Pt, type Segment } from "../geometry/bezpath";
import { pathDataToBez } from "./bezBridge";

/** Straight pieces per curved segment: the error on a quarter circle of radius 100 is under 0.03 px. */
const PIECES = 24;

export interface PathSampler {
  /** The path's whole length. */
  length: number;
  /** Whether the path ends where it starts (a share past 1 then goes round again). */
  closed: boolean;
  /** The point at a share of the length, and the direction of travel there in degrees (0 is right, 90 is down). */
  at(share: number): { x: number; y: number; angle: number };
}

function pointOn(s: Segment, u: number): Pt {
  const m = 1 - u;
  if (s.kind === "line") return { x: s.p0.x + (s.p1.x - s.p0.x) * u, y: s.p0.y + (s.p1.y - s.p0.y) * u };
  if (s.kind === "quad") return { x: m * m * s.p0.x + 2 * m * u * s.p1.x + u * u * s.p2.x, y: m * m * s.p0.y + 2 * m * u * s.p1.y + u * u * s.p2.y };
  return {
    x: m * m * m * s.p0.x + 3 * m * m * u * s.p1.x + 3 * m * u * u * s.p2.x + u * u * u * s.p3.x,
    y: m * m * m * s.p0.y + 3 * m * m * u * s.p1.y + 3 * m * u * u * s.p2.y + u * u * u * s.p3.y,
  };
}

const cache = new Map<string, PathSampler | null>();
const CACHE_SIZE = 100;

/**
 * A sampler for path data, scaled by `scaleX` and `scaleY` (a path layer's 200 x 200 drawing stretched to its frame).
 * The first sub-path is the track: a layer can't jump from one stroke to the next. Null when the path has no length.
 */
export function pathSampler(d: string, scaleX = 1, scaleY = 1): PathSampler | null {
  const key = `${scaleX}|${scaleY}|${d}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let result: PathSampler | null = null;
  const bez = pathDataToBez(d);
  const first = bez ? splitSubpaths(bez).find((sp) => sp.segments().length > 0) : undefined;
  if (first) {
    const points: Pt[] = [];
    for (const s of first.segments()) {
      const n = s.kind === "line" ? 1 : PIECES;
      if (points.length === 0) points.push(pointOn(s, 0));
      for (let i = 1; i <= n; i++) points.push(pointOn(s, i / n));
    }
    for (const p of points) {
      p.x *= scaleX;
      p.y *= scaleY;
    }
    // the distance travelled on reaching each point
    const along: number[] = [0];
    for (let i = 1; i < points.length; i++) along.push(along[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    const length = along[along.length - 1];
    if (length > 1e-9) {
      const closed = first.els.some((e) => e.t === "Z") || Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6;
      result = {
        length,
        closed,
        at(share: number) {
          let s = Number.isFinite(share) ? share : 0;
          // round a closed path as many times as asked; an open one stops at its ends
          s = closed ? s - Math.floor(s) : Math.min(1, Math.max(0, s));
          const target = s * length;
          let lo = 1;
          let hi = along.length - 1;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (along[mid] < target) lo = mid + 1;
            else hi = mid;
          }
          // skip pieces of no length (a repeated point has no direction)
          let i = lo;
          while (i < along.length - 1 && along[i] - along[i - 1] < 1e-12) i++;
          while (i > 1 && along[i] - along[i - 1] < 1e-12) i--;
          const a = points[i - 1];
          const b = points[i];
          const piece = along[i] - along[i - 1];
          const u = piece > 0 ? Math.min(1, Math.max(0, (target - along[i - 1]) / piece)) : 0;
          return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
        },
      };
    }
  }
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  cache.set(key, result);
  return result;
}

export const FOLLOW_PATHS = ["motionPath.source", "motionPath.progress", "motionPath.offset", "motionPath.autoRotate", "motionPath.rotate"] as const;

/** Whether a layer's own properties put it on a path: another layer's (`motionPath.source`) or its own (`transform.motionPath`). */
export function followsPath(properties: Readonly<Record<string, unknown>>): boolean {
  const source = properties["motionPath.source"];
  const own = properties["transform.motionPath"];
  return (typeof source === "string" && source !== "") || (typeof own === "string" && own !== "");
}

export interface FollowSettings {
  /** Share of the path travelled, 0 to 1 (`motionPath.progress` plus `motionPath.offset`). */
  share: number;
  autoRotate: boolean;
  /** Degrees added to the layer's rotation (on top of the path's direction when it turns along the path). */
  rotate: number;
}

export function followSettings(read: (path: string) => unknown): FollowSettings {
  const num = (path: string): number => {
    const v = read(path);
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };
  return { share: num("motionPath.progress") + num("motionPath.offset"), autoRotate: read("motionPath.autoRotate") === true, rotate: num("motionPath.rotate") };
}
