/**
 * ============================================================================
 * 3D OUTLINER OPERATIONS (ROADMAP_3D Phase 3D-021)
 * ============================================================================
 * Pure, immutable document operations for outliner manipulation:
 *   - setFlag (visible, selectable, renderVisible)
 *   - reparent (keeps world matrix to 1e-6, refuses cycles)
 *   - moveToCollection
 *   - createCollection
 *   - renameNode
 *   - deleteNode
 *
 * Each operation takes `(doc, ...args)` and returns a newly cloned document.
 * The input document is NEVER mutated.
 * ============================================================================
 */

import { createId } from "../../ids";
import type { MotionDocument } from "../../document/schema";
import { clearParent, setParent } from "../hierarchy";

export type OutlinerFlag = "visible" | "selectable" | "renderVisible";

/**
 * Sets a visibility, selectability, or render visibility flag on a collection or object.
 * Hiding a collection hides what is in it for display, while the stored flag stays on the collection.
 */
export function setFlag(
  doc: MotionDocument,
  id: string,
  flag: OutlinerFlag,
  value: boolean
): MotionDocument {
  const next = structuredClone(doc);

  // Check collections in scenes
  if (next.scenes) {
    for (const scene of Object.values(next.scenes)) {
      if (scene.collections?.[id]) {
        scene.collections[id][flag] = value;
        return next;
      }
    }
  }

  // Check objects
  if (next.objects?.[id]) {
    next.objects[id][flag] = value;
    return next;
  }

  return next;
}

export interface ReparentOptions {
  beforeId?: string;
}

/**
 * Reparents an object under a new parent (or clears parent if newParentId is null).
 * Keeps child's world transform within 1e-6 tolerance.
 * Refuses parenting cycles with a descriptive error.
 */
export function reparent(
  doc: MotionDocument,
  objectId: string,
  newParentId: string | null,
  options?: ReparentOptions
): MotionDocument {
  if (!doc.objects?.[objectId]) {
    throw new Error(`Object "${objectId}" not found in document.`);
  }

  if (newParentId === objectId) {
    throw new Error(`Cannot parent object "${objectId}" to itself (cycle detected).`);
  }

  // Check cycle before mutating
  if (newParentId !== null) {
    if (!doc.objects?.[newParentId]) {
      throw new Error(`Parent object "${newParentId}" not found in document.`);
    }

    let curr: string | null = newParentId;
    const seen = new Set<string>();
    while (curr !== null) {
      if (curr === objectId) {
        throw new Error(
          `Cannot parent object "${objectId}" under its own descendant "${newParentId}" (cycle detected).`
        );
      }
      if (seen.has(curr)) {
        throw new Error(`Cycle detected in hierarchy above "${newParentId}".`);
      }
      seen.add(curr);
      curr = doc.objects?.[curr]?.parentId ?? null;
    }
  }

  // Clone document to preserve immutability
  let next = structuredClone(doc);

  if (newParentId !== null) {
    next = setParent(next, objectId, newParentId, { keepWorld: true });
  } else {
    next = clearParent(next, objectId, { keepWorld: true });
  }

  // If beforeId is specified, reorder in scene.objects
  if (options?.beforeId && next.scenes) {
    for (const scene of Object.values(next.scenes)) {
      const arr = scene.objects;
      const oldIdx = arr.indexOf(objectId);
      const targetIdx = arr.indexOf(options.beforeId);
      if (oldIdx !== -1 && targetIdx !== -1) {
        arr.splice(oldIdx, 1);
        const insertIdx = arr.indexOf(options.beforeId);
        arr.splice(insertIdx, 0, objectId);
      }
    }
  }

  return next;
}

/**
 * Moves an object into a collection, or unlinks it from collections if collectionId is null.
 */
export function moveToCollection(
  doc: MotionDocument,
  objectId: string,
  collectionId: string | null
): MotionDocument {
  if (!doc.objects?.[objectId]) return doc;

  const next = structuredClone(doc);
  if (collectionId !== null) {
    next.objects![objectId].collection = collectionId;
  } else {
    delete next.objects![objectId].collection;
  }

  return next;
}

export interface CreateCollectionOptions {
  id?: string;
  name?: string;
  parent?: string | null;
}

/**
 * Creates a new collection in the specified scene.
 */
export function createCollection(
  doc: MotionDocument,
  sceneId: string,
  options?: CreateCollectionOptions
): MotionDocument {
  const scene = doc.scenes?.[sceneId];
  if (!scene) return doc;

  const next = structuredClone(doc);
  const targetScene = next.scenes![sceneId];

  if (!targetScene.collections) {
    targetScene.collections = {};
  }

  const colId = options?.id ?? createId("col");
  targetScene.collections[colId] = {
    id: colId,
    name: options?.name ?? "Collection",
    parent: options?.parent ?? null,
    visible: true,
    selectable: true,
    renderVisible: true,
  };

  return next;
}

/**
 * Renames an entity in the outliner (collection, object, material, mesh, light, camera, armature, action).
 */
export function renameNode(
  doc: MotionDocument,
  id: string,
  newName: string
): MotionDocument {
  const next = structuredClone(doc);

  // 1. Collections in scenes
  if (next.scenes) {
    for (const scene of Object.values(next.scenes)) {
      if (scene.collections?.[id]) {
        scene.collections[id].name = newName;
        return next;
      }
    }
  }

  // 2. Objects
  if (next.objects?.[id]) {
    next.objects[id].name = newName;
    return next;
  }

  // 3. Materials
  if (next.materials?.[id]) {
    next.materials[id].name = newName;
    return next;
  }

  // 4. Meshes
  if (next.meshes?.[id]) {
    next.meshes[id].name = newName;
    return next;
  }

  // 5. Lights
  if (next.lights?.[id]) {
    next.lights[id].name = newName;
    return next;
  }

  // 6. Cameras
  if (next.cameras?.[id]) {
    next.cameras[id].name = newName;
    return next;
  }

  // 7. Armatures
  if (next.armatures?.[id]) {
    next.armatures[id].name = newName;
    return next;
  }

  // 8. Actions
  if (next.actions?.[id]) {
    next.actions[id].name = newName;
    return next;
  }

  return next;
}

/**
 * Deletes a collection or object from the document.
 */
export function deleteNode(
  doc: MotionDocument,
  id: string
): MotionDocument {
  const next = structuredClone(doc);

  // 1. Check if collection
  if (next.scenes) {
    for (const scene of Object.values(next.scenes)) {
      if (scene.collections?.[id]) {
        delete scene.collections[id];

        // Unlink objects in this collection
        if (next.objects) {
          for (const obj of Object.values(next.objects)) {
            if (obj.collection === id) {
              delete obj.collection;
            }
          }
        }

        // Reset parent of sub-collections to null
        for (const col of Object.values(scene.collections)) {
          if (col.parent === id) {
            col.parent = null;
          }
        }

        return next;
      }
    }
  }

  // 2. Check if object
  if (next.objects?.[id]) {
    // Remove from all scene.objects lists
    if (next.scenes) {
      for (const scene of Object.values(next.scenes)) {
        scene.objects = scene.objects.filter((objId) => objId !== id);
      }
    }

    // Unparent any direct children
    for (const obj of Object.values(next.objects)) {
      if (obj.parentId === id) {
        obj.parentId = null;
        delete obj.parentInverse;
      }
    }

    delete next.objects[id];
    return next;
  }

  return next;
}
