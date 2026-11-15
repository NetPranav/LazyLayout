/**
 * @file sceneRasteriser.ts
 * @module core/gpu/sceneRasteriser
 * @description Phase 172 (Decision Record 0016): In-house scene & selection
 * rasteriser built directly from canonical stage render definitions (Law 11),
 * featuring per-layer content hashing and dirty-region incremental redraw.
 */

export interface RgbaColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number; // 0..255
}

export type RasterLayerKind = "rectangle" | "ellipse" | "text" | "image" | "group";

export interface RasterLayerDef {
  readonly id: string;
  readonly kind: RasterLayerKind;
  readonly version: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill?: RgbaColor;
  readonly stroke?: { readonly color: RgbaColor; readonly widthPx: number };
  readonly opacity?: number; // 0..1
  readonly maskedByBounds?: boolean;
  readonly effectShadowRadius?: number;
  readonly children?: readonly RasterLayerDef[];
}

export interface RasterBitmap {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface IncrementalRasterStats {
  readonly redrawnLayerIds: readonly string[];
  readonly reusedLayerIds: readonly string[];
  readonly dirtyPixels: number;
  readonly elapsedMs: number;
}

export interface SceneRasteriserCache {
  rasteriseFrame(
    layers: readonly RasterLayerDef[],
    width?: number,
    height?: number
  ): { readonly bitmap: RasterBitmap; readonly stats: IncrementalRasterStats };
  exportSelectionAsBitmap(layer: RasterLayerDef, paddingPx?: number): RasterBitmap;
  clear(): void;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function blendPixel(
  buf: Uint8ClampedArray,
  idx: number,
  sr: number,
  sg: number,
  sb: number,
  sa: number
): void {
  if (sa <= 0) return;
  const alpha = sa / 255;
  const invAlpha = 1 - alpha;
  buf[idx] = clampByte(sr * alpha + buf[idx]! * invAlpha);
  buf[idx + 1] = clampByte(sg * alpha + buf[idx + 1]! * invAlpha);
  buf[idx + 2] = clampByte(sb * alpha + buf[idx + 2]! * invAlpha);
  buf[idx + 3] = clampByte(sa + buf[idx + 3]! * invAlpha);
}

function paintLayerPixels(
  buf: Uint8ClampedArray,
  bufWidth: number,
  bufHeight: number,
  layer: RasterLayerDef,
  offsetX = 0,
  offsetY = 0
): number {
  const x0 = Math.max(0, Math.floor(layer.x + offsetX));
  const y0 = Math.max(0, Math.floor(layer.y + offsetY));
  const x1 = Math.min(bufWidth, Math.ceil(layer.x + offsetX + layer.width));
  const y1 = Math.min(bufHeight, Math.ceil(layer.y + offsetY + layer.height));

  if (layer.kind === "group" && layer.children) {
    let drawn = 0;
    for (const child of layer.children) {
      drawn += paintLayerPixels(buf, bufWidth, bufHeight, child, offsetX, offsetY);
    }
    return drawn;
  }

  const opacity = Math.max(0, Math.min(1, layer.opacity ?? 1));
  const fill = layer.fill;
  const stroke = layer.stroke;
  const cx = layer.x + offsetX + layer.width * 0.5;
  const cy = layer.y + offsetY + layer.height * 0.5;
  const rx = Math.max(0.5, layer.width * 0.5);
  const ry = Math.max(0.5, layer.height * 0.5);
  let touched = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let inside = true;
      let onStroke = false;

      if (layer.kind === "ellipse") {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const normDist = dx * dx + dy * dy;
        inside = normDist <= 1;
        if (stroke && stroke.widthPx > 0) {
          const innerRx = Math.max(0.1, rx - stroke.widthPx);
          const innerRy = Math.max(0.1, ry - stroke.widthPx);
          const innerDist = Math.pow((x + 0.5 - cx) / innerRx, 2) + Math.pow((y + 0.5 - cy) / innerRy, 2);
          onStroke = inside && innerDist >= 1;
        }
      } else if (stroke && stroke.widthPx > 0) {
        const sw = stroke.widthPx;
        onStroke =
          x < x0 + sw ||
          x >= x1 - sw ||
          y < y0 + sw ||
          y >= y1 - sw;
      }

      if (!inside) continue;

      const idx = (y * bufWidth + x) * 4;
      if (onStroke && stroke) {
        blendPixel(
          buf,
          idx,
          stroke.color.r,
          stroke.color.g,
          stroke.color.b,
          stroke.color.a * opacity
        );
      } else if (fill) {
        blendPixel(buf, idx, fill.r, fill.g, fill.b, fill.a * opacity);
      }
      touched++;
    }
  }
  return touched;
}

function layerVersionSignature(layer: RasterLayerDef): string {
  const childSig = layer.children ? layer.children.map(layerVersionSignature).join(",") : "";
  return `${layer.id}:${layer.version}:${layer.x}:${layer.y}:${layer.width}:${layer.height}:${layer.opacity ?? 1}:${childSig}`;
}

/**
 * Incremental dirty-region rasteriser: caches immutable per-layer pixel tiles
 * keyed by render definition signature so unedited layers are blitted directly.
 */
export function createSceneRasteriserCache(): SceneRasteriserCache {
  const layerTiles = new Map<
    string,
    { readonly signature: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly data: Uint8ClampedArray }
  >();

  return {
    rasteriseFrame(layers, width = 1440, height = 900) {
      const startMs = typeof performance !== "undefined" ? performance.now() : Date.now();
      const out = new Uint8ClampedArray(width * height * 4);
      const redrawnLayerIds: string[] = [];
      const reusedLayerIds: string[] = [];
      let dirtyPixels = 0;

      for (const layer of layers) {
        const sig = layerVersionSignature(layer);
        const w = Math.max(1, Math.ceil(layer.width));
        const h = Math.max(1, Math.ceil(layer.height));
        let tile = layerTiles.get(layer.id);

        if (!tile || tile.signature !== sig) {
          const tileBuf = new Uint8ClampedArray(w * h * 4);
          paintLayerPixels(tileBuf, w, h, layer, -layer.x, -layer.y);
          tile = { signature: sig, x: Math.floor(layer.x), y: Math.floor(layer.y), width: w, height: h, data: tileBuf };
          layerTiles.set(layer.id, tile);
          redrawnLayerIds.push(layer.id);
          dirtyPixels += w * h;
        } else {
          reusedLayerIds.push(layer.id);
        }

        // Composite tile onto frame buffer
        const startX = Math.max(0, tile.x);
        const startY = Math.max(0, tile.y);
        const endX = Math.min(width, tile.x + tile.width);
        const endY = Math.min(height, tile.y + tile.height);
        for (let y = startY; y < endY; y++) {
          const ty = y - tile.y;
          for (let x = startX; x < endX; x++) {
            const tx = x - tile.x;
            const srcIdx = (ty * tile.width + tx) * 4;
            const a = tile.data[srcIdx + 3]!;
            if (a === 0) continue;
            const dstIdx = (y * width + x) * 4;
            blendPixel(out, dstIdx, tile.data[srcIdx]!, tile.data[srcIdx + 1]!, tile.data[srcIdx + 2]!, a);
          }
        }
      }

      const endMs = typeof performance !== "undefined" ? performance.now() : Date.now();
      return {
        bitmap: { width, height, data: out },
        stats: {
          redrawnLayerIds,
          reusedLayerIds,
          dirtyPixels,
          elapsedMs: Number((endMs - startMs).toFixed(3)),
        },
      };
    },

    exportSelectionAsBitmap(layer, paddingPx = 0): RasterBitmap {
      const pad = Math.max(0, Math.round(paddingPx));
      const w = Math.max(1, Math.ceil(layer.width) + pad * 2);
      const h = Math.max(1, Math.ceil(layer.height) + pad * 2);
      const data = new Uint8ClampedArray(w * h * 4);
      paintLayerPixels(data, w, h, layer, -layer.x + pad, -layer.y + pad);
      return { width: w, height: h, data };
    },

    clear(): void {
      layerTiles.clear();
    },
  };
}

/** Measure normalized pixel difference percentage (0..100%) between two equally sized bitmaps. */
export function measureBitmapDiffPercent(a: RasterBitmap, b: RasterBitmap): number {
  if (a.width !== b.width || a.height !== b.height) return 100;
  let totalDiff = 0;
  const totalChannels = a.data.length || 1;
  for (let i = 0; i < a.data.length; i++) {
    totalDiff += Math.abs(a.data[i]! - b.data[i]!) / 255;
  }
  return (totalDiff / totalChannels) * 100;
}
