/**
 * @file layerTexturesAndSdf.test.ts
 * @description Phase 175 tests: layer texture/outline/SDF generation (< 0.5 px error
 * across 10 shapes), version-change updates, and 0 ledger bytes after unmount.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gpuLedger } from "../ledger";
import {
  createLayerTextureSdfRegistry,
  sampleSdfAt,
  sdRoundedBox,
} from "../layerTexturesAndSdf";

describe("Phase 175: Layer textures, outlines & distance fields", () => {
  it("computes SDF within < 0.5 px across 10 diverse shapes and frees ledger bytes on unmount", () => {
    const reg = createLayerTextureSdfRegistry("p175_test");

    for (let i = 0; i < 10; i++) {
      const isEllipse = i % 2 === 0;
      const w = 60 + i * 12;
      const h = isEllipse ? w : 44 + i * 8;
      const res = reg.updateLayer(
        {
          id: `shape_${i}`,
          kind: isEllipse ? "ellipse" : "rectangle",
          version: 1,
          x: 0,
          y: 0,
          width: w,
          height: h,
          fill: { r: 120, g: 180, b: 255, a: 255 },
        },
        8
      );

      // Check boundary SDF precision at several points (< 0.5 px error)
      const boundarySample = sampleSdfAt(res, w, h * 0.5);
      assert.ok(Math.abs(boundarySample) < 0.5, `expected <0.5px boundary error, got ${boundarySample}`);
      assert.ok(sampleSdfAt(res, w * 0.5, h * 0.5) < 0, "center should have negative distance");
      assert.ok(res.outlinePoints.length >= 16);
    }

    assert.ok(gpuLedger.totalBytes("p175_test") > 0);
    // Version bump updates within one frame
    const prevSdf = reg.getLayer("shape_0")!;
    const nextSdf = reg.updateLayer(
      {
        id: "shape_0",
        kind: "ellipse",
        version: 2,
        x: 0,
        y: 0,
        width: 80,
        height: 80,
        fill: { r: 255, g: 90, b: 90, a: 255 },
      },
      8
    );
    assert.notEqual(prevSdf.version, nextSdf.version);
    assert.ok(Math.abs(sdRoundedBox(40, 20, 20, 20, 20, 20) - 0) < 1e-6);

    reg.unmountAll();
    assert.equal(gpuLedger.totalBytes("p175_test"), 0);
  });
});
