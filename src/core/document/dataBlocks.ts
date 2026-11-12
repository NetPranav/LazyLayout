/**
 * ============================================================================
 * 3D DATA BLOCKS: USER COUNT, MAKE SINGLE USER & REMOVE UNUSED
 * ============================================================================
 * ROADMAP_3D Phase 3D-007: Blender-style shared data-block rules.
 *
 * Rules:
 *   - "one material on many objects": data blocks are shared by id.
 *   - `userCount`: how many objects, scenes, or materials reference a block.
 *   - `makeSingleUser`: copies a shared material for one object slot only,
 *     returning a new immutable document.
 *   - `removeUnused`: purges orphaned data blocks whose userCount is 0,
 *     cascading until all dead blocks are cleared. Pure, immutable.
 * ============================================================================
 */

import { createId } from "../ids";
import type { Material3d, MotionDocument } from "./schema";

export type DataBlockKind =
  | "scene"
  | "scenes"
  | "object"
  | "objects"
  | "mesh"
  | "meshes"
  | "material"
  | "materials"
  | "light"
  | "lights"
  | "camera"
  | "cameras"
  | "armature"
  | "armatures"
  | "action"
  | "actions"
  | "world"
  | "worlds"
  | "image"
  | "images"
  | "image3d"
  | "images3d";

function normalizeKind(kind: DataBlockKind): string {
  const k = kind.toLowerCase();
  if (k === "scenes" || k === "scene") return "scene";
  if (k === "objects" || k === "object") return "object";
  if (k === "meshes" || k === "mesh") return "mesh";
  if (k === "materials" || k === "material") return "material";
  if (k === "lights" || k === "light") return "light";
  if (k === "cameras" || k === "camera") return "camera";
  if (k === "armatures" || k === "armature") return "armature";
  if (k === "actions" || k === "action") return "action";
  if (k === "worlds" || k === "world") return "world";
  if (k === "images" || k === "image" || k === "image3d" || k === "images3d") return "image3d";
  return k;
}

/**
 * Counts how many objects, materials, scenes or layers reference a data block.
 */
export function userCount(doc: MotionDocument, kind: DataBlockKind, id: string): number {
  const norm = normalizeKind(kind);

  switch (norm) {
    case "material": {
      let count = 0;
      for (const obj of Object.values(doc.objects ?? {})) {
        const slots = obj.materialSlots ?? obj.materials ?? [];
        for (const slotId of slots) {
          if (slotId === id) count++;
        }
      }
      return count;
    }

    case "mesh": {
      let count = 0;
      for (const obj of Object.values(doc.objects ?? {})) {
        if (obj.dataId === id && (obj.type === "mesh" || !obj.type)) count++;
      }
      return count;
    }

    case "light": {
      let count = 0;
      for (const obj of Object.values(doc.objects ?? {})) {
        if (obj.dataId === id && (obj.type === "light" || !obj.type)) count++;
      }
      return count;
    }

    case "camera": {
      let count = 0;
      for (const obj of Object.values(doc.objects ?? {})) {
        if (obj.dataId === id && (obj.type === "camera" || !obj.type)) count++;
      }
      for (const scene of Object.values(doc.scenes ?? {})) {
        if (scene.activeCamera === id) count++;
      }
      return count;
    }

    case "armature": {
      let count = 0;
      for (const obj of Object.values(doc.objects ?? {})) {
        if (obj.dataId === id && (obj.type === "armature" || !obj.type)) count++;
      }
      return count;
    }

    case "world": {
      let count = 0;
      for (const scene of Object.values(doc.scenes ?? {})) {
        if (scene.world === id) count++;
      }
      return count;
    }

    case "image3d": {
      let count = 0;
      for (const mat of Object.values(doc.materials ?? {})) {
        if (mat.baseColorTexture === id) count++;
        if (mat.normalTexture === id) count++;
        if (mat.metallicRoughnessTexture === id) count++;
        if (mat.emissiveTexture === id) count++;
      }
      for (const world of Object.values(doc.worlds ?? {})) {
        if (world.environmentImage === id) count++;
      }
      return count;
    }

    case "object": {
      let count = 0;
      for (const scene of Object.values(doc.scenes ?? {})) {
        if (scene.objects.includes(id)) count++;
      }
      for (const obj of Object.values(doc.objects ?? {})) {
        if (obj.parentId === id) count++;
      }
      return count;
    }

    case "scene": {
      let count = 0;
      for (const layer of Object.values(doc.layers ?? {})) {
        if (layer.properties?.scene === id) count++;
      }
      return count;
    }

    case "action": {
      let count = 0;
      for (const obj of Object.values(doc.objects ?? {})) {
        if ((obj as Record<string, unknown>).actionId === id) count++;
      }
      return count;
    }

    default:
      return 0;
  }
}

/**
 * Copies a shared material for that object slot only and returns the new doc
 * (pure, immutable style like other document helpers).
 * If the material has only 1 user, it is already single-user and doc is returned.
 */
export function makeSingleUser(
  doc: MotionDocument,
  objectId: string,
  slot: number
): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj) return doc;

  const slots = obj.materialSlots ?? obj.materials ?? [];
  const currentMatId = slots[slot];
  if (!currentMatId || !doc.materials?.[currentMatId]) return doc;

  // If already single-user (<= 1 user), no need to duplicate
  if (userCount(doc, "material", currentMatId) <= 1) {
    return doc;
  }

  const next = structuredClone(doc);
  const sourceMat = next.materials![currentMatId];
  const newMatId = createId("mat");
  const newMat: Material3d = {
    ...structuredClone(sourceMat),
    id: newMatId,
    name: sourceMat.name ? `${sourceMat.name}.001` : "Material.001",
  };

  next.materials![newMatId] = newMat;
  const targetObj = next.objects![objectId];

  if (targetObj.materialSlots) {
    targetObj.materialSlots = [...targetObj.materialSlots];
    targetObj.materialSlots[slot] = newMatId;
  }
  if (targetObj.materials) {
    targetObj.materials = [...targetObj.materials];
    targetObj.materials[slot] = newMatId;
  }
  if (!targetObj.materialSlots && !targetObj.materials) {
    targetObj.materialSlots = [newMatId];
  }

  return next;
}

/**
 * Purges unused data blocks (materials, meshes, lights, cameras, armatures,
 * actions, worlds, images3d, and unreferenced objects) whose user count is 0.
 * Cascades iteratively until no more blocks are removed. Pure, immutable.
 */
export function removeUnused(doc: MotionDocument): MotionDocument {
  const next = structuredClone(doc);
  let changed = true;

  while (changed) {
    changed = false;

    // 1. Unused objects (not in any scene.objects and not parentId of any object)
    if (next.objects) {
      for (const [id] of Object.entries(next.objects)) {
        if (userCount(next, "object", id) === 0) {
          delete next.objects[id];
          changed = true;
        }
      }
    }

    // 2. Unused meshes
    if (next.meshes) {
      for (const [id] of Object.entries(next.meshes)) {
        if (userCount(next, "mesh", id) === 0) {
          delete next.meshes[id];
          changed = true;
        }
      }
    }

    // 3. Unused materials
    if (next.materials) {
      for (const [id] of Object.entries(next.materials)) {
        if (userCount(next, "material", id) === 0) {
          delete next.materials[id];
          changed = true;
        }
      }
    }

    // 4. Unused lights
    if (next.lights) {
      for (const [id] of Object.entries(next.lights)) {
        if (userCount(next, "light", id) === 0) {
          delete next.lights[id];
          changed = true;
        }
      }
    }

    // 5. Unused cameras
    if (next.cameras) {
      for (const [id] of Object.entries(next.cameras)) {
        if (userCount(next, "camera", id) === 0) {
          delete next.cameras[id];
          changed = true;
        }
      }
    }

    // 6. Unused armatures
    if (next.armatures) {
      for (const [id] of Object.entries(next.armatures)) {
        if (userCount(next, "armature", id) === 0) {
          delete next.armatures[id];
          changed = true;
        }
      }
    }

    // 7. Unused worlds
    if (next.worlds) {
      for (const [id] of Object.entries(next.worlds)) {
        if (userCount(next, "world", id) === 0) {
          delete next.worlds[id];
          changed = true;
        }
      }
    }

    // 8. Unused images3d
    if (next.images3d) {
      for (const [id] of Object.entries(next.images3d)) {
        if (userCount(next, "image3d", id) === 0) {
          delete next.images3d[id];
          changed = true;
        }
      }
    }

    // 9. Unused actions
    if (next.actions) {
      for (const [id] of Object.entries(next.actions)) {
        if (userCount(next, "action", id) === 0) {
          delete next.actions[id];
          changed = true;
        }
      }
    }
  }

  return next;
}
