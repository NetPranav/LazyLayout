import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDocument } from "@/core/document/schema";
import type { MotionDocument, Object3d } from "@/core/document/schema";
import { applyLook } from "../applyLook";
import { getSceneSize } from "../sizing";
import type { Look3d } from "../types";

function assertNear(actual: number, expected: number, tolerance = 1e-4): void {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected} (diff: ${diff})`
  );
}

function makeDocWithCube(scale: [number, number, number], id: string): Object3d {
  return {
    id,
    name: `Cube_${id}`,
    type: "mesh",
    transform: {
      location: [0, 0, 0],
      rotationQuat: [0, 0, 0, 1],
      scale,
    },
    materialSlots: [],
    modifiers: [],
  };
}

describe("Phase 3D-023: 3D Looks System", () => {
  it("applying a look to 5 objects of different sizes gives proportional results", () => {
    const doc: MotionDocument = createEmptyDocument();
    doc.objects = {};
    doc.meshes = {};
    doc.materials = {};

    const scales: [number, number, number][] = [
      [1, 1, 1],
      [2, 2, 2],
      [3, 3, 3],
      [4, 4, 4],
      [5, 5, 5],
    ];

    const ids = ["obj_1", "obj_2", "obj_3", "obj_4", "obj_5"];

    for (let i = 0; i < 5; i++) {
      doc.objects[ids[i]] = makeDocWithCube(scales[i], ids[i]);
    }

    // Apply "look_mod_shell" (sizing factor: 0.05 on smallest_side)
    const nextDoc = applyLook(doc, ids, "look_mod_shell");

    const expectedFactors = [0.05, 0.10, 0.15, 0.20, 0.25];

    for (let i = 0; i < 5; i++) {
      const obj = nextDoc.objects![ids[i]];
      assert.ok(obj, `Object ${ids[i]} must exist`);
      assert.ok(obj.modifiers && obj.modifiers.length > 0, `Object ${ids[i]} must have modifiers`);

      const shellMod = obj.modifiers[0];
      assert.equal(shellMod.type, "solidify");

      const thickness = Number(shellMod.params?.thickness);
      assertNear(thickness, expectedFactors[i], 1e-4);

      // Verify proportionality: thickness / smallestSide must equal 0.05
      const smallestSide = scales[i][0];
      const ratio = thickness / smallestSide;
      assertNear(ratio, 0.05, 1e-4);
    }
  });

  it("light looks scale power proportionally from scene size", () => {
    const doc: MotionDocument = createEmptyDocument();
    doc.objects = {
      light_1: {
        id: "light_1",
        name: "Key Light",
        type: "light",
        dataId: "lit_1",
        transform: {
          location: [0, 5, 0],
          rotationQuat: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
      },
      // Target object 10m away
      target_box: {
        id: "target_box",
        name: "Box",
        type: "mesh",
        transform: {
          location: [10, 0, 0],
          rotationQuat: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
      },
    };
    doc.lights = {
      lit_1: {
        id: "lit_1",
        name: "Light",
        type: "point",
        color: "#ffffff",
        intensity: 10,
      },
    };

    const sceneSize = getSceneSize(doc);
    assert.ok(sceneSize >= 10, "Scene size must reflect bounding span");

    const nextDoc = applyLook(doc, ["light_1"], "look_light_three_point");
    const light = nextDoc.lights!["lit_1"];
    assert.ok(light);

    // Three-point light look has sizing factor: 25.0 * sceneSize
    const expectedIntensity = sceneSize * 25.0;
    assertNear(light.intensity, expectedIntensity, 1e-4);
  });

  it("user look save then apply round-trips exactly", () => {
    const doc: MotionDocument = createEmptyDocument();
    doc.objects = {
      cube_1: makeDocWithCube([1, 1, 1], "cube_1"),
    };
    doc.materials = {};

    const customLook: Look3d = {
      id: "look_user_anodized_orange",
      name: "Anodized Orange",
      section: "material",
      values: {
        baseColor: "#ea580c",
        metallic: 0.85,
        roughness: 0.22,
        emissive: "#000000",
        emissiveIntensity: 0,
        opacity: 1.0,
        wireframe: false,
      },
    };

    // Save in document
    doc.looks = {
      [customLook.id]: customLook,
    };

    // Apply saved look to cube
    const appliedDoc = applyLook(doc, ["cube_1"], "look_user_anodized_orange");
    const obj = appliedDoc.objects!["cube_1"];
    const matId = obj.materialSlots![0];
    const mat = appliedDoc.materials![matId];

    assert.ok(mat, "Material must be created and assigned");
    assert.equal(mat.baseColor, "#ea580c");
    assertNear(mat.metallic, 0.85);
    assertNear(mat.roughness, 0.22);
    assert.equal(mat.wireframe, false);
  });

  it("built-in material looks have correct physical PBR properties", () => {
    const doc: MotionDocument = createEmptyDocument();
    doc.objects = {
      sphere_1: makeDocWithCube([1, 1, 1], "sphere_1"),
    };
    doc.materials = {};

    // Glossy plastic: high specular, low roughness
    const glossyDoc = applyLook(doc, ["sphere_1"], "look_mat_glossy_plastic");
    const glossyMatId = glossyDoc.objects!["sphere_1"].materialSlots![0];
    const glossyMat = glossyDoc.materials![glossyMatId];
    assert.equal(glossyMat.baseColor, "#3b82f6");
    assertNear(glossyMat.roughness, 0.1);
    assertNear(glossyMat.metallic, 0.0);

    // Brushed metal: high metallic
    const metalDoc = applyLook(doc, ["sphere_1"], "look_mat_brushed_metal");
    const metalMatId = metalDoc.objects!["sphere_1"].materialSlots![0];
    const metalMat = metalDoc.materials![metalMatId];
    assertNear(metalMat.metallic, 0.95);
    assertNear(metalMat.roughness, 0.35);

    // Glow: emissive intensity
    const glowDoc = applyLook(doc, ["sphere_1"], "look_mat_glow");
    const glowMatId = glowDoc.objects!["sphere_1"].materialSlots![0];
    const glowMat = glowDoc.materials![glowMatId];
    assert.equal(glowMat.emissive, "#38bdf8");
    assertNear(glowMat.emissiveIntensity ?? 0, 2.5);
  });
});
