/**
 * ============================================================================
 * UNIT TESTS: TRANSFORM COMMAND PARSER
 * ============================================================================
 * Phase 3D-016: typed.ts verification
 * Table-driven parser tests for modal transform expressions (G/R/S).
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTransformCommand } from "../typed";

describe("parseTransformCommand", () => {
  it("parses basic translation along X axis with integer value: 'g x 2'", () => {
    const res = parseTransformCommand("g x 2");
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.mode, "translate");
    assert.equal(res.axis, "X");
    assert.equal(res.plane, false);
    assert.equal(res.value, 2);
  });

  it("parses rotation along Z axis with degrees: 'r z 90'", () => {
    const res = parseTransformCommand("r z 90");
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.mode, "rotate");
    assert.equal(res.axis, "Z");
    assert.equal(res.plane, false);
    assert.equal(res.value, 90);
  });

  it("parses uniform scale with scalar: 's 2'", () => {
    const res = parseTransformCommand("s 2");
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.mode, "scale");
    assert.equal(res.axis, undefined);
    assert.equal(res.plane, false);
    assert.equal(res.value, 2);
  });

  it("parses plane-locked translation with trailing enter: 'g shift+z 1.5 enter'", () => {
    const res = parseTransformCommand("g shift+z 1.5 enter");
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.mode, "translate");
    assert.equal(res.axis, "Z");
    assert.equal(res.plane, true);
    assert.equal(res.value, 1.5);
  });

  it("parses separate shift token: 'g shift x 3'", () => {
    const res = parseTransformCommand("g shift x 3");
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.mode, "translate");
    assert.equal(res.axis, "X");
    assert.equal(res.plane, true);
    assert.equal(res.value, 3);
  });

  it("parses negative decimals: 'g y -0.75'", () => {
    const res = parseTransformCommand("g y -0.75");
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.mode, "translate");
    assert.equal(res.axis, "Y");
    assert.equal(res.plane, false);
    assert.equal(res.value, -0.75);
  });

  it("parses full words: 'translate x 5' and 'rotate y 180 return'", () => {
    const res1 = parseTransformCommand("translate x 5");
    assert.equal(res1.ok, true);
    if (res1.ok) {
      assert.equal(res1.mode, "translate");
      assert.equal(res1.axis, "X");
      assert.equal(res1.value, 5);
    }

    const res2 = parseTransformCommand("rotate y 180 return");
    assert.equal(res2.ok, true);
    if (res2.ok) {
      assert.equal(res2.mode, "rotate");
      assert.equal(res2.axis, "Y");
      assert.equal(res2.value, 180);
    }
  });

  it("handles mode-only commands without axis or value: 'g'", () => {
    const res = parseTransformCommand("g");
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.mode, "translate");
    assert.equal(res.axis, undefined);
    assert.equal(res.value, undefined);
  });

  it("returns error without throwing on empty or whitespace strings", () => {
    const res1 = parseTransformCommand("");
    assert.equal(res1.ok, false);
    assert.ok(res1.error);

    const res2 = parseTransformCommand("   ");
    assert.equal(res2.ok, false);
    assert.ok(res2.error);
  });

  it("returns error without throwing on invalid mode or unrecognized tokens", () => {
    const res1 = parseTransformCommand("invalid x 2");
    assert.equal(res1.ok, false);
    assert.ok(res1.error);

    const res2 = parseTransformCommand("g badtoken 2");
    assert.equal(res2.ok, false);
    assert.ok(res2.error);
  });
});
