/**
 * @file lights2d.ts
 * @module core/gpu/lights2d
 * @description Phase 182: 2D point and spot lights over flat, SDF-embossed,
 * or custom normal-map layer surfaces, casting specular highlights, soft SDF
 * shadows, and edge glints with cursor-following support and mid-tier 60fps guard.
 */

import { sampleSdfAt, type LayerSdfResource } from "./layerTexturesAndSdf";
import type { RasterBitmap, RgbaColor } from "./sceneRasteriser";

export type LightSurfaceMode = "flat" | "embossed" | "normal_map";

export interface Light2dSpec {
  readonly id: string;
  readonly kind: "point" | "spot";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radiusPx: number;
  readonly color: RgbaColor;
  readonly intensity: number;
  /** Spot direction normalized `(dx, dy)` in layer space when `kind === "spot"`. */
  readonly spotDirX?: number;
  readonly spotDirY?: number;
  /** Inner and outer cone cosines `[-1..1]` for spotlight falloff. */
  readonly spotInnerCos?: number;
  readonly spotOuterCos?: number;
  readonly castSoftShadow?: boolean;
  readonly followCursor?: boolean;
}

export interface Surface2dMaterial {
  readonly mode: LightSurfaceMode;
  readonly embossDepthPx?: number;
  readonly embossSlope?: number;
  readonly shininess?: number;
  readonly specularStrength?: number;
  readonly ambientStrength?: number;
  /** Optional tangent-space normal map RGBA bitmap (`128, 128, 255` = flat +Z). */
  readonly normalMap?: RasterBitmap;
}

export interface LitLayerInput {
  readonly layerId: string;
  readonly sdf: LayerSdfResource;
  readonly surface: Surface2dMaterial;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface LitSceneEvalResult {
  readonly layerId: string;
  readonly bitmap: RasterBitmap;
  readonly litPixelCount: number;
  readonly highlightPeak: number;
  readonly shadowedPixelCount: number;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function normalize3(x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z);
  if (len <= 1e-6) return [0, 0, 1];
  return [x / len, y / len, z / len];
}

/** Sample surface normal `(nx, ny, nz)` at local layer pixel `(lx, ly)`. */
export function sampleSurfaceNormal(
  sdf: LayerSdfResource,
  surface: Surface2dMaterial,
  lx: number,
  ly: number
): [number, number, number] {
  if (surface.mode === "flat") {
    return [0, 0, 1];
  }

  if (surface.mode === "normal_map" && surface.normalMap) {
    const nm = surface.normalMap;
    const tx = Math.max(0, Math.min(nm.width - 1, Math.floor((lx / Math.max(1, sdf.width)) * nm.width)));
    const ty = Math.max(0, Math.min(nm.height - 1, Math.floor((ly / Math.max(1, sdf.height)) * nm.height)));
    const idx = (ty * nm.width + tx) * 4;
    const nx = (nm.data[idx]! / 255) * 2 - 1;
    const ny = (nm.data[idx + 1]! / 255) * 2 - 1;
    const nz = Math.max(0.05, (nm.data[idx + 2]! / 255) * 2 - 1);
    return normalize3(nx, ny, nz);
  }

  // Embossed normal derived smoothly from Phase 175 signed distance field
  const d = sampleSdfAt(sdf, lx, ly);
  const depth = Math.max(2, surface.embossDepthPx ?? 10);
  if (d >= 0 || d <= -depth) {
    return [0, 0, 1];
  }
  const gx = (sampleSdfAt(sdf, lx + 1, ly) - sampleSdfAt(sdf, lx - 1, ly)) * 0.5;
  const gy = (sampleSdfAt(sdf, lx, ly + 1) - sampleSdfAt(sdf, lx, ly - 1)) * 0.5;
  const edgeWeight = Math.sin(((depth + d) / depth) * Math.PI * 0.5);
  const slope = (surface.embossSlope ?? 1.25) * edgeWeight;
  return normalize3(gx * slope, gy * slope, 1);
}

/** Compute 4-tap soft SDF shadow factor `0.2..1.0` toward light `(worldLx, worldLy)`. */
function computeSoftShadow(
  sdf: LayerSdfResource,
  lx: number,
  ly: number,
  lightLocalX: number,
  lightLocalY: number
): number {
  const dx = lightLocalX - lx;
  const dy = lightLocalY - ly;
  const dist = Math.hypot(dx, dy);
  if (dist <= 2) return 1;
  const ux = dx / dist;
  const uy = dy / dist;
  let shade = 1;
  const maxMarch = Math.min(dist, 24);
  for (let t = 4; t <= maxMarch; t += 6) {
    const sx = lx + ux * t;
    const sy = ly + uy * t;
    if (sx < 0 || sy < 0 || sx > sdf.width || sy > sdf.height) {
      // Penumbra attenuation beyond outer bezel
      shade = Math.min(shade, 0.72 + 0.28 * Math.min(1, sampleSdfAt(sdf, sx, sy) / 8));
      break;
    }
  }
  return Math.max(0.25, Math.min(1, shade));
}

/** Resolve cursor-following lights to current pointer `(cursorX, cursorY)`. */
export function resolveLightsForCursor(
  lights: readonly Light2dSpec[],
  cursorX: number,
  cursorY: number
): Light2dSpec[] {
  return lights.map((light) =>
    light.followCursor ? { ...light, x: cursorX, y: cursorY } : light
  );
}

/** Evaluate all active 2D point & spot lights across one layer surface. */
export function evaluateLayer2dLighting(
  layer: LitLayerInput,
  lights: readonly Light2dSpec[],
  tier: "T0" | "T1" | "T2" | "T3" = "T2"
): LitSceneEvalResult {
  const { sdf, surface, offsetX, offsetY } = layer;
  const w = Math.max(1, Math.round(sdf.width));
  const h = Math.max(1, Math.round(sdf.height));
  const out = new Uint8ClampedArray(w * h * 4);

  // Mid/low tier optimization: limit max simultaneous lights and stride normal taps on T0
  const maxLights = tier === "T0" ? 2 : tier === "T1" ? 4 : lights.length;
  const activeLights = lights.slice(0, maxLights);
  const step = tier === "T0" ? 2 : 1;

  const ambient = surface.ambientStrength ?? 0.22;
  const shininess = surface.shininess ?? 28;
  const specularStrength = surface.specularStrength ?? 0.75;

  let litPixelCount = 0;
  let shadowedPixelCount = 0;
  let highlightPeak = 0;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const lx = x + 0.5;
      const ly = y + 0.5;
      const d = sampleSdfAt(sdf, lx, ly);
      if (d > 0.5) continue;

      const worldX = offsetX + lx;
      const worldY = offsetY + ly;
      const [nx, ny, nz] = sampleSurfaceNormal(sdf, surface, lx, ly);

      // Base color from layer texture bitmap
      const texX = Math.min(sdf.textureBitmap.width - 1, Math.max(0, Math.round(x + sdf.paddingPx)));
      const texY = Math.min(sdf.textureBitmap.height - 1, Math.max(0, Math.round(y + sdf.paddingPx)));
      const tidx = (texY * sdf.textureBitmap.width + texX) * 4;
      const baseR = sdf.textureBitmap.data[tidx]! || 180;
      const baseG = sdf.textureBitmap.data[tidx + 1]! || 190;
      const baseB = sdf.textureBitmap.data[tidx + 2]! || 210;

      let accumR = baseR * ambient;
      let accumG = baseG * ambient;
      let accumB = baseB * ambient;
      let pixelHighlight = 0;

      for (const light of activeLights) {
        const vx = light.x - worldX;
        const vy = light.y - worldY;
        const vz = light.z;
        const dist2d = Math.hypot(vx, vy);
        const radius = Math.max(1, light.radiusPx);
        if (dist2d > radius) continue;

        const atten = Math.pow(Math.max(0, 1 - dist2d / radius), 1.6);
        const [lxDir, lyDir, lzDir] = normalize3(vx, vy, vz);

        let spotMask = 1;
        if (light.kind === "spot") {
          const sx = light.spotDirX ?? 0;
          const sy = light.spotDirY ?? 1;
          const [sdx, sdy] = normalize3(sx, sy, 0);
          // Direction from light to fragment is (-vx, -vy)
          const fragLen = Math.max(1e-5, dist2d);
          const dotCone = (-vx / fragLen) * sdx + (-vy / fragLen) * sdy;
          const outer = light.spotOuterCos ?? 0.5;
          const inner = light.spotInnerCos ?? 0.85;
          spotMask = Math.max(0, Math.min(1, (dotCone - outer) / Math.max(1e-4, inner - outer)));
        }
        if (spotMask <= 0) continue;

        const shadow =
          light.castSoftShadow && tier !== "T0"
            ? computeSoftShadow(sdf, lx, ly, light.x - offsetX, light.y - offsetY)
            : 1;
        if (shadow < 0.99) {
          shadowedPixelCount += 1;
        }

        const nDotL = Math.max(0, nx * lxDir + ny * lyDir + nz * lzDir);
        const [hx, hy, hz] = normalize3(lxDir, lyDir, lzDir + 1);
        const spec = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), shininess) * specularStrength;

        // Edge glint right along SDF perimeter
        const edgeGlint = Math.exp(-Math.pow((d + 1.2) / 1.8, 2)) * 0.45;
        const contrib = atten * spotMask * shadow * light.intensity;
        const specEnergy = (spec + edgeGlint) * contrib;

        accumR += (baseR * (light.color.r / 255) * nDotL + light.color.r * specEnergy) * contrib;
        accumG += (baseG * (light.color.g / 255) * nDotL + light.color.g * specEnergy) * contrib;
        accumB += (baseB * (light.color.b / 255) * nDotL + light.color.b * specEnergy) * contrib;

        pixelHighlight = Math.max(pixelHighlight, specEnergy);
      }

      if (pixelHighlight > 0.05) {
        litPixelCount += 1;
        highlightPeak = Math.max(highlightPeak, pixelHighlight);
      }

      for (let dy = 0; dy < step && y + dy < h; dy += 1) {
        for (let dx = 0; dx < step && x + dx < w; dx += 1) {
          const outIdx = ((y + dy) * w + (x + dx)) * 4;
          out[outIdx] = clampByte(accumR);
          out[outIdx + 1] = clampByte(accumG);
          out[outIdx + 2] = clampByte(accumB);
          out[outIdx + 3] = 255;
        }
      }
    }
  }

  return {
    layerId: layer.layerId,
    bitmap: { width: w, height: h, data: out },
    litPixelCount,
    highlightPeak,
    shadowedPixelCount,
  };
}
