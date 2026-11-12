/**
 * ============================================================================
 * MAKE 3D TYPES (Phase 3D-029)
 * ============================================================================
 * Core type interfaces for turning 2D layers and rings into 3D geometry:
 * Extrusion, Inflation, Lathe, and Plane cards.
 * Pure TypeScript, zero DOM/Three.js dependencies.
 * ============================================================================
 */

export interface MeshData {
  positions: Float32Array;
  indices: Uint32Array;
  uvs: Float32Array;
  normals?: Float32Array;
}

export interface BevelOptions {
  size?: number;
  segments?: number;
  profile?: "round" | "chamfer" | "concave";
}

export interface ExtrudeOptions {
  depth?: number;
  bevel?: BevelOptions;
}

export interface LatheOptions {
  segments?: number;
  axis?: "x" | "y" | "z";
}

export interface InflateOptions {
  depth?: number;
  resolution?: number;
}

export interface PlaneOptions {
  width?: number;
  height?: number;
  thickness?: number;
}

export type Make3DMode = "extrude" | "inflate" | "lathe" | "plane";

export interface Make3DParams {
  layerId: string;
  mode: Make3DMode;
  depth?: number;
  bevel?: BevelOptions;
  segments?: number;
  axis?: "x" | "y" | "z";
  resolution?: number;
  textLayerIds?: string[];
  [key: string]: unknown;
}
