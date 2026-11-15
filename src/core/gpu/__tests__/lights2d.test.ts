import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLayerTextureSdfRegistry } from "../layerTexturesAndSdf";
import {
  evaluateLayer2dLighting,
  resolveLightsForCursor,
  sampleSurfaceNormal,
  type Light2dSpec,
} from "../lights2d";

describe("Phase 182: 2D lights & surface depth", () => {
  it("computes embossed SDF edge normals vs flat normals and normal maps", () => {
    const reg = createLayerTextureSdfRegistry("p182-normals");
    try {
      const card = reg.updateLayer({
        id: "card",
        kind: "rectangle",
        version: 1,
        x: 0,
        y: 0,
        width: 80,
        height: 50,
        fill: { r: 70, g: 85, b: 120, a: 255 },
      });

      const flatN = sampleSurfaceNormal(card, { mode: "flat" }, 3, 25);
      assert.deepEqual(flatN, [0, 0, 1]);

      const bevelN = sampleSurfaceNormal(card, { mode: "embossed", embossDepthPx: 12 }, 3, 25);
      assert.ok(bevelN[0] < -0.1, "left inner bevel normal points left (-X)");
      assert.ok(bevelN[2] > 0.2);

      // Custom tangent-space normal map tilted +X
      const nmData = new Uint8ClampedArray([220, 128, 220, 255]);
      const customN = sampleSurfaceNormal(
        card,
        { mode: "normal_map", normalMap: { width: 1, height: 1, data: nmData } },
        10,
        10
      );
      assert.ok(customN[0] > 0.4);
    } finally {
      reg.unmountAll();
    }
  });

  it("moves cursor-following point & spot lights across embossed cards with highlights and shadows", () => {
    const reg = createLayerTextureSdfRegistry("p182-scene");
    try {
      const card = reg.updateLayer({
        id: "card-1",
        kind: "rectangle",
        version: 1,
        x: 0,
        y: 0,
        width: 90,
        height: 60,
        fill: { r: 50, g: 64, b: 92, a: 255 },
      });

      const lights: Light2dSpec[] = [
        {
          id: "cursor-point",
          kind: "point",
          x: 0,
          y: 0,
          z: 36,
          radiusPx: 140,
          color: { r: 255, g: 245, b: 220, a: 255 },
          intensity: 1.2,
          followCursor: true,
          castSoftShadow: true,
        },
        {
          id: "spot-key",
          kind: "spot",
          x: 20,
          y: 20,
          z: 50,
          radiusPx: 200,
          color: { r: 160, g: 210, b: 255, a: 255 },
          intensity: 1.0,
          spotDirX: 0.7,
          spotDirY: 0.7,
          spotInnerCos: 0.85,
          spotOuterCos: 0.5,
        },
      ];

      const frameA = evaluateLayer2dLighting(
        { layerId: "card-1", sdf: card, surface: { mode: "embossed", embossDepthPx: 10 }, offsetX: 10, offsetY: 10 },
        resolveLightsForCursor(lights, 35, 35),
        "T2"
      );
      const frameB = evaluateLayer2dLighting(
        { layerId: "card-1", sdf: card, surface: { mode: "embossed", embossDepthPx: 10 }, offsetX: 10, offsetY: 10 },
        resolveLightsForCursor(lights, 92, 62),
        "T2"
      );

      assert.ok(frameA.litPixelCount > 50);
      assert.ok(frameA.highlightPeak > 0.2);
      assert.ok(frameA.shadowedPixelCount > 0);
      assert.notDeepEqual(frameA.bitmap.data, frameB.bitmap.data);
    } finally {
      reg.unmountAll();
    }
  });

  it("evaluates 20 lit layers cleanly within a mid-tier 60fps budget check", () => {
    const reg = createLayerTextureSdfRegistry("p182-bench");
    try {
      const card = reg.updateLayer({
        id: "tile",
        kind: "rectangle",
        version: 1,
        x: 0,
        y: 0,
        width: 48,
        height: 36,
        fill: { r: 60, g: 70, b: 90, a: 255 },
      });
      const light: Light2dSpec = {
        id: "cursor",
        kind: "point",
        x: 120,
        y: 80,
        z: 40,
        radiusPx: 220,
        color: { r: 255, g: 255, b: 255, a: 255 },
        intensity: 1.0,
      };
      const t0 = performance.now();
      for (let i = 0; i < 20; i += 1) {
        const res = evaluateLayer2dLighting(
          {
            layerId: `tile-${i}`,
            sdf: card,
            surface: { mode: "embossed", embossDepthPx: 8 },
            offsetX: (i % 5) * 52,
            offsetY: Math.floor(i / 5) * 40,
          },
          [light],
          "T2"
        );
        assert.equal(res.bitmap.width, 48);
      }
      const elapsedMs = performance.now() - t0;
      assert.ok(elapsedMs < 200, `20 lit layers CPU evaluation expected well under 200ms, got ${elapsedMs.toFixed(1)}ms`);
    } finally {
      reg.unmountAll();
    }
  });
});
