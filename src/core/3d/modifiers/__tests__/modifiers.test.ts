import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { MeshData } from "../types";
import type { Modifier3d, MotionDocument } from "../../../document/schema";
import {
  evaluateStack,
  evaluateModifiersWorker,
  applyModifier,
  applyAll,
  reorderModifier,
  addModifier,
  removeModifier,
  setModifierParam,
  setModifierVisibility,
  clearModifierCache,
} from "../stack";
import { handlers, type HandlerContext } from "../../../jobs/handlers";

function createCubeMesh(): MeshData {
  const positions = new Float32Array([
    // Front face
    -0.5, -0.5,  0.5, // 0
     0.5, -0.5,  0.5, // 1
     0.5,  0.5,  0.5, // 2
    -0.5,  0.5,  0.5, // 3
    // Back face
    -0.5, -0.5, -0.5, // 4
     0.5, -0.5, -0.5, // 5
     0.5,  0.5, -0.5, // 6
    -0.5,  0.5, -0.5, // 7
  ]);
  const indices = new Uint32Array([
    0, 1, 2,  0, 2, 3, // front
    5, 4, 7,  5, 7, 6, // back
    4, 0, 3,  4, 3, 7, // left
    1, 5, 6,  1, 6, 2, // right
    3, 2, 6,  3, 6, 7, // top
    4, 5, 1,  4, 1, 0, // bottom
  ]);
  return { positions, indices };
}

function assertNear(a: number, b: number, tol = 1e-4, msg?: string): void {
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? "Float mismatch"}: expected ${b}, got ${a}`);
}

describe("Phase 3D-030: Modifier Stack Pure Evaluation", () => {
  it("stacks of 5 modifiers evaluate to golden mesh with exact vertex count and deterministic positions", () => {
    clearModifierCache();
    const cube = createCubeMesh();

    const stack: Modifier3d[] = [
      {
        id: "mod_xform",
        type: "transform",
        params: { scale: [2, 1, 1], translation: [1, 0, 0], rotation: [0, 0, 0] },
      },
      {
        id: "mod_array",
        type: "array",
        params: { count: 2, relativeOffset: [1, 0, 0] },
      },
      {
        id: "mod_mirror",
        type: "mirror",
        params: { axis: "y", merge: true },
      },
      {
        id: "mod_solid",
        type: "solidify",
        params: { thickness: 0.1, offset: -1 },
      },
      {
        id: "mod_disp",
        type: "displace",
        params: { strength: 0.05, seed: 42, scale: 1 },
      },
    ];

    const result = evaluateStack(cube, stack, { viewport: true });

    // Step-by-step verification:
    // cube: 8 vertices, 12 triangles (36 indices)
    // transform: 8 vertices
    // array count 2: 16 vertices, 24 triangles
    // mirror axis y: 32 vertices, 48 triangles
    // solidify: 64 vertices, 96 triangles (288 indices)
    // displace: 64 vertices, 96 triangles
    assert.equal(result.positions.length / 3, 64, "Vertex count after 5 modifiers must be 64");
    assert.equal(result.indices.length, 288, "Index count after 5 modifiers must be 288 (96 triangles)");

    // Deterministic bounds verification
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < result.positions.length; i += 3) {
      const x = result.positions[i];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    // Cube (-0.5..0.5) scaled by 2 -> (-1..1), translated by 1 -> (0..2).
    // Array count 2 with relativeOffset [1, 0, 0] (dim 2) -> spans 0..4.
    // Displace with strength 0.05 modifies slightly around 0..4.
    assert.ok(minX >= -0.2 && minX <= 0.1, `minX should be near 0, got ${minX}`);
    assert.ok(maxX >= 3.9 && maxX <= 4.2, `maxX should be near 4, got ${maxX}`);
  });

  it("reordering changes the result (array then mirror differs from mirror then array)", () => {
    clearModifierCache();
    // Offset cube so mirroring and arraying are non-symmetric
    const cube = createCubeMesh();
    for (let i = 0; i < cube.positions.length; i += 3) {
      cube.positions[i] += 2.0; // center at X = 2
    }

    const modArray: Modifier3d = {
      id: "a1",
      type: "array",
      params: { count: 2, relativeOffset: [1, 0, 0] },
    };
    const modMirror: Modifier3d = {
      id: "m1",
      type: "mirror",
      params: { axis: "x", merge: false },
    };

    // Order 1: Array then Mirror
    const resA = evaluateStack(cube, [modArray, modMirror], { viewport: true });

    // Order 2: Mirror then Array
    const resB = evaluateStack(cube, [modMirror, modArray], { viewport: true });

    // Both produce same number of vertices, but their coordinates differ
    assert.equal(resA.positions.length, resB.positions.length);

    let diffCount = 0;
    for (let i = 0; i < resA.positions.length; i++) {
      if (Math.abs(resA.positions[i] - resB.positions[i]) > 1e-3) {
        diffCount++;
      }
    }
    assert.ok(diffCount > 0, "Array then Mirror must produce different coordinates than Mirror then Array");
  });

  it("apply equals the evaluated result and refuses if not first in stack", () => {
    clearModifierCache();
    const cube = createCubeMesh();
    const mod1: Modifier3d = {
      id: "mod_tx",
      type: "transform",
      params: { translation: [5, 0, 0], scale: [1, 1, 1], rotation: [0, 0, 0] },
    };
    const mod2: Modifier3d = {
      id: "mod_arr",
      type: "array",
      params: { count: 2, relativeOffset: [2, 0, 0] },
    };

    const doc = {
      schemaVersion: 7,
      scenes: {},
      objects: {
        obj1: {
          id: "obj1",
          type: "mesh",
          dataId: "mesh1",
          transform: { location: [0, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
          modifiers: [mod1, mod2],
        },
      },
      meshes: {
        mesh1: {
          id: "mesh1",
          positions: Array.from(cube.positions),
          indices: Array.from(cube.indices),
        },
      },
    } as unknown as MotionDocument;

    // 1. Refuse if not first in stack
    assert.throws(
      () => applyModifier(doc, "obj1", "mod_arr"),
      /only the first modifier in the stack can be applied/
    );

    // 2. Apply first modifier
    const docAfterFirst = applyModifier(doc, "obj1", "mod_tx");
    assert.equal(docAfterFirst.objects?.obj1.modifiers?.length, 1);
    assert.equal(docAfterFirst.objects?.obj1.modifiers?.[0].id, "mod_arr");

    // Mesh positions after applying first modifier must equal evaluateStack with first modifier
    const evalFirst = evaluateStack(cube, [mod1], { viewport: true });
    const bakedMesh = docAfterFirst.meshes?.mesh1;
    assert.ok(bakedMesh?.positions);
    for (let i = 0; i < evalFirst.positions.length; i++) {
      assertNear(bakedMesh.positions[i], evalFirst.positions[i]);
    }

    // 3. Apply all
    const docAfterAll = applyAll(doc, "obj1");
    assert.equal(docAfterAll.objects?.obj1.modifiers?.length, 0);

    const evalAll = evaluateStack(cube, [mod1, mod2], { viewport: true });
    const bakedAll = docAfterAll.meshes?.mesh1;
    assert.ok(bakedAll?.positions);
    assert.equal(bakedAll.positions.length, evalAll.positions.length);
    for (let i = 0; i < evalAll.positions.length; i++) {
      assertNear(bakedAll.positions[i], evalAll.positions[i]);
    }
  });

  it("skips disabled modifiers per toggle (viewport vs render)", () => {
    clearModifierCache();
    const cube = createCubeMesh();

    const stack: Modifier3d[] = [
      {
        id: "m_vp_only",
        type: "transform",
        enabled: true,
        renderEnabled: false,
        params: { translation: [10, 0, 0] },
      },
      {
        id: "m_render_only",
        type: "transform",
        enabled: false,
        renderEnabled: true,
        params: { translation: [0, 20, 0] },
      },
    ];

    // In viewport: m_vp_only executes, m_render_only is skipped
    const vpMesh = evaluateStack(cube, stack, { viewport: true });
    assertNear(vpMesh.positions[0], cube.positions[0] + 10);
    assertNear(vpMesh.positions[1], cube.positions[1]);

    // In render: m_vp_only skipped, m_render_only executes
    const renderMesh = evaluateStack(cube, stack, { viewport: false });
    assertNear(renderMesh.positions[0], cube.positions[0]);
    assertNear(renderMesh.positions[1], cube.positions[1] + 20);
  });

  it("cache hits on equal input and returns cached reference", () => {
    clearModifierCache();
    const cube = createCubeMesh();
    const stack: Modifier3d[] = [
      { id: "m1", type: "transform", params: { translation: [1, 2, 3] } },
    ];

    const first = evaluateStack(cube, stack, { viewport: true, meshHash: "fixed_cube" });
    const second = evaluateStack(cube, stack, { viewport: true, meshHash: "fixed_cube" });

    assert.equal(first, second, "Repeated evaluation with identical stackKey must hit LRU cache");
  });

  it("worker handler pure core function returns identical output to inline evaluation", () => {
    clearModifierCache();
    const cube = createCubeMesh();
    const stack: Modifier3d[] = [
      { id: "m1", type: "transform", params: { scale: [2, 2, 2] } },
      { id: "m2", type: "array", params: { count: 3, relativeOffset: [1, 0, 0] } },
    ];

    const inline = evaluateStack(cube, stack, { viewport: true });
    const workerDirect = evaluateModifiersWorker(cube, stack, true);

    assert.equal(workerDirect.positions.length, inline.positions.length);
    for (let i = 0; i < inline.positions.length; i++) {
      assertNear(workerDirect.positions[i], inline.positions[i]);
    }

    // Call through job handlers registry directly
    const handler = handlers["modifiers.eval"];
    assert.ok(handler, "modifiers.eval handler must be registered in handlers");

    const ctx: HandlerContext = { progress: () => {} };
    const handlerOutput = handler(
      { mesh: cube, modifiers: stack, viewport: true } as never,
      ctx
    );
    const workerMesh = handlerOutput.result as MeshData;
    assert.ok(workerMesh.positions);
    assert.equal(workerMesh.positions.length, inline.positions.length);
    for (let i = 0; i < inline.positions.length; i++) {
      assertNear(workerMesh.positions[i], inline.positions[i]);
    }
  });

  it("document modifier helpers (add, remove, reorder, setParam, setVisibility) are pure and immutable", () => {
    const doc = {
      schemaVersion: 7,
      scenes: {},
      objects: {
        obj1: {
          id: "obj1",
          type: "mesh",
          transform: { location: [0, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
          modifiers: [
            { id: "m1", type: "mirror", params: { axis: "x" } },
            { id: "m2", type: "array", params: { count: 2 } },
          ],
        },
      },
    } as unknown as MotionDocument;

    // addModifier
    const docAdded = addModifier(doc, "obj1", { id: "m3", type: "solidify", params: { thickness: 0.2 } }, 1);
    assert.equal(doc.objects?.obj1.modifiers?.length, 2, "Original doc untouched");
    assert.equal(docAdded.objects?.obj1.modifiers?.length, 3);
    assert.equal(docAdded.objects?.obj1.modifiers?.[1].id, "m3");

    // removeModifier
    const docRemoved = removeModifier(docAdded, "obj1", "m3");
    assert.equal(docRemoved.objects?.obj1.modifiers?.length, 2);
    assert.equal(docRemoved.objects?.obj1.modifiers?.find((m) => m.id === "m3"), undefined);

    // reorderModifier
    const docReordered = reorderModifier(doc, "obj1", "m1", 1);
    assert.equal(docReordered.objects?.obj1.modifiers?.[0].id, "m2");
    assert.equal(docReordered.objects?.obj1.modifiers?.[1].id, "m1");

    // setModifierParam
    const docParam = setModifierParam(doc, "obj1", "m2", "count", 5);
    assert.equal(docParam.objects?.obj1.modifiers?.[1].params?.count, 5);
    assert.equal(doc.objects?.obj1.modifiers?.[1].params?.count, 2, "Original doc unchanged");

    // setModifierVisibility
    const docVis = setModifierVisibility(doc, "obj1", "m1", { enabled: false, renderEnabled: true });
    assert.equal(docVis.objects?.obj1.modifiers?.[0].enabled, false);
    assert.equal(docVis.objects?.obj1.modifiers?.[0].renderEnabled, true);
  });
});
