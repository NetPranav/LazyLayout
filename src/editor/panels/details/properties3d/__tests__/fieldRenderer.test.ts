import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { inspectZodSchema } from "../FieldRenderer";
import {
  Material3dSchema,
  Light3dSchema,
  Camera3dSchema,
} from "@/core/document/scene3d";

describe("Phase 3D-022: Generic Zod v4 Field Renderer Introspection", () => {
  it("unwraps primitive number schemas with min, max, and defaults", () => {
    const numSchema = z.number().min(0).max(100).default(50);
    const meta = inspectZodSchema(numSchema, "amount");

    assert.equal(meta.type, "number");
    assert.equal(meta.min, 0);
    assert.equal(meta.max, 100);
    assert.equal(meta.default, 50);
  });

  it("identifies color fields based on field naming convention", () => {
    const colorStr = z.string().default("#ff0000");
    const metaColor = inspectZodSchema(colorStr, "baseColor");
    assert.equal(metaColor.type, "color");

    const regularStr = z.string().default("Hello");
    const metaStr = inspectZodSchema(regularStr, "title");
    assert.equal(metaStr.type, "string");
  });

  it("introspects boolean and enum schemas with options list", () => {
    const boolSchema = z.boolean().default(true);
    const metaBool = inspectZodSchema(boolSchema, "enabled");
    assert.equal(metaBool.type, "boolean");
    assert.equal(metaBool.default, true);

    const enumSchema = z.enum(["point", "sun", "spot", "area"]);
    const metaEnum = inspectZodSchema(enumSchema, "type");
    assert.equal(metaEnum.type, "enum");
    assert.deepEqual(metaEnum.options, ["point", "sun", "spot", "area"]);
  });

  it("detects 3-element tuples as vector3 and 4-element tuples as quaternion", () => {
    const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
    const metaVec = inspectZodSchema(vec3Schema, "location");
    assert.equal(metaVec.type, "vector3");

    const quatSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
    const metaQuat = inspectZodSchema(quatSchema, "rotationQuat");
    assert.equal(metaQuat.type, "quaternion");
  });

  it("handles optional, nullable, and piped schemas cleanly", () => {
    const optNum = z.number().min(5).optional();
    const meta = inspectZodSchema(optNum, "optionalNumber");
    assert.equal(meta.type, "number");
    assert.equal(meta.min, 5);
  });

  it("correctly introspects canonical 3D data block schemas", () => {
    // Material3dSchema
    const matShape = Material3dSchema.shape;
    const baseColorMeta = inspectZodSchema(matShape.baseColor, "baseColor");
    assert.equal(baseColorMeta.type, "color");

    const roughnessMeta = inspectZodSchema(matShape.roughness, "roughness");
    assert.equal(roughnessMeta.type, "number");
    assert.equal(roughnessMeta.min, 0);
    assert.equal(roughnessMeta.max, 1);

    const wireframeMeta = inspectZodSchema(matShape.wireframe, "wireframe");
    assert.equal(wireframeMeta.type, "boolean");

    // Light3dSchema
    const lightShape = Light3dSchema.shape;
    const lightTypeMeta = inspectZodSchema(lightShape.type, "type");
    assert.equal(lightTypeMeta.type, "enum");
    assert.ok(lightTypeMeta.options?.includes("spot"));

    // Camera3dSchema
    const camShape = Camera3dSchema.shape;
    const fovMeta = inspectZodSchema(camShape.fov, "fov");
    assert.equal(fovMeta.type, "number");
  });
});
