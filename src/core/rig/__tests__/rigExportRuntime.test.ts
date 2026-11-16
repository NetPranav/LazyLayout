import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRigDefinition } from "../rigModel";
import {
  shouldIncludeRigRuntime,
  emitRigRuntimeSource,
  exportRigForFramework,
  verifyRigExportParity,
  exportRigToLottieJson,
  loadExportedRigRuntime,
} from "../rigExportRuntime";
import type { BonePoseTrack } from "../boneTimeline";

describe("Phase 215 · Rig export runtime (5 reference rigs across Next/Vite/HTML + Lottie)", () => {
  const buildRef = (id: string, length: number) =>
    createRigDefinition(id, `Ref-${id}`, `layer_${id}`, [
      { id: "root", name: "Root", parentId: null, length, restX: 100, restY: 120, restRotationDeg: -90 },
      { id: "child", name: "Child", parentId: "root", length: length * 0.7, restX: 0, restY: 0, restRotationDeg: 0 },
      { id: "tip", name: "Tip", parentId: "child", length: length * 0.4, restX: 0, restY: 0, restRotationDeg: 0 },
    ]);

  const track: BonePoseTrack = [
    { timeSec: 0, pose: { root: { rotationDeg: 0 }, child: { rotationDeg: 10 } } },
    { timeSec: 0.5, pose: { root: { rotationDeg: 25 }, child: { rotationDeg: -35 } } },
    { timeSec: 1.0, pose: { root: { rotationDeg: 0 }, child: { rotationDeg: 10 } } },
  ];

  it("excludes rig runtime when unused and includes valid MIT SVG/Canvas/WebGL runtimes when used", () => {
    assert.equal(shouldIncludeRigRuntime(false), false);
    assert.equal(shouldIncludeRigRuntime(true), true);
    assert.ok(emitRigRuntimeSource("svg").includes("MIT License"));
    assert.ok(emitRigRuntimeSource("webgl").includes("Float32Array"));
  });

  it("passes tape parity across all 5 rigged references in Next.js, Vite, and HTML targets", () => {
    const refs = [buildRef("r1", 50), buildRef("r2", 75), buildRef("r3", 40), buildRef("r4", 90), buildRef("r5", 60)];
    const targets = ["nextjs", "vite", "html"] as const;

    for (const rig of refs) {
      for (const target of targets) {
        const res = verifyRigExportParity(rig, track, target, "svg");
        assert.equal(res.passed, true, `${rig.id} on ${target} failed parity`);
        assert.ok(res.maxDiffPx < 0.01);
        const exported = exportRigForFramework(rig, target, track);
        assert.equal(exported.includesRigRuntime, true);
      }
    }
  });

  it("exports bone hierarchy and keyframes cleanly to Lottie v5.7.4 JSON", () => {
    const rig = buildRef("lottie_ref", 60);
    const lottie = exportRigToLottieJson(rig, track, 60);
    assert.equal(lottie.v, "5.7.4");
    assert.equal(lottie.layers.length, 3);
    assert.equal(lottie.layers[0].parent, undefined);
    assert.equal(lottie.layers[1].parent, lottie.layers[0].ind);
    assert.equal(lottie.layers[2].parent, lottie.layers[1].ind);
    assert.equal(lottie.layers[0].ks.r.k.length, 3);
  });
});

describe("Phase 215 · the parity check runs the exported runtime (audit 2026-11-16)", () => {
  const track: BonePoseTrack = [
    { timeSec: 0, pose: { root: { rotationDeg: 0 }, child: { rotationDeg: 10 } } },
    { timeSec: 1.0, pose: { root: { rotationDeg: 40 }, child: { rotationDeg: -35 } } },
  ];

  it("a rig whose bones are listed child first still exports with parity", () => {
    // Built by hand: createRigDefinition sorts the bones, but bones added later by the bone tool can arrive in any order.
    const sorted = createRigDefinition("unordered", "Unordered", "layer_u", [
      { id: "root", name: "Root", parentId: null, length: 50, restX: 100, restY: 120, restRotationDeg: -90 },
      { id: "child", name: "Child", parentId: "root", length: 35, restX: 0, restY: 0, restRotationDeg: 15 },
      { id: "tip", name: "Tip", parentId: "child", length: 20, restX: 0, restY: 0, restRotationDeg: 0 },
    ]);
    const rig = { ...sorted, bones: [...sorted.bones].reverse() };
    for (const target of ["nextjs", "vite", "html"] as const) {
      const res = verifyRigExportParity(rig, track, target, "svg");
      assert.ok(res.maxDiffPx < 0.01, `${target}: ${res.maxDiffPx}`);
    }
  });

  it("a broken exported runtime fails the parity check", () => {
    const rig = createRigDefinition("r", "R", "layer_r", [
      { id: "root", name: "Root", parentId: null, length: 50, restX: 100, restY: 120, restRotationDeg: -90 },
      { id: "child", name: "Child", parentId: "root", length: 35, restX: 0, restY: 0, restRotationDeg: 0 },
    ]);
    const broken = emitRigRuntimeSource("svg").replace("const ax = (parent ? parent.length : 0)", "const ax = (parent ? parent.length * 2 : 0)");
    const evalRig = loadExportedRigRuntime(broken);
    const good = loadExportedRigRuntime(emitRigRuntimeSource("svg"));
    assert.notDeepEqual(evalRig(rig, {}).child.head, good(rig, {}).child.head);
  });
});
