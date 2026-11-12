/**
 * ============================================================================
 * 3D MODIFIERS TYPES (Phase 3D-030)
 * ============================================================================
 * Pure geometry representations for the non-destructive modifier pipeline.
 * ============================================================================
 */

import type { z } from "zod";

/**
 * Standard pure geometry container used throughout the modifier pipeline.
 * All positions and normals are 3 floats per vertex; UVs are 2 floats per vertex.
 * Triangles are 3 indices per face.
 */
export interface MeshData {
  positions: Float32Array;
  indices: Uint32Array;
  uvs?: Float32Array;
  normals?: Float32Array;
}

/**
 * Contract for a registered modifier type.
 */
export interface ModifierDefinition<TParams = Record<string, unknown>> {
  type: string;
  label: string;
  schema: z.ZodType<TParams>;
  params?: z.ZodType<TParams>;
  evaluate: (mesh: MeshData, params: TParams) => MeshData;
}
