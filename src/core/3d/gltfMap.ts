/**
 * ============================================================================
 * glTF 2.0 MAPPING & SERIALIZATION HELPERS
 * ============================================================================
 * Pure TypeScript conversion between MotionDocument 3D data blocks (MDM v7)
 * and glTF 2.0 JSON structures.
 *
 * Capabilities:
 *   - Node transform <-> Object transform mapping (TRS and column-major matrix).
 *   - Pure `toGltfJson(doc, sceneId)`: generates standard glTF 2.0 JSON with
 *     nodes, meshes, accessors, bufferViews, and a self-contained base64 data URI
 *     buffer (zero external files required).
 *   - Pure `fromGltfJson(json, existingDoc?)`: parses glTF 2.0 JSON, restoring
 *     scene hierarchy, exact TRS transforms, and mesh attributes (positions,
 *     indices, normals, UVs).
 * ============================================================================
 */

import { type Mat4, decompose, mat4From } from "./math";
import type { Mesh3d, Object3d, Scene3d, Transform3d } from "../document/scene3d";
import { createEmptyDocument, type MotionDocument } from "../document/schema";

// ---------------------------------------------------------------------------
// Base64 Helpers (Pure runtime, Node.js Buffer & browser atob/btoa compatible)
// ---------------------------------------------------------------------------

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  }
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  // Strip optional data URI prefix if present
  const commaIdx = base64.indexOf(",");
  const cleanBase64 = commaIdx >= 0 ? base64.slice(commaIdx + 1) : base64;

  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(cleanBase64, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(cleanBase64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// glTF 2.0 TypeScript Definitions
// ---------------------------------------------------------------------------

export interface GltfAccessor {
  bufferView: number;
  byteOffset?: number;
  componentType: number; // 5126 = FLOAT, 5123 = UNSIGNED_SHORT, 5125 = UNSIGNED_INT
  count: number;
  type: "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT4";
  max?: number[];
  min?: number[];
}

export interface GltfBufferView {
  buffer: number;
  byteOffset: number;
  byteLength: number;
  target?: number; // 34962 = ARRAY_BUFFER, 34963 = ELEMENT_ARRAY_BUFFER
}

export interface GltfBuffer {
  byteLength: number;
  uri?: string;
}

export interface GltfPrimitive {
  attributes: {
    POSITION: number;
    NORMAL?: number;
    TEXCOORD_0?: number;
    [key: string]: number | undefined;
  };
  indices?: number;
  mode?: number; // 4 = TRIANGLES
  extras?: Record<string, unknown>;
}

export interface GltfMesh {
  name?: string;
  primitives: GltfPrimitive[];
  extras?: Record<string, unknown>;
}

export interface GltfNode {
  name?: string;
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  matrix?: number[];
  children?: number[];
  mesh?: number;
  camera?: number;
  extras?: Record<string, unknown>;
}

export interface GltfScene {
  name?: string;
  nodes: number[];
  extras?: Record<string, unknown>;
}

export interface GltfRoot {
  asset: {
    version: string;
    generator?: string;
  };
  scene?: number;
  scenes?: GltfScene[];
  nodes?: GltfNode[];
  meshes?: GltfMesh[];
  accessors?: GltfAccessor[];
  bufferViews?: GltfBufferView[];
  buffers?: GltfBuffer[];
  extras?: Record<string, unknown>;
}

export interface GltfNodeTransform {
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  matrix?: number[];
}

// ---------------------------------------------------------------------------
// Node Transform <-> Object Transform
// ---------------------------------------------------------------------------

/**
 * Maps a glTF node's transformation (TRS or column-major matrix) to our Object3d Transform3d.
 */
export function nodeTransformToObjectTransform(node: GltfNodeTransform): Transform3d {
  if (node.matrix && node.matrix.length === 16) {
    const { location, quat: q, scale: s } = decompose(mat4From(node.matrix));
    return {
      location: [location[0], location[1], location[2]],
      rotationQuat: [q[0], q[1], q[2], q[3]],
      scale: [s[0], s[1], s[2]],
    };
  }

  const tx = node.translation?.[0] ?? 0;
  const ty = node.translation?.[1] ?? 0;
  const tz = node.translation?.[2] ?? 0;

  const qx = node.rotation?.[0] ?? 0;
  const qy = node.rotation?.[1] ?? 0;
  const qz = node.rotation?.[2] ?? 0;
  const qw = node.rotation?.[3] ?? 1;

  const sx = node.scale?.[0] ?? 1;
  const sy = node.scale?.[1] ?? 1;
  const sz = node.scale?.[2] ?? 1;

  return {
    location: [tx, ty, tz],
    rotationQuat: [qx, qy, qz, qw],
    scale: [sx, sy, sz],
  };
}

/**
 * Maps an Object3d Transform3d to a glTF node TRS transform object.
 */
export function objectTransformToNodeTransform(transform: Transform3d): {
  translation: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
} {
  return {
    translation: [
      transform.location[0],
      transform.location[1],
      transform.location[2],
    ],
    rotation: [
      transform.rotationQuat[0],
      transform.rotationQuat[1],
      transform.rotationQuat[2],
      transform.rotationQuat[3],
    ],
    scale: [
      transform.scale[0],
      transform.scale[1],
      transform.scale[2],
    ],
  };
}

export const gltfNodeToTransform = nodeTransformToObjectTransform;
export const transformToGltfNode = objectTransformToNodeTransform;

// ---------------------------------------------------------------------------
// Serialization: toGltfJson
// ---------------------------------------------------------------------------

/**
 * Converts a document scene to a self-contained glTF 2.0 JSON structure.
 * Geometry is embedded directly in buffers[0].uri as base64 without external files.
 */
export function toGltfJson(doc: MotionDocument, sceneId: string): GltfRoot {
  const scene = doc.scenes?.[sceneId];
  if (!scene) {
    throw new Error(`Scene "${sceneId}" not found in document.`);
  }

  const sceneObjIds = scene.objects ?? [];
  const sceneObjects: Object3d[] = [];
  const objIdToNodeIndex = new Map<string, number>();

  for (const id of sceneObjIds) {
    const obj = doc.objects?.[id];
    if (obj) {
      objIdToNodeIndex.set(id, sceneObjects.length);
      sceneObjects.push(obj);
    }
  }

  // 1. Identify Meshes used in this scene
  const meshIds: string[] = [];
  const meshIdToIndex = new Map<string, number>();
  for (const obj of sceneObjects) {
    if (obj.dataId && doc.meshes?.[obj.dataId]) {
      if (!meshIdToIndex.has(obj.dataId)) {
        meshIdToIndex.set(obj.dataId, meshIds.length);
        meshIds.push(obj.dataId);
      }
    }
  }

  // 2. Build Binary Data Buffer and Accessors for Meshes
  const bufferParts: Uint8Array[] = [];
  let currentOffset = 0;

  const bufferViews: GltfBufferView[] = [];
  const accessors: GltfAccessor[] = [];
  const gltfMeshes: GltfMesh[] = [];

  function appendBufferChunk(data: ArrayBufferView, target?: number): { bufferViewIndex: number; byteOffset: number; byteLength: number } {
    // 4-byte alignment
    const pad = (4 - (currentOffset % 4)) % 4;
    if (pad > 0) {
      bufferParts.push(new Uint8Array(pad));
      currentOffset += pad;
    }

    const byteOffset = currentOffset;
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    bufferParts.push(bytes);
    currentOffset += bytes.byteLength;

    const bufferViewIndex = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: bytes.byteLength,
      target,
    });

    return { bufferViewIndex, byteOffset, byteLength: bytes.byteLength };
  }

  for (const meshId of meshIds) {
    const mesh = doc.meshes![meshId];
    const primitiveAttributes: GltfPrimitive["attributes"] = {
      POSITION: -1,
    };
    let primitiveIndices: number | undefined = undefined;

    // Positions (required for valid mesh)
    const positions = mesh.positions ?? [];
    if (positions.length > 0) {
      const f32Positions = new Float32Array(positions);
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i], y = positions[i + 1], z = positions[i + 2];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }

      const { bufferViewIndex } = appendBufferChunk(f32Positions, 34962 /* ARRAY_BUFFER */);
      const accIndex = accessors.length;
      accessors.push({
        bufferView: bufferViewIndex,
        byteOffset: 0,
        componentType: 5126, // FLOAT
        count: Math.floor(positions.length / 3),
        type: "VEC3",
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
      });
      primitiveAttributes.POSITION = accIndex;
    }

    // Normals (optional)
    if (mesh.normals && mesh.normals.length > 0) {
      const f32Normals = new Float32Array(mesh.normals);
      const { bufferViewIndex } = appendBufferChunk(f32Normals, 34962);
      const accIndex = accessors.length;
      accessors.push({
        bufferView: bufferViewIndex,
        byteOffset: 0,
        componentType: 5126,
        count: Math.floor(mesh.normals.length / 3),
        type: "VEC3",
      });
      primitiveAttributes.NORMAL = accIndex;
    }

    // UVs (optional)
    if (mesh.uvs && mesh.uvs.length > 0) {
      const f32Uvs = new Float32Array(mesh.uvs);
      const { bufferViewIndex } = appendBufferChunk(f32Uvs, 34962);
      const accIndex = accessors.length;
      accessors.push({
        bufferView: bufferViewIndex,
        byteOffset: 0,
        componentType: 5126,
        count: Math.floor(mesh.uvs.length / 2),
        type: "VEC2",
      });
      primitiveAttributes.TEXCOORD_0 = accIndex;
    }

    // Indices (optional)
    if (mesh.indices && mesh.indices.length > 0) {
      let maxIdx = 0;
      for (const idx of mesh.indices) {
        if (idx > maxIdx) maxIdx = idx;
      }

      if (maxIdx < 65536) {
        const u16Indices = new Uint16Array(mesh.indices);
        const { bufferViewIndex } = appendBufferChunk(u16Indices, 34963 /* ELEMENT_ARRAY_BUFFER */);
        primitiveIndices = accessors.length;
        accessors.push({
          bufferView: bufferViewIndex,
          byteOffset: 0,
          componentType: 5123, // UNSIGNED_SHORT
          count: mesh.indices.length,
          type: "SCALAR",
          min: [0],
          max: [maxIdx],
        });
      } else {
        const u32Indices = new Uint32Array(mesh.indices);
        const { bufferViewIndex } = appendBufferChunk(u32Indices, 34963);
        primitiveIndices = accessors.length;
        accessors.push({
          bufferView: bufferViewIndex,
          byteOffset: 0,
          componentType: 5125, // UNSIGNED_INT
          count: mesh.indices.length,
          type: "SCALAR",
          min: [0],
          max: [maxIdx],
        });
      }
    }

    const primitive: GltfPrimitive = {
      attributes: primitiveAttributes,
      mode: 4, // TRIANGLES
      extras: {
        meshId: mesh.id,
        positions: mesh.positions,
        indices: mesh.indices,
        normals: mesh.normals,
        uvs: mesh.uvs,
      },
    };
    if (primitiveIndices !== undefined) {
      primitive.indices = primitiveIndices;
    }

    gltfMeshes.push({
      name: mesh.name ?? mesh.id,
      primitives: [primitive],
      extras: {
        id: mesh.id,
      },
    });
  }

  // Combine binary chunks into single buffer with data URI
  let finalBuffer: GltfBuffer[] = [];
  if (currentOffset > 0) {
    const totalBytes = new Uint8Array(currentOffset);
    let offset = 0;
    for (const chunk of bufferParts) {
      totalBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const base64Uri = `data:application/octet-stream;base64,${uint8ArrayToBase64(totalBytes)}`;
    finalBuffer = [
      {
        byteLength: currentOffset,
        uri: base64Uri,
      },
    ];
  }

  // 3. Build Nodes and Scene Hierarchy
  const gltfNodes: GltfNode[] = [];
  const rootNodeIndices: number[] = [];

  for (let i = 0; i < sceneObjects.length; i++) {
    const obj = sceneObjects[i];
    const trs = objectTransformToNodeTransform(obj.transform);

    // Find children in this scene
    const children: number[] = [];
    for (let j = 0; j < sceneObjects.length; j++) {
      if (sceneObjects[j].parentId === obj.id) {
        children.push(j);
      }
    }

    const node: GltfNode = {
      name: obj.name ?? obj.id,
      translation: trs.translation,
      rotation: trs.rotation,
      scale: trs.scale,
      extras: {
        id: obj.id,
        parentId: obj.parentId,
        type: obj.type,
        dataId: obj.dataId,
      },
    };

    if (children.length > 0) {
      node.children = children;
    }

    if (obj.dataId && meshIdToIndex.has(obj.dataId)) {
      node.mesh = meshIdToIndex.get(obj.dataId);
    }

    gltfNodes.push(node);

    // If has no parent or parent is not within this scene, it is a root node
    if (!obj.parentId || !objIdToNodeIndex.has(obj.parentId)) {
      rootNodeIndices.push(i);
    }
  }

  return {
    asset: {
      version: "2.0",
      generator: "LazyLayout gltfMap v1.0",
    },
    scene: 0,
    scenes: [
      {
        name: scene.name ?? sceneId,
        nodes: rootNodeIndices,
        extras: {
          sceneId: scene.id,
        },
      },
    ],
    nodes: gltfNodes,
    meshes: gltfMeshes.length > 0 ? gltfMeshes : undefined,
    accessors: accessors.length > 0 ? accessors : undefined,
    bufferViews: bufferViews.length > 0 ? bufferViews : undefined,
    buffers: finalBuffer.length > 0 ? finalBuffer : undefined,
    extras: {
      sceneId: scene.id,
      pxPerMetre: scene.settings?.pxPerMetre,
    },
  };
}

// ---------------------------------------------------------------------------
// Deserialization: fromGltfJson
// ---------------------------------------------------------------------------

export interface GltfImportResult {
  doc: MotionDocument;
  sceneId: string;
  scene: Scene3d;
  objects: Record<string, Object3d>;
  meshes: Record<string, Mesh3d>;
}

/**
 * Parses glTF 2.0 JSON (either object or JSON string) and converts its nodes
 * and meshes into standard MotionDocument 3D data blocks.
 */
export function fromGltfJson(
  jsonInput: GltfRoot | string,
  existingDoc?: Partial<MotionDocument>
): MotionDocument & GltfImportResult {
  const json: GltfRoot =
    typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;

  // 1. Decode Buffer if present
  let bufferDataView: DataView | null = null;
  if (json.buffers && json.buffers.length > 0 && json.buffers[0].uri) {
    const rawBytes = base64ToUint8Array(json.buffers[0].uri);
    bufferDataView = new DataView(
      rawBytes.buffer,
      rawBytes.byteOffset,
      rawBytes.byteLength
    );
  }

  // 2. Decode Meshes
  const meshes: Record<string, Mesh3d> = {};
  const meshIndexToId = new Map<number, string>();

  if (json.meshes) {
    for (let meshIdx = 0; meshIdx < json.meshes.length; meshIdx++) {
      const gltfMesh: GltfMesh = json.meshes[meshIdx];
      const prim: GltfPrimitive | undefined = gltfMesh.primitives[0];
      if (!prim) continue;

      let positions: number[] = [];
      let normals: number[] | undefined = undefined;
      let uvs: number[] | undefined = undefined;
      let indices: number[] | undefined = undefined;

      // Check extras first for bit-exact geometry round-trip
      if (prim.extras && Array.isArray(prim.extras.positions)) {
        positions = prim.extras.positions as number[];
        if (Array.isArray(prim.extras.normals)) {
          normals = prim.extras.normals as number[];
        }
        if (Array.isArray(prim.extras.uvs)) {
          uvs = prim.extras.uvs as number[];
        }
        if (Array.isArray(prim.extras.indices)) {
          indices = prim.extras.indices as number[];
        }
      } else if (bufferDataView && json.accessors && json.bufferViews) {
        // Read positions from accessor
        if (prim.attributes.POSITION !== undefined) {
          const acc = json.accessors[prim.attributes.POSITION];
          const bv = json.bufferViews[acc.bufferView];
          const byteOffset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
          positions = new Array(acc.count * 3);
          for (let i = 0; i < acc.count * 3; i++) {
            positions[i] = bufferDataView.getFloat32(byteOffset + i * 4, true);
          }
        }

        // Read normals from accessor
        if (prim.attributes.NORMAL !== undefined) {
          const acc = json.accessors[prim.attributes.NORMAL];
          const bv = json.bufferViews[acc.bufferView];
          const byteOffset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
          normals = new Array(acc.count * 3);
          for (let i = 0; i < acc.count * 3; i++) {
            normals[i] = bufferDataView.getFloat32(byteOffset + i * 4, true);
          }
        }

        // Read UVs from accessor
        if (prim.attributes.TEXCOORD_0 !== undefined) {
          const acc = json.accessors[prim.attributes.TEXCOORD_0];
          const bv = json.bufferViews[acc.bufferView];
          const byteOffset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
          uvs = new Array(acc.count * 2);
          for (let i = 0; i < acc.count * 2; i++) {
            uvs[i] = bufferDataView.getFloat32(byteOffset + i * 4, true);
          }
        }

        // Read indices from accessor
        if (prim.indices !== undefined) {
          const acc = json.accessors[prim.indices];
          const bv = json.bufferViews[acc.bufferView];
          const byteOffset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
          indices = new Array(acc.count);
          if (acc.componentType === 5123) {
            // UNSIGNED_SHORT
            for (let i = 0; i < acc.count; i++) {
              indices[i] = bufferDataView.getUint16(byteOffset + i * 2, true);
            }
          } else if (acc.componentType === 5125) {
            // UNSIGNED_INT
            for (let i = 0; i < acc.count; i++) {
              indices[i] = bufferDataView.getUint32(byteOffset + i * 4, true);
            }
          } else if (acc.componentType === 5121) {
            // UNSIGNED_BYTE
            for (let i = 0; i < acc.count; i++) {
              indices[i] = bufferDataView.getUint8(byteOffset + i);
            }
          }
        }
      }

      const meshId =
        (prim.extras?.meshId as string) ??
        (gltfMesh.extras?.id as string) ??
        gltfMesh.name ??
        `mesh_${meshIdx}`;

      meshIndexToId.set(meshIdx, meshId);
      meshes[meshId] = {
        id: meshId,
        name: gltfMesh.name,
        positions,
        indices,
        normals,
        uvs,
      };
    }
  }

  // 3. Decode Nodes & Object Hierarchy
  const objects: Record<string, Object3d> = {};
  const nodeIndexToId = new Map<number, string>();
  const parentMap = new Map<number, number>(); // childNodeIndex -> parentNodeIndex

  const gltfNodes = json.nodes ?? [];

  // Pass 1: Build IDs and child -> parent map
  for (let i = 0; i < gltfNodes.length; i++) {
    const node = gltfNodes[i];
    const objId =
      (node.extras?.id as string) ??
      (node.name ? node.name : `obj_${i}`);
    nodeIndexToId.set(i, objId);

    if (node.children) {
      for (const childIdx of node.children) {
        parentMap.set(childIdx, i);
      }
    }
  }

  // Pass 2: Create Object3d instances
  for (let i = 0; i < gltfNodes.length; i++) {
    const node = gltfNodes[i];
    const objId = nodeIndexToId.get(i)!;

    let parentId: string | null = null;
    if (parentMap.has(i)) {
      parentId = nodeIndexToId.get(parentMap.get(i)!) ?? null;
    } else if (node.extras?.parentId) {
      parentId = node.extras.parentId as string;
    }

    const transform = nodeTransformToObjectTransform(node);

    let dataId: string | null = null;
    if (node.mesh !== undefined && meshIndexToId.has(node.mesh)) {
      dataId = meshIndexToId.get(node.mesh)!;
    } else if (node.extras?.dataId) {
      dataId = node.extras.dataId as string;
    }

    const type =
      (node.extras?.type as Object3d["type"]) ??
      (node.mesh !== undefined ? "mesh" : "empty");

    objects[objId] = {
      id: objId,
      name: node.name,
      type,
      transform,
      parentId,
      dataId,
    };
  }

  // 4. Construct Scene
  const activeSceneIdx = json.scene ?? 0;
  const gltfScene = json.scenes?.[activeSceneIdx];

  const sceneId =
    (json.extras?.sceneId as string) ??
    (gltfScene?.extras?.sceneId as string) ??
    gltfScene?.name ??
    "scene_default";

  const sceneObjectIds = Object.keys(objects);
  const pxPerMetre =
    typeof json.extras?.pxPerMetre === "number"
      ? json.extras.pxPerMetre
      : 100;

  const scene: Scene3d = {
    id: sceneId,
    name: gltfScene?.name ?? "Scene",
    objects: sceneObjectIds,
    settings: {
      pxPerMetre,
    },
  };

  // 5. Build Complete MotionDocument
  const baseDoc = existingDoc ? ({ ...existingDoc } as MotionDocument) : createEmptyDocument();

  const doc: MotionDocument = {
    ...baseDoc,
    scenes: {
      ...(baseDoc.scenes ?? {}),
      [sceneId]: scene,
    },
    objects: {
      ...(baseDoc.objects ?? {}),
      ...objects,
    },
    meshes: {
      ...(baseDoc.meshes ?? {}),
      ...meshes,
    },
  };

  return Object.assign(doc, {
    doc,
    sceneId,
    scene,
    objects,
    meshes,
  });
}
