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
import { Button } from "@/editor/components/Button";
import { Checkbox } from "@/editor/components/Checkbox";
import type { PropertiesFace } from "./propertiesFace";

type StudioModeId =
  | "m1-foil"
  | "m1plus-size"
  | "m2-studio"
  | "m3-m4-living"
  | "m5-photo"
  | "m6-anime";

export interface StudioTabProps {
  objectId: string;
  face?: PropertiesFace;
  className?: string;
}

export const StudioTab: React.FC<StudioTabProps> = ({
  objectId,
  className = "",
}) => {
  const [mode, setMode] = useState<StudioModeId>("m1-foil");
  const [gateReport, setGateReport] = useState<Roadmap3dMasterGateReport>(() =>
    runAllRoadmap3dGates(),
  );

  // M1 + M1+ Foil Button & Opposite Pointer Light
  const [materialLook, setMaterialLook] = useState<MaterialLookV1Id>("black-foil-mylar");
  const [lightRig, setLightRig] = useState<LightRigLookV1Id>("studio-softbox");
  const [pointerMode, setPointerMode] = useState<PointerLightMode>("Opposite");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pointerNorm, setPointerNorm] = useState<readonly [number, number]>([-0.35, 0.45]);
  const [buttonPressed, setButtonPressed] = useState(false);
  const [decalText, setDecalText] = useState("PUSH");

  // M1+ Small Export
  const [includeToonShader, setIncludeToonShader] = useState(false);

  // M2 & 3D-227 Live Multi-Animation Mixer
  const [subdivLevel, setSubdivLevel] = useState(1);
  const [cameraRig, setCameraRig] = useState<CameraRigKind>("turntable");
  const [idleWeight, setIdleWeight] = useState(0.5);
  const [walkWeight, setWalkWeight] = useState(0.5);
  const [waveWeight, setWaveWeight] = useState(0.8);

  // M3 / M4 Living Components
  const [uiState, setUiState] = useState<ComponentUiState>("idle");

  // M5 Photo Car Wrap & Planar Corner-Pin Tracker
  const [aiKeepOnDevice, setAiKeepOnDevice] = useState(true);
  const [wrapText, setWrapText] = useState("SPEED");
  const [wrapStyle, setWrapStyle] = useState<WrapStyleId>("chrome");
  const [wrapBlend, setWrapBlend] = useState(0.75);
  const [creaseSnap, setCreaseSnap] = useState(true);

  // M6 Anime Studio
  const [animeTiming, setAnimeTiming] = useState<AnimeTimingMode>("twos");
  const [animeFrame60, setAnimeFrame60] = useState(0);
  const [animeVfx, setAnimeVfx] = useState<AnimeVfxKind>("shadow-flames");
  const [animeCam, setAnimeCam] = useState<AnimeCameraPreset>("crash-zoom");

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

  const MODE_BUTTONS: readonly { id: StudioModeId; label: string; testId: string }[] = [
    { id: "m1-foil", label: "Foil+Light", testId: "editor-r3d-tab-m1-foil" },
    { id: "m1plus-size", label: "MicroExport", testId: "editor-r3d-tab-m1plus-size" },
    { id: "m2-studio", label: "M2+Mixer", testId: "editor-r3d-tab-m2-studio" },
    { id: "m3-m4-living", label: "States+8Step", testId: "editor-r3d-tab-m3-m4-living" },
    { id: "m5-photo", label: "PhotoCar", testId: "editor-r3d-tab-m5-photo" },
    { id: "m6-anime", label: "AnimeShot", testId: "editor-r3d-tab-m6-anime" },
  ];

  return (
    <div
      className={`ll:flex ll:flex-col ll:gap-3 ${className}`}
      data-testid="tab-studio"
      data-object-id={objectId}
    >
      {/* Master 227-Phase Gates Summary & Trigger */}
      <div className="ll:flex ll:flex-col ll:gap-2 ll:p-2.5 ll:bg-surface-canvas ll:border ll:border-border ll:rounded">
        <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
          <span className="ll:text-micro ll:font-semibold ll:text-primary">
            ROADMAP_3D Studio (3D-001 – 3D-227)
          </span>
          <Button
            size="sm"
            variant="secondary"
            data-testid="editor-r3d-run-gates-btn"
            onClick={() => setGateReport(runAllRoadmap3dGates())}
          >
            Run Gates
          </Button>
        </div>
        <div
          data-testid="editor-r3d-gates-summary"
          className="ll:text-micro ll:font-mono ll:text-primary ll:leading-relaxed"
        >
          ALL GATES ({gateReport.phasesCoveredCount}/227): {gateReport.allPassed ? "PASS" : "FAIL"} | M1=
          {String(gateReport.gateM1.passed)} A={String(gateReport.gateA.passed)} M2=
          {String(gateReport.gateM2.passed)} M3={String(gateReport.gateM3.passed)} M4=
          {String(gateReport.gateM4.passed)} B={String(gateReport.gateB.passed)} C=
          {String(gateReport.gateC.passed)}
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="ll:grid ll:grid-cols-3 ll:gap-1">
        {MODE_BUTTONS.map((b) => {
          const active = mode === b.id;
          return (
            <button
              key={b.id}
              type="button"
              data-testid={b.testId}
              onClick={() => setMode(b.id)}
              className={`ll:px-2 ll:py-1 ll:rounded ll:text-micro ll:font-semibold ll:border ll:cursor-pointer ${
                active
                  ? "ll:bg-control-primary ll:text-control-primary-fg ll:border-control-primary"
                  : "ll:bg-surface-canvas ll:text-secondary ll:border-border ll:hover:text-primary"
              }`}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {/* M1 + Case 2: Foil Balloon Button & Opposite Pointer Light */}
      {mode === "m1-foil" && (
        <div className="ll:flex ll:flex-col ll:gap-2.5 ll:p-2.5 ll:bg-surface-canvas ll:border ll:border-border ll:rounded">
          <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
            <select
              data-testid="editor-r3d-material-look-select"
              value={materialLook}
              onChange={(e) => setMaterialLook(e.target.value as MaterialLookV1Id)}
              aria-label="Material Look"
              className="ll:bg-surface-panel ll:text-primary ll:border ll:border-border ll:rounded ll:px-1.5 ll:py-1 ll:text-micro"
            >
              {Object.keys(MATERIAL_LOOKS_V1).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select
              data-testid="editor-r3d-light-rig-select"
              value={lightRig}
              onChange={(e) => setLightRig(e.target.value as LightRigLookV1Id)}
              aria-label="Light Rig"
              className="ll:bg-surface-panel ll:text-primary ll:border ll:border-border ll:rounded ll:px-1.5 ll:py-1 ll:text-micro"
            >
              {Object.keys(LIGHT_RIG_LOOKS_V1).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select
              data-testid="editor-r3d-pointer-mode-select"
              value={pointerMode}
              onChange={(e) => setPointerMode(e.target.value as PointerLightMode)}
              aria-label="Pointer Light Mode"
              className="ll:bg-surface-panel ll:text-primary ll:border ll:border-border ll:rounded ll:px-1.5 ll:py-1 ll:text-micro"
            >
              <option value="Opposite">Opposite</option>
              <option value="Follow">Follow</option>
              <option value="Orbit">Orbit</option>
              <option value="Breathe">Breathe</option>
            </select>
            <input
              type="text"
              data-testid="editor-r3d-decal-input"
              value={decalText}
              onChange={(e) => setDecalText(e.target.value)}
              aria-label="Decal text"
              className="ll:bg-surface-panel ll:text-primary ll:border ll:border-border ll:rounded ll:px-1.5 ll:py-1 ll:text-micro"
            />
          </div>

          <Checkbox
            checked={reducedMotion}
            onChange={setReducedMotion}
            label="prefers-reduced-motion"
            aria-label="prefers-reduced-motion"
          />

          <div
            data-testid="editor-r3d-pointer-light-stage"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
              const ny = 1 - ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2;
              setPointerNorm([Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny))]);
            }}
            className="ll:flex ll:items-center ll:justify-center ll:h-28 ll:bg-surface-panel ll:border ll:border-border ll:rounded ll:overflow-hidden"
          >
            <button
              type="button"
              data-testid="editor-r3d-foil-button"
              onMouseDown={() => setButtonPressed(true)}
              onMouseUp={() => setButtonPressed(false)}
              onClick={() => setButtonPressed((v) => !v)}
              className="ll:px-6 ll:py-3 ll:rounded-md ll:border ll:border-border ll:text-small ll:font-semibold ll:text-primary ll:bg-surface-canvas ll:cursor-pointer"
              style={{
                transform: buttonPressed ? "scale(0.95) translateY(2px)" : "scale(1)",
                backgroundImage: `radial-gradient(circle at ${50 + pointerLight.reflectionOffsetPx[0]}% ${50 + pointerLight.reflectionOffsetPx[1]}%, rgba(255,255,255,0.28), transparent 60%)`,
              }}
            >
              {decalText}
            </button>
          </div>

          <div data-testid="editor-r3d-pointer-light-readout" className="ll:text-micro ll:font-mono ll:text-secondary">
            mode={pointerLight.mode} | light=({pointerLight.lightX.toFixed(2)}, {pointerLight.lightY.toFixed(2)}) |
            static={String(pointerLight.reducedMotionStatic)}
          </div>
          <div data-testid="editor-r3d-foil-dent-readout" className="ll:text-micro ll:font-mono ll:text-primary">
            pressed={String(buttonPressed)} | xpbdVolumeDrift={(foilClothResult.volumeDriftRatio * 100).toFixed(2)}% (limit &lt;= 1%) |
            iridescence={pbrLookSample.iridescenceFactor.toFixed(2)}
          </div>
        </div>
      )}

      {/* Case 1 & M1+: Zero-Script CSS + WebGL2 Micro-Renderer */}
      {mode === "m1plus-size" && (
        <div className="ll:flex ll:flex-col ll:gap-2 ll:p-2.5 ll:bg-surface-canvas ll:border ll:border-border ll:rounded">
          <div data-testid="editor-r3d-zeroscript-readout" className="ll:text-micro ll:font-mono ll:text-primary ll:font-semibold">
            Tier 1 Zero-Script JS: {zeroScriptCss.jsGzipBytes} B (CSS {zeroScriptCss.cssGzipBytes} B gzip)
          </div>
          <Checkbox
            checked={includeToonShader}
            onChange={setIncludeToonShader}
            label="Slice Toon+Outline into Micro-Renderer"
            aria-label="Slice Toon+Outline into Micro-Renderer"
          />
          <div data-testid="editor-r3d-leak-scan-readout" className="ll:text-micro ll:font-mono ll:text-secondary">
            Micro-Renderer: {(microRenderer.jsGzipBytes / 1000).toFixed(1)} KB gzip (budget &lt;= 25 KB, three.js={String(microRenderer.usesThreeJs)}, leaks={leakCheck.leaksFound.length})
          </div>
          <div className="ll:flex ll:flex-col ll:gap-1">
            {fiveRecipeGate.recipes.map((r) => (
              <div
                key={r.id}
                className="ll:flex ll:items-center ll:justify-between ll:p-1.5 ll:bg-surface-panel ll:border ll:border-border ll:rounded ll:text-micro"
              >
                <span className="ll:text-primary">{r.label}</span>
                <span className="ll:font-mono ll:text-primary ll:font-semibold">{(r.totalGzipBytes / 1000).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* M2 Studio & 3D-227 Live Multi-Animation Mixer */}
      {mode === "m2-studio" && (
        <div className="ll:flex ll:flex-col ll:gap-2.5 ll:p-2.5 ll:bg-surface-canvas ll:border ll:border-border ll:rounded" data-testid="editor-r3d-panel-m2-studio">
          <div className="ll:flex ll:items-center ll:gap-2 ll:flex-wrap">
            <select
              data-testid="editor-r3d-subdiv-select"
              value={subdivLevel}
              onChange={(e) => setSubdivLevel(Number(e.target.value))}
              aria-label="Subdivision Level"
              className="ll:bg-surface-panel ll:text-primary ll:border ll:border-border ll:rounded ll:px-1.5 ll:py-1 ll:text-micro"
            >
              <option value={0}>Subdiv 0</option>
              <option value={1}>Subdiv 1 (4f)</option>
              <option value={2}>Subdiv 2 (16f)</option>
            </select>
            <select
              data-testid="editor-r3d-camrig-select"
              value={cameraRig}
              onChange={(e) => setCameraRig(e.target.value as CameraRigKind)}
              aria-label="Camera Rig"
              className="ll:bg-surface-panel ll:text-primary ll:border ll:border-border ll:rounded ll:px-1.5 ll:py-1 ll:text-micro"
            >
              <option value="turntable">Turntable</option>
              <option value="dolly">Dolly</option>
              <option value="push-in">Push-In</option>
              <option value="crane">Crane</option>
            </select>
          </div>
          <div className="ll:text-micro ll:font-mono ll:text-muted">
            faces={m2Subdiv.mesh.faces.length} | cam=({m2CamPose.position.map((n) => n.toFixed(1)).join(",")})
          </div>
          <div className="ll:flex ll:flex-col ll:gap-1.5 ll:p-2 ll:bg-surface-panel ll:border ll:border-border ll:rounded">
            <span className="ll:text-micro ll:font-semibold ll:text-primary">
              3D-227 Live Multi-Animation Mixer
            </span>
            <label className="ll:flex ll:flex-col ll:gap-0.5 ll:text-micro ll:text-muted">
              Idle ({idleWeight.toFixed(2)})
              <input type="range" min={0} max={1} step={0.05} value={idleWeight} onChange={(e) => setIdleWeight(Number(e.target.value))} />
            </label>
            <label className="ll:flex ll:flex-col ll:gap-0.5 ll:text-micro ll:text-muted">
              Walk ({walkWeight.toFixed(2)})
              <input type="range" min={0} max={1} step={0.05} value={walkWeight} onChange={(e) => setWalkWeight(Number(e.target.value))} />
            </label>
            <label className="ll:flex ll:flex-col ll:gap-0.5 ll:text-micro ll:text-muted">
              Wave Upper-Body ({waveWeight.toFixed(2)})
              <input
                type="range"
                data-testid="editor-r3d-wave-weight-slider"
                min={0}
                max={1}
                step={0.05}
                value={waveWeight}
                onChange={(e) => setWaveWeight(Number(e.target.value))}
              />
            </label>
            <div data-testid="editor-r3d-mixer-readout" className="ll:text-micro ll:font-mono ll:text-primary">
              {liveMixed.blendedBones
                .map((b) => `${b.bone}=(${b.rotationDeg.map((n) => n.toFixed(1)).join(",")})`)
                .join(" | ")}
            </div>
          </div>
        </div>
      )}

      {/* M3 / M4 Living Components, Wizards & 8-Step Rule */}
      {mode === "m3-m4-living" && (
        <div className="ll:flex ll:flex-col ll:gap-2 ll:p-2.5 ll:bg-surface-canvas ll:border ll:border-border ll:rounded">
          <Button
            size="sm"
            variant="primary"
            data-testid="editor-r3d-statemachine-btn"
            onClick={() => setUiState((s) => transitionComponentState3d(s, "toggle").nextState)}
          >
            State Machine Toggle (Current: {uiState})
          </Button>
          <div className="ll:flex ll:flex-col ll:gap-1">
            {MAKE_3D_WIZARDS.map((w) => (
              <div key={w.id} className="ll:p-1.5 ll:bg-surface-panel ll:border ll:border-border ll:rounded ll:text-micro">
                <strong className="ll:text-primary">{w.title} ({w.steps.length} steps)</strong>
              </div>
            ))}
          </div>
          <div data-testid="editor-r3d-eightstep-table" className="ll:flex ll:flex-col ll:gap-1 ll:p-2 ll:bg-surface-panel ll:border ll:border-border ll:rounded ll:text-micro">
            <span className="ll:font-semibold ll:text-primary">10/10 Recipes &lt;= 8 Steps</span>
            {COMMON_3D_RECIPES_8STEP_AUDIT.map((r) => (
              <div key={r.id} className="ll:flex ll:justify-between ll:text-secondary">
                <span>{r.name}</span>
                <span className="ll:font-mono ll:text-primary">{r.stepsCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Case 3 & M5 Photo Studio — Car Wrap & Planar Tracker */}
      {mode === "m5-photo" && (
        <div className="ll:flex ll:flex-col ll:gap-2 ll:p-2.5 ll:bg-surface-canvas ll:border ll:border-border ll:rounded">
          <div className="ll:flex ll:gap-1.5">
            <input
              type="text"
              data-testid="editor-r3d-wrap-text-input"
              value={wrapText}
              onChange={(e) => setWrapText(e.target.value)}
              aria-label="Car wrap text"
              className="ll:flex-1 ll:bg-surface-panel ll:text-primary ll:border ll:border-border ll:rounded ll:px-1.5 ll:py-1 ll:text-micro"
            />
            <select
              data-testid="editor-r3d-wrap-style-select"
              value={wrapStyle}
              onChange={(e) => setWrapStyle(e.target.value as WrapStyleId)}
              aria-label="Wrap style"
              className="ll:bg-surface-panel ll:text-primary ll:border ll:border-border ll:rounded ll:px-1.5 ll:py-1 ll:text-micro"
            >
              <option value="chrome">Chrome</option>
              <option value="vinyl">Vinyl</option>
              <option value="paint">Paint</option>
              <option value="neon">Neon</option>
            </select>
          </div>
          <label className="ll:flex ll:flex-col ll:gap-0.5 ll:text-micro ll:text-secondary">
            Distinct (0%) &harr; Integrated ({Math.round(wrapBlend * 100)}%)
            <input
              type="range"
              data-testid="editor-r3d-wrap-blend-slider"
              min={0}
              max={1}
              step={0.05}
              value={wrapBlend}
              onChange={(e) => setWrapBlend(Number(e.target.value))}
            />
          </label>
          <div className="ll:flex ll:gap-3 ll:text-micro ll:text-secondary">
            <Checkbox
              checked={creaseSnap}
              onChange={setCreaseSnap}
              label="Crease Snap"
              aria-label="Crease Snap"
            />
            <Checkbox
              checked={aiKeepOnDevice}
              onChange={setAiKeepOnDevice}
              label="AI On Device"
              aria-label="AI On Device"
            />
          </div>
          <div data-testid="editor-r3d-car-wrap-stage" className="ll:p-2 ll:bg-surface-panel ll:border ll:border-border ll:rounded ll:flex ll:justify-center">
            <svg width="220" height="96" viewBox="0 0 320 140" role="img" aria-label="Car Wrap Preview">
              <defs>
                <clipPath id="editorCarClip">
                  <path d="M 35 102 L 45 72 L 105 46 L 210 46 L 270 72 L 292 98 L 285 110 L 38 110 Z" />
                </clipPath>
              </defs>
              <path d="M 35 102 L 45 72 L 105 46 L 210 46 L 270 72 L 292 98 L 285 110 L 38 110 Z" fill="currentColor" opacity="0.2" />
              {creaseSnap && <path d="M 48 80 Q 155 68 272 78" stroke="currentColor" strokeWidth="2" fill="none" />}
              <g clipPath="url(#editorCarClip)">
                <text x="96" y="96" fill="currentColor" fontSize="24" fontWeight="800" letterSpacing="3">
                  {wrapText}
                </text>
              </g>
            </svg>
          </div>
          <div data-testid="editor-r3d-photo-readout" className="ll:text-micro ll:font-mono ll:text-primary">
            photoStays2D={String(carWrap.photoStays2D)} | rot={carWrap.cameraOrPhotoRotatedDeg}deg |
            creaseRecall={(carWrap.creaseRecallRatio * 100).toFixed(0)}% |
            homographyErr={billboardHomography.maxCornerErrorPx.toFixed(4)}px | ai={carAiStatus.executedOn}
          </div>
        </div>
      )}

      {/* Case 4 & M6 Anime Studio */}
      {mode === "m6-anime" && (
        <div className="ll:flex ll:flex-col ll:gap-2 ll:p-2.5 ll:bg-surface-canvas ll:border ll:border-border ll:rounded">
          <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
            <select
              data-testid="editor-r3d-anime-timing-select"
              value={animeTiming}
              onChange={(e) => setAnimeTiming(e.target.value as AnimeTimingMode)}
              aria-label="Anime timing"
              className="ll:bg-surface-panel ll:text-primary ll:border ll:border-border ll:rounded ll:px-1.5 ll:py-1 ll:text-micro"
            >
              <option value="ones">Ones (24 fps)</option>
              <option value="twos">Twos (12 Hz)</option>
              <option value="threes">Threes (8 Hz)</option>
            </select>
            <select
              data-testid="editor-r3d-anime-cam-select"
              value={animeCam}
              onChange={(e) => setAnimeCam(e.target.value as AnimeCameraPreset)}
              aria-label="Anime camera"
              className="ll:bg-surface-panel ll:text-primary ll:border ll:border-border ll:rounded ll:px-1.5 ll:py-1 ll:text-micro"
            >
              <option value="crash-zoom">Crash Zoom</option>
              <option value="dolly-zoom">Dolly Zoom</option>
              <option value="dutch-angle">Dutch Angle</option>
              <option value="whip-pan">Whip Pan</option>
            </select>
          </div>
          <select
            data-testid="editor-r3d-anime-vfx-select"
            value={animeVfx}
            onChange={(e) => setAnimeVfx(e.target.value as AnimeVfxKind)}
            aria-label="Anime VFX"
            className="ll:bg-surface-panel ll:text-primary ll:border ll:border-border ll:rounded ll:px-1.5 ll:py-1 ll:text-micro"
          >
            {ANIME_PROCEDURAL_VFX.map((fx) => (
              <option key={fx} value={fx}>
                VFX: {fx}
              </option>
            ))}
          </select>
          <label className="ll:flex ll:flex-col ll:gap-0.5 ll:text-micro ll:text-secondary">
            Frame {animeFrame60} (60fps timeline)
            <input
              type="range"
              data-testid="editor-r3d-anime-frame-slider"
              min={0}
              max={30}
              step={1}
              value={animeFrame60}
              onChange={(e) => setAnimeFrame60(Number(e.target.value))}
            />
          </label>
          <div data-testid="editor-r3d-anime-stage" className="ll:p-2 ll:bg-surface-panel ll:border ll:border-border ll:rounded ll:flex ll:justify-center">
            <svg width="200" height="90" viewBox="0 0 280 140" role="img" aria-label="Anime Shot Preview">
              <g transform={`translate(140 72) scale(${(42 / Math.max(20, animeCamState.fovDeg)).toFixed(2)}) rotate(${animeCamState.rollDeg})`}>
                <polygon
                  points={`${-22 + (animeStepped.characterPoseIndex % 2) * 8},32 -12,-34 14,-34 26,32`}
                  fill="currentColor"
                  opacity="0.35"
                  stroke="currentColor"
                  strokeWidth="3"
                />
              </g>
            </svg>
          </div>
          <div data-testid="editor-r3d-anime-readout" className="ll:text-micro ll:font-mono ll:text-primary">
            poseIndex={animeStepped.characterPoseIndex} (charFps={animeStepped.effectiveCharacterFps}) |
            vfx={animeVfx} | camFov={animeCamState.fovDeg.toFixed(1)}deg
          </div>
        </div>
      )}
    </div>
  );
};
