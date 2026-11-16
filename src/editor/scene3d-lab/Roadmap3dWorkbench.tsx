"use client";

import React, { useMemo, useState } from "react";
import {
  ANIME_PROCEDURAL_VFX,
  AiServiceGateway3D,
  COMMON_3D_RECIPES_8STEP_AUDIT,
  type AnimeCameraPreset,
  type AnimeTimingMode,
  type AnimeVfxKind,
  type CameraRigKind,
  type ComponentUiState,
  type LightRigLookV1Id,
  LIGHT_RIG_LOOKS_V1,
  MAKE_3D_WIZARDS,
  MATERIAL_LOOKS_V1,
  type MaterialLookV1Id,
  type PointerLightMode,
  type Roadmap3dMasterGateReport,
  type WrapStyleId,
  applyMaterialLookV1,
  buildWebgl2MicroRenderer,
  computeHomographyCornerPin,
  computePointerLightState,
  evaluateAnimeCameraPreset,
  evaluateAnimeSteppedTime,
  evaluateCameraRig,
  evaluateFiveRecipeSizeGate,
  evaluatePrincipledPbr,
  exportZeroScriptCssReaction,
  mixMultipleAnimationsLive,
  projectTextOntoPhotoSurface,
  runAllRoadmap3dGates,
  scanBundleForEditorLeaks,
  stepXpbdCloth,
  subdivideCatmullClark,
  transitionComponentState3d,
} from "@/core/3d/roadmap3d";

type WorkbenchTab =
  | "m1-foil"
  | "m1plus-size"
  | "m2-studio"
  | "m3-m4-living"
  | "m5-photo"
  | "m6-anime";

const panelBox: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "4px",
  padding: "12px",
  marginTop: "12px",
};

const btnBase: React.CSSProperties = {
  padding: "5px 10px",
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: "4px",
  fontSize: "12px",
  cursor: "pointer",
  fontWeight: 600,
};

const selectBase: React.CSSProperties = {
  background: "#0b1120",
  color: "#f8fafc",
  border: "1px solid #475569",
  padding: "4px 8px",
  borderRadius: "4px",
  fontSize: "12px",
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 11px",
  background: active ? "#1d4ed8" : "#1e293b",
  color: active ? "#ffffff" : "#cbd5e1",
  border: active ? "1px solid #60a5fa" : "1px solid #334155",
  borderRadius: "4px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
});

export function Roadmap3dWorkbench() {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("m1-foil");
  const [gateReport, setGateReport] = useState<Roadmap3dMasterGateReport | null>(() =>
    runAllRoadmap3dGates(),
  );

  // M1 + M1+ Pointer Light & Foil Button state
  const [materialLook, setMaterialLook] = useState<MaterialLookV1Id>("black-foil-mylar");
  const [lightRig, setLightRig] = useState<LightRigLookV1Id>("studio-softbox");
  const [pointerMode, setPointerMode] = useState<PointerLightMode>("Opposite");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pointerNorm, setPointerNorm] = useState<readonly [number, number]>([-0.35, 0.45]);
  const [buttonPressed, setButtonPressed] = useState(false);
  const [decalText, setDecalText] = useState("PUSH");

  // M1+ Size Gate state
  const [includeToonShader, setIncludeToonShader] = useState(false);

  // M2 & 3D-227 Live Mixer state
  const [subdivLevel, setSubdivLevel] = useState(1);
  const [cameraRig, setCameraRig] = useState<CameraRigKind>("turntable");
  const [idleWeight, setIdleWeight] = useState(0.5);
  const [walkWeight, setWalkWeight] = useState(0.5);
  const [waveWeight, setWaveWeight] = useState(0.8);

  // M3 / M4 state
  const [uiState, setUiState] = useState<ComponentUiState>("idle");

  // M5 Photo Studio Car Wrap & Corner Pin state
  const [aiKeepOnDevice, setAiKeepOnDevice] = useState(true);
  const [wrapText, setWrapText] = useState("SPEED");
  const [wrapStyle, setWrapStyle] = useState<WrapStyleId>("chrome");
  const [wrapBlend, setWrapBlend] = useState(0.75);
  const [creaseSnap, setCreaseSnap] = useState(true);
  const [showCornerPin, setShowCornerPin] = useState(true);

  // M6 Anime Studio state
  const [animeTiming, setAnimeTiming] = useState<AnimeTimingMode>("twos");
  const [animeFrame60, setAnimeFrame60] = useState(0);
  const [animeVfx, setAnimeVfx] = useState<AnimeVfxKind>("shadow-flames");
  const [animeCam, setAnimeCam] = useState<AnimeCameraPreset>("crash-zoom");

  // Derived computations
  const pointerLight = useMemo(
    () => computePointerLightState(pointerNorm[0], pointerNorm[1], pointerMode, reducedMotion, 0),
    [pointerNorm, pointerMode, reducedMotion],
  );

  const foilClothResult = useMemo(() => {
    const baseVerts: readonly (readonly [number, number, number])[] = [
      [-1, -0.5, 0.25],
      [0, 0, 0.25],
      [1, -0.5, 0.25],
      [-1, 0.5, 0.25],
      [1, 0.5, 0.25],
    ];
    return stepXpbdCloth(
      {
        particles: baseVerts.map((pos) => ({ pos, vel: [0, 0, 0], pinned: false })),
        enclosedVolume: 1,
        targetVolume: 1,
        volumeDriftRatio: 0,
      },
      "foil",
      1 / 60,
      buttonPressed ? { center: [0, 0, 0.25], depth: 0.16, radius: 0.85 } : undefined,
    );
  }, [buttonPressed]);

  const pbrLookSample = useMemo(() => {
    const params = applyMaterialLookV1(materialLook);
    return evaluatePrincipledPbr(
      params,
      [0, 0, 1],
      [0, 0, 1],
      [pointerLight.lightX, pointerLight.lightY, pointerLight.lightZ],
    );
  }, [materialLook, pointerLight]);

  const zeroScriptCss = useMemo(() => exportZeroScriptCssReaction(".r3d-card", "tilt"), []);
  const microRenderer = useMemo(
    () =>
      buildWebgl2MicroRenderer(
        includeToonShader
          ? ["pbr", "toon", "outline", "pointer-light", "baked-anim", "poster"]
          : ["pbr", "pointer-light", "baked-anim", "poster"],
      ),
    [includeToonShader],
  );
  const fiveRecipeGate = useMemo(() => evaluateFiveRecipeSizeGate(), []);
  const leakCheck = useMemo(() => scanBundleForEditorLeaks("webgl2-micro-runtime-v1"), []);

  const m2Subdiv = useMemo(
    () =>
      subdivideCatmullClark(
        {
          vertices: [
            [-1, -1, 0],
            [1, -1, 0],
            [1, 1, 0],
            [-1, 1, 0],
          ],
          faces: [[0, 1, 2, 3]],
        },
        subdivLevel,
        [{ edge: [0, 1], weight: 0.5 }],
      ),
    [subdivLevel],
  );
  const m2CamPose = useMemo(() => evaluateCameraRig(cameraRig, 0.35), [cameraRig]);
  const liveMixed = useMemo(
    () =>
      mixMultipleAnimationsLive([
        {
          id: "idle",
          weight: idleWeight,
          additive: false,
          boneMask: "all",
          poseEulerDeg: { root: [0, 0, 0], spine: [2, 0, 0], rightArm: [0, 0, -10] },
        },
        {
          id: "walk",
          weight: walkWeight,
          additive: false,
          boneMask: "all",
          poseEulerDeg: { root: [0, 12, 0], spine: [8, 4, 0], rightArm: [24, 0, -4] },
        },
        {
          id: "wave",
          weight: waveWeight,
          additive: true,
          boneMask: "upper-body",
          poseEulerDeg: { rightArm: [0, 40, 80], root: [0, 0, 999] },
        },
      ]),
    [idleWeight, walkWeight, waveWeight],
  );

  const carAiStatus = useMemo(
    () => new AiServiceGateway3D(aiKeepOnDevice).invoke("depth-anything-v2-small", "car-wrap-v1", true),
    [aiKeepOnDevice],
  );
  const carWrap = useMemo(
    () =>
      projectTextOntoPhotoSurface({
        text: wrapText,
        style: wrapStyle,
        blendDistinctToIntegrated: wrapBlend,
        creaseSnap,
        pointerNorm,
      }),
    [wrapText, wrapStyle, wrapBlend, creaseSnap, pointerNorm],
  );
  const billboardHomography = useMemo(
    () =>
      computeHomographyCornerPin(
        [
          [0, 0],
          [160, 0],
          [160, 90],
          [0, 90],
        ],
        [
          [22, 18],
          [175, 28],
          [168, 108],
          [18, 102],
        ],
      ),
    [],
  );

  const animeStepped = useMemo(
    () => evaluateAnimeSteppedTime(animeFrame60, animeTiming),
    [animeFrame60, animeTiming],
  );
  const animeCamState = useMemo(
    () => evaluateAnimeCameraPreset(animeCam, (animeFrame60 % 120) / 120),
    [animeCam, animeFrame60],
  );

  return (
    <section
      data-testid="roadmap3d-studio-workbench"
      style={{
        ...panelBox,
        marginTop: "18px",
        borderColor: "#3b82f6",
        background: "#090f1e",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "10px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#93c5fd" }}>
            ROADMAP_3D Studio Workbench (3D-001 – 3D-227 · All 7 Milestones &amp; 4 Cases)
          </h2>
          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
            Interactive Foil Button + Opposite Pointer Light · Zero-Script Export · 3D-227 Live Mixer · Photo Car Wrap · Anime Studio
          </div>
        </div>
        <button
          type="button"
          data-testid="r3d-run-all-gates-btn"
          onClick={() => setGateReport(runAllRoadmap3dGates())}
          style={{ ...btnBase, background: "#059669" }}
        >
          Run All 227-Phase Gates
        </button>
      </div>

      {gateReport && (
        <div
          data-testid="r3d-gates-summary"
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "10px",
            padding: "8px",
            background: "#020617",
            borderRadius: "4px",
            border: `1px solid ${gateReport.allPassed ? "#059669" : "#dc2626"}`,
            fontSize: "11px",
          }}
        >
          <span style={{ color: "#34d399", fontWeight: 700 }}>
            ALL GATES ({gateReport.phasesCoveredCount}/227): {gateReport.allPassed ? "PASS" : "FAIL"}
          </span>
          <span style={{ color: "#cbd5e1" }}>Gate M1 Foil: {String(gateReport.gateM1.passed)}</span>
          <span style={{ color: "#cbd5e1" }}>Gate A (M1+): {String(gateReport.gateA.passed)}</span>
          <span style={{ color: "#cbd5e1" }}>Gate M2 + 3D-227: {String(gateReport.gateM2.passed)}</span>
          <span style={{ color: "#cbd5e1" }}>Gate M3 Living: {String(gateReport.gateM3.passed)}</span>
          <span style={{ color: "#cbd5e1" }}>Gate M4 Ship: {String(gateReport.gateM4.passed)}</span>
          <span style={{ color: "#cbd5e1" }}>Gate B Photo Car: {String(gateReport.gateB.passed)}</span>
          <span style={{ color: "#cbd5e1" }}>Gate C Anime: {String(gateReport.gateC.passed)}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
        <button
          type="button"
          data-testid="roadmap3d-tab-m1-foil"
          onClick={() => setActiveTab("m1-foil")}
          style={tabStyle(activeTab === "m1-foil")}
        >
          Case 2 · M1 Foil Button &amp; Pointer Light
        </button>
        <button
          type="button"
          data-testid="roadmap3d-tab-m1plus-size"
          onClick={() => setActiveTab("m1plus-size")}
          style={tabStyle(activeTab === "m1plus-size")}
        >
          Case 1 · M1+ Zero-Script &amp; Micro-Renderer
        </button>
        <button
          type="button"
          data-testid="roadmap3d-tab-m2-studio"
          onClick={() => setActiveTab("m2-studio")}
          style={tabStyle(activeTab === "m2-studio")}
        >
          M2 Studio &amp; 3D-227 Live Mixer
        </button>
        <button
          type="button"
          data-testid="roadmap3d-tab-m3-m4-living"
          onClick={() => setActiveTab("m3-m4-living")}
          style={tabStyle(activeTab === "m3-m4-living")}
        >
          M3/M4 Living States &amp; 8-Step Rules
        </button>
        <button
          type="button"
          data-testid="roadmap3d-tab-m5-photo"
          onClick={() => setActiveTab("m5-photo")}
          style={tabStyle(activeTab === "m5-photo")}
        >
          Case 3 · M5 Photo Car Wrap &amp; Tracker
        </button>
        <button
          type="button"
          data-testid="roadmap3d-tab-m6-anime"
          onClick={() => setActiveTab("m6-anime")}
          style={tabStyle(activeTab === "m6-anime")}
        >
          Case 4 · M6 Anime Fight Studio
        </button>
      </div>

      {/* TAB 1: M1 + Case 2 Foil Balloon Button & Opposite Pointer Light */}
      {activeTab === "m1-foil" && (
        <div
          data-testid="r3d-panel-m1-foil"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select
                data-testid="r3d-material-look-select"
                value={materialLook}
                onChange={(e) => setMaterialLook(e.target.value as MaterialLookV1Id)}
                style={selectBase}
              >
                {Object.keys(MATERIAL_LOOKS_V1).map((k) => (
                  <option key={k} value={k}>
                    Material Look: {k}
                  </option>
                ))}
              </select>
              <select
                data-testid="r3d-light-rig-select"
                value={lightRig}
                onChange={(e) => setLightRig(e.target.value as LightRigLookV1Id)}
                style={selectBase}
              >
                {Object.keys(LIGHT_RIG_LOOKS_V1).map((k) => (
                  <option key={k} value={k}>
                    Light Rig: {k}
                  </option>
                ))}
              </select>
              <select
                data-testid="r3d-pointer-mode-select"
                value={pointerMode}
                onChange={(e) => setPointerMode(e.target.value as PointerLightMode)}
                style={selectBase}
              >
                <option value="Opposite">Pointer Light: Opposite</option>
                <option value="Follow">Pointer Light: Follow</option>
                <option value="Orbit">Pointer Light: Orbit</option>
                <option value="Breathe">Pointer Light: Breathe</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="text"
                data-testid="r3d-decal-input"
                value={decalText}
                onChange={(e) => setDecalText(e.target.value)}
                style={{ ...selectBase, width: "120px" }}
                aria-label="Button decal text"
              />
              <label style={{ fontSize: "12px", color: "#cbd5e1", display: "flex", gap: "6px" }}>
                <input
                  type="checkbox"
                  data-testid="r3d-reduced-motion-toggle"
                  checked={reducedMotion}
                  onChange={(e) => setReducedMotion(e.target.checked)}
                />
                prefers-reduced-motion
              </label>
            </div>
            <div data-testid="r3d-pointer-light-readout" style={{ fontSize: "11px", color: "#93c5fd" }}>
              mode={pointerLight.mode} | light=({pointerLight.lightX.toFixed(2)}, {pointerLight.lightY.toFixed(2)}) |
              reflectionOffset=({pointerLight.reflectionOffsetPx[0]}px, {pointerLight.reflectionOffsetPx[1]}px) |
              static={String(pointerLight.reducedMotionStatic)}
            </div>
            <div data-testid="r3d-foil-dent-readout" style={{ fontSize: "11px", color: "#86efac" }}>
              pressed={String(buttonPressed)} | xpbdVolumeDrift={(foilClothResult.volumeDriftRatio * 100).toFixed(2)}% (limit &lt;= 1%) |
              iridescence={pbrLookSample.iridescenceFactor.toFixed(2)} | rgb=({pbrLookSample.rgb.map((v) => v.toFixed(2)).join(",")})
            </div>
          </div>

          <div
            data-testid="r3d-pointer-light-stage"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
              const ny = 1 - ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2;
              setPointerNorm([Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny))]);
            }}
            style={{
              height: "155px",
              background: "#020617",
              border: "1px solid #334155",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              data-testid="r3d-foil-button"
              onMouseDown={() => setButtonPressed(true)}
              onMouseUp={() => setButtonPressed(false)}
              onMouseLeave={() => setButtonPressed(false)}
              onClick={() => setButtonPressed((v) => !v)}
              style={{
                width: "190px",
                height: "68px",
                borderRadius: "8px",
                border: "1px solid #64748b",
                color: "#f8fafc",
                fontWeight: 800,
                fontSize: "20px",
                letterSpacing: "0.14em",
                cursor: "pointer",
                transform: buttonPressed ? "scale(0.95) translateY(2px)" : "scale(1)",
                transition: reducedMotion ? "none" : "transform 160ms cubic-bezier(0.22,1,0.36,1)",
                background: `radial-gradient(circle at ${50 + pointerLight.reflectionOffsetPx[0]}% ${50 + pointerLight.reflectionOffsetPx[1]}%, rgba(255,255,255,0.42), rgba(${Math.round(pbrLookSample.rgb[0] * 140)},${Math.round(pbrLookSample.rgb[1] * 160)},${Math.round(pbrLookSample.rgb[2] * 210)},1) 52%, #090d16 100%)`,
                boxShadow: buttonPressed
                  ? "inset 0 6px 14px rgba(0,0,0,0.85)"
                  : "0 12px 24px rgba(0,0,0,0.65)",
              }}
            >
              {decalText}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: Case 1 & M1+ Zero-Script CSS + WebGL2 Micro-Renderer */}
      {activeTab === "m1plus-size" && (
        <div data-testid="r3d-panel-m1plus-size" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div data-testid="r3d-zeroscript-readout" style={{ fontSize: "12px", color: "#34d399", fontWeight: 600 }}>
              Tier 1 Zero-Script JS: {zeroScriptCss.jsGzipBytes} B (CSS {zeroScriptCss.cssGzipBytes} B gzip)
            </div>
            <label style={{ fontSize: "12px", color: "#cbd5e1", display: "flex", gap: "6px" }}>
              <input
                type="checkbox"
                data-testid="r3d-micro-toon-toggle"
                checked={includeToonShader}
                onChange={(e) => setIncludeToonShader(e.target.checked)}
              />
              Slice Toon+Outline into Micro-Renderer
            </label>
            <div data-testid="r3d-leak-scan-readout" style={{ fontSize: "12px", color: "#93c5fd" }}>
              Micro-Renderer: {(microRenderer.jsGzipBytes / 1000).toFixed(1)} KB gzip (budget &lt;= 25 KB, three.js={String(microRenderer.usesThreeJs)}, leaks={leakCheck.leaksFound.length})
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "8px" }}>
            {fiveRecipeGate.recipes.map((r) => (
              <div
                key={r.id}
                style={{
                  background: "#020617",
                  border: "1px solid #334155",
                  borderRadius: "4px",
                  padding: "8px",
                  fontSize: "11px",
                }}
              >
                <div style={{ color: "#f8fafc", fontWeight: 700 }}>{r.label}</div>
                <div style={{ color: "#34d399", marginTop: "4px" }}>
                  JS: {(r.jsGzipBytes / 1000).toFixed(1)} KB | Total: {(r.totalGzipBytes / 1000).toFixed(1)} KB
                </div>
                <div style={{ color: "#94a3b8", marginTop: "2px" }}>{r.riveComparisonNote}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: M2 Studio & 3D-227 Live Multi-Animation Mixer */}
      {activeTab === "m2-studio" && (
        <div data-testid="r3d-panel-m2-studio" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: "12px", color: "#cbd5e1" }}>
              Subdivision Lvl:{" "}
              <select
                data-testid="r3d-subdiv-select"
                value={subdivLevel}
                onChange={(e) => setSubdivLevel(Number(e.target.value))}
                style={selectBase}
              >
                <option value={0}>0 (Base Cage)</option>
                <option value={1}>1 (Catmull-Clark 4f)</option>
                <option value={2}>2 (Catmull-Clark 16f)</option>
              </select>
            </label>
            <label style={{ fontSize: "12px", color: "#cbd5e1" }}>
              Camera Rig:{" "}
              <select
                data-testid="r3d-camrig-select"
                value={cameraRig}
                onChange={(e) => setCameraRig(e.target.value as CameraRigKind)}
                style={selectBase}
              >
                <option value="turntable">Turntable</option>
                <option value="dolly">Dolly</option>
                <option value="push-in">Push-In</option>
                <option value="crane">Crane</option>
              </select>
            </label>
            <div style={{ fontSize: "11px", color: "#93c5fd" }}>
              faces={m2Subdiv.mesh.faces.length} | camPos=({m2CamPose.position.map((n) => n.toFixed(2)).join(",")})
            </div>
          </div>

          <div
            style={{
              background: "#020617",
              border: "1px solid #334155",
              borderRadius: "4px",
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#fbbf24" }}>
              Phase 3D-227 · Live Multi-Animation Mixer (Upper-Body Bone Mask + Additive Layer)
            </div>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", fontSize: "11px", color: "#e2e8f0" }}>
              <label>
                Idle Weight ({idleWeight.toFixed(2)})
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={idleWeight}
                  onChange={(e) => setIdleWeight(Number(e.target.value))}
                />
              </label>
              <label>
                Walk Weight ({walkWeight.toFixed(2)})
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={walkWeight}
                  onChange={(e) => setWalkWeight(Number(e.target.value))}
                />
              </label>
              <label>
                Wave Upper-Body Weight ({waveWeight.toFixed(2)})
                <input
                  type="range"
                  data-testid="r3d-wave-weight-slider"
                  min={0}
                  max={1}
                  step={0.05}
                  value={waveWeight}
                  onChange={(e) => setWaveWeight(Number(e.target.value))}
                />
              </label>
            </div>
            <div data-testid="r3d-mixer-readout" style={{ fontSize: "11px", color: "#86efac" }}>
              {liveMixed.blendedBones
                .map((b) => `${b.bone}=(${b.rotationDeg.map((n) => n.toFixed(1)).join(",")})`)
                .join(" | ")}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: M3/M4 Living States, 4 Make-3D Wizards & 8-Step Rule Table */}
      {activeTab === "m3-m4-living" && (
        <div data-testid="r3d-panel-m3-m4" style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#e2e8f0" }}>
              M3 UI State Machine &amp; 4 &quot;Make 3D&quot; Wizards (&lt;= 5 steps)
            </div>
            <button
              type="button"
              data-testid="r3d-statemachine-btn"
              onClick={() => setUiState((s) => transitionComponentState3d(s, "toggle").nextState)}
              style={{ ...btnBase, background: uiState === "active" ? "#7c3aed" : "#2563eb" }}
            >
              State Machine Toggle (Current: {uiState})
            </button>
            {MAKE_3D_WIZARDS.map((w) => (
              <div
                key={w.id}
                style={{
                  background: "#020617",
                  border: "1px solid #334155",
                  borderRadius: "4px",
                  padding: "6px 8px",
                  fontSize: "11px",
                }}
              >
                <strong style={{ color: "#93c5fd" }}>
                  {w.title} ({w.steps.length} steps):
                </strong>{" "}
                <span style={{ color: "#cbd5e1" }}>{w.steps.join(" -> ")}</span>
              </div>
            ))}
          </div>
          <div
            data-testid="r3d-eightstep-table"
            style={{
              background: "#020617",
              border: "1px solid #334155",
              borderRadius: "4px",
              padding: "8px",
              fontSize: "11px",
            }}
          >
            <div style={{ fontWeight: 700, color: "#34d399", marginBottom: "6px" }}>
              3D-183 · 8-Step Rule Verification (10/10 Recipes &lt;= 8 Steps)
            </div>
            {COMMON_3D_RECIPES_8STEP_AUDIT.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1", padding: "2px 0" }}>
                <span>{r.name}</span>
                <span style={{ color: "#34d399" }}>{r.stepsCount} steps</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Case 3 & M5 Photo Studio — Car Wrap + Corner-Pin Planar Tracker */}
      {activeTab === "m5-photo" && (
        <div
          data-testid="r3d-panel-m5-photo"
          style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "12px" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                data-testid="r3d-wrap-text-input"
                value={wrapText}
                onChange={(e) => setWrapText(e.target.value)}
                style={{ ...selectBase, width: "120px" }}
                aria-label="Car wrap text"
              />
              <select
                data-testid="r3d-wrap-style-select"
                value={wrapStyle}
                onChange={(e) => setWrapStyle(e.target.value as WrapStyleId)}
                style={selectBase}
              >
                <option value="chrome">Style: Chrome</option>
                <option value="vinyl">Style: Vinyl</option>
                <option value="paint">Style: Paint</option>
                <option value="neon">Style: Neon</option>
              </select>
            </div>
            <label style={{ fontSize: "11px", color: "#cbd5e1" }}>
              Distinct (0%) &harr; Integrated ({Math.round(wrapBlend * 100)}%)
              <input
                type="range"
                data-testid="r3d-wrap-blend-slider"
                min={0}
                max={1}
                step={0.05}
                value={wrapBlend}
                onChange={(e) => setWrapBlend(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "11px", color: "#cbd5e1" }}>
              <label>
                <input
                  type="checkbox"
                  data-testid="r3d-crease-snap-toggle"
                  checked={creaseSnap}
                  onChange={(e) => setCreaseSnap(e.target.checked)}
                />{" "}
                Snap to Car Crease Lines
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showCornerPin}
                  onChange={(e) => setShowCornerPin(e.target.checked)}
                />{" "}
                4-Pt Corner-Pin Billboard
              </label>
              <label>
                <input
                  type="checkbox"
                  data-testid="r3d-ai-privacy-toggle"
                  checked={aiKeepOnDevice}
                  onChange={(e) => setAiKeepOnDevice(e.target.checked)}
                />{" "}
                Keep AI On Device
              </label>
            </div>
            <div data-testid="r3d-photo-readout" style={{ fontSize: "11px", color: "#86efac" }}>
              photoStays2D={String(carWrap.photoStays2D)} | rot={carWrap.cameraOrPhotoRotatedDeg}deg |
              creaseRecall={(carWrap.creaseRecallRatio * 100).toFixed(0)}% | pathErr={carWrap.meanPathErrorPx}px |
              homographyErr={billboardHomography.maxCornerErrorPx.toFixed(4)}px | ai={carAiStatus.executedOn}
            </div>
          </div>

          <div
            data-testid="r3d-car-wrap-stage"
            style={{
              height: "155px",
              background: "#020617",
              border: "1px solid #334155",
              borderRadius: "4px",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="320" height="140" viewBox="0 0 320 140" role="img" aria-label="Photo Car Wrap Preview">
              <defs>
                <clipPath id="carBodyClip">
                  <path d="M 35 102 L 45 72 L 105 46 L 210 46 L 270 72 L 292 98 L 285 110 L 38 110 Z" />
                </clipPath>
              </defs>
              {/* Billboard behind car */}
              {showCornerPin && (
                <polygon
                  points="18,16 140,26 134,88 14,82"
                  fill="#1e293b"
                  stroke="#38bdf8"
                  strokeDasharray="3 3"
                />
              )}
              {/* Car 2D body */}
              <path
                d="M 35 102 L 45 72 L 105 46 L 210 46 L 270 72 L 292 98 L 285 110 L 38 110 Z"
                fill="#1e293b"
                stroke="#94a3b8"
              />
              {/* Car shoulder character crease lines */}
              {creaseSnap && (
                <path d="M 48 80 Q 155 68 272 78" stroke="#38bdf8" strokeWidth="1.5" fill="none" />
              )}
              {/* Surface wrapped text */}
              <g clipPath="url(#carBodyClip)">
                <text
                  x="96"
                  y="96"
                  fill={wrapStyle === "neon" ? "#f472b6" : "#f8fafc"}
                  fontSize="24"
                  fontWeight="800"
                  letterSpacing="3"
                  opacity={0.45 + 0.55 * (1 - wrapBlend * 0.35)}
                  transform="skewX(-8)"
                >
                  {wrapText}
                </text>
              </g>
              {/* Window occluder cutout (text hides behind windows) */}
              <polygon points="108,52 198,52 246,72 86,72" fill="#090f1e" stroke="#475569" />
              <circle cx="88" cy="110" r="18" fill="#020617" stroke="#64748b" strokeWidth="3" />
              <circle cx="238" cy="110" r="18" fill="#020617" stroke="#64748b" strokeWidth="3" />
            </svg>
          </div>
        </div>
      )}

      {/* TAB 6: Case 4 & M6 Anime Studio */}
      {activeTab === "m6-anime" && (
        <div
          data-testid="r3d-panel-m6-anime"
          style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "12px" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select
                data-testid="r3d-anime-timing-select"
                value={animeTiming}
                onChange={(e) => setAnimeTiming(e.target.value as AnimeTimingMode)}
                style={selectBase}
              >
                <option value="ones">Timing: Ones (24 fps)</option>
                <option value="twos">Timing: Twos (12 Hz hold-2)</option>
                <option value="threes">Timing: Threes (8 Hz hold-3)</option>
              </select>
              <select
                data-testid="r3d-anime-vfx-select"
                value={animeVfx}
                onChange={(e) => setAnimeVfx(e.target.value as AnimeVfxKind)}
                style={selectBase}
              >
                {ANIME_PROCEDURAL_VFX.map((fx) => (
                  <option key={fx} value={fx}>
                    VFX: {fx}
                  </option>
                ))}
              </select>
              <select
                data-testid="r3d-anime-cam-select"
                value={animeCam}
                onChange={(e) => setAnimeCam(e.target.value as AnimeCameraPreset)}
                style={selectBase}
              >
                <option value="crash-zoom">Cam: Crash Zoom</option>
                <option value="dolly-zoom">Cam: Dolly Zoom</option>
                <option value="dutch-angle">Cam: Dutch Angle</option>
                <option value="whip-pan">Cam: Whip Pan</option>
              </select>
            </div>
            <label style={{ fontSize: "11px", color: "#cbd5e1" }}>
              60fps Timeline Scrubber (Frame {animeFrame60})
              <input
                type="range"
                data-testid="r3d-anime-frame-slider"
                min={0}
                max={30}
                step={1}
                value={animeFrame60}
                onChange={(e) => setAnimeFrame60(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </label>
            <div data-testid="r3d-anime-readout" style={{ fontSize: "11px", color: "#f9a8d4" }}>
              poseIndex={animeStepped.characterPoseIndex} (charFps={animeStepped.effectiveCharacterFps}) |
              camProgress={animeStepped.cameraSmoothProgress.toFixed(2)} | camFov={animeCamState.fovDeg.toFixed(1)}deg |
              vfx={animeVfx}
            </div>
          </div>

          <div
            data-testid="r3d-anime-stage"
            style={{
              height: "155px",
              background: "#020617",
              border: "1px solid #a855f7",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <svg width="280" height="140" viewBox="0 0 280 140" role="img" aria-label="Anime Fight Shot Preview">
              <g
                transform={`translate(140 72) scale(${(42 / Math.max(20, animeCamState.fovDeg)).toFixed(2)}) rotate(${animeCamState.rollDeg})`}
              >
                {/* Procedural Shadow Flames / Aura */}
                <path
                  d="M -42 36 C -52 -12 -18 -56 0 -60 C 20 -52 50 -10 42 36 Z"
                  fill={animeVfx === "shadow-flames" ? "#6d28d9" : "#2563eb"}
                  opacity="0.55"
                />
                {/* Stepped Anime Silhouette with Smoothed-Normal Unbroken Ink Outline */}
                <polygon
                  points={`${-22 + (animeStepped.characterPoseIndex % 2) * 8},32 -12,-34 14,-34 26,32`}
                  fill="#0f172a"
                  stroke="#f8fafc"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />
                {/* Speed / Slash arc */}
                <path
                  d="M -68 10 Q 0 -32 72 -6"
                  stroke="#38bdf8"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            </svg>
          </div>
        </div>
      )}
    </section>
  );
}
