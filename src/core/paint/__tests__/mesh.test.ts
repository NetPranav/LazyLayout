/**
 * ROADMAP Phase 115: mesh gradients. Ten reference meshes are drawn and each picture is checked pixel by pixel
 * against the blending rule it follows (bilinear per cell, or Catmull–Rom across the grid): at least 99% of pixels
 * within 3 of 255. A dragged point carries its colour to where it was dragged. The picture is the same every time.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bmpDataUrl, MESH_RASTER, meshAt, meshSvg, newMesh, rasterizeMesh, type MeshSpec } from "../mesh";
import { parseFills, serializeFills } from "../paints";

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const PALETTE = ["#ff7a59", "#4f46e5", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9", "#111827", "#fef3c7", "#7c3aed"];

/** A mesh of a size with colours from the palette, offset by `k` so the ten differ. */
function mesh(cols: number, rows: number, smooth: boolean, k: number): MeshSpec {
  const m = newMesh(cols, rows);
  return { ...m, smooth, points: m.points.map((p, i) => ({ ...p, color: PALETTE[(i * 3 + k) % PALETTE.length] })) };
}

/** The share of pixels whose colour is within `tol` of the rule at the pixel's centre (for a grid that isn't dragged). */
function agreement(m: MeshSpec, tol = 3): number {
  const px = rasterizeMesh(m);
  const n = MESH_RASTER;
  let good = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const want = meshAt(m, ((x + 0.5) / n) * (m.cols - 1), ((y + 0.5) / n) * (m.rows - 1)).rgba;
      const k = (y * n + x) * 4;
      if ([0, 1, 2, 3].every((c) => Math.abs(px[k + c] - want[c]) <= tol)) good++;
    }
  }
  return good / (n * n);
}

describe("Phase 115: ten reference meshes", () => {
  const refs: [string, MeshSpec][] = [
    ["2×2 linear", mesh(2, 2, false, 0)],
    ["2×2 smooth", mesh(2, 2, true, 1)],
    ["3×3 linear", mesh(3, 3, false, 2)],
    ["3×3 smooth", mesh(3, 3, true, 3)],
    ["4×3 smooth", mesh(4, 3, true, 4)],
    ["3×4 linear", mesh(3, 4, false, 5)],
    ["5×5 smooth", mesh(5, 5, true, 6)],
    ["6×2 linear", mesh(6, 2, false, 7)],
    ["2×6 smooth", mesh(2, 6, true, 8)],
    ["8×8 smooth", mesh(8, 8, true, 0)],
  ];
  for (const [name, m] of refs) {
    it(`${name}: at least 99% of pixels follow the blending rule within 3 of 255`, () => {
      const share = agreement(m);
      assert.ok(share >= 0.99, `${(share * 100).toFixed(2)}%`);
    });
  }

  it("a 2×2 linear mesh is exactly the bilinear blend of its corners", () => {
    const m = mesh(2, 2, false, 0);
    const [a, b, c, d] = m.points.map((p) => rgb(p.color));
    const px = rasterizeMesh(m);
    const n = MESH_RASTER;
    for (const [x, y] of [[0, 0], [n - 1, 0], [n / 2, n / 2], [10, 70]]) {
      const u = (x + 0.5) / n;
      const v = (y + 0.5) / n;
      for (let ch = 0; ch < 3; ch++) {
        const want = (a[ch] * (1 - u) + b[ch] * u) * (1 - v) + (c[ch] * (1 - u) + d[ch] * u) * v;
        assert.ok(Math.abs(px[(y * n + x) * 4 + ch] - want) <= 2, `(${x}, ${y}) channel ${ch}`);
      }
    }
  });
});

describe("Phase 115: dragging points, storing, drawing", () => {
  it("a dragged point carries its colour to where it was dragged, and the box stays covered", () => {
    const m = mesh(3, 3, true, 2);
    const moved: MeshSpec = { ...m, points: m.points.map((p, i) => (i === 4 ? { ...p, x: 0.25, y: 0.7, color: "#ffffff" } : p)) };
    const px = rasterizeMesh(moved);
    const n = MESH_RASTER;
    const k = (Math.round(0.7 * n) * n + Math.round(0.25 * n)) * 4;
    assert.ok(px[k] > 235 && px[k + 1] > 235 && px[k + 2] > 235, `${px[k]},${px[k + 1]},${px[k + 2]}`);
    for (let i = 3; i < px.length; i += 4) assert.equal(px[i], 255, "opaque everywhere");
  });

  it("stored safely, the same picture every time, and a valid BMP", () => {
    const m = mesh(3, 3, true, 3);
    const fills = parseFills(JSON.stringify([{ type: "mesh", ...m }, { type: "mesh", cols: 3, rows: 3, points: [] }]))!;
    assert.equal(fills.length, 1, "a mesh with the wrong number of points is dropped");
    assert.deepEqual(parseFills(serializeFills(fills)), fills);
    assert.equal(meshSvg(m, 200, 100), meshSvg(m, 200, 100));
    const url = bmpDataUrl(rasterizeMesh(m), MESH_RASTER, MESH_RASTER);
    const bytes = Buffer.from(url.split(",")[1], "base64");
    assert.equal(bytes.toString("latin1", 0, 2), "BM");
    assert.equal(bytes.readInt32LE(18), MESH_RASTER);
    assert.equal(bytes.length, 14 + 108 + MESH_RASTER * MESH_RASTER * 4);
  });
});
