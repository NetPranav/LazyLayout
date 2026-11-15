import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FIVE_GRAPH_MATERIALS,
  compileAndCompareShaderGraph3d,
  eulerDegToQuat,
  evaluate3dInstancedCloner,
  evaluate3dReactionsTapeFrame,
  evaluate3dTimelineTrack,
  evaluateGltfAnimationClip,
  generate50Reachable3dIkTargets,
  projectDomLayerInto3dScene,
  solve3dIkChain,
} from "../index";

describe("Stage 6 Phases 228–234 · 3D Timeline, GLTF Clips, 3D IK, TSL Shaders, DOM-in-3D & Instancing", () => {
  it("Phase 228: evaluates 3D quaternion SLERP keyframe tracks, motion path & onion skins across 5 timestamps", () => {
    const keys = [
      { timeSec: 0, position: { x: 0, y: 0, z: 0 }, rotation: eulerDegToQuat({ x: 0, y: 0, z: 0 }), scale: { x: 1, y: 1, z: 1 }, materialRoughness: 0.2 },
      { timeSec: 2, position: { x: 4, y: 2, z: -2 }, rotation: eulerDegToQuat({ x: 0, y: 90, z: 0 }), scale: { x: 2, y: 2, z: 2 }, materialRoughness: 0.8 },
    ];
    for (const t of [0, 0.5, 1.0, 1.5, 2.0]) {
      const sample = evaluate3dTimelineTrack(keys, t);
      assert.equal(sample.motionPathPoints.length, 13);
      assert.equal(sample.onionSkinPoses.length, 4);
    }
    const mid = evaluate3dTimelineTrack(keys, 1.0);
    assert.ok(Math.abs(mid.position.x - 2) < 1e-6);
    assert.ok(Math.abs(mid.materialRoughness - 0.5) < 1e-6);
  });

  it("Phase 229: plays trimmed, looped, speed-adjusted GLTF skeletal + morph clip deterministically", () => {
    const clip = {
      id: "hero_walk",
      name: "Walk",
      durationSec: 2.0,
      trimStartSec: 0.2,
      trimEndSec: 1.4,
      loop: true,
      speed: 2.0,
      morphNames: ["smile", "blink"],
    };
    const s = evaluateGltfAnimationClip(clip, 0.3, 0.8);
    assert.ok(s.localClipTimeSec >= 0.2 && s.localClipTimeSec <= 1.4);
    assert.ok("smile" in s.morphWeights && "blink" in s.morphWeights);
  });

  it("Phase 230: solves all 50 reachable 3D IK target positions accurately without violating cone angle limits", () => {
    const targets = generate50Reachable3dIkTargets();
    assert.equal(targets.length, 50);
    for (const target of targets) {
      const res = solve3dIkChain({ x: 0, y: 0, z: 0 }, [0.9, 0.8, 0.6], target, 145);
      assert.ok(res.tipError < 0.05, `Target ${JSON.stringify(target)} tipError=${res.tipError}`);
      assert.equal(res.withinAngleLimit, true);
    }
  });

  it("Phase 231: compiles 5 shader graph materials to both TSL/WGSL and WebGL2 GLSL within parity tolerance", () => {
    assert.equal(FIVE_GRAPH_MATERIALS.length, 5);
    for (const mat of FIVE_GRAPH_MATERIALS) {
      const out = compileAndCompareShaderGraph3d(mat, { u: 0.35, v: 0.72 }, 0.65, 1.2);
      assert.ok(out.tslWgsl.includes("-> vec3<f32>"));
      assert.ok(out.webgl2Glsl.includes("mix("));
      assert.ok(out.maxChannelDiff < 0.01);
    }
  });

  it("Phase 232 & 233: emits raycast Blueprint events and projects accessible CSS3D DOM layers within < 1 px", () => {
    const rxEnterClick = evaluate3dReactionsTapeFrame(null, false, {
      pointerNormX: 0.6,
      pointerNormY: -0.3,
      scrollProgress: 0.4,
      pointerDown: true,
      raycastHitId: "product_mesh",
      keysPressed: ["ArrowRight"],
    });
    assert.equal(rxEnterClick.output.orbitYawDeltaDeg, 6);
    assert.deepEqual(
      rxEnterClick.output.emittedEvents.map((e) => e.kind),
      ["object3d.enter", "object3d.click"],
    );

    const domProj = projectDomLayerInto3dScene(
      {
        id: "buy_btn",
        role: "button",
        ariaLabel: "Buy Foil Edition",
        worldPosition: { x: 0.5, y: 0.2, z: 0 },
        rotationDeg: { x: 0, y: 12, z: 0 },
        widthPx: 140,
        heightPx: 44,
      },
      { x: 0, y: 0, z: 5 },
      { width: 1280, height: 720, fovDeg: 45 },
    );
    assert.equal(domProj.keepInA11yTree, true);
    assert.ok(domProj.projectionErrorPx < 1);
    assert.ok(domProj.cssMatrix3d.startsWith("matrix3d("));
  });

  it("Phase 234: holds 10,000 instanced cloner elements within mid-tier frame budget across layout modes", () => {
    for (const mode of ["grid", "radial", "scatter", "path"] as const) {
      const rep = evaluate3dInstancedCloner(mode, 10000);
      assert.equal(rep.instanceCount, 10000);
      assert.equal(rep.drawCalls, 3);
      assert.equal(rep.withinMidTierBudget, true, `Mode ${mode} took ${rep.evalMs}ms`);
    }
  });
});
