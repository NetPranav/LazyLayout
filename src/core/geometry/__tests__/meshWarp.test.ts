import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cellMatrix3d,
  defaultMesh,
  formatMesh,
  isMeshConvex,
  meshTiles,
  parseMesh,
  subdivideMeshCol,
  subdivideMeshRow,
  type WarpMesh,
} from "../meshWarp";

/** Applies a CSS matrix3d to a 2D point (x, y) with homogeneous divide. */
const apply = (matrix: string, x: number, y: number): [number, number] => {
  const m = matrix.slice(9, -1).split(",").map(Number); // column-major 4x4
  const X = m[0] * x + m[4] * y + m[12];
  const Y = m[1] * x + m[5] * y + m[13];
  const W = m[3] * x + m[7] * y + m[15];
  return [X / W, Y / W];
};

const near = (a: [number, number], b: [number, number], tol = 1e-3) =>
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < tol, `${a} vs ${b}`);

describe("mesh warp", () => {
  it("reads and writes the stored form and rejects invalid input", () => {
    const mesh = defaultMesh(10, 20, 300, 200, 3, 3);
    const formatted = formatMesh(mesh);
    const parsed = parseMesh(formatted);
    assert.deepEqual(parsed, mesh);

    assert.equal(parseMesh(""), null);
    assert.equal(parseMesh("invalid"), null);
    assert.equal(parseMesh("3,3;1,2;3,4"), null, "wrong number of points");
    assert.equal(parseMesh("1,1;0,0"), null, "under minimum grid size");
    assert.equal(parseMesh("7,7;..."), null, "over maximum grid size");
    assert.equal(parseMesh("3,3;a,b;1,2;3,4;5,6;7,8;9,10;11,12;13,14;15,16"), null, "non-numeric coords");
  });

  it("defaultMesh generates a regular grid of cols x rows points", () => {
    const m = defaultMesh(0, 0, 200, 100, 3, 3);
    assert.equal(m.cols, 3);
    assert.equal(m.rows, 3);
    assert.equal(m.points.length, 9);
    near(m.points[0], [0, 0]); // top-left
    near(m.points[1], [100, 0]); // top-centre
    near(m.points[2], [200, 0]); // top-right
    near(m.points[4], [100, 50]); // centre
    near(m.points[8], [200, 100]); // bottom-right
  });

  it("a flat mesh equals the plain layer (each tile matrix is identity and maps (x,y) to itself)", () => {
    const w = 400;
    const h = 200;
    const mesh = defaultMesh(0, 0, w, h, 3, 3);
    const tiles = meshTiles(w, h, mesh);

    assert.equal(tiles.length, 4, "3x3 control points forms 2x2 = 4 cells");
    for (const tile of tiles) {
      const [sx, sy, sw, sh] = tile.srcRect;
      // Corners of source rect map to corners of cell quad with no distortion
      near(apply(tile.matrix3d, sx, sy), [sx, sy]);
      near(apply(tile.matrix3d, sx + sw, sy), [sx + sw, sy]);
      near(apply(tile.matrix3d, sx + sw, sy + sh), [sx + sw, sy + sh]);
      near(apply(tile.matrix3d, sx, sy + sh), [sx, sy + sh]);

      // Midpoint of tile maps to itself
      const midX = sx + sw / 2;
      const midY = sy + sh / 2;
      near(apply(tile.matrix3d, midX, midY), [midX, midY]);
    }
  });

  it("moving the centre point bends the cells", () => {
    const w = 300;
    const h = 300;
    const mesh = defaultMesh(0, 0, w, h, 3, 3);
    const flatTiles = meshTiles(w, h, mesh);

    // Shift centre point (index 4) by (+40, +30)
    const bentMesh: WarpMesh = {
      cols: 3,
      rows: 3,
      points: mesh.points.map((p, i) => (i === 4 ? [p[0] + 40, p[1] + 30] : [...p])),
    };

    const bentTiles = meshTiles(w, h, bentMesh);
    assert.equal(bentTiles.length, 4);

    // All four cells share the centre point, so their matrices differ from flat
    for (let i = 0; i < 4; i++) {
      assert.notEqual(bentTiles[i].matrix3d, flatTiles[i].matrix3d);
    }

    // Top-left cell's bottom-right corner must land on the moved centre point (150+40, 150+30) = (190, 180)
    const tl = bentTiles[0];
    near(apply(tl.matrix3d, tl.srcRect[0] + tl.srcRect[2], tl.srcRect[1] + tl.srcRect[3]), [190, 180]);

    // Bottom-right cell's top-left corner also lands on (190, 180)
    const br = bentTiles[3];
    near(apply(br.matrix3d, br.srcRect[0], br.srcRect[1]), [190, 180]);
  });

  it("every cell's matrix maps its source rect onto its quad", () => {
    const w = 500;
    const h = 400;
    // An irregular, curved mesh (e.g. 4x3)
    const mesh = defaultMesh(0, 0, w, h, 4, 3);
    // Perturb interior points
    mesh.points[5] = [mesh.points[5][0] + 25, mesh.points[5][1] - 15];
    mesh.points[6] = [mesh.points[6][0] - 20, mesh.points[6][1] + 20];

    assert.ok(isMeshConvex(mesh));
    const tiles = meshTiles(w, h, mesh);
    assert.equal(tiles.length, 6, "3 cols of cells x 2 rows of cells = 6 tiles");

    for (const tile of tiles) {
      const [x, y, tw, th] = tile.srcRect;
      const [tl, tr, br, bl] = tile.quad;

      near(apply(tile.matrix3d, x, y), tl);
      near(apply(tile.matrix3d, x + tw, y), tr);
      near(apply(tile.matrix3d, x + tw, y + th), br);
      near(apply(tile.matrix3d, x, y + th), bl);
    }
  });

  it("isMeshConvex detects folded inside out cells", () => {
    const mesh = defaultMesh(0, 0, 200, 200, 3, 3);
    assert.equal(isMeshConvex(mesh), true);

    // Pull centre point completely past the top-left point to invert cell 0
    const foldedMesh: WarpMesh = {
      cols: 3,
      rows: 3,
      points: mesh.points.map((p, i) => (i === 4 ? [-50, -50] : [...p])),
    };
    assert.equal(isMeshConvex(foldedMesh), false);
  });

  it("subdivideMeshCol and subdivideMeshRow insert points between grid lines", () => {
    const mesh = defaultMesh(0, 0, 300, 200, 3, 3);
    const colSplit = subdivideMeshCol(mesh, 0);
    assert.ok(colSplit);
    assert.equal(colSplit.cols, 4);
    assert.equal(colSplit.rows, 3);
    assert.equal(colSplit.points.length, 12);
    // Interpolated point between (0,0) and (150,0) is (75,0)
    near(colSplit.points[1], [75, 0]);

    const rowSplit = subdivideMeshRow(mesh, 1);
    assert.ok(rowSplit);
    assert.equal(rowSplit.cols, 3);
    assert.equal(rowSplit.rows, 4);
    assert.equal(rowSplit.points.length, 12);
  });
});
