/**
 * ============================================================================
 * PARAMETRIC 3D PRIMITIVE MESH GENERATORS (Phase 3D-025)
 * ============================================================================
 * Pure procedural geometry generators for parametric primitives.
 * Extends the foundational generators in `../commands/primitives` by adding
 * `circle`, `capsule`, and `roundedBox`.
 *
 * Invariants:
 *   - Pure TypeScript, zero DOM/Three.js dependencies.
 *   - Closed solids (capsule, roundedBox) are watertight 2-manifolds.
 *   - Consistent outward-facing counter-clockwise winding (right-hand rule).
 *   - Signed volume of closed meshes is strictly positive.
 * ============================================================================
 */

import type { PrimitiveMeshResult } from "./types";
import { cube } from "../commands/primitives";
export {
  computeSignedVolume,
  isWatertightMesh,
  cube,
  cylinder,
  cone,
  uvSphere,
  icosphere,
  torus,
  plane,
  type CubeOptions,
  type CylinderOptions,
  type ConeOptions,
  type UvSphereOptions,
  type IcosphereOptions,
  type TorusOptions,
  type PlaneOptions,
} from "../commands/primitives";

// ---------------------------------------------------------------------------
// 1. CIRCLE (Fan Disc on XZ plane, normal facing +Y)
// ---------------------------------------------------------------------------

export interface CircleOptions {
  radius?: number;
  vertices?: number;
  sides?: number;
}

export function circle(options?: number | CircleOptions): PrimitiveMeshResult {
  let radius = 1;
  let vertices = 32;

  if (typeof options === "number") {
    radius = options;
  } else if (options) {
    if (options.radius !== undefined) radius = options.radius;
    const v = options.sides ?? options.vertices;
    if (v !== undefined) vertices = Math.max(3, v);
  }

  // 1 center vertex at index 0 + `vertices` rim vertices
  const totalVerts = 1 + vertices;
  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);

  // Center vertex at (0, 0, 0)
  positions[0] = 0;
  positions[1] = 0;
  positions[2] = 0;
  uvs[0] = 0.5;
  uvs[1] = 0.5;

  let posPtr = 3;
  let uvPtr = 2;
  for (let i = 0; i < vertices; i++) {
    const phi = (i / vertices) * 2 * Math.PI;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    positions[posPtr++] = radius * cosPhi;
    positions[posPtr++] = 0;
    positions[posPtr++] = radius * sinPhi;

    uvs[uvPtr++] = 0.5 + 0.5 * cosPhi;
    uvs[uvPtr++] = 0.5 + 0.5 * sinPhi;
  }

  // Fan triangles from center vertex 0 with outward normal facing +Y:
  // Using right-hand rule with X=right, Y=up, Z=forward:
  // (0, 0, 1) x (1, 0, 0) = (0, 1, 0) [+Y], so CCW winding is (0, next, cur).
  const indices = new Uint32Array(vertices * 3);
  let idxPtr = 0;
  for (let i = 0; i < vertices; i++) {
    const nextI = (i + 1) % vertices;
    indices[idxPtr++] = 0;
    indices[idxPtr++] = 1 + nextI;
    indices[idxPtr++] = 1 + i;
  }

  return { positions, indices, uvs };
}

// ---------------------------------------------------------------------------
// 2. CAPSULE (Cylinder Body + Hemispherical End Caps)
// ---------------------------------------------------------------------------

export interface CapsuleOptions {
  radius?: number;
  depth?: number;
  height?: number;
  length?: number;
  radialSegments?: number;
  sides?: number;
  rings?: number;
  capSegments?: number;
}

export function capsule(options?: CapsuleOptions): PrimitiveMeshResult {
  let radius = 0.5;
  let depth = 1.0;
  let radialSegments = 16;
  let rings = 8; // Rings per hemisphere cap

  if (options) {
    if (options.radius !== undefined) radius = options.radius;
    const d = options.depth ?? options.height ?? options.length;
    if (d !== undefined) depth = d;
    const s = options.sides ?? options.radialSegments;
    if (s !== undefined) radialSegments = Math.max(3, s);
    const r = options.capSegments ?? options.rings;
    if (r !== undefined) rings = Math.max(1, r);
  }

  const halfDepth = depth * 0.5;

  // Vertex layout:
  // - Top pole: 1 vertex (index 0) at (0, halfDepth + radius, 0)
  // - Top hemisphere rings: `rings` rings (rings 1 to rings, where ring `rings` is at y = halfDepth)
  // - Bottom hemisphere rings: `rings` rings (ring 0 at y = -halfDepth to ring rings-1)
  // - Bottom pole: 1 vertex (index totalVerts - 1) at (0, -halfDepth - radius, 0)
  const totalRings = 2 * rings;
  const totalVerts = 2 + totalRings * radialSegments;
  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);

  // Top pole
  positions[0] = 0;
  positions[1] = halfDepth + radius;
  positions[2] = 0;
  uvs[0] = 0.5;
  uvs[1] = 1.0;

  let posPtr = 3;
  let uvPtr = 2;

  // Top hemisphere latitudinal rings (r = 1 .. rings)
  for (let r = 1; r <= rings; r++) {
    const theta = (r / rings) * (Math.PI * 0.5);
    const y = halfDepth + radius * Math.cos(theta);
    const ringRadius = radius * Math.sin(theta);
    const vCoord = 0.5 + 0.5 * (Math.cos(theta) * radius + halfDepth) / (halfDepth + radius);

    for (let s = 0; s < radialSegments; s++) {
      const phi = (s / radialSegments) * 2 * Math.PI;
      const x = ringRadius * Math.cos(phi);
      const z = ringRadius * Math.sin(phi);

      positions[posPtr++] = x;
      positions[posPtr++] = y;
      positions[posPtr++] = z;

      uvs[uvPtr++] = s / radialSegments;
      uvs[uvPtr++] = vCoord;
    }
  }

  // Bottom hemisphere latitudinal rings (r = 0 .. rings - 1)
  for (let r = 0; r < rings; r++) {
    const theta = Math.PI * 0.5 + (r / rings) * (Math.PI * 0.5);
    const y = -halfDepth + radius * Math.cos(theta);
    const ringRadius = radius * Math.sin(theta);
    const vCoord = 0.5 + 0.5 * (Math.cos(theta) * radius - halfDepth) / (halfDepth + radius);

    for (let s = 0; s < radialSegments; s++) {
      const phi = (s / radialSegments) * 2 * Math.PI;
      const x = ringRadius * Math.cos(phi);
      const z = ringRadius * Math.sin(phi);

      positions[posPtr++] = x;
      positions[posPtr++] = y;
      positions[posPtr++] = z;

      uvs[uvPtr++] = s / radialSegments;
      uvs[uvPtr++] = vCoord;
    }
  }

  // Bottom pole
  const botIdx = totalVerts - 1;
  positions[posPtr++] = 0;
  positions[posPtr++] = -halfDepth - radius;
  positions[posPtr++] = 0;
  uvs[uvPtr++] = 0.5;
  uvs[uvPtr++] = 0.0;

  // Triangles:
  // - Top pole fan: `radialSegments` triangles
  // - Intermediate quad rings: `totalRings - 1` quad rings * radialSegments * 2 triangles
  // - Bottom pole fan: `radialSegments` triangles
  const totalTriangles = 2 * radialSegments + (totalRings - 1) * radialSegments * 2;
  const indices = new Uint32Array(totalTriangles * 3);
  let idxPtr = 0;

  // Top cap fan from vertex 0
  for (let s = 0; s < radialSegments; s++) {
    const nextS = (s + 1) % radialSegments;
    indices[idxPtr++] = 0;
    indices[idxPtr++] = 1 + nextS;
    indices[idxPtr++] = 1 + s;
  }

  // Intermediate quad rings
  for (let r = 0; r < totalRings - 1; r++) {
    const curRingStart = 1 + r * radialSegments;
    const nextRingStart = curRingStart + radialSegments;

    for (let s = 0; s < radialSegments; s++) {
      const nextS = (s + 1) % radialSegments;
      const a = curRingStart + s;
      const b = curRingStart + nextS;
      const c = nextRingStart + s;
      const d = nextRingStart + nextS;

      indices[idxPtr++] = a;
      indices[idxPtr++] = b;
      indices[idxPtr++] = d;

      indices[idxPtr++] = a;
      indices[idxPtr++] = d;
      indices[idxPtr++] = c;
    }
  }

  // Bottom cap fan to bottom pole vertex `botIdx`
  const lastRingStart = 1 + (totalRings - 1) * radialSegments;
  for (let s = 0; s < radialSegments; s++) {
    const nextS = (s + 1) % radialSegments;
    indices[idxPtr++] = botIdx;
    indices[idxPtr++] = lastRingStart + s;
    indices[idxPtr++] = lastRingStart + nextS;
  }

  return { positions, indices, uvs };
}

// ---------------------------------------------------------------------------
// 3. ROUNDED BOX (Box with Beveled Edges & Corners)
// ---------------------------------------------------------------------------

export interface RoundedBoxOptions {
  width?: number;
  height?: number;
  depth?: number;
  size?: number;
  bevel?: number;
  segments?: number;
}

function getAxisCoord(index: number, halfInner: number, bevel: number, S: number): number {
  if (index <= S) {
    const alpha = (Math.PI * 0.5) * (1.0 - index / S);
    return -halfInner - bevel * Math.sin(alpha);
  }
  const k = index - (S + 1);
  const alpha = (Math.PI * 0.5) * (k / S);
  return halfInner + bevel * Math.sin(alpha);
}

export function roundedBox(options?: RoundedBoxOptions): PrimitiveMeshResult {
  let w = 1.0;
  let h = 1.0;
  let d = 1.0;
  let bevel = 0.1;
  let segments = 4;

  if (options) {
    if (options.size !== undefined) {
      w = options.size;
      h = options.size;
      d = options.size;
    }
    if (options.width !== undefined) w = options.width;
    if (options.height !== undefined) h = options.height;
    if (options.depth !== undefined) d = options.depth;
    if (options.bevel !== undefined) bevel = options.bevel;
    if (options.segments !== undefined) segments = Math.max(1, options.segments);
  }

  // Constrain bevel radius within bounds
  const maxBevel = Math.min(w * 0.5, h * 0.5, d * 0.5);
  const effBevel = Math.max(0, Math.min(bevel, maxBevel));

  // If bevel is effectively 0, fallback to standard cube generator
  if (effBevel <= 1e-6) {
    const { positions, indices } = cube({ width: w, height: h, depth: d });
    return { positions, indices };
  }

  const hx = w * 0.5 - effBevel;
  const hy = h * 0.5 - effBevel;
  const hz = d * 0.5 - effBevel;
  const S = segments;
  const K = 2 * S + 1;

  const positionsList: number[] = [];
  const vertexMap = new Map<string, number>();

  function getVertexIndex(i: number, j: number, k: number): number {
    const key = `${i}_${j}_${k}`;
    const existing = vertexMap.get(key);
    if (existing !== undefined) return existing;

    const rawX = getAxisCoord(i, hx, effBevel, S);
    const rawY = getAxisCoord(j, hy, effBevel, S);
    const rawZ = getAxisCoord(k, hz, effBevel, S);

    // Project outward from the nearest inner box boundary
    const cx = Math.max(-hx, Math.min(hx, rawX));
    const cy = Math.max(-hy, Math.min(hy, rawY));
    const cz = Math.max(-hz, Math.min(hz, rawZ));

    const dx = rawX - cx;
    const dy = rawY - cy;
    const dz = rawZ - cz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

    let px = rawX;
    let py = rawY;
    let pz = rawZ;
    if (len > 1e-9) {
      const scale = effBevel / len;
      px = cx + dx * scale;
      py = cy + dy * scale;
      pz = cz + dz * scale;
    }

    const idx = positionsList.length / 3;
    positionsList.push(px, py, pz);
    vertexMap.set(key, idx);
    return idx;
  }

  const indicesList: number[] = [];

  // 1. Front (+Z, k = K)
  for (let i = 0; i < K; i++) {
    for (let j = 0; j < K; j++) {
      const v00 = getVertexIndex(i, j, K);
      const v10 = getVertexIndex(i + 1, j, K);
      const v11 = getVertexIndex(i + 1, j + 1, K);
      const v01 = getVertexIndex(i, j + 1, K);

      indicesList.push(v00, v10, v11);
      indicesList.push(v00, v11, v01);
    }
  }

  // 2. Back (-Z, k = 0)
  for (let i = 0; i < K; i++) {
    for (let j = 0; j < K; j++) {
      const v00 = getVertexIndex(i, j, 0);
      const v10 = getVertexIndex(i + 1, j, 0);
      const v11 = getVertexIndex(i + 1, j + 1, 0);
      const v01 = getVertexIndex(i, j + 1, 0);

      indicesList.push(v10, v00, v01);
      indicesList.push(v10, v01, v11);
    }
  }

  // 3. Top (+Y, j = K)
  for (let i = 0; i < K; i++) {
    for (let k = 0; k < K; k++) {
      const v00 = getVertexIndex(i, K, k);
      const v10 = getVertexIndex(i + 1, K, k);
      const v11 = getVertexIndex(i + 1, K, k + 1);
      const v01 = getVertexIndex(i, K, k + 1);

      indicesList.push(v01, v11, v10);
      indicesList.push(v01, v10, v00);
    }
  }

  // 4. Bottom (-Y, j = 0)
  for (let i = 0; i < K; i++) {
    for (let k = 0; k < K; k++) {
      const v00 = getVertexIndex(i, 0, k);
      const v10 = getVertexIndex(i + 1, 0, k);
      const v11 = getVertexIndex(i + 1, 0, k + 1);
      const v01 = getVertexIndex(i, 0, k + 1);

      indicesList.push(v00, v10, v11);
      indicesList.push(v00, v11, v01);
    }
  }

  // 5. Right (+X, i = K)
  for (let j = 0; j < K; j++) {
    for (let k = 0; k < K; k++) {
      const v00 = getVertexIndex(K, j, k);
      const v10 = getVertexIndex(K, j, k + 1);
      const v11 = getVertexIndex(K, j + 1, k + 1);
      const v01 = getVertexIndex(K, j + 1, k);

      indicesList.push(v10, v00, v01);
      indicesList.push(v10, v01, v11);
    }
  }

  // 6. Left (-X, i = 0)
  for (let j = 0; j < K; j++) {
    for (let k = 0; k < K; k++) {
      const v00 = getVertexIndex(0, j, k);
      const v10 = getVertexIndex(0, j, k + 1);
      const v11 = getVertexIndex(0, j + 1, k + 1);
      const v01 = getVertexIndex(0, j + 1, k);

      indicesList.push(v00, v10, v11);
      indicesList.push(v00, v11, v01);
    }
  }

  return {
    positions: new Float32Array(positionsList),
    indices: new Uint32Array(indicesList),
  };
}
