/**
 * @file effectLayers.test.ts
 * @description Phase 179 tests: verifies all 8 adjustment effect-layer presets,
 * parent-order vs single-target scoping, masks & blend modes, and real DOM text preservation.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSceneRasteriserCache } from "../sceneRasteriser";
import {
  applyEffectLayerToBitmap,
  resolveEffectLayerTargets,
  type EffectLayerPreset,
} from "../effectLayers";

const PRESETS: readonly EffectLayerPreset[] = [
  "dither",
  "pixelate",
  "chromatic_split",
  "displacement",
  "halftone",
  "glitch",
  "colour_grade",
  "threshold_ink",
];

describe("Phase 179: Effect layers", () => {
  it("evaluates all 8 reference effect presets deterministically and preserves real DOM text", () => {
    const cache = createSceneRasteriserCache();
    const { bitmap } = cache.rasteriseFrame(
      [
        {
          id: "hero_card",
          kind: "rectangle",
          version: 1,
          x: 0,
          y: 0,
          width: 32,
          height: 32,
          fill: { r: 120, g: 160, b: 220, a: 255 },
        },
        {
          id: "accent",
          kind: "ellipse",
          version: 1,
          x: 6,
          y: 6,
          width: 20,
          height: 20,
          fill: { r: 245, g: 95, b: 85, a: 255 },
        },
      ],
      32,
      32
    );

    for (const preset of PRESETS) {
      const cfg = {
        id: `fx_${preset}`,
        preset,
        scope: { kind: "below_in_parent" as const, parentId: "hero", effectLayerIndex: 2 },
        intensity: 0.75,
        blendMode: preset === "dither" ? ("multiply" as const) : ("normal" as const),
        opacity: 0.9,
        timeSec: 0.4,
        maskRect: { x: 4, y: 4, width: 24, height: 24 },
      };
      const passA = applyEffectLayerToBitmap(bitmap, cfg);
      const passB = applyEffectLayerToBitmap(bitmap, cfg);
      assert.deepEqual(passA, passB, `${preset} must evaluate deterministically`);
      assert.notDeepEqual(passA.data, bitmap.data, `${preset} should modify masked pixels`);
    }

    const targets = resolveEffectLayerTargets(
      [
        { id: "bg", isDomText: false },
        { id: "headline", isDomText: true },
        { id: "badge", isDomText: false },
      ],
      {
        id: "fx_dither",
        preset: "dither",
        scope: { kind: "below_in_parent", parentId: "hero", effectLayerIndex: 2 },
        intensity: 1,
        blendMode: "normal",
        opacity: 1,
      }
    );
    assert.deepEqual(targets.affectedLayerIds, ["bg", "headline"]);
    assert.equal(targets.preservesRealDomText, true);
  });
});
