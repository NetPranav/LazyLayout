/**
 * ============================================================================
 * PARAMETRIC 3D PRIMITIVE TYPES (Phase 3D-025)
 * ============================================================================
 * Core type interfaces for procedural primitive meshes, parameter schemas,
 * and on-canvas interactive manipulation handles.
 * Pure TypeScript, zero DOM/Three.js dependencies.
 * ============================================================================
 */

import type { z } from "zod";
import type { Vec3 } from "../math";

export type PrimitiveKind =
  | "cube"
  | "cylinder"
  | "cone"
  | "uvSphere"
  | "icoSphere"
  | "torus"
  | "plane"
  | "circle"
  | "capsule"
  | "roundedBox";

export interface PrimitiveMeshResult {
  positions: Float32Array;
  indices: Uint32Array;
  uvs?: Float32Array;
}

export interface HandleDef<P = Record<string, unknown>> {
  id: string;
  label: string;
  position: Vec3;
  axis: Vec3;
  param: string;
  apply: (params: P, delta: number) => P;
}

export interface PrimitiveSpec<P = Record<string, unknown>> {
  kind: PrimitiveKind;
  params: z.ZodType<P>;
  generate: (params: P) => PrimitiveMeshResult;
  handles: (params: P) => HandleDef<P>[];
}
