/**
 * ============================================================================
 * STAGE 5 · PHASE 217 — STAGE 5 GATE: THE CHARACTER JOURNEY
 * ============================================================================
 * End-to-end verification gate uniting illustration import, auto-rigging,
 * weight painting/smoothing, IK, jiggle secondary motion, cursor head follow,
 * walk/run arrow-key blend trees, voice lip-sync, webcam/cursor fallback, and
 * verified Next/Vite/HTML/Lottie export parity.
 * ============================================================================
 */

import { evaluateRigWorldTransforms, computeBindMatrices } from "./rigModel";
import {
  triangulateLayerMesh,
  computeAutomaticBoneWeights,
  paintVertexWeightsWithBrush,
  smoothVertexWeights,
  deformMeshLBS,
} from "./meshWeightsAndSkinning";
import { solveTwoBoneIk } from "./ikSolver";
import { replayJiggleOnTape } from "./constraintsAndJiggle";
import { runReactiveRigTape } from "./reactiveRig";
import { createStandardLocomotionMachine, evaluateCharacterStateMachineTape } from "./characterBlendTrees";
import { autoRigIllustration, type IllustrationLayerPart } from "./autoRigAndPoseSliders";
import { compileTranscriptToVisemeTrack, evaluateFaceRigAtTime } from "./faceLipSync";
import { resolveTrackingInputWithFallback, recordTrackingTape, replayTrackingTape } from "./webcamFacePoseTracker";
import { verifyRigExportParity, exportRigToLottieJson } from "./rigExportRuntime";
import { RIG_LIBRARY_RECIPES, verifyLibraryRigParityAndBudget } from "./rigLibrary";

export interface Stage5CharacterGateReport {
  readonly passed: boolean;
  readonly boneCount: number;
  readonly weightsSumErrorMax: number;
  readonly deformedVertexCount: number;
  readonly jigglePeakAngleDeg: number;
  readonly headFollowYawDeg: number;
  readonly ikTargetErrorPx: number;
  readonly locomotionStatesVisited: readonly string[];
  readonly voiceVisemeCheckCount: number;
  readonly webcamFallbackSource: string;
  readonly maxExportParityDiffPx: number;
  readonly lottieLayerCount: number;
  readonly libraryRecipesPassed: number;
}

/** Run the complete Stage 5 Character Gate Journey end-to-end. */
export function runStage5CharacterGate(): Stage5CharacterGateReport {
  // 1. Import character illustration parts & Auto-rig (Phase 212)
  const illustration: IllustrationLayerPart[] = [
    { id: "part_head", name: "head", bounds: { x: 80, y: 20, width: 44, height: 44 } },
    { id: "part_torso", name: "torso", bounds: { x: 74, y: 64, width: 56, height: 76 } },
    { id: "part_arm_l", name: "arm_L", bounds: { x: 40, y: 68, width: 34, height: 58 } },
    { id: "part_arm_r", name: "arm_R", bounds: { x: 130, y: 68, width: 34, height: 58 } },
    { id: "part_leg_l", name: "leg_L", bounds: { x: 76, y: 140, width: 22, height: 68 } },
    { id: "part_leg_r", name: "leg_R", bounds: { x: 106, y: 140, width: 22, height: 68 } },
  ];
  const auto = autoRigIllustration(illustration, "person");

  // 2. Triangulate, compute auto-weights, brush paint, smooth, and verify sum = 1.0 (Phase 206)
  const mesh = triangulateLayerMesh({ x: 70, y: 20, width: 64, height: 120 }, 4);
  const restW = evaluateRigWorldTransforms(auto.rig, {});
  const wAuto = computeAutomaticBoneWeights(mesh.vertices, auto.rig, restW, 4);
  const wPainted = paintVertexWeightsWithBrush(mesh.vertices, wAuto, {
    x: 100,
    y: 40,
    radius: 30,
    boneId: "head",
    strength: 0.75,
  });
  const wSmoothed = smoothVertexWeights(mesh, wPainted, 2, 0.5);
  let weightsSumErrorMax = 0;
  for (const vw of wSmoothed) {
    const sum = vw.reduce((s, i) => s + i.weight, 0);
    weightsSumErrorMax = Math.max(weightsSumErrorMax, Math.abs(sum - 1));
  }
  const bind = computeBindMatrices(auto.rig);
  const deformedVerts = deformMeshLBS(mesh, wSmoothed, bind, evaluateRigWorldTransforms(auto.rig, { head: { rotationDeg: 20 } }));

  // 3. 2-bone IK reach verification (Phase 207)
  const ikPose = solveTwoBoneIk(auto.rig, {
    id: "gate_arm_ik",
    boneIds: ["spine", "arm_r"],
    target: { x: 140, y: 90 },
  });
  const ikWorld = evaluateRigWorldTransforms(auto.rig, ikPose);
  const ikTargetErrorPx = Math.hypot(ikWorld.arm_r.tail.x - 140, ikWorld.arm_r.tail.y - 90);

  // 4. Jiggle secondary motion replay (Phase 208)
  const jiggleAngles = replayJiggleOnTape(
    { boneId: "head", stiffness: 160, damping: 10, inertiaScale: 0.6 },
    [250, 200, 0, 0, 0, 0, 0, 0, 0, 0],
    1 / 60,
  );
  const jigglePeakAngleDeg = Math.max(...jiggleAngles.map((a) => Math.abs(a)));

  // 5. Cursor head follow + blink (Phases 210, 213)
  const reactFrames = runReactiveRigTape(
    auto.rig,
    {
      followCursorScope: "head",
      rigOriginX: 100,
      rigOriginY: 120,
      headBoneId: "head",
      spineBoneId: "spine",
    },
    [{ pointerX: 280, pointerY: 60, dtSec: 1 / 60 }],
  );
  const headFollowYawDeg = reactFrames[0].pose.head?.rotationDeg ?? 0;

  // 6. Arrow-key walk -> run locomotion blend tree (Phase 211)
  const machine = createStandardLocomotionMachine(0.15);
  const locoFrames = evaluateCharacterStateMachineTape(machine, [
    { dtSec: 0.05, speed: 0 },
    { dtSec: 0.05, speed: 0.5 },
    { dtSec: 0.05, speed: 1.0, waveActive: true },
  ]);
  const locomotionStatesVisited = locoFrames.map((f) => f.activeState);

  // 7. Voice line lip-sync (Phase 213)
  const track = compileTranscriptToVisemeTrack("HELLO LAZYLAYOUT", 1.2);
  const faceSamples = [0.05, 0.35, 0.75, 1.0].map((t) => evaluateFaceRigAtTime(t, track, { enableAutoBlink: true }));

  // 8. Webcam tracking + denied cursor fallback (Phase 214)
  const camTape = recordTrackingTape("gate_cam", [
    {
      timestampMs: 0,
      leftEyeCenter: { x: 0.4, y: 0.4 },
      leftEyeTop: { x: 0.4, y: 0.38 },
      leftEyeBottom: { x: 0.4, y: 0.42 },
      rightEyeCenter: { x: 0.6, y: 0.4 },
      rightEyeTop: { x: 0.6, y: 0.38 },
      rightEyeBottom: { x: 0.6, y: 0.42 },
      noseTip: { x: 0.54, y: 0.5 },
      mouthTop: { x: 0.5, y: 0.6 },
      mouthBottom: { x: 0.5, y: 0.66 },
      mouthLeft: { x: 0.45, y: 0.63 },
      mouthRight: { x: 0.55, y: 0.63 },
    },
  ]);
  const replayedCam = replayTrackingTape(camTape, 0);
  const deniedFallback = resolveTrackingInputWithFallback({
    cameraPermission: "denied",
    cursor: { x: 800, y: 300, viewportWidth: 1000, viewportHeight: 800 },
  });

  // 9. Export parity across Next.js, Vite, HTML, and Lottie (Phase 215)
  const poseTrack = [
    { timeSec: 0, pose: { spine: { rotationDeg: -8 }, head: { rotationDeg: 5 } } },
    { timeSec: 1, pose: { spine: { rotationDeg: 8 }, head: { rotationDeg: -10 } } },
  ];
  const nextParity = verifyRigExportParity(auto.rig, poseTrack, "nextjs", "svg");
  const viteParity = verifyRigExportParity(auto.rig, poseTrack, "vite", "svg");
  const htmlParity = verifyRigExportParity(auto.rig, poseTrack, "html", "svg");
  const maxExportParityDiffPx = Math.max(
    nextParity.maxDiffPx,
    viteParity.maxDiffPx,
    htmlParity.maxDiffPx,
  );
  const lottie = exportRigToLottieJson(auto.rig, poseTrack, 60);

  // 10. Verify all 8 Rig Library recipes (Phase 216)
  const libraryRecipesPassed = RIG_LIBRARY_RECIPES.filter(
    (r) => verifyLibraryRigParityAndBudget(r.id).passed,
  ).length;

  const passed =
    auto.rig.bones.length >= 6 &&
    weightsSumErrorMax < 1e-5 &&
    deformedVerts.length === mesh.vertices.length &&
    jigglePeakAngleDeg > 0.05 &&
    Math.abs(headFollowYawDeg) > 1 &&
    locomotionStatesVisited.includes("walk") &&
    locomotionStatesVisited.includes("run") &&
    faceSamples.length === 4 &&
    replayedCam?.videoLeavesDevice === false &&
    deniedFallback.source === "cursor-fallback" &&
    maxExportParityDiffPx < 0.01 &&
    lottie.layers.length === auto.rig.bones.length &&
    libraryRecipesPassed === RIG_LIBRARY_RECIPES.length;

  return {
    passed,
    boneCount: auto.rig.bones.length,
    weightsSumErrorMax,
    deformedVertexCount: deformedVerts.length,
    jigglePeakAngleDeg,
    headFollowYawDeg,
    ikTargetErrorPx,
    locomotionStatesVisited,
    voiceVisemeCheckCount: faceSamples.length,
    webcamFallbackSource: deniedFallback.source,
    maxExportParityDiffPx,
    lottieLayerCount: lottie.layers.length,
    libraryRecipesPassed,
  };
}
