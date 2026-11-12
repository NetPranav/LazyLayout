/**
 * ============================================================================
 * 3D MODIFIER STACK EVALUATION & PIPELINE (Phase 3D-030)
 * ============================================================================
 * Non-destructive modifier stack evaluation, LRU caching, immutable document
 * mutations (add/remove/reorder/set_param/apply/apply_all), and worker offloading.
 * ============================================================================
 */

import type { MotionDocument, Object3d, Mesh3d, Modifier3d } from "../../document/schema";
import type { MeshData } from "./types";
import { getModifierDefinition } from "./registry";
import { jobPool } from "../../jobs";

// ---------------------------------------------------------------------------
// MeshData <-> Mesh3d Converters
// ---------------------------------------------------------------------------

/**
 * Converts a document Mesh3d record to pure MeshData typed arrays.
 */
export function mesh3dToMeshData(mesh: Mesh3d): MeshData {
  const positions = mesh.positions ? new Float32Array(mesh.positions) : new Float32Array(0);
  const indices = mesh.indices ? new Uint32Array(mesh.indices) : new Uint32Array(0);
  const uvs = mesh.uvs ? new Float32Array(mesh.uvs) : undefined;
  const normals = mesh.normals ? new Float32Array(mesh.normals) : undefined;
  return { positions, indices, uvs, normals };
}

// ---------------------------------------------------------------------------
// LRU Cache for Evaluated Stacks
// ---------------------------------------------------------------------------

const CACHE_LIMIT = 64;
const stackCache = new Map<string, MeshData>();

/**
 * Computes a deterministic cache key for a mesh and modifier stack.
 */
export function stackKey(
  meshHash: string | number,
  modifiers?: Modifier3d[],
  options?: { viewport?: boolean }
): string {
  const vp = options?.viewport ?? true;
  const activeMods = (modifiers ?? []).filter((m) =>
    vp ? m.enabled !== false : m.renderEnabled !== false
  );
  const parts = activeMods.map((m) => `${m.id}:${m.type}:${JSON.stringify(m.params ?? {})}`);
  return `${meshHash}:${vp ? "vp" : "render"}:[${parts.join(",")}]`;
}

/**
 * Clears the modifier stack evaluation LRU cache.
 */
export function clearModifierCache(): void {
  stackCache.clear();
}

/**
 * Computes a fast hash of a mesh for caching when no external hash is provided.
 */
export function quickMeshHash(mesh: MeshData): string {
  const pLen = mesh.positions.length;
  const iLen = mesh.indices.length;
  const p0 = pLen > 0 ? mesh.positions[0].toFixed(4) : "0";
  const pMid = pLen > 4 ? mesh.positions[Math.floor(pLen / 2)].toFixed(4) : "0";
  const pEnd = pLen > 1 ? mesh.positions[pLen - 1].toFixed(4) : "0";
  return `m_${pLen}_${iLen}_${p0}_${pMid}_${pEnd}`;
}

// ---------------------------------------------------------------------------
// Core Pure Stack Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates an ordered modifier stack on a mesh.
 * Skips modifiers disabled for the requested context (viewport vs render).
 * Pure and non-mutating.
 */
export function evaluateStack(
  mesh: MeshData,
  modifiers?: Modifier3d[],
  options?: { viewport?: boolean; meshHash?: string | number }
): MeshData {
  const vp = options?.viewport ?? true;
  const activeList = modifiers ?? [];

  // If there are no modifiers, return original mesh
  if (activeList.length === 0) {
    return mesh;
  }

  // Check LRU cache
  const mHash = options?.meshHash !== undefined ? options.meshHash : quickMeshHash(mesh);
  const key = stackKey(mHash, activeList, { viewport: vp });

  const cached = stackCache.get(key);
  if (cached) {
    // Refresh LRU order
    stackCache.delete(key);
    stackCache.set(key, cached);
    return cached;
  }

  let currentMesh: MeshData = mesh;

  for (const mod of activeList) {
    const isEnabled = vp ? mod.enabled !== false : mod.renderEnabled !== false;
    if (!isEnabled) continue;

    const def = getModifierDefinition(mod.type);
    if (!def) continue;

    currentMesh = def.evaluate(currentMesh, mod.params as never);
  }

  // Cache result
  if (stackCache.size >= CACHE_LIMIT) {
    const oldestKey = stackCache.keys().next().value;
    if (oldestKey !== undefined) stackCache.delete(oldestKey);
  }
  stackCache.set(key, currentMesh);

  return currentMesh;
}

/**
 * Pure function run by the worker handler or directly in unit tests.
 */
export function evaluateModifiersWorker(
  mesh: MeshData,
  modifiers?: Modifier3d[],
  viewport?: boolean
): MeshData {
  return evaluateStack(mesh, modifiers, { viewport });
}

/**
 * Evaluates the stack asynchronously, dispatching to a web worker pool
 * if vertex count passes 50,000 and jobPool is available, otherwise running inline.
 */
export async function evaluateStackAsync(
  mesh: MeshData,
  modifiers?: Modifier3d[],
  options?: { viewport?: boolean; meshHash?: string | number }
): Promise<MeshData> {
  const vertexCount = mesh.positions.length / 3;

  if (vertexCount >= 50000) {
    const pool = jobPool();
    if (pool) {
      const key =
        options?.meshHash !== undefined
          ? stackKey(options.meshHash, modifiers, options)
          : undefined;

      const handle = pool.run<MeshData>(
        "modifiers.eval",
        {
          mesh,
          modifiers,
          viewport: options?.viewport,
        },
        {
          key,
          transfer: [mesh.positions.buffer, mesh.indices.buffer],
        }
      );
      return handle.promise;
    }
  }

  return evaluateStack(mesh, modifiers, options);
}

// ---------------------------------------------------------------------------
// Immutable Document Mutations
// ---------------------------------------------------------------------------

function cloneDocObjects(doc: MotionDocument): Record<string, Object3d> {
  const objects: Record<string, Object3d> = {};
  if (doc.objects) {
    for (const [id, obj] of Object.entries(doc.objects)) {
      objects[id] = {
        ...obj,
        modifiers: obj.modifiers ? [...obj.modifiers] : [],
      };
    }
  }
  return objects;
}

/**
 * Adds a modifier to an object's stack. Pure and immutable.
 */
export function addModifier(
  doc: MotionDocument,
  objectId: string,
  modifier: Modifier3d,
  index?: number
): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj) return doc;

  const objects = cloneDocObjects(doc);
  const targetObj = objects[objectId];
  const list = targetObj.modifiers ? [...targetObj.modifiers] : [];

  if (index !== undefined && index >= 0 && index <= list.length) {
    list.splice(index, 0, modifier);
  } else {
    list.push(modifier);
  }
  targetObj.modifiers = list;

  return { ...doc, objects };
}

/**
 * Removes a modifier from an object's stack by ID. Pure and immutable.
 */
export function removeModifier(
  doc: MotionDocument,
  objectId: string,
  modifierId: string
): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj || !obj.modifiers) return doc;

  const objects = cloneDocObjects(doc);
  const targetObj = objects[objectId];
  targetObj.modifiers = (targetObj.modifiers ?? []).filter((m) => m.id !== modifierId);

  return { ...doc, objects };
}

/**
 * Reorders a modifier within the stack. Pure and immutable.
 */
export function reorderModifier(
  doc: MotionDocument,
  objectId: string,
  modifierId: string,
  newIndex: number
): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj || !obj.modifiers) return doc;

  const list = [...obj.modifiers];
  const oldIndex = list.findIndex((m) => m.id === modifierId);
  if (oldIndex === -1) return doc;

  const [item] = list.splice(oldIndex, 1);
  const targetIndex = Math.max(0, Math.min(list.length, newIndex));
  list.splice(targetIndex, 0, item);

  const objects = cloneDocObjects(doc);
  objects[objectId].modifiers = list;

  return { ...doc, objects };
}

/**
 * Sets a parameter on a specific modifier in the stack. Pure and immutable.
 */
export function setModifierParam(
  doc: MotionDocument,
  objectId: string,
  modifierId: string,
  param: string,
  value: unknown
): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj || !obj.modifiers) return doc;

  const objects = cloneDocObjects(doc);
  const targetObj = objects[objectId];
  targetObj.modifiers = (targetObj.modifiers ?? []).map((m) => {
    if (m.id !== modifierId) return m;
    return {
      ...m,
      params: {
        ...(m.params ?? {}),
        [param]: value,
      },
    };
  });

  return { ...doc, objects };
}

/**
 * Toggles viewport/render visibility on a modifier. Pure and immutable.
 */
export function setModifierVisibility(
  doc: MotionDocument,
  objectId: string,
  modifierId: string,
  toggles: { enabled?: boolean; renderEnabled?: boolean }
): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj || !obj.modifiers) return doc;

  const objects = cloneDocObjects(doc);
  const targetObj = objects[objectId];
  targetObj.modifiers = (targetObj.modifiers ?? []).map((m) => {
    if (m.id !== modifierId) return m;
    return {
      ...m,
      ...(toggles.enabled !== undefined ? { enabled: toggles.enabled } : {}),
      ...(toggles.renderEnabled !== undefined ? { renderEnabled: toggles.renderEnabled } : {}),
    };
  });

  return { ...doc, objects };
}

/**
 * Applies (bakes) the first modifier in the stack into the object's mesh data block.
 * Per Blender rules: only the first modifier in the stack can be applied.
 * Throws an Error if modifierId is not the first modifier.
 */
export function applyModifier(
  doc: MotionDocument,
  objectId: string,
  modifierId: string
): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj) {
    throw new Error(`Object not found: "${objectId}"`);
  }
  if (!obj.modifiers || obj.modifiers.length === 0) {
    throw new Error(`Object "${objectId}" has no modifiers to apply`);
  }

  const firstMod = obj.modifiers[0];
  if (firstMod.id !== modifierId) {
    throw new Error("Cannot apply modifier: only the first modifier in the stack can be applied");
  }

  if (!obj.dataId || !doc.meshes?.[obj.dataId]) {
    throw new Error(`Object "${objectId}" mesh data block not found`);
  }

  const baseMesh = doc.meshes[obj.dataId];
  const meshData = mesh3dToMeshData(baseMesh);
  const baked = evaluateStack(meshData, [firstMod], { viewport: true });

  const updatedMesh: Mesh3d = {
    ...baseMesh,
    positions: Array.from(baked.positions),
    indices: Array.from(baked.indices),
    normals: baked.normals ? Array.from(baked.normals) : undefined,
    uvs: baked.uvs ? Array.from(baked.uvs) : undefined,
  };

  const meshes = { ...doc.meshes, [obj.dataId]: updatedMesh };
  const objects = cloneDocObjects(doc);
  objects[objectId].modifiers = obj.modifiers.slice(1);

  return {
    ...doc,
    meshes,
    objects,
  };
}

/**
 * Applies (bakes) all enabled modifiers in the stack into the object's mesh.
 * Empties the modifier stack.
 */
export function applyAll(doc: MotionDocument, objectId: string): MotionDocument {
  const obj = doc.objects?.[objectId];
  if (!obj) {
    throw new Error(`Object not found: "${objectId}"`);
  }
  if (!obj.modifiers || obj.modifiers.length === 0) {
    return doc;
  }
  if (!obj.dataId || !doc.meshes?.[obj.dataId]) {
    throw new Error(`Object "${objectId}" mesh data block not found`);
  }

  const baseMesh = doc.meshes[obj.dataId];
  const meshData = mesh3dToMeshData(baseMesh);
  const baked = evaluateStack(meshData, obj.modifiers, { viewport: true });

  const updatedMesh: Mesh3d = {
    ...baseMesh,
    positions: Array.from(baked.positions),
    indices: Array.from(baked.indices),
    normals: baked.normals ? Array.from(baked.normals) : undefined,
    uvs: baked.uvs ? Array.from(baked.uvs) : undefined,
  };

  const meshes = { ...doc.meshes, [obj.dataId]: updatedMesh };
  const objects = cloneDocObjects(doc);
  objects[objectId].modifiers = [];

  return {
    ...doc,
    meshes,
    objects,
  };
}
