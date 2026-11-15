import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LiveLinked2dTo3dSurface,
  Scene3dLayerHost,
  TEN_REFERENCE_2D_SHAPES,
  build3dFrom2dShape,
  checkMeshWatertight,
  createParametricPrimitive,
  eulerDegToQuat,
  evaluateNodeWorldTransform,
  get3dInspectorFields,
  quatToEulerDeg,
  reparentPreservingWorldTransform,
  run15StepGizmoJourney,
  verify3dStackDecisionAndLicenses,
} from "../index";

describe("Stage 6 Phases 218–223 · Stack, Scene Layer, Viewport, Hierarchy, Primitives & Inflate", () => {
  it("Phase 218: verifies Decision 0013 3D dependency licences & WebGPU/WebGL2 fallback", () => {
    const report = verify3dStackDecisionAndLicenses();
    assert.equal(report.valid, true);
    assert.deepEqual(report.missingPackages, []);
    assert.deepEqual(report.disallowedLicenses, []);
    assert.equal(report.fallbackReady, true);
    assert.equal(report.webGpuWithWebGl2Fallback, true);
  });

  it("Phase 219 (AUD-11): lazily loads scene3d layer, shares compositor context & recovers context loss in 3 browsers", () => {
    const host = new Scene3dLayerHost("scene_hero");
    assert.equal(host.isLoaded(), false);
    host.addEntity({ id: "mesh_1", name: "Bottle", archetype: "object3d", visible: true });
    host.addEntity({ id: "cam_1", name: "Cam", archetype: "camera3d", visible: true });
    host.addEntity({ id: "light_1", name: "Key", archetype: "light3d", visible: true });

    const init = host.ensureLoaded(true);
    assert.equal(init.loaded, true);

    for (const browser of ["chromium", "firefox", "webkit"] as const) {
      const rec = host.simulateContextLossAndRecovery(browser);
      assert.equal(rec.preservedEntityCount, 3);
      assert.ok(rec.posterHash.startsWith("poster3d://scene_hero/"));
      assert.equal(host.isContextLost(), false);
    }
  });

  it("Phase 220: executes 15-step gizmo journey with exact transforms and 1 undo step per gesture", () => {
    const report = run15StepGizmoJourney();
    assert.equal(report.stepsCompleted, 15);
    assert.equal(report.undoStepsMatched, true);
    assert.equal(report.restoredToInitial, true);
    assert.equal(report.pickedNodeId, "hero_cube");
  });

  it("Phase 221: converts Euler <-> Quaternion cleanly and reparents preserving world transforms", () => {
    const q = eulerDegToQuat({ x: 15, y: 40, z: -20 });
    const back = quatToEulerDeg(q);
    assert.ok(Math.abs(back.x - 15) < 0.1);
    assert.ok(Math.abs(back.y - 40) < 0.1);
    assert.ok(Math.abs(back.z + 20) < 0.1);

    const nodes = [
      {
        id: "root_rig",
        name: "Rig",
        parentId: null,
        visible: true,
        radius: 1,
        localTransform: { position: { x: 3, y: 2, z: -1 }, rotation: eulerDegToQuat({ x: 0, y: 90, z: 0 }), scale: { x: 2, y: 2, z: 2 } },
      },
      {
        id: "prop",
        name: "Prop",
        parentId: null,
        visible: true,
        radius: 1,
        localTransform: { position: { x: 7, y: 4, z: 2 }, rotation: eulerDegToQuat({ x: 10, y: 20, z: 0 }), scale: { x: 1, y: 1, z: 1 } },
      },
    ];
    const worldBefore = evaluateNodeWorldTransform(nodes, "prop");
    const reparented = reparentPreservingWorldTransform(nodes, "prop", "root_rig");
    const worldAfter = evaluateNodeWorldTransform(reparented, "prop");

    assert.ok(Math.abs(worldAfter.position.x - worldBefore.position.x) < 1e-6);
    assert.ok(Math.abs(worldAfter.position.y - worldBefore.position.y) < 1e-6);
    assert.ok(Math.abs(worldAfter.position.z - worldBefore.position.z) < 1e-6);
    assert.equal(get3dInspectorFields(reparented[1], "pro").length, 4);
  });

  it("Phase 222: builds deterministic primitives & extruded 3D text with editable handles", () => {
    for (const kind of ["box", "sphere", "cylinder", "torus", "plane", "capsule", "text3d"] as const) {
      const a = createParametricPrimitive(kind, { size: 1.5, text: "STUDIO" });
      const b = createParametricPrimitive(kind, { size: 1.5, text: "STUDIO" });
      assert.equal(a.mesh.hash, b.mesh.hash);
      assert.ok(a.mesh.indices.length >= 12);
      assert.ok(a.handles.length >= 1);
    }
  });

  it("Phase 223: produces watertight extrude/inflate/lathe meshes across 10 reference contours and links live < 100 ms", () => {
    for (const shape of TEN_REFERENCE_2D_SHAPES) {
      for (const mode of ["extrude", "inflate", "lathe"] as const) {
        const mesh = build3dFrom2dShape(shape, mode);
        const wt = checkMeshWatertight(mesh);
        assert.equal(wt.watertight, true, `Expected watertight mesh for mode=${mode}`);
        assert.equal(wt.boundaryEdgeCount, 0);
      }
    }
    const surface = new LiveLinked2dTo3dSurface(TEN_REFERENCE_2D_SHAPES[0], "inflate");
    surface.update2dContour(TEN_REFERENCE_2D_SHAPES[4]);
    assert.ok(surface.lastUpdateMs < 100);
    assert.equal(checkMeshWatertight(surface.getMesh()).watertight, true);
  });
});
