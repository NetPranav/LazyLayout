/**
 * Warp mesh: a cols x rows grid of control points that bends a layer along a curve or surface,
 * with more freedom than corner pin (which has only 4 points).
 * Each cell of the grid is drawn as a tile with its own projective matrix3d mapping its source
 * rectangle onto the deformed quad.
 */

import { isConvex, squareToQuad, type Quad } from "./cornerPin";

export type Point = [number, number];

export interface WarpMesh {
  /** Number of columns of control points (2 to 6). */
  cols: number;
  /** Number of rows of control points (2 to 6). */
  rows: number;
  /** Control points in row-major order: length is cols * rows. Points are in parent px. */
  points: Point[];
}

export interface MeshTile {
  col: number;
  row: number;
  /** Source rectangle in layer-local px: [x, y, width, height] */
  srcRect: [number, number, number, number];
  /** Destination quad in parent px (or relative to origin if provided): [TL, TR, BR, BL] */
  quad: Quad;
  /** CSS matrix3d that maps the source rectangle (at transform-origin 0 0) onto quad */
  matrix3d: string;
}

/** Parses "cols,rows;x,y;x,y;..." into a WarpMesh, or null when invalid. */
export function parseMesh(text: unknown): WarpMesh | null {
  if (typeof text !== "string" || text.trim() === "") return null;
  const parts = text.split(";");
  if (parts.length < 2) return null;
  const dims = parts[0].split(",").map(Number);
  if (dims.length !== 2 || !dims.every(Number.isInteger)) return null;
  const [cols, rows] = dims;
  if (cols < 2 || cols > 6 || rows < 2 || rows > 6) return null;
  const pointStrings = parts.slice(1);
  if (pointStrings.length !== cols * rows) return null;
  const points: Point[] = [];
  for (const s of pointStrings) {
    const coords = s.split(",").map(Number);
    if (coords.length !== 2 || !coords.every(Number.isFinite)) return null;
    points.push([coords[0], coords[1]]);
  }
  return { cols, rows, points };
}

/** Formats a WarpMesh into "cols,rows;x,y;x,y;...". */
export function formatMesh(mesh: WarpMesh): string {
  const round = (n: number) => Math.round(n * 100) / 100;
  const pts = mesh.points.map(([x, y]) => `${round(x)},${round(y)}`).join(";");
  return `${mesh.cols},${mesh.rows};${pts}`;
}

/** Creates a flat grid of cols x rows control points spanning (x, y) to (x+w, y+h). */
export function defaultMesh(x: number, y: number, w: number, h: number, cols = 3, rows = 3): WarpMesh {
  const c = Math.max(2, Math.min(6, Math.round(cols)));
  const r = Math.max(2, Math.min(6, Math.round(rows)));
  const points: Point[] = [];
  for (let row = 0; row < r; row++) {
    const v = r > 1 ? row / (r - 1) : 0;
    const py = y + v * h;
    for (let col = 0; col < c; col++) {
      const u = c > 1 ? col / (c - 1) : 0;
      const px = x + u * w;
      points.push([px, py]);
    }
  }
  return { cols: c, rows: r, points };
}

/**
 * The CSS `matrix3d(...)` that maps a source rectangle [srcX0, srcY0, srcW, srcH]
 * (with transform-origin: 0 0) onto destination quad [TL, TR, BR, BL].
 */
export function cellMatrix3d(srcRect: [number, number, number, number], quad: Quad): string {
  const [srcX0, srcY0, srcW, srcH] = srcRect;
  if (srcW <= 0 || srcH <= 0) return "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
  const m = squareToQuad(quad);
  const m0 = m.a / srcW;
  const m1 = m.d / srcW;
  const m3 = m.g / srcW;
  const m4 = m.b / srcH;
  const m5 = m.e / srcH;
  const m7 = m.h / srcH;
  const m12 = m.c - m0 * srcX0 - m4 * srcY0;
  const m13 = m.f - m1 * srcX0 - m5 * srcY0;
  const m15 = 1 - m3 * srcX0 - m7 * srcY0;
  const v = [m0, m1, 0, m3, m4, m5, 0, m7, 0, 0, 1, 0, m12, m13, 0, m15];
  return `matrix3d(${v.map((n) => (Math.abs(n) < 1e-12 ? 0 : Number(n.toPrecision(9)))).join(",")})`;
}

/**
 * Returns, for every grid cell, the 4 corner points and the projective matrix3d mapping
 * its source rectangle onto its quad.
 * `origin` can be provided (e.g. [layer.x, layer.y]) to make tile quads relative to the layer.
 */
export function meshTiles(w: number, h: number, mesh: WarpMesh, origin: [number, number] = [0, 0]): MeshTile[] {
  const tiles: MeshTile[] = [];
  const numCols = mesh.cols - 1;
  const numRows = mesh.rows - 1;
  if (numCols < 1 || numRows < 1 || w <= 0 || h <= 0) return tiles;

  for (let r = 0; r < numRows; r++) {
    const srcY0 = (r / numRows) * h;
    const srcY1 = ((r + 1) / numRows) * h;
    const srcH = srcY1 - srcY0;

    for (let c = 0; c < numCols; c++) {
      const srcX0 = (c / numCols) * w;
      const srcX1 = ((c + 1) / numCols) * w;
      const srcW = srcX1 - srcX0;

      const idxTL = r * mesh.cols + c;
      const idxTR = r * mesh.cols + (c + 1);
      const idxBR = (r + 1) * mesh.cols + (c + 1);
      const idxBL = (r + 1) * mesh.cols + c;

      const pTL = mesh.points[idxTL];
      const pTR = mesh.points[idxTR];
      const pBR = mesh.points[idxBR];
      const pBL = mesh.points[idxBL];

      const quad: Quad = [
        [pTL[0] - origin[0], pTL[1] - origin[1]],
        [pTR[0] - origin[0], pTR[1] - origin[1]],
        [pBR[0] - origin[0], pBR[1] - origin[1]],
        [pBL[0] - origin[0], pBL[1] - origin[1]],
      ];

      const srcRect: [number, number, number, number] = [srcX0, srcY0, srcW, srcH];
      const matrix3d = cellMatrix3d(srcRect, quad);

      tiles.push({
        col: c,
        row: r,
        srcRect,
        quad,
        matrix3d,
      });
    }
  }
  return tiles;
}

/** True when every cell quad in the mesh is convex and not folded inside out. */
export function isMeshConvex(mesh: WarpMesh): boolean {
  const numCols = mesh.cols - 1;
  const numRows = mesh.rows - 1;
  if (numCols < 1 || numRows < 1) return false;

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const idxTL = r * mesh.cols + c;
      const idxTR = r * mesh.cols + (c + 1);
      const idxBR = (r + 1) * mesh.cols + (c + 1);
      const idxBL = (r + 1) * mesh.cols + c;

      const quad: Quad = [
        mesh.points[idxTL],
        mesh.points[idxTR],
        mesh.points[idxBR],
        mesh.points[idxBL],
      ];
      if (!isConvex(quad)) return false;
    }
  }
  return true;
}

/** Subdivides column `col` by inserting a new column between `col` and `col + 1`. */
export function subdivideMeshCol(mesh: WarpMesh, col: number): WarpMesh | null {
  if (mesh.cols >= 6 || col < 0 || col >= mesh.cols - 1) return null;
  const newCols = mesh.cols + 1;
  const newPoints: Point[] = [];
  for (let r = 0; r < mesh.rows; r++) {
    for (let c = 0; c < mesh.cols; c++) {
      const curr = mesh.points[r * mesh.cols + c];
      newPoints.push(curr);
      if (c === col) {
        const next = mesh.points[r * mesh.cols + (c + 1)];
        newPoints.push([(curr[0] + next[0]) / 2, (curr[1] + next[1]) / 2]);
      }
    }
  }
  return { cols: newCols, rows: mesh.rows, points: newPoints };
}

/** Subdivides row `row` by inserting a new row between `row` and `row + 1`. */
export function subdivideMeshRow(mesh: WarpMesh, row: number): WarpMesh | null {
  if (mesh.rows >= 6 || row < 0 || row >= mesh.rows - 1) return null;
  const newRows = mesh.rows + 1;
  const newPoints: Point[] = [];
  for (let r = 0; r < mesh.rows; r++) {
    for (let c = 0; c < mesh.cols; c++) {
      newPoints.push(mesh.points[r * mesh.cols + c]);
    }
    if (r === row) {
      for (let c = 0; c < mesh.cols; c++) {
        const curr = mesh.points[r * mesh.cols + c];
        const next = mesh.points[(r + 1) * mesh.cols + c];
        newPoints.push([(curr[0] + next[0]) / 2, (curr[1] + next[1]) / 2]);
      }
    }
  }
  return { cols: mesh.cols, rows: newRows, points: newPoints };
}
