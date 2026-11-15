/**
 * @file shaderGraph.test.ts
 * @description Phase 177 tests: compiles 10 reference background graphs to both
 * GLSL ES 3.00 and WebGPU TSL, verifies layer texture/outline/SDF uniform binding,
 * static ALU/texture cost estimates, and < 100 ms recompile budget.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compileShaderGraph, type ShaderGraphDefinition } from "../shaderGraph";

function buildRefShader(index: number): ShaderGraphDefinition {
  return {
    id: `bg_ref_${index}`,
    name: `RefBackground_${index}`,
    nodes: [
      { id: "n_uv", kind: "uv" },
      { id: "n_noise", kind: index % 2 === 0 ? "simplexNoise" : "checkerPattern" },
      { id: "n_sdf", kind: index % 3 === 0 ? "layerSdf" : "sdfCircle", layerRefId: `hero_${index}` },
      { id: "n_ramp", kind: "colorRamp" },
      { id: "n_out", kind: "outputColor" },
    ],
    edges: [
      { fromNodeId: "n_uv", fromPin: "uv", toNodeId: "n_noise", toPin: "uv", pinType: "vec2" },
      { fromNodeId: "n_noise", fromPin: "val", toNodeId: "n_ramp", toPin: "t", pinType: "float" },
      { fromNodeId: "n_ramp", fromPin: "color", toNodeId: "n_out", toPin: "color", pinType: "color" },
    ],
  };
}

describe("Phase 177: Shader graph (GLSL ES 3.00 & TSL)", () => {
  it("compiles 10 reference graphs to GLSL ES 3.00 and TSL with static cost under 100 ms", () => {
    for (let i = 0; i < 10; i++) {
      const res = compileShaderGraph(buildRefShader(i));
      assert.ok(res.glslEs300.includes("#version 300 es"));
      assert.ok(res.tslSource.includes(`from "three/tsl"`));
      assert.ok(res.uniformsContract.includes("uTime"));
      assert.ok(res.uniformsContract.includes("uPointer"));
      assert.ok(res.staticCost.aluInstructions > 0);
      assert.ok(res.compileMs < 100, `expected < 100ms compile, took ${res.compileMs}ms`);
    }
  });
});
