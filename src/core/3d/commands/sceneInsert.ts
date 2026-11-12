/**
 * ============================================================================
 * 3D SCENE INSERT & EXIT COMMANDS (Phase 3D-012)
 * ============================================================================
 * Defines commands for creating and entering/exiting 3D scenes:
 *   - `3d.scene.insert`: Creates a complete scene data block hierarchy (scene,
 *     default cube primitive, camera, point light) and places a `scene3d`
 *     layer inside the active frame in one atomic undo step.
 *   - `3d.scene.exit`: Exits 3D scene editing mode, bound to "Escape" when
 *     `editingScene3d` is true.
 * ============================================================================
 */

import { z } from "zod";
import { defineTypedCommand, defineCommand } from "../../commands";
import { createId } from "../../ids";
import { documentCommands, getDocument } from "../../store/useDocumentStore";
import { useSelectionStore } from "../../store/useSelectionStore";
import { useCanvasViewStore } from "../../store/useCanvasViewStore";
import { createLayer } from "../../document/factories";
import type {
  Scene3d,
  Object3d,
  Mesh3d,
  Material3d,
  Light3d,
  Camera3d,
} from "../../document/schema";
import { cube } from "./primitives";
import { useViewportStore } from "../../render/scene3d/viewportStore";

export const InsertSceneArgsSchema = z
  .object({
    width: z.number().positive().optional().default(480),
    height: z.number().positive().optional().default(320),
  })
  .default({ width: 480, height: 320 });

export type InsertSceneArgs = z.infer<typeof InsertSceneArgsSchema>;

export interface InsertSceneResult {
  ok: boolean;
  sceneId: string;
  layerId: string;
}

/**
 * Creates default scene entities: cube, camera, point light.
 */
export function buildDefaultSceneData(): {
  sceneId: string;
  scene: Scene3d;
  meshId: string;
  cubeMesh: Mesh3d;
  matId: string;
  material: Material3d;
  cubeObjId: string;
  cubeObj: Object3d;
  camDataId: string;
  cameraData: Camera3d;
  camObjId: string;
  camObj: Object3d;
  litDataId: string;
  lightData: Light3d;
  litObjId: string;
  litObj: Object3d;
} {
  const sceneId = createId("scn");
  const meshId = createId("msh");
  const matId = createId("mat");
  const cubeObjId = createId("obj");
  const camDataId = createId("cam");
  const camObjId = createId("obj");
  const litDataId = createId("lit");
  const litObjId = createId("obj");

  const prim = cube({ size: 1 });
  const cubeMesh: Mesh3d = {
    id: meshId,
    name: "CubeMesh",
    positions: Array.from(prim.positions),
    indices: Array.from(prim.indices),
  };

  const material: Material3d = {
    id: matId,
    name: "CubeMaterial",
    baseColor: "#6366f1",
    metallic: 0.1,
    roughness: 0.4,
    emissive: "#000000",
  };

  const cubeObj: Object3d = {
    id: cubeObjId,
    name: "Cube",
    type: "mesh",
    dataId: meshId,
    materials: [matId],
    transform: {
      location: [0, 0, 0],
      rotationQuat: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    visible: true,
  };

  const cameraData: Camera3d = {
    id: camDataId,
    name: "Camera",
    type: "perspective",
    fov: 50,
    near: 0.1,
    far: 1000,
  };

  const camObj: Object3d = {
    id: camObjId,
    name: "Camera",
    type: "camera",
    dataId: camDataId,
    transform: {
      location: [0, -5, 3],
      rotationQuat: [0.3826834, 0, 0, 0.9238795],
      scale: [1, 1, 1],
    },
    visible: true,
  };

  const lightData: Light3d = {
    id: litDataId,
    name: "Light",
    type: "point",
    color: "#ffffff",
    intensity: 25,
    distance: 0,
    decay: 2,
    castShadow: true,
  };

  const litObj: Object3d = {
    id: litObjId,
    name: "Light",
    type: "light",
    dataId: litDataId,
    transform: {
      location: [3, -3, 4],
      rotationQuat: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    visible: true,
  };

  const scene: Scene3d = {
    id: sceneId,
    name: "3D Scene",
    objects: [cubeObjId, camObjId, litObjId],
    activeCamera: camObjId,
  };

  return {
    sceneId,
    scene,
    meshId,
    cubeMesh,
    matId,
    material,
    cubeObjId,
    cubeObj,
    camDataId,
    cameraData,
    camObjId,
    camObj,
    litDataId,
    lightData,
    litObjId,
    litObj,
  };
}

/**
 * Inserts a 3D scene and its scene3d layer into the document in one undo step.
 */
export function insert3dScene(args?: InsertSceneArgs): InsertSceneResult {
  const doc = getDocument();
  const width = args?.width ?? 480;
  const height = args?.height ?? 320;

  // Resolve target frame
  const activeFrame = useCanvasViewStore.getState().activeFrameId;
  let targetParentId: string | null = null;
  if (activeFrame && doc.layers[activeFrame] && doc.layers[activeFrame].parentId === null) {
    targetParentId = activeFrame;
  } else {
    const rootFrame = Object.values(doc.layers).find((l) => l.parentId === null);
    targetParentId = rootFrame ? rootFrame.id : null;
  }

  const {
    sceneId,
    scene,
    meshId,
    cubeMesh,
    matId,
    material,
    cubeObjId,
    cubeObj,
    camDataId,
    cameraData,
    camObjId,
    camObj,
    litDataId,
    lightData,
    litObjId,
    litObj,
  } = buildDefaultSceneData();

  const layerId = createId("lay");
  const layer = createLayer({
    id: layerId,
    name: "3D Scene",
    archetype: "scene3d",
    parentId: targetParentId,
    properties: {
      scene: sceneId,
      "frame.x": 40,
      "frame.y": 40,
      "frame.width": width,
      "frame.height": height,
      positioning: "absolute",
    },
  });

  // Atomic mutation (one undo step)
  documentCommands.mutate("Insert 3D scene", (draft) => {
    draft.scenes = { ...(draft.scenes ?? {}), [sceneId]: scene };
    draft.meshes = { ...(draft.meshes ?? {}), [meshId]: cubeMesh };
    draft.materials = { ...(draft.materials ?? {}), [matId]: material };
    draft.lights = { ...(draft.lights ?? {}), [litDataId]: lightData };
    draft.cameras = { ...(draft.cameras ?? {}), [camDataId]: cameraData };
    draft.objects = {
      ...(draft.objects ?? {}),
      [cubeObjId]: cubeObj,
      [camObjId]: camObj,
      [litObjId]: litObj,
    };
    draft.layers[layerId] = layer;
    if (targetParentId && draft.layers[targetParentId]) {
      draft.layers[targetParentId].children.push(layerId);
    }
  });

  // Select newly inserted layer
  useSelectionStore.getState().select(layerId, "element");

  return {
    ok: true,
    sceneId,
    layerId,
  };
}

/**
 * Registers `3d.scene.insert` and `3d.scene.exit` commands on the command bus.
 * Returns an unregister cleanup function.
 */
export function registerSceneCommands(): () => void {
  const unregisterInsert = defineTypedCommand({
    id: "3d.scene.insert",
    title: "Insert 3D scene",
    category: "Insert",
    args: InsertSceneArgsSchema,
    run: (args) => insert3dScene(args),
  });

  const unregisterExit = defineCommand({
    id: "3d.scene.exit",
    title: "Exit 3D scene editing",
    category: "3D",
    keybinding: "Escape",
    when: (ctx) => Boolean(ctx.editingScene3d),
    run: () => {
      useViewportStore.getState().setEditingSceneId(null);
      return { ok: true };
    },
  });

  return () => {
    unregisterInsert();
    unregisterExit();
  };
}
