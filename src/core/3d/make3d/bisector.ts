/**
 * ============================================================================
 * VERTEX-FOR-VERTEX BISECTOR OFFSET (Phase 3D-029)
 * ============================================================================
 * Computes inward normal bisector offsets for polygon contours while strictly
 * preserving vertex count (1-to-1 vertex correspondence for quad strips).
 * ============================================================================
 */

import type { Point2D } from "../path/flatten";

export interface CleanRing {
  points: Point2D[];
  isHole: boolean;
}

/**
 * Removes duplicate closing endpoints from a ring.
 */
export function removeDupClosing(ring: readonly Point2D[]): Point2D[] {
  const pts = ring.map(([x, y]) => [x, y] as Point2D);
  const n = pts.length;
  if (
    n > 1 &&
    Math.abs(pts[0][0] - pts[n - 1][0]) < 1e-7 &&
    Math.abs(pts[0][1] - pts[n - 1][1]) < 1e-7
  ) {
    pts.pop();
  }
  return pts;
}

/**
 * Offsets each vertex of a polygon contour along its inward angle bisector
 * by `inset`, clamping miter expansion to prevent runaway spikes.
 * Returns a new ring with the EXACT same vertex count as input.
 */
export function offsetRingBisector(
  ring: readonly Point2D[],
  inset: number,
  isHole: boolean,
  miterLimit = 2.5
): Point2D[] {
  const pts = removeDupClosing(ring);
  const n = pts.length;
  if (n < 3 || Math.abs(inset) < 1e-9) {
    return pts;
  }

  const sign = isHole ? -1 : 1;
  const result: Point2D[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    const dx1 = curr[0] - prev[0];
    const dy1 = curr[1] - prev[1];
    const len1 = Math.hypot(dx1, dy1);

    const dx2 = next[0] - curr[0];
    const dy2 = next[1] - curr[1];
    const len2 = Math.hypot(dx2, dy2);

    const t1x = len1 > 1e-9 ? dx1 / len1 : 1;
    const t1y = len1 > 1e-9 ? dy1 / len1 : 0;

    const t2x = len2 > 1e-9 ? dx2 / len2 : 1;
    const t2y = len2 > 1e-9 ? dy2 / len2 : 0;

    // Inward normals
    const n1x = -t1y * sign;
    const n1y = t1x * sign;

    const n2x = -t2y * sign;
    const n2y = t2x * sign;

    const bx = n1x + n2x;
    const by = n1y + n2y;
    const bLen = Math.hypot(bx, by);

    if (bLen < 1e-6) {
      // 180° turnaround or degenerate spike: offset along edge normal
      result[i] = [curr[0] + n1x * inset, curr[1] + n1y * inset];
    } else {
      // Bisector offset: disp = b_unit * (inset / cos(half)) = b * (2 * inset / bLen^2)
      const factor = Math.min(miterLimit, 2 / (bLen * bLen));
      const dispX = bx * inset * factor;
      const dispY = by * inset * factor;
      result[i] = [curr[0] + dispX, curr[1] + dispY];
    }
  }

  return result;
}
