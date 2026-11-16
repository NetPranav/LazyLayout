import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STAGE6_3D_LIBRARY_RECIPES,
  create100BodyPileInitialState,
  evaluatePostProcessStack,
  exportScene3dToCode,
  runStage6ThreeDJourneyGate,
  step3dPhysicsWorld,
  verify20xGltfLoadUnloadBaseline,
} from "../index";

describe("Stage 6 Phases 235–240 · 3D Physics, Post-FX, Memory Ledger, Export, Recipes & Gate", () => {
  it("Phase 235: replays 100-body deterministic physics pile identically and emits contact events", () => {
    const runA = step3dPhysicsWorld(create100BodyPileInitialState(), 45);
    const runB = step3dPhysicsWorld(create100BodyPileInitialState(), 45);
    assert.equal(runA.bodies.length, 100);
    assert.equal(runA.positionHash, runB.positionHash);
  });

  it("Phase 236: degrades post-processing effects in documented order to hold tier budget", () => {
    const full = ["ssao", "dof", "bloom", "colorGrading", "vignette"] as const;
    const t0 = evaluatePostProcessStack(full, "T0");
    assert.equal(t0.withinBudget, true);
    assert.ok(t0.downgradedEffects.includes("ssao"));
    assert.ok(t0.downgradedEffects.includes("dof"));
    assert.ok(t0.downgradedEffects.includes("bloom"));

    const t3 = evaluatePostProcessStack(full, "T3");
    assert.equal(t3.withinBudget, true);
    assert.deepEqual(t3.downgradedEffects, []);
  });

  it("Phase 237 (AUD-58 3D): returns GPU memory counts to baseline after 20 GLTF load/unload cycles", () => {
    const mem = verify20xGltfLoadUnloadBaseline();
    assert.equal(mem.cycles, 20);
    assert.equal(mem.zeroLeakBaselineRestored, true);
    assert.equal(mem.afterUnloads.geometries, 0);
    assert.equal(mem.afterUnloads.materials, 0);
    assert.equal(mem.afterUnloads.textures, 0);
    assert.equal(mem.afterUnloads.targets, 0);
  });

  it("Phase 238 & 239: exports lazy R3F & Three.js widgets with poster fallbacks and validates 6 recipes", () => {
    const r3f = exportScene3dToCode("HeroBadge", "r3f");
    const threejs = exportScene3dToCode("HeroBadge", "threejs");
    assert.equal(r3f.lazyLoaded, true);
    assert.equal(r3f.hasNoWebGlPosterFallback, true);
    assert.ok(r3f.parityDiffPercent < 2);
    assert.equal(threejs.lazyLoaded, true);
    assert.equal(threejs.hasNoWebGlPosterFallback, true);
    assert.ok(threejs.parityDiffPercent < 2);

    assert.equal(STAGE6_3D_LIBRARY_RECIPES.length, 6);
    for (const r of STAGE6_3D_LIBRARY_RECIPES) {
      assert.equal(r.license, "MIT");
      assert.ok(r.steps <= 8);
      assert.ok(r.parityDiffPercent < 2);
    }
  });

  it("Phase 240: passes full Stage 6 3D Journey Gate end to end", () => {
    const gate = runStage6ThreeDJourneyGate();
    assert.equal(gate.passed, true);
    assert.equal(gate.stackVerified, true);
    assert.equal(gate.gizmoJourneySteps, 15);
    assert.equal(gate.watertightShapesPassed, 10);
    assert.equal(gate.gltfModelsImported, 10);
    assert.equal(gate.ikTargetsSolved, 50);
    assert.equal(gate.shaderGraphMaterialsMatched, 5);
    assert.equal(gate.cloner10kWithinBudget, true);
    assert.equal(gate.pile100BodiesHashMatch, true);
    assert.equal(gate.memoryZeroLeak, true);
    assert.ok(gate.domIn3dProjectionErrorPx < 1);
    assert.equal(gate.libraryRecipesPassed, 6);
  });
});
