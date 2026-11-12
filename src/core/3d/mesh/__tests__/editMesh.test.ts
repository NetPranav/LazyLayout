/**
 * ============================================================================
 * UNIT TESTS: EDIT MESH (Phase 3D-013)
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { EditMesh } from "../editMesh";

function approxEqual(a: number, b: number, eps = 1e-5): boolean {
  return Math.abs(a - b) <= eps;
}

function triangleArea3D(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;

  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;

  const crossX = aby * acz - abz * acy;
  const crossY = abz * acx - abx * acz;
  const crossZ = abx * acy - aby * acx;

  return 0.5 * Math.hypot(crossX, crossY, crossZ);
}

describe("EditMesh Core Operations", () => {
  it("creates vertices, edges and faces", () => {
    const mesh = new EditMesh();
    const v0 = mesh.addVert([0, 0, 0]);
    const v1 = mesh.addVert([1, 0, 0]);
    const v2 = mesh.addVert([0, 1, 0]);

    assert.strictEqual(mesh.verts.length, 3);
    const face = mesh.addFace([v0, v1, v2]);

    assert.strictEqual(mesh.faces.length, 1);
    assert.strictEqual(mesh.edges.length, 3);
    assert.strictEqual(face.len, 3);

    const errors = mesh.validate();
    assert.strictEqual(errors.length, 0, errors.join(", "));
  });

  it("splits an edge between two faces", () => {
    const mesh = new EditMesh();
    const v0 = mesh.addVert([0, 0, 0]);
    const v1 = mesh.addVert([1, 0, 0]);
    const v2 = mesh.addVert([1, 1, 0]);
    const v3 = mesh.addVert([0, 1, 0]);

    // Two triangles sharing edge (v1, v3)
    mesh.addFace([v0, v1, v3]);
    mesh.addFace([v1, v2, v3]);

    const sharedEdge = mesh.findEdge(v1, v3);
    assert.ok(sharedEdge);

    const { vert: vMid, edge: newEdge } = mesh.splitEdge(sharedEdge, 0.5);

    assert.ok(vMid);
    assert.ok(newEdge);
    assert.ok(approxEqual(vMid.co[0], 0.5));
    assert.ok(approxEqual(vMid.co[1], 0.5));

    // Both faces now have 4 vertices (quads)
    assert.strictEqual(mesh.faces[0].len, 4);
    assert.strictEqual(mesh.faces[1].len, 4);

    const errors = mesh.validate();
    assert.strictEqual(errors.length, 0, errors.join(", "));
  });

  it("dissolves an edge shared by two triangles to form a quad", () => {
    const mesh = new EditMesh();
    const v0 = mesh.addVert([0, 0, 0]);
    const v1 = mesh.addVert([1, 0, 0]);
    const v2 = mesh.addVert([1, 1, 0]);
    const v3 = mesh.addVert([0, 1, 0]);

    // Two triangles forming a square
    mesh.addFace([v0, v1, v2]);
    mesh.addFace([v0, v2, v3]);

    const diagonal = mesh.findEdge(v0, v2);
    assert.ok(diagonal);

    const merged = mesh.dissolveEdge(diagonal);
    assert.ok(merged);
    assert.strictEqual(mesh.faces.length, 1);
    assert.strictEqual(merged.len, 4);

    const errors = mesh.validate();
    assert.strictEqual(errors.length, 0, errors.join(", "));
  });

  it("flips face winding order", () => {
    const mesh = new EditMesh();
    const v0 = mesh.addVert([0, 0, 0]);
    const v1 = mesh.addVert([1, 0, 0]);
    const v2 = mesh.addVert([0, 1, 0]);
    const f = mesh.addFace([v0, v1, v2]);

    assert.strictEqual(f.l.v, v0);
    assert.strictEqual(f.l.next.v, v1);
    assert.strictEqual(f.l.next.next.v, v2);

    mesh.flipFace(f);

    assert.strictEqual(f.l.v, v0);
    assert.strictEqual(f.l.next.v, v2);
    assert.strictEqual(f.l.next.next.v, v1);

    const errors = mesh.validate();
    assert.strictEqual(errors.length, 0, errors.join(", "));
  });

  it("extrudes faces along an offset vector", () => {
    const mesh = new EditMesh();
    const v0 = mesh.addVert([0, 0, 0]);
    const v1 = mesh.addVert([1, 0, 0]);
    const v2 = mesh.addVert([1, 1, 0]);
    const v3 = mesh.addVert([0, 1, 0]);
    const baseFace = mesh.addFace([v0, v1, v2, v3]);

    const caps = mesh.extrudeFaces([baseFace], [0, 0, 2]);
    assert.strictEqual(caps.length, 1);

    // 4 side quads + 1 top cap = 5 faces
    assert.strictEqual(mesh.faces.length, 5);

    const b = mesh.bounds();
    assert.ok(approxEqual(b.min[2], 0));
    assert.ok(approxEqual(b.max[2], 2));

    const errors = mesh.validate();
    assert.strictEqual(errors.length, 0, errors.join(", "));
  });

  it("stores and retrieves attribute layers", () => {
    const mesh = new EditMesh();
    const v0 = mesh.addVert([0, 0, 0]);
    const v1 = mesh.addVert([1, 0, 0]);
    const v2 = mesh.addVert([0, 1, 0]);
    const face = mesh.addFace([v0, v1, v2]);

    mesh.setVertexAttribute(v0, "color", [1, 0, 0, 1]);
    assert.deepEqual(mesh.getVertexAttribute(v0, "color"), [1, 0, 0, 1]);

    mesh.setFaceAttribute(face, "materialIndex", [2]);
    assert.deepEqual(mesh.getFaceAttribute(face, "materialIndex"), [2]);

    mesh.setLoopAttribute(face.l, "uv", [0.5, 0.5]);
    assert.deepEqual(mesh.getLoopAttribute(face.l, "uv"), [0.5, 0.5]);
  });

  it("calculates accurate bounding box", () => {
    const mesh = new EditMesh();
    mesh.addVert([-2, 5, 1]);
    mesh.addVert([3, -1, 4]);
    mesh.addVert([0, 2, -3]);

    const b = mesh.bounds();
    assert.deepEqual(b.min, [-2, -1, -3]);
    assert.deepEqual(b.max, [3, 5, 4]);
  });
});

describe("Test (b): Triangulation of concave n-gon covers area exactly", () => {
  it("triangulates planar L-shaped concave polygon with exact area", () => {
    const mesh = new EditMesh();
    // L-shaped polygon:
    // (0, 0) -> (3, 0) -> (3, 1) -> (1, 1) -> (1, 3) -> (0, 3)
    // Area = 3*3 (outer) - 2*2 (missing upper-right) = 9 - 4 = 5.0
    const v0 = mesh.addVert([0, 0, 0]);
    const v1 = mesh.addVert([3, 0, 0]);
    const v2 = mesh.addVert([3, 1, 0]);
    const v3 = mesh.addVert([1, 1, 0]); // concave inner corner
    const v4 = mesh.addVert([1, 3, 0]);
    const v5 = mesh.addVert([0, 3, 0]);

    mesh.addFace([v0, v1, v2, v3, v4, v5]);

    const tri = mesh.toTriangles();
    const triCount = tri.indices.length / 3;
    assert.strictEqual(triCount, 4); // 6-gon -> 4 triangles

    let totalArea = 0;
    for (let t = 0; t < triCount; t++) {
      const i0 = tri.indices[t * 3 + 0];
      const i1 = tri.indices[t * 3 + 1];
      const i2 = tri.indices[t * 3 + 2];

      const ax = tri.positions[i0 * 3 + 0];
      const ay = tri.positions[i0 * 3 + 1];
      const az = tri.positions[i0 * 3 + 2];

      const bx = tri.positions[i1 * 3 + 0];
      const by = tri.positions[i1 * 3 + 1];
      const bz = tri.positions[i1 * 3 + 2];

      const cx = tri.positions[i2 * 3 + 0];
      const cy = tri.positions[i2 * 3 + 1];
      const cz = tri.positions[i2 * 3 + 2];

      totalArea += triangleArea3D(ax, ay, az, bx, by, bz, cx, cy, cz);
    }

    assert.ok(
      approxEqual(totalArea, 5.0, 1e-4),
      `Expected area 5.0, got ${totalArea}`
    );
  });

  it("triangulates tilted concave arrow polygon in 3D with exact area", () => {
    const mesh = new EditMesh();
    // Concave arrow shape on plane Z = 2.5
    // Base rect (0,0) to (2,1): area = 2.0
    // Triangle cap from (-1,1) to (3,1) with apex (1,3): base = 4, height = 2, area = 4.0
    // Total area = 6.0
    const z = 2.5;
    const v0 = mesh.addVert([0, 0, z]);
    const v1 = mesh.addVert([2, 0, z]);
    const v2 = mesh.addVert([2, 1, z]);
    const v3 = mesh.addVert([3, 1, z]);
    const v4 = mesh.addVert([1, 3, z]);
    const v5 = mesh.addVert([-1, 1, z]);
    const v6 = mesh.addVert([0, 1, z]);

    mesh.addFace([v0, v1, v2, v3, v4, v5, v6]);

    const tri = mesh.toTriangles();
    const triCount = tri.indices.length / 3;
    assert.strictEqual(triCount, 5); // 7-gon -> 5 triangles

    let totalArea = 0;
    for (let t = 0; t < triCount; t++) {
      const i0 = tri.indices[t * 3 + 0];
      const i1 = tri.indices[t * 3 + 1];
      const i2 = tri.indices[t * 3 + 2];

      const ax = tri.positions[i0 * 3 + 0];
      const ay = tri.positions[i0 * 3 + 1];
      const az = tri.positions[i0 * 3 + 2];

      const bx = tri.positions[i1 * 3 + 0];
      const by = tri.positions[i1 * 3 + 1];
      const bz = tri.positions[i1 * 3 + 2];

      const cx = tri.positions[i2 * 3 + 0];
      const cy = tri.positions[i2 * 3 + 1];
      const cz = tri.positions[i2 * 3 + 2];

      totalArea += triangleArea3D(ax, ay, az, bx, by, bz, cx, cy, cz);
    }

    assert.ok(
      approxEqual(totalArea, 6.0, 1e-4),
      `Expected area 6.0, got ${totalArea}`
    );
  });
});

describe("Test (c): Round trip fromTriangles/toTriangles for cube and sphere", () => {
  it("keeps vertex positions and triangle count for a cube", () => {
    // 8 vertices, 12 triangles (36 indices)
    const cubePositions = new Float32Array([
      -1, -1, -1,
       1, -1, -1,
       1,  1, -1,
      -1,  1, -1,
      -1, -1,  1,
       1, -1,  1,
       1,  1,  1,
      -1,  1,  1,
    ]);

    const cubeIndices = new Uint32Array([
      // Front (-Z)
      0, 2, 1,  0, 3, 2,
      // Back (+Z)
      4, 5, 6,  4, 6, 7,
      // Left (-X)
      0, 7, 3,  0, 4, 7,
      // Right (+X)
      1, 2, 6,  1, 6, 5,
      // Top (+Y)
      2, 3, 7,  2, 7, 6,
      // Bottom (-Y)
      0, 1, 5,  0, 5, 4,
    ]);

    const mesh = EditMesh.fromTriangles(cubePositions, cubeIndices);
    assert.strictEqual(mesh.verts.length, 8);
    assert.strictEqual(mesh.faces.length, 12);

    const out = mesh.toTriangles();
    assert.strictEqual(out.indices.length, cubeIndices.length);
    assert.strictEqual(out.positions.length, cubePositions.length);

    for (let i = 0; i < cubePositions.length; i++) {
      assert.ok(
        approxEqual(out.positions[i], cubePositions[i], 1e-5),
        `Mismatch at pos index ${i}: expected ${cubePositions[i]}, got ${out.positions[i]}`
      );
    }

    const errors = mesh.validate();
    assert.strictEqual(errors.length, 0, errors.join(", "));
  });

  it("keeps vertex positions and triangle count for a UV sphere", () => {
    // Generate UV sphere
    const rings = 8;
    const segments = 12;
    const positions: number[] = [];
    const indices: number[] = [];

    for (let r = 0; r <= rings; r++) {
      const theta = (r * Math.PI) / rings;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let s = 0; s <= segments; s++) {
        const phi = (s * 2 * Math.PI) / segments;
        const x = Math.cos(phi) * sinTheta;
        const y = cosTheta;
        const z = Math.sin(phi) * sinTheta;
        positions.push(x, y, z);
      }
    }

    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segments; s++) {
        const first = r * (segments + 1) + s;
        const second = first + segments + 1;
        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    const posArray = new Float32Array(positions);
    const idxArray = new Uint32Array(indices);

    const mesh = EditMesh.fromTriangles(posArray, idxArray);
    const out = mesh.toTriangles();

    assert.strictEqual(out.indices.length, idxArray.length);
    assert.strictEqual(out.positions.length, posArray.length);

    for (let i = 0; i < posArray.length; i++) {
      assert.ok(
        approxEqual(out.positions[i], posArray[i], 1e-5),
        `Sphere pos mismatch at index ${i}`
      );
    }

    const errors = mesh.validate();
    assert.strictEqual(errors.length, 0, errors.join(", "));
  });
});

describe("Test (a): fast-check property test with 10,000 random edit sequences", () => {
  it("keeps validate() empty across 10,000 random edit sequences", () => {
    type OpType =
      | "addVert"
      | "addFace"
      | "removeFace"
      | "removeEdge"
      | "removeVert"
      | "splitEdge"
      | "dissolveEdge"
      | "extrudeFaces";

    interface Action {
      op: OpType;
      dx: number;
      dy: number;
      dz: number;
      splitFactor: number;
      pickIndex: number;
    }

    const actionArbitrary = fc.record({
      op: fc.constantFrom<OpType>(
        "addVert",
        "addFace",
        "removeFace",
        "removeEdge",
        "removeVert",
        "splitEdge",
        "dissolveEdge",
        "extrudeFaces"
      ),
      dx: fc.double({ min: -5, max: 5, noNaN: true }),
      dy: fc.double({ min: -5, max: 5, noNaN: true }),
      dz: fc.double({ min: -5, max: 5, noNaN: true }),
      splitFactor: fc.double({ min: 0.1, max: 0.9, noNaN: true }),
      pickIndex: fc.integer({ min: 0, max: 100 }),
    });

    fc.assert(
      fc.property(
        fc.array(actionArbitrary, { minLength: 1, maxLength: 4 }),
        (actions: Action[]) => {
          // Initialize fresh base mesh with two connected triangles
          const mesh = new EditMesh();
          const v0 = mesh.addVert([0, 0, 0]);
          const v1 = mesh.addVert([1, 0, 0]);
          const v2 = mesh.addVert([1, 1, 0]);
          const v3 = mesh.addVert([0, 1, 0]);

          mesh.addFace([v0, v1, v2]);
          mesh.addFace([v0, v2, v3]);

          for (let i = 0; i < actions.length; i++) {
            const act = actions[i];
            switch (act.op) {
              case "addVert": {
                mesh.addVert([act.dx, act.dy, act.dz]);
                break;
              }
              case "addFace": {
                if (mesh.verts.length < 3) {
                  mesh.addVert([act.dx, act.dy, 0]);
                  mesh.addVert([act.dx + 1, act.dy, 0]);
                  mesh.addVert([act.dx, act.dy + 1, 0]);
                }
                const n = mesh.verts.length;
                const i0 = act.pickIndex % n;
                const i1 = (act.pickIndex + 1) % n;
                const i2 = (act.pickIndex + 2) % n;
                const vA = mesh.verts[i0];
                const vB = mesh.verts[i1];
                const vC = mesh.verts[i2];
                if (vA !== vB && vB !== vC && vA !== vC) {
                  mesh.addFace([vA, vB, vC]);
                }
                break;
              }
              case "removeFace": {
                if (mesh.faces.length > 0) {
                  const target = mesh.faces[act.pickIndex % mesh.faces.length];
                  mesh.removeFace(target);
                }
                break;
              }
              case "removeEdge": {
                if (mesh.edges.length > 0) {
                  const target = mesh.edges[act.pickIndex % mesh.edges.length];
                  mesh.removeEdge(target);
                }
                break;
              }
              case "removeVert": {
                if (mesh.verts.length > 0) {
                  const target = mesh.verts[act.pickIndex % mesh.verts.length];
                  mesh.removeVert(target);
                }
                break;
              }
              case "splitEdge": {
                if (mesh.edges.length > 0) {
                  const target = mesh.edges[act.pickIndex % mesh.edges.length];
                  mesh.splitEdge(target, act.splitFactor);
                }
                break;
              }
              case "dissolveEdge": {
                if (mesh.edges.length > 0) {
                  const target = mesh.edges[act.pickIndex % mesh.edges.length];
                  mesh.dissolveEdge(target);
                }
                break;
              }
              case "extrudeFaces": {
                if (mesh.faces.length > 0) {
                  const target = mesh.faces[act.pickIndex % mesh.faces.length];
                  mesh.extrudeFaces([target], [act.dx * 0.1, act.dy * 0.1, 1]);
                }
                break;
              }
            }
          }

          const errors = mesh.validate();
          assert.strictEqual(
            errors.length,
            0,
            `Invariant violations detected:\n${errors.join("\n")}`
          );
        }
      ),
      { numRuns: 10_000 }
    );
  });
});
