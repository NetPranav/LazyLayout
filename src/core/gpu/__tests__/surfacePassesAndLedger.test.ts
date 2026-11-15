/**
 * @file surfacePassesAndLedger.test.ts
 * @description Phase 174 tests: pass stack allocation, float fallback to RGBA8,
 * Safari backing limit clamping, and 100x mount/unmount returning GPU ledger to 0.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gpuLedger } from "../ledger";
import {
  SAFARI_MAX_CANVAS_AREA,
  clampSurfaceDimensionsForSafari,
  createSurfacePassStackManager,
  resolvePassTargetFormat,
} from "../surfacePassesAndLedger";

describe("Phase 174: Passes, render targets & GPU memory ledger", () => {
  it("returns GPU memory ledger strictly to 0 across 100 mount/unmount cycles", () => {
    const mgr = createSurfacePassStackManager();
    const ownerPrefix = "phase174_surface_";

    for (let i = 0; i < 100; i++) {
      const ownerId = `${ownerPrefix}${i}`;
      const mounted = mgr.mountOwner(
        ownerId,
        1280,
        720,
        [
          { id: "main", kind: "program", wantFormat: "RGBA16F" },
          { id: "fb", kind: "feedback_pingpong", wantFormat: "RGBA16F" },
          { id: "grain", kind: "grain" },
          { id: "vignette", kind: "vignette" },
          { id: "bloom", kind: "bloom_lite" },
        ],
        { tier: "T2", supportsColorBufferFloat: true }
      );
      assert.ok(mounted.totalOwnerBytes > 0);
      mgr.unmountOwner(ownerId);
      assert.equal(gpuLedger.totalBytes(ownerId), 0);
    }

    assert.equal(gpuLedger.totalBytes(ownerPrefix), 0);
    assert.ok(mgr.getProgramCacheKeys().includes("prog::bloom_lite"));
  });

  it("falls back float targets to RGBA8 when unsupported and clamps Safari dimensions", () => {
    assert.equal(resolvePassTargetFormat("RGBA16F", false), "RGBA8");
    assert.equal(resolvePassTargetFormat("RGBA32F", false), "RGBA8");
    assert.equal(resolvePassTargetFormat("RGBA16F", true), "RGBA16F");

    const clamped = clampSurfaceDimensionsForSafari(8000, 4000);
    assert.ok(clamped.width * clamped.height <= SAFARI_MAX_CANVAS_AREA);
  });
});
