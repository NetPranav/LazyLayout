"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  autoRigIllustration,
  evaluatePoseSliders,
  type IllustrationLayerPart,
} from "@/core/rig/autoRigAndPoseSliders";
import { createStandardLocomotionMachine, evaluateCharacterStateMachineTape } from "@/core/rig/characterBlendTrees";
import {
  createInitialJiggleState,
  stepJiggleSimulation,
  type JiggleBoneConfig,
} from "@/core/rig/constraintsAndJiggle";
import { compileTranscriptToVisemeTrack, evaluateFaceRigAtTime } from "@/core/rig/faceLipSync";
import { solveTwoBoneIk } from "@/core/rig/ikSolver";
import {
  computeAutomaticBoneWeights,
  deformMeshLBS,
  paintVertexWeightsWithBrush,
  smoothVertexWeights,
  triangulateLayerMesh,
} from "@/core/rig/meshWeightsAndSkinning";
import { deformMeshWithPuppetPins, type PuppetPin } from "@/core/rig/puppetPins";
import {
  createReactiveRigState,
  evaluateReactiveRigFrame,
  type FollowCursorScope,
} from "@/core/rig/reactiveRig";
import {
  exportRigToLottieJson,
  verifyRigExportParity,
} from "@/core/rig/rigExportRuntime";
import {
  RIG_LIBRARY_RECIPES,
  instantiateLibraryRigWithCursorFollow,
} from "@/core/rig/rigLibrary";
import {
  computeBindMatrices,
  evaluateRigWorldTransforms,
  type RigPoseMap,
} from "@/core/rig/rigModel";
import { runStage5CharacterGate, type Stage5CharacterGateReport } from "@/core/rig/stage5CharacterGate";
import { resolveTrackingInputWithFallback } from "@/core/rig/webcamFacePoseTracker";

const DEFAULT_ILLUSTRATION: readonly IllustrationLayerPart[] = [
  { id: "part_head", name: "head", bounds: { x: 180, y: 50, width: 44, height: 44 } },
  { id: "part_torso", name: "torso", bounds: { x: 172, y: 94, width: 60, height: 80 } },
  { id: "part_arm_l", name: "arm_L", bounds: { x: 136, y: 98, width: 34, height: 60 } },
  { id: "part_arm_r", name: "arm_R", bounds: { x: 234, y: 98, width: 34, height: 60 } },
  { id: "part_leg_l", name: "leg_L", bounds: { x: 176, y: 174, width: 22, height: 68 } },
  { id: "part_leg_r", name: "leg_R", bounds: { x: 206, y: 174, width: 22, height: 68 } },
];

const JIGGLE_CFG: JiggleBoneConfig = {
  boneId: "antenna",
  stiffness: 170,
  damping: 11,
  inertiaScale: 0.7,
  maxAngleDeg: 38,
};

export interface Stage5LabSnapshot {
  readonly autoRigged: boolean;
  readonly boneCount: number;
  readonly followScope: FollowCursorScope;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly headAngleDeg: number;
  readonly jiggleAngleDeg: number;
  readonly weightsSumValid: boolean;
  readonly deformedVertexCount: number;
  readonly ikTargetX: number;
  readonly ikTargetY: number;
  readonly ikErrorPx: number;
  readonly locoState: string;
  readonly waveLayerWeight: number;
  readonly viseme: string;
  readonly jawOpen: number;
  readonly blinkAmount: number;
  readonly trackingSource: string;
  readonly videoLeavesDevice: boolean;
  readonly puppetTipY: number;
  readonly activeRecipeId: string;
}

declare global {
  interface Window {
    __LL_STAGE5_LAB__?: {
      getSnapshot: () => Stage5LabSnapshot;
      runCharacterGate: () => Stage5CharacterGateReport;
      verifyExports: () => {
        nextjsPassed: boolean;
        vitePassed: boolean;
        htmlPassed: boolean;
        lottieLayerCount: number;
        recipesCount: number;
      };
    };
  }
}

export function RigLab() {
  const [autoRigged, setAutoRigged] = useState(true);
  const [activeRecipeId, setActiveRecipeId] = useState(RIG_LIBRARY_RECIPES[0]!.id);
  const [followScope, setFollowScope] = useState<FollowCursorScope>("head");
  const [pointerPos, setPointerPos] = useState({ x: 202, y: 20 });
  const [happySlider, setHappySlider] = useState(0);
  const [waveSlider, setWaveSlider] = useState(0);
  const [ikTarget, setIkTarget] = useState({ x: 295, y: 140 });
  const [useIk, setUseIk] = useState(true);
  const [keysHeld, setKeysHeld] = useState<string[]>([]);
  const [locoState, setLocoState] = useState("idle");
  const [waveLayerWeight, setWaveLayerWeight] = useState(0);
  const [locoPose, setLocoPose] = useState<RigPoseMap>({});
  const [voiceTime, setVoiceTime] = useState(0.2);
  const [forceBlink, setForceBlink] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<"granted" | "denied">("denied");
  const [puppetLift, setPuppetLift] = useState(25);
  const [jiggleAngle, setJiggleAngle] = useState(0);

  const jiggleRef = useRef(createInitialJiggleState());
  const prevPointerRef = useRef({ x: 202, y: 20 });
  const snapshotRef = useRef<Stage5LabSnapshot | null>(null);

  const autoResult = useMemo(
    () => autoRigIllustration(DEFAULT_ILLUSTRATION, "person"),
    [],
  );
  const rig = autoResult.rig;
  const bindMatrices = useMemo(() => computeBindMatrices(rig), [rig]);
  const restWorld = useMemo(() => evaluateRigWorldTransforms(rig, {}), [rig]);

  // Triangulate body mesh and apply painted + smoothed bone weights (Phase 206)
  const bodyMesh = useMemo(
    () => triangulateLayerMesh({ x: 165, y: 50, width: 74, height: 120 }, 3),
    [],
  );
  const bodyWeights = useMemo(() => {
    const raw = computeAutomaticBoneWeights(bodyMesh.vertices, rig, restWorld, 4);
    const painted = paintVertexWeightsWithBrush(bodyMesh.vertices, raw, {
      x: 202,
      y: 72,
      radius: 28,
      boneId: "head",
      strength: 0.7,
    });
    return smoothVertexWeights(bodyMesh, painted, 2, 0.45);
  }, [bodyMesh, rig, restWorld]);

  const weightsSumValid = useMemo(
    () =>
      bodyWeights.every((vw) => Math.abs(vw.reduce((s, w) => s + w.weight, 0) - 1) < 1e-4),
    [bodyWeights],
  );

  // Compute combined pose from Pose Sliders, Reactive Follow, Locomotion State Machine, and 2-bone IK
  const sliderPose = useMemo(
    () =>
      evaluatePoseSliders(autoResult.poseSliders, {
        happy: happySlider,
        wave: waveSlider,
      }),
    [autoResult.poseSliders, happySlider, waveSlider],
  );

  const reactiveEval = useMemo(
    () =>
      evaluateReactiveRigFrame(
        rig,
        createReactiveRigState(),
        {
          followCursorScope: followScope,
          rigOriginX: 202,
          rigOriginY: 130,
          headBoneId: "head",
          spineBoneId: "spine",
          handIkBoneIds: ["spine", "arm_r"],
        },
        {
          pointerX: pointerPos.x,
          pointerY: pointerPos.y,
          keysPressed: keysHeld,
          dtSec: 1 / 60,
        },
      ),
    [rig, followScope, pointerPos, keysHeld],
  );

  const mergedPose = useMemo<RigPoseMap>(() => {
    const out: RigPoseMap = { ...sliderPose };
    for (const [k, v] of Object.entries(locoPose)) {
      out[k] = { ...out[k], ...v };
    }
    if (reactiveEval.pose.head) {
      out.head = {
        ...out.head,
        rotationDeg: (out.head?.rotationDeg ?? 0) + (reactiveEval.pose.head.rotationDeg ?? 0),
      };
    }
    if (useIk) {
      return solveTwoBoneIk(
        rig,
        {
          id: "ui_arm_ik",
          boneIds: ["spine", "arm_r"],
          target: ikTarget,
          bendDirection: 1,
        },
        out,
      );
    }
    return out;
  }, [sliderPose, locoPose, reactiveEval.pose, useIk, rig, ikTarget]);

  const worldTransforms = useMemo(
    () => evaluateRigWorldTransforms(rig, mergedPose),
    [rig, mergedPose],
  );

  const deformedVertices = useMemo(
    () => deformMeshLBS(bodyMesh, bodyWeights, bindMatrices, worldTransforms),
    [bodyMesh, bodyWeights, bindMatrices, worldTransforms],
  );

  const ikErrorPx = useMemo(() => {
    const armTip = worldTransforms.arm_r?.tail;
    if (!armTip) return 0;
    return Math.hypot(armTip.x - ikTarget.x, armTip.y - ikTarget.y);
  }, [worldTransforms, ikTarget]);

  // Voice lip-sync + blink (Phase 213)
  const visemeTrack = useMemo(
    () => compileTranscriptToVisemeTrack("HELLO LAZYLAYOUT CHARACTER", 1.2),
    [],
  );
  const faceState = useMemo(() => {
    const base = evaluateFaceRigAtTime(voiceTime, visemeTrack, {
      enableAutoBlink: true,
      browExpression: happySlider > 0.3 ? "happy" : "neutral",
    });
    return {
      ...base,
      blinkLeft: forceBlink ? 1 : base.blinkLeft,
      blinkRight: forceBlink ? 1 : base.blinkRight,
    };
  }, [voiceTime, visemeTrack, happySlider, forceBlink]);

  // Webcam / Camera-denied Fallback (Phase 214)
  const trackingSignals = useMemo(
    () =>
      resolveTrackingInputWithFallback({
        cameraPermission,
        landmarkFrame:
          cameraPermission === "granted"
            ? {
                timestampMs: 16,
                leftEyeCenter: { x: 0.4, y: 0.4 },
                leftEyeTop: { x: 0.4, y: 0.38 },
                leftEyeBottom: { x: 0.4, y: 0.42 },
                rightEyeCenter: { x: 0.6, y: 0.4 },
                rightEyeTop: { x: 0.6, y: 0.38 },
                rightEyeBottom: { x: 0.6, y: 0.42 },
                noseTip: { x: 0.54, y: 0.5 },
                mouthTop: { x: 0.5, y: 0.6 },
                mouthBottom: { x: 0.5, y: 0.65 },
                mouthLeft: { x: 0.45, y: 0.625 },
                mouthRight: { x: 0.55, y: 0.625 },
              }
            : undefined,
        cursor: {
          x: pointerPos.x,
          y: pointerPos.y,
          viewportWidth: 400,
          viewportHeight: 280,
          timestampMs: 16,
        },
      }),
    [cameraPermission, pointerPos],
  );

  // Puppet pins waving banner (Phase 209)
  const puppetMesh = useMemo(
    () => triangulateLayerMesh({ x: 0, y: 0, width: 160, height: 60 }, 4),
    [],
  );
  const puppetPins = useMemo<readonly PuppetPin[]>(
    () => [
      { id: "p0", name: "Pole", restX: 0, restY: 30, x: 0, y: 30, stiffness: 8, overlapZ: 0 },
      { id: "p1", name: "Mid", restX: 80, restY: 30, x: 80, y: 30 - puppetLift * 0.4, stiffness: 1, overlapZ: 5 },
      { id: "p2", name: "Tip", restX: 160, restY: 30, x: 160, y: 30 - puppetLift, stiffness: 1, overlapZ: 10 },
    ],
    [puppetLift],
  );
  const puppetDeformed = useMemo(
    () => deformMeshWithPuppetPins(puppetMesh, puppetPins),
    [puppetMesh, puppetPins],
  );
  const puppetTipVertex = puppetDeformed[puppetDeformed.length - 1]?.y ?? 60;

  const headAngleDeg = worldTransforms.head?.worldRotationDeg ?? -90;

  const snapshot = useMemo<Stage5LabSnapshot>(
    () => ({
      autoRigged,
      boneCount: rig.bones.length,
      followScope,
      pointerX: pointerPos.x,
      pointerY: pointerPos.y,
      headAngleDeg,
      jiggleAngleDeg: jiggleAngle,
      weightsSumValid,
      deformedVertexCount: deformedVertices.length,
      ikTargetX: ikTarget.x,
      ikTargetY: ikTarget.y,
      ikErrorPx,
      locoState,
      waveLayerWeight,
      viseme: faceState.viseme,
      jawOpen: faceState.jawOpen,
      blinkAmount: faceState.blinkLeft,
      trackingSource: trackingSignals.source,
      videoLeavesDevice: trackingSignals.videoLeavesDevice,
      puppetTipY: puppetTipVertex,
      activeRecipeId,
    }),
    [
      autoRigged,
      rig.bones.length,
      followScope,
      pointerPos.x,
      pointerPos.y,
      headAngleDeg,
      jiggleAngle,
      weightsSumValid,
      deformedVertices.length,
      ikTarget.x,
      ikTarget.y,
      ikErrorPx,
      locoState,
      waveLayerWeight,
      faceState.viseme,
      faceState.jawOpen,
      faceState.blinkLeft,
      trackingSignals.source,
      trackingSignals.videoLeavesDevice,
      puppetTipVertex,
      activeRecipeId,
    ],
  );

  useLayoutEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    window.__LL_STAGE5_LAB__ = {
      getSnapshot: () => snapshotRef.current!,
      runCharacterGate: () => runStage5CharacterGate(),
      verifyExports: () => {
        const poseTrack = [
          { timeSec: 0, pose: { spine: { rotationDeg: -8 }, head: { rotationDeg: 5 } } },
          { timeSec: 1, pose: { spine: { rotationDeg: 8 }, head: { rotationDeg: -10 } } },
        ];
        const nextP = verifyRigExportParity(rig, poseTrack, "nextjs", "svg");
        const viteP = verifyRigExportParity(rig, poseTrack, "vite", "svg");
        const htmlP = verifyRigExportParity(rig, poseTrack, "html", "svg");
        const lottie = exportRigToLottieJson(rig, poseTrack, 60);
        return {
          nextjsPassed: nextP.passed,
          vitePassed: viteP.passed,
          htmlPassed: htmlP.passed,
          lottieLayerCount: lottie.layers.length,
          recipesCount: RIG_LIBRARY_RECIPES.length,
        };
      },
    };
    return () => {
      delete window.__LL_STAGE5_LAB__;
    };
  }, [rig]);

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    const vx = (x - prevPointerRef.current.x) * 8;
    prevPointerRef.current = { x, y };
    jiggleRef.current = stepJiggleSimulation(jiggleRef.current, JIGGLE_CFG, vx, 1 / 60);
    setJiggleAngle(jiggleRef.current.angleDeg);
    setPointerPos({ x, y });
  };

  const handleLocomotionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const nextKeys = Array.from(new Set([...keysHeld, e.code]));
    setKeysHeld(nextKeys);
    const speed = e.shiftKey && e.code === "ArrowRight" ? 1.0 : e.code === "ArrowRight" ? 0.5 : 0;
    const jumpPressed = e.code === "Space";
    const waveActive = e.code === "KeyW";
    const machine = createStandardLocomotionMachine(0.1);
    const frames = evaluateCharacterStateMachineTape(machine, [
      { dtSec: 0.12, speed, jumpPressed, waveActive },
    ]);
    const snap = frames[0]!;
    setLocoState(snap.activeState);
    setWaveLayerWeight(snap.waveLayerWeight);
    setLocoPose(snap.pose);
  };

  const handleRecipeSelect = (recipeId: string) => {
    setActiveRecipeId(recipeId);
    instantiateLibraryRigWithCursorFollow(recipeId, pointerPos);
  };

  const panelStyle: React.CSSProperties = {
    border: "1px solid var(--ll-border, #2a3344)",
    background: "var(--ll-surface, #151a24)",
    padding: "12px",
    borderRadius: "6px",
  };

  return (
    <div
      data-testid="s5-lab-root"
      style={{
        height: "100vh",
        overflowY: "auto",
        padding: "16px",
        background: "var(--ll-bg-canvas, #0d1017)",
        color: "var(--ll-text, #f3f5f8)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "grid",
        gap: "14px",
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>
            Stage 5 Characters &amp; Rigging E2E Lab (Phases 203–217)
          </h1>
          <p style={{ fontSize: "12px", color: "var(--ll-muted, #9aa4b2)", margin: "4px 0 0" }}>
            Live harness for auto-rig, weights, 2-bone IK, jiggle, cursor follow, 1D walk/run blend trees,
            lip-sync visemes, webcam cursor fallback &amp; puppet pins.
          </p>
        </div>
        <button
          data-testid="s5-autorig-btn"
          type="button"
          onClick={() => setAutoRigged((v) => !v)}
          style={{
            padding: "8px 14px",
            background: autoRigged ? "#16a34a" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {autoRigged ? `Auto-Rigged (${rig.bones.length} Bones)` : "Rig This Character"}
        </button>
      </header>

      {/* Row 1: Interactive Character Stage + IK / Pose Sliders / Recipe Picker */}
      <section style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: "14px" }}>
        <div
          data-testid="s5-rig-stage"
          onPointerMove={handleStagePointerMove}
          style={{
            position: "relative",
            width: "400px",
            height: "280px",
            border: "1px solid #334155",
            background: "#0f172a",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <svg width={400} height={280} viewBox="0 0 400 280">
            {/* Skinned mesh overlay dots */}
            {deformedVertices.map((pt, idx) => (
              <circle key={idx} cx={pt.x} cy={pt.y} r={2} fill="#38bdf8" opacity={0.45} />
            ))}
            {/* Bones */}
            {Object.values(worldTransforms).map((wt) => (
              <g key={wt.boneId}>
                <line
                  x1={wt.head.x}
                  y1={wt.head.y}
                  x2={wt.tail.x}
                  y2={wt.tail.y}
                  stroke="#f59e0b"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                <circle cx={wt.head.x} cy={wt.head.y} r={4} fill="#fef08a" />
              </g>
            ))}
            {/* IK target reticle */}
            <circle cx={ikTarget.x} cy={ikTarget.y} r={6} fill="none" stroke="#22c55e" strokeWidth={2} />
            {/* Stylized reactive mouth + eyes */}
            <ellipse
              cx={202}
              cy={74}
              rx={10 * (0.6 + faceState.mouthWidth * 0.5)}
              ry={2 + faceState.jawOpen * 8}
              fill="#fb7185"
            />
            <ellipse cx={194} cy={62} rx={3} ry={Math.max(0.5, 3 * (1 - faceState.blinkLeft))} fill="#f8fafc" />
            <ellipse cx={210} cy={62} rx={3} ry={Math.max(0.5, 3 * (1 - faceState.blinkRight))} fill="#f8fafc" />
          </svg>
          <div
            data-testid="s5-head-angle-readout"
            style={{ position: "absolute", left: "8px", bottom: "8px", fontSize: "11px", color: "#cbd5e1" }}
          >
            head={headAngleDeg.toFixed(1)}deg | jiggle={jiggleAngle.toFixed(2)}deg | verts={deformedVertices.length}
          </div>
        </div>

        <div style={{ ...panelStyle, display: "grid", gap: "10px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", fontWeight: 600 }}>Follow Cursor:</span>
            {(["eyes", "head", "whole-body"] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                data-testid={`s5-scope-${scope}`}
                onClick={() => setFollowScope(scope)}
                style={{
                  padding: "4px 10px",
                  background: followScope === scope ? "#2563eb" : "#1e293b",
                  color: "#fff",
                  border: "1px solid #475569",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {scope}
              </button>
            ))}
            <span data-testid="s5-mesh-readout" style={{ fontSize: "11px", color: "#86efac", marginLeft: "auto" }}>
              weightsSumValid={String(weightsSumValid)}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label style={{ fontSize: "12px" }}>
              Pose Slider Happy ({Math.round(happySlider * 100)}%)
              <input
                data-testid="s5-slider-happy"
                type="range"
                min={0}
                max={100}
                value={Math.round(happySlider * 100)}
                onChange={(e) => setHappySlider(Number(e.target.value) / 100)}
                style={{ width: "100%" }}
              />
            </label>
            <label style={{ fontSize: "12px" }}>
              Pose Slider Wave ({Math.round(waveSlider * 100)}%)
              <input
                data-testid="s5-slider-wave"
                type="range"
                min={0}
                max={100}
                value={Math.round(waveSlider * 100)}
                onChange={(e) => setWaveSlider(Number(e.target.value) / 100)}
                style={{ width: "100%" }}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "10px", alignItems: "center" }}>
            <label style={{ fontSize: "12px" }}>
              IK Target X ({ikTarget.x})
              <input
                data-testid="s5-ik-target-x"
                type="range"
                min={140}
                max={340}
                value={ikTarget.x}
                onChange={(e) => setIkTarget((p) => ({ ...p, x: Number(e.target.value) }))}
                style={{ width: "100%" }}
              />
            </label>
            <label style={{ fontSize: "12px" }}>
              IK Target Y ({ikTarget.y})
              <input
                data-testid="s5-ik-target-y"
                type="range"
                min={40}
                max={240}
                value={ikTarget.y}
                onChange={(e) => setIkTarget((p) => ({ ...p, y: Number(e.target.value) }))}
                style={{ width: "100%" }}
              />
            </label>
            <button
              type="button"
              data-testid="s5-ik-toggle"
              onClick={() => setUseIk((v) => !v)}
              style={{
                padding: "6px 10px",
                background: useIk ? "#2563eb" : "#334155",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              IK: {useIk ? "ON" : "OFF"}
            </button>
          </div>
          <div data-testid="s5-ik-readout" style={{ fontSize: "11px", color: "#cbd5e1" }}>
            ikTarget=({ikTarget.x},{ikTarget.y}) | ikErr={ikErrorPx.toFixed(2)}px
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", fontWeight: 600 }}>Library Recipe:</span>
            <select
              data-testid="s5-recipe-select"
              value={activeRecipeId}
              onChange={(e) => handleRecipeSelect(e.target.value)}
              style={{ background: "#0b1120", color: "#f8fafc", border: "1px solid #475569", padding: "4px 8px", borderRadius: "4px", fontSize: "12px" }}
            >
              {RIG_LIBRARY_RECIPES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.category})
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Row 2: Locomotion Blend Tree + Lip-Sync & Blink + Webcam Fallback + Puppet Pins */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
        <div
          data-testid="s5-locomotion-pad"
          tabIndex={0}
          role="application"
          aria-label="Character Locomotion Blend Pad"
          onKeyDown={handleLocomotionKeyDown}
          style={{ ...panelStyle, outlineOffset: "2px" }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
            5-State Locomotion (ArrowRight, Shift+ArrowRight, KeyW, Space)
          </div>
          <div data-testid="s5-state-readout" style={{ fontSize: "12px", color: "#93c5fd" }}>
            state={locoState} | waveMask={waveLayerWeight.toFixed(2)}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Voice Lip-Sync &amp; Auto-Blink</span>
            <button
              type="button"
              data-testid="s5-blink-btn"
              onClick={() => setForceBlink((b) => !b)}
              style={{ padding: "3px 8px", background: "#334155", color: "#fff", border: "none", borderRadius: "4px", fontSize: "11px" }}
            >
              Blink: {forceBlink ? "CLOSED" : "AUTO"}
            </button>
          </div>
          <input
            data-testid="s5-voice-scrub"
            type="range"
            min={0}
            max={120}
            value={Math.round(voiceTime * 100)}
            onChange={(e) => setVoiceTime(Number(e.target.value) / 100)}
            style={{ width: "100%" }}
          />
          <div data-testid="s5-viseme-readout" style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "4px" }}>
            t={voiceTime.toFixed(2)}s viseme={faceState.viseme} jaw={faceState.jawOpen.toFixed(2)} blink={faceState.blinkLeft.toFixed(2)}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Webcam / Cursor Fallback &amp; Puppet Flag</span>
            <button
              type="button"
              data-testid="s5-camera-toggle"
              onClick={() => setCameraPermission((p) => (p === "denied" ? "granted" : "denied"))}
              style={{ padding: "3px 8px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", fontSize: "11px" }}
            >
              Cam: {cameraPermission}
            </button>
          </div>
          <div data-testid="s5-tracking-readout" style={{ fontSize: "11px", color: "#86efac" }}>
            source={trackingSignals.source} yaw={trackingSignals.headYawDeg.toFixed(1)} videoLeavesDevice={String(trackingSignals.videoLeavesDevice)}
          </div>
          <input
            data-testid="s5-puppet-slider"
            type="range"
            min={-40}
            max={40}
            value={puppetLift}
            onChange={(e) => setPuppetLift(Number(e.target.value))}
            style={{ width: "100%", marginTop: "8px" }}
          />
          <div data-testid="s5-puppet-readout" style={{ fontSize: "11px", color: "#cbd5e1" }}>
            puppetLift={puppetLift} | tipY={puppetTipVertex.toFixed(1)}
          </div>
        </div>
      </section>
    </div>
  );
}
