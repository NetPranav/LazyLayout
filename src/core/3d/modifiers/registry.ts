/**
 * ============================================================================
 * 3D MODIFIER REGISTRY (Phase 3D-030)
 * ============================================================================
 * Pure, non-destructive mesh modifiers for the LazyLayout 3D engine.
 * None of the modifier functions mutate the input buffers.
 * ============================================================================
 */

import { z } from "zod";
import type { MeshData, ModifierDefinition } from "./types";
import { valueNoise3D } from "./noise";

// ---------------------------------------------------------------------------
// Pure Geometry Helpers
// ---------------------------------------------------------------------------

/**
 * Computes per-vertex normals by accumulating face normals and normalizing.
 * Pure function: allocates and returns a new Float32Array.
 */
export function computeVertexNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const vertexCount = positions.length / 3;
  const normals = new Float32Array(positions.length);

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const ax = positions[i0 * 3];
    const ay = positions[i0 * 3 + 1];
    const az = positions[i0 * 3 + 2];

    const bx = positions[i1 * 3];
    const by = positions[i1 * 3 + 1];
    const bz = positions[i1 * 3 + 2];

    const cx = positions[i2 * 3];
    const cy = positions[i2 * 3 + 1];
    const cz = positions[i2 * 3 + 2];

    // e1 = b - a, e2 = c - a
    const e1x = bx - ax;
    const e1y = by - ay;
    const e1z = bz - az;

    const e2x = cx - ax;
    const e2y = cy - ay;
    const e2z = cz - az;

    // Cross product e1 x e2
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    normals[i0 * 3] += nx;
    normals[i0 * 3 + 1] += ny;
    normals[i0 * 3 + 2] += nz;

    normals[i1 * 3] += nx;
    normals[i1 * 3 + 1] += ny;
    normals[i1 * 3 + 2] += nz;

    normals[i2 * 3] += nx;
    normals[i2 * 3 + 1] += ny;
    normals[i2 * 3 + 2] += nz;
  }

  // Normalize
  for (let i = 0; i < vertexCount; i++) {
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-8) {
      normals[i * 3] = nx / len;
      normals[i * 3 + 1] = ny / len;
      normals[i * 3 + 2] = nz / len;
    } else {
      normals[i * 3] = 0;
      normals[i * 3 + 1] = 1;
      normals[i * 3 + 2] = 0;
    }
  }

  return normals;
}

/**
 * Clones a MeshData container with freshly allocated typed arrays.
 */
export function cloneMeshData(mesh: MeshData): MeshData {
  return {
    positions: new Float32Array(mesh.positions),
    indices: new Uint32Array(mesh.indices),
    uvs: mesh.uvs ? new Float32Array(mesh.uvs) : undefined,
    normals: mesh.normals ? new Float32Array(mesh.normals) : undefined,
  };
}

// ---------------------------------------------------------------------------
// 1. Mirror Modifier
// ---------------------------------------------------------------------------

export const MirrorParamsSchema = z.object({
  axis: z.enum(["x", "y", "z", "X", "Y", "Z"]).default("x"),
  mergeDistance: z.number().nonnegative().default(0.001),
  merge: z.boolean().default(true),
  bisect: z.boolean().default(false),
});
export type MirrorParams = z.infer<typeof MirrorParamsSchema>;

export function evaluateMirror(mesh: MeshData, rawParams: unknown): MeshData {
  const params = MirrorParamsSchema.parse(rawParams ?? {});
  const axisStr = params.axis.toLowerCase();
  const axisIdx = axisStr === "y" ? 1 : axisStr === "z" ? 2 : 0;
  const mergeDist = params.mergeDistance;
  const doMerge = params.merge;
  const doBisect = params.bisect;

  const inPos = mesh.positions;
  const inIdx = mesh.indices;
  const inUvs = mesh.uvs;
  const inNormals = mesh.normals ?? computeVertexNormals(inPos, inIdx);
  const inVertCount = inPos.length / 3;

  // 1. Bisect filtering (if enabled, drop vertices on negative side)
  // For bisect, vertices with coord < -mergeDist are discarded.
  const vertKept: boolean[] = new Array(inVertCount);
  const vertRemap: number[] = new Array(inVertCount);
  const keptPositions: number[] = [];
  const keptUvs: number[] = [];
  const keptNormals: number[] = [];

  let keptCount = 0;
  for (let i = 0; i < inVertCount; i++) {
    const c = inPos[i * 3 + axisIdx];
    if (doBisect && c < -mergeDist) {
      vertKept[i] = false;
      vertRemap[i] = -1;
    } else {
      vertKept[i] = true;
      vertRemap[i] = keptCount++;
      // Snap to 0 if within merge distance
      const x = inPos[i * 3];
      const y = inPos[i * 3 + 1];
      const z = inPos[i * 3 + 2];
      const snappedC = doMerge && Math.abs(c) <= mergeDist ? 0 : c;
      if (axisIdx === 0) keptPositions.push(snappedC, y, z);
      else if (axisIdx === 1) keptPositions.push(x, snappedC, z);
      else keptPositions.push(x, y, snappedC);

      if (inUvs) {
        keptUvs.push(inUvs[i * 2], inUvs[i * 2 + 1]);
      }
      keptNormals.push(inNormals[i * 3], inNormals[i * 3 + 1], inNormals[i * 3 + 2]);
    }
  }

  // Filter input triangles
  const baseIndices: number[] = [];
  for (let i = 0; i < inIdx.length; i += 3) {
    const i0 = inIdx[i];
    const i1 = inIdx[i + 1];
    const i2 = inIdx[i + 2];
    if (vertKept[i0] && vertKept[i1] && vertKept[i2]) {
      baseIndices.push(vertRemap[i0], vertRemap[i1], vertRemap[i2]);
    }
  }

  // 2. Generate Mirrored Geometry
  // For vertices on seam (coord === 0), they can be merged directly to avoid duplicates.
  const mirroredVertIndex: number[] = new Array(keptCount);
  const newPositions: number[] = [...keptPositions];
  const newUvs: number[] = [...keptUvs];
  const newNormals: number[] = [...keptNormals];

  let totalVerts = keptCount;
  for (let i = 0; i < keptCount; i++) {
    const c = keptPositions[i * 3 + axisIdx];
    if (doMerge && Math.abs(c) <= mergeDist) {
      mirroredVertIndex[i] = i; // welded to itself on the seam
    } else {
      mirroredVertIndex[i] = totalVerts++;
      const x = keptPositions[i * 3];
      const y = keptPositions[i * 3 + 1];
      const z = keptPositions[i * 3 + 2];
      if (axisIdx === 0) newPositions.push(-x, y, z);
      else if (axisIdx === 1) newPositions.push(x, -y, z);
      else newPositions.push(x, y, -z);

      if (inUvs) {
        newUvs.push(keptUvs[i * 2], keptUvs[i * 2 + 1]);
      }
      const nx = keptNormals[i * 3];
      const ny = keptNormals[i * 3 + 1];
      const nz = keptNormals[i * 3 + 2];
      if (axisIdx === 0) newNormals.push(-nx, ny, nz);
      else if (axisIdx === 1) newNormals.push(nx, -ny, nz);
      else newNormals.push(nx, ny, -nz);
    }
  }

  // Mirrored triangles have inverted winding (i0, i2, i1) to preserve outwards face normals
  const allIndices: number[] = [...baseIndices];
  for (let i = 0; i < baseIndices.length; i += 3) {
    const m0 = mirroredVertIndex[baseIndices[i]];
    const m1 = mirroredVertIndex[baseIndices[i + 1]];
    const m2 = mirroredVertIndex[baseIndices[i + 2]];

    // Skip degenerate duplicate faces where all 3 vertices are seam-welded
    if (m0 === baseIndices[i] && m1 === baseIndices[i + 1] && m2 === baseIndices[i + 2]) {
      continue;
    }
    allIndices.push(m0, m2, m1);
  }

  return {
    positions: new Float32Array(newPositions),
    indices: new Uint32Array(allIndices),
    uvs: inUvs ? new Float32Array(newUvs) : undefined,
    normals: new Float32Array(newNormals),
  };
}

// ---------------------------------------------------------------------------
// 2. Array Modifier
// ---------------------------------------------------------------------------

export const ArrayParamsSchema = z.object({
  count: z.number().int().min(1).default(2),
  relativeOffset: z.tuple([z.number(), z.number(), z.number()]).default([1, 0, 0]),
  constantOffset: z.tuple([z.number(), z.number(), z.number()]).optional(),
  offset: z.tuple([z.number(), z.number(), z.number()]).optional(),
  merge: z.boolean().default(false),
  mergeDistance: z.number().nonnegative().default(0.001),
});
export type ArrayParams = z.infer<typeof ArrayParamsSchema>;

export function evaluateArray(mesh: MeshData, rawParams: unknown): MeshData {
  const params = ArrayParamsSchema.parse(rawParams ?? {});
  const count = Math.max(1, Math.floor(params.count));
  if (count === 1) return cloneMeshData(mesh);

  const inPos = mesh.positions;
  const inIdx = mesh.indices;
  const inUvs = mesh.uvs;
  const inNormals = mesh.normals ?? computeVertexNormals(inPos, inIdx);
  const vertCount = inPos.length / 3;
  const idxCount = inIdx.length;

  // Compute bounding box dimensions for relative offset
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < vertCount; i++) {
    const x = inPos[i * 3];
    const y = inPos[i * 3 + 1];
    const z = inPos[i * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const dimX = maxX >= minX ? maxX - minX : 0;
  const dimY = maxY >= minY ? maxY - minY : 0;
  const dimZ = maxZ >= minZ ? maxZ - minZ : 0;

  // Compute step vector
  let stepX = 0, stepY = 0, stepZ = 0;
  if (params.offset) {
    stepX = params.offset[0];
    stepY = params.offset[1];
    stepZ = params.offset[2];
  } else {
    const rel = params.relativeOffset ?? [1, 0, 0];
    const cst = params.constantOffset ?? [0, 0, 0];
    stepX = rel[0] * dimX + cst[0];
    stepY = rel[1] * dimY + cst[1];
    stepZ = rel[2] * dimZ + cst[2];
  }

  const outPositions = new Float32Array(vertCount * 3 * count);
  const outNormals = new Float32Array(vertCount * 3 * count);
  const outUvs = inUvs ? new Float32Array(inUvs.length * count) : undefined;
  const outIndices = new Uint32Array(idxCount * count);

  for (let c = 0; c < count; c++) {
    const vOffset = c * vertCount;
    const dx = c * stepX;
    const dy = c * stepY;
    const dz = c * stepZ;

    for (let i = 0; i < vertCount; i++) {
      const srcIdx = i * 3;
      const dstIdx = (vOffset + i) * 3;
      outPositions[dstIdx] = inPos[srcIdx] + dx;
      outPositions[dstIdx + 1] = inPos[srcIdx + 1] + dy;
      outPositions[dstIdx + 2] = inPos[srcIdx + 2] + dz;

      outNormals[dstIdx] = inNormals[srcIdx];
      outNormals[dstIdx + 1] = inNormals[srcIdx + 1];
      outNormals[dstIdx + 2] = inNormals[srcIdx + 2];

      if (inUvs && outUvs) {
        outUvs[(vOffset + i) * 2] = inUvs[i * 2];
        outUvs[(vOffset + i) * 2 + 1] = inUvs[i * 2 + 1];
      }
    }

    const iOffset = c * idxCount;
    for (let i = 0; i < idxCount; i++) {
      outIndices[iOffset + i] = inIdx[i] + vOffset;
    }
  }

  // Merge adjacent vertices if requested
  if (params.merge && params.mergeDistance > 0 && count > 1) {
    const mergeDistSq = params.mergeDistance * params.mergeDistance;
    // Map vertex indices to target index
    const remap = new Uint32Array(vertCount * count);
    for (let i = 0; i < remap.length; i++) remap[i] = i;

    for (let c = 0; c < count - 1; c++) {
      const baseA = c * vertCount;
      const baseB = (c + 1) * vertCount;
      for (let i = 0; i < vertCount; i++) {
        const vA = baseA + i;
        const ax = outPositions[vA * 3];
        const ay = outPositions[vA * 3 + 1];
        const az = outPositions[vA * 3 + 2];

        for (let j = 0; j < vertCount; j++) {
          const vB = baseB + j;
          const bx = outPositions[vB * 3];
          const by = outPositions[vB * 3 + 1];
          const bz = outPositions[vB * 3 + 2];
          const d2 = (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;
          if (d2 <= mergeDistSq) {
            remap[vB] = remap[vA];
          }
        }
      }
    }

    for (let i = 0; i < outIndices.length; i++) {
      outIndices[i] = remap[outIndices[i]];
    }
  }

  return {
    positions: outPositions,
    indices: outIndices,
    uvs: outUvs,
    normals: outNormals,
  };
}

// ---------------------------------------------------------------------------
// 3. Solidify Modifier
// ---------------------------------------------------------------------------

export const SolidifyParamsSchema = z.object({
  thickness: z.number().default(0.1),
  offset: z.number().default(-1),
});
export type SolidifyParams = z.infer<typeof SolidifyParamsSchema>;

export function evaluateSolidify(mesh: MeshData, rawParams: unknown): MeshData {
  const params = SolidifyParamsSchema.parse(rawParams ?? {});
  const thickness = params.thickness;
  const offset = params.offset;

  const inPos = mesh.positions;
  const inIdx = mesh.indices;
  const inUvs = mesh.uvs;
  const inNormals = mesh.normals ?? computeVertexNormals(inPos, inIdx);
  const vertCount = inPos.length / 3;

  // Outer shift and inner shift
  // offset -1 (default): outer = 0, inner = -thickness
  // offset 1: outer = thickness, inner = 0
  // offset 0: outer = thickness * 0.5, inner = -thickness * 0.5
  const outerShift = thickness * ((offset + 1) * 0.5);
  const innerShift = thickness * ((offset - 1) * 0.5);

  const outPositions = new Float32Array(vertCount * 6);
  const outNormals = new Float32Array(vertCount * 6);
  const outUvs = inUvs ? new Float32Array(inUvs.length * 2) : undefined;

  // Outer vertices [0 .. vertCount - 1]
  for (let i = 0; i < vertCount; i++) {
    const nx = inNormals[i * 3];
    const ny = inNormals[i * 3 + 1];
    const nz = inNormals[i * 3 + 2];

    outPositions[i * 3] = inPos[i * 3] + nx * outerShift;
    outPositions[i * 3 + 1] = inPos[i * 3 + 1] + ny * outerShift;
    outPositions[i * 3 + 2] = inPos[i * 3 + 2] + nz * outerShift;

    outNormals[i * 3] = nx;
    outNormals[i * 3 + 1] = ny;
    outNormals[i * 3 + 2] = nz;

    if (inUvs && outUvs) {
      outUvs[i * 2] = inUvs[i * 2];
      outUvs[i * 2 + 1] = inUvs[i * 2 + 1];
    }
  }

  // Inner vertices [vertCount .. 2 * vertCount - 1]
  for (let i = 0; i < vertCount; i++) {
    const dst = (vertCount + i) * 3;
    const nx = inNormals[i * 3];
    const ny = inNormals[i * 3 + 1];
    const nz = inNormals[i * 3 + 2];

    outPositions[dst] = inPos[i * 3] + nx * innerShift;
    outPositions[dst + 1] = inPos[i * 3 + 1] + ny * innerShift;
    outPositions[dst + 2] = inPos[i * 3 + 2] + nz * innerShift;

    // Flipped normal for interior surface
    outNormals[dst] = -nx;
    outNormals[dst + 1] = -ny;
    outNormals[dst + 2] = -nz;

    if (inUvs && outUvs) {
      outUvs[(vertCount + i) * 2] = inUvs[i * 2];
      outUvs[(vertCount + i) * 2 + 1] = inUvs[i * 2 + 1];
    }
  }

  // Index collection
  const outIndicesList: number[] = [];

  // 1. Original (outer) triangles
  for (let i = 0; i < inIdx.length; i++) {
    outIndicesList.push(inIdx[i]);
  }

  // 2. Inner flipped triangles
  for (let i = 0; i < inIdx.length; i += 3) {
    const a = inIdx[i] + vertCount;
    const b = inIdx[i + 1] + vertCount;
    const c = inIdx[i + 2] + vertCount;
    // Reversed winding for inner copy
    outIndicesList.push(a, c, b);
  }

  // 3. Find boundary edges to bridge outer and inner shells
  const edgeCount = new Map<string, number>();
  for (let i = 0; i < inIdx.length; i += 3) {
    const i0 = inIdx[i];
    const i1 = inIdx[i + 1];
    const i2 = inIdx[i + 2];
    const e1 = `${i0}->${i1}`;
    const e2 = `${i1}->${i2}`;
    const e3 = `${i2}->${i0}`;
    edgeCount.set(e1, (edgeCount.get(e1) ?? 0) + 1);
    edgeCount.set(e2, (edgeCount.get(e2) ?? 0) + 1);
    edgeCount.set(e3, (edgeCount.get(e3) ?? 0) + 1);
  }

  // Directed edges that lack an opposing twin are boundary edges
  for (const [edgeKey] of edgeCount.entries()) {
    const [uStr, vStr] = edgeKey.split("->");
    const u = Number(uStr);
    const v = Number(vStr);
    const revKey = `${v}->${u}`;
    if (!edgeCount.has(revKey)) {
      // Outer boundary directed edge goes u -> v.
      // Inner vertices are u + vertCount, v + vertCount.
      // Bridge quad (u, v, vInner, uInner) -> 2 triangles:
      // (u, v, vInner) and (u, vInner, uInner)
      const uIn = u + vertCount;
      const vIn = v + vertCount;
      outIndicesList.push(u, v, vIn);
      outIndicesList.push(u, vIn, uIn);
    }
  }

  return {
    positions: outPositions,
    indices: new Uint32Array(outIndicesList),
    uvs: outUvs,
    normals: outNormals,
  };
}

// ---------------------------------------------------------------------------
// 4. Transform Modifier
// ---------------------------------------------------------------------------

export const TransformModifierParamsSchema = z.object({
  translation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]), // in degrees
  scale: z.tuple([z.number(), z.number(), z.number()]).default([1, 1, 1]),
  translate: z.tuple([z.number(), z.number(), z.number()]).optional(),
});
export type TransformModifierParams = z.infer<typeof TransformModifierParamsSchema>;

export function evaluateTransform(mesh: MeshData, rawParams: unknown): MeshData {
  const params = TransformModifierParamsSchema.parse(rawParams ?? {});
  const t = params.translate ?? params.translation;
  const r = params.rotation;
  const s = params.scale;

  // Degrees to radians
  const rx = (r[0] * Math.PI) / 180;
  const ry = (r[1] * Math.PI) / 180;
  const rz = (r[2] * Math.PI) / 180;

  // Euler XYZ rotation matrix
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);

  const m00 = cy * cz;
  const m01 = -cy * sz;
  const m02 = sy;

  const m10 = cx * sz + sx * sy * cz;
  const m11 = cx * cz - sx * sy * sz;
  const m12 = -sx * cy;

  const m20 = sx * sz - cx * sy * cz;
  const m21 = sx * cz + cx * sy * sz;
  const m22 = cx * cy;

  const inPos = mesh.positions;
  const vertCount = inPos.length / 3;
  const outPositions = new Float32Array(inPos.length);

  for (let i = 0; i < vertCount; i++) {
    // 1. Scale
    const px = inPos[i * 3] * s[0];
    const py = inPos[i * 3 + 1] * s[1];
    const pz = inPos[i * 3 + 2] * s[2];

    // 2. Rotate
    const rxPos = m00 * px + m01 * py + m02 * pz;
    const ryPos = m10 * px + m11 * py + m12 * pz;
    const rzPos = m20 * px + m21 * py + m22 * pz;

    // 3. Translate
    outPositions[i * 3] = rxPos + t[0];
    outPositions[i * 3 + 1] = ryPos + t[1];
    outPositions[i * 3 + 2] = rzPos + t[2];
  }

  let outNormals: Float32Array | undefined;
  if (mesh.normals) {
    outNormals = new Float32Array(mesh.normals.length);
    for (let i = 0; i < vertCount; i++) {
      const nx = mesh.normals[i * 3];
      const ny = mesh.normals[i * 3 + 1];
      const nz = mesh.normals[i * 3 + 2];

      const rnx = m00 * nx + m01 * ny + m02 * nz;
      const rny = m10 * nx + m11 * ny + m12 * nz;
      const rnz = m20 * nx + m21 * ny + m22 * nz;
      const len = Math.hypot(rnx, rny, rnz) || 1;

      outNormals[i * 3] = rnx / len;
      outNormals[i * 3 + 1] = rny / len;
      outNormals[i * 3 + 2] = rnz / len;
    }
  }

  return {
    positions: outPositions,
    indices: new Uint32Array(mesh.indices),
    uvs: mesh.uvs ? new Float32Array(mesh.uvs) : undefined,
    normals: outNormals,
  };
}

// ---------------------------------------------------------------------------
// 5. Displace Modifier
// ---------------------------------------------------------------------------

export const DisplaceParamsSchema = z.object({
  strength: z.number().default(1),
  midlevel: z.number().default(0.5),
  scale: z.number().default(1),
  seed: z.number().default(0),
});
export type DisplaceParams = z.infer<typeof DisplaceParamsSchema>;

export function evaluateDisplace(mesh: MeshData, rawParams: unknown): MeshData {
  const params = DisplaceParamsSchema.parse(rawParams ?? {});
  const strength = params.strength;
  const midlevel = params.midlevel;
  const scale = params.scale;
  const seed = params.seed;

  const inPos = mesh.positions;
  const inIdx = mesh.indices;
  const inNormals = mesh.normals ?? computeVertexNormals(inPos, inIdx);
  const vertCount = inPos.length / 3;

  const outPositions = new Float32Array(inPos.length);

  for (let i = 0; i < vertCount; i++) {
    const x = inPos[i * 3];
    const y = inPos[i * 3 + 1];
    const z = inPos[i * 3 + 2];

    const nx = inNormals[i * 3];
    const ny = inNormals[i * 3 + 1];
    const nz = inNormals[i * 3 + 2];

    const nVal = valueNoise3D(x * scale, y * scale, z * scale, seed);
    const disp = (nVal - midlevel) * strength;

    outPositions[i * 3] = x + nx * disp;
    outPositions[i * 3 + 1] = y + ny * disp;
    outPositions[i * 3 + 2] = z + nz * disp;
  }

  return {
    positions: outPositions,
    indices: new Uint32Array(inIdx),
    uvs: mesh.uvs ? new Float32Array(mesh.uvs) : undefined,
    normals: computeVertexNormals(outPositions, inIdx),
  };
}

// ---------------------------------------------------------------------------
// Modifier Definitions & Registry
// ---------------------------------------------------------------------------

export const MODIFIER_DEFINITIONS: Record<string, ModifierDefinition<never>> = {
  mirror: {
    type: "mirror",
    label: "Mirror",
    schema: MirrorParamsSchema as unknown as z.ZodType<never>,
    params: MirrorParamsSchema as unknown as z.ZodType<never>,
    evaluate: evaluateMirror as (mesh: MeshData, params: never) => MeshData,
  },
  array: {
    type: "array",
    label: "Array",
    schema: ArrayParamsSchema as unknown as z.ZodType<never>,
    params: ArrayParamsSchema as unknown as z.ZodType<never>,
    evaluate: evaluateArray as (mesh: MeshData, params: never) => MeshData,
  },
  solidify: {
    type: "solidify",
    label: "Solidify",
    schema: SolidifyParamsSchema as unknown as z.ZodType<never>,
    params: SolidifyParamsSchema as unknown as z.ZodType<never>,
    evaluate: evaluateSolidify as (mesh: MeshData, params: never) => MeshData,
  },
  transform: {
    type: "transform",
    label: "Transform",
    schema: TransformModifierParamsSchema as unknown as z.ZodType<never>,
    params: TransformModifierParamsSchema as unknown as z.ZodType<never>,
    evaluate: evaluateTransform as (mesh: MeshData, params: never) => MeshData,
  },
  displace: {
    type: "displace",
    label: "Displace",
    schema: DisplaceParamsSchema as unknown as z.ZodType<never>,
    params: DisplaceParamsSchema as unknown as z.ZodType<never>,
    evaluate: evaluateDisplace as (mesh: MeshData, params: never) => MeshData,
  },
};

export const MODIFIER_REGISTRY = MODIFIER_DEFINITIONS;

/**
 * Returns a modifier definition by type name.
 */
export function getModifierDefinition(type: string): ModifierDefinition | undefined {
  return MODIFIER_DEFINITIONS[type] as unknown as ModifierDefinition | undefined;
}

export const getModifierDef = getModifierDefinition;

/**
 * Registers an additional modifier definition into the runtime registry.
 */
export function registerModifierDefinition<T>(def: ModifierDefinition<T>): void {
  MODIFIER_DEFINITIONS[def.type] = def as unknown as ModifierDefinition<never>;
}

export const registerModifier = registerModifierDefinition;
