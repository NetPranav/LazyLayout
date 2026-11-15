/**
 * ============================================================================
 * STAGE 5 · PHASE 206 — MESH DEFORMATION & WEIGHTS
 * ============================================================================
 * Automatic grid triangulation with density control, heat-based bone weight
 * assignment, radial brush painting, Laplacian smoothing, and crisp vector /
 * raster LBS deformation. Every vertex's weights strictly sum to 1.0.
 * ============================================================================
 */

import {
  type BindMatrixEntry,
  type BoneWeightInfluence,
  type Point2D,
  type RigDefinition,
  type VertexWeightList,
  type WorldBoneTransform,
  evaluateSkinnedPoint,
  normalizeVertexWeights,
} from "./rigModel";

export interface MeshBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DeformableMesh2D {
  readonly vertices: readonly Point2D[];
  readonly uvs: readonly { readonly u: number; readonly v: number }[];
  readonly triangles: readonly [number, number, number][];
  readonly cols: number;
  readonly rows: number;
}

export interface WeightBrushStroke {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly boneId: string;
  readonly strength: number;
}

export interface VectorPathSegment {
  readonly cmd: "M" | "L" | "C" | "Z";
  readonly points: readonly Point2D[];
}

/** Triangulate a rectangular bounds box with configurable subdivision density. */
export function triangulateLayerMesh(
  bounds: MeshBounds,
  density = 4,
): DeformableMesh2D {
  const steps = Math.max(1, Math.min(32, Math.round(density)));
  const cols = steps + 1;
  const rows = steps + 1;
  const vertices: Point2D[] = [];
  const uvs: { u: number; v: number }[] = [];

  for (let r = 0; r < rows; r++) {
    const v = r / steps;
    const y = bounds.y + v * bounds.height;
    for (let c = 0; c < cols; c++) {
      const u = c / steps;
      const x = bounds.x + u * bounds.width;
      vertices.push({ x, y });
      uvs.push({ u, v });
    }
  }

  const triangles: [number, number, number][] = [];
  for (let r = 0; r < steps; r++) {
    for (let c = 0; c < steps; c++) {
      const i0 = r * cols + c;
      const i1 = i0 + 1;
      const i2 = i0 + cols;
      const i3 = i2 + 1;
      triangles.push([i0, i1, i3]);
      triangles.push([i0, i3, i2]);
    }
  }

  return { vertices, uvs, triangles, cols, rows };
}

function distToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq <= 1e-10) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / lenSq));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/**
 * Automatically assign normalized bone weights per vertex based on inverse-distance
 * proximity to each bone segment in rest pose (`sum(weights) === 1.0`).
 */
export function computeAutomaticBoneWeights(
  vertices: readonly Point2D[],
  rig: RigDefinition,
  restWorldTransforms: Record<string, WorldBoneTransform>,
  maxInfluences = 4,
): BoneWeightInfluence[][] {
  return vertices.map((v) => {
    if (rig.bones.length === 0) return [];
    const scored = rig.bones
      .map((bone) => {
        const wt = restWorldTransforms[bone.id];
        if (!wt) return null;
        const d = distToSegment(v, wt.head, wt.tail);
        return {
          boneId: bone.id,
          weight: 1 / (d * d + 25),
        };
      })
      .filter((x): x is { boneId: string; weight: number } => x !== null)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, Math.max(1, maxInfluences));
    return normalizeVertexWeights(scored);
  });
}

/**
 * Paint weight influence for `stroke.boneId` within `stroke.radius`, preserving
 * exact partition of unity (`sum === 1.0`) for every vertex.
 */
export function paintVertexWeightsWithBrush(
  vertices: readonly Point2D[],
  weights: readonly VertexWeightList[],
  stroke: WeightBrushStroke,
): BoneWeightInfluence[][] {
  const strength = Math.max(0, Math.min(1, stroke.strength));
  const radius = Math.max(1e-3, stroke.radius);

  return vertices.map((pt, idx) => {
    const current = normalizeVertexWeights(weights[idx] ?? []);
    const d = Math.hypot(pt.x - stroke.x, pt.y - stroke.y);
    if (d >= radius || current.length === 0) {
      return current;
    }

    const falloff = strength * (1 - d / radius);
    const existing = current.find((w) => w.boneId === stroke.boneId)?.weight ?? 0;
    const nextTarget = existing + (1 - existing) * falloff;
    const remainingTarget = Math.max(0, 1 - nextTarget);

    const others = current.filter((w) => w.boneId !== stroke.boneId);
    const othersSum = others.reduce((s, o) => s + o.weight, 0);

    const updated: BoneWeightInfluence[] = [{ boneId: stroke.boneId, weight: nextTarget }];
    if (others.length > 0 && othersSum > 1e-12) {
      for (const o of others) {
        updated.push({ boneId: o.boneId, weight: (o.weight / othersSum) * remainingTarget });
      }
    }
    return normalizeVertexWeights(updated);
  });
}

/** Smooth weights across triangle mesh neighbors while keeping sum === 1.0. */
export function smoothVertexWeights(
  mesh: DeformableMesh2D,
  weights: readonly VertexWeightList[],
  iterations = 1,
  strength = 0.5,
): BoneWeightInfluence[][] {
  const n = mesh.vertices.length;
  const neighbors: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  for (const [a, b, c] of mesh.triangles) {
    neighbors[a]?.add(b).add(c);
    neighbors[b]?.add(a).add(c);
    neighbors[c]?.add(a).add(b);
  }

  let current = weights.map((w) => normalizeVertexWeights(w));
  const mix = Math.max(0, Math.min(1, strength));

  for (let iter = 0; iter < Math.max(0, iterations); iter++) {
    const next: BoneWeightInfluence[][] = new Array(n);
    for (let i = 0; i < n; i++) {
      const nbrs = Array.from(neighbors[i]);
      if (nbrs.length === 0) {
        next[i] = current[i];
        continue;
      }
      const boneAcc = new Map<string, number>();
      for (const w of current[i]) {
        boneAcc.set(w.boneId, w.weight * (1 - mix));
      }
      for (const j of nbrs) {
        for (const w of current[j]) {
          boneAcc.set(w.boneId, (boneAcc.get(w.boneId) ?? 0) + (w.weight * mix) / nbrs.length);
        }
      }
      const merged = Array.from(boneAcc.entries()).map(([boneId, weight]) => ({ boneId, weight }));
      next[i] = normalizeVertexWeights(merged);
    }
    current = next;
  }
  return current;
}

/** Deform all mesh vertices using Linear-Blend Skinning. */
export function deformMeshLBS(
  mesh: DeformableMesh2D,
  vertexWeights: readonly VertexWeightList[],
  bindMatrices: Record<string, BindMatrixEntry>,
  worldTransforms: Record<string, WorldBoneTransform>,
): Point2D[] {
  return mesh.vertices.map((pt, idx) =>
    evaluateSkinnedPoint(pt, vertexWeights[idx] ?? [], bindMatrices, worldTransforms),
  );
}

/** Deform a crisp vector path (M/L/C/Z segments) via Linear-Blend Skinning on anchor/control points. */
export function deformVectorPathLBS(
  segments: readonly VectorPathSegment[],
  rig: RigDefinition,
  restWorldTransforms: Record<string, WorldBoneTransform>,
  bindMatrices: Record<string, BindMatrixEntry>,
  worldTransforms: Record<string, WorldBoneTransform>,
): string {
  const allPts: Point2D[] = [];
  for (const seg of segments) allPts.push(...seg.points);
  const autoWeights = computeAutomaticBoneWeights(allPts, rig, restWorldTransforms, 4);

  let cursor = 0;
  const parts: string[] = [];
  for (const seg of segments) {
    if (seg.cmd === "Z") {
      parts.push("Z");
      continue;
    }
    const deformedPts = seg.points.map((pt) => {
      const w = autoWeights[cursor++] ?? [];
      const d = evaluateSkinnedPoint(pt, w, bindMatrices, worldTransforms);
      return `${d.x.toFixed(2)} ${d.y.toFixed(2)}`;
    });
    parts.push(`${seg.cmd} ${deformedPts.join(" ")}`);
  }
  return parts.join(" ");
}
