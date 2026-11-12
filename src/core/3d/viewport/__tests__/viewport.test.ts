import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_VIEWPORT_SETTINGS,
  viewportReducer,
  serializeViewportSettings,
  deserializeViewportSettings,
  sceneStats,
  uniformsFor,
  ALL_VIEWPORT_SHADERS,
  VIEWPORT_SHADERS,
  type ViewportSettings,
} from "../index";
import type { Mesh3d, Object3d, Scene3d } from "../../../document/scene3d";

describe("Phase 3D-018 & Phase 3D-019: 3D Viewport Settings, Stats & Shaders", () => {
  describe("Viewport Settings & Reducer", () => {
    it("handles canonical toggle commands correctly in the reducer", () => {
      let state = DEFAULT_VIEWPORT_SETTINGS;
      assert.equal(state.shading, "solid");
      assert.equal(state.xray, false);
      assert.equal(state.overlays.grid, true);
      assert.equal(state.overlays.stats, false);

      // 1. Toggle wireframe
      state = viewportReducer(state, "3d.shading.wireframe");
      assert.equal(state.shading, "wireframe");

      // 2. Toggle wireframe again returns to solid
      state = viewportReducer(state, "3d.shading.wireframe");
      assert.equal(state.shading, "solid");

      // 3. Shading solid, material, rendered
      state = viewportReducer(state, "3d.shading.material");
      assert.equal(state.shading, "material");

      state = viewportReducer(state, "3d.shading.rendered");
      assert.equal(state.shading, "rendered");

      state = viewportReducer(state, "3d.shading.solid");
      assert.equal(state.shading, "solid");

      // 4. Toggle xray
      state = viewportReducer(state, "3d.shading.toggle_xray");
      assert.equal(state.xray, true);

      state = viewportReducer(state, "3d.shading.toggle_xray");
      assert.equal(state.xray, false);

      // 5. Toggle grid overlay
      state = viewportReducer(state, "3d.overlay.toggle_grid");
      assert.equal(state.overlays.grid, false);

      // 6. Toggle stats overlay
      state = viewportReducer(state, "3d.overlay.toggle_stats");
      assert.equal(state.overlays.stats, true);
    });

    it("handles structured action objects in the reducer", () => {
      let state = DEFAULT_VIEWPORT_SETTINGS;

      // SET_SHADING
      state = viewportReducer(state, { type: "SET_SHADING", shading: "wireframe" });
      assert.equal(state.shading, "wireframe");

      // TOGGLE_OVERLAY
      state = viewportReducer(state, { type: "TOGGLE_OVERLAY", overlay: "faceOrientation" });
      assert.equal(state.overlays.faceOrientation, true);

      // SET_OVERLAYS
      state = viewportReducer(state, {
        type: "SET_OVERLAYS",
        overlays: { normals: true, wireOnShaded: true },
      });
      assert.equal(state.overlays.normals, true);
      assert.equal(state.overlays.wireOnShaded, true);

      // TOGGLE_CAVITY
      state = viewportReducer(state, { type: "TOGGLE_CAVITY" });
      assert.equal(state.solidOptions.cavity, false);

      // TOGGLE_GIZMO
      state = viewportReducer(state, { type: "TOGGLE_GIZMO" });
      assert.equal(state.gizmoVisible, false);

      // RESET_SETTINGS
      state = viewportReducer(state, { type: "RESET_SETTINGS" });
      assert.deepEqual(state, DEFAULT_VIEWPORT_SETTINGS);
    });

    it("performs serialization and deserialization round trip losslessly", () => {
      const customSettings: ViewportSettings = {
        shading: "material",
        xray: true,
        overlays: {
          grid: false,
          axes: true,
          origins: false,
          faceOrientation: true,
          normals: true,
          wireOnShaded: true,
          stats: true,
        },
        solidOptions: {
          cavity: false,
          studioLight: "sunset",
        },
        gizmoVisible: false,
      };

      const serialized = serializeViewportSettings(customSettings);
      assert.ok(typeof serialized === "string");
      assert.ok(serialized.length > 0);

      const deserialized = deserializeViewportSettings(serialized);
      assert.deepEqual(deserialized, customSettings);
    });

    it("rejects invalid JSON during deserialization", () => {
      assert.throws(() => deserializeViewportSettings('{"invalid": true}'));
      assert.throws(() => deserializeViewportSettings('{"shading": "unsupported"}'));
    });
  });

  describe("Scene Statistics (sceneStats)", () => {
    function createCubeMesh(id = "msh_cube"): Mesh3d {
      return {
        id,
        positions: [
          -1, -1, -1, // 0
           1, -1, -1, // 1
           1,  1, -1, // 2
          -1,  1, -1, // 3
          -1, -1,  1, // 4
           1, -1,  1, // 5
           1,  1,  1, // 6
          -1,  1,  1, // 7
        ],
        indices: [
          // Front (+Z)
          4, 5, 6,  4, 6, 7,
          // Back (-Z)
          1, 0, 3,  1, 3, 2,
          // Top (+Y)
          3, 6, 2,  3, 7, 6,
          // Bottom (-Y)
          0, 1, 5,  0, 5, 4,
          // Right (+X)
          1, 2, 6,  1, 6, 5,
          // Left (-X)
          0, 4, 7,  0, 7, 3,
        ],
        normals: [
          -0.577, -0.577, -0.577,
           0.577, -0.577, -0.577,
           0.577,  0.577, -0.577,
          -0.577,  0.577, -0.577,
          -0.577, -0.577,  0.577,
           0.577, -0.577,  0.577,
           0.577,  0.577,  0.577,
          -0.577,  0.577,  0.577,
        ],
      };
    }

    it("computes accurate stats on a known doc (cube = 8 vertices, 6 faces, 12 triangles)", () => {
      const cubeMesh = createCubeMesh("msh_box");
      const cubeObj: Object3d = {
        id: "obj_box",
        type: "mesh",
        transform: {
          location: [0, 0, 0],
          rotationQuat: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
        dataId: "msh_box",
      };
      const scene: Scene3d = {
        id: "scn_main",
        objects: ["obj_box"],
      };

      const doc = {
        scenes: { scn_main: scene },
        objects: { obj_box: cubeObj },
        meshes: { msh_box: cubeMesh },
      };

      const stats = sceneStats(doc, "scn_main");

      assert.equal(stats.objects, 1, "Should count 1 object in scene");
      assert.equal(stats.vertices, 8, "Cube has 8 distinct vertices");
      assert.equal(stats.faces, 6, "Cube has 6 quad faces clustered from 12 triangles");
      assert.equal(stats.triangles, 12, "Cube has 12 triangles");
      // 24 floats pos (96B) + 36 ints ind (144B) + 24 floats norm (96B) = 336 bytes
      assert.equal(stats.estimatedMemoryBytes, 336, "Memory should match 336 bytes");
    });

    it("computes stats from binary mesh pointers", () => {
      const binaryMesh: Mesh3d = {
        id: "msh_binary",
        binary: {
          assetId: "asset_sha256_placeholder",
          vertexCount: 1000,
          faceCount: 500,
        },
      };

      const binObj: Object3d = {
        id: "obj_bin",
        type: "mesh",
        transform: {
          location: [0, 0, 0],
          rotationQuat: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
        dataId: "msh_binary",
      };

      const scene: Scene3d = {
        id: "scn_bin",
        objects: ["obj_bin"],
      };

      const doc = {
        scenes: { scn_bin: scene },
        objects: { obj_bin: binObj },
        meshes: { msh_binary: binaryMesh },
      };

      const stats = sceneStats(doc, "scn_bin");
      assert.equal(stats.objects, 1);
      assert.equal(stats.vertices, 1000);
      assert.equal(stats.faces, 500);
      assert.equal(stats.triangles, 500);
      assert.equal(stats.estimatedMemoryBytes, 16 + 1000 * 12 + 500 * 12);
    });

    it("returns zero stats when scene is missing or empty", () => {
      const stats = sceneStats({}, "nonexistent_scene");
      assert.deepEqual(stats, {
        objects: 0,
        vertices: 0,
        faces: 0,
        triangles: 0,
        estimatedMemoryBytes: 0,
      });
    });
  });

  describe("Viewport Shaders & Uniforms Contract", () => {
    it("every shader string is non-empty, declares #version 300 es and all documented uniforms", () => {
      assert.ok(ALL_VIEWPORT_SHADERS.length >= 10, "Should have at least 10 shader variants");

      for (const shader of ALL_VIEWPORT_SHADERS) {
        assert.ok(
          shader.glsl.trim().length > 0,
          `Shader ${shader.name} must not be empty`
        );

        assert.ok(
          shader.glsl.includes("#version 300 es"),
          `Shader ${shader.name} must declare #version 300 es`
        );

        for (const uniform of shader.docUniforms) {
          const uniformRegex = new RegExp(`uniform\\s+\\w+\\s+${uniform}\\b`);
          assert.ok(
            uniformRegex.test(shader.glsl),
            `Shader ${shader.name} is missing documented uniform declaration: "${uniform}"`
          );
        }
      }
    });

    it("VIEWPORT_SHADERS groups vertex and fragment pairs correctly", () => {
      assert.ok(VIEWPORT_SHADERS.solid.vertex);
      assert.ok(VIEWPORT_SHADERS.solid.fragment);
      assert.ok(VIEWPORT_SHADERS.wireframeOnShaded.vertex);
      assert.ok(VIEWPORT_SHADERS.wireframeOnShaded.fragment);
      assert.ok(VIEWPORT_SHADERS.normal.vertex);
      assert.ok(VIEWPORT_SHADERS.normal.fragment);
      assert.ok(VIEWPORT_SHADERS.faceOrientation.vertex);
      assert.ok(VIEWPORT_SHADERS.faceOrientation.fragment);
      assert.ok(VIEWPORT_SHADERS.outline.vertex);
      assert.ok(VIEWPORT_SHADERS.outline.fragment);
    });

    it("uniformsFor helper returns appropriate uniform objects for all modes", () => {
      const modes: Array<"wireframe" | "solid" | "material" | "rendered"> = [
        "wireframe",
        "solid",
        "material",
        "rendered",
      ];

      for (const mode of modes) {
        const uniforms = uniformsFor(mode, DEFAULT_VIEWPORT_SETTINGS);
        assert.ok(uniforms && typeof uniforms === "object");
        assert.ok("uXray" in uniforms);
        assert.ok("uBaseColor" in uniforms);
        assert.ok("uCavityStrength" in uniforms);
        assert.ok("uOutlineColor" in uniforms);
        assert.ok("uFrontColor" in uniforms);
        assert.ok("uBackColor" in uniforms);
      }
    });
  });
});
