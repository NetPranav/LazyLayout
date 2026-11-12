/**
 * ============================================================================
 * 3D COMMAND OPERATIONS (Phase 3D-011)
 * ============================================================================
 * Pure immutable document operations for all canonical 3D commands from B2-ids.md:
 *   - Adding (12): cube, sphere, cylinder, cone, plane, torus, icosphere, light.point,
 *                  light.sun, light.spot, camera, empty.
 *   - Object (13): delete, duplicate, rename, parent, unparent, hide, unhide_all,
 *                  apply_transform, set_origin, set_location, set_rotation, set_scale, join.
 *   - Materials (4): add, assign, make_single_user, set.
 *
 * Each operation: (doc: MotionDocument, args: unknown) => OpResult
 * ============================================================================
 */

import { z } from "zod";
import { createId } from "../../ids";
import type {
  Camera3d,
  Light3d,
  Material3d,
  Mesh3d,
  MotionDocument,
  Object3d,
  Scene3d,
  World3d,
} from "../../document/schema";
import {
  cube,
  uvSphere,
  cylinder,
  cone,
  plane,
  torus,
  icosphere,
} from "./primitives";
import {
  applyTransform,
  setOriginToGeometry,
  setOriginToPoint,
  setOriginToCenterOfMass,
} from "../apply";
import { setParent, clearParent, worldMatrix } from "../hierarchy";
import { quatFromEuler, invert, transformPoint, transformDirection } from "../math";
import { makeSingleUser, removeUnused } from "../../document/dataBlocks";

export interface OpResult {
  doc: MotionDocument;
  selection?: string[];
  created?: string[];
}

export type OpHandler<T = unknown> = (doc: MotionDocument, args: T) => OpResult;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cloneDocument(doc: MotionDocument): MotionDocument {
  return {
    ...doc,
    scenes: doc.scenes ? { ...doc.scenes } : {},
    objects: doc.objects ? { ...doc.objects } : {},
    meshes: doc.meshes ? { ...doc.meshes } : {},
    materials: doc.materials ? { ...doc.materials } : {},
    lights: doc.lights ? { ...doc.lights } : {},
    cameras: doc.cameras ? { ...doc.cameras } : {},
    armatures: doc.armatures ? { ...doc.armatures } : {},
    actions: doc.actions ? { ...doc.actions } : {},
    worlds: doc.worlds ? { ...doc.worlds } : {},
    images3d: doc.images3d ? { ...doc.images3d } : {},
  };
}

function resolveTargetScene(
  doc: MotionDocument,
  sceneId?: string
): { doc: MotionDocument; scene: Scene3d } {
  const next = cloneDocument(doc);
  const scenes = next.scenes!;

  let targetId = sceneId;
  if (!targetId || !scenes[targetId]) {
    const existingIds = Object.keys(scenes);
    if (existingIds.length > 0) {
      targetId = existingIds[0];
    } else {
      targetId = createId("scn");
      scenes[targetId] = {
        id: targetId,
        name: "Scene",
        objects: [],
      };
    }
  }

  const scene = { ...scenes[targetId], objects: [...scenes[targetId].objects] };
  scenes[targetId] = scene;
  return { doc: next, scene };
}

function resolveQuat(
  rotation?: [number, number, number],
  rotationQuat?: [number, number, number, number],
  eulerOrder: "XYZ" | "XZY" | "YXZ" | "YZX" | "ZXY" | "ZYX" = "XYZ"
): [number, number, number, number] {
  if (rotationQuat) return rotationQuat;
  if (rotation) {
    const q = quatFromEuler(eulerOrder, rotation[0], rotation[1], rotation[2]);
    return [q[0], q[1], q[2], q[3]];
  }
  return [0, 0, 0, 1];
}

// ---------------------------------------------------------------------------
// 1. ADDING SCHEMAS & HANDLERS
// ---------------------------------------------------------------------------

const TransformArgs = {
  location: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).optional(),
  rotationQuat: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  scale: z.tuple([z.number(), z.number(), z.number()]).default([1, 1, 1]),
  sceneId: z.string().optional(),
};

export const AddCubeSchema = z.object({
  size: z.number().positive().default(1),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  depth: z.number().positive().optional(),
  name: z.string().min(1).default("Cube"),
  ...TransformArgs,
});

export const AddSphereSchema = z.object({
  radius: z.number().positive().default(1),
  segments: z.number().int().min(3).max(512).default(32),
  rings: z.number().int().min(2).max(512).default(16),
  name: z.string().min(1).default("Sphere"),
  ...TransformArgs,
});

export const AddCylinderSchema = z.object({
  vertices: z.number().int().min(3).max(256).default(32),
  radius: z.number().positive().default(1),
  depth: z.number().positive().default(2),
  radiusTop: z.number().positive().optional(),
  radiusBottom: z.number().positive().optional(),
  name: z.string().min(1).default("Cylinder"),
  ...TransformArgs,
});

export const AddConeSchema = z.object({
  vertices: z.number().int().min(3).max(256).default(32),
  radius: z.number().positive().default(1),
  depth: z.number().positive().default(2),
  name: z.string().min(1).default("Cone"),
  ...TransformArgs,
});

export const AddPlaneSchema = z.object({
  size: z.number().positive().default(2),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  name: z.string().min(1).default("Plane"),
  ...TransformArgs,
});

export const AddTorusSchema = z.object({
  radius: z.number().positive().default(1),
  tube: z.number().positive().default(0.25),
  radialSegments: z.number().int().min(3).max(256).default(16),
  tubularSegments: z.number().int().min(3).max(256).default(32),
  name: z.string().min(1).default("Torus"),
  ...TransformArgs,
});

export const AddIcosphereSchema = z.object({
  radius: z.number().positive().default(1),
  subdivisions: z.number().int().min(0).max(8).default(2),
  name: z.string().min(1).default("Icosphere"),
  ...TransformArgs,
});

export const AddLightPointSchema = z.object({
  color: z.string().default("#ffffff"),
  intensity: z.number().nonnegative().default(100),
  distance: z.number().nonnegative().optional(),
  decay: z.number().nonnegative().default(2),
  castShadow: z.boolean().default(true),
  name: z.string().min(1).default("Point Light"),
  ...TransformArgs,
});

export const AddLightSunSchema = z.object({
  color: z.string().default("#ffffff"),
  intensity: z.number().nonnegative().default(1),
  castShadow: z.boolean().default(true),
  name: z.string().min(1).default("Sun Light"),
  ...TransformArgs,
});

export const AddLightSpotSchema = z.object({
  color: z.string().default("#ffffff"),
  intensity: z.number().nonnegative().default(100),
  distance: z.number().nonnegative().optional(),
  spotAngle: z.number().positive().default(Math.PI / 4),
  spotBlend: z.number().min(0).max(1).default(0.15),
  castShadow: z.boolean().default(true),
  name: z.string().min(1).default("Spot Light"),
  ...TransformArgs,
});

export const AddCameraSchema = z.object({
  fov: z.number().positive().default(50),
  type: z.enum(["perspective", "orthographic"]).default("perspective"),
  near: z.number().positive().default(0.1),
  far: z.number().positive().default(1000),
  name: z.string().min(1).default("Camera"),
  ...TransformArgs,
});

export const AddEmptySchema = z.object({
  name: z.string().min(1).default("Empty"),
  ...TransformArgs,
});

function addMeshObject(
  doc: MotionDocument,
  name: string,
  prim: { positions: Float32Array; indices: Uint32Array },
  args: z.infer<typeof AddCubeSchema>
): OpResult {
  const { doc: next, scene } = resolveTargetScene(doc, args.sceneId);
  const meshId = createId("msh");
  const objId = createId("obj");

  const mesh: Mesh3d = {
    id: meshId,
    name: `${name}Mesh`,
    positions: Array.from(prim.positions),
    indices: Array.from(prim.indices),
  };

  const obj: Object3d = {
    id: objId,
    name,
    type: "mesh",
    dataId: meshId,
    transform: {
      location: args.location,
      rotationQuat: resolveQuat(args.rotation, args.rotationQuat),
      scale: args.scale,
    },
    visible: true,
  };

  next.meshes![meshId] = mesh;
  next.objects![objId] = obj;
  scene.objects.push(objId);

  return { doc: next, selection: [objId], created: [objId] };
}

// ---------------------------------------------------------------------------
// 2. OBJECT SCHEMAS & HANDLERS
// ---------------------------------------------------------------------------

export const ObjectDeleteSchema = z.object({
  objectId: z.string().optional(),
  objectIds: z.array(z.string()).optional(),
  purgeUnused: z.boolean().default(true),
});

export const ObjectDuplicateSchema = z.object({
  objectId: z.string().optional(),
  objectIds: z.array(z.string()).optional(),
  delta: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  linked: z.boolean().default(false),
});

export const ObjectRenameSchema = z.object({
  objectId: z.string(),
  name: z.string().min(1).max(120),
});

export const ObjectParentSchema = z.object({
  childId: z.string(),
  parentId: z.string(),
  keepWorldTransform: z.boolean().default(true),
});

export const ObjectUnparentSchema = z.object({
  objectId: z.string(),
  keepWorldTransform: z.boolean().default(true),
});

export const ObjectHideSchema = z.object({
  objectId: z.string().optional(),
  objectIds: z.array(z.string()).optional(),
  hide: z.boolean().default(true),
});

export const ObjectUnhideAllSchema = z.object({
  sceneId: z.string().optional(),
}).default({});

export const ObjectApplyTransformSchema = z.object({
  objectId: z.string(),
  location: z.boolean().default(false),
  rotation: z.boolean().default(false),
  scale: z.boolean().default(false),
});

export const ObjectSetOriginSchema = z.object({
  objectId: z.string(),
  type: z.enum(["geometry", "center_of_mass", "point"]).default("geometry"),
  point: z.tuple([z.number(), z.number(), z.number()]).optional(),
  space: z.enum(["world", "local"]).default("world"),
});

export const ObjectSetLocationSchema = z.object({
  objectId: z.string(),
  location: z.tuple([z.number(), z.number(), z.number()]),
  relative: z.boolean().default(false),
});

export const ObjectSetRotationSchema = z.object({
  objectId: z.string(),
  rotation: z.tuple([z.number(), z.number(), z.number()]).optional(),
  rotationQuat: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  eulerOrder: z.enum(["XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX"]).default("XYZ"),
});

export const ObjectSetScaleSchema = z.object({
  objectId: z.string(),
  scale: z.union([
    z.tuple([z.number(), z.number(), z.number()]),
    z.number(),
  ]),
});

export const ObjectJoinSchema = z.object({
  objectIds: z.array(z.string()).min(2),
  targetId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// 3. MATERIALS SCHEMAS & HANDLERS
// ---------------------------------------------------------------------------

export const MaterialAddSchema = z.object({
  name: z.string().default("Material"),
  baseColor: z.string().default("#ffffff"),
  metallic: z.number().min(0).max(1).default(0),
  roughness: z.number().min(0).max(1).default(0.5),
  emissive: z.string().default("#000000"),
  emissiveIntensity: z.number().nonnegative().optional(),
  opacity: z.number().min(0).max(1).optional(),
  wireframe: z.boolean().optional(),
  doubleSided: z.boolean().optional(),
  objectId: z.string().optional(),
  slot: z.number().int().nonnegative().optional(),
});

export const MaterialAssignSchema = z.object({
  objectId: z.string(),
  materialId: z.string(),
  slot: z.number().int().nonnegative().default(0),
});

export const MaterialMakeSingleUserSchema = z.object({
  objectId: z.string(),
  slot: z.number().int().nonnegative().default(0),
});

export const MaterialSetSchema = z.object({
  materialId: z.string(),
  name: z.string().optional(),
  baseColor: z.string().optional(),
  metallic: z.number().min(0).max(1).optional(),
  roughness: z.number().min(0).max(1).optional(),
  emissive: z.string().optional(),
  emissiveIntensity: z.number().nonnegative().optional(),
  opacity: z.number().min(0).max(1).optional(),
  wireframe: z.boolean().optional(),
  doubleSided: z.boolean().optional(),
});

export const LightSetSchema = z.object({
  lightId: z.string(),
  name: z.string().optional(),
  type: z.enum(["point", "sun", "spot", "area", "directional"]).optional(),
  color: z.string().optional(),
  intensity: z.number().nonnegative().optional(),
  distance: z.number().nonnegative().optional(),
  decay: z.number().nonnegative().optional(),
  castShadow: z.boolean().optional(),
  spotAngle: z.number().optional(),
  spotBlend: z.number().optional(),
});

export const CameraSetSchema = z.object({
  cameraId: z.string(),
  name: z.string().optional(),
  type: z.enum(["perspective", "orthographic"]).optional(),
  fov: z.number().positive().optional(),
  near: z.number().positive().optional(),
  far: z.number().positive().optional(),
  orthoScale: z.number().positive().optional(),
});

export const WorldSetSchema = z.object({
  worldId: z.string(),
  name: z.string().optional(),
  color: z.string().optional(),
  ambientColor: z.string().optional(),
  ambientIntensity: z.number().nonnegative().optional(),
  environmentIntensity: z.number().nonnegative().optional(),
  environmentRotation: z.number().optional(),
});

export const ObjectSetVisibilitySchema = z.object({
  objectId: z.string(),
  visible: z.boolean().optional(),
  renderVisible: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Operation Map & Registry
// ---------------------------------------------------------------------------

export const COMMAND_SCHEMAS: Record<string, z.ZodTypeAny> = {
  // Adding (12)
  "3d.add.cube": AddCubeSchema,
  "3d.add.sphere": AddSphereSchema,
  "3d.add.cylinder": AddCylinderSchema,
  "3d.add.cone": AddConeSchema,
  "3d.add.plane": AddPlaneSchema,
  "3d.add.torus": AddTorusSchema,
  "3d.add.icosphere": AddIcosphereSchema,
  "3d.add.light.point": AddLightPointSchema,
  "3d.add.light.sun": AddLightSunSchema,
  "3d.add.light.spot": AddLightSpotSchema,
  "3d.add.camera": AddCameraSchema,
  "3d.add.empty": AddEmptySchema,

  // Object (13)
  "3d.object.delete": ObjectDeleteSchema,
  "3d.object.duplicate": ObjectDuplicateSchema,
  "3d.object.rename": ObjectRenameSchema,
  "3d.object.parent": ObjectParentSchema,
  "3d.object.unparent": ObjectUnparentSchema,
  "3d.object.hide": ObjectHideSchema,
  "3d.object.unhide_all": ObjectUnhideAllSchema,
  "3d.object.apply_transform": ObjectApplyTransformSchema,
  "3d.object.set_origin": ObjectSetOriginSchema,
  "3d.object.set_location": ObjectSetLocationSchema,
  "3d.object.set_rotation": ObjectSetRotationSchema,
  "3d.object.set_scale": ObjectSetScaleSchema,
  "3d.object.join": ObjectJoinSchema,

  // Materials (4)
  "3d.material.add": MaterialAddSchema,
  "3d.material.assign": MaterialAssignSchema,
  "3d.material.make_single_user": MaterialMakeSingleUserSchema,
  "3d.material.set": MaterialSetSchema,

  // Properties 3D Updates
  "3d.light.set": LightSetSchema,
  "3d.camera.set": CameraSetSchema,
  "3d.world.set": WorldSetSchema,
  "3d.object.set_visibility": ObjectSetVisibilitySchema,
};

export const COMMAND_TITLES: Record<string, string> = {
  "3d.add.cube": "Add Cube",
  "3d.add.sphere": "Add UV Sphere",
  "3d.add.cylinder": "Add Cylinder",
  "3d.add.cone": "Add Cone",
  "3d.add.plane": "Add Plane",
  "3d.add.torus": "Add Torus",
  "3d.add.icosphere": "Add Icosphere",
  "3d.add.light.point": "Add Point Light",
  "3d.add.light.sun": "Add Sun Light",
  "3d.add.light.spot": "Add Spot Light",
  "3d.add.camera": "Add Camera",
  "3d.add.empty": "Add Empty",

  "3d.object.delete": "Delete 3D Object",
  "3d.object.duplicate": "Duplicate 3D Object",
  "3d.object.rename": "Rename 3D Object",
  "3d.object.parent": "Parent 3D Object",
  "3d.object.unparent": "Clear 3D Parent",
  "3d.object.hide": "Hide 3D Object",
  "3d.object.unhide_all": "Unhide All 3D Objects",
  "3d.object.apply_transform": "Apply 3D Transform",
  "3d.object.set_origin": "Set 3D Origin",
  "3d.object.set_location": "Set 3D Location",
  "3d.object.set_rotation": "Set 3D Rotation",
  "3d.object.set_scale": "Set 3D Scale",
  "3d.object.join": "Join 3D Objects",

  "3d.material.add": "Add 3D Material",
  "3d.material.assign": "Assign 3D Material",
  "3d.material.make_single_user": "Make 3D Material Single User",
  "3d.material.set": "Set 3D Material",

  "3d.light.set": "Set 3D Light",
  "3d.camera.set": "Set 3D Camera",
  "3d.world.set": "Set 3D World",
  "3d.object.set_visibility": "Set 3D Visibility",
};

// ---------------------------------------------------------------------------
// Execution Dispatcher
// ---------------------------------------------------------------------------

const EDITS_IN_PLACE = new Set([
  "3d.object.duplicate",
  "3d.object.parent",
  "3d.object.apply_transform",
  "3d.object.set_origin",
  "3d.object.join",
  "3d.object.delete",
]);

export function run3dOp(id: string, doc: MotionDocument, rawArgs: unknown): OpResult {
  const schema = COMMAND_SCHEMAS[id];
  if (!schema) {
    throw new Error(`Unknown 3D command id "${id}".`);
  }
  const parsed = schema.parse(rawArgs ?? {});

  // these edit the document they are given in place (hierarchy, apply and join helpers): give them a copy, so the caller's
  // document, and with it undo, stays exactly as it was
  if (EDITS_IN_PLACE.has(id)) doc = structuredClone(doc);

  switch (id) {
    // -------------------------------------------------------------------------
    // Adding
    // -------------------------------------------------------------------------
    case "3d.add.cube": {
      const args = parsed as z.infer<typeof AddCubeSchema>;
      const prim = cube({
        size: args.size,
        width: args.width,
        height: args.height,
        depth: args.depth,
      });
      return addMeshObject(doc, args.name, prim, args);
    }

    case "3d.add.sphere": {
      const args = parsed as z.infer<typeof AddSphereSchema>;
      const prim = uvSphere(args.segments, args.rings, args.radius);
      return addMeshObject(doc, args.name, prim, args as unknown as z.infer<typeof AddCubeSchema>);
    }

    case "3d.add.cylinder": {
      const args = parsed as z.infer<typeof AddCylinderSchema>;
      const prim = cylinder({
        vertices: args.vertices,
        depth: args.depth,
        radius: args.radius,
        radiusTop: args.radiusTop,
        radiusBottom: args.radiusBottom,
      });
      return addMeshObject(doc, args.name, prim, args as unknown as z.infer<typeof AddCubeSchema>);
    }

    case "3d.add.cone": {
      const args = parsed as z.infer<typeof AddConeSchema>;
      const prim = cone({
        vertices: args.vertices,
        depth: args.depth,
        radius: args.radius,
      });
      return addMeshObject(doc, args.name, prim, args as unknown as z.infer<typeof AddCubeSchema>);
    }

    case "3d.add.plane": {
      const args = parsed as z.infer<typeof AddPlaneSchema>;
      const prim = plane({
        size: args.size,
        width: args.width,
        height: args.height,
      });
      return addMeshObject(doc, args.name, prim, args as unknown as z.infer<typeof AddCubeSchema>);
    }

    case "3d.add.torus": {
      const args = parsed as z.infer<typeof AddTorusSchema>;
      const prim = torus({
        radius: args.radius,
        tube: args.tube,
        radialSegments: args.radialSegments,
        tubularSegments: args.tubularSegments,
      });
      return addMeshObject(doc, args.name, prim, args as unknown as z.infer<typeof AddCubeSchema>);
    }

    case "3d.add.icosphere": {
      const args = parsed as z.infer<typeof AddIcosphereSchema>;
      const prim = icosphere({
        subdivisions: args.subdivisions,
        radius: args.radius,
      });
      return addMeshObject(doc, args.name, prim, args as unknown as z.infer<typeof AddCubeSchema>);
    }

    case "3d.add.light.point": {
      const args = parsed as z.infer<typeof AddLightPointSchema>;
      const { doc: next, scene } = resolveTargetScene(doc, args.sceneId);
      const lightId = createId("lit");
      const objId = createId("obj");

      const light: Light3d = {
        id: lightId,
        name: args.name,
        type: "point",
        color: args.color,
        intensity: args.intensity,
        distance: args.distance,
        decay: args.decay,
        castShadow: args.castShadow,
      };

      const obj: Object3d = {
        id: objId,
        name: args.name,
        type: "light",
        dataId: lightId,
        transform: {
          location: args.location,
          rotationQuat: resolveQuat(args.rotation, args.rotationQuat),
          scale: args.scale,
        },
        visible: true,
      };

      next.lights![lightId] = light;
      next.objects![objId] = obj;
      scene.objects.push(objId);
      return { doc: next, selection: [objId], created: [objId] };
    }

    case "3d.add.light.sun": {
      const args = parsed as z.infer<typeof AddLightSunSchema>;
      const { doc: next, scene } = resolveTargetScene(doc, args.sceneId);
      const lightId = createId("lit");
      const objId = createId("obj");

      const light: Light3d = {
        id: lightId,
        name: args.name,
        type: "sun",
        color: args.color,
        intensity: args.intensity,
        castShadow: args.castShadow,
      };

      const obj: Object3d = {
        id: objId,
        name: args.name,
        type: "light",
        dataId: lightId,
        transform: {
          location: args.location,
          rotationQuat: resolveQuat(args.rotation, args.rotationQuat),
          scale: args.scale,
        },
        visible: true,
      };

      next.lights![lightId] = light;
      next.objects![objId] = obj;
      scene.objects.push(objId);
      return { doc: next, selection: [objId], created: [objId] };
    }

    case "3d.add.light.spot": {
      const args = parsed as z.infer<typeof AddLightSpotSchema>;
      const { doc: next, scene } = resolveTargetScene(doc, args.sceneId);
      const lightId = createId("lit");
      const objId = createId("obj");

      const light: Light3d = {
        id: lightId,
        name: args.name,
        type: "spot",
        color: args.color,
        intensity: args.intensity,
        distance: args.distance,
        spotAngle: args.spotAngle,
        spotBlend: args.spotBlend,
        castShadow: args.castShadow,
      };

      const obj: Object3d = {
        id: objId,
        name: args.name,
        type: "light",
        dataId: lightId,
        transform: {
          location: args.location,
          rotationQuat: resolveQuat(args.rotation, args.rotationQuat),
          scale: args.scale,
        },
        visible: true,
      };

      next.lights![lightId] = light;
      next.objects![objId] = obj;
      scene.objects.push(objId);
      return { doc: next, selection: [objId], created: [objId] };
    }

    case "3d.add.camera": {
      const args = parsed as z.infer<typeof AddCameraSchema>;
      const { doc: next, scene } = resolveTargetScene(doc, args.sceneId);
      const camId = createId("cam");
      const objId = createId("obj");

      const cam: Camera3d = {
        id: camId,
        name: args.name,
        type: args.type,
        fov: args.fov,
        near: args.near,
        far: args.far,
      };

      const obj: Object3d = {
        id: objId,
        name: args.name,
        type: "camera",
        dataId: camId,
        transform: {
          location: args.location,
          rotationQuat: resolveQuat(args.rotation, args.rotationQuat),
          scale: args.scale,
        },
        visible: true,
      };

      next.cameras![camId] = cam;
      next.objects![objId] = obj;
      scene.objects.push(objId);
      return { doc: next, selection: [objId], created: [objId] };
    }

    case "3d.add.empty": {
      const args = parsed as z.infer<typeof AddEmptySchema>;
      const { doc: next, scene } = resolveTargetScene(doc, args.sceneId);
      const objId = createId("obj");

      const obj: Object3d = {
        id: objId,
        name: args.name,
        type: "empty",
        dataId: null,
        transform: {
          location: args.location,
          rotationQuat: resolveQuat(args.rotation, args.rotationQuat),
          scale: args.scale,
        },
        visible: true,
      };

      next.objects![objId] = obj;
      scene.objects.push(objId);
      return { doc: next, selection: [objId], created: [objId] };
    }

    // -------------------------------------------------------------------------
    // Object
    // -------------------------------------------------------------------------
    case "3d.object.delete": {
      const args = parsed as z.infer<typeof ObjectDeleteSchema>;
      const targets = new Set<string>();
      if (args.objectId) targets.add(args.objectId);
      if (args.objectIds) args.objectIds.forEach((id) => targets.add(id));
      if (targets.size === 0) return { doc };

      const next = cloneDocument(doc);
      // Remove from scenes
      for (const scene of Object.values(next.scenes ?? {})) {
        scene.objects = scene.objects.filter((id) => !targets.has(id));
      }

      // Unparent any children
      for (const obj of Object.values(next.objects ?? {})) {
        if (obj.parentId && targets.has(obj.parentId)) {
          obj.parentId = null;
        }
      }

      // Delete objects
      for (const id of targets) {
        delete next.objects![id];
      }

      const finalDoc = args.purgeUnused ? removeUnused(next) : next;
      return { doc: finalDoc, selection: [] };
    }

    case "3d.object.duplicate": {
      const args = parsed as z.infer<typeof ObjectDuplicateSchema>;
      const sourceIds = [
        ...(args.objectId ? [args.objectId] : []),
        ...(args.objectIds ?? []),
      ];
      if (sourceIds.length === 0) return { doc };

      const next = cloneDocument(doc);
      const newIds: string[] = [];

      for (const id of sourceIds) {
        const sourceObj = doc.objects?.[id];
        if (!sourceObj) continue;

        const newObjId = createId("obj");
        let dataId = sourceObj.dataId;

        // If mesh and not linked, duplicate the mesh data block
        if (sourceObj.type === "mesh" && dataId && !args.linked && doc.meshes?.[dataId]) {
          const newMeshId = createId("msh");
          const sourceMesh = doc.meshes[dataId];
          next.meshes![newMeshId] = {
            ...structuredClone(sourceMesh),
            id: newMeshId,
            name: sourceMesh.name ? `${sourceMesh.name}.001` : "Mesh.001",
          };
          dataId = newMeshId;
        }

        const newObj: Object3d = {
          ...structuredClone(sourceObj),
          id: newObjId,
          name: sourceObj.name ? `${sourceObj.name}.001` : "Object.001",
          dataId,
          transform: {
            location: [
              sourceObj.transform.location[0] + args.delta[0],
              sourceObj.transform.location[1] + args.delta[1],
              sourceObj.transform.location[2] + args.delta[2],
            ],
            rotationQuat: [...sourceObj.transform.rotationQuat],
            scale: [...sourceObj.transform.scale],
          },
        };

        next.objects![newObjId] = newObj;
        newIds.push(newObjId);

        // Add to scenes containing source object
        let addedToScene = false;
        for (const scene of Object.values(next.scenes ?? {})) {
          if (scene.objects.includes(id)) {
            scene.objects.push(newObjId);
            addedToScene = true;
          }
        }
        if (!addedToScene) {
          const { scene } = resolveTargetScene(next);
          scene.objects.push(newObjId);
        }
      }

      return { doc: next, selection: newIds, created: newIds };
    }

    case "3d.object.rename": {
      const args = parsed as z.infer<typeof ObjectRenameSchema>;
      const obj = doc.objects?.[args.objectId];
      if (!obj) return { doc };

      const next = cloneDocument(doc);
      next.objects![args.objectId] = { ...obj, name: args.name };
      return { doc: next, selection: [args.objectId] };
    }

    case "3d.object.parent": {
      const args = parsed as z.infer<typeof ObjectParentSchema>;
      const next = setParent(doc, args.childId, args.parentId, {
        keepWorld: args.keepWorldTransform,
      });
      return { doc: next, selection: [args.childId] };
    }

    case "3d.object.unparent": {
      const args = parsed as z.infer<typeof ObjectUnparentSchema>;
      const next = clearParent(doc, args.objectId, {
        keepWorld: args.keepWorldTransform,
      });
      return { doc: next, selection: [args.objectId] };
    }

    case "3d.object.hide": {
      const args = parsed as z.infer<typeof ObjectHideSchema>;
      const targets = [
        ...(args.objectId ? [args.objectId] : []),
        ...(args.objectIds ?? []),
      ];
      if (targets.length === 0) return { doc };

      const next = cloneDocument(doc);
      for (const id of targets) {
        const obj = next.objects![id];
        if (obj) {
          next.objects![id] = { ...obj, visible: !args.hide };
        }
      }
      return { doc: next };
    }

    case "3d.object.unhide_all": {
      const next = cloneDocument(doc);
      for (const [id, obj] of Object.entries(next.objects ?? {})) {
        if (!obj.visible) {
          next.objects![id] = { ...obj, visible: true };
        }
      }
      return { doc: next };
    }

    case "3d.object.apply_transform": {
      const args = parsed as z.infer<typeof ObjectApplyTransformSchema>;
      const next = applyTransform(doc, args.objectId, {
        location: args.location,
        rotation: args.rotation,
        scale: args.scale,
      });
      return { doc: next, selection: [args.objectId] };
    }

    case "3d.object.set_origin": {
      const args = parsed as z.infer<typeof ObjectSetOriginSchema>;
      let next: MotionDocument;
      if (args.type === "geometry") {
        next = setOriginToGeometry(doc, args.objectId);
      } else if (args.type === "center_of_mass") {
        next = setOriginToCenterOfMass(doc, args.objectId);
      } else {
        next = setOriginToPoint(doc, args.objectId, args.point ?? [0, 0, 0], {
          space: args.space,
        });
      }
      return { doc: next, selection: [args.objectId] };
    }

    case "3d.object.set_location": {
      const args = parsed as z.infer<typeof ObjectSetLocationSchema>;
      const obj = doc.objects?.[args.objectId];
      if (!obj) return { doc };

      const next = cloneDocument(doc);
      const loc: [number, number, number] = args.relative
        ? [
            obj.transform.location[0] + args.location[0],
            obj.transform.location[1] + args.location[1],
            obj.transform.location[2] + args.location[2],
          ]
        : [args.location[0], args.location[1], args.location[2]];

      next.objects![args.objectId] = {
        ...obj,
        transform: {
          ...obj.transform,
          location: loc,
        },
      };
      return { doc: next, selection: [args.objectId] };
    }

    case "3d.object.set_rotation": {
      const args = parsed as z.infer<typeof ObjectSetRotationSchema>;
      const obj = doc.objects?.[args.objectId];
      if (!obj) return { doc };

      const next = cloneDocument(doc);
      const quat = resolveQuat(args.rotation, args.rotationQuat, args.eulerOrder);
      next.objects![args.objectId] = {
        ...obj,
        transform: {
          ...obj.transform,
          rotationQuat: quat,
        },
      };
      return { doc: next, selection: [args.objectId] };
    }

    case "3d.object.set_scale": {
      const args = parsed as z.infer<typeof ObjectSetScaleSchema>;
      const obj = doc.objects?.[args.objectId];
      if (!obj) return { doc };

      const next = cloneDocument(doc);
      const scl: [number, number, number] =
        typeof args.scale === "number"
          ? [args.scale, args.scale, args.scale]
          : [args.scale[0], args.scale[1], args.scale[2]];

      next.objects![args.objectId] = {
        ...obj,
        transform: {
          ...obj.transform,
          scale: scl,
        },
      };
      return { doc: next, selection: [args.objectId] };
    }

    case "3d.object.join": {
      const args = parsed as z.infer<typeof ObjectJoinSchema>;
      const primaryId = args.targetId ?? args.objectIds[0];
      const primaryObj = doc.objects?.[primaryId];
      if (!primaryObj || primaryObj.type !== "mesh") return { doc };

      const next = cloneDocument(doc);
      const primaryWorld = worldMatrix(doc, primaryId);
      const primaryWorldInv = invert(primaryWorld);

      const mergedPositions: number[] = [];
      const mergedIndices: number[] = [];
      const mergedNormals: number[] = [];
      const mergedUvs: number[] = [];
      const mergedMaterials: string[] = [...(primaryObj.materialSlots ?? primaryObj.materials ?? [])];

      let vertOffset = 0;

      for (const objId of args.objectIds) {
        const obj = doc.objects?.[objId];
        if (!obj || obj.type !== "mesh" || !obj.dataId) continue;
        const mesh = doc.meshes?.[obj.dataId];
        if (!mesh || !mesh.positions || mesh.positions.length === 0) continue;

        // Relative transform to primary object space: mRel = primaryWorldInv * objWorld
        const objWorld = worldMatrix(doc, objId);
        // Multiply:
        const mRel = new Float64Array(16);
        for (let c = 0; c < 4; c++) {
          for (let r = 0; r < 4; r++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) {
              sum += primaryWorldInv[k * 4 + r] * objWorld[c * 4 + k];
            }
            mRel[c * 4 + r] = sum;
          }
        }


        // Transform positions
        const count = Math.floor(mesh.positions.length / 3);
        for (let i = 0; i < count; i++) {
          const px = mesh.positions[i * 3];
          const py = mesh.positions[i * 3 + 1];
          const pz = mesh.positions[i * 3 + 2];
          const tp = transformPoint(mRel, [px, py, pz]);
          mergedPositions.push(tp[0], tp[1], tp[2]);
        }

        // Transform normals if present
        if (mesh.normals && mesh.normals.length === mesh.positions.length) {
          for (let i = 0; i < count; i++) {
            const nx = mesh.normals[i * 3];
            const ny = mesh.normals[i * 3 + 1];
            const nz = mesh.normals[i * 3 + 2];
            const tn = transformDirection(mRel, [nx, ny, nz]);
            const len = Math.hypot(tn[0], tn[1], tn[2]);
            if (len > 0) mergedNormals.push(tn[0] / len, tn[1] / len, tn[2] / len);
            else mergedNormals.push(nx, ny, nz);
          }
        }

        // UVs if present
        if (mesh.uvs) {
          for (let i = 0; i < mesh.uvs.length; i++) {
            mergedUvs.push(mesh.uvs[i]);
          }
        }

        // Indices
        if (mesh.indices) {
          for (let i = 0; i < mesh.indices.length; i++) {
            mergedIndices.push(mesh.indices[i] + vertOffset);
          }
        } else {
          for (let i = 0; i < count; i++) {
            mergedIndices.push(i + vertOffset);
          }
        }

        vertOffset += count;

        // Clean up joined object if it is not the primary
        if (objId !== primaryId) {
          delete next.objects![objId];
          for (const scene of Object.values(next.scenes ?? {})) {
            scene.objects = scene.objects.filter((id) => id !== objId);
          }
        }
      }

      // Update primary mesh
      const newMeshId = createId("msh");
      const combinedMesh: Mesh3d = {
        id: newMeshId,
        name: `${primaryObj.name ?? "Joined"}Mesh`,
        positions: mergedPositions,
        indices: mergedIndices,
        normals: mergedNormals.length > 0 ? mergedNormals : undefined,
        uvs: mergedUvs.length > 0 ? mergedUvs : undefined,
      };

      next.meshes![newMeshId] = combinedMesh;
      next.objects![primaryId] = {
        ...primaryObj,
        dataId: newMeshId,
        materialSlots: mergedMaterials.length > 0 ? mergedMaterials : undefined,
        materials: mergedMaterials.length > 0 ? mergedMaterials : undefined,
      };

      const cleaned = removeUnused(next);
      return { doc: cleaned, selection: [primaryId] };
    }

    // -------------------------------------------------------------------------
    // Materials
    // -------------------------------------------------------------------------
    case "3d.material.add": {
      const args = parsed as z.infer<typeof MaterialAddSchema>;
      const next = cloneDocument(doc);
      const matId = createId("mat");

      const mat: Material3d = {
        id: matId,
        name: args.name,
        baseColor: args.baseColor,
        metallic: args.metallic,
        roughness: args.roughness,
        emissive: args.emissive,
        emissiveIntensity: args.emissiveIntensity,
        opacity: args.opacity,
        wireframe: args.wireframe,
        doubleSided: args.doubleSided,
      };

      next.materials![matId] = mat;

      if (args.objectId && next.objects?.[args.objectId]) {
        const obj = next.objects[args.objectId];
        const slots = [...(obj.materialSlots ?? obj.materials ?? [])];
        if (args.slot !== undefined && args.slot >= 0 && args.slot < slots.length) {
          slots[args.slot] = matId;
        } else {
          slots.push(matId);
        }
        next.objects[args.objectId] = {
          ...obj,
          materialSlots: slots,
          materials: slots,
        };
      }

      return { doc: next, created: [matId], selection: args.objectId ? [args.objectId] : [] };
    }

    case "3d.material.assign": {
      const args = parsed as z.infer<typeof MaterialAssignSchema>;
      const obj = doc.objects?.[args.objectId];
      if (!obj) return { doc };

      const next = cloneDocument(doc);
      const slots = [...(obj.materialSlots ?? obj.materials ?? [])];
      if (args.slot >= 0 && args.slot < slots.length) {
        slots[args.slot] = args.materialId;
      } else {
        slots.push(args.materialId);
      }

      next.objects![args.objectId] = {
        ...obj,
        materialSlots: slots,
        materials: slots,
      };
      return { doc: next, selection: [args.objectId] };
    }

    case "3d.material.make_single_user": {
      const args = parsed as z.infer<typeof MaterialMakeSingleUserSchema>;
      const next = makeSingleUser(doc, args.objectId, args.slot);
      return { doc: next, selection: [args.objectId] };
    }

    case "3d.material.set": {
      const args = parsed as z.infer<typeof MaterialSetSchema>;
      const mat = doc.materials?.[args.materialId];
      if (!mat) return { doc };

      const next = cloneDocument(doc);
      const updated: Material3d = { ...mat };
      if (args.name !== undefined) updated.name = args.name;
      if (args.baseColor !== undefined) updated.baseColor = args.baseColor;
      if (args.metallic !== undefined) updated.metallic = args.metallic;
      if (args.roughness !== undefined) updated.roughness = args.roughness;
      if (args.emissive !== undefined) updated.emissive = args.emissive;
      if (args.emissiveIntensity !== undefined) updated.emissiveIntensity = args.emissiveIntensity;
      if (args.opacity !== undefined) updated.opacity = args.opacity;
      if (args.wireframe !== undefined) updated.wireframe = args.wireframe;
      if (args.doubleSided !== undefined) updated.doubleSided = args.doubleSided;

      next.materials![args.materialId] = updated;
      return { doc: next };
    }

    case "3d.light.set": {
      const args = parsed as z.infer<typeof LightSetSchema>;
      const light = doc.lights?.[args.lightId];
      if (!light) return { doc };

      const next = cloneDocument(doc);
      const updated: Light3d = { ...light };
      if (args.name !== undefined) updated.name = args.name;
      if (args.type !== undefined) updated.type = args.type;
      if (args.color !== undefined) updated.color = args.color;
      if (args.intensity !== undefined) updated.intensity = args.intensity;
      if (args.distance !== undefined) updated.distance = args.distance;
      if (args.decay !== undefined) updated.decay = args.decay;
      if (args.castShadow !== undefined) updated.castShadow = args.castShadow;
      if (args.spotAngle !== undefined) updated.spotAngle = args.spotAngle;
      if (args.spotBlend !== undefined) updated.spotBlend = args.spotBlend;

      next.lights![args.lightId] = updated;
      return { doc: next };
    }

    case "3d.camera.set": {
      const args = parsed as z.infer<typeof CameraSetSchema>;
      const cam = doc.cameras?.[args.cameraId];
      if (!cam) return { doc };

      const next = cloneDocument(doc);
      const updated: Camera3d = { ...cam };
      if (args.name !== undefined) updated.name = args.name;
      if (args.type !== undefined) updated.type = args.type;
      if (args.fov !== undefined) updated.fov = args.fov;
      if (args.near !== undefined) updated.near = args.near;
      if (args.far !== undefined) updated.far = args.far;
      if (args.orthoScale !== undefined) updated.orthoScale = args.orthoScale;

      next.cameras![args.cameraId] = updated;
      return { doc: next };
    }

    case "3d.world.set": {
      const args = parsed as z.infer<typeof WorldSetSchema>;
      const world = doc.worlds?.[args.worldId];
      if (!world) return { doc };

      const next = cloneDocument(doc);
      const updated: World3d = { ...world };
      if (args.name !== undefined) updated.name = args.name;
      if (args.color !== undefined) updated.color = args.color;
      if (args.ambientColor !== undefined) updated.ambientColor = args.ambientColor;
      if (args.ambientIntensity !== undefined) updated.ambientIntensity = args.ambientIntensity;
      if (args.environmentIntensity !== undefined) updated.environmentIntensity = args.environmentIntensity;
      if (args.environmentRotation !== undefined) updated.environmentRotation = args.environmentRotation;

      next.worlds![args.worldId] = updated;
      return { doc: next };
    }

    case "3d.object.set_visibility": {
      const args = parsed as z.infer<typeof ObjectSetVisibilitySchema>;
      const obj = doc.objects?.[args.objectId];
      if (!obj) return { doc };

      const next = cloneDocument(doc);
      const updated: Object3d = { ...obj };
      if (args.visible !== undefined) updated.visible = args.visible;
      if (args.renderVisible !== undefined) updated.renderVisible = args.renderVisible;

      next.objects![args.objectId] = updated;
      return { doc: next, selection: [args.objectId] };
    }

    default:
      throw new Error(`Unhandled 3D operation "${id}".`);
  }
}
