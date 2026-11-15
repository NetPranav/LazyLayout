/**
 * @file fieldsAndEffectors.ts
 * @module core/signals/fieldsAndEffectors
 * @description Phase 157: Spatial Fields (`circle`, `box`, `capsule`, `ownShape`,
 * `pathStroke`, `linear`, `noise`) with inner/outer radius & falloff + Effectors
 * (`keepOut`, `push`, `attract`, `swirl`, `transform`, `style`, `lookAt`, `jitter`)
 * with spring-home dynamics, hard `keepOut` geometric constraint, gizmos, and weight heatmaps.
 */

export type FalloffCurve = "linear" | "smoothstep" | "gaussian" | "hard";

export interface FieldPoint2D {
  readonly x: number;
  readonly y: number;
}

export type FieldSpec =
  | {
      readonly id: string;
      readonly kind: "circle";
      readonly cx: number;
      readonly cy: number;
      readonly innerRadius: number;
      readonly outerRadius: number;
      readonly falloff?: FalloffCurve;
    }
  | {
      readonly id: string;
      readonly kind: "box";
      readonly cx: number;
      readonly cy: number;
      readonly halfWidth: number;
      readonly halfHeight: number;
      readonly innerRadius: number;
      readonly outerRadius: number;
      readonly falloff?: FalloffCurve;
    }
  | {
      readonly id: string;
      readonly kind: "capsule";
      readonly ax: number;
      readonly ay: number;
      readonly bx: number;
      readonly by: number;
      readonly innerRadius: number;
      readonly outerRadius: number;
      readonly falloff?: FalloffCurve;
    }
  | {
      readonly id: string;
      readonly kind: "pathStroke";
      readonly points: readonly FieldPoint2D[];
      readonly innerRadius: number;
      readonly outerRadius: number;
      readonly falloff?: FalloffCurve;
    }
  | {
      readonly id: string;
      readonly kind: "ownShape";
      readonly polygon: readonly FieldPoint2D[];
      readonly innerRadius: number;
      readonly outerRadius: number;
      readonly falloff?: FalloffCurve;
    }
  | {
      readonly id: string;
      readonly kind: "linear";
      readonly originX: number;
      readonly originY: number;
      readonly dirX: number;
      readonly dirY: number;
      readonly innerDistance: number;
      readonly outerDistance: number;
      readonly falloff?: FalloffCurve;
    }
  | {
      readonly id: string;
      readonly kind: "noise";
      readonly frequency: number;
      readonly seed: number;
      readonly offsetX?: number;
      readonly offsetY?: number;
    };

export interface FieldSample {
  readonly weight: number;
  readonly distance: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly insideInner: boolean;
}

export type EffectorKind =
  | "keepOut"
  | "push"
  | "attract"
  | "swirl"
  | "transform"
  | "style"
  | "lookAt"
  | "jitter";

export interface EffectorSpec {
  readonly id: string;
  readonly fieldId: string;
  readonly kind: EffectorKind;
  readonly strength: number;
  readonly springStiffness?: number;
  readonly springDamping?: number;
  readonly blendMode?: "add" | "max" | "replace";
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly rotateDeg?: number;
  readonly scaleDelta?: number;
  readonly opacityDelta?: number;
  readonly jitterPx?: number;
  readonly jitterSeed?: number;
}

export interface KineticPieceInput {
  readonly id: string;
  readonly homeX: number;
  readonly homeY: number;
  readonly radius?: number;
}

export interface KineticPieceState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly rotateDeg: number;
  readonly scale: number;
  readonly opacity: number;
}

export interface FieldHeatmapCell {
  readonly row: number;
  readonly col: number;
  readonly x: number;
  readonly y: number;
  readonly weight: number;
}

function hash2D(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function evalFalloff(dist: number, inner: number, outer: number, curve: FalloffCurve): number {
  if (dist <= inner) return 1;
  if (curve === "hard") return 0;
  if (dist >= outer || outer <= inner + 1e-6) return 0;
  const u = (dist - inner) / (outer - inner);
  if (curve === "linear") return 1 - u;
  if (curve === "smoothstep") return 1 - u * u * (3 - 2 * u);
  // gaussian
  return Math.exp(-u * u * 4.5);
}

function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { readonly x: number; readonly y: number; readonly dist: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq <= 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  return { x: cx, y: cy, dist: Math.hypot(px - cx, py - cy) };
}

function sampleSegmentList(
  points: readonly FieldPoint2D[],
  closed: boolean,
  px: number,
  py: number,
): { readonly dist: number; readonly nx: number; readonly ny: number } {
  if (points.length === 0) return { dist: Infinity, nx: 1, ny: 0 };
  if (points.length === 1) {
    const dx = px - points[0]!.x;
    const dy = py - points[0]!.y;
    const d = Math.hypot(dx, dy);
    return { dist: d, nx: d > 1e-6 ? dx / d : 1, ny: d > 1e-6 ? dy / d : 0 };
  }

  let best = { x: points[0]!.x, y: points[0]!.y, dist: Infinity };
  const limit = closed ? points.length : points.length - 1;
  for (let i = 0; i < limit; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const cand = closestPointOnSegment(px, py, a.x, a.y, b.x, b.y);
    if (cand.dist < best.dist) best = cand;
  }

  let inside = false;
  if (closed && points.length >= 3) {
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i]!.x;
      const yi = points[i]!.y;
      const xj = points[j]!.x;
      const yj = points[j]!.y;
      const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
  }

  const dx = px - best.x;
  const dy = py - best.y;
  const d = Math.hypot(dx, dy);
  const nx = d > 1e-6 ? dx / d : 1;
  const ny = d > 1e-6 ? dy / d : 0;
  return { dist: inside ? 0 : best.dist, nx: inside ? -nx : nx, ny: inside ? -ny : ny };
}

/**
 * Evaluates a field weight `[0..1]`, surface distance, outward unit normal, and whether
 * `(x, y)` lies inside `innerRadius`.
 */
export function sampleFieldWeight(field: FieldSpec, x: number, y: number): FieldSample {
  if (field.kind === "noise") {
    const gx = Math.floor((x + (field.offsetX ?? 0)) * field.frequency);
    const gy = Math.floor((y + (field.offsetY ?? 0)) * field.frequency);
    const w = hash2D(gx, gy, field.seed);
    return { weight: w, distance: 0, normalX: Math.cos(w * Math.PI * 2), normalY: Math.sin(w * Math.PI * 2), insideInner: false };
  }

  const curve = field.falloff ?? "smoothstep";

  if (field.kind === "circle") {
    const dx = x - field.cx;
    const dy = y - field.cy;
    const dist = Math.hypot(dx, dy);
    const nx = dist > 1e-6 ? dx / dist : 1;
    const ny = dist > 1e-6 ? dy / dist : 0;
    return {
      weight: evalFalloff(dist, field.innerRadius, field.outerRadius, curve),
      distance: dist,
      normalX: nx,
      normalY: ny,
      insideInner: dist < field.innerRadius,
    };
  }

  if (field.kind === "box") {
    const dx = x - field.cx;
    const dy = y - field.cy;
    const qx = Math.abs(dx) - field.halfWidth;
    const qy = Math.abs(dy) - field.halfHeight;
    const outsideDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
    const insideDist = Math.min(Math.max(qx, qy), 0);
    const signedDist = Math.max(0, outsideDist + insideDist);
    const nx = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) || 1 : 0;
    const ny = Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) || 1 : 0;
    return {
      weight: evalFalloff(signedDist, field.innerRadius, field.outerRadius, curve),
      distance: signedDist,
      normalX: nx,
      normalY: ny,
      insideInner: signedDist <= field.innerRadius && (outsideDist === 0 || signedDist < field.innerRadius),
    };
  }

  if (field.kind === "capsule") {
    const c = closestPointOnSegment(x, y, field.ax, field.ay, field.bx, field.by);
    const dx = x - c.x;
    const dy = y - c.y;
    const nx = c.dist > 1e-6 ? dx / c.dist : 1;
    const ny = c.dist > 1e-6 ? dy / c.dist : 0;
    return {
      weight: evalFalloff(c.dist, field.innerRadius, field.outerRadius, curve),
      distance: c.dist,
      normalX: nx,
      normalY: ny,
      insideInner: c.dist < field.innerRadius,
    };
  }

  if (field.kind === "pathStroke" || field.kind === "ownShape") {
    const pts = field.kind === "pathStroke" ? field.points : field.polygon;
    const res = sampleSegmentList(pts, field.kind === "ownShape", x, y);
    return {
      weight: evalFalloff(res.dist, field.innerRadius, field.outerRadius, curve),
      distance: res.dist,
      normalX: res.nx,
      normalY: res.ny,
      insideInner: res.dist < field.innerRadius,
    };
  }

  // linear
  const len = Math.max(1e-6, Math.hypot(field.dirX, field.dirY));
  const ux = field.dirX / len;
  const uy = field.dirY / len;
  const proj = (x - field.originX) * ux + (y - field.originY) * uy;
  const dist = Math.max(0, proj);
  return {
    weight: evalFalloff(dist, field.innerDistance, field.outerDistance, curve),
    distance: dist,
    normalX: ux,
    normalY: uy,
    insideInner: dist < field.innerDistance,
  };
}

/** Generates a 2D weight grid heatmap for gizmo inspection. */
export function buildFieldHeatmap(
  field: FieldSpec,
  bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  cols: number,
  rows: number,
): readonly FieldHeatmapCell[] {
  const safeCols = Math.max(1, cols);
  const safeRows = Math.max(1, rows);
  const cells: FieldHeatmapCell[] = [];
  for (let r = 0; r < safeRows; r++) {
    const y = bounds.y + ((r + 0.5) / safeRows) * bounds.height;
    for (let c = 0; c < safeCols; c++) {
      const x = bounds.x + ((c + 0.5) / safeCols) * bounds.width;
      cells.push({
        row: r,
        col: c,
        x,
        y,
        weight: sampleFieldWeight(field, x, y).weight,
      });
    }
  }
  return cells;
}

/** Enforces hard `keepOut` boundary so no piece ever lands inside `field.innerRadius`. */
function enforceKeepOutConstraint(
  field: FieldSpec,
  px: number,
  py: number,
  pieceRadius = 0,
): { readonly x: number; readonly y: number } {
  if (field.kind === "circle") {
    const minDist = field.innerRadius + pieceRadius;
    const dx = px - field.cx;
    const dy = py - field.cy;
    const d = Math.hypot(dx, dy);
    if (d < minDist) {
      const nx = d > 1e-6 ? dx / d : 1;
      const ny = d > 1e-6 ? dy / d : 0;
      return { x: field.cx + nx * minDist, y: field.cy + ny * minDist };
    }
  } else if (field.kind === "capsule") {
    const c = closestPointOnSegment(px, py, field.ax, field.ay, field.bx, field.by);
    const minDist = field.innerRadius + pieceRadius;
    if (c.dist < minDist) {
      const dx = px - c.x;
      const dy = py - c.y;
      const nx = c.dist > 1e-6 ? dx / c.dist : 1;
      const ny = c.dist > 1e-6 ? dy / c.dist : 0;
      return { x: c.x + nx * minDist, y: c.y + ny * minDist };
    }
  } else {
    const sample = sampleFieldWeight(field, px, py);
    if ("innerRadius" in field && sample.distance < field.innerRadius + pieceRadius) {
      const pushDist = field.innerRadius + pieceRadius - sample.distance;
      return { x: px + sample.normalX * pushDist, y: py + sample.normalY * pushDist };
    }
  }
  return { x: px, y: py };
}

/**
 * Steps all kinetic pieces one frame under active fields and effectors, applying
 * spring-home recovery and a final hard `keepOut` projection pass.
 */
export function stepEffectorsFrame(
  pieces: readonly KineticPieceInput[],
  fields: readonly FieldSpec[],
  effectors: readonly EffectorSpec[],
  prevStates: Readonly<Record<string, KineticPieceState>>,
  dtSec: number,
): Record<string, KineticPieceState> {
  const dt = Math.max(1 / 240, Math.min(0.1, Number.isFinite(dtSec) ? dtSec : 1 / 60));
  const fieldById = new Map<string, FieldSpec>(fields.map((f) => [f.id, f]));
  const nextStates: Record<string, KineticPieceState> = {};

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]!;
    const prev = prevStates[piece.id] ?? {
      id: piece.id,
      x: piece.homeX,
      y: piece.homeY,
      vx: 0,
      vy: 0,
      rotateDeg: 0,
      scale: 1,
      opacity: 1,
    };

    let targetX = piece.homeX;
    let targetY = piece.homeY;
    let targetRotate = 0;
    let targetScale = 1;
    let targetOpacity = 1;
    let stiffness = 180;
    let damping = 22;

    for (const eff of effectors) {
      const field = fieldById.get(eff.fieldId);
      if (!field) continue;
      stiffness = eff.springStiffness ?? stiffness;
      damping = eff.springDamping ?? damping;

      const sample = sampleFieldWeight(field, piece.homeX, piece.homeY);
      const w = sample.weight * eff.strength;
      if (eff.kind === "keepOut") {
        const outerPushed = w > 0 ? { x: targetX + sample.normalX * w * 24, y: targetY + sample.normalY * w * 24 } : { x: targetX, y: targetY };
        targetX = outerPushed.x;
        targetY = outerPushed.y;
      } else if (eff.kind === "push") {
        targetX += sample.normalX * w * 60;
        targetY += sample.normalY * w * 60;
      } else if (eff.kind === "attract") {
        targetX -= sample.normalX * Math.min(sample.distance, w * 60);
        targetY -= sample.normalY * Math.min(sample.distance, w * 60);
      } else if (eff.kind === "swirl") {
        const tx = -sample.normalY;
        const ty = sample.normalX;
        targetX += tx * w * 48;
        targetY += ty * w * 48;
      } else if (eff.kind === "transform") {
        targetX += (eff.offsetX ?? 0) * w;
        targetY += (eff.offsetY ?? 0) * w;
        targetRotate += (eff.rotateDeg ?? 0) * w;
        targetScale += (eff.scaleDelta ?? 0) * w;
      } else if (eff.kind === "style") {
        targetOpacity = Math.min(1, Math.max(0, targetOpacity + (eff.opacityDelta ?? 0) * w));
      } else if (eff.kind === "lookAt") {
        targetRotate = (Math.atan2(-sample.normalY, -sample.normalX) * 180) / Math.PI * Math.min(1, sample.weight);
      } else if (eff.kind === "jitter") {
        const jMag = (eff.jitterPx ?? 10) * w;
        const angle = hash2D(i + 1, Math.round(prev.x), eff.jitterSeed ?? 13) * Math.PI * 2;
        targetX += Math.cos(angle) * jMag;
        targetY += Math.sin(angle) * jMag;
      }
    }

    // Spring-home integration
    const ax = (targetX - prev.x) * stiffness - prev.vx * damping;
    const ay = (targetY - prev.y) * stiffness - prev.vy * damping;
    const nextVx = prev.vx + ax * dt;
    const nextVy = prev.vy + ay * dt;
    let nextX = prev.x + nextVx * dt;
    let nextY = prev.y + nextVy * dt;

    // Hard Keep-Out projection pass guarantees zero letters ever inside innerRadius
    for (const eff of effectors) {
      if (eff.kind !== "keepOut") continue;
      const field = fieldById.get(eff.fieldId);
      if (!field) continue;
      const clamped = enforceKeepOutConstraint(field, nextX, nextY, piece.radius ?? 0);
      nextX = clamped.x;
      nextY = clamped.y;
    }

    nextStates[piece.id] = {
      id: piece.id,
      x: nextX,
      y: nextY,
      vx: nextVx,
      vy: nextVy,
      rotateDeg: targetRotate,
      scale: targetScale,
      opacity: targetOpacity,
    };
  }

  return nextStates;
}
