"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { busFrame, distanceToRect, newBusState, type InputSource } from "@/core/bindings/inputBus";
import { evaluateVariableFontProximity } from "@/core/bindings/layoutIsolatedReactions";
import { createPointerPresetState, stepPointerPreset } from "@/core/bindings/pointerPresets";
import { stepFollowComponent, type FollowComponentState } from "@/core/bindings/helpersAndFollow";
import { autopilotUv } from "@/core/bindings/tape";
import { importCodeComponent } from "@/core/components/codeComponents";
import { buildSandboxIframeDescriptor, inspectUntrustedBundleIsolation } from "@/core/components/codeSandbox";
import { FULL_EFFECT_LIBRARY } from "@/core/effects/libraryWaves10To13";
import { buildFrameworkFreeEmbedSnippet } from "@/core/export/embedScriptAndVitals";
import { buildInteractiveExportBundle } from "@/core/export/interactiveExportRuntime";
import { buildDeformedMesh } from "@/core/gpu/deformationWarpPeel";
import { createLayerTextureSdfRegistry } from "@/core/gpu/layerTexturesAndSdf";
import { evaluateLayer2dLighting, resolveLightsForCursor } from "@/core/gpu/lights2d";
import { evaluateLiquidGlassOverlay } from "@/core/gpu/liquidGlass";
import { evaluateOutlineEffectOverlay } from "@/core/gpu/outlineEffects";
import { extractUniformProps, validateRawGlslSafety } from "@/core/gpu/rawGlslSafety";
import type { RasterBitmap } from "@/core/gpu/sceneRasteriser";
import { compileShaderGraph } from "@/core/gpu/shaderGraph";
import { createStatefulSimulation } from "@/core/gpu/statefulSimulations";
import { roundTripGraphViaNodeScript } from "@/core/nodescript/interactionBridge";
import { compileSimpleRuleToBlueprint } from "@/core/nodescript/simpleRulesEditor";
import {
  generateFracturePieces,
  stepFracturePieces,
  verifyTilingCoverage,
} from "@/core/physics2d/fractureAndShatter";
import { createPhysicsWorld2D } from "@/core/physics2d/physicsCore";
import { createEphemeralSpawner, filterNonEphemeralDocumentLayers } from "@/core/physics2d/spawner";
import { auditFullLibraryTierBudgets } from "@/core/profiler/interactivePerfBudgets";
import { auditInteractiveAccessibility } from "@/core/rules/interactiveAccessibility";
import { evaluateDepthParallaxScene, type DepthPlaneSpec } from "@/core/scroll/depthParallax";
import { createScrollScrubMediaController } from "@/core/scroll/scrollScrubbedMedia";
import { createSmoothScrollController } from "@/core/scroll/smoothScrolling";
import { createScrollerController } from "@/core/signals/carouselsAndLoops";
import { runFullCompositionSuite } from "@/core/signals/compositionSuite";
import { createCursorOverlayController } from "@/core/signals/cursorOverlay";
import { createGestureRecognizer } from "@/core/signals/gestures";
import { createRovingFocusGroup } from "@/core/signals/keyboardInteractivity";
import { createSoundAndHapticsEngine } from "@/core/signals/soundAndHaptics";
import { splitTextIntoRealLayers } from "@/core/signals/splitIntoLayers";
import {
  runStage4JourneyA,
  runStage4JourneyB,
  runStage4JourneyC,
  runStage4JourneyD,
  runStage4JourneyE,
} from "@/core/signals/stage4GateJourneys";

const SLIDE_IDS = ["slide-0", "slide-1", "slide-2", "slide-3", "slide-4"] as const;

const PARALLAX_PLANES: readonly DepthPlaneSpec[] = [
  { id: "plane-sky", depthZPx: -240, baseX: 0, baseY: 0 },
  { id: "plane-mountains", depthZPx: -120, baseX: 0, baseY: 0 },
  { id: "plane-mid", depthZPx: 0, baseX: 0, baseY: 0 },
  { id: "plane-fg", depthZPx: 110, baseX: 0, baseY: 0 },
  { id: "plane-ui", depthZPx: 220, baseX: 0, baseY: 0 },
];

const HERO_LETTERS = "STAGE4".split("").map((char, idx) => ({
  id: `char-${idx}`,
  char,
  centerX: 160 + idx * 44,
  centerY: 110,
}));

export interface SandboxProbeMessage {
  readonly origin: string;
  readonly cookieValue: string;
  readonly cookieBlocked: boolean;
  readonly localStorageError: string | null;
  readonly parentDocumentError: string | null;
}

export interface Stage4LabSnapshot {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly busFrameCount: number;
  readonly busSpeed: number;
  readonly magnetX: number;
  readonly magnetY: number;
  readonly followX: number;
  readonly followY: number;
  readonly cursorRenderX: number;
  readonly cursorRenderY: number;
  readonly vfontMaxWeight: number;
  readonly vfontMinWeight: number;
  readonly activeSlideIndex: number;
  readonly rovingFocusId: string | null;
  readonly splitLetterCount: number;
  readonly audioUnlocked: boolean;
  readonly audioEventCount: number;
  readonly preUnlockEventBlocked: boolean;
  readonly glassCoveredPixels: number;
  readonly outlineLitPixels: number;
  readonly litPixelCount: number;
  readonly highlightPeak: number;
  readonly scrollY: number;
  readonly scrubFrameIndex: number;
  readonly peelProgress: number;
  readonly deformVertexCount: number;
  readonly sandboxProbe: SandboxProbeMessage | null;
}

export interface Stage4LabApi {
  readonly getSnapshot: () => Stage4LabSnapshot;
  readonly runGateJourneys: () => {
    readonly a: ReturnType<typeof runStage4JourneyA>;
    readonly b: ReturnType<typeof runStage4JourneyB>;
    readonly c: ReturnType<typeof runStage4JourneyC>;
    readonly d: ReturnType<typeof runStage4JourneyD>;
    readonly e: ReturnType<typeof runStage4JourneyE>;
  };
  readonly runCompositionSuite: () => ReturnType<typeof runFullCompositionSuite>;
  readonly runPhysicsAndFractureCheck: () => {
    readonly physicsSteps: number;
    readonly ballMovedY: number;
    readonly t0Cap: number;
    readonly t2Cap: number;
    readonly filteredLayerCount: number;
    readonly voronoiExact: boolean;
    readonly stripsExact: boolean;
    readonly gridExact: boolean;
    readonly tearExact: boolean;
    readonly reassemblyErrorPx: number;
  };
  readonly runGpuAndShaderCheck: () => {
    readonly safeGlslOk: boolean;
    readonly safeUniformCount: number;
    readonly unsafeWhileRejected: boolean;
    readonly shaderGraphHasUniforms: boolean;
    readonly simResolutionT0: string;
    readonly simSeekHashParity: boolean;
    readonly libraryTotalEffects: number;
    readonly libraryPassingAllTiers: number;
    readonly lowTierSoaksPassed: number;
  };
  readonly runNodeScriptAndRulesCheck: () => {
    readonly compiledNodes: number;
    readonly nlsRoundTripMatches: boolean;
    readonly tapeChecksum: number;
    readonly distToEdge: number;
    readonly importedControls: number;
    readonly restrictedKeepPrivate: boolean;
    readonly sandboxIsolationOk: boolean;
    readonly exportZeroLazyImports: boolean;
    readonly embedExpectedCls: number;
    readonly a11yDiagnosticsDetected: number;
  };
}

declare global {
  interface Window {
    __LL_STAGE4_LAB__?: Stage4LabApi;
  }
}

function buildCheckerBackdrop(width: number, height: number): RasterBitmap {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const cell = ((Math.floor(x / 12) + Math.floor(y / 12)) & 1) === 0;
      const accent = x > 50 && x < 110 && y > 24 && y < 76;
      data[idx] = accent ? 64 : cell ? 38 : 22;
      data[idx + 1] = accent ? 148 : cell ? 54 : 30;
      data[idx + 2] = accent ? 250 : cell ? 92 : 48;
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

function computeGpuScene(lightCursorX: number, lightCursorY: number, currentPeel: number) {
  const backdrop = buildCheckerBackdrop(160, 100);
  const registry = createLayerTextureSdfRegistry("interactive-lab");
  const sdf = registry.updateLayer(
    {
      id: "glass-pill-rect",
      kind: "rectangle",
      version: 1,
      x: 0,
      y: 0,
      width: 120,
      height: 64,
      fill: { r: 255, g: 255, b: 255, a: 255 },
    },
    6,
  );

  const glass = evaluateLiquidGlassOverlay(backdrop, sdf, {
    preset: "liquid_glass",
    offsetX: 20,
    offsetY: 18,
    refractionStrengthPx: 6,
    tier: "T2",
  });
  const outline = evaluateOutlineEffectOverlay(sdf, {
    kind: "electric_border",
    timeSec: 0.45,
    pointerX: 60,
    pointerY: 32,
    tier: "T2",
  });

  const surfaceSdf = registry.updateLayer(
    {
      id: "lit-surface",
      kind: "rectangle",
      version: 1,
      x: 0,
      y: 0,
      width: 160,
      height: 100,
      fill: { r: 200, g: 215, b: 240, a: 255 },
    },
    4,
  );
  const resolvedLights = resolveLightsForCursor(
    [
      {
        id: "cursor-pt",
        kind: "point",
        x: 80,
        y: 50,
        z: 36,
        radiusPx: 140,
        color: { r: 120, g: 185, b: 255, a: 255 },
        intensity: 1.5,
        castSoftShadow: true,
        followCursor: true,
      },
      {
        id: "warm-spot",
        kind: "spot",
        x: 20,
        y: 20,
        z: 42,
        radiusPx: 150,
        color: { r: 255, g: 190, b: 120, a: 255 },
        intensity: 1.1,
        spotDirX: 0.78,
        spotDirY: 0.62,
        spotInnerCos: 0.9,
        spotOuterCos: 0.65,
      },
    ],
    lightCursorX,
    lightCursorY,
  );
  const lit = evaluateLayer2dLighting(
    {
      layerId: "lit-surface",
      sdf: surfaceSdf,
      surface: { mode: "embossed", embossDepthPx: 5, shininess: 24, specularStrength: 0.85 },
      offsetX: 0,
      offsetY: 0,
    },
    resolvedLights,
    "T2",
  );
  registry.unmountAll();

  const mesh = buildDeformedMesh(160, 100, {
    kind: "sticker_peel",
    progress: currentPeel,
    curlRadiusPx: 18,
    peelCorner: "bottom_right",
    gridCols: 10,
    gridRows: 6,
  });

  return {
    glassBitmap: glass.bitmap,
    litBitmap: lit.bitmap,
    mesh,
    metrics: {
      glassCoveredPixels: glass.coveredPixelCount,
      outlineLitPixels: outline.litPixelCount,
      litPixelCount: lit.litPixelCount,
      highlightPeak: lit.highlightPeak,
    },
    deformVertexCount: mesh.vertices.length,
  };
}

function drawRasterToCanvas(canvas: HTMLCanvasElement | null, bitmap: RasterBitmap): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const copy = new Uint8ClampedArray(bitmap.data.length);
  copy.set(bitmap.data);
  const imgData = new ImageData(copy, bitmap.width, bitmap.height);
  ctx.putImageData(imgData, 0, 0);
}

function buildLiveSandboxSrcDoc(): string {
  const csp =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none';";
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    "</head>",
    "<body style='margin:0;padding:8px;font-family:sans-serif;background:#111722;color:#dbe4f0;font-size:12px;'>",
    "<div id='guest-badge'>Opaque Sandbox Widget</div>",
    "<script>",
    "function runSandboxProbe() {",
    "  var cookieValue = '';",
    "  var cookieBlocked = false;",
    "  try { cookieValue = document.cookie || ''; } catch (e) { cookieBlocked = true; }",
    "  var localStorageError = null;",
    "  try { window.localStorage.setItem('s4_probe', '1'); } catch (e) { localStorageError = String(e && e.name ? e.name + ': ' + e.message : e); }",
    "  var parentDocumentError = null;",
    "  try { void window.parent.document.title; } catch (e) { parentDocumentError = String(e && e.name ? e.name + ': ' + e.message : e); }",
    "  var parentOrigin = (window.location.ancestorOrigins && window.location.ancestorOrigins[0]) || (document.referrer ? new URL(document.referrer).origin : '');",
    "  if (parentOrigin) {",
    "    window.parent.postMessage({",
    "      type: 's4-sandbox-probe',",
    "      origin: String(window.origin),",
    "      cookieValue: cookieValue,",
    "      cookieBlocked: cookieBlocked,",
    "      localStorageError: localStorageError,",
    "      parentDocumentError: parentDocumentError",
    "    }, parentOrigin);",
    "  }",
    "}",
    // The page may not be listening yet when the frame starts, so the frame repeats the probe for a few seconds (the
    // page can't ask: an opaque-origin frame can only be addressed with targetOrigin "*", which the repo forbids).
    "runSandboxProbe();",
    "var probeRuns = 0;",
    "var probeTimer = setInterval(function () { runSandboxProbe(); if (++probeRuns >= 40) clearInterval(probeTimer); }, 100);",
    "</script>",
    "</body>",
    "</html>",
  ].join("\n");
}

export function InteractiveLab() {
  const busRef = useRef(newBusState());
  const magnetRef = useRef(createPointerPresetState());
  const followRef = useRef<FollowComponentState | null>(null);
  const cursorRef = useRef(
    createCursorOverlayController({
      preset: "blob",
      surfaceMode: "preview",
      hideNativeCursorOptIn: false,
      reducedMotion: false,
    }),
  );
  const gestureRef = useRef(createGestureRecognizer({ holdDurationSec: 0.4 }));
  const scrollerRef = useRef(
    createScrollerController({ itemCount: SLIDE_IDS.length, itemSpanPx: 140, loop: false, snap: true }),
  );
  const rovingRef = useRef(
    createRovingFocusGroup([...SLIDE_IDS], { orientation: "horizontal", loop: false, initialId: "slide-0" }),
  );
  const soundRef = useRef(
    createSoundAndHapticsEngine({
      triggerSynth: () => {},
      vibrate: () => true,
    }),
  );
  const smoothScrollRef = useRef(createSmoothScrollController({ maxScrollY: 1000 }));
  const scrubMediaRef = useRef(
    createScrollScrubMediaController(
      {
        id: "hero-seq",
        kind: "image_sequence",
        frameCount: 60,
        posterUrl: "/poster.webp",
        bytesPerDecodedFrame: 256 * 1024,
        pinStartPx: 0,
        pinEndPx: 1000,
      },
      "T2",
    ),
  );

  const stageRef = useRef<HTMLDivElement | null>(null);
  const glassCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lightsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const deformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const splitResult = useMemo(() => splitTextIntoRealLayers("headline-hero", "HELLO", "letters"), []);
  const sandboxSrcDoc = useMemo(() => buildLiveSandboxSrcDoc(), []);

  const [pointerCoords, setPointerCoords] = useState({ x: 320, y: 110, down: false });
  const [busMetrics, setBusMetrics] = useState({ frameCount: 0, speed: 0 });
  const [magnetPose, setMagnetPose] = useState({ x: 0, y: 0 });
  const [followPose, setFollowPose] = useState({ x: 0, y: 0 });
  const [cursorPose, setCursorPose] = useState({ x: 320, y: 110 });
  const [letterWeights, setLetterWeights] = useState<readonly number[]>(() => HERO_LETTERS.map(() => 400));

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [rovingFocusId, setRovingFocusId] = useState<string | null>("slide-0");

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [audioEventCount, setAudioEventCount] = useState(0);
  const [preUnlockEventBlocked, setPreUnlockEventBlocked] = useState(false);

  const [gpuScene, setGpuScene] = useState(() => computeGpuScene(80, 50, 0.35));
  const gpuMetrics = gpuScene.metrics;
  const deformVertexCount = gpuScene.deformVertexCount;

  const [scrollY, setScrollY] = useState(0);
  const [scrubFrameIndex, setScrubFrameIndex] = useState(0);
  const [peelProgress, setPeelProgress] = useState(0.35);
  const [sandboxProbe, setSandboxProbe] = useState<SandboxProbeMessage | null>(null);

  const renderGpuCanvases = useCallback((lightCursorX: number, lightCursorY: number, currentPeel: number) => {
    setGpuScene(computeGpuScene(lightCursorX, lightCursorY, currentPeel));
  }, []);

  useEffect(() => {
    drawRasterToCanvas(glassCanvasRef.current, gpuScene.glassBitmap);
    drawRasterToCanvas(lightsCanvasRef.current, gpuScene.litBitmap);
    const deformCanvas = deformCanvasRef.current;
    if (deformCanvas) {
      const ctx = deformCanvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, 160, 100);
        ctx.fillStyle = "#151c28";
        ctx.fillRect(0, 0, 160, 100);
        for (const v of gpuScene.mesh.vertices) {
          ctx.fillStyle = v.isBackface ? "#f59e0b" : "#60a5fa";
          ctx.fillRect(Math.round(v.x) - 1, Math.round(v.y) - 1, 3, 3);
        }
      }
    }
  }, [gpuScene]);

  useEffect(() => {
    const onWindowMessage = (ev: MessageEvent<unknown>) => {
      if (typeof ev.data !== "object" || ev.data === null) return;
      const payload = ev.data as Record<string, unknown>;
      if (payload.type !== "s4-sandbox-probe") return;
      setSandboxProbe({
        origin: String(payload.origin ?? ""),
        cookieValue: String(payload.cookieValue ?? ""),
        cookieBlocked: Boolean(payload.cookieBlocked),
        localStorageError: typeof payload.localStorageError === "string" ? payload.localStorageError : null,
        parentDocumentError: typeof payload.parentDocumentError === "string" ? payload.parentDocumentError : null,
      });
    };
    window.addEventListener("message", onWindowMessage);
    return () => {
      window.removeEventListener("message", onWindowMessage);
    };
  }, []);

  const stepPointerStage = useCallback((clientX: number, clientY: number, isDown: boolean) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const lx = Math.max(0, Math.min(640, clientX - rect.left));
    const ly = Math.max(0, Math.min(220, clientY - rect.top));
    const tSec = (busRef.current.frame + 1) / 60;

    const source: InputSource = {
      pointer: () => ({ x: lx, y: ly, down: isDown, coarse: false, pressure: isDown ? 0.8 : 0, type: "mouse" }),
      pageSize: () => ({ width: 640, height: 220 }),
      scroll: () => ({ y: 0, max: 1000, viewport: 220 }),
      layerRect: () => ({ x: 180, y: 60, width: 140, height: 80 }),
    };

    busFrame(source, busRef.current, tSec, 1 / 60, 132);

    const magnet = stepPointerPreset(
      {
        layer: { id: "magnet-card", centerX: 250, centerY: 110, width: 140, height: 80 },
        preset: "magnet",
        radiusPx: 260,
        strength: 0.45,
        lagSec: 0.06,
      },
      { time: tSec, dt: 1 / 60, pointerX: lx, pointerY: ly, pointerDown: isDown },
      magnetRef.current,
    );

    const follow = stepFollowComponent(
      {
        id: "follow-badge",
        layerId: "follower-badge",
        homeBox: { x: 80, y: 60, width: 48, height: 24 },
        target: { kind: "pointer" },
        pin: "bottom",
        bounce: 0.25,
        timeSec: 0.16,
      },
      followRef.current,
      { pointerX: lx, pointerY: ly, pointerActive: true, pointerType: "mouse" },
      1 / 60,
    );
    followRef.current = follow;

    const cursor = cursorRef.current.step(1 / 60, {
      x: lx,
      y: ly,
      vx: busRef.current.dx * 60,
      vy: busRef.current.dy * 60,
      pointerType: "mouse",
    });

    gestureRef.current.step({ time: tSec, down: isDown, x: lx, y: ly });

    const weights = evaluateVariableFontProximity(HERO_LETTERS, lx, ly, {
      radiusPx: 140,
      minWeight: 350,
      maxWeight: 850,
    }).map((s) => s.fontWeight);

    setPointerCoords({ x: Math.round(lx), y: Math.round(ly), down: isDown });
    setBusMetrics({ frameCount: busRef.current.frame, speed: Number(busRef.current.speed.toFixed(1)) });
    setMagnetPose({ x: Number(magnet.x.toFixed(2)), y: Number(magnet.y.toFixed(2)) });
    setFollowPose({ x: Number(follow.x.toFixed(2)), y: Number(follow.y.toFixed(2)) });
    setCursorPose({ x: Number(cursor.renderX.toFixed(1)), y: Number(cursor.renderY.toFixed(1)) });
    setLetterWeights(weights);
  }, []);

  const handleCarouselKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") {
      return;
    }
    e.preventDefault();
    const nextId = rovingRef.current.onKeyDown(e.key);
    let snap = scrollerRef.current.snapshot();
    if (e.key === "ArrowRight") {
      snap = scrollerRef.current.stepArrowKey(1);
    } else if (e.key === "ArrowLeft") {
      snap = scrollerRef.current.stepArrowKey(-1);
    } else {
      const targetIdx = e.key === "Home" ? 0 : SLIDE_IDS.length - 1;
      const dir = e.key === "Home" ? -1 : 1;
      for (let stepIdx = 0; stepIdx < SLIDE_IDS.length && snap.activeIndex !== targetIdx; stepIdx += 1) {
        snap = scrollerRef.current.stepArrowKey(dir);
        for (let frame = 0; frame < 40; frame += 1) {
          snap = scrollerRef.current.step(1 / 60);
        }
      }
    }
    for (let i = 0; i < 40; i += 1) {
      snap = scrollerRef.current.step(1 / 60);
    }
    const idx = nextId ? SLIDE_IDS.indexOf(nextId as (typeof SLIDE_IDS)[number]) : snap.activeIndex;
    setRovingFocusId(nextId);
    setActiveSlideIndex(idx >= 0 ? idx : snap.activeIndex);
  }, []);

  const handlePreUnlockAudio = useCallback(() => {
    const preEvt = soundRef.current.trigger("click", { frame: 1, timeSec: 0.016, signals: { dragSpeedNorm: 0.3 } });
    setPreUnlockEventBlocked(!soundRef.current.isUnlocked() && preEvt === null);
    setAudioUnlocked(soundRef.current.isUnlocked());
    setAudioEventCount(soundRef.current.getFiredEvents().length);
  }, []);

  const handleUnlockAndPlayAudio = useCallback(() => {
    soundRef.current.unlockAudioFromUserGesture();
    const evt = soundRef.current.trigger("chime", { frame: 2, timeSec: 0.033, signals: { dragSpeedNorm: 0.9 } });
    void evt;
    setAudioUnlocked(soundRef.current.isUnlocked());
    setAudioEventCount(soundRef.current.getFiredEvents().length);
  }, []);

  const handleScrollChange = useCallback((nextScrollY: number) => {
    smoothScrollRef.current.jumpToAnchor(nextScrollY);
    const scrub = scrubMediaRef.current.evaluateAtScroll(nextScrollY);
    setScrollY(nextScrollY);
    setScrubFrameIndex(scrub.frameIndex);
  }, []);

  const parallaxResult = useMemo(
    () =>
      evaluateDepthParallaxScene(
        PARALLAX_PLANES,
        { preset: "multi_plane_parallax", focalLengthPx: 1000, scrollRangePx: 1000 },
        {
          scrollProgress: scrollY / 1000,
          pointerNdcX: (pointerCoords.x - 320) / 320,
          pointerNdcY: (pointerCoords.y - 110) / 110,
        },
      ),
    [scrollY, pointerCoords.x, pointerCoords.y],
  );

  const currentSnapshot = useMemo<Stage4LabSnapshot>(
    () => ({
      pointerX: pointerCoords.x,
      pointerY: pointerCoords.y,
      busFrameCount: busMetrics.frameCount,
      busSpeed: busMetrics.speed,
      magnetX: magnetPose.x,
      magnetY: magnetPose.y,
      followX: followPose.x,
      followY: followPose.y,
      cursorRenderX: cursorPose.x,
      cursorRenderY: cursorPose.y,
      vfontMaxWeight: Math.max(...letterWeights),
      vfontMinWeight: Math.min(...letterWeights),
      activeSlideIndex,
      rovingFocusId,
      splitLetterCount: splitResult.pieces.length,
      audioUnlocked,
      audioEventCount,
      preUnlockEventBlocked,
      glassCoveredPixels: gpuMetrics.glassCoveredPixels,
      outlineLitPixels: gpuMetrics.outlineLitPixels,
      litPixelCount: gpuMetrics.litPixelCount,
      highlightPeak: gpuMetrics.highlightPeak,
      scrollY,
      scrubFrameIndex,
      peelProgress,
      deformVertexCount,
      sandboxProbe,
    }),
    [
      pointerCoords.x,
      pointerCoords.y,
      busMetrics.frameCount,
      busMetrics.speed,
      magnetPose.x,
      magnetPose.y,
      followPose.x,
      followPose.y,
      cursorPose.x,
      cursorPose.y,
      letterWeights,
      activeSlideIndex,
      rovingFocusId,
      splitResult.pieces.length,
      audioUnlocked,
      audioEventCount,
      preUnlockEventBlocked,
      gpuMetrics.glassCoveredPixels,
      gpuMetrics.outlineLitPixels,
      gpuMetrics.litPixelCount,
      gpuMetrics.highlightPeak,
      scrollY,
      scrubFrameIndex,
      peelProgress,
      deformVertexCount,
      sandboxProbe,
    ],
  );

  const snapshotRef = useRef<Stage4LabSnapshot>(currentSnapshot);
  useEffect(() => {
    snapshotRef.current = currentSnapshot;
  }, [currentSnapshot]);

  useEffect(() => {
    window.__LL_STAGE4_LAB__ = {
      getSnapshot: () => snapshotRef.current!,
      runGateJourneys: () => ({
        a: runStage4JourneyA(),
        b: runStage4JourneyB(),
        c: runStage4JourneyC(),
        d: runStage4JourneyD(),
        e: runStage4JourneyE(),
      }),
      runCompositionSuite: () => runFullCompositionSuite(),
      runPhysicsAndFractureCheck: () => {
        const world = createPhysicsWorld2D([
          {
            id: "floor",
            kind: "static",
            shape: { kind: "box", halfWidth: 200, halfHeight: 16 },
            x: 150,
            y: 260,
            vx: 0,
            vy: 0,
            angleRad: 0,
            angularVel: 0,
            mass: 0,
            restitution: 0.4,
            friction: 0.5,
            linearDamping: 0,
            angularDamping: 0,
          },
          {
            id: "ball",
            kind: "dynamic",
            shape: { kind: "circle", radius: 14 },
            x: 150,
            y: 40,
            vx: 0,
            vy: 0,
            angleRad: 0,
            angularVel: 0,
            mass: 1,
            restitution: 0.6,
            friction: 0.2,
            linearDamping: 0.02,
            angularDamping: 0.02,
          },
        ]);
        const initialY = world.getBodies().find((b) => b.id === "ball")?.y ?? 0;
        for (let i = 0; i < 30; i += 1) {
          world.stepFixedSubstep();
        }
        const afterY = world.getBodies().find((b) => b.id === "ball")?.y ?? 0;

        const spawnerT0 = createEphemeralSpawner({ tier: "T0", seed: 11 });
        spawnerT0.spawnBurst(
          { kind: "point", x: 100, y: 100 },
          {
            templateLayerId: "spark",
            count: 30,
            speedMinPxPerSec: 40,
            speedMaxPxPerSec: 120,
            angleCenterDeg: -90,
            spreadDeg: 60,
            spinDegPerSec: 90,
            variety: 0.4,
            lifetimeSec: 2,
            exitFadeSec: 0.3,
          },
          0,
        );
        const spawnerT2 = createEphemeralSpawner({ tier: "T2", seed: 11 });
        spawnerT2.spawnBurst(
          { kind: "point", x: 100, y: 100 },
          {
            templateLayerId: "spark",
            count: 200,
            speedMinPxPerSec: 40,
            speedMaxPxPerSec: 120,
            angleCenterDeg: -90,
            spreadDeg: 60,
            spinDegPerSec: 90,
            variety: 0.4,
            lifetimeSec: 2,
            exitFadeSec: 0.3,
          },
          0,
        );
        const docFiltered = filterNonEphemeralDocumentLayers([
          { id: "hero-bg", isEphemeral: false },
          ...spawnerT0.getActiveInstances().map((s) => ({ id: s.poolId, isEphemeral: s.isEphemeral })),
        ]);

        const vor = generateFracturePieces({ kind: "voronoi", width: 120, height: 80, pieceCount: 8, seed: 42 });
        const strips = generateFracturePieces({ kind: "strips", width: 120, height: 80, pieceCount: 5 });
        const grid = generateFracturePieces({ kind: "grid", width: 120, height: 80, cols: 3, rows: 2 });
        const tear = generateFracturePieces({ kind: "tear_line", width: 120, height: 80 });

        for (let i = 0; i < 15; i += 1) {
          stepFracturePieces(vor, { dtSec: 1 / 60, gravityY: 400 });
        }
        for (let i = 0; i < 180; i += 1) {
          stepFracturePieces(vor, { dtSec: 1 / 60, reassemble: true, springStiffness: 65, damping: 14 });
        }
        const reassemblyErrorPx = vor.reduce(
          (maxE, p) => Math.max(maxE, Math.hypot(p.x - p.homeCentroidX, p.y - p.homeCentroidY)),
          0,
        );

        return {
          physicsSteps: world.getStepIndex(),
          ballMovedY: Number((afterY - initialY).toFixed(2)),
          t0Cap: spawnerT0.getActiveInstances().length,
          t2Cap: spawnerT2.getActiveInstances().length,
          filteredLayerCount: docFiltered.length,
          voronoiExact: verifyTilingCoverage(generateFracturePieces({ kind: "voronoi", width: 120, height: 80, pieceCount: 8, seed: 42 }), 120, 80).exactTiling,
          stripsExact: verifyTilingCoverage(strips, 120, 80).exactTiling,
          gridExact: verifyTilingCoverage(grid, 120, 80).exactTiling,
          tearExact: verifyTilingCoverage(tear, 120, 80).exactTiling,
          reassemblyErrorPx: Number(reassemblyErrorPx.toFixed(3)),
        };
      },
      runGpuAndShaderCheck: () => {
        const cleanGlsl = [
          "#version 300 es",
          "precision highp float;",
          "uniform float u_strength;",
          "uniform vec2 u_offset;",
          "void main() {",
          "  for (int i = 0; i < 8; i++) {}",
          "}",
        ].join("\n");
        const badGlsl = [
          "#version 300 es",
          "void main() {",
          "  while (true) {}",
          "}",
        ].join("\n");
        const cleanReport = validateRawGlslSafety(cleanGlsl);
        const badReport = validateRawGlslSafety(badGlsl);
        const extracted = extractUniformProps(cleanGlsl);

        const compiled = compileShaderGraph({
          id: "lab-shader",
          name: "LabShader",
          nodes: [
            { id: "n1", kind: "uv" },
            { id: "n2", kind: "simplexNoise" },
            { id: "n3", kind: "colorRamp" },
            { id: "out", kind: "outputColor" },
          ],
          edges: [
            { fromNodeId: "n1", fromPin: "uv", toNodeId: "n2", toPin: "uv", pinType: "vec2" },
            { fromNodeId: "n2", fromPin: "val", toNodeId: "n3", toPin: "t", pinType: "float" },
            { fromNodeId: "n3", fromPin: "col", toNodeId: "out", toPin: "color", pinType: "color" },
          ],
        });

        const simT0 = createStatefulSimulation({
          kind: "stable_fluid",
          gridWidth: 32,
          gridHeight: 24,
          tier: "T0",
          seed: 77,
          splatTape: [{ timeSec: 0.1, xNorm: 0.5, yNorm: 0.5, vxNorm: 0.8, vyNorm: -0.2 }],
        });
        simT0.advanceTo(0.8);
        const hashForward = simT0.getStateHash();
        const seekRes = simT0.seekToTime(0.8);

        const budgetAudit = auditFullLibraryTierBudgets(FULL_EFFECT_LIBRARY);

        return {
          safeGlslOk: cleanReport.ok,
          safeUniformCount: extracted.length,
          unsafeWhileRejected: !badReport.ok,
          shaderGraphHasUniforms:
            compiled.uniformsContract.includes("uTime") && compiled.glslEs300.includes("#version 300 es"),
          simResolutionT0: `${simT0.resolution.cols}x${simT0.resolution.rows}`,
          simSeekHashParity: seekRes.stateHash === hashForward,
          libraryTotalEffects: budgetAudit.totalEffects,
          libraryPassingAllTiers: budgetAudit.passingAllTiers,
          lowTierSoaksPassed: budgetAudit.lowTierSoakPassed,
        };
      },
      runNodeScriptAndRulesCheck: () => {
        const bp = compileSimpleRuleToBlueprint({
          id: "hover-glow",
          event: "hovered",
          subjectLayerId: "cta",
          actions: [{ kind: "glow", targetLayerId: "cta" }],
          feel: "snappy",
          intensity: "medium",
          enabled: true,
        });
        const rt = roundTripGraphViaNodeScript(bp);
        const tape = autopilotUv(9, 0.5);
        const dist = distanceToRect({ x: 100, y: 100, width: 80, height: 40 }, 190, 120, "edge");

        const imported = importCodeComponent({
          id: "badge-widget",
          componentName: "BadgeWidget",
          source: [
            "interface BadgeWidgetProps {",
            "  /** @min 0 @max 100 */",
            "  strength?: number;",
            "  accentColor?: string;",
            "  onHoverEnd?: () => void;",
            "}",
          ].join("\n"),
          license: "AGPL-3.0",
          dependencies: [{ name: "nano-spring", version: "1.0.2" }],
          bindings: { strength: { source: "signal", path: "pointer.speed" } },
        });
        const descriptor = buildSandboxIframeDescriptor("badge-widget");
        const maliciousReport = inspectUntrustedBundleIsolation(
          "const x = document.cookie; localStorage.getItem('token'); parent.document.title;",
        );
        const effect = FULL_EFFECT_LIBRARY[0]!;
        const bundle = buildInteractiveExportBundle(effect, "next");
        const embed = buildFrameworkFreeEmbedSnippet(effect, { platform: "html", cspNonce: "abc123" });
        const a11yBad = auditInteractiveAccessibility({
          effect,
          durationSec: 12,
          isEssentialMotion: false,
          hasPauseControl: false,
          hidesNativeCursorOverInput: true,
          targetDriftDuringHoverPx: 8,
          focusIndicatorSuppressed: true,
        });

        return {
          compiledNodes: Object.keys(bp.nodes).length,
          nlsRoundTripMatches:
            rt.nlsSource.length > 0 && Object.keys(rt.reparsed.nodes).length === Object.keys(bp.nodes).length,
          tapeChecksum: Number((tape[0] + tape[1]).toFixed(4)),
          distToEdge: dist,
          importedControls: imported.controls.length,
          restrictedKeepPrivate: imported.licenseStatus.keepPrivate,
          sandboxIsolationOk:
            !descriptor.allowsSameOrigin &&
            maliciousReport.flaggedApis.length === 3 &&
            maliciousReport.localStorageResult !== null,
          exportZeroLazyImports: bundle.zeroLazyLayoutImports && bundle.disposesContextsOnUnmount,
          embedExpectedCls: embed.audit.expectedCls,
          a11yDiagnosticsDetected: a11yBad.length,
        };
      },
    };
    return () => {
      delete window.__LL_STAGE4_LAB__;
    };
  }, []);

  const panelStyle: React.CSSProperties = {
    border: "1px solid var(--ll-border, #2a3344)",
    background: "var(--ll-surface, #151a24)",
    padding: "12px",
    borderRadius: "6px",
  };

  return (
    <div
      data-testid="s4-lab-root"
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
          <h1 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Stage 4 Interactive E2E Lab (Phases 132–202)</h1>
          <p style={{ fontSize: "12px", color: "var(--ll-muted, #9aa4b2)", margin: "4px 0 0" }}>
            Live browser harness for signal bus, layout-isolated reactions, keyboard parity, Web Audio unlock, GPU canvases, parallax & opaque sandbox.
          </p>
        </div>
        <button
          data-testid="s4-cta-btn"
          type="button"
          style={{
            padding: "8px 14px",
            background: "var(--ll-accent, #3b82f6)",
            color: "#ffffff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Accessible Action
        </button>
      </header>

      {/* Row 1: Pointer Stage + Adjacent Layout-Isolation Neighbor */}
      <section style={{ ...panelStyle, display: "flex", gap: "16px", alignItems: "flex-start" }}>
        <div
          ref={stageRef}
          data-testid="s4-pointer-stage"
          onPointerDown={(e) => stepPointerStage(e.clientX, e.clientY, true)}
          onPointerMove={(e) => stepPointerStage(e.clientX, e.clientY, pointerCoords.down)}
          onPointerUp={(e) => stepPointerStage(e.clientX, e.clientY, false)}
          style={{
            position: "relative",
            width: "640px",
            height: "220px",
            flexShrink: 0,
            overflow: "hidden",
            contain: "layout style",
            border: "1px solid #334155",
            background: "#0f172a",
            borderRadius: "4px",
          }}
        >
          <div
            data-testid="s4-magnet-card"
            style={{
              position: "absolute",
              left: "180px",
              top: "70px",
              width: "140px",
              height: "80px",
              background: "#1e293b",
              border: "1px solid #475569",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translate3d(${magnetPose.x}px, ${magnetPose.y}px, 0)`,
              willChange: "transform",
            }}
          >
            Magnet Card
          </div>

          <div
            data-testid="s4-vfont-word"
            style={{
              position: "absolute",
              left: "140px",
              top: "14px",
              display: "flex",
              gap: "12px",
              pointerEvents: "none",
            }}
          >
            {HERO_LETTERS.map((item, idx) => (
              <span
                key={item.id}
                style={{
                  display: "inline-block",
                  width: "30px",
                  textAlign: "center",
                  fontSize: "20px",
                  fontWeight: letterWeights[idx] ?? 400,
                }}
              >
                {item.char}
              </span>
            ))}
          </div>

          <div
            data-testid="s4-follower-badge"
            style={{
              position: "absolute",
              left: "80px",
              top: "60px",
              width: "48px",
              height: "24px",
              background: "#2563eb",
              color: "#fff",
              fontSize: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              transform: `translate3d(${followPose.x}px, ${followPose.y}px, 0)`,
              pointerEvents: "none",
            }}
          >
            Pin
          </div>

          <div
            data-testid="s4-cursor-dot"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "14px",
              height: "14px",
              borderRadius: "7px",
              border: "2px solid #38bdf8",
              transform: `translate3d(${cursorPose.x - 7}px, ${cursorPose.y - 7}px, 0)`,
              pointerEvents: "none",
            }}
          />

          <div
            data-testid="s4-pointer-readout"
            style={{ position: "absolute", left: "10px", bottom: "8px", fontSize: "11px", color: "#94a3b8" }}
          >
            frames={busMetrics.frameCount} speed={busMetrics.speed} magnet=({magnetPose.x},{magnetPose.y}) maxW={Math.max(...letterWeights)}
          </div>
        </div>

        <div
          data-testid="s4-neighbor-box"
          style={{
            width: "220px",
            height: "220px",
            padding: "12px",
            border: "1px solid #334155",
            background: "#111827",
            borderRadius: "4px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600 }}>Neighbor Layout Guard</div>
          <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
            Adjacent flow sibling must experience 0 px layout drift while pointer effects animate inside the isolated stage.
          </p>
          <input
            data-testid="s4-text-input"
            type="text"
            defaultValue="Native cursor intact"
            aria-label="Native cursor safeguard test input"
            style={{
              marginTop: "12px",
              width: "100%",
              padding: "6px 8px",
              background: "#0b1120",
              color: "#f8fafc",
              border: "1px solid #475569",
              borderRadius: "4px",
            }}
          />
        </div>
      </section>

      {/* Row 2: Keyboard Carousel + Split Text + Audio Gesture Unlock */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
        <div
          data-testid="s4-carousel"
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label="Stage 4 Keyboard Carousel"
          onKeyDown={handleCarouselKeyDown}
          style={{ ...panelStyle, outlineOffset: "2px" }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Keyboard Roving Carousel</div>
          <div style={{ display: "flex", gap: "6px" }}>
            {SLIDE_IDS.map((id, idx) => (
              <div
                key={id}
                role="group"
                tabIndex={rovingFocusId === id ? 0 : -1}
                data-slide-id={id}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  textAlign: "center",
                  fontSize: "11px",
                  border: idx === activeSlideIndex ? "1px solid #3b82f6" : "1px solid #334155",
                  background: idx === activeSlideIndex ? "#1d4ed8" : "#0f172a",
                  borderRadius: "4px",
                }}
              >
                {idx}
              </div>
            ))}
          </div>
          <div data-testid="s4-carousel-active" style={{ marginTop: "8px", fontSize: "12px", color: "#cbd5e1" }}>
            slide={activeSlideIndex} roving={rovingFocusId}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Real Split Letters & A11y</div>
          <div data-testid="s4-split-parent" aria-label="HELLO" style={{ display: "flex", gap: "6px", fontSize: "20px", fontWeight: 700 }}>
            {splitResult.pieces.map((letter) => (
              <span
                key={letter.id}
                data-testid="s4-split-letter"
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  padding: "4px 8px",
                  border: "1px solid #334155",
                  borderRadius: "4px",
                }}
              >
                {letter.text}
              </span>
            ))}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Sound & Gesture Unlock</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              data-testid="s4-audio-pretest"
              type="button"
              onClick={handlePreUnlockAudio}
              style={{ padding: "6px 10px", background: "#334155", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
            >
              Pre-Unlock Trigger
            </button>
            <button
              data-testid="s4-sfx-trigger"
              type="button"
              onClick={handleUnlockAndPlayAudio}
              style={{ padding: "6px 10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
            >
              Unlock & Play SFX
            </button>
          </div>
          <div data-testid="s4-audio-status" style={{ marginTop: "8px", fontSize: "12px" }}>
            {audioUnlocked ? "unlocked" : "locked"} | blockedBeforeGesture={String(preUnlockEventBlocked)}
          </div>
          <div data-testid="s4-audio-events" style={{ fontSize: "12px", color: "#94a3b8" }}>
            events={audioEventCount}
          </div>
        </div>
      </section>

      {/* Row 3: Live GPU Canvases (Liquid Glass + Lights2D + Deformation) */}
      <section style={{ ...panelStyle, display: "grid", gridTemplateColumns: "auto auto auto 1fr", gap: "16px", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "11px", marginBottom: "4px" }}>Liquid Glass + Electric SDF</div>
          <canvas data-testid="s4-liquid-glass-canvas" ref={glassCanvasRef} width={160} height={100} style={{ border: "1px solid #334155" }} />
        </div>
        <div>
          <div style={{ fontSize: "11px", marginBottom: "4px" }}>2D Point + Spot Lights</div>
          <canvas
            data-testid="s4-lights2d-canvas"
            ref={lightsCanvasRef}
            width={160}
            height={100}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              renderGpuCanvases(e.clientX - r.left, e.clientY - r.top, peelProgress);
            }}
            style={{ border: "1px solid #334155" }}
          />
        </div>
        <div>
          <div style={{ fontSize: "11px", marginBottom: "4px" }}>Sticker Peel Mesh</div>
          <canvas data-testid="s4-deform-canvas" ref={deformCanvasRef} width={160} height={100} style={{ border: "1px solid #334155" }} />
          <input
            data-testid="s4-peel-slider"
            type="range"
            min={0}
            max={100}
            value={Math.round(peelProgress * 100)}
            onChange={(e) => {
              const p = Number(e.target.value) / 100;
              setPeelProgress(p);
              renderGpuCanvases(80, 50, p);
            }}
            style={{ width: "160px", display: "block", marginTop: "4px" }}
          />
        </div>
        <div data-testid="s4-gpu-metrics" style={{ fontSize: "12px", color: "#cbd5e1" }}>
          <div>glassCovered={gpuMetrics.glassCoveredPixels}</div>
          <div>outlineLit={gpuMetrics.outlineLitPixels}</div>
          <div>lightsLit={gpuMetrics.litPixelCount} peak={gpuMetrics.highlightPeak}</div>
          <div>deformVertices={deformVertexCount}</div>
        </div>
      </section>

      {/* Row 4: Multi-Plane Parallax + Opaque-Origin Code Component Sandbox */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>5-Plane Perspective Depth Parallax + Scrubbed Media</span>
            <span data-testid="s4-scrub-frame" style={{ fontSize: "12px", color: "#93c5fd" }}>
              scroll={scrollY}px frame={scrubFrameIndex}
            </span>
          </div>
          <input
            data-testid="s4-scroll-input"
            type="range"
            min={0}
            max={1000}
            value={scrollY}
            onChange={(e) => handleScrollChange(Number(e.target.value))}
            style={{ width: "100%", marginBottom: "10px" }}
          />
          <div style={{ position: "relative", height: "80px", overflow: "hidden", border: "1px solid #334155", background: "#0b1120" }}>
            {parallaxResult.planes.map((plane) => (
              <div
                key={plane.id}
                data-testid="s4-parallax-plane"
                data-plane-id={plane.id}
                style={{
                  position: "absolute",
                  left: "20px",
                  top: "24px",
                  padding: "4px 8px",
                  fontSize: "10px",
                  border: "1px solid #475569",
                  background: "rgba(30, 41, 59, 0.85)",
                  transform: plane.cssTransform3d,
                }}
              >
                {plane.id} (z={plane.depthZPx})
              </div>
            ))}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>
            Opaque-Origin Sandbox Isolation (&lt;iframe sandbox=&quot;allow-scripts&quot;&gt;)
          </div>
          <iframe
            data-testid="s4-sandbox-iframe"
            title="Stage 4 Opaque Origin Sandbox Probe"
            sandbox="allow-scripts"
            srcDoc={sandboxSrcDoc}
            style={{ width: "100%", height: "46px", border: "1px solid #334155", borderRadius: "4px" }}
          />
          <div data-testid="s4-sandbox-status" style={{ marginTop: "6px", fontSize: "11px", color: "#cbd5e1", wordBreak: "break-word" }}>
            {sandboxProbe ? JSON.stringify(sandboxProbe) : "waiting-for-sandbox-probe"}
          </div>
        </div>
      </section>
    </div>
  );
}
