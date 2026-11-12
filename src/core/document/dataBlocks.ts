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
import type { Action3d, Material3d, Mesh3d, MotionDocument } from "./schema";

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
  | "images3d"
  | "text"
  | "texts";

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
  if (k === "texts" || k === "text") return "text";
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

    case "text": {
      let count = 0;
      for (const obj of Object.values(doc.objects ?? {})) {
        if (obj.dataId === id && obj.type === "text") count++;
      }
      return count;
    }

    default:
      return 0;
  }
}

export type SingleUserTarget =
  | number
  | "material"
  | "mesh"
  | "action"
  | { kind: "material"; slot?: number }
  | { kind: "mesh" }
  | { kind: "action" };

/**
 * Copies a shared material, mesh, or action for that object only and returns the new doc
 * (pure, immutable style like other document helpers).
 * If the data block has <= 1 user, it is already single-user and doc is returned.
 * Backward-compatible with `makeSingleUser(doc, objectId, slot: number)`.
 */
export function makeSingleUser(
  doc: MotionDocument,
  objectId: string,
  target?: SingleUserTarget,
  slot?: number
): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj) return doc;

  let kind: "material" | "mesh" | "action" = "material";
  let targetSlot = slot ?? 0;

  if (typeof target === "number") {
    kind = "material";
    targetSlot = target;
  } else if (typeof target === "string") {
    if (target === "mesh" || target === "action") {
      kind = target;
    } else {
      kind = "material";
      if (slot !== undefined) targetSlot = slot;
    }
  } else if (typeof target === "object" && target !== null) {
    kind = target.kind;
    if (target.kind === "material" && target.slot !== undefined) {
      targetSlot = target.slot;
    } else if (slot !== undefined) {
      targetSlot = slot;
    }
  }

  if (kind === "mesh") {
    const currentMeshId = obj.dataId;
    if (!currentMeshId || !doc.meshes?.[currentMeshId]) return doc;

    if (userCount(doc, "mesh", currentMeshId) <= 1) {
      return doc;
    }

    const next = structuredClone(doc);
    const sourceMesh = next.meshes![currentMeshId];
    const newMeshId = createId("msh");
    const newMesh: Mesh3d = {
      ...structuredClone(sourceMesh),
      id: newMeshId,
      name: sourceMesh.name ? `${sourceMesh.name}.001` : "Mesh.001",
    };

    next.meshes![newMeshId] = newMesh;
    next.objects![objectId] = {
      ...next.objects![objectId],
      dataId: newMeshId,
    };
    return next;
  }

  if (kind === "action") {
    const currentActionId = (obj as Record<string, unknown>).actionId as string | undefined;
    if (!currentActionId || !doc.actions?.[currentActionId]) return doc;

    if (userCount(doc, "action", currentActionId) <= 1) {
      return doc;
    }

    const next = structuredClone(doc);
    const sourceAction = next.actions![currentActionId];
    const newActionId = createId("act");
    const newAction: Action3d = {
      ...structuredClone(sourceAction),
      id: newActionId,
      name: sourceAction.name ? `${sourceAction.name}.001` : "Action.001",
    };

    next.actions![newActionId] = newAction;
    next.objects![objectId] = {
      ...next.objects![objectId],
      actionId: newActionId,
    } as unknown as NonNullable<typeof next.objects>[string];
    return next;
  }

  // kind === "material"
  const slots = obj.materialSlots ?? obj.materials ?? [];
  const currentMatId = slots[targetSlot];
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
    targetObj.materialSlots[targetSlot] = newMatId;
  }
  if (targetObj.materials) {
    targetObj.materials = [...targetObj.materials];
    targetObj.materials[targetSlot] = newMatId;
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

    // 10. Unused texts
    if (next.texts) {
      for (const [id] of Object.entries(next.texts)) {
        if (userCount(next, "text", id) === 0) {
          delete next.texts[id];
          changed = true;
        }
      }
    }
  }

  return next;
}
