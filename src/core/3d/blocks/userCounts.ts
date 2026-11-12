/**
 * ============================================================================
 * 3D DATA BLOCKS USER COUNTS TABLE (ROADMAP_3D Phase 3D-024)
 * ============================================================================
 * Pure helper returning user counts for every shared data block kind:
 * materials, meshes, lights, cameras, armatures, actions, worlds, images3d,
 * objects, and scenes.
 * Single O(N) traversal matching `userCount` semantics from `dataBlocks.ts`.
 * ============================================================================
 */

import type { MotionDocument } from "../../document/schema";

export interface UserCountsTable {
  materials: Record<string, number>;
  meshes: Record<string, number>;
  lights: Record<string, number>;
  cameras: Record<string, number>;
  armatures: Record<string, number>;
  actions: Record<string, number>;
  worlds: Record<string, number>;
  images3d: Record<string, number>;
  objects: Record<string, number>;
  scenes: Record<string, number>;
  [kind: string]: Record<string, number>;
}

/**
 * Returns a complete table of user reference counts for all shared data blocks in the document.
 */
export function userCounts(doc: MotionDocument): UserCountsTable {
  const table: UserCountsTable = {
    materials: {},
    meshes: {},
    lights: {},
    cameras: {},
    armatures: {},
    actions: {},
    worlds: {},
    images3d: {},
    objects: {},
    scenes: {},
  };

  // Seed all known data block keys with 0
  if (doc.materials) for (const id of Object.keys(doc.materials)) table.materials[id] = 0;
  if (doc.meshes) for (const id of Object.keys(doc.meshes)) table.meshes[id] = 0;
  if (doc.lights) for (const id of Object.keys(doc.lights)) table.lights[id] = 0;
  if (doc.cameras) for (const id of Object.keys(doc.cameras)) table.cameras[id] = 0;
  if (doc.armatures) for (const id of Object.keys(doc.armatures)) table.armatures[id] = 0;
  if (doc.actions) for (const id of Object.keys(doc.actions)) table.actions[id] = 0;
  if (doc.worlds) for (const id of Object.keys(doc.worlds)) table.worlds[id] = 0;
  if (doc.images3d) for (const id of Object.keys(doc.images3d)) table.images3d[id] = 0;
  if (doc.objects) for (const id of Object.keys(doc.objects)) table.objects[id] = 0;
  if (doc.scenes) for (const id of Object.keys(doc.scenes)) table.scenes[id] = 0;

  // 1. Tally from objects
  if (doc.objects) {
    for (const obj of Object.values(doc.objects)) {
      // Parent references
      if (obj.parentId) {
        table.objects[obj.parentId] = (table.objects[obj.parentId] ?? 0) + 1;
      }

      // Material slots
      const slots = obj.materialSlots ?? obj.materials ?? [];
      for (const slotId of slots) {
        table.materials[slotId] = (table.materials[slotId] ?? 0) + 1;
      }

      // Data ID (mesh, light, camera, armature)
      if (obj.dataId) {
        const id = obj.dataId;
        if (obj.type === "mesh" || (!obj.type && doc.meshes?.[id])) {
          table.meshes[id] = (table.meshes[id] ?? 0) + 1;
        } else if (obj.type === "light" || (!obj.type && doc.lights?.[id])) {
          table.lights[id] = (table.lights[id] ?? 0) + 1;
        } else if (obj.type === "camera" || (!obj.type && doc.cameras?.[id])) {
          table.cameras[id] = (table.cameras[id] ?? 0) + 1;
        } else if (obj.type === "armature" || (!obj.type && doc.armatures?.[id])) {
          table.armatures[id] = (table.armatures[id] ?? 0) + 1;
        } else {
          if (doc.meshes?.[id]) table.meshes[id] = (table.meshes[id] ?? 0) + 1;
          else if (doc.lights?.[id]) table.lights[id] = (table.lights[id] ?? 0) + 1;
          else if (doc.cameras?.[id]) table.cameras[id] = (table.cameras[id] ?? 0) + 1;
          else if (doc.armatures?.[id]) table.armatures[id] = (table.armatures[id] ?? 0) + 1;
        }
      }

      // Action references
      const actId = (obj as Record<string, unknown>).actionId as string | undefined;
      if (actId) {
        table.actions[actId] = (table.actions[actId] ?? 0) + 1;
      }
    }
  }

  // 2. Tally from scenes
  if (doc.scenes) {
    for (const scene of Object.values(doc.scenes)) {
      // Scene objects
      for (const objId of scene.objects ?? []) {
        table.objects[objId] = (table.objects[objId] ?? 0) + 1;
      }

      // Active camera
      if (scene.activeCamera) {
        table.cameras[scene.activeCamera] = (table.cameras[scene.activeCamera] ?? 0) + 1;
      }

      // World
      if (scene.world) {
        table.worlds[scene.world] = (table.worlds[scene.world] ?? 0) + 1;
      }
    }
  }

  // 3. Tally from layers
  if (doc.layers) {
    for (const layer of Object.values(doc.layers)) {
      const sceneId = layer.properties?.scene as string | undefined;
      if (sceneId) {
        table.scenes[sceneId] = (table.scenes[sceneId] ?? 0) + 1;
      }
    }
  }

  // 4. Tally from materials (texture references to images3d)
  if (doc.materials) {
    for (const mat of Object.values(doc.materials)) {
      if (mat.baseColorTexture) table.images3d[mat.baseColorTexture] = (table.images3d[mat.baseColorTexture] ?? 0) + 1;
      if (mat.normalTexture) table.images3d[mat.normalTexture] = (table.images3d[mat.normalTexture] ?? 0) + 1;
      if (mat.metallicRoughnessTexture) table.images3d[mat.metallicRoughnessTexture] = (table.images3d[mat.metallicRoughnessTexture] ?? 0) + 1;
      if (mat.emissiveTexture) table.images3d[mat.emissiveTexture] = (table.images3d[mat.emissiveTexture] ?? 0) + 1;
    }
  }

  // 5. Tally from worlds (environmentImage to images3d)
  if (doc.worlds) {
    for (const world of Object.values(doc.worlds)) {
      if (world.environmentImage) {
        table.images3d[world.environmentImage] = (table.images3d[world.environmentImage] ?? 0) + 1;
      }
    }
  }

  return table;
}
