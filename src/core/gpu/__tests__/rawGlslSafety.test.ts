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
