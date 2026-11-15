/**
 * @file clonersAndGroupTargets.ts
 * @module core/signals/clonersAndGroupTargets
 * @description Phase 154: Grid, radial, path, scatter, and linear cloners with
 * deterministic per-piece attributes (`index`, `count`, `progress`, `home`, `random`),
 * per-clone overrides, layer tags, `Group[*]` / `tag:<name>` target resolution, and
 * DOM tier cap detection recommending GPU particles above 400 instances.
 */

export const CLONER_DOM_TIER_CAP = 400;

export type ClonerDistribution =
  | {
      readonly kind: "grid";
      readonly rows: number;
      readonly cols: number;
      readonly spacingX: number;
      readonly spacingY: number;
      readonly originX?: number;
      readonly originY?: number;
    }
  | {
      readonly kind: "radial";
      readonly count: number;
      readonly radius: number;
      readonly centerX?: number;
      readonly centerY?: number;
      readonly startAngleDeg?: number;
      readonly endAngleDeg?: number;
      readonly alignToAngle?: boolean;
    }
  | {
      readonly kind: "path";
      readonly count: number;
      readonly points: readonly { readonly x: number; readonly y: number }[];
      readonly alignToTangent?: boolean;
    }
  | {
      readonly kind: "scatter";
      readonly count: number;
      readonly width: number;
      readonly height: number;
      readonly originX?: number;
      readonly originY?: number;
      readonly seed: number;
    }
  | {
      readonly kind: "linear";
      readonly count: number;
      readonly stepX: number;
      readonly stepY: number;
      readonly originX?: number;
      readonly originY?: number;
    };

export interface ClonePieceInstance {
  readonly id: string;
  readonly clonerId: string;
  readonly index: number;
  readonly count: number;
  readonly progress: number;
  readonly homeX: number;
  readonly homeY: number;
  readonly rotationDeg: number;
  readonly random: number;
  readonly row: number;
  readonly col: number;
  readonly overrides: Readonly<Record<string, number | string | boolean>>;
}

export interface ClonerGenerationResult {
  readonly clonerId: string;
  readonly instances: readonly ClonePieceInstance[];
  readonly totalCount: number;
  readonly exceedsDomTierCap: boolean;
  readonly recommendedBackend: "dom" | "gpu-particles";
}

export interface TaggableLayerLike {
  readonly id: string;
  readonly parentId?: string | null;
  readonly tags?: readonly string[];
}

/** Deterministic 32-bit seeded PRNG matching export bundles identically. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function samplePolyline(
  points: readonly { readonly x: number; readonly y: number }[],
  progress: number,
): { readonly x: number; readonly y: number; readonly angleDeg: number } {
  if (points.length === 0) return { x: 0, y: 0, angleDeg: 0 };
  if (points.length === 1) return { x: points[0]!.x, y: points[0]!.y, angleDeg: 0 };

  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segLengths.push(len);
    total += len;
  }
  if (total <= 1e-9) {
    return { x: points[0]!.x, y: points[0]!.y, angleDeg: 0 };
  }

  const targetDist = Math.min(total, Math.max(0, progress * total));
  let acc = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const len = segLengths[i]!;
    const a = points[i]!;
    const b = points[i + 1]!;
    if (acc + len >= targetDist || i === segLengths.length - 1) {
      const localT = len <= 1e-9 ? 0 : Math.min(1, Math.max(0, (targetDist - acc) / len));
      return {
        x: a.x + (b.x - a.x) * localT,
        y: a.y + (b.y - a.y) * localT,
        angleDeg: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      };
    }
    acc += len;
  }
  const last = points[points.length - 1]!;
  return { x: last.x, y: last.y, angleDeg: 0 };
}

/**
 * Generates clone instances with identical stage and export coordinates, per-piece
 * attributes, per-clone overrides, and DOM tier cap check (> 400 recommends Phase 183 GPU particles).
 */
export function generateClonerInstances(
  clonerId: string,
  distribution: ClonerDistribution,
  perCloneOverrides: Readonly<Record<number, Readonly<Record<string, number | string | boolean>>>> = {},
): ClonerGenerationResult {
  const rng = seededRandom(distribution.kind === "scatter" ? distribution.seed : 1337);
  const instances: ClonePieceInstance[] = [];

  if (distribution.kind === "grid") {
    const rows = Math.max(1, Math.floor(distribution.rows));
    const cols = Math.max(1, Math.floor(distribution.cols));
    const totalCount = rows * cols;
    const ox = distribution.originX ?? 0;
    const oy = distribution.originY ?? 0;
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        instances.push({
          id: `${clonerId}::clone:${idx}`,
          clonerId,
          index: idx,
          count: totalCount,
          progress: totalCount > 1 ? idx / (totalCount - 1) : 0,
          homeX: ox + c * distribution.spacingX,
          homeY: oy + r * distribution.spacingY,
          rotationDeg: 0,
          random: rng(),
          row: r,
          col: c,
          overrides: perCloneOverrides[idx] ?? {},
        });
        idx++;
      }
    }
  } else if (distribution.kind === "radial") {
    const count = Math.max(1, Math.floor(distribution.count));
    const cx = distribution.centerX ?? 0;
    const cy = distribution.centerY ?? 0;
    const start = distribution.startAngleDeg ?? 0;
    const end = distribution.endAngleDeg ?? 360;
    const span = end - start;
    for (let i = 0; i < count; i++) {
      const denom = Math.abs(span % 360) < 1e-6 ? count : Math.max(1, count - 1);
      const angleDeg = start + (span * i) / denom;
      const rad = (angleDeg * Math.PI) / 180;
      instances.push({
        id: `${clonerId}::clone:${i}`,
        clonerId,
        index: i,
        count,
        progress: count > 1 ? i / (count - 1) : 0,
        homeX: cx + Math.cos(rad) * distribution.radius,
        homeY: cy + Math.sin(rad) * distribution.radius,
        rotationDeg: distribution.alignToAngle ? angleDeg : 0,
        random: rng(),
        row: 0,
        col: i,
        overrides: perCloneOverrides[i] ?? {},
      });
    }
  } else if (distribution.kind === "path") {
    const count = Math.max(1, Math.floor(distribution.count));
    for (let i = 0; i < count; i++) {
      const progress = count > 1 ? i / (count - 1) : 0;
      const sample = samplePolyline(distribution.points, progress);
      instances.push({
        id: `${clonerId}::clone:${i}`,
        clonerId,
        index: i,
        count,
        progress,
        homeX: sample.x,
        homeY: sample.y,
        rotationDeg: distribution.alignToTangent ? sample.angleDeg : 0,
        random: rng(),
        row: 0,
        col: i,
        overrides: perCloneOverrides[i] ?? {},
      });
    }
  } else if (distribution.kind === "scatter") {
    const count = Math.max(1, Math.floor(distribution.count));
    const ox = distribution.originX ?? 0;
    const oy = distribution.originY ?? 0;
    for (let i = 0; i < count; i++) {
      const rx = rng();
      const ry = rng();
      const rr = rng();
      instances.push({
        id: `${clonerId}::clone:${i}`,
        clonerId,
        index: i,
        count,
        progress: count > 1 ? i / (count - 1) : 0,
        homeX: ox + rx * distribution.width,
        homeY: oy + ry * distribution.height,
        rotationDeg: 0,
        random: rr,
        row: 0,
        col: i,
        overrides: perCloneOverrides[i] ?? {},
      });
    }
  } else {
    const count = Math.max(1, Math.floor(distribution.count));
    const ox = distribution.originX ?? 0;
    const oy = distribution.originY ?? 0;
    for (let i = 0; i < count; i++) {
      instances.push({
        id: `${clonerId}::clone:${i}`,
        clonerId,
        index: i,
        count,
        progress: count > 1 ? i / (count - 1) : 0,
        homeX: ox + i * distribution.stepX,
        homeY: oy + i * distribution.stepY,
        rotationDeg: 0,
        random: rng(),
        row: 0,
        col: i,
        overrides: perCloneOverrides[i] ?? {},
      });
    }
  }

  const exceedsDomTierCap = instances.length > CLONER_DOM_TIER_CAP;
  return {
    clonerId,
    instances,
    totalCount: instances.length,
    exceedsDomTierCap,
    recommendedBackend: exceedsDomTierCap ? "gpu-particles" : "dom",
  };
}

/**
 * Resolves `Group[*]` (or `<groupId>[*]`), `tag:<name>`, or single-layer targets
 * into concrete ordered layer IDs.
 */
export function resolveGroupOrTagTargets(
  selector: string,
  layers: readonly TaggableLayerLike[],
): readonly string[] {
  const trimmed = selector.trim();
  if (trimmed.startsWith("tag:")) {
    const tag = trimmed.slice(4).trim();
    if (!tag) return [];
    return layers.filter((layer) => layer.tags?.includes(tag)).map((layer) => layer.id);
  }

  const groupWildcard = /^([A-Za-z0-9_-]+)\[\*\]$/.exec(trimmed);
  if (groupWildcard) {
    const groupId = groupWildcard[1]!;
    if (groupId === "Group") {
      return layers.filter((layer) => layer.parentId != null).map((layer) => layer.id);
    }
    return layers.filter((layer) => layer.parentId === groupId).map((layer) => layer.id);
  }

  return layers.some((l) => l.id === trimmed) ? [trimmed] : [];
}
