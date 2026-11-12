/**
 * ============================================================================
 * PARAMETRIC 3D PRIMITIVES TESTS (Phase 3D-025)
 * ============================================================================
 * Pure unit tests verifying:
 *   1. Golden vertex values derived by hand for small parameter sets.
 *   2. Watertight 2-manifold closed surfaces (every edge shared by exactly 2 triangles).
 *   3. Indices strictly in bounds and triangles properly formed.
 *   4. Outward-facing CCW normals with strictly positive signed volume.
 *   5. Interactive handle drags change exactly their targeted parameter.
 *   6. Immutable regeneration matches direct spec generation.
 *   7. Conversion to plain mesh removes `source` while keeping geometry.
 *   8. Typed command execution, undo restoration, and redo consistency.
 * ============================================================================
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DOCUMENT, setDocument } from "../../../store/documentState";
import { getDocument, historyCommands } from "../../../store/useDocumentStore";
import { useHistoryStore } from "../../../store/useHistoryStore";
import { getAllCommands, tryRunCommand } from "../../../commands/registry";
import { register3dCommands } from "../../commands/register";
import type { MotionDocument } from "../../../document/schema";
import {
  cubeSpec,
  cylinderSpec,
  coneSpec,
  uvSphereSpec,
  icoSphereSpec,
  torusSpec,
  planeSpec,
  circleSpec,
  capsuleSpec,
  roundedBoxSpec,
  PRIMITIVE_SPECS,
  getPrimitiveSpec,
} from "../specs";
import {
  computeSignedVolume,
  isWatertightMesh,
} from "../generators";
import {
  regenerate,
  setPrimitiveParam,
  convertToPlainMesh,
} from "../procedural";
import { register3dPrimitiveCommands } from "../commands";

function assertAlmostEqual(actual: number, expected: number, tol = 1e-4, message?: string): void {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${message ? message + ": " : ""}Expected ${actual} to be close to ${expected} (tol: ${tol})`
  );
}

function createTestDocument(): MotionDocument {
  const doc = structuredClone(DEFAULT_DOCUMENT);
  doc.scenes = {
    scn_main: {
      id: "scn_main",
      name: "Main Scene",
      objects: [],
    },
  };
  doc.objects = {};
  doc.meshes = {};
  doc.materials = {};
  doc.lights = {};
  doc.cameras = {};
  return doc;
}

describe("Phase 3D-025: Parametric Primitives", () => {
  beforeEach(() => {
    setDocument(createTestDocument());
    useHistoryStore.getState().clearHistory();
  });

  // ---------------------------------------------------------------------------
  // 1. Golden Values Derived by Hand
  // ---------------------------------------------------------------------------
  describe("(1) Golden vertex values derived by hand", () => {
    it("cube corners: 2x2x2 cube has 8 vertices at (±1, ±1, ±1)", () => {
      const res = cubeSpec.generate({ width: 2, height: 2, depth: 2 });
      assert.strictEqual(res.positions.length, 24); // 8 vertices * 3 coords

      const expectedCorners = [
        [-1, -1, -1],
        [ 1, -1, -1],
        [ 1,  1, -1],
        [-1,  1, -1],
        [-1, -1,  1],
        [ 1, -1,  1],
        [ 1,  1,  1],
        [-1,  1,  1],
      ];

      for (let i = 0; i < 8; i++) {
        assertAlmostEqual(res.positions[i * 3], expectedCorners[i][0], 1e-5, `Vertex ${i} X`);
        assertAlmostEqual(res.positions[i * 3 + 1], expectedCorners[i][1], 1e-5, `Vertex ${i} Y`);
        assertAlmostEqual(res.positions[i * 3 + 2], expectedCorners[i][2], 1e-5, `Vertex ${i} Z`);
      }
    });

    it("cylinder with 4 sides: depth 2, radius 1 has 10 exact vertices", () => {
      const res = cylinderSpec.generate({ vertices: 4, depth: 2, radius: 1 });
      assert.strictEqual(res.positions.length, 30); // 10 vertices * 3

      // Vertex 0: top center (0, 1, 0)
      assertAlmostEqual(res.positions[0], 0, 1e-5);
      assertAlmostEqual(res.positions[1], 1, 1e-5);
      assertAlmostEqual(res.positions[2], 0, 1e-5);

      // Top ring vertices 1..4 at phi = 0, pi/2, pi, 3pi/2
      const topRing = [
        [ 1, 1,  0],
        [ 0, 1,  1],
        [-1, 1,  0],
        [ 0, 1, -1],
      ];
      for (let s = 0; s < 4; s++) {
        const idx = (1 + s) * 3;
        assertAlmostEqual(res.positions[idx], topRing[s][0], 1e-5, `Top ring ${s} X`);
        assertAlmostEqual(res.positions[idx + 1], topRing[s][1], 1e-5, `Top ring ${s} Y`);
        assertAlmostEqual(res.positions[idx + 2], topRing[s][2], 1e-5, `Top ring ${s} Z`);
      }

      // Vertex 5: bottom center (0, -1, 0)
      assertAlmostEqual(res.positions[5 * 3], 0, 1e-5);
      assertAlmostEqual(res.positions[5 * 3 + 1], -1, 1e-5);
      assertAlmostEqual(res.positions[5 * 3 + 2], 0, 1e-5);

      // Bottom ring vertices 6..9
      const botRing = [
        [ 1, -1,  0],
        [ 0, -1,  1],
        [-1, -1,  0],
        [ 0, -1, -1],
      ];
      for (let s = 0; s < 4; s++) {
        const idx = (6 + s) * 3;
        assertAlmostEqual(res.positions[idx], botRing[s][0], 1e-5, `Bottom ring ${s} X`);
        assertAlmostEqual(res.positions[idx + 1], botRing[s][1], 1e-5, `Bottom ring ${s} Y`);
        assertAlmostEqual(res.positions[idx + 2], botRing[s][2], 1e-5, `Bottom ring ${s} Z`);
      }
    });

    it("circle with 4 sides: radius 1 has 5 exact vertices on XZ plane", () => {
      const res = circleSpec.generate({ vertices: 4, radius: 1 });
      assert.strictEqual(res.positions.length, 15); // 5 vertices * 3

      // Center vertex (0, 0, 0)
      assertAlmostEqual(res.positions[0], 0, 1e-5);
      assertAlmostEqual(res.positions[1], 0, 1e-5);
      assertAlmostEqual(res.positions[2], 0, 1e-5);

      // Rim vertices 1..4 at phi = 0, pi/2, pi, 3pi/2
      const rim = [
        [ 1, 0,  0],
        [ 0, 0,  1],
        [-1, 0,  0],
        [ 0, 0, -1],
      ];
      for (let s = 0; s < 4; s++) {
        const idx = (1 + s) * 3;
        assertAlmostEqual(res.positions[idx], rim[s][0], 1e-5, `Rim ${s} X`);
        assertAlmostEqual(res.positions[idx + 1], rim[s][1], 1e-5, `Rim ${s} Y`);
        assertAlmostEqual(res.positions[idx + 2], rim[s][2], 1e-5, `Rim ${s} Z`);
      }
    });

    it("torus 4x4: major radius 1, minor radius 0.5 has 16 exact vertices", () => {
      const res = torusSpec.generate({
        radius: 1,
        tube: 0.5,
        radialSegments: 4,
        tubularSegments: 4,
      });
      assert.strictEqual(res.positions.length, 48); // 16 vertices * 3

      // Hand-derived coordinates:
      // i = 0 (u = 0, cosU = 1, sinU = 0):
      // j = 0: (1 + 0.5, 0, 0) = (1.5, 0, 0)
      // j = 1: (1, 0.5, 0) = (1, 0.5, 0)
      // j = 2: (1 - 0.5, 0, 0) = (0.5, 0, 0)
      // j = 3: (1, -0.5, 0) = (1, -0.5, 0)
      const expectedRing0 = [
        [1.5,  0.0, 0.0],
        [1.0,  0.5, 0.0],
        [0.5,  0.0, 0.0],
        [1.0, -0.5, 0.0],
      ];
      for (let j = 0; j < 4; j++) {
        const idx = j * 3;
        assertAlmostEqual(res.positions[idx], expectedRing0[j][0], 1e-5);
        assertAlmostEqual(res.positions[idx + 1], expectedRing0[j][1], 1e-5);
        assertAlmostEqual(res.positions[idx + 2], expectedRing0[j][2], 1e-5);
      }

      // i = 1 (u = pi/2, cosU = 0, sinU = 1):
      // j = 0: (0, 0, 1.5)
      // j = 1: (0, 0.5, 1.0)
      // j = 2: (0, 0, 0.5)
      // j = 3: (0, -0.5, 1.0)
      const expectedRing1 = [
        [0.0,  0.0, 1.5],
        [0.0,  0.5, 1.0],
        [0.0,  0.0, 0.5],
        [0.0, -0.5, 1.0],
      ];
      for (let j = 0; j < 4; j++) {
        const idx = (4 + j) * 3;
        assertAlmostEqual(res.positions[idx], expectedRing1[j][0], 1e-5);
        assertAlmostEqual(res.positions[idx + 1], expectedRing1[j][1], 1e-5);
        assertAlmostEqual(res.positions[idx + 2], expectedRing1[j][2], 1e-5);
      }
    });

    it("plane: 2x2 width and height has 4 exact vertices on XZ plane", () => {
      const res = planeSpec.generate({ width: 2, height: 2 });
      assert.strictEqual(res.positions.length, 12);
      assert.strictEqual(res.indices.length, 6);

      const expected = [
        [-1, 0,  1],
        [ 1, 0,  1],
        [ 1, 0, -1],
        [-1, 0, -1],
      ];
      for (let i = 0; i < 4; i++) {
        assertAlmostEqual(res.positions[i * 3], expected[i][0], 1e-5);
        assertAlmostEqual(res.positions[i * 3 + 1], expected[i][1], 1e-5);
        assertAlmostEqual(res.positions[i * 3 + 2], expected[i][2], 1e-5);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Watertight 2-Manifold Verification
  // ---------------------------------------------------------------------------
  describe("(2) Watertight 2-manifold closed meshes", () => {
    it("closed primitives are watertight (every edge shared by exactly two triangles)", () => {
      assert.strictEqual(isWatertightMesh(cubeSpec.generate({ width: 1, height: 1, depth: 1 }).indices), true);
      assert.strictEqual(isWatertightMesh(cylinderSpec.generate({ radius: 1, depth: 2, vertices: 16 }).indices), true);
      assert.strictEqual(isWatertightMesh(coneSpec.generate({ radius: 1, depth: 2, vertices: 16 }).indices), true);
      assert.strictEqual(isWatertightMesh(uvSphereSpec.generate({ radius: 1, segments: 16, rings: 8 }).indices), true);
      assert.strictEqual(isWatertightMesh(icoSphereSpec.generate({ radius: 1, subdivisions: 2 }).indices), true);
      assert.strictEqual(isWatertightMesh(torusSpec.generate({ radius: 1, tube: 0.25, radialSegments: 12, tubularSegments: 16 }).indices), true);
      assert.strictEqual(isWatertightMesh(capsuleSpec.generate({ radius: 0.5, depth: 1.5, radialSegments: 12, rings: 6 }).indices), true);
      assert.strictEqual(isWatertightMesh(roundedBoxSpec.generate({ width: 1, height: 1, depth: 1, bevel: 0.1, segments: 2 }).indices), true);
      assert.strictEqual(isWatertightMesh(roundedBoxSpec.generate({ width: 2, height: 1.5, depth: 1, bevel: 0.2, segments: 4 }).indices), true);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Indices In Range
  // ---------------------------------------------------------------------------
  describe("(3) Indices in range", () => {
    it("all 10 primitives have indices strictly within vertex count bounds", () => {
      for (const [kind, spec] of Object.entries(PRIMITIVE_SPECS)) {
        const defaults = spec.params.parse({});
        const res = spec.generate(defaults);
        const numVerts = Math.floor(res.positions.length / 3);

        assert.ok(numVerts > 0, `${kind}: vertex count > 0`);
        assert.ok(res.indices.length >= 3, `${kind}: index count >= 3`);
        assert.strictEqual(res.indices.length % 3, 0, `${kind}: index count multiple of 3`);

        for (let i = 0; i < res.indices.length; i++) {
          const idx = res.indices[i];
          assert.ok(
            idx >= 0 && idx < numVerts,
            `${kind}: index ${idx} at position ${i} out of bounds [0, ${numVerts - 1}]`
          );
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Outward-Facing Normals / Signed Volume > 0
  // ---------------------------------------------------------------------------
  describe("(4) Outward-facing normals & strictly positive signed volume", () => {
    it("all closed solids have signed volume > 0", () => {
      const closedSpecs = [
        { name: "cube", spec: cubeSpec, expectedVol: 8, params: { width: 2, height: 2, depth: 2 } },
        { name: "cylinder", spec: cylinderSpec, expectedVol: Math.PI * 1 * 1 * 2, params: { radius: 1, depth: 2, vertices: 64 } },
        { name: "cone", spec: coneSpec, expectedVol: (1 / 3) * Math.PI * 1 * 1 * 2, params: { radius: 1, depth: 2, vertices: 64 } },
        { name: "uvSphere", spec: uvSphereSpec, expectedVol: (4 / 3) * Math.PI * 1 * 1 * 1, params: { radius: 1, segments: 64, rings: 32 } },
        { name: "icoSphere", spec: icoSphereSpec, expectedVol: (4 / 3) * Math.PI * 1 * 1 * 1, params: { radius: 1, subdivisions: 3 } },
        { name: "torus", spec: torusSpec, expectedVol: 2 * Math.PI * Math.PI * 1 * 0.25 * 0.25, params: { radius: 1, tube: 0.25, radialSegments: 32, tubularSegments: 64 } },
        { name: "capsule", spec: capsuleSpec, expectedVol: Math.PI * 0.5 * 0.5 * 1.0 + (4 / 3) * Math.PI * 0.125, params: { radius: 0.5, depth: 1.0, radialSegments: 32, rings: 16 } },
        { name: "roundedBox", spec: roundedBoxSpec, expectedVol: 1.0, params: { width: 1, height: 1, depth: 1, bevel: 0.1, segments: 4 } },
      ];

      for (const item of closedSpecs) {
        const res = (item.spec.generate as (p: unknown) => ReturnType<typeof item.spec.generate>)(item.params);
        const vol = computeSignedVolume(res.positions, res.indices);
        assert.ok(vol > 0, `${item.name} signed volume must be strictly positive (was ${vol})`);
        assertAlmostEqual(vol, item.expectedVol, item.expectedVol * 0.15, `${item.name} volume close to theoretical`);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Interactive Handle Drag Isolates Target Parameter
  // ---------------------------------------------------------------------------
  describe("(5) Handle drag changes exactly its parameter", () => {
    it("cylinder: depth handle changes depth only; radius handle changes radius only", () => {
      const initial = { depth: 2, radius: 1, vertices: 32 };
      const handles = cylinderSpec.handles(initial);

      const depthHandle = handles.find((h) => h.param === "depth");
      assert.ok(depthHandle, "cylinder must have depth handle");
      assertAlmostEqual(depthHandle.position[1], 1.0, 1e-5, "depth handle position at top");
      assertAlmostEqual(depthHandle.axis[1], 1.0, 1e-5, "depth handle axis is +Y");

      const afterDepth = depthHandle.apply(initial, 0.5);
      assertAlmostEqual(afterDepth.depth, 2.5, 1e-5);
      assert.strictEqual(afterDepth.radius, initial.radius, "radius unchanged");
      assert.strictEqual(afterDepth.vertices, initial.vertices, "vertices unchanged");

      const radiusHandle = handles.find((h) => h.param === "radius");
      assert.ok(radiusHandle, "cylinder must have radius handle");
      assertAlmostEqual(radiusHandle.position[0], 1.0, 1e-5, "radius handle position at +X");
      assertAlmostEqual(radiusHandle.axis[0], 1.0, 1e-5, "radius handle axis is +X");

      const afterRadius = radiusHandle.apply(initial, 0.3);
      assertAlmostEqual(afterRadius.radius, 1.3, 1e-5);
      assert.strictEqual(afterRadius.depth, initial.depth, "depth unchanged");
      assert.strictEqual(afterRadius.vertices, initial.vertices, "vertices unchanged");
    });

    it("uvSphere & icoSphere: radius handle changes radius only", () => {
      const sphereInit = { radius: 1, segments: 32, rings: 16 };
      const [sphereHandle] = uvSphereSpec.handles(sphereInit);
      assert.strictEqual(sphereHandle.param, "radius");
      const nextSphere = sphereHandle.apply(sphereInit, 0.4);
      assertAlmostEqual(nextSphere.radius, 1.4, 1e-5);
      assert.strictEqual(nextSphere.segments, 32);
      assert.strictEqual(nextSphere.rings, 16);

      const icoInit = { radius: 1, subdivisions: 2 };
      const [icoHandle] = icoSphereSpec.handles(icoInit);
      assert.strictEqual(icoHandle.param, "radius");
      const nextIco = icoHandle.apply(icoInit, 0.7);
      assertAlmostEqual(nextIco.radius, 1.7, 1e-5);
      assert.strictEqual(nextIco.subdivisions, 2);
    });

    it("torus: major and minor radius handles isolate their parameters", () => {
      const initial = { radius: 1.0, tube: 0.25, radialSegments: 16, tubularSegments: 32 };
      const handles = torusSpec.handles(initial);

      const majorHandle = handles.find((h) => h.param === "radius");
      assert.ok(majorHandle, "torus must have major radius handle");
      const nextMajor = majorHandle.apply(initial, 0.5);
      assertAlmostEqual(nextMajor.radius, 1.5, 1e-5);
      assert.strictEqual(nextMajor.tube, 0.25);

      const minorHandle = handles.find((h) => h.param === "tube");
      assert.ok(minorHandle, "torus must have minor radius handle");
      const nextMinor = minorHandle.apply(initial, 0.1);
      assertAlmostEqual(nextMinor.tube, 0.35, 1e-5);
      assert.strictEqual(nextMinor.radius, 1.0);
    });

    it("box: three size handles isolate width, height, depth", () => {
      const initial = { width: 1.0, height: 2.0, depth: 3.0 };
      const handles = cubeSpec.handles(initial);
      assert.strictEqual(handles.length, 3);

      const wHandle = handles.find((h) => h.param === "width")!;
      const hHandle = handles.find((h) => h.param === "height")!;
      const dHandle = handles.find((h) => h.param === "depth")!;

      const nextW = wHandle.apply(initial, 0.5);
      assertAlmostEqual(nextW.width, 1.5, 1e-5);
      assert.strictEqual(nextW.height, 2.0);
      assert.strictEqual(nextW.depth, 3.0);

      const nextH = hHandle.apply(initial, 0.8);
      assert.strictEqual(nextH.width, 1.0);
      assertAlmostEqual(nextH.height, 2.8, 1e-5);
      assert.strictEqual(nextH.depth, 3.0);

      const nextD = dHandle.apply(initial, 0.4);
      assert.strictEqual(nextD.width, 1.0);
      assert.strictEqual(nextD.height, 2.0);
      assertAlmostEqual(nextD.depth, 3.4, 1e-5);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Procedural Regeneration & Plain Mesh Conversion
  // ---------------------------------------------------------------------------
  describe("(6) Procedural document regeneration and conversion", () => {
    it("regenerate after param change equals direct generation with new params", () => {
      const doc = createTestDocument();
      const initialParams = { radius: 1, depth: 2, vertices: 32 };
      const initialMesh = cylinderSpec.generate(initialParams);

      doc.meshes!["msh_cyl"] = {
        id: "msh_cyl",
        name: "CylinderMesh",
        positions: Array.from(initialMesh.positions),
        indices: Array.from(initialMesh.indices),
        source: {
          kind: "cylinder",
          params: initialParams,
        },
      };

      const newParams = { depth: 4.5, radius: 1.8 };
      const regeneratedDoc = regenerate(doc, "msh_cyl", newParams);

      assert.notStrictEqual(doc, regeneratedDoc, "Immutable document returned");
      const updatedMesh = regeneratedDoc.meshes!["msh_cyl"];
      assert.ok(updatedMesh.source);
      assert.strictEqual(updatedMesh.source.params.depth, 4.5);
      assert.strictEqual(updatedMesh.source.params.radius, 1.8);

      const direct = cylinderSpec.generate({ ...initialParams, ...newParams });
      assert.strictEqual(updatedMesh.positions!.length, direct.positions.length);
      for (let i = 0; i < direct.positions.length; i++) {
        assertAlmostEqual(updatedMesh.positions![i], direct.positions[i], 1e-5);
      }
    });

    it("setPrimitiveParam finds object mesh and updates parameter", () => {
      const doc = createTestDocument();
      doc.meshes!["msh_cone"] = {
        id: "msh_cone",
        name: "ConeMesh",
        positions: [0, 1, 0, -1, -1, 0, 1, -1, 0],
        indices: [0, 1, 2],
        source: {
          kind: "cone",
          params: { radius: 1, depth: 2, vertices: 16 },
        },
      };
      doc.objects!["obj_cone"] = {
        id: "obj_cone",
        name: "ConeObject",
        type: "mesh",
        dataId: "msh_cone",
        transform: { location: [0, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
        visible: true,
      };

      const nextDoc = setPrimitiveParam(doc, "obj_cone", "radius", 2.5);
      const mesh = nextDoc.meshes!["msh_cone"];
      assert.strictEqual(mesh.source?.params.radius, 2.5);
      assert.strictEqual(mesh.source?.params.depth, 2);
    });

    it("convertToPlainMesh drops source while preserving geometry", () => {
      const doc = createTestDocument();
      doc.meshes!["msh_sphere"] = {
        id: "msh_sphere",
        positions: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        indices: [0, 1, 2],
        source: {
          kind: "uvSphere",
          params: { radius: 1, segments: 16, rings: 8 },
        },
      };

      const bakedDoc = convertToPlainMesh(doc, "msh_sphere");
      const bakedMesh = bakedDoc.meshes!["msh_sphere"];
      assert.strictEqual(bakedMesh.source, undefined);
      assert.strictEqual(bakedMesh.positions!.length, 9);
      assert.strictEqual(bakedMesh.indices!.length, 3);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Typed Commands, Undo Restoration, and Wrapped Primitive Add
  // ---------------------------------------------------------------------------
  describe("(7) Typed commands, history, and wrapped canonical add ops", () => {
    it("register3dPrimitiveCommands defines typed commands under category 3D", () => {
      const cleanup3d = register3dCommands();
      const cleanupPrimitives = register3dPrimitiveCommands();
      try {
        const all = getAllCommands();
        const expectedIds = [
          "3d.primitive.set_param",
          "3d.add.circle",
          "3d.add.capsule",
          "3d.add.rounded_box",
        ];

        for (const id of expectedIds) {
          const cmd = all.find((c) => c.id === id);
          assert.ok(cmd, `Command ${id} should be registered`);
          assert.strictEqual(cmd.category, "3D");
          assert.ok(cmd.title && cmd.title.length > 0);
          assert.ok(cmd.args, `Command ${id} should have an args schema`);
        }
      } finally {
        cleanupPrimitives();
        cleanup3d();
      }
    });

    it("wrapped canonical 3d.add.cylinder records source on created mesh, undo restores", () => {
      const cleanup3d = register3dCommands();
      const cleanupPrimitives = register3dPrimitiveCommands();
      try {
        const docBefore = getDocument();
        assert.strictEqual(Object.keys(docBefore.objects ?? {}).length, 0);

        const outcome = tryRunCommand("3d.add.cylinder", {
          vertices: 16,
          radius: 1.5,
          depth: 3.0,
        });
        assert.strictEqual(outcome.ok, true);

        const docAfter = getDocument();
        const objIds = Object.keys(docAfter.objects ?? {});
        assert.strictEqual(objIds.length, 1);

        const obj = docAfter.objects![objIds[0]];
        const mesh = docAfter.meshes![obj.dataId!];
        assert.ok(mesh.source, "Mesh must have recorded source");
        assert.strictEqual(mesh.source.kind, "cylinder");
        assert.strictEqual(mesh.source.params.radius, 1.5);
        assert.strictEqual(mesh.source.params.depth, 3.0);
        assert.strictEqual(mesh.source.params.vertices, 16);

        // Exactly 1 undo step
        const hist = useHistoryStore.getState();
        assert.strictEqual(hist.past.length, 1, "Exactly 1 undo step created");

        // Undo restores initial document
        historyCommands.undo();
        const docUndone = getDocument();
        assert.strictEqual(Object.keys(docUndone.objects ?? {}).length, 0);
        assert.strictEqual(Object.keys(docUndone.meshes ?? {}).length, 0);

        // Redo restores cylinder with source
        historyCommands.redo();
        const docRedone = getDocument();
        assert.strictEqual(Object.keys(docRedone.objects ?? {}).length, 1);
        const redoneObj = docRedone.objects![objIds[0]];
        const redoneMesh = docRedone.meshes![redoneObj.dataId!];
        assert.ok(redoneMesh.source);
        assert.strictEqual(redoneMesh.source.params.radius, 1.5);
      } finally {
        cleanupPrimitives();
        cleanup3d();
      }
    });

    it("3d.add.capsule creates mesh with source, 1 undo step", () => {
      const cleanup3d = register3dCommands();
      const cleanupPrimitives = register3dPrimitiveCommands();
      try {
        const outcome = tryRunCommand("3d.add.capsule", {
          radius: 0.8,
          depth: 2.2,
          radialSegments: 20,
        });
        assert.strictEqual(outcome.ok, true);

        const doc = getDocument();
        const objIds = Object.keys(doc.objects ?? {});
        assert.strictEqual(objIds.length, 1);

        const obj = doc.objects![objIds[0]];
        const mesh = doc.meshes![obj.dataId!];
        assert.ok(mesh.source);
        assert.strictEqual(mesh.source.kind, "capsule");
        assert.strictEqual(mesh.source.params.radius, 0.8);
        assert.strictEqual(mesh.source.params.depth, 2.2);

        // Undo restores
        historyCommands.undo();
        assert.strictEqual(Object.keys(getDocument().objects ?? {}).length, 0);
      } finally {
        cleanupPrimitives();
        cleanup3d();
      }
    });

    it("3d.primitive.set_param mutates mesh, 1 undo step, undo restores", () => {
      const cleanup3d = register3dCommands();
      const cleanupPrimitives = register3dPrimitiveCommands();
      try {
        // Add cylinder
        tryRunCommand("3d.add.cylinder", { radius: 1, depth: 2, vertices: 16 });
        const docAfterAdd = getDocument();
        const objId = Object.keys(docAfterAdd.objects!)[0];
        const meshId = docAfterAdd.objects![objId].dataId!;

        const initialDepth = docAfterAdd.meshes![meshId].source?.params.depth;
        assert.strictEqual(initialDepth, 2);

        // Run 3d.primitive.set_param
        const setOutcome = tryRunCommand("3d.primitive.set_param", {
          objectId: objId,
          param: "depth",
          value: 5.0,
        });
        assert.strictEqual(setOutcome.ok, true);

        const docAfterParam = getDocument();
        const meshAfterParam = docAfterParam.meshes![meshId];
        assert.strictEqual(meshAfterParam.source?.params.depth, 5.0);

        // Direct generation check: top vertex Y should be 2.5
        const topVertexY = meshAfterParam.positions![1];
        assertAlmostEqual(topVertexY, 2.5, 1e-5);

        // Undo restores depth 2
        historyCommands.undo();
        const docUndone = getDocument();
        assert.strictEqual(docUndone.meshes![meshId].source?.params.depth, 2);
        assertAlmostEqual(docUndone.meshes![meshId].positions![1], 1.0, 1e-5);
      } finally {
        cleanupPrimitives();
        cleanup3d();
      }
    });

    it("getPrimitiveSpec normalizes casing and aliases", () => {
      assert.strictEqual(getPrimitiveSpec("cube")?.kind, "cube");
      assert.strictEqual(getPrimitiveSpec("box")?.kind, "cube");
      assert.strictEqual(getPrimitiveSpec("uvSphere")?.kind, "uvSphere");
      assert.strictEqual(getPrimitiveSpec("sphere")?.kind, "uvSphere");
      assert.strictEqual(getPrimitiveSpec("icoSphere")?.kind, "icoSphere");
      assert.strictEqual(getPrimitiveSpec("icosphere")?.kind, "icoSphere");
      assert.strictEqual(getPrimitiveSpec("rounded_box")?.kind, "roundedBox");
      assert.strictEqual(getPrimitiveSpec("roundedBox")?.kind, "roundedBox");
      assert.strictEqual(getPrimitiveSpec("circle")?.kind, "circle");
      assert.strictEqual(getPrimitiveSpec("disc")?.kind, "circle");
    });
  });
});
