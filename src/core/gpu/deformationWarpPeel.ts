/**
 * @file deformationWarpPeel.ts
 * @module core/gpu/deformationWarpPeel
 * @description Phase 185: Mesh warp modifiers (`envelope`, `bend`, `bulge`,
 * `wave`, `flag`) and corner/edge curl/peel (`sticker_peel`, `page_curl`)
 * rendered from Phase 175 cached layer textures while leaving the underlying
 * real DOM node & accessibility tree completely unaltered.
 */

import type { LayerSdfResource } from "./layerTexturesAndSdf";
import type { RasterBitmap } from "./sceneRasteriser";

export type DeformationModifierKind =
  | "envelope"
  | "bend"
  | "bulge"
  | "wave"
  | "flag"
  | "sticker_peel"
  | "page_curl";

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export interface EnvelopeCorners {
  readonly topLeft: Point2;
  readonly topRight: Point2;
  readonly bottomLeft: Point2;
  readonly bottomRight: Point2;
}

export interface DeformationParams {
  readonly kind: DeformationModifierKind;
  readonly progress?: number; // 0..1 (e.g. peel amount or input bind)
  readonly strength?: number;
  readonly frequency?: number;
  readonly phaseRad?: number;
  readonly curlRadiusPx?: number;
  readonly peelCorner?: "top_right" | "bottom_right" | "bottom_left" | "top_left";
  readonly centerNorm?: Point2;
  readonly envelope?: EnvelopeCorners;
  readonly gridCols?: number;
  readonly gridRows?: number;
}

export interface DeformedMeshVertex {
  readonly u: number;
  readonly v: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly isBackface: boolean;
  readonly shadowFactor: number; // 0..1 darkening from curl crease
}

export interface DeformedMeshResult {
  readonly kind: DeformationModifierKind;
  readonly cols: number;
  readonly rows: number;
  readonly vertices: readonly DeformedMeshVertex[];
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
  readonly domAccessibilityPreserved: true;
  readonly domNodeHiddenFromLayout: false;
  readonly ariaAttributeMutationCount: 0;
}

export interface DeformedBitmapResult {
  readonly mesh: DeformedMeshResult;
  readonly bitmap: RasterBitmap;
  readonly backfacePixelCount: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map normalized `(u, v)` through any deformation or curl modifier onto `(x, y, z)`. */
export function evaluateDeformedPoint(
  u: number,
  v: number,
  width: number,
  height: number,
  params: DeformationParams
): DeformedMeshVertex {
  const x0 = u * width;
  const y0 = v * height;
  const strength = params.strength ?? 0.35;
  const phase = params.phaseRad ?? 0;

  switch (params.kind) {
    case "envelope": {
      const env = params.envelope ?? {
        topLeft: { x: 0, y: 0 },
        topRight: { x: width, y: 0 },
        bottomLeft: { x: 0, y: height },
        bottomRight: { x: width, y: height },
      };
      const topX = lerp(env.topLeft.x, env.topRight.x, u);
      const topY = lerp(env.topLeft.y, env.topRight.y, u);
      const botX = lerp(env.bottomLeft.x, env.bottomRight.x, u);
      const botY = lerp(env.bottomLeft.y, env.bottomRight.y, u);
      return {
        u,
        v,
        x: lerp(topX, botX, v),
        y: lerp(topY, botY, v),
        z: 0,
        isBackface: false,
        shadowFactor: 1,
      };
    }

    case "bend": {
      const maxAngle = strength * 1.2;
      const angle = (u - 0.5) * maxAngle;
      const arcOffsetY = (1 - Math.cos(angle)) * width * 0.45;
      const x = width * 0.5 + Math.sin(angle) * (width * 0.5 / Math.max(1e-3, maxAngle * 0.5)) * (maxAngle === 0 ? (u - 0.5) : 1);
      return {
        u,
        v,
        x: Math.abs(maxAngle) < 1e-4 ? x0 : lerp(x0, x, 0.7),
        y: y0 - arcOffsetY * (strength >= 0 ? 1 : -1),
        z: Math.sin(angle) * 16,
        isBackface: false,
        shadowFactor: 1 - Math.abs(Math.sin(angle)) * 0.12,
      };
    }

    case "bulge": {
      const cx = (params.centerNorm?.x ?? 0.5) * width;
      const cy = (params.centerNorm?.y ?? 0.5) * height;
      const dx = x0 - cx;
      const dy = y0 - cy;
      const maxR = Math.hypot(width, height) * 0.5;
      const r = Math.hypot(dx, dy);
      const rn = Math.min(1, r / Math.max(1, maxR));
      const scale = 1 + strength * (1 - rn * rn);
      return {
        u,
        v,
        x: cx + dx * scale,
        y: cy + dy * scale,
        z: (1 - rn * rn) * strength * 40,
        isBackface: false,
        shadowFactor: 1,
      };
    }

    case "wave": {
      const freq = params.frequency ?? 2.5;
      const amp = strength * height * 0.25;
      const dispY = Math.sin(u * Math.PI * 2 * freq + phase) * amp;
      return {
        u,
        v,
        x: x0,
        y: y0 + dispY,
        z: Math.cos(u * Math.PI * 2 * freq + phase) * amp * 0.5,
        isBackface: false,
        shadowFactor: 1 - Math.max(0, -Math.sin(u * Math.PI * 2 * freq + phase)) * 0.15,
      };
    }

    case "flag": {
      const freq = params.frequency ?? 2;
      const amp = strength * height * 0.28 * u; // pinned at u=0 left edge
      const dispY = Math.sin(u * Math.PI * 2 * freq - phase) * amp;
      const dispX = -Math.pow(u, 2) * strength * width * 0.08;
      return {
        u,
        v,
        x: x0 + dispX,
        y: y0 + dispY,
        z: Math.sin(u * Math.PI * 2 * freq - phase) * amp * 0.6,
        isBackface: false,
        shadowFactor: 1 - u * 0.12 * (0.5 + 0.5 * Math.cos(u * Math.PI * 2 * freq - phase)),
      };
    }

    case "sticker_peel":
    case "page_curl": {
      const progress = clamp(params.progress ?? 0.35, 0, 1);
      const radius = Math.max(6, params.curlRadiusPx ?? Math.min(width, height) * 0.16);
      const corner = params.peelCorner ?? "bottom_right";

      // Compute normalized corner coordinate in [0..1] along peel diagonal
      const px = corner === "bottom_right" || corner === "top_right" ? u : 1 - u;
      const py = corner === "bottom_right" || corner === "bottom_left" ? v : 1 - v;
      const diag = (px + py) * 0.5;
      const foldDiag = 1 - progress * 0.9;

      if (diag <= foldDiag) {
        // Still flat against surface, subtle shadow near crease
        const nearCrease = Math.exp(-Math.pow((foldDiag - diag) * 20, 2));
        return {
          u,
          v,
          x: x0,
          y: y0,
          z: 0,
          isBackface: false,
          shadowFactor: 1 - nearCrease * 0.25,
        };
      }

      // Rolled across cylindrical curl axis & reflected onto backside
      const over = (diag - foldDiag) * Math.hypot(width, height) * 0.5;
      const theta = Math.min(Math.PI, over / radius);
      const dirX = corner === "bottom_right" || corner === "top_right" ? -1 : 1;
      const dirY = corner === "bottom_right" || corner === "bottom_left" ? -1 : 1;
      const isBackface = theta > Math.PI * 0.45;
      const pull = (1 - Math.cos(theta)) * radius + Math.max(0, over - Math.PI * radius * 0.5);

      return {
        u,
        v,
        x: x0 + dirX * pull * 0.707,
        y: y0 + dirY * pull * 0.707,
        z: Math.sin(theta) * radius,
        isBackface,
        shadowFactor: isBackface ? 0.88 : 1,
      };
    }
  }
}

/** Generate complete deformed triangle-grid mesh over `(width, height)`. */
export function buildDeformedMesh(
  width: number,
  height: number,
  params: DeformationParams
): DeformedMeshResult {
  const cols = Math.max(2, Math.min(48, params.gridCols ?? 16));
  const rows = Math.max(2, Math.min(48, params.gridRows ?? 12));
  const vertices: DeformedMeshVertex[] = [];

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let r = 0; r <= rows; r += 1) {
    const v = r / rows;
    for (let c = 0; c <= cols; c += 1) {
      const u = c / cols;
      const pt = evaluateDeformedPoint(u, v, width, height, params);
      vertices.push(pt);
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
  }

  return {
    kind: params.kind,
    cols,
    rows,
    vertices,
    bounds: { minX, minY, maxX, maxY },
    domAccessibilityPreserved: true,
    domNodeHiddenFromLayout: false,
    ariaAttributeMutationCount: 0,
  };
}

/** Render deformed mesh forward-splatted from Phase 175 `LayerSdfResource` texture. */
export function rasteriseDeformedLayer(
  layerSdf: LayerSdfResource,
  params: DeformationParams
): DeformedBitmapResult {
  const w = Math.max(1, Math.round(layerSdf.width));
  const h = Math.max(1, Math.round(layerSdf.height));
  const mesh = buildDeformedMesh(w, h, params);
  const out = new Uint8ClampedArray(w * h * 4);
  let backfacePixelCount = 0;

  const src = layerSdf.textureBitmap;
  for (let y = 0; y < h; y += 1) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x += 1) {
      const u = (x + 0.5) / w;
      const pt = evaluateDeformedPoint(u, v, w, h, params);
      const dx = Math.round(pt.x);
      const dy = Math.round(pt.y);
      if (dx < 0 || dx >= w || dy < 0 || dy >= h) continue;

      const sx = Math.min(src.width - 1, Math.max(0, Math.round(x + layerSdf.paddingPx)));
      const sy = Math.min(src.height - 1, Math.max(0, Math.round(y + layerSdf.paddingPx)));
      const sidx = (sy * src.width + sx) * 4;
      const alpha = src.data[sidx + 3]!;
      if (alpha === 0) continue;

      const didx = (dy * w + dx) * 4;
      if (pt.isBackface) {
        backfacePixelCount += 1;
        out[didx] = Math.round(235 * pt.shadowFactor);
        out[didx + 1] = Math.round(238 * pt.shadowFactor);
        out[didx + 2] = Math.round(244 * pt.shadowFactor);
      } else {
        out[didx] = Math.round(src.data[sidx]! * pt.shadowFactor);
        out[didx + 1] = Math.round(src.data[sidx + 1]! * pt.shadowFactor);
        out[didx + 2] = Math.round(src.data[sidx + 2]! * pt.shadowFactor);
      }
      out[didx + 3] = alpha;
    }
  }

  return {
    mesh,
    bitmap: { width: w, height: h, data: out },
    backfacePixelCount,
  };
}
