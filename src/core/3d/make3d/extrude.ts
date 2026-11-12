/**
 * ============================================================================
 * 2D RING EXTRUSION & BEVELING (Phase 3D-029)
 * ============================================================================
 * Extrudes 2D polygonal rings (with holes) into watertight 3D meshes:
 *   - Continuous lofted quad strips using vertex-for-vertex bisector offsets
 *   - Front and back caps triangulated with `triangulate()`
 *   - Guaranteed watertight 2-manifold topology (every edge shared by 2 triangles)
 * ============================================================================
 */

import { normalizeRings, type Point2D, type Ring } from "../path/flatten";
import { offsetRingBisector, removeDupClosing } from "./bisector";
import { triangulate } from "./triangulate";
import type { ExtrudeOptions, MeshData } from "./types";
import { weldVertices } from "./weld";

/**
 * Extrudes 2D polygonal rings into a 3D watertight mesh.
 */
export function extrudeRings(
  rings: readonly Ring[],
  options?: ExtrudeOptions
): MeshData {
  const depth = Math.max(1e-4, options?.depth ?? 10);
  const bevel = options?.bevel;
  const bevelSize = Math.max(0, bevel?.size ?? 0);
  const bevelSegs = Math.max(1, bevel?.segments ?? 1);
  const bevelProfile = bevel?.profile ?? "round";

  const normalized = normalizeRings(rings);
  if (normalized.length === 0) {
    return {
      positions: new Float32Array(0),
      indices: new Uint32Array(0),
      uvs: new Float32Array(0),
      normals: new Float32Array(0),
    };
  }

  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  for (const poly of normalized) {
    const rawOuter = removeDupClosing(poly.outer);
    const rawHoles = poly.holes.map(removeDupClosing).filter((h) => h.length >= 3);
    if (rawOuter.length < 3) continue;

    // Bounding box for UV mapping
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let minEdgeLen = Infinity;

    for (let i = 0; i < rawOuter.length; i++) {
      const p = rawOuter[i];
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];

      const nextP = rawOuter[(i + 1) % rawOuter.length];
      const d = Math.hypot(nextP[0] - p[0], nextP[1] - p[1]);
      if (d > 1e-6 && d < minEdgeLen) minEdgeLen = d;
    }
    for (const h of rawHoles) {
      for (let i = 0; i < h.length; i++) {
        const nextP = h[(i + 1) % h.length];
        const d = Math.hypot(nextP[0] - h[i][0], nextP[1] - h[i][1]);
        if (d > 1e-6 && d < minEdgeLen) minEdgeLen = d;
      }
    }

    const spanX = Math.max(1e-5, maxX - minX);
    const spanY = Math.max(1e-5, maxY - minY);

    const hasBevel = bevelSize > 1e-4;
    const effBevelSize = hasBevel
      ? Math.min(bevelSize, depth * 0.45, Math.max(0.1, minEdgeLen * 0.4))
      : 0;

    // Build the sequence of Z levels and insets from back cap to front cap
    interface LevelSpec {
      z: number;
      inset: number;
    }

    const levels: LevelSpec[] = [];

    if (!hasBevel || effBevelSize <= 1e-4) {
      // 2 levels: back wall (z=0) and front wall (z=depth)
      levels.push({ z: 0, inset: 0 });
      levels.push({ z: depth, inset: 0 });
    } else {
      // Back bevel: s from bevelSegs down to 0
      for (let s = bevelSegs; s >= 0; s--) {
        const u = s / bevelSegs;
        let insetRatio = u;
        let heightRatio = u;
        if (bevelProfile === "round") {
          insetRatio = 1 - Math.cos((u * Math.PI) / 2);
          heightRatio = Math.sin((u * Math.PI) / 2);
        } else if (bevelProfile === "concave") {
          insetRatio = Math.sin((u * Math.PI) / 2);
          heightRatio = 1 - Math.cos((u * Math.PI) / 2);
        }
        const inset = effBevelSize * insetRatio;
        const z = effBevelSize - effBevelSize * heightRatio;
        levels.push({ z, inset });
      }

      // Front bevel: s from 0 up to bevelSegs
      for (let s = 0; s <= bevelSegs; s++) {
        const u = s / bevelSegs;
        let insetRatio = u;
        let heightRatio = u;
        if (bevelProfile === "round") {
          insetRatio = 1 - Math.cos((u * Math.PI) / 2);
          heightRatio = Math.sin((u * Math.PI) / 2);
        } else if (bevelProfile === "concave") {
          insetRatio = Math.sin((u * Math.PI) / 2);
          heightRatio = 1 - Math.cos((u * Math.PI) / 2);
        }
        const inset = effBevelSize * insetRatio;
        const z = depth - effBevelSize + effBevelSize * heightRatio;
        levels.push({ z, inset });
      }
    }

    const numLevels = levels.length;

    // For each ring (outer + holes), compute vertex rings across all levels
    interface ContourRings {
      isHole: boolean;
      levelRings: Point2D[][];
      baseIndices: number[]; // index in positions array for each level
    }

    const contours: ContourRings[] = [];

    // Outer contour
    const outerLevelRings: Point2D[][] = levels.map((lvl) =>
      offsetRingBisector(rawOuter, lvl.inset, false)
    );
    contours.push({
      isHole: false,
      levelRings: outerLevelRings,
      baseIndices: [],
    });

    // Hole contours
    for (const h of rawHoles) {
      const holeLevelRings: Point2D[][] = levels.map((lvl) =>
        offsetRingBisector(h, lvl.inset, true)
      );
      contours.push({
        isHole: true,
        levelRings: holeLevelRings,
        baseIndices: [],
      });
    }

    // Allocate vertices for all levels across all contours
    for (const c of contours) {
      for (let l = 0; l < numLevels; l++) {
        const ringPts = c.levelRings[l];
        const z = levels[l].z;
        const baseIdx = positions.length / 3;
        c.baseIndices.push(baseIdx);

        for (let i = 0; i < ringPts.length; i++) {
          const [x, y] = ringPts[i];
          positions.push(x, y, z);
          uvs.push((x - minX) / spanX, (y - minY) / spanY);
        }
      }
    }

    // Connect consecutive levels with quad strips
    for (const c of contours) {
      const n = c.levelRings[0].length;
      for (let l = 0; l < numLevels - 1; l++) {
        const baseCurr = c.baseIndices[l];
        const baseNext = c.baseIndices[l + 1];

        for (let i = 0; i < n; i++) {
          const nextI = (i + 1) % n;

          const v00 = baseCurr + i;
          const v01 = baseCurr + nextI;
          const v11 = baseNext + nextI;
          const v10 = baseNext + i;

          if (!c.isHole) {
            // Outer wall faces outward (CCW)
            indices.push(v00, v01, v11);
            indices.push(v00, v11, v10);
          } else {
            // Hole wall faces inward to hole / outward from solid (CW)
            indices.push(v00, v11, v01);
            indices.push(v00, v10, v11);
          }
        }
      }
    }

    // Triangulate Front Cap (at last level: l = numLevels - 1)
    const topOuter = contours[0].levelRings[numLevels - 1].map(([x, y]) => ({ x, y }));
    const topHoles = contours.slice(1).map((c) =>
      c.levelRings[numLevels - 1].map(([x, y]) => ({ x, y }))
    );

    const frontTris = triangulate(topOuter, topHoles);

    // Map local triangulation indices [0 .. totalContourVerts - 1] to global vertex indices
    const frontIndexMap: number[] = [];
    const topOuterBase = contours[0].baseIndices[numLevels - 1];
    for (let i = 0; i < topOuter.length; i++) {
      frontIndexMap.push(topOuterBase + i);
    }
    for (let h = 1; h < contours.length; h++) {
      const topHoleBase = contours[h].baseIndices[numLevels - 1];
      const hLen = contours[h].levelRings[numLevels - 1].length;
      for (let i = 0; i < hLen; i++) {
        frontIndexMap.push(topHoleBase + i);
      }
    }

    for (const tri of frontTris) {
      if (tri.length === 3) {
        indices.push(frontIndexMap[tri[0]], frontIndexMap[tri[1]], frontIndexMap[tri[2]]);
      }
    }

    // Triangulate Back Cap (at first level: l = 0)
    const botOuter = contours[0].levelRings[0].map(([x, y]) => ({ x, y }));
    const botHoles = contours.slice(1).map((c) =>
      c.levelRings[0].map(([x, y]) => ({ x, y }))
    );

    const backTris = triangulate(botOuter, botHoles);

    const backIndexMap: number[] = [];
    const botOuterBase = contours[0].baseIndices[0];
    for (let i = 0; i < botOuter.length; i++) {
      backIndexMap.push(botOuterBase + i);
    }
    for (let h = 1; h < contours.length; h++) {
      const botHoleBase = contours[h].baseIndices[0];
      const hLen = contours[h].levelRings[0].length;
      for (let i = 0; i < hLen; i++) {
        backIndexMap.push(botHoleBase + i);
      }
    }

    for (const tri of backTris) {
      if (tri.length === 3) {
        // Reverse winding for back cap (normals point in -Z)
        indices.push(backIndexMap[tri[0]], backIndexMap[tri[2]], backIndexMap[tri[1]]);
      }
    }
  }

  return weldVertices(positions, indices, uvs, 1e-4);
}
