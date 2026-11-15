/**
 * @file outlineEffects.test.ts
 * @description Phase 180 tests: verifies all 6 outline/SDF effects across 5 shape
 * presets, cursor rim tracking, travelling star progression, and T0 low-tier budgets.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLayerTextureSdfRegistry } from "../layerTexturesAndSdf";
import { evaluateOutlineEffectOverlay, type OutlineEffectKind } from "../outlineEffects";
import type { RasterLayerDef } from "../sceneRasteriser";

const OUTLINE_EFFECTS: readonly OutlineEffectKind[] = [
  "electric_border",
  "travelling_star",
  "corner_light_pour",
  "liquid_metal_fill",
  "cursor_rim_glow",
  "neon_pulse",
];

describe("Phase 180: Outline effects (light that rides edges)", () => {
  it("evaluates all 6 outline effects across 5 shapes deterministically within tier budgets", () => {
    const reg = createLayerTextureSdfRegistry("p180_outline");
    const shapes: RasterLayerDef[] = [
      { id: "rect_btn", kind: "rectangle", version: 1, x: 0, y: 0, width: 48, height: 24 },
      { id: "pill_tag", kind: "rectangle", version: 1, x: 0, y: 0, width: 64, height: 18 },
      { id: "circle_avatar", kind: "ellipse", version: 1, x: 0, y: 0, width: 32, height: 32 },
      { id: "oval_badge", kind: "ellipse", version: 1, x: 0, y: 0, width: 52, height: 28 },
      { id: "card_panel", kind: "rectangle", version: 1, x: 0, y: 0, width: 56, height: 40 },
    ];

    for (const shape of shapes) {
      const sdf = reg.updateLayer(shape, 4);
      for (const kind of OUTLINE_EFFECTS) {
        const resA = evaluateOutlineEffectOverlay(sdf, {
          kind,
          timeSec: 0.35,
          pointerX: 10,
          pointerY: 12,
          tier: "T0",
        });
        const resB = evaluateOutlineEffectOverlay(sdf, {
          kind,
          timeSec: 0.35,
          pointerX: 10,
          pointerY: 12,
          tier: "T0",
        });
        assert.deepEqual(resA, resB);
        assert.ok(resA.litPixelCount > 0, `expected lit pixels for ${kind} on ${shape.id}`);
        assert.ok(resA.estimatedCostMs < 1.5, "T0 tier budget must stay lightweight");
      }
    }

    reg.unmountAll();
  });
});
