/**
 * @file liquidGlass.ts
 * @module core/gpu/liquidGlass
 * @description Phase 181: Backdrop sampling & liquid glass — SDF-shaped
 * Snell refraction (`liquid_glass`), `magnifier_lens`, and `frosted_panel`
 * with edge bevel light, built on Phase 172's scene rasteriser and Phase 175's
 * signed distance fields, with `backdrop-filter` fast path & low-tier blur fallback.
 */

import { sampleSdfAt, type LayerSdfResource } from "./layerTexturesAndSdf";
import type { RasterBitmap, RgbaColor } from "./sceneRasteriser";

export type LiquidGlassPreset = "liquid_glass" | "magnifier_lens" | "frosted_panel";

export type GlassRenderBackend =
  | "sdf_rasteriser"
  | "css_backdrop_filter"
  | "low_tier_blur_fallback";

export interface GlassStrategyInput {
  readonly preset: LiquidGlassPreset;
  readonly supportsBackdropFilter: boolean;
  readonly tier: "T0" | "T1" | "T2" | "T3";
  readonly blurRadiusPx?: number;
  readonly refractionStrengthPx?: number;
  readonly reducedMotion?: boolean;
}

export interface GlassRenderStrategy {
  readonly backend: GlassRenderBackend;
  readonly cssBackdropFilter?: string;
  readonly effectiveBlurPx: number;
  readonly effectiveRefractionPx: number;
  readonly chromaticDispersionPx: number;
  readonly sampleScale: number;
}

export interface LiquidGlassParams {
  readonly preset: LiquidGlassPreset;
  /** Glass layer top-left X coordinate inside the scene backdrop bitmap. */
  readonly offsetX: number;
  /** Glass layer top-left Y coordinate inside the scene backdrop bitmap. */
  readonly offsetY: number;
  readonly blurRadiusPx?: number;
  readonly bevelWidthPx?: number;
  readonly refractionStrengthPx?: number;
  readonly magnification?: number;
  readonly chromaticAberrationPx?: number;
  readonly tintColor?: RgbaColor;
  readonly tintOpacity?: number;
  readonly edgeLightIntensity?: number;
  readonly supportsBackdropFilter?: boolean;
  readonly tier?: "T0" | "T1" | "T2" | "T3";
  readonly reducedMotion?: boolean;
}

export interface LiquidGlassEvalResult {
  readonly bitmap: RasterBitmap;
  readonly strategy: GlassRenderStrategy;
  readonly coveredPixelCount: number;
  readonly refractedPixelCount: number;
  readonly rimHighlightPixelCount: number;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Resolve whether to use SDF rasteriser, `backdrop-filter` fast path, or T0 blur fallback. */
export function resolveGlassRenderStrategy(input: GlassStrategyInput): GlassRenderStrategy {
  const baseBlur = Math.max(0, input.blurRadiusPx ?? (input.preset === "frosted_panel" ? 12 : 4));
  const baseRefract = Math.max(0, input.refractionStrengthPx ?? (input.preset === "liquid_glass" ? 14 : 6));

  if (input.tier === "T0") {
    const cappedBlur = Math.min(4, baseBlur);
    return {
      backend: "low_tier_blur_fallback",
      cssBackdropFilter: input.supportsBackdropFilter ? `blur(${cappedBlur}px)` : undefined,
      effectiveBlurPx: cappedBlur,
      effectiveRefractionPx: 0,
      chromaticDispersionPx: 0,
      sampleScale: 0.5,
    };
  }

  if (
    input.preset === "frosted_panel" &&
    input.supportsBackdropFilter &&
    baseRefract === 0
  ) {
    return {
      backend: "css_backdrop_filter",
      cssBackdropFilter: `blur(${Math.round(baseBlur)}px) saturate(1.35)`,
      effectiveBlurPx: baseBlur,
      effectiveRefractionPx: 0,
      chromaticDispersionPx: 0,
      sampleScale: 1,
    };
  }

  const tierScale = input.tier === "T1" ? 0.75 : 1;
  return {
    backend: "sdf_rasteriser",
    effectiveBlurPx: baseBlur * tierScale,
    effectiveRefractionPx: input.reducedMotion ? baseRefract * 0.5 : baseRefract,
    chromaticDispersionPx: input.preset === "liquid_glass" && input.tier === "T3" ? 1.5 : 0,
    sampleScale: tierScale,
  };
}

/** Sample bilinearly inside `bitmap` with clamped edge addressing. */
export function sampleBackdropBilinear(
  bitmap: RasterBitmap,
  x: number,
  y: number
): [number, number, number, number] {
  const w = bitmap.width;
  const h = bitmap.height;
  if (w <= 0 || h <= 0) return [0, 0, 0, 0];
  const cx = Math.max(0, Math.min(w - 1, x));
  const cy = Math.max(0, Math.min(h - 1, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;

  const d = bitmap.data;
  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  return [
    d[i00]! * w00 + d[i10]! * w10 + d[i01]! * w01 + d[i11]! * w11,
    d[i00 + 1]! * w00 + d[i10 + 1]! * w10 + d[i01 + 1]! * w01 + d[i11 + 1]! * w11,
    d[i00 + 2]! * w00 + d[i10 + 2]! * w10 + d[i01 + 2]! * w01 + d[i11 + 2]! * w11,
    d[i00 + 3]! * w00 + d[i10 + 3]! * w10 + d[i01 + 3]! * w01 + d[i11 + 3]! * w11,
  ];
}

function blurBackdropRegion(
  backdrop: RasterBitmap,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  radiusPx: number
): RasterBitmap {
  const r = Math.max(0, Math.min(12, Math.round(radiusPx)));
  const out = new Uint8ClampedArray(rw * rh * 4);
  if (r === 0) {
    for (let y = 0; y < rh; y += 1) {
      for (let x = 0; x < rw; x += 1) {
        const [cr, cg, cb, ca] = sampleBackdropBilinear(backdrop, rx + x, ry + y);
        const idx = (y * rw + x) * 4;
        out[idx] = clampByte(cr);
        out[idx + 1] = clampByte(cg);
        out[idx + 2] = clampByte(cb);
        out[idx + 3] = clampByte(ca);
      }
    }
    return { width: rw, height: rh, data: out };
  }

  const tmp = new Float32Array(rw * rh * 4);
  const span = r * 2 + 1;

  for (let y = 0; y < rh; y += 1) {
    for (let x = 0; x < rw; x += 1) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sa = 0;
      for (let k = -r; k <= r; k += 1) {
        const [cr, cg, cb, ca] = sampleBackdropBilinear(backdrop, rx + x + k, ry + y);
        sr += cr;
        sg += cg;
        sb += cb;
        sa += ca;
      }
      const idx = (y * rw + x) * 4;
      tmp[idx] = sr / span;
      tmp[idx + 1] = sg / span;
      tmp[idx + 2] = sb / span;
      tmp[idx + 3] = sa / span;
    }
  }

  for (let y = 0; y < rh; y += 1) {
    for (let x = 0; x < rw; x += 1) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sa = 0;
      for (let k = -r; k <= r; k += 1) {
        const sy = Math.max(0, Math.min(rh - 1, y + k));
        const sidx = (sy * rw + x) * 4;
        sr += tmp[sidx]!;
        sg += tmp[sidx + 1]!;
        sb += tmp[sidx + 2]!;
        sa += tmp[sidx + 3]!;
      }
      const idx = (y * rw + x) * 4;
      out[idx] = clampByte(sr / span);
      out[idx + 1] = clampByte(sg / span);
      out[idx + 2] = clampByte(sb / span);
      out[idx + 3] = clampByte(sa / span);
    }
  }

  return { width: rw, height: rh, data: out };
}

/**
 * Evaluate a liquid glass, magnifier lens, or frosted panel layer over a
 * scene backdrop raster bitmap using the layer's exact Phase 175 SDF.
 */
export function evaluateLiquidGlassOverlay(
  backdrop: RasterBitmap,
  lensSdf: LayerSdfResource,
  params: LiquidGlassParams
): LiquidGlassEvalResult {
  const tier = params.tier ?? "T2";
  const strategy = resolveGlassRenderStrategy({
    preset: params.preset,
    supportsBackdropFilter: params.supportsBackdropFilter ?? false,
    tier,
    blurRadiusPx: params.blurRadiusPx,
    refractionStrengthPx: params.refractionStrengthPx,
    reducedMotion: params.reducedMotion,
  });

  const w = Math.max(1, Math.round(lensSdf.width));
  const h = Math.max(1, Math.round(lensSdf.height));
  const pad = Math.ceil(strategy.effectiveRefractionPx + 4);
  const roi = blurBackdropRegion(
    backdrop,
    params.offsetX - pad,
    params.offsetY - pad,
    w + pad * 2,
    h + pad * 2,
    strategy.effectiveBlurPx
  );

  const out = new Uint8ClampedArray(w * h * 4);
  const bevelWidth = Math.max(2, params.bevelWidthPx ?? Math.min(w, h) * 0.22);
  const tint: RgbaColor = params.tintColor ?? { r: 230, g: 242, b: 255, a: 255 };
  const tintAlpha = Math.max(0, Math.min(0.85, params.tintOpacity ?? 0.16));
  const edgeLight = Math.max(0, Math.min(1, params.edgeLightIntensity ?? 0.85));
  const dispersion = params.chromaticAberrationPx ?? strategy.chromaticDispersionPx;
  const magnification = Math.max(1.05, params.magnification ?? 1.6);

  let coveredPixelCount = 0;
  let refractedPixelCount = 0;
  let rimHighlightPixelCount = 0;

  const cx = w * 0.5;
  const cy = h * 0.5;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const lx = x + 0.5;
      const ly = y + 0.5;
      const d = sampleSdfAt(lensSdf, lx, ly);
      const outIdx = (y * w + x) * 4;
      if (d > 0.75) continue;

      coveredPixelCount += 1;
      const coverage = d <= -0.5 ? 1 : Math.max(0, Math.min(1, 0.75 - d));

      // Central difference of SDF gives outward normal for refraction + bevel highlight
      const gx = (sampleSdfAt(lensSdf, lx + 1, ly) - sampleSdfAt(lensSdf, lx - 1, ly)) * 0.5;
      const gy = (sampleSdfAt(lensSdf, lx, ly + 1) - sampleSdfAt(lensSdf, lx, ly - 1)) * 0.5;
      const gLen = Math.hypot(gx, gy);
      const nx = gLen > 1e-5 ? gx / gLen : 0;
      const ny = gLen > 1e-5 ? gy / gLen : 0;

      let sampleX = lx + pad;
      let sampleY = ly + pad;

      if (params.preset === "liquid_glass" && strategy.effectiveRefractionPx > 0) {
        const edgeDepth = Math.max(0, 1 + d / bevelWidth);
        const rimProfile = Math.pow(edgeDepth, 1.5);
        if (rimProfile > 0.02) {
          refractedPixelCount += 1;
        }
        const shift = rimProfile * strategy.effectiveRefractionPx;
        sampleX -= nx * shift;
        sampleY -= ny * shift;
      } else if (params.preset === "magnifier_lens" && tier !== "T0") {
        const dx = lx - cx;
        const dy = ly - cy;
        const invMag = 1 / magnification;
        sampleX = cx + dx * invMag + pad;
        sampleY = cy + dy * invMag + pad;
        if (Math.hypot(dx, dy) > 1) {
          refractedPixelCount += 1;
        }
      }

      const [rCenter, gCenter, bCenter] = sampleBackdropBilinear(roi, sampleX, sampleY);
      let r = rCenter;
      const g = gCenter;
      let b = bCenter;

      if (dispersion > 0.05 && params.preset === "liquid_glass") {
        const [rShift] = sampleBackdropBilinear(roi, sampleX - nx * dispersion, sampleY - ny * dispersion);
        const [, , bShift] = sampleBackdropBilinear(roi, sampleX + nx * dispersion, sampleY + ny * dispersion);
        r = rShift;
        b = bShift;
      }

      // Blend subtle glass tint
      r = r * (1 - tintAlpha) + tint.r * tintAlpha;
      const gm = g * (1 - tintAlpha) + tint.g * tintAlpha;
      b = b * (1 - tintAlpha) + tint.b * tintAlpha;

      // Specular bevel highlight weighted toward top-left directional light (-0.707, -0.707)
      const rimMask = Math.exp(-Math.pow((d + 1.5) / 2.2, 2));
      const dirDot = Math.max(0, -(nx * 0.707 + ny * 0.707)) * 0.75 + 0.25;
      const highlight = rimMask * dirDot * edgeLight;
      if (highlight > 0.12) {
        rimHighlightPixelCount += 1;
      }

      out[outIdx] = clampByte(r + highlight * 220);
      out[outIdx + 1] = clampByte(gm + highlight * 230);
      out[outIdx + 2] = clampByte(b + highlight * 245);
      out[outIdx + 3] = clampByte(coverage * 255);
    }
  }

  return {
    bitmap: { width: w, height: h, data: out },
    strategy,
    coveredPixelCount,
    refractedPixelCount,
    rimHighlightPixelCount,
  };
}
