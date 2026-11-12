/**
 * ============================================================================
 * 3D TEXT MESH GENERATOR (Phase 3D-026)
 * ============================================================================
 * Combines multi-line font layout with 3D extrusion and beveling:
 *   `textToMesh(font, text, opts) = layout + extrudeRings(depth, bevel)`
 * Producing a watertight 2-manifold triangle mesh.
 * ============================================================================
 */

import { extrudeRings } from "../make3d/extrude";
import type { MeshData } from "../make3d/types";
import type { Font } from "./font";
import { layoutText, type TextLayoutOptions } from "./layout";

export interface TextMeshOptions extends TextLayoutOptions {
  depth?: number;
  bevel?: number;
  bevelSegments?: number;
  bevelProfile?: "round" | "chamfer" | "concave";
}

/**
 * Generates an extruded and optionally beveled 3D mesh from font text.
 */
export function textToMesh(
  font: Font,
  text: string,
  options?: TextMeshOptions
): MeshData {
  if (!text || text.length === 0) {
    return {
      positions: new Float32Array(0),
      indices: new Uint32Array(0),
      uvs: new Float32Array(0),
      normals: new Float32Array(0),
    };
  }

  const layout = layoutText(font, text, options);
  const depth = options?.depth ?? 10;
  const bevelSize = options?.bevel ?? 0;
  const bevelSegments = options?.bevelSegments ?? 3;
  const bevelProfile = options?.bevelProfile ?? "round";

  return extrudeRings(layout.rings, {
    depth,
    bevel: bevelSize > 0 ? { size: bevelSize, segments: bevelSegments, profile: bevelProfile } : undefined,
  });
}
