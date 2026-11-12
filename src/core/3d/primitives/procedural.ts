/**
 * ============================================================================
 * PROCEDURAL PRIMITIVE DOCUMENT LINK (Phase 3D-025)
 * ============================================================================
 * Manages the connection between a Mesh3d data block and its procedural recipe:
 *   - Stored in `mesh.source = { kind, params }`.
 *   - `regenerate(doc, meshId, newParams)`: Recomputes vertices/indices immutably.
 *   - `setPrimitiveParam(doc, objectId, param, value)`: Updates an object's param.
 *   - `convertToPlainMesh(doc, meshId)`: Bakes the recipe by dropping `source`.
 *
 * Invariants:
 *   - Pure functions, completely immutable document operations.
 *   - Zero DOM/Three.js dependencies.
 * ============================================================================
 */

import type { MotionDocument } from "../../document/schema";
import {
  ProceduralSourceSchema,
  type ProceduralSource,
  type Mesh3d,
} from "../../document/scene3d";
import { getPrimitiveSpec } from "./specs";

export { ProceduralSourceSchema, type ProceduralSource };

/**
 * Regenerates a procedural mesh's geometry from its stored recipe and optional parameter overrides.
 * Returns a new immutable MotionDocument with the updated mesh.
 */
export function regenerate(
  doc: MotionDocument,
  meshId: string,
  newParams?: Record<string, unknown>
): MotionDocument {
  if (!doc.meshes || !doc.meshes[meshId]) return doc;

  const mesh = doc.meshes[meshId];
  if (!mesh.source) return doc;

  const spec = getPrimitiveSpec(mesh.source.kind);
  if (!spec) return doc;

  const mergedParams = {
    ...mesh.source.params,
    ...(newParams ?? {}),
  };

  const parsedParams = spec.params.parse(mergedParams);
  const generated = spec.generate(parsedParams);

  const updatedMesh: Mesh3d = {
    ...mesh,
    positions: Array.from(generated.positions),
    indices: Array.from(generated.indices),
    uvs: generated.uvs ? Array.from(generated.uvs) : mesh.uvs,
    source: {
      kind: mesh.source.kind,
      params: parsedParams as Record<string, unknown>,
    },
  };

  return {
    ...doc,
    meshes: {
      ...doc.meshes,
      [meshId]: updatedMesh,
    },
  };
}

/**
 * Sets a procedural parameter on the mesh owned by objectId and regenerates its geometry.
 * Returns a new immutable MotionDocument.
 */
export function setPrimitiveParam(
  doc: MotionDocument,
  objectId: string,
  param: string,
  value: unknown
): MotionDocument {
  if (!doc.objects) return doc;

  const obj = doc.objects[objectId];
  if (!obj || obj.type !== "mesh" || !obj.dataId) return doc;

  return regenerate(doc, obj.dataId, { [param]: value });
}

/**
 * Converts a procedural mesh to a plain static mesh by removing its `source` recipe.
 * Accepts either a meshId directly or an objectId that points to a mesh.
 * Returns a new immutable MotionDocument.
 */
export function convertToPlainMesh(
  doc: MotionDocument,
  meshOrObjectId: string
): MotionDocument {
  if (!doc.meshes) return doc;

  let targetMeshId = meshOrObjectId;
  if (!doc.meshes[targetMeshId] && doc.objects?.[meshOrObjectId]?.dataId) {
    targetMeshId = doc.objects[meshOrObjectId].dataId!;
  }

  const mesh = doc.meshes[targetMeshId];
  if (!mesh || !mesh.source) return doc;

  const plainMesh: Mesh3d = { ...mesh };
  delete plainMesh.source;

  return {
    ...doc,
    meshes: {
      ...doc.meshes,
      [targetMeshId]: plainMesh,
    },
  };
}
