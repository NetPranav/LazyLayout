/**
 * @file effectLayers.ts
 * @module core/gpu/effectLayers
 * @description Phase 179: Adjustment-layer style Effect Layers (`dither`, `pixelate`,
 * `chromatic_split`, `displacement`, `halftone`, `glitch`, `colour_grade`, `threshold_ink`),
 * scoped either to everything below in its parent or to a single target layer, with
 * masks, blend modes (`normal`, `multiply`, `screen`, `overlay`), deterministic CPU/GPU
 * reference evaluation, and preservation of real accessible DOM text underneath.
 */

import type { RasterBitmap } from "./sceneRasteriser";

export type EffectLayerPreset =
  | "dither"
  | "pixelate"
  | "chromatic_split"
  | "displacement"
  | "halftone"
  | "glitch"
  | "colour_grade"
  | "threshold_ink";

export type EffectBlendMode = "normal" | "multiply" | "screen" | "overlay";

export type EffectLayerScope =
  | { readonly kind: "below_in_parent"; readonly parentId: string; readonly effectLayerIndex: number }
  | { readonly kind: "target_layer"; readonly targetLayerId: string };

export interface EffectLayerConfig {
  readonly id: string;
  readonly preset: EffectLayerPreset;
  readonly scope: EffectLayerScope;
  readonly intensity: number; // 0..1
  readonly blendMode: EffectBlendMode;
  readonly opacity: number; // 0..1
  readonly timeSec?: number;
  readonly maskRect?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

export interface ParentChildOrderItem {
  readonly id: string;
  readonly isDomText: boolean;
}

export interface EffectTargetResolution {
  readonly affectedLayerIds: readonly string[];
  readonly preservesRealDomText: true;
  readonly domOverlayMode: "aria_real_text_preserved";
}

/** Resolve which layers in a parent group fall underneath an adjustment effect layer. */
export function resolveEffectLayerTargets(
  parentChildrenInDrawOrder: readonly ParentChildOrderItem[],
  config: EffectLayerConfig
): EffectTargetResolution {
  if (config.scope.kind === "target_layer") {
    const tid = config.scope.targetLayerId;
    return {
      affectedLayerIds: parentChildrenInDrawOrder.filter((c) => c.id === tid).map((c) => c.id),
      preservesRealDomText: true,
      domOverlayMode: "aria_real_text_preserved",
    };
  }
  const cutoff = Math.max(0, Math.min(parentChildrenInDrawOrder.length, config.scope.effectLayerIndex));
  return {
    affectedLayerIds: parentChildrenInDrawOrder.slice(0, cutoff).map((c) => c.id),
    preservesRealDomText: true,
    domOverlayMode: "aria_real_text_preserved",
  };
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function applyBlendChannel(base: number, fx: number, mode: EffectBlendMode): number {
  const b = base / 255;
  const f = fx / 255;
  let r = f;
  if (mode === "multiply") {
    r = b * f;
  } else if (mode === "screen") {
    r = 1 - (1 - b) * (1 - f);
  } else if (mode === "overlay") {
    r = b < 0.5 ? 2 * b * f : 1 - 2 * (1 - b) * (1 - f);
  }
  return clampByte(r * 255);
}

// Ordered 4x4 Bayer threshold matrix normalized to [0..1)
const BAYER_4X4 = [
  0 / 16, 8 / 16, 2 / 16, 10 / 16,
  12 / 16, 4 / 16, 14 / 16, 6 / 16,
  3 / 16, 11 / 16, 1 / 16, 9 / 16,
  15 / 16, 7 / 16, 13 / 16, 5 / 16,
];

/** Deterministic pixel processor for all 8 reference Effect Layer presets with mask + blend modes. */
export function applyEffectLayerToBitmap(source: RasterBitmap, config: EffectLayerConfig): RasterBitmap {
  const { width, height, data } = source;
  const out = new Uint8ClampedArray(data.length);
  const intensity = Math.max(0, Math.min(1, config.intensity));
  const opacity = Math.max(0, Math.min(1, config.opacity));
  const t = config.timeSec ?? 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const br = data[idx]!;
      const bg = data[idx + 1]!;
      const bb = data[idx + 2]!;
      const ba = data[idx + 3]!;

      if (config.maskRect) {
        const m = config.maskRect;
        if (x < m.x || x >= m.x + m.width || y < m.y || y >= m.y + m.height) {
          out[idx] = br;
          out[idx + 1] = bg;
          out[idx + 2] = bb;
          out[idx + 3] = ba;
          continue;
        }
      }

      let fxR = br;
      let fxG = bg;
      let fxB = bb;

      switch (config.preset) {
        case "dither": {
          const lum = (0.299 * br + 0.587 * bg + 0.114 * bb) / 255;
          const threshold = BAYER_4X4[(y & 3) * 4 + (x & 3)]!;
          const q = lum > threshold ? 255 : 12;
          fxR = br + (q - br) * intensity;
          fxG = bg + (q - bg) * intensity;
          fxB = bb + (q - bb) * intensity;
          break;
        }
        case "pixelate": {
          const cell = Math.max(2, Math.round(2 + intensity * 10));
          const sx = Math.min(width - 1, Math.floor(x / cell) * cell);
          const sy = Math.min(height - 1, Math.floor(y / cell) * cell);
          const sIdx = (sy * width + sx) * 4;
          fxR = data[sIdx]!;
          fxG = data[sIdx + 1]!;
          fxB = data[sIdx + 2]!;
          break;
        }
        case "chromatic_split": {
          const shift = Math.round(intensity * 6);
          const rx = Math.max(0, Math.min(width - 1, x + shift));
          const bx = Math.max(0, Math.min(width - 1, x - shift));
          fxR = data[(y * width + rx) * 4]!;
          fxG = bg;
          fxB = data[(y * width + bx) * 4 + 2]!;
          break;
        }
        case "displacement": {
          const dx = Math.round(Math.sin(y * 0.25 + t * 3) * intensity * 5);
          const sx = Math.max(0, Math.min(width - 1, x + dx));
          const sIdx = (y * width + sx) * 4;
          fxR = data[sIdx]!;
          fxG = data[sIdx + 1]!;
          fxB = data[sIdx + 2]!;
          break;
        }
        case "halftone": {
          const dot = ((x % 4) - 1.5) ** 2 + ((y % 4) - 1.5) ** 2;
          const lum = (0.299 * br + 0.587 * bg + 0.114 * bb) / 255;
          const radiusSq = (1 - lum * intensity) * 4.2;
          const v = dot <= radiusSq ? 24 : 240;
          fxR = v;
          fxG = v;
          fxB = v;
          break;
        }
        case "glitch": {
          const band = Math.floor(y / 6);
          const tear = band % 3 === 0 ? Math.round(Math.sin(band * 7 + t * 10) * intensity * 8) : 0;
          const sx = (x + tear + width) % width;
          const sIdx = (y * width + sx) * 4;
          fxR = data[sIdx]!;
          fxG = bg;
          fxB = data[sIdx + 2]!;
          break;
        }
        case "colour_grade": {
          fxR = clampByte(br * (1 + 0.25 * intensity));
          fxG = clampByte(bg * (1 + 0.05 * intensity));
          fxB = clampByte(bb * (1 - 0.18 * intensity));
          break;
        }
        case "threshold_ink": {
          const lum = 0.299 * br + 0.587 * bg + 0.114 * bb;
          const dark = lum < 128;
          fxR = dark ? 18 : 246;
          fxG = dark ? 22 : 244;
          fxB = dark ? 30 : 238;
          break;
        }
      }

      const blendedR = applyBlendChannel(br, fxR, config.blendMode);
      const blendedG = applyBlendChannel(bg, fxG, config.blendMode);
      const blendedB = applyBlendChannel(bb, fxB, config.blendMode);

      out[idx] = clampByte(br * (1 - opacity) + blendedR * opacity);
      out[idx + 1] = clampByte(bg * (1 - opacity) + blendedG * opacity);
      out[idx + 2] = clampByte(bb * (1 - opacity) + blendedB * opacity);
      out[idx + 3] = ba;
    }
  }

  return { width, height, data: out };
}
