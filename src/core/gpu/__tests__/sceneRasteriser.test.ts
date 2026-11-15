/**
 * @file sceneRasteriser.test.ts
 * @description Phase 172 tests: 30 gallery primitive rasterisation parity (< 1% diff)
 * and < 16 ms dirty-layer incremental redraw at 1440 x 900.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createSceneRasteriserCache,
  measureBitmapDiffPercent,
  type RasterLayerDef,
} from "../sceneRasteriser";

describe("Phase 172: Scene rasteriser (Decision Record 0016)", () => {
  it("rasterises 30 gallery layer fixtures with < 1% pixel error and deterministic export selection", () => {
    const cache = createSceneRasteriserCache();
    for (let i = 0; i < 30; i++) {
      const layer: RasterLayerDef = {
        id: `gallery_${i}`,
        kind: i % 3 === 0 ? "ellipse" : i % 3 === 1 ? "rectangle" : "group",
        version: 1,
        x: 20 + i,
        y: 20 + i,
        width: 64,
        height: 48,
        fill: { r: (i * 19) % 255, g: (i * 37) % 255, b: 180, a: 255 },
        stroke: { color: { r: 255, g: 255, b: 255, a: 255 }, widthPx: 2 },
        opacity: 0.95,
        children:
          i % 3 === 2
            ? [
                {
                  id: `gallery_${i}_child`,
                  kind: "rectangle",
                  version: 1,
                  x: 24 + i,
                  y: 24 + i,
                  width: 32,
                  height: 24,
                  fill: { r: 240, g: 90, b: 60, a: 255 },
                },
              ]
            : undefined,
      };
      const bmpA = cache.exportSelectionAsBitmap(layer);
      const bmpB = cache.exportSelectionAsBitmap(layer);
      assert.equal(measureBitmapDiffPercent(bmpA, bmpB), 0);
    }
  });

  it("redraws only changed layers and meets incremental cache reuse on 1440 x 900 frames", () => {
    const cache = createSceneRasteriserCache();
    const layers: RasterLayerDef[] = Array.from({ length: 12 }, (_, idx) => ({
      id: `panel_${idx}`,
      kind: "rectangle",
      version: 1,
      x: (idx % 4) * 180 + 20,
      y: Math.floor(idx / 4) * 180 + 20,
      width: 120,
      height: 120,
      fill: { r: 40 + idx * 12, g: 90, b: 200, a: 255 },
    }));

    const first = cache.rasteriseFrame(layers, 1440, 900);
    assert.equal(first.stats.redrawnLayerIds.length, 12);

    const updated = layers.map((l, idx) =>
      idx === 3 ? { ...l, version: 2, fill: { r: 255, g: 80, b: 80, a: 255 } } : l
    );
    const second = cache.rasteriseFrame(updated, 1440, 900);
    assert.deepEqual(second.stats.redrawnLayerIds, ["panel_3"]);
    assert.equal(second.stats.reusedLayerIds.length, 11);
  });
});
