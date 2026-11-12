import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  is3DPath,
  parse3DPath,
  format3DPath,
  get3DInterpolationMethod,
  apply3DProperty,
  get3DProperty,
} from "../paths";

describe("Phase 3D-010: 3D Property Paths", () => {
  it("detects valid 3D path prefixes with is3DPath", () => {
    assert.equal(is3DPath("3d:objects/cube1/transform.location.x"), true);
    assert.equal(is3DPath("3d:materials/mat1/roughness"), true);
    assert.equal(is3DPath("transform.x"), false);
    assert.equal(is3DPath("appearance.opacity"), false);
    assert.equal(is3DPath(""), false);
  });

  it("parses valid paths from the spec cleanly", () => {
    const p1 = parse3DPath("3d:objects/box_01/transform.location.x");
    assert.deepEqual(p1, {
      ok: true,
      table: "objects",
      id: "box_01",
      rest: "transform.location.x",
    });

    const p2 = parse3DPath("3d:materials/mat_gold/roughness");
    assert.deepEqual(p2, {
      ok: true,
      table: "materials",
      id: "mat_gold",
      rest: "roughness",
    });

    const p3 = parse3DPath("3d:lights/sun_01/intensity");
    assert.deepEqual(p3, {
      ok: true,
      table: "lights",
      id: "sun_01",
      rest: "intensity",
    });

    const p4 = parse3DPath("3d:cameras/cam_main/fov");
    assert.deepEqual(p4, {
      ok: true,
      table: "cameras",
      id: "cam_main",
      rest: "fov",
    });

    const p5 = parse3DPath("3d:meshes/char_mesh/shapeKeys/Smile");
    assert.deepEqual(p5, {
      ok: true,
      table: "meshes",
      id: "char_mesh",
      rest: "shapeKeys/Smile",
    });

    const p6 = parse3DPath("3d:objects/hero/modifiers/subsurf_1/levels");
    assert.deepEqual(p6, {
      ok: true,
      table: "objects",
      id: "hero",
      rest: "modifiers/subsurf_1/levels",
    });
  });

  it("handles singular table aliases gracefully", () => {
    const res = parse3DPath("3d:object/cube/transform.location.y");
    assert.deepEqual(res, {
      ok: true,
      table: "objects",
      id: "cube",
      rest: "transform.location.y",
    });
  });

  it("rejects invalid paths with descriptive errors", () => {
    // Missing 3d: prefix
    const err1 = parse3DPath("objects/cube/transform.location.x");
    assert.equal(err1.ok, false);
    if (!err1.ok) assert.match(err1.error, /3d:/);

    // Missing slashes
    const err2 = parse3DPath("3d:objects");
    assert.equal(err2.ok, false);

    // Unknown table
    const err3 = parse3DPath("3d:foobar/cube/property");
    assert.equal(err3.ok, false);
    if (!err3.ok) assert.match(err3.error, /Unknown 3D table/);

    // Empty id
    const err4 = parse3DPath("3d:objects//property");
    assert.equal(err4.ok, false);
    if (!err4.ok) assert.match(err4.error, /Entity id cannot be empty/);

    // Empty rest
    const err5 = parse3DPath("3d:objects/cube/");
    assert.equal(err5.ok, false);
    if (!err5.ok) assert.match(err5.error, /Property path cannot be empty/);
  });

  it("formats canonical 3D paths with format3DPath", () => {
    const formatted = format3DPath("materials", "mat123", "roughness");
    assert.equal(formatted, "3d:materials/mat123/roughness");
  });

  it("derives the correct interpolation method for 3D properties", () => {
    // Quaternion -> slerp (dot and slash forms)
    assert.equal(get3DInterpolationMethod("3d:objects/cube/transform.rotationQuat"), "slerp");
    assert.equal(get3DInterpolationMethod("3d:objects/cube/rotationQuat"), "slerp");
    assert.equal(get3DInterpolationMethod("any.path", [0, 0, 0, 1], [0, 1, 0, 0]), "slerp");

    // Colors -> color (dot and slash forms)
    assert.equal(get3DInterpolationMethod("3d:materials/m/baseColor"), "color");
    assert.equal(get3DInterpolationMethod("3d:materials/m/emissive"), "color");
    assert.equal(get3DInterpolationMethod("3d:lights/l/color"), "color");

    // Vectors -> vector
    assert.equal(get3DInterpolationMethod("3d:objects/o/transform.location", [0, 0, 0], [1, 2, 3]), "vector");
    assert.equal(get3DInterpolationMethod("3d:objects/o/transform.scale", [1, 1, 1], [2, 2, 2]), "vector");

    // Scalars -> numeric (slash forms directly targeting data-block properties)
    assert.equal(get3DInterpolationMethod("3d:lights/l/intensity"), "numeric");
    assert.equal(get3DInterpolationMethod("3d:materials/m/roughness"), "numeric");
    assert.equal(get3DInterpolationMethod("3d:materials/m/metallic"), "numeric");
    assert.equal(get3DInterpolationMethod("3d:materials/m/opacity"), "numeric");
    assert.equal(get3DInterpolationMethod("3d:cameras/c/fov"), "numeric");
    assert.equal(get3DInterpolationMethod("3d:cameras/c/near"), "numeric");
    assert.equal(get3DInterpolationMethod("3d:cameras/c/far"), "numeric");
    assert.equal(get3DInterpolationMethod("3d:scenes/s/unitScale"), "numeric");

    // Scalars -> numeric (dot coordinate paths)
    assert.equal(get3DInterpolationMethod("3d:objects/o/transform.location.x"), "numeric");
    assert.equal(get3DInterpolationMethod("3d:objects/o/transform.location.y"), "numeric");
    assert.equal(get3DInterpolationMethod("3d:objects/o/transform.location.z"), "numeric");
    assert.equal(get3DInterpolationMethod("3d:objects/o/transform.rotationEuler.x"), "numeric");
    assert.equal(get3DInterpolationMethod("3d:objects/o/transform.rotationEuler.y"), "numeric");
    assert.equal(get3DInterpolationMethod("3d:objects/o/transform.rotationEuler.z"), "numeric");

    // Discrete
    assert.equal(get3DInterpolationMethod("3d:objects/o/visible", true, false), "discrete");
  });

  it("applies and retrieves 3D properties correctly", () => {
    const obj: Record<string, unknown> = {
      id: "box",
      transform: {
        location: [0, 0, 0],
        rotationQuat: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
    };

    apply3DProperty(obj, "transform.location.x", 10.5);
    assert.equal(get3DProperty(obj, "transform.location.x"), 10.5);
    assert.deepEqual((obj.transform as { location: number[] }).location, [10.5, 0, 0]);

    apply3DProperty(obj, "transform.scale", [2, 3, 4]);
    assert.deepEqual(get3DProperty(obj, "transform.scale"), [2, 3, 4]);

    apply3DProperty(obj, "modifiers/mod1/strength", 0.75);
    assert.equal(get3DProperty(obj, "modifiers/mod1/strength"), 0.75);

    apply3DProperty(obj, "shapeKeys/Blink", 0.9);
    assert.equal(get3DProperty(obj, "shapeKeys/Blink"), 0.9);
  });
});
