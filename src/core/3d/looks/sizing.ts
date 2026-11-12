/**
 * ============================================================================
 * 3D LOOKS SIZING (Phase 3D-023)
 * ============================================================================
 * Pure functions to scale look parameters based on object bounds and scene scale:
 *   - Depth/thickness scales from smallest bounding side
 *   - Light power/intensity scales from scene dimensions
 * ============================================================================
 */

import type { MotionDocument } from "@/core/document/schema";
import type { LookSizingRule, ObjectBounds } from "./types";

/**
 * Computes the axis-aligned local bounding box and dimensions for an object.
 */
export function getObjectBounds(doc: MotionDocument, objectId: string): ObjectBounds {
  const obj = doc.objects?.[objectId];
  const scale = obj?.transform?.scale ?? [1, 1, 1];
  const absScale: [number, number, number] = [
    Math.max(1e-4, Math.abs(scale[0])),
    Math.max(1e-4, Math.abs(scale[1])),
    Math.max(1e-4, Math.abs(scale[2])),
  ];

  const meshId = obj?.dataId;
  const mesh = meshId ? doc.meshes?.[meshId] : undefined;
  const positions = mesh?.positions;

  if (positions && positions.length >= 3) {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i] * absScale[0];
      const y = positions[i + 1] * absScale[1];
      const z = positions[i + 2] * absScale[2];

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    const size: [number, number, number] = [
      Math.max(1e-4, maxX - minX),
      Math.max(1e-4, maxY - minY),
      Math.max(1e-4, maxZ - minZ),
    ];
    const smallestSide = Math.min(size[0], size[1], size[2]);

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      size,
      smallestSide,
    };
  }

  // Fallback unit cube bounds scaled by object scale
  const size: [number, number, number] = [absScale[0], absScale[1], absScale[2]];
  const half: [number, number, number] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const smallestSide = Math.min(size[0], size[1], size[2]);

  return {
    min: [-half[0], -half[1], -half[2]],
    max: [half[0], half[1], half[2]],
    size,
    smallestSide,
  };
}

/**
 * Computes the overall scene bounding dimension (max extent across objects).
 */
export function getSceneSize(doc: MotionDocument): number {
  const objects = Object.values(doc.objects ?? {});
  if (objects.length === 0) return 10.0;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const obj of objects) {
    const loc = obj.transform.location;
    if (loc[0] < minX) minX = loc[0];
    if (loc[1] < minY) minY = loc[1];
    if (loc[2] < minZ) minZ = loc[2];
    if (loc[0] > maxX) maxX = loc[0];
    if (loc[1] > maxY) maxY = loc[1];
    if (loc[2] > maxZ) maxZ = loc[2];
  }

  const spanX = Number.isFinite(maxX - minX) ? Math.max(1, maxX - minX) : 10;
  const spanY = Number.isFinite(maxY - minY) ? Math.max(1, maxY - minY) : 10;
  const spanZ = Number.isFinite(maxZ - minZ) ? Math.max(1, maxZ - minZ) : 10;

  return Math.max(spanX, spanY, spanZ, 5.0);
}

/**
 * Resolves values for an object by applying sizing rules to base values.
 */
export function applySizingRules(
  baseValues: Record<string, unknown>,
  sizingRules: LookSizingRule[] | undefined,
  doc: MotionDocument,
  objectId: string
): Record<string, unknown> {
  const values = { ...baseValues };
  if (!sizingRules || sizingRules.length === 0) return values;

  const bounds = getObjectBounds(doc, objectId);
  const sceneSize = getSceneSize(doc);

  for (const rule of sizingRules) {
    let scaled: number;
    if (rule.mode === "smallest_side") {
      scaled = bounds.smallestSide * rule.factor;
    } else {
      // rule.mode === "scene_size"
      scaled = sceneSize * rule.factor;
    }

    values[rule.property] = scaled;
  }

  return values;
}
