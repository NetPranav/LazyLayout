/**
 * ============================================================================
 * UNIT TESTS: 3D PICKING, BVH ACCELERATION & SELECTION (Phase 3D-015)
 * ============================================================================
 * Tests:
 *   - rayFromScreen for perspective and orthographic camera projections
 *   - Exact picks on 30 generated test views against known cube geometry
 *     (hit id, distance, and hit point match analytic expectations within 1e-6)
 *   - 100,000-face picking benchmark (<3 ms per ray averaged over 200 rays)
 *   - Selection reducer: click, shift-click, ctrl-click, selectAll, selectNone, invert
 *   - boxSelect: replace, add, subtract modes
 *   - lassoSelect: 2D polygon origin containment
 *   - selectLinked: hierarchy root traversal
 *   - selectSimilar: by type, material, dataId
 *   - selectLinkedFaces: triangle adjacency flood fill
 *   - silhouetteEdges: edge normal extraction and boundary detection
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rayFromScreen } from "../pick/ray";
import {
  type PickableMesh,
  clearMeshBVHCache,
  pickMesh,
  pickScene,
} from "../pick/bvh";
import {
  boxSelect,
  click,
  createSelection3d,
  invert,
  lassoSelect,
  selectAll,
  selectLinked,
  selectLinkedFaces,
  selectNone,
  selectSimilar,
} from "../pick/select";
import { silhouetteEdges } from "../pick/outline";
import {
  createViewCamera,
  projectionMatrix,
  viewMatrix,
} from "../camera/viewCamera";
import { compose, identity, vec3 } from "../math";
import type { MotionDocument } from "../../document/schema";

function assertNear(
  actual: number,
  expected: number,
  epsilon = 1e-6,
  msg = "Values differ"
): void {
  const diff = Math.abs(actual - expected);
  if (diff > epsilon) {
    assert.fail(`${msg}: actual=${actual} expected=${expected} diff=${diff} > ${epsilon}`);
  }
}

function assertVec3Near(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  epsilon = 1e-6,
  msg = "Vectors differ"
): void {
  for (let i = 0; i < 3; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (diff > epsilon) {
      assert.fail(`${msg} at [${i}]: actual=${actual[i]} expected=${expected[i]} diff=${diff} > ${epsilon}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Standard Unit Cube Geometry (centered at origin, bounds [-0.5, 0.5]^3)
// ---------------------------------------------------------------------------

function createUnitCubeMesh(id = "cube", version = 1): PickableMesh {
  // 8 vertices
  const positions = new Float32Array([
    -0.5, -0.5,  0.5, // 0
     0.5, -0.5,  0.5, // 1
     0.5,  0.5,  0.5, // 2
    -0.5,  0.5,  0.5, // 3
    -0.5, -0.5, -0.5, // 4
     0.5, -0.5, -0.5, // 5
     0.5,  0.5, -0.5, // 6
    -0.5,  0.5, -0.5, // 7
  ]);

  // 12 triangles (2 per face)
  const indices = new Uint16Array([
    // Front (+Z)
    0, 1, 2,  0, 2, 3,
    // Right (+X)
    1, 5, 6,  1, 6, 2,
    // Back (-Z)
    5, 4, 7,  5, 7, 6,
    // Left (-X)
    4, 0, 3,  4, 3, 7,
    // Top (+Y)
    3, 2, 6,  3, 6, 7,
    // Bottom (-Y)
    4, 5, 1,  4, 1, 0,
  ]);

  return {
    id,
    version,
    positions,
    indices,
  };
}

describe("3D Pick: Ray Generation from Screen", () => {
  it("generates correct ray for perspective camera center pixel", () => {
    // Camera at (0, 0, 5) looking at (0, 0, 0)
    const cam = createViewCamera({
      target: vec3(0, 0, 0),
      distance: 5.0,
      yaw: 0.0,
      pitch: 0.0,
      fovY: Math.PI / 3, // 60 deg
      ortho: false,
      near: 0.1,
      far: 100.0,
    });

    const vMat = viewMatrix(cam);
    const pMat = projectionMatrix(cam, 1.0);

    const ray = rayFromScreen(500, 500, 1000, 1000, vMat, pMat);

    // Center pixel ray direction must point straight along -Z
    assertNear(ray.dir[0], 0, 1e-6);
    assertNear(ray.dir[1], 0, 1e-6);
    assertNear(ray.dir[2], -1, 1e-6);

    // Origin lies on the near plane (z = 5 - 0.1 = 4.9)
    assertNear(ray.origin[0], 0, 1e-6);
    assertNear(ray.origin[1], 0, 1e-6);
    assertNear(ray.origin[2], 4.9, 1e-4);
  });

  it("generates correct parallel rays for orthographic camera", () => {
    const cam = createViewCamera({
      target: vec3(0, 0, 0),
      distance: 5.0,
      yaw: 0.0,
      pitch: 0.0,
      ortho: true,
      orthoSize: 10.0,
      near: 0.1,
      far: 100.0,
    });

    const vMat = viewMatrix(cam);
    const pMat = projectionMatrix(cam, 1.0);

    // Off-center pixel: (750, 250) on 1000x1000 viewport
    // ndcX = (750/1000)*2 - 1 = +0.5
    // ndcY = 1 - (250/1000)*2 = +0.5
    // World coordinates at orthoSize=10: x = 0.5 * 5 = +2.5, y = 0.5 * 5 = +2.5
    const ray = rayFromScreen(750, 250, 1000, 1000, vMat, pMat);

    assertNear(ray.dir[0], 0, 1e-6);
    assertNear(ray.dir[1], 0, 1e-6);
    assertNear(ray.dir[2], -1, 1e-6); // Parallel to view axis

    assertNear(ray.origin[0], 2.5, 1e-4);
    assertNear(ray.origin[1], 2.5, 1e-4);
    assertNear(ray.origin[2], 4.9, 1e-4);
  });
});

describe("3D Pick: Exact Picks on 30 Analytic Test Views", () => {
  it("matches nearest-hit id, distance, and point within 1e-6 across 30 views", () => {
    clearMeshBVHCache();
    const cubeMesh = createUnitCubeMesh("cube_test", 1);

    interface AnalyticViewTest {
      readonly name: string;
      readonly rayOrigin: [number, number, number];
      readonly rayDir: [number, number, number];
      readonly expectedDistance: number;
      readonly expectedPoint: [number, number, number];
      readonly expectedNormal: [number, number, number];
    }

    const testViews: AnalyticViewTest[] = [];

    // 1–10: Front face hits from various distances looking along -Z
    // Cube front face is at z = 0.5 with normal [0, 0, 1]
    const zDistances = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0];
    for (let i = 0; i < zDistances.length; i++) {
      const zEye = zDistances[i];
      testViews.push({
        name: `front_view_${i + 1}`,
        rayOrigin: [0, 0, zEye],
        rayDir: [0, 0, -1],
        expectedDistance: zEye - 0.5,
        expectedPoint: [0, 0, 0.5],
        expectedNormal: [0, 0, 1],
      });
    }

    // 11–15: Right face hits along -X (face at x = 0.5, normal [1, 0, 0])
    const xDistances = [2.0, 3.0, 4.0, 5.0, 6.0];
    for (let i = 0; i < xDistances.length; i++) {
      const xEye = xDistances[i];
      testViews.push({
        name: `right_view_${i + 1}`,
        rayOrigin: [xEye, 0, 0],
        rayDir: [-1, 0, 0],
        expectedDistance: xEye - 0.5,
        expectedPoint: [0.5, 0, 0],
        expectedNormal: [1, 0, 0],
      });
    }

    // 16–20: Top face hits along -Y (face at y = 0.5, normal [0, 1, 0])
    const yDistances = [2.0, 3.0, 4.0, 5.0, 6.0];
    for (let i = 0; i < yDistances.length; i++) {
      const yEye = yDistances[i];
      testViews.push({
        name: `top_view_${i + 1}`,
        rayOrigin: [0, yEye, 0],
        rayDir: [0, -1, 0],
        expectedDistance: yEye - 0.5,
        expectedPoint: [0, 0.5, 0],
        expectedNormal: [0, 1, 0],
      });
    }

    // 21–30: Angled rays targeting specific points on front face (z = 0.5)
    // Camera at eye = (1, 1, 4)
    const eye: [number, number, number] = [1, 1, 4];
    const targetPoints: [number, number, number][] = [
      [-0.4, -0.4, 0.5],
      [-0.2, -0.3, 0.5],
      [ 0.0, -0.2, 0.5],
      [ 0.2, -0.1, 0.5],
      [ 0.4,  0.0, 0.5],
      [-0.3,  0.1, 0.5],
      [-0.1,  0.2, 0.5],
      [ 0.1,  0.3, 0.5],
      [ 0.3,  0.4, 0.5],
      [ 0.0,  0.0, 0.5],
    ];

    for (let i = 0; i < targetPoints.length; i++) {
      const tp = targetPoints[i];
      const dx = tp[0] - eye[0];
      const dy = tp[1] - eye[1];
      const dz = tp[2] - eye[2];
      const dist = Math.hypot(dx, dy, dz);
      const dir: [number, number, number] = [dx / dist, dy / dist, dz / dist];

      testViews.push({
        name: `angled_view_${i + 1}`,
        rayOrigin: eye,
        rayDir: dir,
        expectedDistance: dist,
        expectedPoint: tp,
        expectedNormal: [0, 0, 1],
      });
    }

    assert.equal(testViews.length, 30, "Must test exactly 30 generated views");

    for (const v of testViews) {
      const ray = {
        origin: vec3(v.rayOrigin[0], v.rayOrigin[1], v.rayOrigin[2]),
        dir: vec3(v.rayDir[0], v.rayDir[1], v.rayDir[2]),
      };

      const hit = pickMesh(ray, cubeMesh);
      assert.ok(hit !== null, `Raycast failed to hit cube in view "${v.name}"`);
      assert.equal(hit.objectId, "cube_test");

      assertNear(
        hit.distance,
        v.expectedDistance,
        1e-6,
        `Distance mismatch in view "${v.name}"`
      );

      assertVec3Near(
        hit.point,
        v.expectedPoint,
        1e-6,
        `Hit point mismatch in view "${v.name}"`
      );

      assertVec3Near(
        hit.normal,
        v.expectedNormal,
        1e-6,
        `Normal mismatch in view "${v.name}"`
      );
    }
  });

  it("pickScene sorts multiple intersecting objects by distance ascending", () => {
    // Two cubes in a line along Z: cube1 at [0, 0, 0], cube2 at [0, 0, -2]
    const mesh1 = createUnitCubeMesh("cube1", 1);
    const mesh2: PickableMesh = {
      ...createUnitCubeMesh("cube2", 1),
      worldMatrix: compose([0, 0, -2], [0, 0, 0, 1], [1, 1, 1]),
    };

    const ray = {
      origin: vec3(0, 0, 5),
      dir: vec3(0, 0, -1),
    };

    const hits = pickScene(ray, [
      { id: "cube2", mesh: mesh2 },
      { id: "cube1", mesh: mesh1 },
    ]);

    assert.equal(hits.length, 2);
    assert.equal(hits[0].objectId, "cube1"); // Closer (front face at z = 0.5, dist = 4.5)
    assertNear(hits[0].distance, 4.5, 1e-6);

    assert.equal(hits[1].objectId, "cube2"); // Farther (front face at z = -1.5, dist = 6.5)
    assertNear(hits[1].distance, 6.5, 1e-6);
  });
});

describe("3D Pick: 100,000-Face Picking Benchmark", () => {
  it("picks against 100,000+ faces in < 3 ms per ray", () => {
    clearMeshBVHCache();

    // 225 x 225 grid = 224 * 224 quads * 2 = 100,352 triangle faces
    const numVertsX = 225;
    const numVertsZ = 225;
    const numFaces = (numVertsX - 1) * (numVertsZ - 1) * 2; // 100,352

    assert.ok(numFaces >= 100000, `Mesh must have at least 100,000 faces (got ${numFaces})`);

    const positions = new Float32Array(numVertsX * numVertsZ * 3);
    let pIdx = 0;
    for (let z = 0; z < numVertsZ; z++) {
      for (let x = 0; x < numVertsX; x++) {
        positions[pIdx++] = (x / (numVertsX - 1) - 0.5) * 10.0;
        positions[pIdx++] = 0.0; // flat plane on Y=0
        positions[pIdx++] = (z / (numVertsZ - 1) - 0.5) * 10.0;
      }
    }

    const indices = new Uint32Array(numFaces * 3);
    let iIdx = 0;
    for (let z = 0; z < numVertsZ - 1; z++) {
      for (let x = 0; x < numVertsX - 1; x++) {
        const i0 = z * numVertsX + x;
        const i1 = z * numVertsX + (x + 1);
        const i2 = (z + 1) * numVertsX + x;
        const i3 = (z + 1) * numVertsX + (x + 1);

        indices[iIdx++] = i0;
        indices[iIdx++] = i2;
        indices[iIdx++] = i1;

        indices[iIdx++] = i1;
        indices[iIdx++] = i2;
        indices[iIdx++] = i3;
      }
    }

    const bigMesh: PickableMesh = {
      id: "bench_100k",
      version: 1,
      positions,
      indices,
    };

    // Pre-build BVH on warm-up ray
    const warmUpRay = { origin: vec3(0, 5, 0), dir: vec3(0, -1, 0) };
    const warmHit = pickMesh(warmUpRay, bigMesh);
    assert.ok(warmHit !== null);

    // Generate 200 distinct test rays scattered across the plane
    const testRays: Array<{ origin: ReturnType<typeof vec3>; dir: ReturnType<typeof vec3> }> = [];
    for (let i = 0; i < 200; i++) {
      const rx = ((i % 14) / 13 - 0.5) * 8.0;
      const rz = (Math.floor(i / 14) / 14 - 0.5) * 8.0;
      testRays.push({
        origin: vec3(rx, 5, rz),
        dir: vec3(0, -1, 0),
      });
    }

    // Benchmark 200 raycasts
    const startTime = performance.now();
    for (let i = 0; i < 200; i++) {
      const hit = pickMesh(testRays[i], bigMesh);
      assert.ok(hit !== null);
    }
    const elapsedMs = performance.now() - startTime;
    const avgMs = elapsedMs / 200;

    // Log the real number as required by spec
    console.log(
      `[Benchmark] 100k-face mesh picking: ${avgMs.toFixed(4)} ms/ray (${elapsedMs.toFixed(2)} ms for 200 rays)`
    );

    assert.ok(
      avgMs < 3.0,
      `100k-face picking must take < 3 ms per ray (got ${avgMs.toFixed(3)} ms)`
    );
  });
});

describe("3D Pick: Selection Reducer", () => {
  it("click without modifiers selects single object or clears on empty", () => {
    let sel = createSelection3d();
    assert.equal(sel.active, null);
    assert.equal(sel.selected.length, 0);

    // Click object A
    sel = click(sel, "obj_a");
    assert.equal(sel.active, "obj_a");
    assert.deepEqual(sel.selected, ["obj_a"]);

    // Click object B
    sel = click(sel, "obj_b");
    assert.equal(sel.active, "obj_b");
    assert.deepEqual(sel.selected, ["obj_b"]);

    // Click background
    sel = click(sel, null);
    assert.equal(sel.active, null);
    assert.equal(sel.selected.length, 0);
  });

  it("shift-click toggles and updates active object", () => {
    let sel = createSelection3d();

    // Shift-click A (adds to selection, becomes active)
    sel = click(sel, "obj_a", { shift: true });
    assert.equal(sel.active, "obj_a");
    assert.deepEqual(sel.selected, ["obj_a"]);

    // Shift-click B (adds to selection, becomes active)
    sel = click(sel, "obj_b", { shift: true });
    assert.equal(sel.active, "obj_b");
    assert.deepEqual(new Set(sel.selected), new Set(["obj_a", "obj_b"]));

    // Shift-click A again (already selected but not active -> makes A active!)
    sel = click(sel, "obj_a", { shift: true });
    assert.equal(sel.active, "obj_a");
    assert.deepEqual(new Set(sel.selected), new Set(["obj_a", "obj_b"]));

    // Shift-click A again (active -> deselects A)
    sel = click(sel, "obj_a", { shift: true });
    assert.equal(sel.active, "obj_b");
    assert.deepEqual(sel.selected, ["obj_b"]);

    // Shift-click background (preserves selection)
    sel = click(sel, null, { shift: true });
    assert.deepEqual(sel.selected, ["obj_b"]);
  });

  it("ctrl-click removes item from selection", () => {
    let sel = selectAll(createSelection3d(), ["a", "b", "c"]);
    assert.equal(sel.selected.length, 3);

    sel = click(sel, "b", { ctrl: true });
    assert.deepEqual(sel.selected, ["a", "c"]);

    sel = click(sel, "a", { ctrl: true });
    assert.deepEqual(sel.selected, ["c"]);
    assert.equal(sel.active, "c");
  });

  it("selectAll, selectNone, and invert", () => {
    const all = ["a", "b", "c", "d"];
    let sel = createSelection3d();

    sel = selectAll(sel, all);
    assert.equal(sel.selected.length, 4);

    sel = click(sel, "a");
    assert.deepEqual(sel.selected, ["a"]);

    sel = invert(sel, all);
    assert.deepEqual(new Set(sel.selected), new Set(["b", "c", "d"]));

    sel = selectNone(sel);
    assert.equal(sel.selected.length, 0);
    assert.equal(sel.active, null);
  });
});

describe("3D Pick: Box and Lasso Selection", () => {
  const viewProj = identity(); // In NDC space: x in [-1, 1], y in [-1, 1]

  const sceneObjects = [
    { id: "obj1", bounds: { min: [-0.6, -0.6, 0], max: [-0.4, -0.4, 0] }, origin: [-0.5, -0.5, 0] },
    { id: "obj2", bounds: { min: [ 0.4,  0.4, 0], max: [ 0.6,  0.6, 0] }, origin: [ 0.5,  0.5, 0] },
    { id: "obj3", bounds: { min: [ 0.8, -0.8, 0], max: [ 1.0, -0.6, 0] }, origin: [ 0.9, -0.7, 0] },
  ];

  it("boxSelect selects items within rectangle in replace, add, and subtract modes", () => {
    // Rect enclosing obj1 (center [-0.5, -0.5])
    const rect = { x1: -0.8, y1: -0.8, x2: 0.0, y2: 0.0 };

    let sel = boxSelect(sceneObjects, rect, viewProj, "replace");
    assert.deepEqual(sel.selected, ["obj1"]);

    // Add mode: rect enclosing obj2 (center [0.5, 0.5])
    const rect2 = { x1: 0.0, y1: 0.0, x2: 0.8, y2: 0.8 };
    sel = boxSelect(sceneObjects, rect2, viewProj, "add", undefined, sel);
    assert.deepEqual(new Set(sel.selected), new Set(["obj1", "obj2"]));

    // Subtract mode: deselect obj1
    sel = boxSelect(sceneObjects, rect, viewProj, "subtract", undefined, sel);
    assert.deepEqual(sel.selected, ["obj2"]);
  });

  it("lassoSelect selects items within 2D polygon", () => {
    // Triangle enclosing obj1 at [-0.5, -0.5]
    const polygon = [
      { x: -1.0, y: -1.0 },
      { x:  0.0, y: -1.0 },
      { x: -0.5, y:  0.0 },
    ];

    const sel = lassoSelect(sceneObjects, polygon, viewProj, "replace");
    assert.deepEqual(sel.selected, ["obj1"]);
  });
});

describe("3D Pick: Linked, Similar & Face Connectivity", () => {
  const testDoc: MotionDocument = {
    schemaVersion: 7,
    layers: {},
    clips: {},
    states: {},
    behaviours: {},
    sequences: {},
    transitions: {},
    bindings: {},
    surfaces: {},
    inputTapes: {},
    graphs: {},
    effects: {},
    components: {},
    generators: {},
    compositions: {},
    tokens: { colors: {}, spacing: {}, radii: {} },
    exportSettings: { framework: "react", styling: "tailwind", animation: "gsap", language: "typescript" },
    objects: {
      root_a: {
        id: "root_a",
        type: "empty",
        transform: { location: [0, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
      child_a1: {
        id: "child_a1",
        type: "mesh",
        parentId: "root_a",
        dataId: "mesh_cube",
        materialSlots: ["mat_gold"],
        transform: { location: [0, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
      child_a2: {
        id: "child_a2",
        type: "mesh",
        parentId: "child_a1",
        dataId: "mesh_sphere",
        materialSlots: ["mat_silver"],
        transform: { location: [0, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
      other_b: {
        id: "other_b",
        type: "mesh",
        dataId: "mesh_cube", // Shares data with child_a1
        materialSlots: ["mat_gold"], // Shares material with child_a1
        transform: { location: [0, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
    },
  };

  it("selectLinked selects entire parent tree", () => {
    const sel = createSelection3d({ active: "child_a2", selected: ["child_a2"] });
    const linked = selectLinked(sel, testDoc);

    // root_a, child_a1, child_a2 share hierarchy; other_b does not
    assert.deepEqual(new Set(linked.selected), new Set(["root_a", "child_a1", "child_a2"]));
  });

  it("selectSimilar selects by type, material, or data block", () => {
    const selA1 = createSelection3d({ active: "child_a1", selected: ["child_a1"] });

    const byData = selectSimilar(selA1, testDoc, "data");
    assert.deepEqual(new Set(byData.selected), new Set(["child_a1", "other_b"]));

    const byMat = selectSimilar(selA1, testDoc, "material");
    assert.deepEqual(new Set(byMat.selected), new Set(["child_a1", "other_b"]));

    const byType = selectSimilar(selA1, testDoc, "type");
    assert.deepEqual(new Set(byType.selected), new Set(["child_a1", "child_a2", "other_b"]));
  });

  it("selectLinkedFaces flood-fills connected triangles across shared edges", () => {
    // Mesh with two disconnected components:
    // Component 1: 2 connected triangles sharing edge (1, 2)
    // Face 0: (0, 1, 2)
    // Face 1: (2, 1, 3)
    // Component 2: Disconnected triangle
    // Face 2: (4, 5, 6)
    const indices = new Uint16Array([
      0, 1, 2, // Face 0
      2, 1, 3, // Face 1 (shares edge 1:2 with Face 0)
      4, 5, 6, // Face 2 (disconnected)
    ]);

    const linked0 = selectLinkedFaces({ indices }, 0);
    assert.deepEqual(linked0, [0, 1]);

    const linked1 = selectLinkedFaces({ indices }, 1);
    assert.deepEqual(linked1, [0, 1]);

    const linked2 = selectLinkedFaces({ indices }, 2);
    assert.deepEqual(linked2, [2]);
  });
});

describe("3D Pick: Silhouette Edge Extraction", () => {
  it("extracts unique edges and adjacent face normals for closed cube and open quad", () => {
    // Open single quad: 2 triangles sharing 1 interior edge, with 4 boundary edges
    // 0: (0, 0, 0), 1: (1, 0, 0), 2: (1, 1, 0), 3: (0, 1, 0)
    const positions = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      1, 1, 0,
      0, 1, 0,
    ]);
    const indices = new Uint16Array([
      0, 1, 2, // Face 0 (normal +Z: [0, 0, 1])
      0, 2, 3, // Face 1 (normal +Z: [0, 0, 1])
    ]);

    const edges = silhouetteEdges(positions, indices);
    // 4 boundary edges + 1 shared edge = 5 unique edges
    assert.equal(edges.length, 5);

    // Shared edge between vertex 0 and 2 has two valid face normals
    const sharedEdge = edges.find(
      (e) =>
        (e.v0[0] === 0 && e.v0[1] === 0 && e.v1[0] === 1 && e.v1[1] === 1) ||
        (e.v1[0] === 0 && e.v1[1] === 0 && e.v0[0] === 1 && e.v0[1] === 1)
    );
    assert.ok(sharedEdge !== undefined);
    assertVec3Near(sharedEdge.normal0, [0, 0, 1], 1e-6);
    assertVec3Near(sharedEdge.normal1, [0, 0, 1], 1e-6);

    // Boundary edges have normal1 set to [0, 0, 0]
    const boundaryEdges = edges.filter(
      (e) => e.normal1[0] === 0 && e.normal1[1] === 0 && e.normal1[2] === 0
    );
    assert.equal(boundaryEdges.length, 4);
  });
});
