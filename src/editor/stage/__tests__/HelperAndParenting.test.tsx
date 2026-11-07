import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLayer } from "@/core/document/factories";
import type { Layer } from "@/core/document/schema";
import { computeComposedWorldMatrix, formatCssMatrix, applyAffineMatrix, type AffineMatrix2D } from "@/core/geometry/parentTransforms";

describe("Phase 73: Stage Helper & Parenting Integration", () => {
  it("computes composed parent transform matrix in stage matching kernel evaluate()", () => {
    // Parent rotated 90° with translation [100, 200]
    const parent = createLayer({
      id: "p1",
      archetype: "container",
      properties: {
        "frame.x": 0,
        "frame.y": 0,
        "frame.width": 200,
        "frame.height": 200,
        "transform.x": 100,
        "transform.y": 200,
        "transform.rotate": 90,
      },
    }) as Layer;

    // Child with local position [50, 0]
    const child = createLayer({
      id: "c1",
      archetype: "rectangle",
      parentRef: "p1",
      properties: {
        "frame.x": 50,
        "frame.y": 0,
        "frame.width": 100,
        "frame.height": 60,
        "transform.origin": "top left",
      },
    }) as Layer;

    const layers = { p1: parent, c1: child };

    const worldM = computeComposedWorldMatrix(layers, "c1");

    // Parent is rotated 90° about center [100, 100], translated [100, 200].
    // Child top-left [50, 0] transformed by world matrix:
    const pt = applyAffineMatrix(worldM, [0, 0]);

    // Parent center [100, 100]. Point [50, 0] relative to center: delta [-50, -100].
    // Rotated 90° clockwise: [-50, -100] -> [100, -50].
    // Plus center [100, 100] + translation [100, 200] = [300, 250].
    assert.ok(Math.abs(pt[0] - 300) < 0.1, `Expected x near 300, got ${pt[0]}`);
    assert.ok(Math.abs(pt[1] - 250) < 0.1, `Expected y near 250, got ${pt[1]}`);

    // CSS matrix format
    const css = formatCssMatrix(worldM);
    assert.match(css, /^matrix\(/);
  });
});
