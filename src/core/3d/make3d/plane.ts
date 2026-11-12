/**
 * ============================================================================
 * FLAT CARD / PLANE MESH GENERATOR (Phase 3D-029)
 * ============================================================================
 * Generates a flat textured card in 3D space with UV coordinates for displaying
 * 2D layer textures and decals, constructed as a watertight closed solid.
 * ============================================================================
 */

import { normalizeRings, type Point2D, type Ring } from "../path/flatten";
import { removeDupClosing } from "./bisector";
import { triangulate } from "./triangulate";
import type { MeshData, PlaneOptions } from "./types";
import { weldVertices } from "./weld";

/**
 * Creates a flat card mesh from either ring outlines or bounding box dimensions.
 */
export function createPlaneMesh(
  ringsOrOptions?: readonly Ring[] | PlaneOptions,
  options?: PlaneOptions
): MeshData {
  let rings: readonly Ring[] | undefined;
  let opts: PlaneOptions = options ?? {};

  if (Array.isArray(ringsOrOptions)) {
    rings = ringsOrOptions;
  } else if (ringsOrOptions && typeof ringsOrOptions === "object") {
    opts = { ...ringsOrOptions, ...options };
  }

  const thickness = Math.max(1e-4, opts.thickness ?? 0.01);
  const halfZ = thickness * 0.5;

  if (rings && rings.length > 0) {
    const normalized = normalizeRings(rings);
    if (normalized.length > 0) {
      const positions: number[] = [];
      const indices: number[] = [];
      const uvs: number[] = [];

      for (const poly of normalized) {
        const rawOuter = removeDupClosing(poly.outer);
        const rawHoles = poly.holes.map(removeDupClosing).filter((h) => h.length >= 3);
        if (rawOuter.length < 3) continue;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [x, y] of rawOuter) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
        const spanX = Math.max(1e-5, maxX - minX);
        const spanY = Math.max(1e-5, maxY - minY);

        const outerVecs = rawOuter.map(([x, y]) => ({ x, y }));
        const holeVecs = rawHoles.map((h) => h.map(([x, y]) => ({ x, y })));

        const triIndices = triangulate(outerVecs, holeVecs);

        const allPts: Point2D[] = [...rawOuter];
        for (const h of rawHoles) {
          allPts.push(...h);
        }
        const numVerts = allPts.length;

        // 1. Back cap vertices (-halfZ)
        const backBase = positions.length / 3;
        for (let i = 0; i < numVerts; i++) {
          const [x, y] = allPts[i];
          positions.push(x, y, -halfZ);
          uvs.push((x - minX) / spanX, (y - minY) / spanY);
        }

        // 2. Front cap vertices (+halfZ)
        const frontBase = positions.length / 3;
        for (let i = 0; i < numVerts; i++) {
          const [x, y] = allPts[i];
          positions.push(x, y, halfZ);
          uvs.push((x - minX) / spanX, (y - minY) / spanY);
        }

        // 3. Front cap triangles (normals in +Z)
        for (const tri of triIndices) {
          if (tri.length === 3 && tri[0] !== tri[1] && tri[1] !== tri[2] && tri[2] !== tri[0]) {
            indices.push(frontBase + tri[0], frontBase + tri[1], frontBase + tri[2]);
          }
        }

        // 4. Back cap triangles (normals in -Z, reversed winding)
        for (const tri of triIndices) {
          if (tri.length === 3 && tri[0] !== tri[1] && tri[1] !== tri[2] && tri[2] !== tri[0]) {
            indices.push(backBase + tri[0], backBase + tri[2], backBase + tri[1]);
          }
        }

        // 5. Side walls around outer ring directly connecting backBase and frontBase
        const nOuter = rawOuter.length;
        for (let i = 0; i < nOuter; i++) {
          const next = (i + 1) % nOuter;
          const b0 = backBase + i;
          const b1 = backBase + next;
          const f0 = frontBase + i;
          const f1 = frontBase + next;

          indices.push(b0, b1, f1);
          indices.push(b0, f1, f0);
        }

        // 6. Side walls around hole rings directly connecting backBase and frontBase
        let offset = nOuter;
        for (const h of rawHoles) {
          const nHole = h.length;
          for (let i = 0; i < nHole; i++) {
            const next = (i + 1) % nHole;
            const b0 = backBase + offset + i;
            const b1 = backBase + offset + next;
            const f0 = frontBase + offset + i;
            const f1 = frontBase + offset + next;

            // Inward-facing wall for holes
            indices.push(b0, f1, b1);
            indices.push(b0, f0, f1);
          }
          offset += nHole;
        }
      }

      return weldVertices(positions, indices, uvs, 1e-4);
    }
  }

  // Fallback box for plain dimension parameters
  const w = Math.max(1e-4, opts.width ?? 100);
  const h = Math.max(1e-4, opts.height ?? 100);
  const halfW = w * 0.5;
  const halfH = h * 0.5;

  const positions = new Float32Array([
    // Front face
    -halfW, -halfH, halfZ,
     halfW, -halfH, halfZ,
     halfW,  halfH, halfZ,
    -halfW,  halfH, halfZ,
    // Back face
    -halfW, -halfH, -halfZ,
    -halfW,  halfH, -halfZ,
     halfW,  halfH, -halfZ,
     halfW, -halfH, -halfZ,
    // Top face
    -halfW,  halfH, -halfZ,
    -halfW,  halfH,  halfZ,
     halfW,  halfH,  halfZ,
     halfW,  halfH, -halfZ,
    // Bottom face
    -halfW, -halfH, -halfZ,
     halfW, -halfH, -halfZ,
     halfW, -halfH,  halfZ,
    -halfW, -halfH,  halfZ,
    // Right face
     halfW, -halfH, -halfZ,
     halfW,  halfH, -halfZ,
     halfW,  halfH,  halfZ,
     halfW, -halfH,  halfZ,
    // Left face
    -halfW, -halfH, -halfZ,
    -halfW, -halfH,  halfZ,
    -halfW,  halfH,  halfZ,
    -halfW,  halfH, -halfZ,
  ]);

  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
    1, 0, 1, 1, 0, 1, 0, 0,
    0, 1, 0, 0, 1, 0, 1, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
  ]);

  const indices = new Uint32Array([
    0, 1, 2,  0, 2, 3,       // Front
    4, 5, 6,  4, 6, 7,       // Back
    8, 9, 10,  8, 10, 11,    // Top
    12, 13, 14,  12, 14, 15, // Bottom
    16, 17, 18,  16, 18, 19, // Right
    20, 21, 22,  20, 22, 23, // Left
  ]);

  return weldVertices(positions, indices, uvs, 1e-4);
}
