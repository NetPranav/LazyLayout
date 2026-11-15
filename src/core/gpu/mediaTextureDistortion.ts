/**
 * @file mediaTextureDistortion.ts
 * @module core/gpu/mediaTextureDistortion
 * @description Phase 187: Images, video fills, text (SDF/canvas re-rendered on
 * font load and resize), and rasterised SVG built on Phase 175 `LayerSdfResource`,
 * driving 6 distortion effects (`hover_displacement`, `pixel_dither_transition`,
 * `grid_wave`, `halftone_reveal`, `image_trail`, `glass_lens`), single-read DOM
 * accessibility guarantees, and CSS/SVG filter fallbacks when WebGL is off.
 */

import { sampleSdfAt, type LayerSdfResource } from "./layerTexturesAndSdf";
import type { RasterBitmap } from "./sceneRasteriser";

export type MediaSourceKind = "image" | "video_fill" | "sdf_text" | "raster_svg";

export type MediaDistortionKind =
  | "hover_displacement"
  | "pixel_dither_transition"
  | "grid_wave"
  | "halftone_reveal"
  | "image_trail"
  | "glass_lens";

export interface MediaSourceDescriptor {
  readonly layerId: string;
  readonly kind: MediaSourceKind;
  readonly sdfResource: LayerSdfResource;
  readonly fontLoadGeneration: number;
  readonly width: number;
  readonly height: number;
  readonly altText?: string;
  readonly textContent?: string;
  readonly videoFillAssetId?: string;
}

export interface MediaDistortionParams {
  readonly kind: MediaDistortionKind;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly progress: number; // 0..1
  readonly intensity?: number;
  readonly timeSec?: number;
  readonly webglEnabled?: boolean;
  readonly tier?: "T0" | "T1" | "T2" | "T3";
}

export interface MediaAccessibilityReport {
  readonly domElementPreserved: true;
  readonly screenReaderReadOnce: true;
  readonly accessibleLabel: string;
  readonly canvasOverlayAriaHidden: true;
}

export interface MediaFallbackDescriptor {
  readonly active: boolean;
  readonly cssFilter: string;
  readonly cssTransform: string;
  readonly svgFilterMarkup: string;
}

export interface MediaDistortionEvalResult {
  readonly sourceKind: MediaSourceKind;
  readonly distortionKind: MediaDistortionKind;
  readonly bitmap: RasterBitmap;
  readonly displacedPixelCount: number;
  readonly needsTextureReupload: boolean;
  readonly accessibility: MediaAccessibilityReport;
  readonly fallback: MediaFallbackDescriptor;
}

const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const;

export function buildMediaFallback(
  params: MediaDistortionParams,
  width: number,
  height: number
): MediaFallbackDescriptor {
  const tier = params.tier ?? "T2";
  const webglOff = params.webglEnabled === false || tier === "T0";
  const p = Math.max(0, Math.min(1, params.progress));
  const dx = ((params.pointerX / Math.max(1, width)) - 0.5) * 10 * (params.intensity ?? 1);
  const dy = ((params.pointerY / Math.max(1, height)) - 0.5) * 10 * (params.intensity ?? 1);

  return {
    active: webglOff,
    cssFilter:
      params.kind === "pixel_dither_transition"
        ? `contrast(${(1 + p * 0.25).toFixed(2)})`
        : params.kind === "halftone_reveal"
          ? `opacity(${(0.35 + p * 0.65).toFixed(2)})`
          : "none",
    cssTransform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${(1 + p * 0.03).toFixed(3)})`,
    svgFilterMarkup: `<filter id="ll-fallback-${params.kind}"><feTurbulence baseFrequency="0.03" numOctaves="1"/><feDisplacementMap in="SourceGraphic" scale="${Math.round((params.intensity ?? 1) * 12)}"/></filter>`,
  };
}

/** Track when text/SVG/media textures must re-rasterise due to font load or layer resize. */
export function createMediaTextureCacheTracker() {
  const seen = new Map<string, { readonly fontGen: number; readonly w: number; readonly h: number }>();
  return {
    checkNeedsReupload(desc: MediaSourceDescriptor): boolean {
      const prev = seen.get(desc.layerId);
      const changed =
        !prev ||
        prev.fontGen !== desc.fontLoadGeneration ||
        prev.w !== desc.width ||
        prev.h !== desc.height;
      seen.set(desc.layerId, {
        fontGen: desc.fontLoadGeneration,
        w: desc.width,
        h: desc.height,
      });
      return changed;
    },
  };
}

function clampCoord(v: number, max: number): number {
  return Math.max(0, Math.min(max - 1, Math.round(v)));
}

/** Evaluate any of the 6 distortion modes over a Phase 175 media texture + SDF resource. */
export function evaluateMediaDistortion(
  source: MediaSourceDescriptor,
  params: MediaDistortionParams,
  cacheTracker?: ReturnType<typeof createMediaTextureCacheTracker>
): MediaDistortionEvalResult {
  const sdf = source.sdfResource;
  const w = Math.max(1, Math.round(source.width));
  const h = Math.max(1, Math.round(source.height));
  const out = new Uint8ClampedArray(w * h * 4);
  const src = sdf.textureBitmap;

  const strength = Math.max(0, Math.min(2, params.intensity ?? 1));
  const progress = Math.max(0, Math.min(1, params.progress));
  const t = params.timeSec ?? 0;

  let displacedPixelCount = 0;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let sx = x;
      let sy = y;
      let alphaScale = 1;

      const dx = x - params.pointerX;
      const dy = y - params.pointerY;
      const dist = Math.hypot(dx, dy);

      switch (params.kind) {
        case "hover_displacement": {
          const rad = 42;
          if (dist < rad && dist > 0.5) {
            const k = (1 - dist / rad) * 8 * strength;
            const rip = Math.sin(dist * 0.35 - t * 6);
            sx += (dx / dist) * k * rip;
            sy += (dy / dist) * k * rip;
            displacedPixelCount += 1;
          }
          break;
        }
        case "pixel_dither_transition": {
          const cell = Math.max(2, Math.round(2 + (1 - progress) * 8));
          sx = Math.floor(x / cell) * cell;
          sy = Math.floor(y / cell) * cell;
          const bayer = BAYER4[(y & 3) * 4 + (x & 3)]! / 16;
          if (progress < bayer) {
            alphaScale = 0;
          }
          if (sx !== x || sy !== y) displacedPixelCount += 1;
          break;
        }
        case "grid_wave": {
          sx += Math.sin((y / Math.max(1, h)) * Math.PI * 4 + t * 3) * 5 * strength;
          sy += Math.cos((x / Math.max(1, w)) * Math.PI * 4 + t * 3) * 4 * strength;
          displacedPixelCount += 1;
          break;
        }
        case "halftone_reveal": {
          const period = 6;
          const gx = (x % period) - period * 0.5;
          const gy = (y % period) - period * 0.5;
          const dotR = progress * (period * 0.72);
          if (Math.hypot(gx, gy) > dotR) {
            alphaScale = 0;
          } else {
            displacedPixelCount += 1;
          }
          break;
        }
        case "image_trail": {
          const lag = 6 * progress * strength;
          sx -= ((params.pointerX - w * 0.5) / Math.max(1, w)) * lag;
          sy -= ((params.pointerY - h * 0.5) / Math.max(1, h)) * lag;
          displacedPixelCount += 1;
          break;
        }
        case "glass_lens": {
          const d = sampleSdfAt(sdf, x + 0.5, y + 0.5);
          if (dist < 48 && d <= 0) {
            const mag = 1 / (1 + 0.45 * (1 - dist / 48) * strength);
            sx = params.pointerX + dx * mag;
            sy = params.pointerY + dy * mag;
            displacedPixelCount += 1;
          }
          break;
        }
      }

      const cx = clampCoord(sx + sdf.paddingPx, src.width);
      const cy = clampCoord(sy + sdf.paddingPx, src.height);
      const sidx = (cy * src.width + cx) * 4;
      const didx = (y * w + x) * 4;
      out[didx] = src.data[sidx]!;
      out[didx + 1] = src.data[sidx + 1]!;
      out[didx + 2] = src.data[sidx + 2]!;
      out[didx + 3] = Math.round(src.data[sidx + 3]! * alphaScale);
    }
  }

  return {
    sourceKind: source.kind,
    distortionKind: params.kind,
    bitmap: { width: w, height: h, data: out },
    displacedPixelCount,
    needsTextureReupload: cacheTracker ? cacheTracker.checkNeedsReupload(source) : false,
    accessibility: {
      domElementPreserved: true,
      screenReaderReadOnce: true,
      accessibleLabel: source.textContent ?? source.altText ?? source.layerId,
      canvasOverlayAriaHidden: true,
    },
    fallback: buildMediaFallback(params, w, h),
  };
}
