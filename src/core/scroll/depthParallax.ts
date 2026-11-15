/**
 * @file depthParallax.ts
 * @module core/scroll/depthParallax
 * @description Phase 190: Stage 3 perspective depth camera bound to scroll,
 * cursor, and phone tilt with 4 one-click presets (`multi_plane_parallax`,
 * `dolly_on_scroll`, `cursor_look_around`, `phone_tilt`), outputting identical
 * stage and exported CSS transform matrices across 5+ depth planes.
 */

export type DepthParallaxPreset =
  | "multi_plane_parallax"
  | "dolly_on_scroll"
  | "cursor_look_around"
  | "phone_tilt";

export interface DepthPlaneSpec {
  readonly id: string;
  /** Depth offset in px (`> 0` foreground closer to camera, `< 0` background further away). */
  readonly depthZPx: number;
  readonly baseX?: number;
  readonly baseY?: number;
}

export interface DepthCameraConfig {
  readonly preset: DepthParallaxPreset;
  readonly focalLengthPx?: number; // camera distance from z=0 plane, default 1000
  readonly scrollRangePx?: number;
  readonly cursorStrengthPx?: number;
  readonly dollyTravelPx?: number;
  readonly maxTiltDeg?: number;
  readonly reducedMotion?: boolean;
}

export interface DepthParallaxInputs {
  readonly scrollProgress: number; // 0..1
  readonly pointerNdcX: number; // -1..1
  readonly pointerNdcY: number; // -1..1
  readonly tiltNdcX?: number; // -1..1
  readonly tiltNdcY?: number; // -1..1
}

export interface ProjectedDepthPlane {
  readonly id: string;
  readonly depthZPx: number;
  readonly effectiveZPx: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
  readonly rotateXDeg: number;
  readonly rotateYDeg: number;
  readonly cssTransform3d: string;
}

export interface DepthParallaxEvalResult {
  readonly preset: DepthParallaxPreset;
  readonly cameraX: number;
  readonly cameraY: number;
  readonly cameraZ: number;
  readonly planes: readonly ProjectedDepthPlane[];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round4(n: number): number {
  const r = Math.round(n * 10000) / 10000;
  return r === 0 ? 0 : r;
}

/**
 * Evaluate exact perspective projection for all depth planes under the chosen
 * preset and input state, returning identical stage + export transforms.
 */
export function evaluateDepthParallaxScene(
  planes: readonly DepthPlaneSpec[],
  config: DepthCameraConfig,
  inputs: DepthParallaxInputs
): DepthParallaxEvalResult {
  const f = Math.max(200, config.focalLengthPx ?? 1000);
  const reduced = config.reducedMotion ?? false;
  const sp = clamp(inputs.scrollProgress, 0, 1);
  const px = reduced ? 0 : clamp(inputs.pointerNdcX, -1, 1);
  const py = reduced ? 0 : clamp(inputs.pointerNdcY, -1, 1);
  const tx = reduced ? 0 : clamp(inputs.tiltNdcX ?? px, -1, 1);
  const ty = reduced ? 0 : clamp(inputs.tiltNdcY ?? py, -1, 1);

  const scrollSpan = config.scrollRangePx ?? 240;
  const cursorSpan = config.cursorStrengthPx ?? 48;
  const dollySpan = config.dollyTravelPx ?? 320;
  const maxTilt = config.maxTiltDeg ?? 7;

  let cameraX = 0;
  let cameraY = 0;
  let cameraZ = 0;
  let camRotX = 0;
  let camRotY = 0;

  if (config.preset === "multi_plane_parallax") {
    cameraX = px * cursorSpan;
    cameraY = (reduced ? 0 : (sp - 0.5) * scrollSpan) + py * cursorSpan * 0.65;
  } else if (config.preset === "dolly_on_scroll") {
    cameraZ = reduced ? 0 : sp * dollySpan;
    cameraX = px * cursorSpan * 0.35;
    cameraY = py * cursorSpan * 0.25;
  } else if (config.preset === "cursor_look_around") {
    cameraX = px * cursorSpan * 1.1;
    cameraY = py * cursorSpan * 1.1;
    camRotY = px * maxTilt;
    camRotX = -py * maxTilt;
  } else if (config.preset === "phone_tilt") {
    cameraX = tx * cursorSpan * 0.9;
    cameraY = ty * cursorSpan * 0.9;
    camRotY = tx * maxTilt * 1.15;
    camRotX = -ty * maxTilt * 1.15;
  }

  const projected: ProjectedDepthPlane[] = planes.map((plane) => {
    const effectiveZ = plane.depthZPx - cameraZ;
    // Perspective factor > 1 for closer foreground (z > 0), < 1 for deep background (z < 0)
    const denom = Math.max(80, f - effectiveZ);
    const scale = f / denom;
    // Parallax factor relative to focal plane (z=0 => 0 when stationary relative to camera)
    const parallaxWeight = -effectiveZ / f;
    const offsetX = round4(cameraX * parallaxWeight);
    const offsetY = round4(cameraY * parallaxWeight);
    const rx = round4(camRotX);
    const ry = round4(camRotY);
    const sc = round4(scale);

    return {
      id: plane.id,
      depthZPx: plane.depthZPx,
      effectiveZPx: round4(effectiveZ),
      offsetX,
      offsetY,
      scale: sc,
      rotateXDeg: rx,
      rotateYDeg: ry,
      cssTransform3d: `translate3d(${offsetX}px, ${offsetY}px, ${round4(effectiveZ)}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${sc})`,
    };
  });

  return {
    preset: config.preset,
    cameraX: round4(cameraX),
    cameraY: round4(cameraY),
    cameraZ: round4(cameraZ),
    planes: projected,
  };
}
