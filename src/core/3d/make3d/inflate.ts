/**
 * ============================================================================
 * SDF INFLATION / PILLOW MESH GENERATOR (Phase 3D-029)
 * ============================================================================
 * Inflates 2D polygonal outlines into puffy 3D pillow solids via regular grid
 * cell clipping:
 *   - Computes signed distance field and pillow-profile height map.
 *   - Clips regular grid squares against the shape with `polygon-clipping`.
 *   - Triangulates each conforming piece using `triangulate()`.
 *   - Drops flat slivers whose three corners lie on the rim (z = 0).
 *   - Splits interior rim-rim chords at lifted midpoints to prevent pinches.
 *   - Front (+z) and mirrored back (-z, reversed winding) join at the z = 0 rim.
 *   - Guaranteed watertight 2-manifold across all outlines, holes, and glyphs.
 * ============================================================================
 */

import polygonClipping from "polygon-clipping";
import {
  closeRing,
  normalizeRings,
  ringArea,
  ringSetWinding,
  signedRingArea,
  type Point2D,
  type Ring,
} from "../path/flatten";
import { sdfToHeight, signedDistanceField, type SdfField } from "../sdf/sdf";
import { triangulate } from "./triangulate";
import type { InflateOptions, MeshData } from "./types";
import { weldVertices } from "./weld";

interface BoundarySegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Snaps polygon coordinates near regular grid lines and removes duplicate points.
 */
function cleanRing(
  r: polygonClipping.Ring,
  gridX: readonly number[],
  gridY: readonly number[]
): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < r.length; i++) {
    const rawX = r[i][0];
    const rawY = r[i][1];

    let sx = Math.round(rawX * 1e9) / 1e9;
    for (let g = 0; g < gridX.length; g++) {
      if (Math.abs(rawX - gridX[g]) < 1e-7) {
        sx = gridX[g];
        break;
      }
    }

    let sy = Math.round(rawY * 1e9) / 1e9;
    for (let g = 0; g < gridY.length; g++) {
      if (Math.abs(rawY - gridY[g]) < 1e-7) {
        sy = gridY[g];
        break;
      }
    }

    if (
      pts.length === 0 ||
      Math.hypot(sx - pts[pts.length - 1][0], sy - pts[pts.length - 1][1]) > 1e-8
    ) {
      pts.push([sx, sy]);
    }
  }

  // Remove duplicate closing point if first equals last
  while (
    pts.length > 1 &&
    Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-8
  ) {
    pts.pop();
  }

  return pts;
}

/**
 * Minimum Euclidean distance from point (px, py) to any boundary segment.
 */
function minDistanceToSegments(
  px: number,
  py: number,
  segments: readonly BoundarySegment[]
): number {
  let best = Infinity;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (
      px < s.minX - best ||
      px > s.maxX + best ||
      py < s.minY - best ||
      py > s.maxY + best
    ) {
      continue;
    }
    const dx = s.x1 - s.x0;
    const dy = s.y1 - s.y0;
    const l2 = dx * dx + dy * dy;
    let d: number;
    if (l2 < 1e-12) {
      d = Math.hypot(px - s.x0, py - s.y0);
    } else {
      const t = Math.max(0, Math.min(1, ((px - s.x0) * dx + (py - s.y0) * dy) / l2));
      d = Math.hypot(px - (s.x0 + t * dx), py - (s.y0 + t * dy));
    }
    if (d < best) best = d;
  }
  return best;
}

/**
 * Inflates 2D rings into a puffy 3D pillow mesh by regular grid cell clipping.
 */
export function inflateRings(
  rings: readonly Ring[],
  options?: InflateOptions
): MeshData {
  const depth = Math.max(1e-4, options?.depth ?? 10);
  const resolution = Math.max(3, Math.min(16, options?.resolution ?? 8));

  const normalized = normalizeRings(rings);
  if (normalized.length === 0) {
    return {
      positions: new Float32Array(0),
      indices: new Uint32Array(0),
      uvs: new Float32Array(0),
      normals: new Float32Array(0),
    };
  }

  // 1. Compute bounding box and collect all boundary segments
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const allRings: Ring[] = [];
  const allSegments: BoundarySegment[] = [];

  for (const poly of normalized) {
    const polyRings = [poly.outer, ...poly.holes];
    for (const r of polyRings) {
      allRings.push(r);
      const closed = closeRing(r);
      for (let i = 0; i + 1 < closed.length; i++) {
        const [x0, y0] = closed[i];
        const [x1, y1] = closed[i + 1];
        if (x0 < minX) minX = x0;
        if (x0 > maxX) maxX = x0;
        if (y0 < minY) minY = y0;
        if (y0 > maxY) maxY = y0;
        if (x1 < minX) minX = x1;
        if (x1 > maxX) maxX = x1;
        if (y1 < minY) minY = y1;
        if (y1 > maxY) maxY = y1;

        if (Math.hypot(x1 - x0, y1 - y0) > 1e-9) {
          allSegments.push({
            x0,
            y0,
            x1,
            y1,
            minX: Math.min(x0, x1),
            minY: Math.min(y0, y1),
            maxX: Math.max(x0, x1),
            maxY: Math.max(y0, y1),
          });
        }
      }
    }
  }

  const spanX = Math.max(1e-4, maxX - minX);
  const spanY = Math.max(1e-4, maxY - minY);
  const minDim = Math.min(spanX, spanY);
  const maxDim = Math.max(spanX, spanY);

  // 2. Regular square grid sizing (cell size = smaller bounding side / (resolution * 4))
  const targetDivisions = Math.max(8, Math.min(32, resolution * 4));
  const cellSize = Math.max(1e-4, minDim / targetDivisions);

  const numX = Math.max(1, Math.ceil(spanX / cellSize));
  const numY = Math.max(1, Math.ceil(spanY / cellSize));

  const gridX: number[] = [];
  for (let i = 0; i <= numX; i++) {
    gridX.push(minX + i * cellSize);
  }

  const gridY: number[] = [];
  for (let j = 0; j <= numY; j++) {
    gridY.push(minY + j * cellSize);
  }

  // 3. Compute Signed Distance Field and Height map
  const pad = cellSize * 2;
  const gridW = Math.ceil((spanX + pad * 2) / cellSize);
  const gridH = Math.ceil((spanY + pad * 2) / cellSize);

  const sdf: SdfField = signedDistanceField(allRings, {
    width: gridW,
    height: gridH,
    cellSize,
    origin: [minX - pad, minY - pad],
  });

  const heights = sdfToHeight(sdf, { depth, profile: "pillow" });

  const sampleHeightAt = (x: number, y: number): number => {
    const ox = sdf.origin[0];
    const oy = sdf.origin[1];
    const cs = sdf.cellSize;
    const gx = (x - ox) / cs;
    const gy = (y - oy) / cs;
    if (gx < 0 || gx >= sdf.width - 1 || gy < 0 || gy >= sdf.height - 1) return 0;

    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;

    const idx00 = iy * sdf.width + ix;
    const idx10 = idx00 + 1;
    const idx01 = idx00 + sdf.width;
    const idx11 = idx01 + 1;

    const h00 = heights[idx00] ?? 0;
    const h10 = heights[idx10] ?? 0;
    const h01 = heights[idx01] ?? 0;
    const h11 = heights[idx11] ?? 0;

    const hTop = h00 * (1 - fx) + h10 * fx;
    const hBot = h01 * (1 - fx) + h11 * fx;
    return Math.max(0, hTop * (1 - fy) + hBot * fy);
  };

  // 4. Convert polygon into polygon-clipping MultiPolygon
  const shapeMulti: polygonClipping.MultiPolygon = [];
  for (const poly of normalized) {
    const outerClosed = closeRing(poly.outer);
    if (outerClosed.length < 4) continue;
    const p: polygonClipping.Polygon = [outerClosed];
    for (const h of poly.holes) {
      const holeClosed = closeRing(h);
      if (holeClosed.length >= 4) {
        p.push(holeClosed);
      }
    }
    shapeMulti.push(p);
  }
  if (shapeMulti.length === 0) {
    return {
      positions: new Float32Array(0),
      indices: new Uint32Array(0),
      uvs: new Float32Array(0),
      normals: new Float32Array(0),
    };
  }

  // 5. Pre-index segments into grid cells for fast inside/outside/boundary classification
  const cellHasSegment = new Uint8Array(numX * numY);
  const allClosedRings = allRings.map(closeRing);

  for (const seg of allSegments) {
    const eps = 1e-6;
    const iMin = Math.max(0, Math.min(numX - 1, Math.floor((seg.minX - minX - eps) / cellSize)));
    const iMax = Math.max(0, Math.min(numX - 1, Math.floor((seg.maxX - minX + eps) / cellSize)));
    const jMin = Math.max(0, Math.min(numY - 1, Math.floor((seg.minY - minY - eps) / cellSize)));
    const jMax = Math.max(0, Math.min(numY - 1, Math.floor((seg.maxY - minY + eps) / cellSize)));

    for (let j = jMin; j <= jMax; j++) {
      const row = j * numX;
      for (let i = iMin; i <= iMax; i++) {
        cellHasSegment[row + i] = 1;
      }
    }
  }

  const boundaryTol = Math.max(1e-4, maxDim * 1e-5);
  const minH = Math.max(1e-3, depth * 0.02);

  // 6. Triangulate the FRONT surface piece by piece
  const frontPositions: number[] = [];
  const frontUvs: number[] = [];
  let frontTriangles: [number, number, number][] = [];

  for (let j = 0; j < numY; j++) {
    const y0 = gridY[j];
    const y1 = gridY[j + 1];

    for (let i = 0; i < numX; i++) {
      const x0 = gridX[i];
      const x1 = gridX[i + 1];
      const cellIdx = j * numX + i;

      // Fast check: wholly outside or wholly inside
      if (cellHasSegment[cellIdx] === 0) {
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        if (ringSetWinding(allClosedRings, cx, cy) === 0) {
          // Wholly outside
          continue;
        }

        // Wholly inside cell square
        const corners: Point2D[] = [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ];

        const fBase = frontPositions.length / 3;
        for (const [x, y] of corners) {
          const z = Math.max(minH, sampleHeightAt(x, y));
          frontPositions.push(x, y, z);
          frontUvs.push((x - minX) / spanX, (y - minY) / spanY);
        }

        // Front triangles (CCW)
        frontTriangles.push([fBase, fBase + 1, fBase + 2]);
        frontTriangles.push([fBase, fBase + 2, fBase + 3]);
        continue;
      }

      // Boundary cell: clip square against shape
      const cellPoly: polygonClipping.Polygon = [
        [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
          [x0, y0],
        ],
      ];

      const clippedPieces = polygonClipping.intersection([cellPoly], shapeMulti);
      if (!clippedPieces || clippedPieces.length === 0) continue;

      for (const piece of clippedPieces) {
        if (!piece || piece.length === 0) continue;

        const outerPts = cleanRing(piece[0], gridX, gridY);
        if (outerPts.length < 3 || ringArea(outerPts) < 1e-8) continue;

        if (signedRingArea(outerPts) < 0) {
          outerPts.reverse();
        }

        const holePtsList: Point2D[][] = [];
        for (let hIdx = 1; hIdx < piece.length; hIdx++) {
          const hPts = cleanRing(piece[hIdx], gridX, gridY);
          if (hPts.length >= 3 && ringArea(hPts) >= 1e-8) {
            if (signedRingArea(hPts) > 0) {
              hPts.reverse();
            }
            holePtsList.push(hPts);
          }
        }

        const outerVecs = outerPts.map(([x, y]) => ({ x, y }));
        const holeVecs = holePtsList.map((h) => h.map(([x, y]) => ({ x, y })));

        let triIndices: number[][] = [];
        try {
          triIndices = triangulate(outerVecs, holeVecs);
        } catch {
          continue;
        }
        if (triIndices.length === 0) continue;

        const piecePts: Point2D[] = [...outerPts];
        for (const h of holePtsList) {
          piecePts.push(...h);
        }

        const fBase = frontPositions.length / 3;
        for (const [x, y] of piecePts) {
          const isBdry = minDistanceToSegments(x, y, allSegments) <= boundaryTol;
          const z = isBdry ? 0 : Math.max(minH, sampleHeightAt(x, y));
          frontPositions.push(x, y, z);
          frontUvs.push((x - minX) / spanX, (y - minY) / spanY);
        }

        for (const tri of triIndices) {
          if (tri.length === 3) {
            frontTriangles.push([fBase + tri[0], fBase + tri[1], fBase + tri[2]]);
          }
        }
      }
    }
  }

  // 7. Drop flat sliver triangles on the front surface whose 3 corners all lie on the rim (z = 0)
  const isRim = (v: number) => Math.abs(frontPositions[v * 3 + 2]) < 1e-6;
  frontTriangles = frontTriangles.filter(([a, b, c]) => !(isRim(a) && isRim(b) && isRim(c)));

  // 8. Find and split interior chords: edges (u, v) where both endpoints are rim vertices (z = 0)
  // that are shared by two front triangles (interior chords across thin polygon spikes)
  let maxChordSplits = 100;
  while (--maxChordSplits > 0) {
    const edgeToTris = new Map<string, number[]>();

    for (let t = 0; t < frontTriangles.length; t++) {
      const [a, b, c] = frontTriangles[t];
      const e0 = a < b ? `${a}_${b}` : `${b}_${a}`;
      const e1 = b < c ? `${b}_${c}` : `${c}_${b}`;
      const e2 = c < a ? `${c}_${a}` : `${a}_${c}`;

      let l0 = edgeToTris.get(e0);
      if (!l0) edgeToTris.set(e0, (l0 = []));
      l0.push(t);

      let l1 = edgeToTris.get(e1);
      if (!l1) edgeToTris.set(e1, (l1 = []));
      l1.push(t);

      let l2 = edgeToTris.get(e2);
      if (!l2) edgeToTris.set(e2, (l2 = []));
      l2.push(t);
    }

    let chordFound = false;
    for (const [edgeKey, triList] of edgeToTris.entries()) {
      if (triList.length !== 2) continue;

      const sep = edgeKey.indexOf("_");
      const u = Number(edgeKey.slice(0, sep));
      const v = Number(edgeKey.slice(sep + 1));

      if (isRim(u) && isRim(v)) {
        chordFound = true;
        const t1Idx = triList[0];
        const t2Idx = triList[1];
        const tri1 = frontTriangles[t1Idx];
        const tri2 = frontTriangles[t2Idx];

        let w1 = -1;
        let tri1HasUtoV = false;
        if (tri1[0] === u && tri1[1] === v) { w1 = tri1[2]; tri1HasUtoV = true; }
        else if (tri1[1] === u && tri1[2] === v) { w1 = tri1[0]; tri1HasUtoV = true; }
        else if (tri1[2] === u && tri1[0] === v) { w1 = tri1[1]; tri1HasUtoV = true; }
        else if (tri1[0] === v && tri1[1] === u) { w1 = tri1[2]; tri1HasUtoV = false; }
        else if (tri1[1] === v && tri1[2] === u) { w1 = tri1[0]; tri1HasUtoV = false; }
        else if (tri1[2] === v && tri1[0] === u) { w1 = tri1[1]; tri1HasUtoV = false; }

        let w2 = -1;
        let tri2HasUtoV = false;
        if (tri2[0] === u && tri2[1] === v) { w2 = tri2[2]; tri2HasUtoV = true; }
        else if (tri2[1] === u && tri2[2] === v) { w2 = tri2[0]; tri2HasUtoV = true; }
        else if (tri2[2] === u && tri2[0] === v) { w2 = tri2[1]; tri2HasUtoV = true; }
        else if (tri2[0] === v && tri2[1] === u) { w2 = tri2[2]; tri2HasUtoV = false; }
        else if (tri2[1] === v && tri2[2] === u) { w2 = tri2[0]; tri2HasUtoV = false; }
        else if (tri2[2] === v && tri2[0] === u) { w2 = tri2[1]; tri2HasUtoV = false; }

        if (w1 === -1 || w2 === -1) continue;

        const ux = frontPositions[u * 3];
        const uy = frontPositions[u * 3 + 1];
        const vx = frontPositions[v * 3];
        const vy = frontPositions[v * 3 + 1];

        const mx = (ux + vx) / 2;
        const my = (uy + vy) / 2;
        const e = 0.05 * depth;
        const mz = Math.max(e, sampleHeightAt(mx, my));

        const m = frontPositions.length / 3;
        frontPositions.push(mx, my, mz);
        frontUvs.push((mx - minX) / spanX, (my - minY) / spanY);

        const split1A: [number, number, number] = tri1HasUtoV ? [u, m, w1] : [v, m, w1];
        const split1B: [number, number, number] = tri1HasUtoV ? [m, v, w1] : [m, u, w1];

        const split2A: [number, number, number] = tri2HasUtoV ? [u, m, w2] : [v, m, w2];
        const split2B: [number, number, number] = tri2HasUtoV ? [m, v, w2] : [m, u, w2];

        const maxIdx = Math.max(t1Idx, t2Idx);
        const minIdx = Math.min(t1Idx, t2Idx);
        const splitAtMax = maxIdx === t1Idx ? [split1A, split1B] : [split2A, split2B];
        const splitAtMin = minIdx === t1Idx ? [split1A, split1B] : [split2A, split2B];

        frontTriangles.splice(maxIdx, 1, ...splitAtMax);
        frontTriangles.splice(minIdx, 1, ...splitAtMin);
        break;
      }
    }

    if (!chordFound) break;
  }

  // 9. Generate full mesh: front surface (+z) and back surface (mirrored -z, reversed winding)
  const numFrontVerts = frontPositions.length / 3;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < frontPositions.length; i++) {
    positions.push(frontPositions[i]);
  }
  for (let i = 0; i < frontUvs.length; i++) {
    uvs.push(frontUvs[i]);
  }

  for (let i = 0; i < numFrontVerts; i++) {
    const x = frontPositions[i * 3];
    const y = frontPositions[i * 3 + 1];
    const z = frontPositions[i * 3 + 2];
    positions.push(x, y, -z);
    uvs.push(frontUvs[i * 2], frontUvs[i * 2 + 1]);
  }

  for (const tri of frontTriangles) {
    indices.push(tri[0], tri[1], tri[2]);
  }

  for (const tri of frontTriangles) {
    indices.push(numFrontVerts + tri[0], numFrontVerts + tri[2], numFrontVerts + tri[1]);
  }

  // 10. Drop any remaining flat sliver triangles where all 3 corners lie on the rim (z = 0)
  const weldTol = Math.max(1e-5, maxDim * 1e-6);
  const kept: number[] = [];
  const flat = (v: number) => Math.abs(positions[v * 3 + 2]) < 1e-9;
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a0 = indices[t], b0 = indices[t + 1], c0 = indices[t + 2];
    if (flat(a0) && flat(b0) && flat(c0)) continue;
    kept.push(a0, b0, c0);
  }

  return weldVertices(positions, kept, uvs, weldTol);
}
