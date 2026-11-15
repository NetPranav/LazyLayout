import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLayerTextureSdfRegistry } from "../layerTexturesAndSdf";
import { createSceneRasteriserCache } from "../sceneRasteriser";
import {
  evaluateLiquidGlassOverlay,
  resolveGlassRenderStrategy,
} from "../liquidGlass";

function makeCheckerBackdrop(width = 160, height = 100) {
  const raster = createSceneRasteriserCache();
  const { bitmap } = raster.rasteriseFrame(
    [
      {
        id: "bg",
        kind: "rectangle",
        version: 1,
        x: 0,
        y: 0,
        width,
        height,
        fill: { r: 24, g: 30, b: 48, a: 255 },
      },
      {
        id: "accent-bar",
        kind: "rectangle",
        version: 1,
        x: 10,
        y: 25,
        width: 140,
        height: 18,
        fill: { r: 245, g: 95, b: 70, a: 255 },
      },
      {
        id: "mint-pill",
        kind: "ellipse",
        version: 1,
        x: 45,
        y: 52,
        width: 70,
        height: 28,
        fill: { r: 64, g: 220, b: 170, a: 255 },
      },
    ],
    width,
    height
  );
  return bitmap;
}

describe("Phase 181: Backdrop sampling & liquid glass", () => {
  it("selects backdrop-filter fast path for frosted panels without refraction and SDF rasteriser for liquid glass", () => {
    const frostedFast = resolveGlassRenderStrategy({
      preset: "frosted_panel",
      supportsBackdropFilter: true,
      tier: "T2",
      blurRadiusPx: 14,
      refractionStrengthPx: 0,
    });
    assert.equal(frostedFast.backend, "css_backdrop_filter");
    assert.ok(frostedFast.cssBackdropFilter?.includes("blur(14px)"));

    const liquidAlwaysRaster = resolveGlassRenderStrategy({
      preset: "liquid_glass",
      supportsBackdropFilter: true,
      tier: "T3",
    });
    assert.equal(liquidAlwaysRaster.backend, "sdf_rasteriser");
    assert.ok(liquidAlwaysRaster.effectiveRefractionPx > 0);
    assert.ok(liquidAlwaysRaster.chromaticDispersionPx > 0);

    const lowTierFallback = resolveGlassRenderStrategy({
      preset: "liquid_glass",
      supportsBackdropFilter: true,
      tier: "T0",
    });
    assert.equal(lowTierFallback.backend, "low_tier_blur_fallback");
    assert.equal(lowTierFallback.effectiveRefractionPx, 0);
    assert.ok(lowTierFallback.effectiveBlurPx <= 4);
  });

  it("bends and tints backdrop content along layer SDF bevels with edge rim highlight", () => {
    const reg = createLayerTextureSdfRegistry("p181-glass");
    try {
      const backdrop = makeCheckerBackdrop();
      const glassSdf = reg.updateLayer({
        id: "glass-pill",
        kind: "ellipse",
        version: 1,
        x: 0,
        y: 0,
        width: 80,
        height: 50,
      });

      const res = evaluateLiquidGlassOverlay(backdrop, glassSdf, {
        preset: "liquid_glass",
        offsetX: 40,
        offsetY: 20,
        blurRadiusPx: 3,
        refractionStrengthPx: 14,
        tier: "T3",
      });

      assert.equal(res.strategy.backend, "sdf_rasteriser");
      assert.ok(res.coveredPixelCount > 2500);
      assert.ok(res.refractedPixelCount > 400);
      assert.ok(res.rimHighlightPixelCount > 100);

      // Corner outside the ellipse SDF must stay transparent
      assert.equal(res.bitmap.data[3], 0);

      // Inside pixel near bevel must be opaque and lit
      const midIdx = (25 * 80 + 40) * 4;
      assert.equal(res.bitmap.data[midIdx + 3], 255);
    } finally {
      reg.unmountAll();
    }
  });

  it("magnifier lens magnifies central backdrop circle and low-tier degrades safely", () => {
    const reg = createLayerTextureSdfRegistry("p181-mag");
    try {
      const backdrop = makeCheckerBackdrop();
      const lensSdf = reg.updateLayer({
        id: "lens",
        kind: "ellipse",
        version: 1,
        x: 0,
        y: 0,
        width: 60,
        height: 60,
      });

      const mag = evaluateLiquidGlassOverlay(backdrop, lensSdf, {
        preset: "magnifier_lens",
        offsetX: 50,
        offsetY: 16,
        magnification: 2.0,
        tier: "T2",
      });
      assert.ok(mag.refractedPixelCount > 1000);

      const frostedFallback = evaluateLiquidGlassOverlay(backdrop, lensSdf, {
        preset: "frosted_panel",
        offsetX: 50,
        offsetY: 16,
        supportsBackdropFilter: false,
        tier: "T0",
      });
      assert.equal(frostedFallback.strategy.backend, "low_tier_blur_fallback");
      assert.equal(frostedFallback.refractedPixelCount, 0);
    } finally {
      reg.unmountAll();
    }
  });
});
