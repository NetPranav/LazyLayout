/**
 * ============================================================================
 * 3D DATA BLOCKS & SCHEMA (MDM v7, ROADMAP_3D Phase 3D-007)
 * ============================================================================
 * Data blocks shared by ID, following Blender's document model:
 *   - Scene: objects, world, activeCamera, settings
 *   - Object: type, transform, parentId, dataId, material slots, visible
 *   - Mesh: vertices/faces inline OR binary pointer
 *   - Material: plain PBR record (baseColor, metallic, roughness, emissive)
 *   - Light: type, color, intensity, shadows
 *   - Camera: type/projection, fov, near, far
 *   - Armature: bones list
 *   - Action: fcurves list (dataPath, keyframes)
 *   - World: environment / ambient settings
 *   - Image3d: pointer to asset-store ID (SHA-256)
 *
 * All schemas reject unknown extra keys (.strict()) as in existing MDM schemas.
 * ============================================================================
 */

import { z } from "zod";

export const IdSchema = z.string().min(1).describe("Stable entity id, `<prefix>_<8hex>` for new entities.");

// ---------------------------------------------------------------------------
// Math Primitives
// ---------------------------------------------------------------------------

export const Vector3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vector3 = z.infer<typeof Vector3Schema>;

export const QuaternionSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type Quaternion = z.infer<typeof QuaternionSchema>;

export const Transform3dSchema = z
  .object({
    location: Vector3Schema,
    rotationQuat: QuaternionSchema,
    scale: Vector3Schema,
  })
  .strict();
export type Transform3d = z.infer<typeof Transform3dSchema>;

export const DeltaTransform3dSchema = z
  .object({
    location: Vector3Schema.optional(),
    rotationQuat: QuaternionSchema.optional(),
    scale: Vector3Schema.optional(),
  })
  .strict();
export type DeltaTransform3d = z.infer<typeof DeltaTransform3dSchema>;

export const Mat4ArraySchema = z.array(z.number()).length(16);
export type Mat4Array = z.infer<typeof Mat4ArraySchema>;

// ---------------------------------------------------------------------------
// 1. Scene
// ---------------------------------------------------------------------------

export const SceneSettingsSchema = z
  .object({
    fps: z.number().positive().optional(),
    unitScale: z.number().positive().optional(),
    pxPerMetre: z.number().positive().optional(),
    ambientColor: z.string().optional(),
    ambientIntensity: z.number().nonnegative().optional(),
    gravity: Vector3Schema.optional(),
  })
  .strict();
export type SceneSettings = z.infer<typeof SceneSettingsSchema>;

export const Scene3dSchema = z
  .object({
    id: IdSchema,
    name: z.string().optional(),
    objects: z.array(IdSchema),
    world: IdSchema.nullable().optional(),
    activeCamera: IdSchema.nullable().optional(),
    settings: SceneSettingsSchema.optional(),
  })
  .strict();
export type Scene3d = z.infer<typeof Scene3dSchema>;

// ---------------------------------------------------------------------------
// 2. Object
// ---------------------------------------------------------------------------

export const ObjectType3dSchema = z.enum(["mesh", "light", "camera", "armature", "empty"]);
export type ObjectType3d = z.infer<typeof ObjectType3dSchema>;

export const Object3dSchema = z
  .object({
    id: IdSchema,
    name: z.string().optional(),
    type: ObjectType3dSchema,
    transform: Transform3dSchema,
    delta: DeltaTransform3dSchema.optional(),
    parentInverse: Mat4ArraySchema.optional(),
    parentId: IdSchema.nullable().optional(),
    dataId: IdSchema.nullable().optional(),
    materialSlots: z.array(IdSchema).optional(),
    materials: z.array(IdSchema).optional(),
    visible: z.boolean().optional(),
  })
  .strict();
export type Object3d = z.infer<typeof Object3dSchema>;

// ---------------------------------------------------------------------------
// 3. Mesh
// ---------------------------------------------------------------------------

export const MeshBinaryRefSchema = z
  .object({
    assetId: z.string(),
    vertexCount: z.number().int().nonnegative(),
    faceCount: z.number().int().nonnegative(),
  })
  .strict();
export type MeshBinaryRef = z.infer<typeof MeshBinaryRefSchema>;

export const Mesh3dSchema = z
  .object({
    id: IdSchema,
    name: z.string().optional(),
    positions: z.array(z.number()).optional(),
    indices: z.array(z.number()).optional(),
    normals: z.array(z.number()).optional(),
    uvs: z.array(z.number()).optional(),
    binary: MeshBinaryRefSchema.optional(),
  })
  .strict()
  .superRefine((mesh, ctx) => {
    const hasInline = mesh.positions !== undefined;
    const hasBinary = mesh.binary !== undefined;
    if (!hasInline && !hasBinary) {
      ctx.addIssue({
        code: "custom",
        message: "Mesh must have either inline geometry (positions) or a binary pointer.",
      });
    }
  });
export type Mesh3d = z.infer<typeof Mesh3dSchema>;

// ---------------------------------------------------------------------------
// 4. Material
// ---------------------------------------------------------------------------

export const Material3dSchema = z
  .object({
    id: IdSchema,
    name: z.string().optional(),
    baseColor: z.string().default("#ffffff"),
    metallic: z.number().min(0).max(1).default(0),
    roughness: z.number().min(0).max(1).default(0.5),
    emissive: z.string().default("#000000"),
    emissiveIntensity: z.number().nonnegative().optional(),
    opacity: z.number().min(0).max(1).optional(),
    wireframe: z.boolean().optional(),
    doubleSided: z.boolean().optional(),
    baseColorTexture: IdSchema.nullable().optional(),
    normalTexture: IdSchema.nullable().optional(),
    metallicRoughnessTexture: IdSchema.nullable().optional(),
    emissiveTexture: IdSchema.nullable().optional(),
  })
  .strict();
export type Material3d = z.infer<typeof Material3dSchema>;

// ---------------------------------------------------------------------------
// 5. Light
// ---------------------------------------------------------------------------

export const LightType3dSchema = z.enum(["point", "sun", "spot", "area", "directional"]);
export type LightType3d = z.infer<typeof LightType3dSchema>;

export const Light3dSchema = z
  .object({
    id: IdSchema,
    name: z.string().optional(),
    type: LightType3dSchema,
    color: z.string().default("#ffffff"),
    intensity: z.number().nonnegative().default(1),
    distance: z.number().nonnegative().optional(),
    decay: z.number().nonnegative().optional(),
    castShadow: z.boolean().optional(),
    shadowBias: z.number().optional(),
    spotAngle: z.number().optional(),
    spotBlend: z.number().optional(),
  })
  .strict();
export type Light3d = z.infer<typeof Light3dSchema>;

// ---------------------------------------------------------------------------
// 6. Camera
// ---------------------------------------------------------------------------

export const CameraProjection3dSchema = z.enum(["perspective", "orthographic"]);
export type CameraProjection3d = z.infer<typeof CameraProjection3dSchema>;

export const Camera3dSchema = z
  .object({
    id: IdSchema,
    name: z.string().optional(),
    type: CameraProjection3dSchema.default("perspective"),
    fov: z.number().positive().default(50),
    orthoScale: z.number().positive().optional(),
    near: z.number().positive().default(0.1),
    far: z.number().positive().default(1000),
    sensorFit: z.enum(["auto", "horizontal", "vertical"]).optional(),
    focalLength: z.number().positive().optional(),
  })
  .strict();
export type Camera3d = z.infer<typeof Camera3dSchema>;

// ---------------------------------------------------------------------------
// 7. Armature
// ---------------------------------------------------------------------------

export const Bone3dSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    parent: IdSchema.nullable().optional(),
    head: Vector3Schema.default([0, 0, 0]),
    tail: Vector3Schema.default([0, 1, 0]),
    roll: z.number().default(0),
  })
  .strict();
export type Bone3d = z.infer<typeof Bone3dSchema>;

export const Armature3dSchema = z
  .object({
    id: IdSchema,
    name: z.string().optional(),
    bones: z.array(Bone3dSchema),
  })
  .strict();
export type Armature3d = z.infer<typeof Armature3dSchema>;

// ---------------------------------------------------------------------------
// 8. Action
// ---------------------------------------------------------------------------

export const Keyframe3dSchema = z
  .object({
    time: z.number(),
    value: z.number(),
    interpolation: z.enum(["linear", "bezier", "constant"]).optional(),
    handleLeft: z.tuple([z.number(), z.number()]).optional(),
    handleRight: z.tuple([z.number(), z.number()]).optional(),
  })
  .strict();
export type Keyframe3d = z.infer<typeof Keyframe3dSchema>;

export const FCurve3dSchema = z
  .object({
    dataPath: z.string(),
    arrayIndex: z.number().int().nonnegative().optional(),
    keyframes: z.array(Keyframe3dSchema),
  })
  .strict();
export type FCurve3d = z.infer<typeof FCurve3dSchema>;

export const Action3dSchema = z
  .object({
    id: IdSchema,
    name: z.string().optional(),
    fcurves: z.array(FCurve3dSchema),
  })
  .strict();
export type Action3d = z.infer<typeof Action3dSchema>;

// ---------------------------------------------------------------------------
// 9. World
// ---------------------------------------------------------------------------

export const World3dSchema = z
  .object({
    id: IdSchema,
    name: z.string().optional(),
    color: z.string().default("#000000"),
    ambientColor: z.string().optional(),
    ambientIntensity: z.number().nonnegative().optional(),
    environmentImage: IdSchema.nullable().optional(),
    environmentIntensity: z.number().nonnegative().optional(),
    environmentRotation: z.number().optional(),
  })
  .strict();
export type World3d = z.infer<typeof World3dSchema>;

// ---------------------------------------------------------------------------
// 10. Image3d
// ---------------------------------------------------------------------------

export const Image3dSchema = z
  .object({
    id: IdSchema,
    name: z.string().optional(),
    assetId: z.string().regex(/^[0-9a-f]{64}$/, "An asset id is a SHA-256 in hex."),
    mime: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    colorSpace: z.enum(["srgb", "linear"]).optional(),
  })
  .strict();
export type Image3d = z.infer<typeof Image3dSchema>;
