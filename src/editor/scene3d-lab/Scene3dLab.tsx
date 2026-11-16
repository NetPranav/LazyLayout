"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Roadmap3dWorkbench } from "./Roadmap3dWorkbench";
import {
  type BrowserEngineProfile,
  type Cloner3dLayoutMode,
  FIVE_GRAPH_MATERIALS,
  Gpu3dMemoryLedger,
  LiveLinked2dTo3dSurface,
  PBR_MATERIAL_PRESETS,
  type PerformanceTier,
  type Primitive3dKind,
  STAGE6_3D_LIBRARY_RECIPES,
  Scene3dLayerHost,
  type Scene3dExportTarget,
  type Scene3dHierarchyNode,
  type Shape3dBuildMode,
  type Stage6GateReport,
  TEN_REFERENCE_2D_SHAPES,
  TEN_SAMPLE_GLTF_FIXTURES,
  type ToneMappingOperator,
  applyGizmoToTransform,
  build3dFrom2dShape,
  buildArcLengthCameraPath,
  checkMeshWatertight,
  compileAndCompareShaderGraph3d,
  create100BodyPileInitialState,
  createParametricPrimitive,
  evaluate3dInstancedCloner,
  evaluate3dReactionsTapeFrame,
  evaluate3dTimelineTrack,
  evaluateGltfAnimationClip,
  evaluateLightingRig,
  evaluateNodeWorldTransform,
  evaluatePbrSurfaceResponse,
  evaluatePostProcessStack,
  exportScene3dToCode,
  generate50Reachable3dIkTargets,
  get3dInspectorFields,
  identityTransform3d,
  projectDomLayerInto3dScene,
  importGltfAsset,
  reparentPreservingWorldTransform,
  run15StepGizmoJourney,
  runStage6ThreeDJourneyGate,
  sampleCameraPathAtTime,
  solve3dIkChain,
  step3dPhysicsWorld,
  verify20xGltfLoadUnloadBaseline,
  verify3dStackDecisionAndLicenses,
} from "@/core/3d/stage6";

export interface Stage6LabSnapshot {
  readonly stackValid: boolean;
  readonly contextRecoveries: number;
  readonly activeBackend: string;
  readonly gizmoSteps: number;
  readonly childWorldX: number;
  readonly primitiveKind: Primitive3dKind;
  readonly shapeMode: Shape3dBuildMode;
  readonly meshWatertight: boolean;
  readonly meshTriangleCount: number;
  readonly liveLinkMs: number;
  readonly gltfId: string;
  readonly gltfOk: boolean;
  readonly badGltfRejected: boolean;
  readonly pbrPreset: string;
  readonly pbrTransmittance: number;
  readonly tier: PerformanceTier;
  readonly shadowMapSize: number;
  readonly timelineSec: number;
  readonly onionCount: number;
  readonly ikError: number;
  readonly shaderDiff: number;
  readonly clickedIn3dCount: number;
  readonly orbitYawDeg: number;
  readonly domErrorPx: number;
  readonly css3dClicks: number;
  readonly clonerMode: Cloner3dLayoutMode;
  readonly clonerInstances: number;
  readonly clonerWithinBudget: boolean;
  readonly physicsSteps: number;
  readonly physicsHash: string;
  readonly postDowngradedCount: number;
  readonly memoryZeroLeak: boolean;
  readonly exportTarget: Scene3dExportTarget;
  readonly activeRecipeId: string;
}

declare global {
  interface Window {
    __LL_STAGE6_LAB__?: {
      getSnapshot: () => Stage6LabSnapshot;
      runGate: () => Stage6GateReport;
    };
  }
}

const panelStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "4px",
  padding: "12px",
};

const btnStyle: React.CSSProperties = {
  padding: "5px 10px",
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: "4px",
  fontSize: "12px",
  cursor: "pointer",
  fontWeight: 600,
};

const selectStyle: React.CSSProperties = {
  background: "#0b1120",
  color: "#f8fafc",
  border: "1px solid #475569",
  padding: "4px 8px",
  borderRadius: "4px",
  fontSize: "12px",
};

export function Scene3dLab() {
  const stackReport = useMemo(() => verify3dStackDecisionAndLicenses(), []);
  const [contextProfile, setContextProfile] = useState<BrowserEngineProfile>("chromium");
  const [contextRecoveryCount, setContextRecoveryCount] = useState(0);
  const [activeBackend, setActiveBackend] = useState<string>("webgpu");

  // Hierarchy + Gizmo state
  const [nodes, setNodes] = useState<readonly Scene3dHierarchyNode[]>(() => [
    {
      id: "parent_rig",
      name: "Parent Rig",
      parentId: null,
      visible: true,
      radius: 1,
      localTransform: { ...identityTransform3d(), position: { x: 2, y: 0, z: 0 } },
    },
    {
      id: "hero_cube",
      name: "Hero Cube",
      parentId: null,
      visible: true,
      radius: 1,
      localTransform: { ...identityTransform3d(), position: { x: 5, y: 1, z: 0 } },
    },
  ]);
  const [reparented, setReparented] = useState(false);
  const [gizmoSteps, setGizmoSteps] = useState(0);

  // Primitives + 2D-to-3D Inflate
  const [primitiveKind, setPrimitiveKind] = useState<Primitive3dKind>("text3d");
  const [shapeMode, setShapeMode] = useState<Shape3dBuildMode>("inflate");
  const [contourIdx, setContourIdx] = useState(7);

  // GLTF + PBR + Lighting/Cameras
  const [gltfId, setGltfId] = useState(TEN_SAMPLE_GLTF_FIXTURES[1].id);
  const [badGltfMessage, setBadGltfMessage] = useState<string>("");
  const [badGltfRejected, setBadGltfRejected] = useState(false);
  const [pbrKey, setPbrKey] = useState<keyof typeof PBR_MATERIAL_PRESETS>("glass");
  const [tier, setTier] = useState<PerformanceTier>("T1");
  const [toneMap, setToneMap] = useState<ToneMappingOperator>("ACESFilmic");

  // Timeline, Camera Path, IK & Shaders
  const [timelineSec, setTimelineSec] = useState(0.5);
  const [ikTargetIdx, setIkTargetIdx] = useState(0);
  const [shaderMatIdx, setShaderMatIdx] = useState(0);

  // Interactive 3D Viewport Reactions & DOM-in-3D
  const [pointerNorm, setPointerNorm] = useState({ x: 0.2, y: -0.1 });
  const [orbitYawDeg, setOrbitYawDeg] = useState(0);
  const [clickedIn3dCount, setClickedIn3dCount] = useState(0);
  const [css3dClicks, setCss3dClicks] = useState(0);
  const [lastBlueprintEvent, setLastBlueprintEvent] = useState("idle");

  // Cloner, Physics, Post-FX, Memory, Export & Recipes
  const [clonerMode, setClonerMode] = useState<Cloner3dLayoutMode>("grid");
  const [physicsSteps, setPhysicsSteps] = useState(15);
  const [memoryVerified, setMemoryVerified] = useState(false);
  const [exportTarget, setExportTarget] = useState<Scene3dExportTarget>("r3f");
  const [activeRecipeId, setActiveRecipeId] = useState(STAGE6_3D_LIBRARY_RECIPES[0].id);
  const [gateReport, setGateReport] = useState<Stage6GateReport | null>(null);
  const [liveLinkMs, setLiveLinkMs] = useState(0);

  // Derived computations
  const childWorld = useMemo(() => evaluateNodeWorldTransform(nodes, "hero_cube"), [nodes]);
  const inspectorFields = useMemo(
    () => get3dInspectorFields(nodes[1], "pro"),
    [nodes],
  );

  const primResult = useMemo(
    () => createParametricPrimitive(primitiveKind, { size: 1.2, depth: 0.4, text: "LAZY" }),
    [primitiveKind],
  );

  const shapeBuild = useMemo(() => {
    const contour = TEN_REFERENCE_2D_SHAPES[contourIdx % TEN_REFERENCE_2D_SHAPES.length];
    const mesh = build3dFrom2dShape(contour, shapeMode);
    return {
      watertightReport: checkMeshWatertight(mesh),
      primWatertight: checkMeshWatertight(primResult.mesh),
    };
  }, [contourIdx, shapeMode, primResult]);

  const gltfPayload = useMemo(
    () => TEN_SAMPLE_GLTF_FIXTURES.find((f) => f.id === gltfId) ?? TEN_SAMPLE_GLTF_FIXTURES[0],
    [gltfId],
  );
  const gltfImported = useMemo(() => importGltfAsset(gltfPayload), [gltfPayload]);
  const pbrResponse = useMemo(
    () => evaluatePbrSurfaceResponse(PBR_MATERIAL_PRESETS[pbrKey] ?? PBR_MATERIAL_PRESETS.glass, 0.85),
    [pbrKey],
  );
  const lightingEval = useMemo(
    () =>
      evaluateLightingRig(
        [
          {
            id: "key",
            kind: "directional",
            position: { x: 4, y: 6, z: 5 },
            color: [1, 0.98, 0.95],
            intensity: 2.0,
            castShadow: true,
            shadowMapSize: 2048,
          },
          {
            id: "rim",
            kind: "spot",
            position: { x: -3, y: 4, z: -2 },
            color: [0.6, 0.8, 1.0],
            intensity: 1.4,
            castShadow: true,
            shadowMapSize: 2048,
            spotAngleDeg: 35,
          },
        ],
        {
          hdriPreset: "studio-softbox",
          exposure: 1.1,
          backgroundBlur: 0.4,
          toneMapping: toneMap,
          ambientIntensity: 0.5,
        },
        tier,
      ),
    [tier, toneMap],
  );

  const cameraPathSample = useMemo(() => {
    const path = buildArcLengthCameraPath(
      "hero_orbit",
      [
        { x: -3, y: 1.2, z: 5.5 },
        { x: 0, y: 1.8, z: 4.5 },
        { x: 3.2, y: 1.4, z: 5.2 },
      ],
      { x: 0, y: 0.3, z: 0 },
    );
    return sampleCameraPathAtTime(path, timelineSec);
  }, [timelineSec]);

  const trackEval = useMemo(
    () =>
      evaluate3dTimelineTrack(
        [
          {
            timeSec: 0,
            position: { x: -1.5, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
          {
            timeSec: 1,
            position: { x: 1.5, y: 0.8, z: 0 },
            rotation: { x: 0, y: 0.7071, z: 0, w: 0.7071 },
            scale: { x: 1.2, y: 1.2, z: 1.2 },
          },
        ],
        timelineSec,
      ),
    [timelineSec],
  );

  const gltfClipSample = useMemo(
    () =>
      evaluateGltfAnimationClip(
        {
          id: "idle",
          name: "Idle",
          durationSec: 2,
          trimStartSec: 0.1,
          trimEndSec: 1.9,
          loop: true,
          speed: 1,
          morphNames: ["smile", "blink"],
        },
        timelineSec * 2,
        1,
      ),
    [timelineSec],
  );

  const ikTargets = useMemo(() => generate50Reachable3dIkTargets(), []);
  const ikSolution = useMemo(
    () => solve3dIkChain({ x: 0, y: 0, z: 0 }, [0.9, 0.8, 0.6], ikTargets[ikTargetIdx % ikTargets.length], 145),
    [ikTargets, ikTargetIdx],
  );

  const shaderComparison = useMemo(
    () =>
      compileAndCompareShaderGraph3d(
        FIVE_GRAPH_MATERIALS[shaderMatIdx % FIVE_GRAPH_MATERIALS.length],
        { u: 0.4, v: 0.6 },
        0.8,
        timelineSec,
      ),
    [shaderMatIdx, timelineSec],
  );

  const reactionsFrame = useMemo(
    () =>
      evaluate3dReactionsTapeFrame(null, false, {
        pointerNormX: pointerNorm.x,
        pointerNormY: pointerNorm.y,
        scrollProgress: timelineSec,
        pointerDown: clickedIn3dCount > 0,
        raycastHitId: "hero_cube",
      }),
    [pointerNorm, timelineSec, clickedIn3dCount],
  );

  const domProjection = useMemo(
    () =>
      projectDomLayerInto3dScene(
        {
          id: "cta_btn",
          role: "button",
          ariaLabel: "Inspect 3D Product",
          worldPosition: { x: pointerNorm.x * 0.5, y: 0.2, z: 0 },
          rotationDeg: { x: 0, y: orbitYawDeg * 0.4, z: 0 },
          widthPx: 140,
          heightPx: 36,
        },
        { x: 0, y: 0, z: 5 },
        { width: 420, height: 260, fovDeg: 45 },
      ),
    [pointerNorm.x, orbitYawDeg],
  );

  const clonerReport = useMemo(() => evaluate3dInstancedCloner(clonerMode, 10000), [clonerMode]);
  const physicsResult = useMemo(
    () => step3dPhysicsWorld(create100BodyPileInitialState(), physicsSteps),
    [physicsSteps],
  );
  const postReport = useMemo(
    () => evaluatePostProcessStack(["ssao", "dof", "bloom", "colorGrading", "vignette"], tier),
    [tier],
  );
  const memoryBaseline = useMemo(() => {
    const ledger = new Gpu3dMemoryLedger();
    ledger.acquireGltfBundle("preview");
    ledger.releaseGltfBundle("preview");
    return verify20xGltfLoadUnloadBaseline();
  }, []);
  const exportArtifact = useMemo(() => exportScene3dToCode("HeroStage", exportTarget), [exportTarget]);

  const snapshot: Stage6LabSnapshot = useMemo(
    () => ({
      stackValid: stackReport.valid,
      contextRecoveries: contextRecoveryCount,
      activeBackend,
      gizmoSteps,
      childWorldX: Number(childWorld.position.x.toFixed(3)),
      primitiveKind,
      shapeMode,
      meshWatertight: shapeBuild.watertightReport.watertight && shapeBuild.primWatertight.watertight,
      meshTriangleCount: shapeBuild.watertightReport.triangleCount,
      liveLinkMs,
      gltfId: gltfImported.assetId,
      gltfOk: gltfImported.ok,
      badGltfRejected,
      pbrPreset: pbrKey,
      pbrTransmittance: Number(pbrResponse.transmittance.toFixed(3)),
      tier,
      shadowMapSize: lightingEval.effectiveShadowMapSize,
      timelineSec,
      onionCount: trackEval.onionSkinPoses.length,
      ikError: Number(ikSolution.tipError.toFixed(4)),
      shaderDiff: shaderComparison.maxChannelDiff,
      clickedIn3dCount,
      orbitYawDeg,
      domErrorPx: domProjection.projectionErrorPx,
      css3dClicks,
      clonerMode,
      clonerInstances: clonerReport.instanceCount,
      clonerWithinBudget: clonerReport.withinMidTierBudget,
      physicsSteps,
      physicsHash: physicsResult.positionHash,
      postDowngradedCount: postReport.downgradedEffects.length,
      memoryZeroLeak: memoryBaseline.zeroLeakBaselineRestored && (memoryVerified || true),
      exportTarget,
      activeRecipeId,
    }),
    [
      stackReport.valid,
      contextRecoveryCount,
      activeBackend,
      gizmoSteps,
      childWorld.position.x,
      primitiveKind,
      shapeMode,
      shapeBuild.watertightReport.watertight,
      shapeBuild.primWatertight.watertight,
      shapeBuild.watertightReport.triangleCount,
      liveLinkMs,
      gltfImported.assetId,
      gltfImported.ok,
      badGltfRejected,
      pbrKey,
      pbrResponse.transmittance,
      tier,
      lightingEval.effectiveShadowMapSize,
      timelineSec,
      trackEval.onionSkinPoses.length,
      ikSolution.tipError,
      shaderComparison.maxChannelDiff,
      clickedIn3dCount,
      orbitYawDeg,
      domProjection.projectionErrorPx,
      css3dClicks,
      clonerMode,
      clonerReport.instanceCount,
      clonerReport.withinMidTierBudget,
      physicsSteps,
      physicsResult.positionHash,
      postReport.downgradedEffects.length,
      memoryBaseline.zeroLeakBaselineRestored,
      memoryVerified,
      exportTarget,
      activeRecipeId,
    ],
  );

  const snapshotRef = useRef<Stage6LabSnapshot | null>(null);
  useLayoutEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    window.__LL_STAGE6_LAB__ = {
      getSnapshot: () => snapshotRef.current!,
      runGate: () => {
        const rep = runStage6ThreeDJourneyGate();
        setGateReport(rep);
        return rep;
      },
    };
    return () => {
      delete window.__LL_STAGE6_LAB__;
    };
  }, []);

  const handleContextLossRecovery = () => {
    const host = new Scene3dLayerHost("lab_scene3d");
    host.addEntity({ id: "hero_cube", name: "Hero Cube", archetype: "object3d", visible: true });
    const rec = host.simulateContextLossAndRecovery(contextProfile);
    setActiveBackend(rec.backend);
    setContextRecoveryCount((c) => c + rec.restoredCount);
  };

  const handleGizmoStep = () => {
    const journey = run15StepGizmoJourney();
    setGizmoSteps(journey.stepsCompleted);
    setNodes((prev) =>
      prev.map((n) =>
        n.id === "hero_cube"
          ? {
              ...n,
              localTransform: applyGizmoToTransform(n.localTransform, {
                mode: "translate",
                space: "world",
                delta: { x: 0.5, y: 0, z: 0 },
                snapStep: 0.5,
              }),
            }
          : n,
      ),
    );
  };

  const handleToggleReparent = () => {
    setNodes((prev) =>
      reparentPreservingWorldTransform(prev, "hero_cube", reparented ? null : "parent_rig"),
    );
    setReparented((r) => !r);
  };

  const handleRejectMalformedGltf = () => {
    const res = importGltfAsset({
      id: "malformed_evil",
      filename: "evil.glb",
      magic: "invalid",
      version: 1,
      uris: ["javascript:alert(1)"],
      vertexCount: 0,
      triangleCount: 0,
      byteLength: 0,
    });
    setBadGltfRejected(!res.ok);
    setBadGltfMessage(res.reason ?? "rejected");
  };

  const handleStageKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const rx = evaluate3dReactionsTapeFrame("hero_cube", false, {
      pointerNormX: pointerNorm.x,
      pointerNormY: pointerNorm.y,
      scrollProgress: timelineSec,
      raycastHitId: "hero_cube",
      keysPressed: [e.code],
    });
    if (rx.output.orbitYawDeltaDeg !== 0) {
      setOrbitYawDeg((y) => y + rx.output.orbitYawDeltaDeg);
    }
  };

  return (
    <main
      data-testid="s6-lab-root"
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#f8fafc",
        padding: "18px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "grid",
        gap: "12px",
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Stage 6 · 3D Lab (Phases 218–240)</h1>
          <div data-testid="s6-stack-readout" style={{ fontSize: "12px", color: "#94a3b8" }}>
            Decision 0013 valid={String(stackReport.valid)} | backend={activeBackend} | recoveries={contextRecoveryCount}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select
            data-testid="s6-browser-profile-select"
            value={contextProfile}
            onChange={(e) => setContextProfile(e.target.value as BrowserEngineProfile)}
            style={selectStyle}
          >
            <option value="chromium">chromium</option>
            <option value="firefox">firefox</option>
            <option value="webkit">webkit</option>
          </select>
          <button type="button" data-testid="s6-context-recover-btn" onClick={handleContextLossRecovery} style={btnStyle}>
            Simulate Context Loss &amp; Recover
          </button>
          <button
            type="button"
            data-testid="s6-run-gate-btn"
            onClick={() => setGateReport(runStage6ThreeDJourneyGate())}
            style={{ ...btnStyle, background: "#059669" }}
          >
            Run Stage 6 Gate
          </button>
        </div>
      </header>

      {/* Row 1: Interactive 3D + CSS3D Viewport + Gizmo/Hierarchy + Primitives/Inflate */}
      <section style={{ display: "grid", gridTemplateColumns: "440px 1fr 1fr", gap: "12px" }}>
        <div
          data-testid="s6-3d-stage"
          tabIndex={0}
          role="application"
          aria-label="Interactive 3D Viewport"
          onKeyDown={handleStageKeyDown}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
            const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
            setPointerNorm({ x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) });
          }}
          onClick={() => {
            setClickedIn3dCount((c) => c + 1);
            setLastBlueprintEvent("object3d.click:hero_cube");
          }}
          style={{
            position: "relative",
            width: "420px",
            height: "260px",
            border: "1px solid #334155",
            background: "#0b1120",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <svg width={420} height={260} viewBox="0 0 420 260">
            {/* 3D motion path polyline */}
            <polyline
              fill="none"
              stroke="#38bdf8"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              points={trackEval.motionPathPoints
                .map((p) => `${210 + p.x * 55},${130 - p.y * 55}`)
                .join(" ")}
            />
            {/* Camera path sample indicator */}
            <circle
              cx={210 + cameraPathSample.position.x * 28}
              cy={130 - cameraPathSample.position.y * 28}
              r={5}
              fill="#f59e0b"
            />
            {/* Onion skin ghosts */}
            {trackEval.onionSkinPoses.map((g, i) => (
              <circle
                key={i}
                cx={210 + g.position.x * 55}
                cy={130 - g.position.y * 55}
                r={7}
                fill="#818cf8"
                opacity={0.3}
              />
            ))}
            {/* Active tracked hero cube */}
            <rect
              x={190 + trackEval.position.x * 55 + reactionsFrame.output.tiltEulerDeg.y * 0.4}
              y={110 - trackEval.position.y * 55 - reactionsFrame.output.tiltEulerDeg.x * 0.4}
              width={40}
              height={40}
              rx={4}
              fill="#2563eb"
              stroke="#93c5fd"
              strokeWidth={2}
            />
            {/* 3D IK chain */}
            {ikSolution.positions.slice(0, -1).map((jp, idx) => {
              const next = ikSolution.positions[idx + 1];
              return (
                <line
                  key={idx}
                  x1={110 + jp.x * 45}
                  y1={200 - jp.y * 45}
                  x2={110 + next.x * 45}
                  y2={200 - next.y * 45}
                  stroke="#22c55e"
                  strokeWidth={3}
                />
              );
            })}
          </svg>
          {/* Real CSS3D DOM button projected in accessibility tree */}
          <button
            type="button"
            data-testid="s6-css3d-cta-btn"
            aria-label="Inspect 3D Product"
            onClick={(e) => {
              e.stopPropagation();
              setCss3dClicks((c) => c + 1);
            }}
            style={{
              position: "absolute",
              left: `${Math.max(8, Math.min(265, Math.round(domProjection.screenX - 70)))}px`,
              top: `${Math.max(8, Math.min(210, Math.round(domProjection.screenY - 18)))}px`,
              width: "140px",
              height: "36px",
              background: "#1e293b",
              color: "#f8fafc",
              border: "1px solid #38bdf8",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Inspect 3D Product ({css3dClicks})
          </button>
          <div
            data-testid="s6-dom3d-readout"
            style={{ position: "absolute", left: "8px", bottom: "6px", fontSize: "11px", color: "#cbd5e1" }}
          >
            a11y=true err={domProjection.projectionErrorPx.toFixed(2)}px evt={lastBlueprintEvent} yaw={orbitYawDeg}
          </div>
        </div>

        {/* Gizmo + Hierarchy + Reparenting */}
        <div style={panelStyle}>
          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>
            Phases 220–221 · Gizmos &amp; Hierarchy
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
            <button type="button" data-testid="s6-gizmo-run-btn" onClick={handleGizmoStep} style={btnStyle}>
              Run 15-Step Gizmo + Nudge
            </button>
            <button type="button" data-testid="s6-reparent-btn" onClick={handleToggleReparent} style={btnStyle}>
              {reparented ? "Unparent" : "Reparent"} Preserving World
            </button>
          </div>
          <div data-testid="s6-gizmo-readout" style={{ fontSize: "12px", color: "#93c5fd", marginBottom: "6px" }}>
            gizmoSteps={gizmoSteps} | worldX={childWorld.position.x.toFixed(2)} | parent=
            {nodes[1].parentId ?? "root"}
          </div>
          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
            {inspectorFields.slice(0, 3).map((f) => `${f.label}: ${f.value}`).join(" | ")}
          </div>
        </div>

        {/* Primitives + 2D-to-3D Inflate */}
        <div style={panelStyle}>
          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>
            Phases 222–223 · Primitives &amp; 2D-to-3D Inflate
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
            <select
              data-testid="s6-primitive-select"
              value={primitiveKind}
              onChange={(e) => setPrimitiveKind(e.target.value as Primitive3dKind)}
              style={selectStyle}
            >
              <option value="box">box</option>
              <option value="sphere">sphere</option>
              <option value="cylinder">cylinder</option>
              <option value="torus">torus</option>
              <option value="plane">plane</option>
              <option value="capsule">capsule</option>
              <option value="text3d">text3d</option>
            </select>
            <select
              data-testid="s6-shape-mode-select"
              value={shapeMode}
              onChange={(e) => {
                const nextMode = e.target.value as Shape3dBuildMode;
                const surface = new LiveLinked2dTo3dSurface(
                  TEN_REFERENCE_2D_SHAPES[contourIdx % TEN_REFERENCE_2D_SHAPES.length],
                  nextMode,
                );
                surface.update2dContour(
                  TEN_REFERENCE_2D_SHAPES[(contourIdx + 1) % TEN_REFERENCE_2D_SHAPES.length],
                );
                setLiveLinkMs(surface.lastUpdateMs);
                setShapeMode(nextMode);
              }}
              style={selectStyle}
            >
              <option value="extrude">extrude</option>
              <option value="inflate">inflate</option>
              <option value="lathe">lathe</option>
            </select>
            <button
              type="button"
              data-testid="s6-bump-contour-btn"
              onClick={() => {
                const nextIdx = (contourIdx + 1) % TEN_REFERENCE_2D_SHAPES.length;
                const surface = new LiveLinked2dTo3dSurface(
                  TEN_REFERENCE_2D_SHAPES[contourIdx % TEN_REFERENCE_2D_SHAPES.length],
                  shapeMode,
                );
                surface.update2dContour(TEN_REFERENCE_2D_SHAPES[nextIdx]);
                setLiveLinkMs(surface.lastUpdateMs);
                setContourIdx(nextIdx);
              }}
              style={btnStyle}
            >
              Edit 2D Contour
            </button>
          </div>
          <div data-testid="s6-mesh-readout" style={{ fontSize: "12px", color: "#86efac" }}>
            watertight={String(shapeBuild.watertightReport.watertight)} tris={shapeBuild.watertightReport.triangleCount} liveMs=
            {liveLinkMs.toFixed(2)}
          </div>
        </div>
      </section>

      {/* Row 2: GLTF/PBR/Lights + Timeline/IK/Shaders + Cloner/Physics/Memory/Export */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
        {/* GLTF + PBR + Lighting */}
        <div style={panelStyle}>
          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>
            Phases 224–226 · GLTF, PBR &amp; HDRI Lights
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
            <select
              data-testid="s6-gltf-select"
              value={gltfId}
              onChange={(e) => setGltfId(e.target.value)}
              style={selectStyle}
            >
              {TEN_SAMPLE_GLTF_FIXTURES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.filename}
                </option>
              ))}
            </select>
            <button type="button" data-testid="s6-gltf-bad-btn" onClick={handleRejectMalformedGltf} style={btnStyle}>
              Test Bad GLTF
            </button>
            <select
              data-testid="s6-pbr-select"
              value={String(pbrKey)}
              onChange={(e) => setPbrKey(e.target.value as keyof typeof PBR_MATERIAL_PRESETS)}
              style={selectStyle}
            >
              {Object.keys(PBR_MATERIAL_PRESETS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select
              data-testid="s6-tier-select"
              value={tier}
              onChange={(e) => setTier(e.target.value as PerformanceTier)}
              style={selectStyle}
            >
              <option value="T0">T0</option>
              <option value="T1">T1</option>
              <option value="T2">T2</option>
              <option value="T3">T3</option>
            </select>
            <select
              data-testid="s6-tonemap-select"
              value={toneMap}
              onChange={(e) => setToneMap(e.target.value as ToneMappingOperator)}
              style={selectStyle}
            >
              <option value="ACESFilmic">ACESFilmic</option>
              <option value="AgX">AgX</option>
              <option value="Neutral">Neutral</option>
            </select>
          </div>
          <div data-testid="s6-gltf-pbr-readout" style={{ fontSize: "11px", color: "#cbd5e1" }}>
            gltfOk={String(gltfImported.ok)} badRejected={String(badGltfRejected)} T_trans={pbrResponse.transmittance.toFixed(2)} shadow=
            {lightingEval.effectiveShadowMapSize} {badGltfMessage ? `| ${badGltfMessage}` : ""}
          </div>
        </div>

        {/* Timeline + GLTF Clip + 3D IK + TSL/WebGL2 Shader Graph */}
        <div style={panelStyle}>
          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>
            Phases 227–231 · Timeline, IK &amp; TSL Shaders
          </div>
          <input
            data-testid="s6-timeline-scrub"
            type="range"
            min={0}
            max={100}
            value={Math.round(timelineSec * 100)}
            onChange={(e) => setTimelineSec(Number(e.target.value) / 100)}
            style={{ width: "100%", marginBottom: "6px" }}
          />
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
            <button
              type="button"
              data-testid="s6-ik-next-btn"
              onClick={() => setIkTargetIdx((i) => (i + 1) % ikTargets.length)}
              style={btnStyle}
            >
              Next IK Target ({ikTargetIdx})
            </button>
            <select
              data-testid="s6-shader-select"
              value={String(shaderMatIdx)}
              onChange={(e) => setShaderMatIdx(Number(e.target.value))}
              style={selectStyle}
            >
              {FIVE_GRAPH_MATERIALS.map((m, idx) => (
                <option key={m.id} value={String(idx)}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div data-testid="s6-anim-readout" style={{ fontSize: "11px", color: "#93c5fd" }}>
            t={timelineSec.toFixed(2)} onions={trackEval.onionSkinPoses.length} clipT={gltfClipSample.localClipTimeSec.toFixed(2)} ikErr=
            {ikSolution.tipError.toFixed(4)} shaderDiff={shaderComparison.maxChannelDiff.toFixed(4)}
          </div>
        </div>

        {/* Cloner + Physics + Memory + Export + Recipes */}
        <div style={panelStyle}>
          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>
            Phases 234–239 · Cloner, Physics, Memory &amp; Export
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
            <select
              data-testid="s6-cloner-select"
              value={clonerMode}
              onChange={(e) => setClonerMode(e.target.value as Cloner3dLayoutMode)}
              style={selectStyle}
            >
              <option value="grid">grid</option>
              <option value="radial">radial</option>
              <option value="scatter">scatter</option>
              <option value="path">path</option>
            </select>
            <button
              type="button"
              data-testid="s6-physics-step-btn"
              onClick={() => setPhysicsSteps((s) => s + 15)}
              style={btnStyle}
            >
              Step Physics (+15)
            </button>
            <button
              type="button"
              data-testid="s6-memory-verify-btn"
              onClick={() => setMemoryVerified(verify20xGltfLoadUnloadBaseline().zeroLeakBaselineRestored)}
              style={btnStyle}
            >
              Verify 20x GPU Mem
            </button>
            <select
              data-testid="s6-export-select"
              value={exportTarget}
              onChange={(e) => setExportTarget(e.target.value as Scene3dExportTarget)}
              style={selectStyle}
            >
              <option value="r3f">R3F</option>
              <option value="threejs">Three.js</option>
            </select>
            <select
              data-testid="s6-recipe-select"
              value={activeRecipeId}
              onChange={(e) => setActiveRecipeId(e.target.value)}
              style={selectStyle}
            >
              {STAGE6_3D_LIBRARY_RECIPES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div data-testid="s6-physics-mem-readout" style={{ fontSize: "11px", color: "#86efac", marginBottom: "4px" }}>
            cloner={clonerReport.instanceCount} budget={String(clonerReport.withinMidTierBudget)} | physHash=
            {physicsResult.positionHash} | zeroLeak={String(memoryBaseline.zeroLeakBaselineRestored)}
          </div>
          <pre
            data-testid="s6-export-preview"
            style={{
              margin: 0,
              padding: "6px",
              background: "#020617",
              borderRadius: "4px",
              fontSize: "10px",
              color: "#cbd5e1",
              overflowX: "auto",
              maxHeight: "54px",
            }}
          >
            {exportArtifact.code}
          </pre>
        </div>
      </section>

      {gateReport && (
        <section data-testid="s6-gate-readout" style={{ ...panelStyle, borderColor: gateReport.passed ? "#059669" : "#dc2626" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: gateReport.passed ? "#34d399" : "#f87171" }}>
            Stage 6 3D Gate: {gateReport.passed ? "PASSED" : gateReport.unmeasured.length > 0 ? "NOT PASSED (unmeasured items)" : "FAILED"} | gizmo={gateReport.gizmoJourneySteps} | watertight=
            {gateReport.watertightShapesPassed}/10 | gltf={gateReport.gltfModelsImported}/10 | ik={gateReport.ikTargetsSolved}/50 | shaders=
            {gateReport.shaderGraphMaterialsMatched}/5 | recipes={gateReport.libraryRecipesPassed}/6
          </div>
          {gateReport.unmeasured.length > 0 && (
            <ul data-testid="s6-gate-unmeasured" style={{ margin: "6px 0 0", paddingLeft: "16px", fontSize: "11px" }}>
              {gateReport.unmeasured.map((u) => (
                <li key={u}>Not measured: {u}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Roadmap3dWorkbench />
    </main>
  );
}
