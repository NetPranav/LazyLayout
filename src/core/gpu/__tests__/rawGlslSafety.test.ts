/**
 * @file rawGlslSafety.test.ts
 * @description Phase 178 tests: rejects unbounded loops at compile time, enforces
 * texture fetch budgets, parses GLSL error lines, extracts uniforms into props,
 * and disables programs after 2 context losses.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createShaderSafetyCircuitBreaker,
  parseGlslInfoLog,
  validateRawGlslSafety,
} from "../rawGlslSafety";

describe("Phase 178: Raw GLSL Pro & shader safety", () => {
  it("refuses unbounded loops at compile validation time while accepting bounded constant loops", () => {
    const safeShader = `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uGlowColor;
      void main() {
        float sum = 0.0;
        for (int i = 0; i < 8; i++) {
          sum += float(i) * uIntensity;
        }
      }
    `;
    const okRes = validateRawGlslSafety(safeShader);
    assert.equal(okRes.ok, true);
    assert.equal(okRes.maxLoopIterationsDetected, 8);
    assert.equal(okRes.uniformProps.length, 2);

    const unboundedFor = `
      uniform int uSteps;
      void main() {
        for (int i = 0; i < uSteps; i++) {}
      }
    `;
    const badFor = validateRawGlslSafety(unboundedFor);
    assert.equal(badFor.ok, false);
    assert.equal(badFor.diagnostics[0]!.line, 4);

    const whileLoop = `void main() { while (true) {} }`;
    assert.equal(validateRawGlslSafety(whileLoop).ok, false);
  });

  it("maps GLSL compiler info logs to line numbers and enforces 2-strike context loss disable", () => {
    const diags = parseGlslInfoLog(`ERROR: 0:14: 'foo' : undeclared identifier`);
    assert.equal(diags[0]!.line, 14);
    assert.equal(diags[0]!.severity, "error");

    const breaker = createShaderSafetyCircuitBreaker(2);
    assert.equal(breaker.recordContextLoss("prog_custom").disabled, false);
    assert.equal(breaker.recordContextLoss("prog_custom").disabled, true);
    assert.equal(breaker.isProgramDisabled("prog_custom"), true);
  });
});

describe("Phase 178 · loops and fetches that used to slip through (review 2026-11-17)", () => {
  it("rejects nested loops whose total iterations exceed the limit", () => {
    const nested = [
      "void main() {",
      "  for (int i = 0; i < 128; i++) {",
      "    for (int j = 0; j < 128; j++) {",
      "      for (int k = 0; k < 128; k++) {",
      "      }",
      "    }",
      "  }",
      "}",
    ].join("\n");
    const res = validateRawGlslSafety(nested);
    assert.equal(res.ok, false);
    assert.equal(res.maxLoopIterationsDetected, 128 * 128 * 128);
  });

  it("rejects a step that never moves, a counter changed in the body, a split header and #define", () => {
    assert.equal(validateRawGlslSafety("void main() { for (int i = 0; i < 8; i += 0) {} }").ok, false);
    assert.equal(validateRawGlslSafety("void main() {\n for (int i = 0; i < 8; i++) {\n  i = 0;\n }\n}").ok, false);
    assert.equal(validateRawGlslSafety("void main() {\n for (int i = 0;\n i < 8; i++) {}\n}").ok, false);
    assert.equal(validateRawGlslSafety("#define N 100000\nvoid main() {}").ok, false);
  });

  it("counts a texture fetch once per loop iteration", () => {
    const res = validateRawGlslSafety("uniform sampler2D t;\nvoid main() {\n for (int i = 0; i < 8; i++) {\n  vec4 c = texture(t, vec2(0.0));\n }\n}");
    assert.equal(res.textureFetches, 8);
    assert.equal(res.ok, true);
    const heavy = validateRawGlslSafety("uniform sampler2D t;\nvoid main() {\n for (int i = 0; i < 64; i++) {\n  vec4 c = texture(t, vec2(0.0));\n }\n}");
    assert.equal(heavy.ok, false);
  });
});
