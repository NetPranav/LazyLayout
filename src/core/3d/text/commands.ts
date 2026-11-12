/**
 * ============================================================================
 * 3D TEXT COMMANDS (Phase 3D-026)
 * ============================================================================
 * Registers typed commands under category "3D":
 *   - `3d.add.text`: Adds a 3D text object and procedural mesh to the scene.
 *   - `3d.text.set`: Updates text parameters and regenerates the mesh.
 *   - `3d.text.convert_to_mesh`: Bakes the procedural text object into a plain mesh.
 * ============================================================================
 */

import { z } from "zod";
import { defineTypedCommand } from "../../commands";
import { createId } from "../../ids";
import type {
  Material3d,
  Mesh3d,
  MotionDocument,
  Object3d,
  Scene3d,
  Text3d,
} from "../../document/schema";
import { documentCommands, getDocument } from "../../store/useDocumentStore";
import { getCachedFont, registerFontBuffer } from "./fontCache";
import { textToMesh } from "./mesh";
import type { Font } from "./font";
import { quatFromEuler } from "../math";

export const AddTextArgsSchema = z.object({
  text: z.string().default("Text"),
  fontFamily: z.string().default("Geist"),
  fontUrl: z.string().optional(),
  fontBuffer: z.custom<ArrayBuffer>().optional(),
  size: z.number().default(1),
  depth: z.number().default(0.2),
  bevel: z.number().default(0.02),
  bevelSegments: z.number().int().nonnegative().default(3),
  align: z.enum(["left", "center", "right"]).default("left"),
  tracking: z.number().default(0),
  lineHeight: z.number().default(1.2),
  location: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).optional(),
  rotationQuat: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  scale: z.tuple([z.number(), z.number(), z.number()]).default([1, 1, 1]),
  sceneId: z.string().optional(),
});
export type AddTextArgs = z.infer<typeof AddTextArgsSchema>;

export const TextSetArgsSchema = z.object({
  objectId: z.string().optional(),
  textId: z.string().optional(),
  fontBuffer: z.custom<ArrayBuffer>().optional(),
  text: z.string().optional(),
  fontFamily: z.string().optional(),
  fontUrl: z.string().optional(),
  size: z.number().optional(),
  depth: z.number().optional(),
  bevel: z.number().optional(),
  bevelSegments: z.number().int().nonnegative().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  tracking: z.number().optional(),
  lineHeight: z.number().optional(),
});
export type TextSetArgs = z.infer<typeof TextSetArgsSchema>;

export const TextConvertToMeshArgsSchema = z.object({
  objectId: z.string().min(1),
});
export type TextConvertToMeshArgs = z.infer<typeof TextConvertToMeshArgsSchema>;

/**
 * Adds a 3D text object to the document immutably.
 */
export function addTextObject(
  doc: MotionDocument,
  args?: Partial<AddTextArgs>
): { doc: MotionDocument; objectId: string; textId: string; meshId: string } {
  const next = structuredClone(doc);

  // 1. Resolve font
  let font: Font | undefined;
  if (args?.fontBuffer) {
    font = registerFontBuffer(args.fontFamily ?? "Geist", args.fontBuffer);
  } else {
    font = getCachedFont(args?.fontFamily ?? "Geist");
  }

  // 2. Active Scene
  if (!next.scenes) next.scenes = {};
  let sceneId = args?.sceneId ?? Object.keys(next.scenes)[0];
  if (!sceneId || !next.scenes[sceneId]) {
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

  // 3. Create Text3d data block
  const textId = createId("txt");
  if (!next.texts) next.texts = {};
  const textBlock: Text3d = {
    id: textId,
    name: "Text Data",
    text: args?.text ?? "Text",
    fontFamily: args?.fontFamily ?? "Geist",
    fontUrl: args?.fontUrl,
    size: args?.size ?? 1,
    depth: args?.depth ?? 0.2,
    bevel: args?.bevel ?? 0.02,
    bevelSegments: args?.bevelSegments ?? 3,
    align: args?.align ?? "left",
    tracking: args?.tracking ?? 0,
    lineHeight: args?.lineHeight ?? 1.2,
  };
  next.texts[textId] = textBlock;

  // 4. Generate Mesh
  const meshId = createId("mesh");
  if (!next.meshes) next.meshes = {};

  let positions: number[] = [];
  let indices: number[] = [];
  let uvs: number[] = [];
  let normals: number[] | undefined;

  if (font) {
    const meshData = textToMesh(font, textBlock.text, {
      size: textBlock.size,
      depth: textBlock.depth,
      bevel: textBlock.bevel,
      bevelSegments: textBlock.bevelSegments,
      align: textBlock.align,
      tracking: textBlock.tracking,
      lineHeight: textBlock.lineHeight,
    });
    positions = Array.from(meshData.positions);
    indices = Array.from(meshData.indices);
    uvs = Array.from(meshData.uvs);
    normals = meshData.normals ? Array.from(meshData.normals) : undefined;
  } else {
    // Fallback minimal geometry when font is not yet loaded
    positions = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
    indices = [0, 1, 2, 0, 2, 3];
    uvs = [0, 0, 1, 0, 1, 1, 0, 1];
  }

  const mesh: Mesh3d = {
    id: meshId,
    name: `${textBlock.text} Mesh`,
    positions,
    indices,
    uvs,
    normals,
    source: {
      kind: "text",
      params: {
        textId,
      },
    },
  };
  next.meshes[meshId] = mesh;

  // 5. Default Material
  const matId = createId("mat");
  if (!next.materials) next.materials = {};
  const material: Material3d = {
    id: matId,
    name: "Text Material",
    baseColor: "#ffffff",
    emissive: "#000000",
    roughness: 0.4,
    metallic: 0.1,
  };
  next.materials[matId] = material;

  // 6. Create Object3d with type: "text"
  const objId = createId("obj");
  if (!next.objects) next.objects = {};
  const object: Object3d = {
    id: objId,
    name: textBlock.text,
    type: "text",
    dataId: textId,
    materialSlots: [matId],
    materials: [matId],
    transform: {
      location: args?.location ?? [0, 0, 0],
      rotationQuat: args?.rotationQuat ?? (args?.rotation ? ([...quatFromEuler("XYZ", args.rotation[0], args.rotation[1], args.rotation[2])] as [number, number, number, number]) : [0, 0, 0, 1]),
      scale: args?.scale ?? [1, 1, 1],
    },
  };
  next.objects[objId] = object;

  if (!scene.objects.includes(objId)) {
    scene.objects.push(objId);
  }

  return { doc: next, objectId: objId, textId, meshId };
}

/**
 * Updates text parameters and regenerates the linked mesh.
 */
export function setTextParams(
  doc: MotionDocument,
  args: TextSetArgs
): MotionDocument {
  const next = structuredClone(doc);
  if (!next.texts) return doc;

  // Resolve target text block
  let textId = args.textId;
  if (!textId && args.objectId && next.objects?.[args.objectId]) {
    textId = next.objects[args.objectId].dataId ?? undefined;
  }
  if (!textId || !next.texts[textId]) return doc;

  const current = next.texts[textId];
  const updated: Text3d = {
    ...current,
    text: args.text ?? current.text,
    fontFamily: args.fontFamily ?? current.fontFamily,
    fontUrl: args.fontUrl !== undefined ? args.fontUrl : current.fontUrl,
    size: args.size ?? current.size,
    depth: args.depth ?? current.depth,
    bevel: args.bevel ?? current.bevel,
    bevelSegments: args.bevelSegments ?? current.bevelSegments,
    align: args.align ?? current.align,
    tracking: args.tracking ?? current.tracking,
    lineHeight: args.lineHeight ?? current.lineHeight,
  };
  next.texts[textId] = updated;

  // Resolve font
  let font: Font | undefined;
  if (args.fontBuffer) {
    font = registerFontBuffer(updated.fontFamily, args.fontBuffer);
  } else {
    font = getCachedFont(updated.fontFamily);
  }

  // Regenerate associated mesh
  if (font && next.meshes) {
    for (const [meshId, mesh] of Object.entries(next.meshes)) {
      if (mesh.source?.kind === "text" && mesh.source.params.textId === textId) {
        const meshData = textToMesh(font, updated.text, {
          size: updated.size,
          depth: updated.depth,
          bevel: updated.bevel,
          bevelSegments: updated.bevelSegments,
          align: updated.align,
          tracking: updated.tracking,
          lineHeight: updated.lineHeight,
        });
        next.meshes[meshId] = {
          ...mesh,
          name: `${updated.text} Mesh`,
          positions: Array.from(meshData.positions),
          indices: Array.from(meshData.indices),
          uvs: Array.from(meshData.uvs),
          normals: meshData.normals ? Array.from(meshData.normals) : undefined,
        };
      }
    }
  }

  return next;
}

/**
 * Converts a text object to a baked plain mesh.
 */
export function convertTextToMesh(
  doc: MotionDocument,
  objectId: string
): MotionDocument {
  const next = structuredClone(doc);
  const obj = next.objects?.[objectId];
  if (!obj || obj.type !== "text") return doc;

  const textId = obj.dataId;

  // Find linked mesh
  let linkedMeshId: string | undefined;
  if (next.meshes) {
    for (const [meshId, mesh] of Object.entries(next.meshes)) {
      if (mesh.source?.kind === "text" && mesh.source.params.textId === textId) {
        linkedMeshId = meshId;
        // Bake mesh by removing source
        delete next.meshes[meshId].source;
        break;
      }
    }
  }

  if (linkedMeshId) {
    obj.type = "mesh";
    obj.dataId = linkedMeshId;
  }

  return next;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Registers 3D text commands on the command bus.
 */
export function register3dTextCommands(): () => void {
  const category = "3D";
  const unregisters: (() => void)[] = [];

  unregisters.push(
    defineTypedCommand({
      id: "3d.add.text",
      title: "Add 3D Text",
      category,
      args: AddTextArgsSchema,
      run: (args) => {
        const doc = getDocument();
        const res = addTextObject(doc, args);
        documentCommands.mutate("Add 3D Text", (draft) => {
          draft.scenes = res.doc.scenes;
          draft.objects = res.doc.objects;
          draft.meshes = res.doc.meshes;
          draft.materials = res.doc.materials;
          draft.texts = res.doc.texts;
        });
        return { ok: true, objectId: res.objectId, textId: res.textId };
      },
    })
  );

  unregisters.push(
    defineTypedCommand({
      id: "3d.text.set",
      title: "Set 3D Text Properties",
      category,
      args: TextSetArgsSchema,
      run: (args) => {
        const doc = getDocument();
        const next = setTextParams(doc, args);
        documentCommands.mutate("Set 3D Text Properties", (draft) => {
          draft.texts = next.texts;
          draft.meshes = next.meshes;
        });
        return { ok: true };
      },
    })
  );

  unregisters.push(
    defineTypedCommand({
      id: "3d.text.convert_to_mesh",
      title: "Convert 3D Text to Mesh",
      category,
      args: TextConvertToMeshArgsSchema,
      run: (args) => {
        const doc = getDocument();
        const next = convertTextToMesh(doc, args.objectId);
        documentCommands.mutate("Convert 3D Text to Mesh", (draft) => {
          draft.objects = next.objects;
          draft.meshes = next.meshes;
        });
        return { ok: true };
      },
    })
  );

  return () => {
    unregisters.forEach((off) => off());
  };
}
