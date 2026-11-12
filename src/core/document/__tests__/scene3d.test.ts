/**
 * ============================================================================
 * UNIT TESTS: 3D DATA BLOCKS, SCHEMA v7, ARCHETYPE & MESH BINARY
 * ============================================================================
 * ROADMAP_3D Phase 3D-007 verification:
 *   1. Every data block kind round-trips (parse -> serialize -> parse equal).
 *   2. scene3d layer archetype definition & single property 'scene'.
 *   3. v6 fixture migration to v7 (idempotent, pure additive).
 *   4. Bad data rejection (strict schemas reject unknown extra keys and invalid values).
 *   5. Data block rules: userCount, makeSingleUser, removeUnused.
 *   6. Mesh binary layout exact round-trip (incl. 1,000,000-vertex timing < 1000 ms).
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import {
  SCHEMA_VERSION,
  createEmptyDocument,
  parseMotionDocument,
  validateMotionDocument,
  type MotionDocument,
  type Scene3d,
  type Object3d,
  type Mesh3d,
  type Material3d,
  type Light3d,
  type Camera3d,
  type Armature3d,
  type Action3d,
  type World3d,
  type Image3d,
} from "../schema";
import {
  Scene3dSchema,
  Object3dSchema,
  Mesh3dSchema,
  Material3dSchema,
  Light3dSchema,
  Camera3dSchema,
  Armature3dSchema,
  Action3dSchema,
  World3dSchema,
  Image3dSchema,
} from "../scene3d";
import { ARCHETYPE_REGISTRY, ARCHETYPE_IDS, getDefaultProps } from "../registry";
import { createLayer, createDocumentFromLayers } from "../factories";
import { loadDocument, migrateV6ToV7 } from "../migrations";
import { userCount, makeSingleUser, removeUnused } from "../dataBlocks";
import { encodeMesh, decodeMesh, MESH_BINARY_MAGIC } from "../meshBinary";
import { isPropertyLegalFor, validateLayerProps } from "../properties";

describe("Phase 3D-007: 3D data block schemas & round-trip", () => {
  const sampleScene: Scene3d = {
    id: "scn_main",
    name: "Main Scene",
    objects: ["obj_mesh_1", "obj_light_1", "obj_cam_1"],
    world: "wld_studio",
    activeCamera: "cam_main",
    settings: {
      fps: 60,
      unitScale: 1,
      ambientColor: "#222222",
      ambientIntensity: 0.5,
      gravity: [0, -9.81, 0],
    },
  };

  const sampleObject: Object3d = {
    id: "obj_mesh_1",
    name: "Hero Cube",
    type: "mesh",
    transform: {
      location: [0, 1.5, 0],
      rotationQuat: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    parentId: null,
    dataId: "msh_cube",
    materialSlots: ["mat_gold"],
    visible: true,
  };

  const sampleMeshInline: Mesh3d = {
    id: "msh_cube",
    name: "CubeMesh",
    positions: [
      -1, -1, 1,  1, -1, 1,  1, 1, 1,  -1, 1, 1,
      -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1,
    ],
    indices: [0, 1, 2, 2, 3, 0],
    normals: [
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    ],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1],
  };

  const sampleMeshBinary: Mesh3d = {
    id: "msh_large",
    name: "HighPolyStatue",
    binary: {
      assetId: "a".repeat(64),
      vertexCount: 500000,
      faceCount: 500000,
    },
  };

  const sampleMaterial: Material3d = {
    id: "mat_gold",
    name: "Gold Foil",
    baseColor: "#ffd700",
    metallic: 0.95,
    roughness: 0.15,
    emissive: "#000000",
    emissiveIntensity: 0,
    opacity: 1,
    wireframe: false,
    doubleSided: true,
    baseColorTexture: "img_tex_1",
  };

  const sampleLight: Light3d = {
    id: "lit_key",
    name: "Key Light",
    type: "spot",
    color: "#fff5ea",
    intensity: 150,
    distance: 30,
    decay: 2,
    castShadow: true,
    shadowBias: 0.0001,
    spotAngle: 45,
    spotBlend: 0.2,
  };

  const sampleCamera: Camera3d = {
    id: "cam_main",
    name: "Main Camera",
    type: "perspective",
    fov: 45,
    near: 0.1,
    far: 500,
    sensorFit: "horizontal",
    focalLength: 50,
  };

  const sampleArmature: Armature3d = {
    id: "arm_rig",
    name: "Armature",
    bones: [
      { id: "bn_root", name: "Root", parent: null, head: [0, 0, 0], tail: [0, 1, 0], roll: 0 },
      { id: "bn_head", name: "Head", parent: "bn_root", head: [0, 1, 0], tail: [0, 1.5, 0], roll: 0 },
    ],
  };

  const sampleAction: Action3d = {
    id: "act_bounce",
    name: "Bounce",
    fcurves: [
      {
        dataPath: "transform.location",
        arrayIndex: 1,
        keyframes: [
          { time: 0, value: 0, interpolation: "bezier" },
          { time: 0.5, value: 2.5, interpolation: "bezier" },
          { time: 1.0, value: 0, interpolation: "bezier" },
        ],
      },
    ],
  };

  const sampleWorld: World3d = {
    id: "wld_studio",
    name: "Photo Studio",
    color: "#0a0a0a",
    ambientColor: "#2a2a2a",
    ambientIntensity: 0.6,
    environmentImage: "img_hdri_1",
    environmentIntensity: 1.0,
    environmentRotation: 180,
  };

  const sampleImage: Image3d = {
    id: "img_tex_1",
    name: "FoilAlbedo",
    assetId: "b".repeat(64),
    mime: "image/png",
    width: 2048,
    height: 2048,
    colorSpace: "srgb",
  };

  it("every block kind round-trips (parse -> serialise -> parse equal)", () => {
    // 1. Scene
    const parsedScene = Scene3dSchema.parse(sampleScene);
    assert.deepEqual(JSON.parse(JSON.stringify(parsedScene)), sampleScene);

    // 2. Object
    const parsedObj = Object3dSchema.parse(sampleObject);
    assert.deepEqual(JSON.parse(JSON.stringify(parsedObj)), sampleObject);

    // 3. Mesh (inline)
    const parsedMeshInline = Mesh3dSchema.parse(sampleMeshInline);
    assert.deepEqual(JSON.parse(JSON.stringify(parsedMeshInline)), sampleMeshInline);

    // 4. Mesh (binary pointer)
    const parsedMeshBinary = Mesh3dSchema.parse(sampleMeshBinary);
    assert.deepEqual(JSON.parse(JSON.stringify(parsedMeshBinary)), sampleMeshBinary);

    // 5. Material
    const parsedMat = Material3dSchema.parse(sampleMaterial);
    assert.deepEqual(JSON.parse(JSON.stringify(parsedMat)), sampleMaterial);

    // 6. Light
    const parsedLight = Light3dSchema.parse(sampleLight);
    assert.deepEqual(JSON.parse(JSON.stringify(parsedLight)), sampleLight);

    // 7. Camera
    const parsedCam = Camera3dSchema.parse(sampleCamera);
    assert.deepEqual(JSON.parse(JSON.stringify(parsedCam)), sampleCamera);

    // 8. Armature
    const parsedArm = Armature3dSchema.parse(sampleArmature);
    assert.deepEqual(JSON.parse(JSON.stringify(parsedArm)), sampleArmature);

    // 9. Action
    const parsedAct = Action3dSchema.parse(sampleAction);
    assert.deepEqual(JSON.parse(JSON.stringify(parsedAct)), sampleAction);

    // 10. World
    const parsedWorld = World3dSchema.parse(sampleWorld);
    assert.deepEqual(JSON.parse(JSON.stringify(parsedWorld)), sampleWorld);

    // 11. Image3d
    const parsedImg = Image3dSchema.parse(sampleImage);
    assert.deepEqual(JSON.parse(JSON.stringify(parsedImg)), sampleImage);
  });

  it("a complete MotionDocument with all 10 3D tables validates and round-trips", () => {
    const doc = createEmptyDocument();
    assert.equal(doc.schemaVersion, 7);

    // Add 3D scene tables
    doc.scenes = { [sampleScene.id]: sampleScene };
    doc.objects = { [sampleObject.id]: sampleObject };
    doc.meshes = { [sampleMeshInline.id]: sampleMeshInline, [sampleMeshBinary.id]: sampleMeshBinary };
    doc.materials = { [sampleMaterial.id]: sampleMaterial };
    doc.lights = { [sampleLight.id]: sampleLight };
    doc.cameras = { [sampleCamera.id]: sampleCamera };
    doc.armatures = { [sampleArmature.id]: sampleArmature };
    doc.actions = { [sampleAction.id]: sampleAction };
    doc.worlds = { [sampleWorld.id]: sampleWorld };
    doc.images3d = { [sampleImage.id]: sampleImage };

    // Add a scene3d layer referencing the scene
    const sceneLayer = createLayer({
      id: "layer_s3d",
      archetype: "scene3d",
      properties: { scene: sampleScene.id },
    });
    doc.layers[sceneLayer.id] = sceneLayer;

    const validated = validateMotionDocument(doc);
    assert.ok(validated.ok, validated.ok ? "" : JSON.stringify(validated.issues));

    // Serialise -> parse -> validate round trip
    const serialized = JSON.stringify(doc);
    const parsed = parseMotionDocument(JSON.parse(serialized));
    assert.equal(parsed.schemaVersion, 7);
    assert.deepEqual(parsed.scenes?.[sampleScene.id], sampleScene);
    assert.deepEqual(parsed.objects?.[sampleObject.id], sampleObject);
    assert.deepEqual(parsed.meshes?.[sampleMeshInline.id], sampleMeshInline);
    assert.deepEqual(parsed.layers[sceneLayer.id].properties.scene, sampleScene.id);
  });
});

describe("Phase 3D-007: scene3d layer archetype", () => {
  it("registers scene3d in ARCHETYPE_IDS and ARCHETYPE_REGISTRY with defaultProps.scene", () => {
    assert.ok(ARCHETYPE_IDS.includes("scene3d" as const));
    const entry = ARCHETYPE_REGISTRY["scene3d"];
    assert.equal(entry.id, "scene3d");
    assert.equal(entry.kind, "scene3d");
    assert.equal(entry.family, null);
    assert.equal(entry.exportTag, "div");
    assert.ok(entry.sections.includes("identity"));
    assert.deepEqual(entry.defaultProps, { scene: "" });
  });

  it("createLayer creates a valid scene3d layer", () => {
    const layer = createLayer({ archetype: "scene3d", properties: { scene: "scn_1" } });
    assert.equal(layer.archetype, "scene3d");
    assert.equal(layer.properties.scene, "scn_1");
  });

  it("getDefaultProps('scene3d') returns a fresh copy of { scene: '' }", () => {
    const props = getDefaultProps("scene3d");
    assert.deepEqual(props, { scene: "" });
    props.scene = "modified";
    assert.equal(getDefaultProps("scene3d").scene, "");
  });

  it("scene is the only legal archetype-specific property for scene3d", () => {
    assert.ok(isPropertyLegalFor("scene", "scene3d"));
    assert.ok(!isPropertyLegalFor("scene", "button"));
    assert.ok(!isPropertyLegalFor("scene", "container"));
    assert.ok(!isPropertyLegalFor("frame.width", "scene3d"));
    assert.ok(!isPropertyLegalFor("appearance.background.color", "scene3d"));

    // Validation rejects illegal properties on scene3d
    const issues = validateLayerProps("scene3d", { scene: "scn_abc", "frame.width": 100 });
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /not a property of scene3d/);
  });
});

describe("Phase 3D-007: v6 to v7 migration", () => {
  it("migrateV6ToV7 updates schemaVersion to 7 and leaves tables absent/empty", () => {
    const v6Doc: Record<string, unknown> = {
      schemaVersion: 6,
      layers: {},
      clips: {},
      states: {},
      behaviours: {},
      sequences: {},
      transitions: {},
      bindings: {},
      surfaces: {},
      inputTapes: {},
      graphs: {},
      effects: {},
      components: {},
      generators: {},
      compositions: { comp_main: { id: "comp_main", name: "Main", kind: "main", layers: {}, clips: [], nested: [] } },
      tokens: { colors: {}, spacing: {}, radii: {} },
      exportSettings: { framework: "nextjs-app", styling: "tailwind", animation: "gsap", language: "typescript" },
    };

    const { document, report } = migrateV6ToV7(v6Doc);
    assert.equal(document.schemaVersion, 7);
    assert.deepEqual(report, []);
    assert.equal(document.scenes, undefined);
    assert.equal(document.objects, undefined);
  });

  it("loadDocument migrates v6 documents to v7 preserving all existing data", () => {
    const v6Layer = createLayer({ id: "box", archetype: "container" });
    const doc = createDocumentFromLayers([v6Layer]);
    const rawV6 = structuredClone(doc) as unknown as Record<string, unknown>;
    rawV6.schemaVersion = 6;

    const loaded = loadDocument({ document: rawV6 });
    assert.equal(loaded.schemaVersion, 7);
    assert.ok(loaded.layers.box);
    assert.equal(loaded.layers.box.archetype, "container");
  });

  it("migrateV6ToV7 is idempotent on v7 documents", () => {
    const doc = createEmptyDocument();
    const { document } = migrateV6ToV7(doc as unknown as Record<string, unknown>);
    assert.equal(document.schemaVersion, 7);
  });
});

describe("Phase 3D-007: bad data rejection", () => {
  it("rejects unknown extra keys on data blocks (.strict())", () => {
    assert.throws(
      () =>
        Material3dSchema.parse({
          id: "mat_1",
          baseColor: "#fff",
          metallic: 0,
          roughness: 0.5,
          emissive: "#000",
          unknownKey: 42,
        }),
      /unrecognized_keys/
    );

    assert.throws(
      () =>
        Scene3dSchema.parse({
          id: "scn_1",
          objects: [],
          randomExtraField: "bad",
        }),
      /unrecognized_keys/
    );

    assert.throws(
      () =>
        Object3dSchema.parse({
          id: "obj_1",
          type: "mesh",
          transform: { location: [0, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1], extra: 1 },
        }),
      /unrecognized_keys/
    );
  });

  it("rejects invalid values on data block properties", () => {
    // Metallic must be <= 1
    assert.throws(
      () =>
        Material3dSchema.parse({
          id: "mat_bad",
          metallic: 2.0,
        }),
      /too_big/
    );

    // Light intensity must be non-negative
    assert.throws(
      () =>
        Light3dSchema.parse({
          id: "lit_bad",
          type: "point",
          intensity: -10,
        }),
      /too_small/
    );

    // Mesh must have either inline positions or binary ref
    assert.throws(
      () =>
        Mesh3dSchema.parse({
          id: "msh_empty",
        }),
      /Mesh must have either inline geometry/
    );

    // Image3d assetId must be 64-char hex
    assert.throws(
      () =>
        Image3dSchema.parse({
          id: "img_bad",
          assetId: "not-a-valid-sha256",
        }),
      /SHA-256 in hex/
    );
  });

  it("rejects 3D entities stored under mismatched keys in MotionDocument", () => {
    const doc = createEmptyDocument();
    doc.materials = {
      mat_key: {
        id: "mat_different",
        baseColor: "#ffffff",
        metallic: 0,
        roughness: 0.5,
        emissive: "#000000",
      },
    };
    const res = validateMotionDocument(doc);
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.message.includes('Stored under "mat_key" but has id "mat_different"')));
  });
});

describe("Phase 3D-007: data block helpers (userCount, makeSingleUser, removeUnused)", () => {
  it("userCount accurately tracks references across objects, scenes and materials", () => {
    const doc = createEmptyDocument();
    doc.materials = {
      mat_shared: { id: "mat_shared", baseColor: "#fff", metallic: 0, roughness: 0.5, emissive: "#000" },
      mat_single: { id: "mat_single", baseColor: "#f00", metallic: 0, roughness: 0.5, emissive: "#000" },
      mat_unused: { id: "mat_unused", baseColor: "#0f0", metallic: 0, roughness: 0.5, emissive: "#000" },
    };
    doc.meshes = {
      msh_cube: { id: "msh_cube", positions: [0, 0, 0, 1, 0, 0, 1, 1, 0], indices: [0, 1, 2] },
      msh_unused: { id: "msh_unused", positions: [0, 0, 0, 1, 0, 0, 1, 1, 0], indices: [0, 1, 2] },
    };
    doc.objects = {
      obj_1: {
        id: "obj_1",
        type: "mesh",
        transform: { location: [0, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
        dataId: "msh_cube",
        materialSlots: ["mat_shared"],
      },
      obj_2: {
        id: "obj_2",
        type: "mesh",
        transform: { location: [1, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
        dataId: "msh_cube",
        materialSlots: ["mat_shared", "mat_single"],
      },
    };
    doc.scenes = {
      scn_1: {
        id: "scn_1",
        objects: ["obj_1", "obj_2"],
      },
    };

    assert.equal(userCount(doc, "material", "mat_shared"), 2);
    assert.equal(userCount(doc, "material", "mat_single"), 1);
    assert.equal(userCount(doc, "material", "mat_unused"), 0);

    assert.equal(userCount(doc, "mesh", "msh_cube"), 2);
    assert.equal(userCount(doc, "mesh", "msh_unused"), 0);

    assert.equal(userCount(doc, "object", "obj_1"), 1);
    assert.equal(userCount(doc, "object", "obj_2"), 1);
  });

  it("makeSingleUser duplicates a shared material for the target object only and keeps document immutable", () => {
    const doc = createEmptyDocument();
    doc.materials = {
      mat_shared: { id: "mat_shared", name: "Glossy", baseColor: "#ff0000", metallic: 0.8, roughness: 0.2, emissive: "#000" },
    };
    doc.objects = {
      obj_1: {
        id: "obj_1",
        type: "mesh",
        transform: { location: [0, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
        materialSlots: ["mat_shared"],
      },
      obj_2: {
        id: "obj_2",
        type: "mesh",
        transform: { location: [2, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
        materialSlots: ["mat_shared"],
      },
    };

    assert.equal(userCount(doc, "material", "mat_shared"), 2);

    const updated = makeSingleUser(doc, "obj_1", 0);

    // Original doc is unchanged (pure, immutable)
    assert.equal(doc.objects.obj_1.materialSlots![0], "mat_shared");
    assert.equal(doc.objects.obj_2.materialSlots![0], "mat_shared");
    assert.equal(Object.keys(doc.materials).length, 1);

    // Updated doc has new material copy
    const newSlotId = updated.objects!.obj_1.materialSlots![0];
    assert.notEqual(newSlotId, "mat_shared");
    assert.match(newSlotId, /^mat_[0-9a-f]{8}$/);
    assert.equal(updated.objects!.obj_2.materialSlots![0], "mat_shared");

    const newMaterial = updated.materials![newSlotId];
    assert.ok(newMaterial);
    assert.equal(newMaterial.name, "Glossy.001");
    assert.equal(newMaterial.baseColor, "#ff0000");
    assert.equal(newMaterial.metallic, 0.8);

    // User count of both materials is now 1 each
    assert.equal(userCount(updated, "material", "mat_shared"), 1);
    assert.equal(userCount(updated, "material", newSlotId), 1);

    // Calling makeSingleUser on a single-user material returns the doc unchanged
    const unchanged = makeSingleUser(updated, "obj_1", 0);
    assert.equal(unchanged, updated);
  });

  it("removeUnused purges orphaned data blocks recursively", () => {
    const doc = createEmptyDocument();
    doc.images3d = {
      img_used: { id: "img_used", assetId: "c".repeat(64) },
      img_unused: { id: "img_unused", assetId: "d".repeat(64) },
      img_cascading: { id: "img_cascading", assetId: "e".repeat(64) },
    };
    doc.materials = {
      mat_active: { id: "mat_active", baseColor: "#fff", metallic: 0, roughness: 0.5, emissive: "#000", baseColorTexture: "img_used" },
      mat_orphan: { id: "mat_orphan", baseColor: "#fff", metallic: 0, roughness: 0.5, emissive: "#000", baseColorTexture: "img_cascading" },
    };
    doc.meshes = {
      msh_active: { id: "msh_active", positions: [0, 0, 0, 1, 0, 0, 1, 1, 0] },
      msh_orphan: { id: "msh_orphan", positions: [0, 0, 0, 1, 0, 0, 1, 1, 0] },
    };
    doc.objects = {
      obj_active: {
        id: "obj_active",
        type: "mesh",
        transform: { location: [0, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
        dataId: "msh_active",
        materialSlots: ["mat_active"],
      },
      obj_orphan: {
        id: "obj_orphan",
        type: "mesh",
        transform: { location: [0, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
        dataId: "msh_orphan",
        materialSlots: ["mat_orphan"],
      },
    };
    doc.scenes = {
      scn_1: {
        id: "scn_1",
        objects: ["obj_active"], // obj_orphan is not in any scene!
      },
    };

    const cleaned = removeUnused(doc);

    // Active object, mesh, material, and image remain
    assert.ok(cleaned.objects!.obj_active);
    assert.ok(cleaned.meshes!.msh_active);
    assert.ok(cleaned.materials!.mat_active);
    assert.ok(cleaned.images3d!.img_used);

    // Orphaned object and its cascading dependents are purged
    assert.equal(cleaned.objects!.obj_orphan, undefined);
    assert.equal(cleaned.meshes!.msh_orphan, undefined);
    assert.equal(cleaned.materials!.mat_orphan, undefined);
    assert.equal(cleaned.images3d!.img_cascading, undefined);
    assert.equal(cleaned.images3d!.img_unused, undefined);
  });
});

describe("Phase 3D-007: mesh binary layout & 1M vertex performance", () => {
  it("encodes and decodes a small mesh with exact float and index values", () => {
    const positions = new Float32Array([0.5, 1.25, -3.75, 10.0, 20.0, 30.0]);
    const indices = new Uint32Array([0, 1, 0]);

    const { bytes } = encodeMesh({ positions, indices });
    assert.ok(bytes instanceof Uint8Array);

    const decoded = decodeMesh(bytes);
    assert.equal(decoded.vertexCount, 2);
    assert.equal(decoded.faceCount, 1);
    assert.deepEqual(Array.from(decoded.positions), Array.from(positions));
    assert.deepEqual(Array.from(decoded.indices), Array.from(indices));
  });

  it("encodes and decodes a mesh with plain JS number arrays", () => {
    const positions = [1.1, 2.2, 3.3, 4.4, 5.5, 6.6];
    const indices = [0, 1, 0];

    const { bytes } = encodeMesh({ positions, indices });
    const decoded = decodeMesh(bytes);

    assert.equal(decoded.vertexCount, 2);
    for (let i = 0; i < positions.length; i++) {
      assert.ok(Math.abs(decoded.positions[i] - positions[i]) < 1e-5);
    }
    assert.deepEqual(Array.from(decoded.indices), indices);
  });

  it("encodes positions without indices", () => {
    const positions = new Float32Array([1, 2, 3]);
    const { bytes } = encodeMesh({ positions });
    const decoded = decodeMesh(bytes);

    assert.equal(decoded.vertexCount, 1);
    assert.equal(decoded.faceCount, 0);
    assert.equal(decoded.indices.length, 0);
    assert.deepEqual(Array.from(decoded.positions), [1, 2, 3]);
  });

  it("throws on corrupted or truncated binary data", () => {
    assert.throws(() => decodeMesh(new Uint8Array([1, 2, 3])), /buffer too small/);

    const badMagic = new Uint8Array(16);
    assert.throws(() => decodeMesh(badMagic), /bad magic number/);

    const { bytes } = encodeMesh({ positions: new Float32Array([0, 0, 0, 1, 1, 1]) });
    // Truncate bytes
    const truncated = bytes.slice(0, bytes.length - 4);
    assert.throws(() => decodeMesh(truncated), /truncated buffer/);
  });

  it("encodes and decodes a 1,000,000-vertex mesh in well under 1000 ms", () => {
    const VERTEX_COUNT = 1_000_000;
    const POS_COUNT = VERTEX_COUNT * 3; // 3,000,000 floats
    const INDEX_COUNT = VERTEX_COUNT * 3; // 1,000,000 triangles = 3,000,000 uints

    const positions = new Float32Array(POS_COUNT);
    // Fill with sample coordinates
    for (let i = 0; i < POS_COUNT; i += 3) {
      positions[i] = i * 0.01;
      positions[i + 1] = i * 0.02;
      positions[i + 2] = i * 0.03;
    }

    const indices = new Uint32Array(INDEX_COUNT);
    for (let i = 0; i < INDEX_COUNT; i++) {
      indices[i] = i % VERTEX_COUNT;
    }

    const start = performance.now();
    const { bytes } = encodeMesh({ positions, indices });
    const decoded = decodeMesh(bytes);
    const duration = performance.now() - start;

    // Timing assertion: must be well under 1000 ms
    assert.ok(
      duration < 1000,
      `1M vertex encode+decode took ${duration.toFixed(2)} ms, which exceeds the 1000 ms budget`
    );

    // Verify exact round-trip integrity
    assert.equal(decoded.vertexCount, VERTEX_COUNT);
    assert.equal(decoded.faceCount, VERTEX_COUNT);
    assert.equal(decoded.positions.length, POS_COUNT);
    assert.equal(decoded.indices.length, INDEX_COUNT);

    // Check first, middle and last vertex
    assert.equal(decoded.positions[0], positions[0]);
    assert.equal(decoded.positions[1], positions[1]);
    assert.equal(decoded.positions[2], positions[2]);

    const mid = Math.floor(POS_COUNT / 2);
    assert.equal(decoded.positions[mid], positions[mid]);

    const last = POS_COUNT - 1;
    assert.equal(decoded.positions[last], positions[last]);
    assert.equal(decoded.indices[INDEX_COUNT - 1], indices[INDEX_COUNT - 1]);
  });
});
