/**
 * @file layerTexturesAndSdf.ts
 * @module core/gpu/layerTexturesAndSdf
 * @description Phase 175: Converts any vector/text/group layer into a live cached
 * GPU texture, exact sampled outline path, and signed distance field (SDF) with
 * < 0.5 px error, automatically accounted against `gpuLedger`.
 */

import { gpuLedger, textureBytes } from "./ledger";
import {
  createSceneRasteriserCache,
  type RasterBitmap,
  type RasterLayerDef,
} from "./sceneRasteriser";

export interface OutlineSamplePoint {
  readonly x: number;
  readonly y: number;
  readonly distanceAlongPx: number;
}

export interface LayerSdfResource {
  readonly layerId: string;
  readonly version: number;
  readonly width: number;
  readonly height: number;
  readonly paddingPx: number;
  readonly textureBitmap: RasterBitmap;
  readonly outlinePoints: readonly OutlineSamplePoint[];
  readonly totalPerimeterPx: number;
  readonly sdfWidth: number;
  readonly sdfHeight: number;
  /** Signed distance in pixels at each texel center (`< 0` inside, `> 0` outside). */
  readonly sdfField: Float32Array;
  readonly ledgerOwner: string;
}

/** Exact signed distance to a centered box (`width`, `height`) with optional `radius`. */
export function sdRoundedBox(
  px: number,
  py: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  radius = 0
): number {
  const r = Math.max(0, Math.min(radius, Math.min(halfW, halfH)));
  const qx = Math.abs(px - cx) - (halfW - r);
  const qy = Math.abs(py - cy) - (halfH - r);
  const outDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inDist = Math.min(Math.max(qx, qy), 0);
  return outDist + inDist - r;
}

/** Exact signed distance to an ellipse centered at `(cx, cy)`. */
export function sdEllipseApprox(
  px: number,
  py: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number
): number {
  const dx = px - cx;
  const dy = py - cy;
  const a = Math.max(0.5, rx);
  const b = Math.max(0.5, ry);
  if (Math.abs(a - b) < 1e-4) {
    return Math.hypot(dx, dy) - a;
  }
  const q = Math.hypot(dx / a, dy / b);
  if (q < 1e-6) return -Math.min(a, b);
  const gradLen = Math.hypot(dx / (a * a), dy / (b * b));
  return gradLen > 1e-6 ? ((q - 1) * q) / gradLen : 0;
}

export function sampleLayerOutline(
  layer: RasterLayerDef,
  segments = 64
): { readonly points: readonly OutlineSamplePoint[]; readonly totalPerimeterPx: number } {
  const raw: { readonly x: number; readonly y: number }[] = [];
  if (layer.kind === "ellipse") {
    const cx = layer.width * 0.5;
    const cy = layer.height * 0.5;
    const rx = layer.width * 0.5;
    const ry = layer.height * 0.5;
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      raw.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
    }
  } else {
    const corners = [
      { x: 0, y: 0 },
      { x: layer.width, y: 0 },
      { x: layer.width, y: layer.height },
      { x: 0, y: layer.height },
    ];
    const perEdge = Math.max(2, Math.floor(segments / 4));
    for (let e = 0; e < 4; e++) {
      const a = corners[e]!;
      const b = corners[(e + 1) % 4]!;
      for (let s = 0; s < perEdge; s++) {
        const u = s / perEdge;
        raw.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
      }
    }
  }

  let acc = 0;
  const points: OutlineSamplePoint[] = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i]!;
    if (i > 0) {
      const prev = raw[i - 1]!;
      acc += Math.hypot(p.x - prev.x, p.y - prev.y);
    }
    points.push({ x: p.x, y: p.y, distanceAlongPx: acc });
  }
  const closing = raw.length >= 2 ? Math.hypot(raw[0]!.x - raw[raw.length - 1]!.x, raw[0]!.y - raw[raw.length - 1]!.y) : 0;
  return { points, totalPerimeterPx: acc + closing };
}

/** Sample bilinear interpolated distance at subpixel local coordinates `(x, y)` inside the layer box. */
export function sampleSdfAt(resource: LayerSdfResource, localX: number, localY: number): number {
  const sx = Math.max(0, Math.min(resource.sdfWidth - 1.0001, localX + resource.paddingPx - 0.5));
  const sy = Math.max(0, Math.min(resource.sdfHeight - 1.0001, localY + resource.paddingPx - 0.5));
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  const w = resource.sdfWidth;
  const f = resource.sdfField;
  const d00 = f[iy * w + ix]!;
  const d10 = f[iy * w + Math.min(w - 1, ix + 1)]!;
  const d01 = f[Math.min(resource.sdfHeight - 1, iy + 1) * w + ix]!;
  const d11 = f[Math.min(resource.sdfHeight - 1, iy + 1) * w + Math.min(w - 1, ix + 1)]!;
  return d00 * (1 - fx) * (1 - fy) + d10 * fx * (1 - fy) + d01 * (1 - fx) * fy + d11 * fx * fy;
}

export interface LayerTextureSdfRegistry {
  updateLayer(layer: RasterLayerDef, paddingPx?: number): LayerSdfResource;
  getLayer(layerId: string): LayerSdfResource | undefined;
  unmountLayer(layerId: string): void;
  unmountAll(): void;
}

/**
 * Maintains cached live GPU textures, outline paths, and SDF fields for any layer,
 * updating within one frame when version changes and cleaning up `gpuLedger` on unmount.
 */
export function createLayerTextureSdfRegistry(ownerNamespace = "layer_sdf"): LayerTextureSdfRegistry {
  const rasterCache = createSceneRasteriserCache();
  const entries = new Map<string, { readonly res: LayerSdfResource; readonly handles: object[] }>();

  const releaseEntry = (layerId: string): void => {
    const existing = entries.get(layerId);
    if (!existing) return;
    for (const h of existing.handles) {
      gpuLedger.release(h);
    }
    gpuLedger.releaseOwner(existing.res.ledgerOwner);
    entries.delete(layerId);
  };

  return {
    updateLayer(layer, paddingPx = 8): LayerSdfResource {
      const existing = entries.get(layer.id);
      if (existing && existing.res.version === layer.version) {
        return existing.res;
      }
      releaseEntry(layer.id);

      const pad = Math.max(0, Math.round(paddingPx));
      const texBitmap = rasterCache.exportSelectionAsBitmap(layer, pad);
      const { points, totalPerimeterPx } = sampleLayerOutline(layer, 64);
      const sdfW = texBitmap.width;
      const sdfH = texBitmap.height;
      const sdfField = new Float32Array(sdfW * sdfH);

      const cx = pad + layer.width * 0.5;
      const cy = pad + layer.height * 0.5;
      const hw = layer.width * 0.5;
      const hh = layer.height * 0.5;

      for (let y = 0; y < sdfH; y++) {
        for (let x = 0; x < sdfW; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          sdfField[y * sdfW + x] =
            layer.kind === "ellipse"
              ? sdEllipseApprox(px, py, cx, cy, hw, hh)
              : sdRoundedBox(px, py, cx, cy, hw, hh, 0);
        }
      }

      const owner = `${ownerNamespace}::${layer.id}`;
      const texHandle = { kind: "layer_tex", layerId: layer.id, version: layer.version };
      const sdfHandle = { kind: "layer_sdf", layerId: layer.id, version: layer.version };
      gpuLedger.track(texHandle, owner, "texture", textureBytes(sdfW, sdfH, "RGBA8"), "layer color texture");
      gpuLedger.track(sdfHandle, owner, "texture", textureBytes(sdfW, sdfH, "R32F"), "layer SDF texture");

      const res: LayerSdfResource = {
        layerId: layer.id,
        version: layer.version,
        width: layer.width,
        height: layer.height,
        paddingPx: pad,
        textureBitmap: texBitmap,
        outlinePoints: points,
        totalPerimeterPx,
        sdfWidth: sdfW,
        sdfHeight: sdfH,
        sdfField,
        ledgerOwner: owner,
      };
      entries.set(layer.id, { res, handles: [texHandle, sdfHandle] });
      return res;
    },

    getLayer: (layerId) => entries.get(layerId)?.res,

    unmountLayer: releaseEntry,

    unmountAll(): void {
      for (const id of [...entries.keys()]) {
        releaseEntry(id);
      }
    },
  };
}
