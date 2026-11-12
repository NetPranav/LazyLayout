/**
 * ============================================================================
 * LAYER SOURCES FOR 3D: OUTLINES, SDF & TEXTURES (ROADMAP Phase 3D-028)
 * ============================================================================
 * Extracts polygonal rings and signed distance fields from 2D document layers
 * for 3D extrusion (Phase 3D-027 / 3D-029) and inflation.
 *
 * Defines the clean `LayerTextureSource` interface for GPU textures that the UI
 * compositor and memory ledger will connect to.
 * ============================================================================
 */

import type { MotionDocument } from "../../document/schema";
import { layerOutline } from "../../editing/layerOutline";
import { flattenPath, type Ring } from "../path/flatten";
import { signedDistanceField, type SdfField, type SdfOptions } from "./sdf";

/**
 * Live GPU texture source representation for 2D layers used as 3D decals/labels.
 * Bound to the memory ledger in the UI layer.
 */
export interface LayerTextureSource {
  layerId: string;
  width: number;
  height: number;
  pixels?: Uint8Array;
}

/**
 * Extracts the 2D outline of a document layer and adaptively flattens it
 * into closed polygonal rings ready for 3D extrusion.
 */
export function layerOutlineRings(
  doc: MotionDocument,
  layerId: string,
  tolerance = 0.1
): Ring[] {
  const layer = doc.layers[layerId];
  if (!layer) return [];

  const outline = layerOutline(layer, doc.layers);
  if (!outline || outline.path.isEmpty()) return [];

  return flattenPath(outline.path, tolerance, outline.evenOdd ? "evenodd" : "nonzero");
}

export interface LayerSdfOptions extends Partial<SdfOptions> {
  padding?: number;
}

/**
 * Generates a Signed Distance Field for a 2D layer in the document.
 * Bounds and grid dimensions are computed automatically from the layer outline
 * with optional padding, or overridden via options.
 */
export function layerSdf(
  doc: MotionDocument,
  layerId: string,
  opts?: LayerSdfOptions
): SdfField | null {
  const cellSize = opts?.cellSize ?? 1;
  const tolerance = cellSize * 0.1;
  const rings = layerOutlineRings(doc, layerId, tolerance);
  if (rings.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const padding = opts?.padding ?? 10;
  const originX = opts?.origin
    ? Array.isArray(opts.origin)
      ? opts.origin[0]
      : opts.origin.x
    : minX - padding;
  const originY = opts?.origin
    ? Array.isArray(opts.origin)
      ? opts.origin[1]
      : opts.origin.y
    : minY - padding;

  const width = opts?.width ?? Math.max(1, Math.ceil((maxX - minX + 2 * padding) / cellSize));
  const height = opts?.height ?? Math.max(1, Math.ceil((maxY - minY + 2 * padding) / cellSize));

  return signedDistanceField(rings, {
    width,
    height,
    cellSize,
    origin: [originX, originY],
  });
}
