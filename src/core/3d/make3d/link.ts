/**
 * ============================================================================
 * MAKE 3D DOCUMENT LINK & COMMANDS (Phase 3D-029)
 * ============================================================================
 * Links 2D document layers to 3D meshes (extrude, inflate, lathe, plane):
 *   - Stored in `mesh.source = { kind: "make3d", params: { layerId, mode, ... } }`.
 *   - `makeFromLayer(doc, layerId, mode, params)` creates object + mesh + material.
 *   - `refreshLinked(doc, changedLayerIds)` updates every mesh linked to changed layers.
 *   - Typed commands: `3d.make3d.from_layer`, `3d.make3d.refresh`.
 * ============================================================================
 */

import { z } from "zod";
import { defineTypedCommand } from "../../commands";
import { createId } from "../../ids";
import type {
  Layer,
  Material3d,
  Mesh3d,
  MotionDocument,
  Object3d,
  Scene3d,
} from "../../document/schema";
import { documentCommands, getDocument } from "../../store/useDocumentStore";
import { layerOutlineRings } from "../sdf/layerSources";
import { extrudeRings } from "./extrude";
import { inflateRings } from "./inflate";
import { latheRings } from "./lathe";
import { createPlaneMesh } from "./plane";
import type { Make3DMode, Make3DParams, MeshData } from "./types";

/**
 * Extracts base fill color from a 2D layer's properties.
 */
export function extractLayerFillColor(layer?: Layer): string {
  if (!layer?.properties) return "#ffffff";
  const p = layer.properties;
  if (typeof p["fill"] === "string" && p["fill"]) return p["fill"];
  if (typeof p["svg.fill"] === "string" && p["svg.fill"]) return p["svg.fill"];
  if (typeof p["paint.fills"] === "string") {
    try {
      const parsed = JSON.parse(p["paint.fills"]);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.color) {
        return parsed[0].color;
      }
    } catch {}
  }
  return "#ffffff";
}

/**
 * Dispatches mesh generation based on mode and layer outline.
 */
export function generateMeshFromLayer(
  doc: MotionDocument,
  layerId: string,
  mode: Make3DMode,
  params?: Record<string, unknown>
): MeshData {
  const rings = layerOutlineRings(doc, layerId, 0.1);

  switch (mode) {
    case "extrude":
      return extrudeRings(rings, {
        depth: typeof params?.depth === "number" ? params.depth : 10,
        bevel: params?.bevel as { size?: number; segments?: number; profile?: "round" | "chamfer" | "concave" } | undefined,
      });

    case "inflate":
      return inflateRings(rings, {
        depth: typeof params?.depth === "number" ? params.depth : 10,
        resolution: typeof params?.resolution === "number" ? params.resolution : 16,
      });

    case "lathe":
      return latheRings(rings, {
        segments: typeof params?.segments === "number" ? params.segments : 32,
        axis: params?.axis as "x" | "y" | "z" | undefined,
      });

    case "plane":
      return createPlaneMesh(rings, {
        thickness: typeof params?.thickness === "number" ? params.thickness : 0.01,
      });

    default:
      return extrudeRings(rings);
  }
}

/**
 * Creates a complete 3D object, mesh, and material from a 2D layer,
 * linked to the layer via `mesh.source`.
 * Returns the updated immutable MotionDocument.
 */
export function makeFromLayer(
  doc: MotionDocument,
  layerId: string,
  mode: Make3DMode,
  params?: Record<string, unknown>
): MotionDocument {
  const layer = doc.layers[layerId];
  if (!layer) return doc;

  const next = structuredClone(doc);

  // 1. Resolve or create active 3D scene
  if (!next.scenes) next.scenes = {};
  let sceneId = Object.keys(next.scenes)[0];
  if (!sceneId) {
    sceneId = createId("scene");
    const newScene: Scene3d = {
      id: sceneId,
      name: "Scene",
      activeCamera: null,
      world: null,
      objects: [],
    };
    next.scenes[sceneId] = newScene;
  }
  const scene = next.scenes[sceneId];

  // 2. Discover any text layer ids on or inside this layer
  const textLayerIds: string[] = [];
  if (layer.archetype === "text") {
    textLayerIds.push(layer.id);
  }
  if (Array.isArray(layer.children)) {
    for (const childId of layer.children) {
      const child = doc.layers[childId];
      if (child?.archetype === "text") {
        textLayerIds.push(childId);
      }
    }
  }

  // 3. Generate mesh geometry
  const meshData = generateMeshFromLayer(doc, layerId, mode, params);

  // 4. Create Material3d from layer fill
  const matId = createId("mat");
  if (!next.materials) next.materials = {};
  const baseColor = extractLayerFillColor(layer);
  const material: Material3d = {
    id: matId,
    name: `${layer.name || "Layer"} Material`,
    baseColor,
    emissive: "#000000",
    roughness: 0.5,
    metallic: 0,
  };
  next.materials[matId] = material;

  // 5. Create Mesh3d with source link
  const meshId = createId("mesh");
  if (!next.meshes) next.meshes = {};
  const mesh: Mesh3d = {
    id: meshId,
    name: `${layer.name || "Layer"} Mesh`,
    positions: Array.from(meshData.positions),
    indices: Array.from(meshData.indices),
    uvs: Array.from(meshData.uvs),
    normals: meshData.normals ? Array.from(meshData.normals) : undefined,
    source: {
      kind: "make3d",
      params: {
        layerId,
        mode,
        ...(params ?? {}),
        textLayerIds,
      },
    },
  };
  next.meshes[meshId] = mesh;

  // 6. Create Object3d
  const objId = createId("obj");
  if (!next.objects) next.objects = {};
  const object: Object3d = {
    id: objId,
    name: `${layer.name || "Layer"} 3D`,
    type: "mesh",
    dataId: meshId,
    materialSlots: [matId],
    materials: [matId],
    transform: {
      location: [0, 0, 0],
      rotationQuat: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
  };
  next.objects[objId] = object;

  // Add object to scene
  if (!scene.objects.includes(objId)) {
    scene.objects.push(objId);
  }

  return next;
}

/**
 * Rebuilds every mesh linked to changed 2D layers in under 100 ms.
 * Returns the updated immutable MotionDocument.
 */
export function refreshLinked(
  doc: MotionDocument,
  changedLayerIds: readonly string[]
): MotionDocument {
  if (!doc.meshes) return doc;
  const changedSet = new Set(changedLayerIds);

  let meshesUpdated = false;
  const nextMeshes: Record<string, Mesh3d> = { ...doc.meshes };
  const nextMaterials: Record<string, Material3d> = doc.materials ? { ...doc.materials } : {};

  for (const [meshId, mesh] of Object.entries(doc.meshes)) {
    if (mesh.source?.kind === "make3d") {
      const p = mesh.source.params as Make3DParams;
      if (changedSet.has(p.layerId)) {
        const layer = doc.layers[p.layerId];
        if (layer) {
          const meshData = generateMeshFromLayer(doc, p.layerId, p.mode, p);
          nextMeshes[meshId] = {
            ...mesh,
            positions: Array.from(meshData.positions),
            indices: Array.from(meshData.indices),
            uvs: Array.from(meshData.uvs),
            normals: meshData.normals ? Array.from(meshData.normals) : undefined,
          };
          meshesUpdated = true;

          // Update linked material color if exists
          if (doc.objects) {
            for (const obj of Object.values(doc.objects)) {
              if (obj.dataId === meshId) {
                const matId = obj.materials?.[0] ?? obj.materialSlots?.[0];
                if (matId && nextMaterials[matId]) {
                  nextMaterials[matId] = {
                    ...nextMaterials[matId],
                    baseColor: extractLayerFillColor(layer),
                  };
                }
              }
            }
          }
        }
      }
    }
  }

  if (!meshesUpdated) return doc;

  return {
    ...doc,
    meshes: nextMeshes,
    materials: nextMaterials,
  };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export const Make3DFromLayerArgsSchema = z.object({
  layerId: z.string().min(1),
  mode: z.enum(["extrude", "inflate", "lathe", "plane"]).default("extrude"),
  depth: z.number().optional(),
  bevel: z
    .object({
      size: z.number().optional(),
      segments: z.number().int().optional(),
      profile: z.enum(["round", "chamfer", "concave"]).optional(),
    })
    .optional(),
  resolution: z.number().optional(),
  segments: z.number().optional(),
  axis: z.enum(["x", "y", "z"]).optional(),
});
export type Make3DFromLayerArgs = z.infer<typeof Make3DFromLayerArgsSchema>;

export const Make3DRefreshArgsSchema = z.object({
  layerIds: z.array(z.string().min(1)).optional(),
});
export type Make3DRefreshArgs = z.infer<typeof Make3DRefreshArgsSchema>;

/**
 * Registers make3d commands under category "3D".
 */
export function register3dMake3dCommands(): () => void {
  const category = "3D";
  const unregisters: (() => void)[] = [];

  unregisters.push(
    defineTypedCommand({
      id: "3d.make3d.from_layer",
      title: "Make 3D from Layer",
      category,
      args: Make3DFromLayerArgsSchema,
      run: (args) => {
        const doc = getDocument();
        const next = makeFromLayer(doc, args.layerId, args.mode, args);
        documentCommands.mutate("Make 3D from Layer", (draft) => {
          draft.scenes = next.scenes;
          draft.objects = next.objects;
          draft.meshes = next.meshes;
          draft.materials = next.materials;
        });
        return { ok: true };
      },
    })
  );

  unregisters.push(
    defineTypedCommand({
      id: "3d.make3d.refresh",
      title: "Refresh 3D Linked Meshes",
      category,
      args: Make3DRefreshArgsSchema,
      run: (args) => {
        const doc = getDocument();
        const layerIds = args.layerIds ?? Object.keys(doc.layers);
        const next = refreshLinked(doc, layerIds);
        documentCommands.mutate("Refresh 3D Meshes", (draft) => {
          draft.meshes = next.meshes;
          draft.materials = next.materials;
        });
        return { ok: true };
      },
    })
  );

  return () => {
    unregisters.forEach((off) => off());
  };
}
