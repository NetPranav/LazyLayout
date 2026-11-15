/**
 * @file fractureAndShatter.ts
 * @module core/physics2d/fractureAndShatter
 * @description Phase 186: Deterministic Voronoi, strip, grid, and drawn-tear-line
 * layer fracture with exact polygon tessellation (zero gaps/overlaps > 0.5 px),
 * rigid-body velocity launch, and spring-home reassembly.
 */

export type FracturePatternKind = "voronoi" | "strips" | "grid" | "tear_line";

export interface PolyPoint {
  readonly x: number;
  readonly y: number;
}

export interface FractureSpec {
  readonly kind: FracturePatternKind;
  readonly width: number;
  readonly height: number;
  readonly seed?: number;
  readonly pieceCount?: number;
  readonly cols?: number;
  readonly rows?: number;
  readonly stripOrientation?: "vertical" | "horizontal";
  readonly tearPoints?: readonly PolyPoint[];
  readonly impactX?: number;
  readonly impactY?: number;
  readonly radialImpulse?: number;
}

export interface FracturePiece {
  readonly id: string;
  readonly polygon: readonly PolyPoint[];
  readonly homeCentroidX: number;
  readonly homeCentroidY: number;
  readonly area: number;
  x: number;
  y: number;
  angleRad: number;
  vx: number;
  vy: number;
  angularVel: number;
}

export interface TilingCheckResult {
  readonly expectedArea: number;
  readonly sumPieceArea: number;
  readonly areaDelta: number;
  readonly maxPointOverlapCount: number;
  readonly zeroGapCount: number;
  readonly exactTiling: boolean;
}

function createRng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Signed polygon area using shoelace formula (positive for CCW polygons). */
export function polygonArea(poly: readonly PolyPoint[]): number {
  if (poly.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) * 0.5;
}

/** Centroid `(x, y)` of a non-self-intersecting polygon. */
export function polygonCentroid(poly: readonly PolyPoint[]): PolyPoint {
  if (poly.length === 0) return { x: 0, y: 0 };
  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const cross = a.x * b.y - b.x * a.y;
    signedArea += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-6) {
    const avgX = poly.reduce((s, p) => s + p.x, 0) / poly.length;
    const avgY = poly.reduce((s, p) => s + p.y, 0) / poly.length;
    return { x: avgX, y: avgY };
  }
  return { x: cx / (6 * signedArea), y: cy / (6 * signedArea) };
}

/** Sutherland-Hodgman clip `poly` against half-plane `ax + by + c <= 0`. */
function clipPolygonHalfPlane(
  poly: readonly PolyPoint[],
  a: number,
  b: number,
  c: number
): PolyPoint[] {
  if (poly.length === 0) return [];
  const out: PolyPoint[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const cur = poly[i]!;
    const prev = poly[(i + poly.length - 1) % poly.length]!;
    const dCur = a * cur.x + b * cur.y + c;
    const dPrev = a * prev.x + b * prev.y + c;
    const curIn = dCur <= 1e-6;
    const prevIn = dPrev <= 1e-6;

    if (curIn !== prevIn) {
      const denom = dPrev - dCur;
      const t = Math.abs(denom) > 1e-9 ? dPrev / denom : 0.5;
      out.push({
        x: prev.x + (cur.x - prev.x) * t,
        y: prev.y + (cur.y - prev.y) * t,
      });
    }
    if (curIn) {
      out.push(cur);
    }
  }
  return out;
}

/** Point-in-polygon ray cast for coverage verification. */
export function pointInPolygon(x: number, y: number, poly: readonly PolyPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Deterministically fracture a rectangle `(width, height)` into exact tiling pieces. */
export function generateFracturePieces(spec: FractureSpec): FracturePiece[] {
  const w = Math.max(1, spec.width);
  const h = Math.max(1, spec.height);
  const rng = createRng(spec.seed ?? 186);
  const impactX = spec.impactX ?? w * 0.5;
  const impactY = spec.impactY ?? h * 0.5;
  const radial = spec.radialImpulse ?? 180;

  const polygons: PolyPoint[][] = [];

  if (spec.kind === "strips") {
    const count = Math.max(2, spec.pieceCount ?? 8);
    const horizontal = spec.stripOrientation === "horizontal";
    for (let i = 0; i < count; i += 1) {
      if (horizontal) {
        const y0 = (i / count) * h;
        const y1 = ((i + 1) / count) * h;
        polygons.push([
          { x: 0, y: y0 },
          { x: w, y: y0 },
          { x: w, y: y1 },
          { x: 0, y: y1 },
        ]);
      } else {
        const x0 = (i / count) * w;
        const x1 = ((i + 1) / count) * w;
        polygons.push([
          { x: x0, y: 0 },
          { x: x1, y: 0 },
          { x: x1, y: h },
          { x: x0, y: h },
        ]);
      }
    }
  } else if (spec.kind === "grid") {
    const cols = Math.max(2, spec.cols ?? 4);
    const rows = Math.max(2, spec.rows ?? 3);
    for (let r = 0; r < rows; r += 1) {
      const y0 = (r / rows) * h;
      const y1 = ((r + 1) / rows) * h;
      for (let c = 0; c < cols; c += 1) {
        const x0 = (c / cols) * w;
        const x1 = ((c + 1) / cols) * w;
        polygons.push([
          { x: x0, y: y0 },
          { x: x1, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 },
        ]);
      }
    }
  } else if (spec.kind === "tear_line") {
    // Complementary left/right (or top/bottom) halves split cleanly across exact polyline vertices
    const pts =
      spec.tearPoints && spec.tearPoints.length >= 2
        ? [...spec.tearPoints]
        : [
            { x: w * 0.45, y: 0 },
            { x: w * 0.52, y: h * 0.33 },
            { x: w * 0.42, y: h * 0.67 },
            { x: w * 0.55, y: h },
          ];
    const clamped = pts.map((p, idx) => ({
      x: Math.max(1, Math.min(w - 1, p.x)),
      y: idx === 0 ? 0 : idx === pts.length - 1 ? h : Math.max(0, Math.min(h, p.y)),
    }));
    const leftPoly: PolyPoint[] = [{ x: 0, y: 0 }, ...clamped, { x: 0, y: h }];
    const rightPoly: PolyPoint[] = [{ x: w, y: 0 }, { x: w, y: h }, ...[...clamped].reverse()];
    polygons.push(leftPoly, rightPoly);
  } else {
    // Voronoi: exact half-plane bisector clipping of bounding rect for each site
    const count = Math.max(3, spec.pieceCount ?? 12);
    const sites: PolyPoint[] = [];
    for (let i = 0; i < count; i += 1) {
      sites.push({ x: (0.08 + rng() * 0.84) * w, y: (0.08 + rng() * 0.84) * h });
    }
    const baseBox: PolyPoint[] = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
    for (let i = 0; i < count; i += 1) {
      let cell = [...baseBox];
      const si = sites[i]!;
      for (let j = 0; j < count; j += 1) {
        if (i === j) continue;
        const sj = sites[j]!;
        // Half-plane closer to si than sj: (x-si)^2 <= (x-sj)^2
        // 2*(sj.x - si.x)*x + 2*(sj.y - si.y)*y + (si^2 - sj^2) <= 0
        const a = 2 * (sj.x - si.x);
        const b = 2 * (sj.y - si.y);
        const c = si.x * si.x + si.y * si.y - (sj.x * sj.x + sj.y * sj.y);
        cell = clipPolygonHalfPlane(cell, a, b, c);
        if (cell.length < 3) break;
      }
      if (cell.length >= 3 && polygonArea(cell) > 0.1) {
        polygons.push(cell);
      }
    }
  }

  return polygons.map((poly, idx) => {
    const centroid = polygonCentroid(poly);
    const dx = centroid.x - impactX;
    const dy = centroid.y - impactY;
    const dist = Math.max(8, Math.hypot(dx, dy));
    const speed = radial * (0.55 + rng() * 0.9) * (1 / (1 + dist * 0.005));
    const ux = dx / dist;
    const uy = dy / dist;
    return {
      id: `piece_${idx}`,
      polygon: poly,
      homeCentroidX: centroid.x,
      homeCentroidY: centroid.y,
      area: polygonArea(poly),
      x: centroid.x,
      y: centroid.y,
      angleRad: 0,
      vx: ux * speed + (rng() - 0.5) * 40,
      vy: uy * speed - 40,
      angularVel: (rng() - 0.5) * 6,
    };
  });
}

/** Verify pieces tile `(width, height)` cleanly with < 0.5 px area/coverage discrepancy. */
export function verifyTilingCoverage(
  pieces: readonly FracturePiece[],
  width: number,
  height: number
): TilingCheckResult {
  const expectedArea = width * height;
  const sumPieceArea = pieces.reduce((acc, p) => acc + p.area, 0);
  const areaDelta = Math.abs(sumPieceArea - expectedArea);

  let maxPointOverlapCount = 0;
  let zeroGapCount = 0;
  const cols = 15;
  const rows = 15;

  for (let r = 0; r < rows; r += 1) {
    const py = ((r + 0.5) / rows) * height;
    for (let c = 0; c < cols; c += 1) {
      const px = ((c + 0.5) / cols) * width;
      let hits = 0;
      for (const piece of pieces) {
        if (pointInPolygon(px, py, piece.polygon)) {
          hits += 1;
        }
      }
      maxPointOverlapCount = Math.max(maxPointOverlapCount, hits);
      if (hits === 0) zeroGapCount += 1;
    }
  }

  return {
    expectedArea,
    sumPieceArea,
    areaDelta,
    maxPointOverlapCount,
    zeroGapCount,
    exactTiling: areaDelta < 0.5 && maxPointOverlapCount <= 1 && zeroGapCount === 0,
  };
}

export interface FractureStepOptions {
  readonly dtSec: number;
  readonly gravityY?: number;
  readonly reassemble?: boolean;
  readonly springStiffness?: number;
  readonly damping?: number;
}

/** Advance all fractured pieces either in ballistic shatter or spring-home reassembly. */
export function stepFracturePieces(
  pieces: FracturePiece[],
  opts: FractureStepOptions
): void {
  const dt = Math.max(0, Math.min(0.05, opts.dtSec));
  if (dt <= 0) return;

  if (opts.reassemble) {
    const k = opts.springStiffness ?? 42;
    const damp = opts.damping ?? 10;
    for (const p of pieces) {
      const ax = (p.homeCentroidX - p.x) * k - p.vx * damp;
      const ay = (p.homeCentroidY - p.y) * k - p.vy * damp;
      p.vx += ax * dt;
      p.vy += ay * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const angAcc = -p.angleRad * k - p.angularVel * damp;
      p.angularVel += angAcc * dt;
      p.angleRad += p.angularVel * dt;
    }
    return;
  }

  const gy = opts.gravityY ?? 680;
  for (const p of pieces) {
    p.vy += gy * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angleRad += p.angularVel * dt;
  }
}
