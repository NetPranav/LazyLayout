import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AiServiceGateway3D,
  ANIME_PROCEDURAL_VFX,
  LIGHT_RIG_LOOKS_V1,
  MAKE_3D_WIZARDS,
  MATERIAL_LOOKS_V1,
  buildWebgl2MicroRenderer,
  computeHomographyCornerPin,
  computePointerLightState,
  evaluateAnimeSteppedTime,
  evaluateFiveRecipeSizeGate,
  evaluatePropertyLinks3d,
  exportZeroScriptCssReaction,
  mixMultipleAnimationsLive,
  projectTextOntoPhotoSurface,
  runAllRoadmap3dGates,
  runGateAReactiveButton,
  runGateBPhotoStudio,
  runGateCAnimeStudio,
  runGateM1FoilButton,
  runGateM2ProductHero,
  runGateM3LivingComponents,
  runGateM4FullShip,
  subdivideCatmullClark,
  verifyCustomShaderSafety,
  verifyEightStepRecipes,
} from "../index";

describe("ROADMAP_3D Full Suite (3D-001 – 3D-227)", () => {
  it("M1 (3D-031..3D-062): Subdivision, PBR Material Looks v1, Light Rigs & Gate M1 Foil Button pass", () => {
    assert.equal(Object.keys(MATERIAL_LOOKS_V1).length, 12);
    assert.equal(Object.keys(LIGHT_RIG_LOOKS_V1).length, 7);

    const mesh = {
      vertices: [
        [-1, -1, 0],
        [1, -1, 0],
        [1, 1, 0],
        [-1, 1, 0],
      ] as const,
      faces: [[0, 1, 2, 3]] as const,
    };
    const sub = subdivideCatmullClark(mesh, 1, [{ edge: [0, 1], weight: 0.5 }]);
    assert.equal(sub.mesh.faces.length, 4);

    const gateM1 = runGateM1FoilButton();
    assert.equal(gateM1.passed, true);
    assert.equal(gateM1.pathTracerExcluded, true);
    assert.ok(gateM1.exportGzipBytes <= 60_000);
  });

  it("M1+ (3D-191..3D-200): Zero-Script CSS (0 B JS), WebGL2 Micro-Renderer (<=25KB), Pointer Light & Gate A pass", () => {
    const css = exportZeroScriptCssReaction(".btn", "tilt");
    assert.equal(css.jsGzipBytes, 0);

    const micro = buildWebgl2MicroRenderer(["pbr", "pointer-light", "baked-anim", "poster"]);
    assert.equal(micro.usesThreeJs, false);
    assert.equal(micro.within25KbBudget, true);

    const fiveGate = evaluateFiveRecipeSizeGate();
    assert.equal(fiveGate.passed, true);

    const reduced = computePointerLightState(0.8, 0.8, "Opposite", true, 0);
    assert.equal(reduced.reducedMotionStatic, true);

    const gateA = runGateAReactiveButton();
    assert.equal(gateA.passed, true);
    assert.equal(gateA.distinctNinePointPositions, 9);
    assert.equal(gateA.noEditorLeaks, true);
  });

  it("M2 & 3D-227 (3D-063..3D-116, 3D-227): Shader safety, cycle check, Live Animation Mixing & Gate M2 pass", () => {
    const badShader = verifyCustomShaderSafety("void main() { for(;;) {} }");
    assert.equal(badShader.safe, false);

    const cycle = evaluatePropertyLinks3d([
      ["p1", "p2"],
      ["p2", "p1"],
    ]);
    assert.equal(cycle.valid, false);
    assert.equal(cycle.code, "[LINK_CYCLE]");

    const mixed = mixMultipleAnimationsLive([
      {
        id: "base",
        weight: 1,
        additive: false,
        boneMask: "all",
        poseEulerDeg: { spine: [5, 0, 0], pelvis: [0, 2, 0] },
      },
      {
        id: "wave",
        weight: 0.5,
        additive: true,
        boneMask: "upper-body",
        poseEulerDeg: { spine: [0, 30, 0], pelvis: [0, 500, 0] },
      },
    ]);
    const spine = mixed.blendedBones.find((b) => b.bone === "spine")!;
    const pelvis = mixed.blendedBones.find((b) => b.bone === "pelvis")!;
    assert.equal(spine.rotationDeg[1], 15);
    assert.equal(pelvis.rotationDeg[1], 2); // pelvis masked out from upper-body wave!

    const gateM2 = runGateM2ProductHero();
    assert.equal(gateM2.passed, true);
  });

  it("M3 & M4 (3D-117..3D-190): Rigging, State Machine, 4 Wizards <=5 steps, 10 Recipes <=8 steps & Gates M3/M4 pass", () => {
    assert.equal(MAKE_3D_WIZARDS.length, 4);
    assert.ok(MAKE_3D_WIZARDS.every((w) => w.steps.length <= 5));

    const eightStep = verifyEightStepRecipes();
    assert.equal(eightStep.passed, true);
    assert.equal(eightStep.recipeCount, 10);

    const gateM3 = runGateM3LivingComponents();
    assert.equal(gateM3.passed, true);

    const gateM4 = runGateM4FullShip();
    assert.equal(gateM4.passed, true);
    assert.equal(gateM4.zeroMemoryLeak100Cycles, true);
  });

  it("M5 & M6 (3D-201..3D-226): AI Privacy Lock, Homography <0.01px, Car Wrap & Anime Twos/VFX pass Gates B & C", () => {
    const gw = new AiServiceGateway3D(true);
    const res = gw.invoke("depth-anything-v2-small", "abc", true);
    assert.equal(res.executedOn, "browser-webgpu");
    assert.equal(res.privacyLockRespected, true);

    const h = computeHomographyCornerPin(
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ],
      [
        [20, 10],
        [140, 22],
        [130, 118],
        [12, 105],
      ],
    );
    assert.ok(h.maxCornerErrorPx < 0.01);

    const wrap = projectTextOntoPhotoSurface({
      text: "SPEED",
      style: "vinyl",
      blendDistinctToIntegrated: 0.8,
      creaseSnap: true,
      pointerNorm: [0.3, 0.2],
    });
    assert.equal(wrap.photoStays2D, true);
    assert.ok(wrap.creaseRecallRatio >= 0.8);

    const f0 = evaluateAnimeSteppedTime(0, "twos");
    const f1 = evaluateAnimeSteppedTime(3, "twos");
    assert.equal(f0.characterPoseIndex, f1.characterPoseIndex);
    assert.equal(ANIME_PROCEDURAL_VFX.length, 12);

    assert.equal(runGateBPhotoStudio().passed, true);
    assert.equal(runGateCAnimeStudio().passed, true);
  });

  it("Master Aggregator runs all 7 Milestone Gates + 3D-227 across all 227 phases", () => {
    const report = runAllRoadmap3dGates();
    assert.equal(report.allPassed, true);
    assert.equal(report.checksRun, 8);
  });
});
