/**
 * @file outlineEffects.ts
 * @module core/gpu/outlineEffects
 * @description Phase 180: Layer outline & signed-distance-field driven lighting
 * effects (`electric_border`, `travelling_star`, `corner_light_pour`,
 * `liquid_metal_fill`, `cursor_rim_glow`, `neon_pulse`) with low-tier budget guards.
 */

import { sampleSdfAt, type LayerSdfResource } from "./layerTexturesAndSdf";
import type { RasterBitmap } from "./sceneRasteriser";

export type OutlineEffectKind =
  | "electric_border"
  | "travelling_star"
  | "corner_light_pour"
  | "liquid_metal_fill"
  | "cursor_rim_glow"
  | "neon_pulse";

export interface OutlineEffectParams {
  readonly kind: OutlineEffectKind;
  readonly timeSec: number;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly thicknessPx?: number;
  readonly intensity?: number;
  readonly tier?: "T0" | "T1" | "T2" | "T3";
}

export interface OutlineEffectEvalResult {
  readonly bitmap: RasterBitmap;
  readonly litPixelCount: number;
  readonly qualityScale: number;
  readonly estimatedCostMs: number;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Evaluate exact outline/SDF driven lighting into an overlay bitmap aligned with `sdfRes`. */
export function evaluateOutlineEffectOverlay(
  sdfRes: LayerSdfResource,
  params: OutlineEffectParams
): OutlineEffectEvalResult {
  const tier = params.tier ?? "T2";
  const qualityScale = tier === "T0" ? 0.5 : tier === "T1" ? 0.75 : 1;
  const w = sdfRes.sdfWidth;
  const h = sdfRes.sdfHeight;
  const out = new Uint8ClampedArray(w * h * 4);
  const thick = Math.max(1.5, params.thicknessPx ?? 4) * (tier === "T0" ? 0.8 : 1);
  const strength = Math.max(0, Math.min(2, params.intensity ?? 1));

  // Travelling star position on real sampled outline
  const pts = sdfRes.outlinePoints;
  const phase = ((params.timeSec * 0.45) % 1 + 1) % 1;
  const starIdx = pts.length > 0 ? Math.floor(phase * pts.length) % pts.length : 0;
  const starPt = pts[starIdx] ?? { x: sdfRes.width * 0.5, y: 0, distanceAlongPx: 0 };

  let litPixelCount = 0;

  for (let y = 0; y < h; y++) {
    const localY = y - sdfRes.paddingPx + 0.5;
    for (let x = 0; x < w; x++) {
      const localX = x - sdfRes.paddingPx + 0.5;
      const d = sampleSdfAt(sdfRes, localX, localY);

      let lum = 0;
      let r = 255;
      let g = 255;
      let b = 255;

      switch (params.kind) {
        case "electric_border": {
          const crackle = Math.sin(localX * 0.45 + params.timeSec * 14) * Math.cos(localY * 0.45 - params.timeSec * 11);
          const distToArc = Math.abs(d - crackle * 1.6);
          lum = Math.exp(-(distToArc * distToArc) / (thick * 0.8));
          r = 120;
          g = 210;
          b = 255;
          break;
        }
        case "travelling_star": {
          const dx = localX - starPt.x;
          const dy = localY - starPt.y;
          const ptDist = Math.hypot(dx, dy);
          const core = Math.exp(-ptDist / (thick * 1.4));
          const halo = Math.exp(-Math.abs(d) / thick) * 0.35;
          lum = core + halo;
          r = 255;
          g = 236;
          b = 150;
          break;
        }
        case "corner_light_pour": {
          const dLeft = Math.abs(localX);
          const dTop = Math.abs(localY);
          const cornerFocus = Math.exp(-(dLeft + dTop) * 0.08);
          lum = Math.exp(-Math.abs(d) / (thick * 1.5)) * (0.3 + 0.9 * cornerFocus);
          r = 255;
          g = 195;
          b = 110;
          break;
        }
        case "liquid_metal_fill": {
          if (d <= 0) {
            const spec = Math.pow(0.5 + 0.5 * Math.sin(d * 0.35 + params.timeSec * 3.5 + localX * 0.08), 3);
            lum = 0.25 + 0.75 * spec;
            r = 200;
            g = 220;
            b = 245;
          }
          break;
        }
        case "cursor_rim_glow": {
          const cDist = Math.hypot(localX - params.pointerX, localY - params.pointerY);
          const edgeMask = Math.exp(-Math.abs(d) / thick);
          const cursorFalloff = Math.exp(-cDist / 48);
          lum = edgeMask * (0.15 + 1.25 * cursorFalloff);
          r = 160;
          g = 240;
          b = 255;
          break;
        }
        case "neon_pulse": {
          const wave = 0.55 + 0.45 * Math.sin(params.timeSec * 5);
          lum = Math.exp(-Math.abs(d) / (thick * 1.3)) * wave;
          r = 245;
          g = 90;
          b = 220;
          break;
        }
      }

      const alpha = Math.max(0, Math.min(1, lum * strength * qualityScale));
      if (alpha > 0.01) {
        const idx = (y * w + x) * 4;
        out[idx] = clampByte(r);
        out[idx + 1] = clampByte(g);
        out[idx + 2] = clampByte(b);
        out[idx + 3] = clampByte(alpha * 255);
        litPixelCount++;
      }
    }
  }

  return {
    bitmap: { width: w, height: h, data: out },
    litPixelCount,
    qualityScale,
    estimatedCostMs: Number((0.45 * qualityScale).toFixed(2)),
  };
}
