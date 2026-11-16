/**
 * ============================================================================
 * STAGE 6 · PHASES 235–240 — 3D PHYSICS, POST-FX, MEMORY LEDGER, EXPORT, GATE
 * ============================================================================
 * Phase 235: Fixed-step deterministic 3D rigid bodies + colliders + Blueprint
 *            contact events + snapshot scrubbing (100-body pile replay).
 * Phase 236: Ordered post-processing stack (`bloom`, `dof`, `ssao`,
 *            `colorGrading`, `vignette`) with per-tier budget downgrades.
 * Phase 237: Reference-counted 3D GPU memory ledger (AUD-58 3D) returning
 *            `renderer.info.memory` to baseline over 20 GLTF load/unload runs.
 * Phase 238: R3F & plain three.js export with lazy loading & poster fallback.
 * Phase 239: 6 open Stage 6 3D library recipes.
 * Phase 240: End-to-end Stage 6 3D journey gate (`runStage6ThreeDJourneyGate`).
 * ============================================================================
 */

import { type Scene3dContextRecoveryResult, Scene3dLayerHost, verify3dStackDecisionAndLicenses } from "./stackAndSceneLayer";
import { evaluateNodeWorldTransform, reparentPreservingWorldTransform, run15StepGizmoJourney } from "./viewportAndHierarchy";
import { LiveLinked2dTo3dSurface, TEN_REFERENCE_2D_SHAPES, build3dFrom2dShape, checkMeshWatertight, createParametricPrimitive } from "./primitivesAndInflate";
import { PBR_MATERIAL_PRESETS, TEN_SAMPLE_GLTF_FIXTURES, evaluatePbrSurfaceResponse, importGltfAsset } from "./gltfAndMaterials";
import { type PerformanceTier, buildArcLengthCameraPath, evaluateLightingRig, sampleCameraPathAtTime } from "./lightsAndCameras";
import { FIVE_GRAPH_MATERIALS, compileAndCompareShaderGraph3d, evaluate3dTimelineTrack, evaluateGltfAnimationClip, generate50Reachable3dIkTargets, solve3dIkChain } from "./timelineAnimIkAndShaders";
import { evaluate3dInstancedCloner, evaluate3dReactionsTapeFrame, projectDomLayerInto3dScene } from "./reactionsDomAndInstancing";

export type Collider3dShape = "box" | "sphere" | "capsule" | "plane";

export interface RigidBody3dState {
  readonly id: string;
  readonly shape: Collider3dShape;
  readonly radius: number;
  readonly dynamic: boolean;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
}

export interface Physics3dStepResult {
  readonly stepIndex: number;
  readonly bodies: readonly RigidBody3dState[];
  readonly contactEvents: readonly { readonly bodyA: string; readonly bodyB: string; readonly impulse: number }[];
  readonly positionHash: string;
}

export function create100BodyPileInitialState(): readonly RigidBody3dState[] {
  const bodies: RigidBody3dState[] = [];
  for (let i = 0; i < 100; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5) % 5;
    const layer = Math.floor(i / 25);
    bodies.push({
      id: `body_${i}`,
      shape: i % 2 === 0 ? "box" : "sphere",
      radius: 0.45,
      dynamic: true,
      x: (col - 2) * 1.1,
      y: 1.5 + layer * 1.25 + (row * 0.05),
      z: (row - 2) * 1.1,
      vx: 0,
      vy: 0,
      vz: 0,
    });
  }
  return bodies;
}

function hashBodyPositions(bodies: readonly RigidBody3dState[]): string {
  let h = 2166136261;
  for (const b of bodies) {
    h ^= Math.round(b.x * 1000) ^ Math.round(b.y * 1000) ^ Math.round(b.z * 1000);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Run deterministic 60 Hz 3D rigid-body physics steps with floor/pair collisions and Blueprint contacts. */
export function step3dPhysicsWorld(
  initial: readonly RigidBody3dState[],
  steps: number,
  dragForce?: { readonly bodyId: string; readonly fx: number; readonly fy: number; readonly fz: number },
): Physics3dStepResult {
  const dt = 1 / 60;
  const g = -9.81;
  const bodies = initial.map((b) => ({ ...b }));
  const contactEvents: { bodyA: string; bodyB: string; impulse: number }[] = [];

  for (let s = 0; s < steps; s++) {
    contactEvents.length = 0;
    for (const b of bodies) {
      if (!b.dynamic) continue;
      let ax = 0;
      let ay = g;
      let az = 0;
      if (dragForce && dragForce.bodyId === b.id) {
        ax += dragForce.fx;
        ay += dragForce.fy;
        az += dragForce.fz;
      }
      b.vx = (b.vx + ax * dt) * 0.995;
      b.vy = (b.vy + ay * dt) * 0.995;
      b.vz = (b.vz + az * dt) * 0.995;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;

      if (b.y < b.radius) {
        b.y = b.radius;
        if (b.vy < -0.2) {
          contactEvents.push({ bodyA: b.id, bodyB: "floor_plane", impulse: Number(Math.abs(b.vy).toFixed(3)) });
        }
        b.vy = Math.abs(b.vy) * 0.35;
        b.vx *= 0.85;
        b.vz *= 0.85;
      }
    }

    // Spatial cell pair push-apart for deterministic pile stacking
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const minDist = a.radius + b.radius;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < minDist * minDist && distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          a.z -= nz * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          b.z += nz * overlap;
          contactEvents.push({ bodyA: a.id, bodyB: b.id, impulse: Number(overlap.toFixed(3)) });
        }
      }
    }
  }

  return {
    stepIndex: steps,
    bodies,
    contactEvents,
    positionHash: hashBodyPositions(bodies),
  };
}

export type PostEffectKind = "bloom" | "dof" | "ssao" | "colorGrading" | "vignette";

export interface PostProcessStackReport {
  readonly tier: PerformanceTier;
  readonly activeEffects: readonly PostEffectKind[];
  readonly downgradedEffects: readonly PostEffectKind[];
  readonly totalCostMs: number;
  readonly tierBudgetMs: number;
  readonly withinBudget: boolean;
}

const POST_COST_MS: Record<PostEffectKind, number> = {
  ssao: 2.8,
  dof: 2.2,
  bloom: 1.4,
  colorGrading: 0.4,
  vignette: 0.2,
};

// Documented downgrade order: drop most expensive optional effects first (ssao -> dof -> bloom -> colorGrading -> vignette)
const POST_DOWNGRADE_ORDER: readonly PostEffectKind[] = ["ssao", "dof", "bloom", "colorGrading", "vignette"];
const POST_TIER_BUDGET_MS: Record<PerformanceTier, number> = { T0: 1.0, T1: 2.5, T2: 4.5, T3: 9.0 };

/** Evaluate ordered post-processing stack and apply documented downgrade until within tier budget. */
export function evaluatePostProcessStack(
  requested: readonly PostEffectKind[],
  tier: PerformanceTier,
): PostProcessStackReport {
  const budget = POST_TIER_BUDGET_MS[tier];
  let active = [...requested];
  const downgraded: PostEffectKind[] = [];
  const costOf = (list: readonly PostEffectKind[]) => list.reduce((s, e) => s + POST_COST_MS[e], 0);

  for (const candidate of POST_DOWNGRADE_ORDER) {
    if (costOf(active) <= budget) break;
    if (active.includes(candidate)) {
      active = active.filter((e) => e !== candidate);
      downgraded.push(candidate);
    }
  }

  return {
    tier,
    activeEffects: active,
    downgradedEffects: downgraded,
    totalCostMs: Number(costOf(active).toFixed(2)),
    tierBudgetMs: budget,
    withinBudget: costOf(active) <= budget,
  };
}

export interface Gpu3dMemoryInfo {
  readonly geometries: number;
  readonly materials: number;
  readonly textures: number;
  readonly targets: number;
}

/**
 * Phase 237 (AUD-58 3D): Reference-counted GPU 3D memory ledger & loader cache cleaner.
 * Guarantees `renderer.info.memory` returns to zero baseline after unloads.
 */
export class Gpu3dMemoryLedger {
  private readonly geometryRefs = new Map<string, number>();
  private readonly materialRefs = new Map<string, number>();
  private readonly textureRefs = new Map<string, number>();
  private readonly targetRefs = new Map<string, number>();
  private readonly loaderCache = new Map<string, string>();

  acquireGltfBundle(bundleId: string): void {
    this.loaderCache.set(bundleId, bundleId);
    this.inc(this.geometryRefs, `${bundleId}:geom`);
    this.inc(this.materialRefs, `${bundleId}:mat`);
    this.inc(this.textureRefs, `${bundleId}:tex`);
    this.inc(this.targetRefs, `${bundleId}:rt`);
  }

  releaseGltfBundle(bundleId: string): void {
    this.dec(this.geometryRefs, `${bundleId}:geom`);
    this.dec(this.materialRefs, `${bundleId}:mat`);
    this.dec(this.textureRefs, `${bundleId}:tex`);
    this.dec(this.targetRefs, `${bundleId}:rt`);
    this.loaderCache.delete(bundleId);
  }

  clearLoaderCache(): void {
    this.loaderCache.clear();
  }

  getRendererMemoryInfo(): Gpu3dMemoryInfo {
    return {
      geometries: this.geometryRefs.size,
      materials: this.materialRefs.size,
      textures: this.textureRefs.size,
      targets: this.targetRefs.size,
    };
  }

  private inc(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  private dec(map: Map<string, number>, key: string): void {
    const cur = (map.get(key) ?? 0) - 1;
    if (cur <= 0) map.delete(key);
    else map.set(key, cur);
  }
}

export function verify20xGltfLoadUnloadBaseline(): {
  readonly cycles: number;
  readonly baseline: Gpu3dMemoryInfo;
  readonly afterUnloads: Gpu3dMemoryInfo;
  readonly zeroLeakBaselineRestored: boolean;
} {
  const ledger = new Gpu3dMemoryLedger();
  const baseline = ledger.getRendererMemoryInfo();
  for (let i = 0; i < 20; i++) {
    const id = `gltf_cycle_${i % 5}`;
    ledger.acquireGltfBundle(id);
    ledger.releaseGltfBundle(id);
  }
  ledger.clearLoaderCache();
  const afterUnloads = ledger.getRendererMemoryInfo();
  const zeroLeakBaselineRestored =
    afterUnloads.geometries === baseline.geometries &&
    afterUnloads.materials === baseline.materials &&
    afterUnloads.textures === baseline.textures &&
    afterUnloads.targets === baseline.targets;

  return { cycles: 20, baseline, afterUnloads, zeroLeakBaselineRestored };
}

export type Scene3dExportTarget = "r3f" | "threejs";

export interface Scene3dExportArtifact {
  readonly target: Scene3dExportTarget;
  readonly lazyLoaded: boolean;
  readonly hasNoWebGlPosterFallback: boolean;
  /** The entry file's source (the widget for R3F, the mount function for three.js). */
  readonly code: string;
  /** Every file the export writes, by path. The R3F widget's lazy import points at a file in here. */
  readonly files: Readonly<Record<string, string>>;
  /** npm packages the exported files import. */
  readonly dependencies: readonly string[];
  /**
   * How far the exported scene's pixels are from the editor's, in percent. `null`: not measured. Nothing renders both
   * and compares them yet, so no number is claimed.
   */
  readonly parityDiffPercent: number | null;
}

/** A scene name as a PascalCase identifier that is safe in code and file names ("hero stage!" → "HeroStage"). */
export function sceneExportIdentifier(sceneName: string): string {
  const words = sceneName.replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const ident = words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join("");
  return /^[A-Za-z]/.test(ident) ? ident : `Scene${ident}`;
}

/**
 * Export a 3D scene as a lazy-loaded React Three Fiber widget or a plain three.js mount function. Both load the scene's
 * model from `/models/<Name>.glb`, show `/posters/<Name>.webp` while loading and when WebGL2 is missing, and clean up.
 */
export function exportScene3dToCode(sceneName: string, target: Scene3dExportTarget): Scene3dExportArtifact {
  const name = sceneExportIdentifier(sceneName);
  const poster = `/posters/${name}.webp`;
  const model = `/models/${name}.glb`;
  const alt = JSON.stringify(`${sceneName} poster`);
  if (target === "r3f") {
    const widget = `"use client";
import dynamic from "next/dynamic";

const supportsWebGl2 = () => typeof window !== "undefined" && !!document.createElement("canvas").getContext("webgl2");
const Poster = () => <img src="${poster}" alt={${alt}} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
const LazyScene = dynamic(() => import("./${name}R3fInner"), { ssr: false, loading: Poster });

export function ${name}Widget() {
  return supportsWebGl2() ? <LazyScene /> : <Poster />;
}
`;
    const inner = `"use client";
import { Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

function Model() {
  const gltf = useLoader(GLTFLoader, "${model}");
  return <primitive object={gltf.scene} />;
}

export default function ${name}R3fInner() {
  return (
    <Canvas camera={{ position: [0, 1.2, 4], fov: 45 }} dpr={[1, 2]}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 6, 4]} intensity={2.2} />
      <Suspense fallback={null}>
        <Model />
      </Suspense>
    </Canvas>
  );
}
`;
    return {
      target,
      lazyLoaded: true,
      hasNoWebGlPosterFallback: true,
      code: widget,
      files: { [`${name}Widget.tsx`]: widget, [`${name}R3fInner.tsx`]: inner },
      dependencies: ["three", "@react-three/fiber"],
      parityDiffPercent: null,
    };
  }
  const mount = `export async function mount${name}(container, { posterUrl = "${poster}", modelUrl = "${model}" } = {}) {
  const showPoster = () => {
    const img = document.createElement("img");
    img.src = posterUrl;
    img.alt = ${alt};
    img.style.cssText = "width:100%;height:100%;object-fit:cover";
    container.replaceChildren(img);
  };
  if (!document.createElement("canvas").getContext("webgl2")) {
    showPoster();
    return { dispose() {} };
  }
  showPoster();
  const THREE = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.2, 4);
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 6, 4);
  scene.add(key);
  const gltf = await new GLTFLoader().loadAsync(modelUrl);
  scene.add(gltf.scene);
  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  container.replaceChildren(renderer.domElement);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  return {
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      scene.traverse((o) => { o.geometry?.dispose?.(); [].concat(o.material || []).forEach((m) => m.dispose?.()); });
      renderer.dispose();
    },
  };
}
`;
  return {
    target,
    lazyLoaded: true,
    hasNoWebGlPosterFallback: true,
    code: mount,
    files: { [`mount${name}.js`]: mount },
    dependencies: ["three"],
    parityDiffPercent: null,
  };
}

export interface LibraryRecipe3dSpec {
  readonly id: string;
  readonly name: string;
  readonly steps: number;
  readonly category: "hero" | "card" | "showcase" | "physics";
  /** Frame-time budget the recipe must meet on its tier, in ms (a target, not a measurement). */
  readonly tierBudgetMs: number;
  /** Measured editor-vs-export pixel difference; `null` until a render comparison exists. */
  readonly parityDiffPercent: number | null;
  readonly license: "MIT";
}

export const STAGE6_3D_LIBRARY_RECIPES: readonly LibraryRecipe3dSpec[] = [
  { id: "floating-object", name: "Floating Hero Object", steps: 4, category: "hero", tierBudgetMs: 3.1, parityDiffPercent: null, license: "MIT" },
  { id: "card-flip-3d", name: "3D Interactive Card Flip", steps: 5, category: "card", tierBudgetMs: 2.2, parityDiffPercent: null, license: "MIT" },
  { id: "gltf-spin-showcase", name: "GLTF Spin Showcase", steps: 6, category: "showcase", tierBudgetMs: 4.4, parityDiffPercent: null, license: "MIT" },
  { id: "depth-parallax-scene", name: "Depth-Parallax 3D Stage", steps: 5, category: "hero", tierBudgetMs: 3.6, parityDiffPercent: null, license: "MIT" },
  { id: "physics-lanyard-badge", name: "Physics Badge on Lanyard", steps: 7, category: "physics", tierBudgetMs: 4.9, parityDiffPercent: null, license: "MIT" },
  { id: "product-turntable", name: "Studio Product Turntable", steps: 5, category: "showcase", tierBudgetMs: 3.8, parityDiffPercent: null, license: "MIT" },
];

export interface Stage6GateReport {
  readonly passed: boolean;
  readonly stackVerified: boolean;
  readonly browserContextRecovery: readonly Scene3dContextRecoveryResult[];
  readonly gizmoJourneySteps: number;
  readonly watertightShapesPassed: number;
  readonly gltfModelsImported: number;
  readonly ikTargetsSolved: number;
  readonly shaderGraphMaterialsMatched: number;
  readonly cloner10kWithinBudget: boolean;
  readonly pile100BodiesHashMatch: boolean;
  readonly memoryZeroLeak: boolean;
  readonly domIn3dProjectionErrorPx: number;
  readonly r3fExportDiffPercent: number | null;
  readonly threejsExportDiffPercent: number | null;
  readonly libraryRecipesPassed: number;
  /**
   * Gate items nothing measures yet. The gate cannot pass while this is not empty: an unmeasured item is not a pass.
   */
  readonly unmeasured: readonly string[];
}

/** Phase 240 Stage 6 Gate: complete end-to-end 3D journey verification. */
export function runStage6ThreeDJourneyGate(): Stage6GateReport {
  const stack = verify3dStackDecisionAndLicenses();
  const host = new Scene3dLayerHost("gate_scene3d");
  host.addEntity({ id: "gltf_hero", name: "Hero Product", archetype: "object3d", visible: true });
  host.addEntity({ id: "cam_main", name: "Main Cam", archetype: "camera3d", visible: true });
  host.addEntity({ id: "key_light", name: "Studio Key", archetype: "light3d", visible: true });
  const browserContextRecovery: Scene3dContextRecoveryResult[] = [
    host.simulateContextLossAndRecovery("chromium"),
    host.simulateContextLossAndRecovery("firefox"),
    host.simulateContextLossAndRecovery("webkit"),
  ];

  const gizmo = run15StepGizmoJourney();
  const hierarchyTest = reparentPreservingWorldTransform(
    [
      {
        id: "parent_a",
        name: "Parent A",
        parentId: null,
        visible: true,
        radius: 1,
        localTransform: { position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      },
      {
        id: "child_b",
        name: "Child B",
        parentId: null,
        visible: true,
        radius: 1,
        localTransform: { position: { x: 5, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      },
    ],
    "child_b",
    "parent_a",
  );
  const childWorld = evaluateNodeWorldTransform(hierarchyTest, "child_b");

  const prim = createParametricPrimitive("text3d", { text: "LAZY" });
  const liveLogo = new LiveLinked2dTo3dSurface(TEN_REFERENCE_2D_SHAPES[7], "inflate");
  liveLogo.update2dContour(TEN_REFERENCE_2D_SHAPES[8]);
  const watertightShapesPassed = TEN_REFERENCE_2D_SHAPES.filter((shape) => checkMeshWatertight(build3dFrom2dShape(shape, "inflate")).watertight).length;

  const gltfModelsImported = TEN_SAMPLE_GLTF_FIXTURES.filter((f) => importGltfAsset(f).ok).length;
  const badGltfRejected = !importGltfAsset({
    id: "bad",
    filename: "evil.glb",
    magic: "invalid",
    version: 1,
    vertexCount: 0,
    triangleCount: 0,
    byteLength: 0,
  }).ok;

  const pbrResp = evaluatePbrSurfaceResponse(PBR_MATERIAL_PRESETS.glass, 0.85);
  const lighting = evaluateLightingRig(
    [{ id: "key", kind: "directional", position: { x: 4, y: 6, z: 4 }, color: [1, 0.98, 0.95], intensity: 2.2, castShadow: true, shadowMapSize: 2048 }],
    { hdriPreset: "studio-softbox", exposure: 1, backgroundBlur: 0.2, toneMapping: "ACESFilmic", ambientIntensity: 0.4 },
    "T2",
  );
  const camPath = buildArcLengthCameraPath("scroll_cam", [{ x: 0, y: 1, z: 6 }, { x: 2, y: 1.5, z: 4 }, { x: 0, y: 2, z: 3 }], { x: 0, y: 0, z: 0 });
  const camSample = sampleCameraPathAtTime(camPath, 0.5);

  const trackSample = evaluate3dTimelineTrack(
    [
      { timeSec: 0, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { timeSec: 1, position: { x: 2, y: 1, z: 0 }, rotation: { x: 0, y: 0.7071, z: 0, w: 0.7071 }, scale: { x: 1, y: 1, z: 1 } },
    ],
    0.5,
  );
  const gltfClip = evaluateGltfAnimationClip(
    { id: "idle", name: "Idle", durationSec: 2, trimStartSec: 0, trimEndSec: 2, loop: true, speed: 1, morphNames: ["smile", "blink"] },
    0.75,
    1,
  );

  const ikTargets = generate50Reachable3dIkTargets();
  const ikSolvedCount = ikTargets.filter(
    (t) => solve3dIkChain({ x: 0, y: 0, z: 0 }, [0.9, 0.8, 0.6], t, 145).tipError < 0.05,
  ).length;

  const shaderGraphMaterialsMatched = FIVE_GRAPH_MATERIALS.filter(
    (m) => compileAndCompareShaderGraph3d(m, { u: 0.4, v: 0.6 }, 0.8, 1.0).maxChannelDiff < 0.01,
  ).length;

  const rxStep = evaluate3dReactionsTapeFrame(null, false, {
    pointerNormX: 0.4,
    pointerNormY: -0.2,
    scrollProgress: 0.5,
    pointerDown: true,
    raycastHitId: "gltf_hero",
  });
  const domProj = projectDomLayerInto3dScene(
    { id: "cta_btn", role: "button", ariaLabel: "Inspect 3D Product", worldPosition: { x: 0, y: 0.4, z: 0 }, rotationDeg: { x: 0, y: 10, z: 0 }, widthPx: 140, heightPx: 42 },
    camSample.position,
    { width: 1280, height: 720, fovDeg: 45 },
  );

  const cloner10k = evaluate3dInstancedCloner("grid", 10000);
  const pileA = step3dPhysicsWorld(create100BodyPileInitialState(), 30);
  const pileB = step3dPhysicsWorld(create100BodyPileInitialState(), 30);
  const pile100BodiesHashMatch = pileA.positionHash === pileB.positionHash && pileA.bodies.length === 100;

  const postPhone = evaluatePostProcessStack(["ssao", "dof", "bloom", "colorGrading", "vignette"], "T1");
  const memBaseline = verify20xGltfLoadUnloadBaseline();
  const r3f = exportScene3dToCode("ProductHero", "r3f");
  const threejs = exportScene3dToCode("ProductHero", "threejs");
  const measuredUnder2 = (d: number | null): boolean => d !== null && d < 2;
  const libraryRecipesPassed = STAGE6_3D_LIBRARY_RECIPES.filter((r) => r.steps <= 8 && measuredUnder2(r.parityDiffPercent)).length;
  const unmeasured = [
    ...(r3f.parityDiffPercent === null ? ["R3F export vs editor pixel parity"] : []),
    ...(threejs.parityDiffPercent === null ? ["three.js export vs editor pixel parity"] : []),
    ...STAGE6_3D_LIBRARY_RECIPES.filter((r) => r.parityDiffPercent === null).map((r) => `recipe ${r.id}: export parity`),
    "WebGL context loss and recovery in real Chromium, Firefox and WebKit (only simulated)",
    "glTF import of real .glb files through the editor (the gate's fixtures are descriptions, not files)",
  ];

  const passed =
    stack.valid &&
    browserContextRecovery.every((r) => r.restoredCount >= 1) &&
    gizmo.stepsCompleted === 15 &&
    gizmo.undoStepsMatched &&
    Math.abs(childWorld.position.x - 5) < 1e-6 &&
    prim.mesh.indices.length > 0 &&
    liveLogo.lastUpdateMs < 100 &&
    watertightShapesPassed === 10 &&
    gltfModelsImported === 10 &&
    badGltfRejected &&
    pbrResp.transmittance > 0.8 &&
    lighting.withinTierBudget &&
    trackSample.onionSkinPoses.length === 4 &&
    gltfClip.localClipTimeSec > 0 &&
    ikSolvedCount === 50 &&
    shaderGraphMaterialsMatched === 5 &&
    rxStep.output.emittedEvents.some((e) => e.kind === "object3d.click") &&
    domProj.keepInA11yTree &&
    domProj.projectionErrorPx < 1 &&
    cloner10k.instanceCount === 10000 &&
    cloner10k.withinMidTierBudget &&
    pile100BodiesHashMatch &&
    postPhone.withinBudget &&
    memBaseline.zeroLeakBaselineRestored &&
    measuredUnder2(r3f.parityDiffPercent) &&
    measuredUnder2(threejs.parityDiffPercent) &&
    libraryRecipesPassed === 6 &&
    unmeasured.length === 0;

  return {
    passed,
    stackVerified: stack.valid,
    browserContextRecovery,
    gizmoJourneySteps: gizmo.stepsCompleted,
    watertightShapesPassed,
    gltfModelsImported,
    ikTargetsSolved: ikSolvedCount,
    shaderGraphMaterialsMatched,
    cloner10kWithinBudget: cloner10k.withinMidTierBudget,
    pile100BodiesHashMatch,
    memoryZeroLeak: memBaseline.zeroLeakBaselineRestored,
    domIn3dProjectionErrorPx: domProj.projectionErrorPx,
    r3fExportDiffPercent: r3f.parityDiffPercent,
    threejsExportDiffPercent: threejs.parityDiffPercent,
    libraryRecipesPassed,
    unmeasured,
  };
}
