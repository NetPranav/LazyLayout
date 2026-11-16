/**
 * ============================================================================
 * STAGE 6 · PHASES 226–227 — LIGHTS, SHADOWS, HDRI & CAMERA PATHS
 * ============================================================================
 * Phase 226: Ambient/directional/point/spot/area lights with gizmos,
 *            tier-budgeted shadows, HDRI environments & tone mapping.
 * Phase 227: Perspective/orthographic cameras, active camera switcher,
 *            FOV & depth-of-field, and constant-speed arc-length parameterized
 *            3D camera paths with look-at target.
 * ============================================================================
 */

import { type Vec3Tuple, addVec3, distanceVec3Safe, normalizeVec3, scaleVec3, subVec3 } from "./pathUtils";

export type Light3dKind = "ambient" | "directional" | "point" | "spot" | "area";
export type ToneMappingOperator = "ACESFilmic" | "AgX" | "Neutral" | "Linear";
export type PerformanceTier = "T0" | "T1" | "T2" | "T3";

export interface Light3dSpec {
  readonly id: string;
  readonly kind: Light3dKind;
  readonly position: Vec3Tuple;
  readonly target?: Vec3Tuple;
  readonly color: readonly [number, number, number];
  readonly intensity: number;
  readonly castShadow: boolean;
  readonly shadowMapSize: number;
  readonly spotAngleDeg?: number;
}

export interface WorldEnvironment3dSpec {
  readonly hdriPreset: "studio-softbox" | "daylight-courtyard" | "night-neon" | "overcast";
  readonly exposure: number;
  readonly backgroundBlur: number;
  readonly toneMapping: ToneMappingOperator;
  readonly ambientIntensity: number;
}

export interface TierShadowEvaluation {
  readonly tier: PerformanceTier;
  readonly effectiveShadowMapSize: number;
  readonly activeShadowCasters: number;
  readonly estimatedGpuMs: number;
  readonly withinTierBudget: boolean;
  readonly sampledHdriIrradiance: readonly [number, number, number];
  readonly toneMappedPeak: number;
}

const TIER_SHADOW_CAP: Record<PerformanceTier, { maxSize: number; maxCasters: number; budgetMs: number }> = {
  T0: { maxSize: 512, maxCasters: 1, budgetMs: 4.5 },
  T1: { maxSize: 1024, maxCasters: 2, budgetMs: 5.5 },
  T2: { maxSize: 2048, maxCasters: 3, budgetMs: 7.0 },
  T3: { maxSize: 4096, maxCasters: 4, budgetMs: 9.0 },
};

export function applyToneMapping(linearValue: number, operator: ToneMappingOperator, exposure: number): number {
  const x = Math.max(0, linearValue * exposure);
  if (operator === "Linear") return Math.min(1, x);
  if (operator === "Neutral") return x / (1 + x);
  if (operator === "AgX") {
    const a = x * 0.85;
    return Math.min(1, Math.pow(a / (a + 0.65), 0.92));
  }
  // ACESFilmic curve
  const num = x * (2.51 * x + 0.03);
  const den = x * (2.43 * x + 0.59) + 0.14;
  return Math.max(0, Math.min(1, num / den));
}

/** Evaluate light rig, shadow downgrades per tier, HDRI irradiance, and tone mapping. */
export function evaluateLightingRig(
  lights: readonly Light3dSpec[],
  env: WorldEnvironment3dSpec,
  tier: PerformanceTier,
): TierShadowEvaluation {
  const cap = TIER_SHADOW_CAP[tier];
  const shadowLights = lights.filter((l) => l.castShadow && l.kind !== "ambient");
  const activeShadowCasters = Math.min(shadowLights.length, cap.maxCasters);
  const maxRequested = shadowLights.reduce((m, l) => Math.max(m, l.shadowMapSize), 512);
  const effectiveShadowMapSize = Math.min(maxRequested, cap.maxSize);
  const estimatedGpuMs = Number((0.45 * lights.length + 0.95 * activeShadowCasters * (effectiveShadowMapSize / 1024)).toFixed(3));

  const hdriBoost =
    env.hdriPreset === "daylight-courtyard" ? 1.15 : env.hdriPreset === "studio-softbox" ? 1.0 : env.hdriPreset === "night-neon" ? 0.55 : 0.8;
  const irr = env.ambientIntensity * hdriBoost;
  const totalLightPower = lights.reduce((sum, l) => sum + l.intensity * (l.kind === "ambient" ? 0.5 : 1), irr);

  return {
    tier,
    effectiveShadowMapSize,
    activeShadowCasters,
    estimatedGpuMs,
    withinTierBudget: estimatedGpuMs <= cap.budgetMs,
    sampledHdriIrradiance: [Number(irr.toFixed(3)), Number((irr * 0.98).toFixed(3)), Number((irr * 0.95).toFixed(3))],
    toneMappedPeak: applyToneMapping(totalLightPower, env.toneMapping, env.exposure),
  };
}

export interface Camera3dSpec {
  readonly id: string;
  readonly projection: "perspective" | "orthographic";
  readonly fovDeg: number;
  readonly orthoScale: number;
  readonly position: Vec3Tuple;
  readonly target: Vec3Tuple;
  readonly near: number;
  readonly far: number;
  readonly dofFocusDistance: number;
  readonly dofAperture: number;
}

export interface CameraPathSample {
  readonly progress: number;
  readonly arcLength: number;
  readonly position: Vec3Tuple;
  readonly lookAtTarget: Vec3Tuple;
  readonly forward: Vec3Tuple;
}

export interface ArcLengthCameraPath {
  readonly id: string;
  readonly totalLength: number;
  readonly controlPoints: readonly Vec3Tuple[];
  readonly lookAtTarget: Vec3Tuple;
  readonly lut: readonly { readonly u: number; readonly arc: number; readonly pos: Vec3Tuple }[];
}

function catmullRomScalar(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function evalCatmullRomVec3(pts: readonly Vec3Tuple[], u: number): Vec3Tuple {
  if (pts.length === 0) return { x: 0, y: 0, z: 5 };
  if (pts.length === 1) return pts[0];
  const segs = pts.length - 1;
  const scaled = Math.max(0, Math.min(segs, u * segs));
  const idx = Math.min(segs - 1, Math.floor(scaled));
  const localT = scaled - idx;
  const p0 = pts[Math.max(0, idx - 1)];
  const p1 = pts[idx];
  const p2 = pts[Math.min(pts.length - 1, idx + 1)];
  const p3 = pts[Math.min(pts.length - 1, idx + 2)];
  return {
    x: catmullRomScalar(p0.x, p1.x, p2.x, p3.x, localT),
    y: catmullRomScalar(p0.y, p1.y, p2.y, p3.y, localT),
    z: catmullRomScalar(p0.z, p1.z, p2.z, p3.z, localT),
  };
}

/** Precompute an arc-length LUT so camera flight speed stays strictly constant. */
export function buildArcLengthCameraPath(
  id: string,
  controlPoints: readonly Vec3Tuple[],
  lookAtTarget: Vec3Tuple,
  samples = 64,
): ArcLengthCameraPath {
  const lut: { u: number; arc: number; pos: Vec3Tuple }[] = [];
  let accum = 0;
  let prev = evalCatmullRomVec3(controlPoints, 0);
  lut.push({ u: 0, arc: 0, pos: prev });

  for (let i = 1; i <= samples; i++) {
    const u = i / samples;
    const cur = evalCatmullRomVec3(controlPoints, u);
    accum += distanceVec3Safe(prev, cur);
    lut.push({ u, arc: accum, pos: cur });
    prev = cur;
  }

  return { id, totalLength: accum, controlPoints, lookAtTarget, lut };
}

/** Sample constant-speed 3D camera path at normalized time `[0, 1]`. */
export function sampleCameraPathAtTime(path: ArcLengthCameraPath, normalizedTime: number): CameraPathSample {
  const t = Math.max(0, Math.min(1, normalizedTime));
  const targetArc = t * path.totalLength;
  const lut = path.lut;

  let pos = lut[lut.length - 1].pos;
  for (let i = 1; i < lut.length; i++) {
    if (lut[i].arc >= targetArc || i === lut.length - 1) {
      const a0 = lut[i - 1].arc;
      const a1 = lut[i].arc;
      const alpha = a1 - a0 > 1e-8 ? (targetArc - a0) / (a1 - a0) : 0;
      pos = addVec3(lut[i - 1].pos, scaleVec3(subVec3(lut[i].pos, lut[i - 1].pos), alpha));
      break;
    }
  }

  return {
    progress: t,
    arcLength: targetArc,
    position: pos,
    lookAtTarget: path.lookAtTarget,
    forward: normalizeVec3(subVec3(path.lookAtTarget, pos)),
  };
}
