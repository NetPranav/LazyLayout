import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { applyPatches } from "immer";
import { DEFAULT_DOCUMENT } from "../../../store/documentState";
import { diffPatches } from "../../../document/diff";
import type { MotionDocument } from "../../../document/schema";
import { getAllCommands, tryRunCommand } from "../../../commands/registry";
import { setDocument } from "../../../store/documentState";
import {
  getDocument,
  historyCommands,
} from "../../../store/useDocumentStore";
import { useHistoryStore } from "../../../store/useHistoryStore";
import {
  cube,
  uvSphere,
  cylinder,
  cone,
  plane,
  torus,
  icosphere,
  computeSignedVolume,
  isWatertightMesh,
} from "../primitives";
import {
  COMMAND_SCHEMAS,
  COMMAND_TITLES,
  run3dOp,
} from "../ops";
import {
  adjustLastOperation,
  clearLastOperation,
  describeArgs,
  getLastOperation,
  recordLastOperation,
} from "../lastOperation";
import { register3dCommands } from "../register";

function assertAlmostEqual(actual: number, expected: number, tol = 1e-4, message?: string): void {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${message ? message + ": " : ""}Expected ${actual} to be close to ${expected} (tol: ${tol})`
  );
}

function createBaseDocument(): MotionDocument {
  const doc = structuredClone(DEFAULT_DOCUMENT);
  doc.scenes = {
    scn_test: {
      id: "scn_test",
      name: "Scene",
      objects: ["obj_sample1", "obj_sample2"],
    },
  };
  doc.meshes = {
    msh_sample1: {
      id: "msh_sample1",
      name: "SampleMesh1",
      positions: [
        -1, -1, -1,  1, -1, -1,  1, 1, -1, -1, 1, -1,
        -1, -1,  1,  1, -1,  1,  1, 1,  1, -1, 1,  1,
      ],
      indices: [
        4, 5, 6, 4, 6, 7,
        1, 0, 3, 1, 3, 2,
        7, 6, 2, 7, 2, 3,
        0, 1, 5, 0, 5, 4,
        5, 1, 2, 5, 2, 6,
        0, 4, 7, 0, 7, 3,
      ],
      normals: [
        -0.577, -0.577, -0.577,  0.577, -0.577, -0.577,
         0.577,  0.577, -0.577, -0.577,  0.577, -0.577,
        -0.577, -0.577,  0.577,  0.577, -0.577,  0.577,
         0.577,  0.577,  0.577, -0.577,  0.577,  0.577,
      ],
    },
    msh_sample2: {
      id: "msh_sample2",
      name: "SampleMesh2",
      positions: [
        -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
        -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5, 0.5,  0.5, -0.5, 0.5,  0.5,
      ],
      indices: [
        4, 5, 6, 4, 6, 7,
        1, 0, 3, 1, 3, 2,
        7, 6, 2, 7, 2, 3,
        0, 1, 5, 0, 5, 4,
        5, 1, 2, 5, 2, 6,
        0, 4, 7, 0, 7, 3,
      ],
    },
  };
  doc.materials = {
    mat_sample: {
      id: "mat_sample",
      name: "SampleMaterial",
      baseColor: "#336699",
      metallic: 0.1,
      roughness: 0.4,
      emissive: "#000000",
    },
  };
  doc.objects = {
    obj_sample1: {
      id: "obj_sample1",
      name: "SampleObject1",
      type: "mesh",
      dataId: "msh_sample1",
      materialSlots: ["mat_sample"],
      materials: ["mat_sample"],
      transform: {
        location: [0, 0, 0],
        rotationQuat: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      visible: true,
    },
    obj_sample2: {
      id: "obj_sample2",
      name: "SampleObject2",
      type: "mesh",
      dataId: "msh_sample2",
      materialSlots: ["mat_sample"],
      materials: ["mat_sample"],
      transform: {
        location: [2, 0, 0],
        rotationQuat: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      visible: true,
    },
  };
  return doc;
}

describe("Task 3D-011: 3D commands, undo & Adjust last operation", () => {
  beforeEach(() => {
    useHistoryStore.getState().clearHistory();
    clearLastOperation();
    setDocument(createBaseDocument());
  });

  // ---------------------------------------------------------------------------
  // (c) Procedural Primitive Generators Watertightness & Outward CCW Winding
  // ---------------------------------------------------------------------------
  describe("(c) Primitive generators: watertight 2-manifolds with positive volume", () => {
    it("cube: is watertight, 12 triangles, positive unit volume", () => {
      const prim = cube(1);
      assert.strictEqual(prim.positions.length, 24); // 8 vertices * 3
      assert.strictEqual(prim.indices.length, 36);   // 12 triangles * 3
      assert.strictEqual(isWatertightMesh(prim.indices), true);
      const vol = computeSignedVolume(prim.positions, prim.indices);
      assertAlmostEqual(vol, 1.0, 1e-4, "Cube unit volume");
    });

    it("uvSphere: is watertight, correct segment/ring counts, positive volume", () => {
      const prim = uvSphere(32, 16, 1);
      assert.strictEqual(isWatertightMesh(prim.indices), true);
      const vol = computeSignedVolume(prim.positions, prim.indices);
      const expectedVol = (4 / 3) * Math.PI * 1;
      assert.ok(vol > 0, "Volume must be strictly positive");
      assertAlmostEqual(vol, expectedVol, 0.2, "UV sphere volume");
    });

    it("cylinder: is watertight, closed caps, positive volume", () => {
      const prim = cylinder(32, 2, 1);
      assert.strictEqual(isWatertightMesh(prim.indices), true);
      const vol = computeSignedVolume(prim.positions, prim.indices);
      const expectedVol = Math.PI * 1 * 1 * 2;
      assert.ok(vol > 0, "Volume must be strictly positive");
      assertAlmostEqual(vol, expectedVol, 0.2, "Cylinder volume");
    });

    it("cone: is watertight, closed base cap, positive volume", () => {
      const prim = cone(32, 2, 1);
      assert.strictEqual(isWatertightMesh(prim.indices), true);
      const vol = computeSignedVolume(prim.positions, prim.indices);
      const expectedVol = (1 / 3) * Math.PI * 1 * 1 * 2;
      assert.ok(vol > 0, "Volume must be strictly positive");
      assertAlmostEqual(vol, expectedVol, 0.2, "Cone volume");
    });

    it("torus: is watertight, 2-torus manifold, positive volume", () => {
      const prim = torus(1, 0.25, 16, 32);
      assert.strictEqual(isWatertightMesh(prim.indices), true);
      const vol = computeSignedVolume(prim.positions, prim.indices);
      // Volume of torus = 2 * pi^2 * R * r^2
      const expectedVol = 2 * Math.PI * Math.PI * 1 * 0.25 * 0.25;
      assert.ok(vol > 0, "Volume must be strictly positive");
      assertAlmostEqual(vol, expectedVol, 0.1, "Torus volume");
    });

    it("icosphere: is watertight at multiple subdivisions, positive volume", () => {
      for (const subs of [0, 1, 2]) {
        const prim = icosphere(subs, 1);
        assert.strictEqual(isWatertightMesh(prim.indices), true, `subdivisions ${subs}`);
        const vol = computeSignedVolume(prim.positions, prim.indices);
        assert.ok(vol > 0, `Volume must be positive for subdivisions ${subs}`);
      }
    });

    it("plane: flat quad on XZ plane with 2 triangles", () => {
      const prim = plane(2);
      assert.strictEqual(prim.positions.length, 12); // 4 vertices
      assert.strictEqual(prim.indices.length, 6);    // 2 triangles
      assert.strictEqual(prim.positions[1], 0);      // Y is zero
    });
  });

  // ---------------------------------------------------------------------------
  // (b) Registered 3D Commands Args Schema and Title
  // ---------------------------------------------------------------------------
  describe("(b) Registered 3D commands have an args schema, category, and a title", () => {
    it("all 29 canonical operations have registered schemas and titles", () => {
      const cleanup = register3dCommands();
      try {
        const canonicalIds = Object.keys(COMMAND_SCHEMAS);
        assert.strictEqual(canonicalIds.length, 29);

        const all = getAllCommands();
        for (const id of canonicalIds) {
          const cmd = all.find((c) => c.id === id);
          assert.ok(cmd, `Command ${id} should be registered`);
          assert.strictEqual(cmd.category, "3D");
          assert.ok(cmd.title && cmd.title.length > 0, `Command ${id} has a title`);
          assert.ok(cmd.args, `Command ${id} has an args schema`);
          assert.strictEqual(cmd.title, COMMAND_TITLES[id]);
        }
      } finally {
        cleanup();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // (e) Agent Bridge Visibility
  // ---------------------------------------------------------------------------
  describe("(e) The agent-visible list contains all canonical 3D ids", () => {
    it("getAllCommands includes all Adding, Object, and Materials ids", () => {
      const cleanup = register3dCommands();
      try {
        const ids = new Set(getAllCommands().map((c) => c.id));
        const expected = [
          // Adding (12)
          "3d.add.cube", "3d.add.sphere", "3d.add.cylinder", "3d.add.cone",
          "3d.add.plane", "3d.add.torus", "3d.add.icosphere",
          "3d.add.light.point", "3d.add.light.sun", "3d.add.light.spot",
          "3d.add.camera", "3d.add.empty",
          // Object (13)
          "3d.object.delete", "3d.object.duplicate", "3d.object.rename",
          "3d.object.parent", "3d.object.unparent", "3d.object.hide",
          "3d.object.unhide_all", "3d.object.apply_transform", "3d.object.set_origin",
          "3d.object.set_location", "3d.object.set_rotation", "3d.object.set_scale",
          "3d.object.join",
          // Materials (4)
          "3d.material.add", "3d.material.assign", "3d.material.make_single_user",
          "3d.material.set",
        ];

        for (const exp of expected) {
          assert.ok(ids.has(exp), `Agent commands must include "${exp}"`);
        }
      } finally {
        cleanup();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // (a) Every Op Undo/Redo Round Trip Leaves Document Deeply Equal (30+ ops)
  // ---------------------------------------------------------------------------
  describe("(a) Every op undo/redo round trip leaves document deeply equal (30+ ops)", () => {
    const testCases: { id: string; args: Record<string, unknown>; desc: string }[] = [
      // 1-12: Adding ops
      { id: "3d.add.cube", args: { size: 1.5, location: [1, 2, 3] }, desc: "Add Cube" },
      { id: "3d.add.sphere", args: { radius: 1.2, segments: 16, rings: 8 }, desc: "Add Sphere" },
      { id: "3d.add.cylinder", args: { vertices: 16, radius: 0.8, depth: 3 }, desc: "Add Cylinder" },
      { id: "3d.add.cone", args: { vertices: 16, radius: 0.5, depth: 2 }, desc: "Add Cone" },
      { id: "3d.add.plane", args: { size: 4 }, desc: "Add Plane" },
      { id: "3d.add.torus", args: { radius: 2, tube: 0.5, radialSegments: 8, tubularSegments: 16 }, desc: "Add Torus" },
      { id: "3d.add.icosphere", args: { radius: 1.5, subdivisions: 1 }, desc: "Add Icosphere" },
      { id: "3d.add.light.point", args: { color: "#ff8800", intensity: 50 }, desc: "Add Point Light" },
      { id: "3d.add.light.sun", args: { color: "#ffffaa", intensity: 2 }, desc: "Add Sun Light" },
      { id: "3d.add.light.spot", args: { color: "#ffffff", spotAngle: 0.6 }, desc: "Add Spot Light" },
      { id: "3d.add.camera", args: { fov: 60, near: 0.2, far: 500 }, desc: "Add Camera" },
      { id: "3d.add.empty", args: { location: [0, 1, 0] }, desc: "Add Empty" },

      // 13-25: Object ops
      { id: "3d.object.rename", args: { objectId: "obj_sample1", name: "RenamedHero" }, desc: "Rename Object" },
      { id: "3d.object.duplicate", args: { objectId: "obj_sample1", delta: [1, 0, 0] }, desc: "Duplicate Object" },
      { id: "3d.object.parent", args: { childId: "obj_sample2", parentId: "obj_sample1" }, desc: "Parent Object" },
      { id: "3d.object.unparent", args: { objectId: "obj_sample2" }, desc: "Unparent Object" },
      { id: "3d.object.hide", args: { objectId: "obj_sample1", hide: true }, desc: "Hide Object" },
      { id: "3d.object.unhide_all", args: {}, desc: "Unhide All Objects" },
      { id: "3d.object.set_location", args: { objectId: "obj_sample1", location: [10, 20, 30], relative: false }, desc: "Set Location Absolute" },
      { id: "3d.object.set_location", args: { objectId: "obj_sample1", location: [1, 2, 3], relative: true }, desc: "Set Location Relative" },
      { id: "3d.object.set_rotation", args: { objectId: "obj_sample1", rotation: [0, Math.PI / 2, 0] }, desc: "Set Rotation Euler" },
      { id: "3d.object.set_scale", args: { objectId: "obj_sample1", scale: [2, 3, 4] }, desc: "Set Scale Vector" },
      { id: "3d.object.set_scale", args: { objectId: "obj_sample1", scale: 2.5 }, desc: "Set Scale Uniform" },
      { id: "3d.object.apply_transform", args: { objectId: "obj_sample1", location: true, scale: true }, desc: "Apply Transform" },
      { id: "3d.object.set_origin", args: { objectId: "obj_sample1", type: "geometry" }, desc: "Set Origin Geometry" },
      { id: "3d.object.set_origin", args: { objectId: "obj_sample1", type: "center_of_mass" }, desc: "Set Origin Center of Mass" },
      { id: "3d.object.set_origin", args: { objectId: "obj_sample1", type: "point", point: [1, 1, 1], space: "world" }, desc: "Set Origin Point" },
      { id: "3d.object.join", args: { objectIds: ["obj_sample1", "obj_sample2"] }, desc: "Join Objects" },
      { id: "3d.object.delete", args: { objectId: "obj_sample2", purgeUnused: false }, desc: "Delete Object" },

      // 26-29: Materials ops
      { id: "3d.material.add", args: { name: "Gold", baseColor: "#ffd700", metallic: 0.9, roughness: 0.2 }, desc: "Add Material" },
      { id: "3d.material.assign", args: { objectId: "obj_sample1", materialId: "mat_sample" }, desc: "Assign Material" },
      { id: "3d.material.make_single_user", args: { objectId: "obj_sample1", slot: 0 }, desc: "Make Single User" },
      { id: "3d.material.set", args: { materialId: "mat_sample", baseColor: "#00ff00", metallic: 0.5 }, desc: "Set Material" },
    ];

    it(`covers ${testCases.length} operations (>= 30)`, () => {
      assert.ok(testCases.length >= 30, `Expected at least 30 test cases, got ${testCases.length}`);
    });

    for (const tc of testCases) {
      it(`undo/redo round trip for ${tc.desc} (${tc.id}) leaves document deeply equal`, () => {
        const baseDoc = createBaseDocument();
        const docBefore = structuredClone(baseDoc);

        const result = run3dOp(tc.id, docBefore, tc.args);
        const docAfter = result.doc;

        // Input immutability check
        assert.deepEqual(docBefore, baseDoc, "run3dOp must not mutate the input document");

        // Diff patches
        const patches = diffPatches(docBefore, docAfter);
        const inversePatches = diffPatches(docAfter, docBefore);

        // Undo
        const docUndone = applyPatches(docAfter, inversePatches);
        assert.deepEqual(docUndone, docBefore, `Undo must restore exactly docBefore for ${tc.id}`);

        // Redo
        const docRedone = applyPatches(docUndone, patches);
        assert.deepEqual(docRedone, docAfter, `Redo must restore exactly docAfter for ${tc.id}`);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // (d) Adjust Last Operation Model
  // ---------------------------------------------------------------------------
  describe("(d) adjustLastOperation: add cylinder 32 -> set 64 gives doc equal to adding 64 directly, 1 undo step", () => {
    it("add cylinder 32 then adjust to 64 gives same mesh as adding 64 directly and reverts cleanly with one undo", () => {
      const cleanup = register3dCommands();
      try {
        const initialDoc = createBaseDocument();
        setDocument(initialDoc);
        useHistoryStore.getState().clearHistory();

        // 1. Run add cylinder 32 through command bus
        const runRes = tryRunCommand("3d.add.cylinder", {
          vertices: 32,
          radius: 1,
          depth: 2,
          name: "AdjustTestCylinder",
        });
        assert.strictEqual(runRes.ok, true);

        // Verify history has exactly 1 step
        assert.strictEqual(useHistoryStore.getState().past.length, 1);
        const lastOp = getLastOperation();
        assert.ok(lastOp);
        assert.strictEqual(lastOp.id, "3d.add.cylinder");
        assert.strictEqual(lastOp.args.vertices, 32);

        const doc32 = getDocument();
        const obj32 = Object.values(doc32.objects ?? {}).find((o) => o.name === "AdjustTestCylinder")!;
        assert.ok(obj32);
        const mesh32 = doc32.meshes![obj32.dataId!];
        // 2 + 2 * 32 = 66 vertices * 3 = 198 positions
        assert.strictEqual(mesh32.positions!.length, 66 * 3);

        // 2. Adjust last operation to 64 vertices
        const adjusted = adjustLastOperation({ vertices: 64 });
        assert.strictEqual(adjusted, true);

        // Check history STILL has exactly 1 step (replaced in-place)
        assert.strictEqual(useHistoryStore.getState().past.length, 1);

        const docAdjusted = getDocument();
        const objAdjusted = Object.values(docAdjusted.objects ?? {}).find((o) => o.name === "AdjustTestCylinder")!;
        assert.ok(objAdjusted);
        const meshAdjusted = docAdjusted.meshes![objAdjusted.dataId!];
        // 2 + 2 * 64 = 130 vertices * 3 = 390 positions
        assert.strictEqual(meshAdjusted.positions!.length, 130 * 3);

        // Direct comparison with cylinder(64)
        const direct64 = cylinder({ vertices: 64, radius: 1, depth: 2 });
        assert.strictEqual(meshAdjusted.positions!.length, direct64.positions.length);
        assert.strictEqual(meshAdjusted.indices!.length, direct64.indices.length);
        for (let i = 0; i < direct64.positions.length; i++) {
          assertAlmostEqual(meshAdjusted.positions![i], direct64.positions[i], 1e-4);
        }

        // 3. Exactly ONE undo returns to initial document state
        const undone = historyCommands.undo();
        assert.strictEqual(undone, true);
        assert.strictEqual(useHistoryStore.getState().past.length, 0);

        const finalDoc = getDocument();
        assert.strictEqual(finalDoc.objects?.[objAdjusted.id], undefined);
        assert.strictEqual(finalDoc.meshes?.[meshAdjusted.id], undefined);
        assert.deepEqual(finalDoc, initialDoc);
      } finally {
        cleanup();
      }
    });

    it("external document edits clear the last operation", () => {
      const initialDoc = createBaseDocument();
      recordLastOperation({
        id: "3d.add.cube",
        args: { size: 1 },
        docBefore: initialDoc,
        title: "Add Cube",
      });

      assert.ok(getLastOperation());
      clearLastOperation();
      assert.strictEqual(getLastOperation(), null);
    });

    it("describeArgs returns parameter metadata for UI controls", () => {
      const cylArgs = describeArgs("3d.add.cylinder");
      assert.ok(cylArgs.length > 0);

      const vertArg = cylArgs.find((a) => a.name === "vertices");
      assert.ok(vertArg);
      assert.strictEqual(vertArg.type, "number");
      assert.strictEqual(vertArg.min, 3);
      assert.strictEqual(vertArg.max, 256);
      assert.strictEqual(vertArg.default, 32);

      const radArg = cylArgs.find((a) => a.name === "radius");
      assert.ok(radArg);
      assert.strictEqual(radArg.type, "number");
      assert.strictEqual(radArg.default, 1);

      const camArgs = describeArgs("3d.add.camera");
      const typeArg = camArgs.find((a) => a.name === "type");
      assert.ok(typeArg);
      assert.strictEqual(typeArg.type, "enum");
      assert.deepEqual(typeArg.options, ["perspective", "orthographic"]);
    });
  });
});
