/**
 * ============================================================================
 * 3D COPY ATTRIBUTES (ROADMAP_3D Phase 3D-024)
 * ============================================================================
 * Copies specified attributes from a source object to one or more target objects:
 *   - "material": shares material slots by ID (+1 user count)
 *   - "modifiers": clones modifier stack with fresh IDs
 *   - "transform": copies location, rotation, and scale only
 *   - "visibility": copies visible, selectable, and renderVisible flags
 *
 * Pure, immutable: the input document is never mutated.
 * ============================================================================
 */

import { createId } from "../../ids";
import type { MotionDocument, Object3d } from "../../document/schema";

export type AttributePart = "material" | "modifiers" | "transform" | "visibility";

/**
 * Copies attributes from `fromObjectId` to `toObjectIds`.
 */
export function copyAttributes(
  doc: MotionDocument,
  fromObjectId: string,
  toObjectIds: string[],
  parts: AttributePart[]
): MotionDocument {
  const fromObj = doc.objects?.[fromObjectId];
  if (!fromObj || !toObjectIds.length || !parts.length) {
    return doc;
  }

  const next = structuredClone(doc);
  if (!next.objects) return doc;

  const partSet = new Set(parts);

  for (const toId of toObjectIds) {
    if (toId === fromObjectId) continue;
    const target = next.objects[toId];
    if (!target) continue;

    const updated: Object3d = { ...target };

    // 1. Material (shared by ID)
    if (partSet.has("material")) {
      const slots = fromObj.materialSlots ?? fromObj.materials ?? [];
      updated.materialSlots = [...slots];
      updated.materials = [...slots];
    }

    // 2. Modifiers (cloned with fresh IDs)
    if (partSet.has("modifiers")) {
      const rawMods = (fromObj as Record<string, unknown>).modifiers;
      if (Array.isArray(rawMods)) {
        (updated as Record<string, unknown>).modifiers = rawMods.map((mod) => {
          const m = mod as Record<string, unknown>;
          return {
            ...structuredClone(m),
            id: createId("mod"),
          };
        });
      } else {
        delete (updated as Record<string, unknown>).modifiers;
      }
    }

    // 3. Transform (location/rotation/scale only)
    if (partSet.has("transform")) {
      updated.transform = {
        location: [
          fromObj.transform.location[0],
          fromObj.transform.location[1],
          fromObj.transform.location[2],
        ],
        rotationQuat: [
          fromObj.transform.rotationQuat[0],
          fromObj.transform.rotationQuat[1],
          fromObj.transform.rotationQuat[2],
          fromObj.transform.rotationQuat[3],
        ],
        scale: [
          fromObj.transform.scale[0],
          fromObj.transform.scale[1],
          fromObj.transform.scale[2],
        ],
      };
    }

    // 4. Visibility (visible, selectable, renderVisible)
    if (partSet.has("visibility")) {
      updated.visible = fromObj.visible;
      updated.selectable = fromObj.selectable;
      updated.renderVisible = fromObj.renderVisible;
    }

    next.objects[toId] = updated;
  }

  return next;
}
