import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLayerTextureSdfRegistry } from "../layerTexturesAndSdf";
import {
  createMediaTextureCacheTracker,
  evaluateMediaDistortion,
  type MediaDistortionKind,
  type MediaSourceKind,
} from "../mediaTextureDistortion";

describe("Phase 187: Media as texture & distortion", () => {
  it("evaluates all 6 distortion presets across image, video_fill, sdf_text, and raster_svg preserving real text/alt", () => {
    const reg = createLayerTextureSdfRegistry("p187-media");
    try {
      const sdf = reg.updateLayer({
        id: "hero-photo",
        kind: "rectangle",
        version: 1,
        x: 0,
        y: 0,
        width: 72,
        height: 48,
        fill: { r: 220, g: 130, b: 95, a: 255 },
      });

      const distortions: MediaDistortionKind[] = [
        "hover_displacement",
        "pixel_dither_transition",
        "grid_wave",
        "halftone_reveal",
        "image_trail",
        "glass_lens",
      ];
      const sources: MediaSourceKind[] = ["image", "video_fill", "sdf_text", "raster_svg"];

      for (let i = 0; i < distortions.length; i += 1) {
        const distortion = distortions[i]!;
        const sourceKind = sources[i % sources.length]!;
        const res = evaluateMediaDistortion(
          {
            layerId: "hero-photo",
            kind: sourceKind,
            sdfResource: sdf,
            fontLoadGeneration: 1,
            width: 72,
            height: 48,
            altText: sourceKind === "image" ? "Studio portrait" : undefined,
            textContent: sourceKind === "sdf_text" ? "Kinetic Display" : undefined,
            videoFillAssetId: sourceKind === "video_fill" ? "clip_99" : undefined,
          },
          {
            kind: distortion,
            pointerX: 36,
            pointerY: 24,
            progress: 0.65,
            intensity: 1,
            timeSec: 0.4,
            tier: "T2",
          }
        );

        assert.ok(res.displacedPixelCount > 20, `${distortion} affected pixels`);
        assert.equal(res.accessibility.domElementPreserved, true);
        assert.equal(res.accessibility.screenReaderReadOnce, true);
        assert.equal(res.accessibility.canvasOverlayAriaHidden, true);
      }
    } finally {
      reg.unmountAll();
    }
  });

  it("triggers texture re-upload on font load or resize and activates CSS/SVG fallback when WebGL is disabled", () => {
    const reg = createLayerTextureSdfRegistry("p187-cache");
    const tracker = createMediaTextureCacheTracker();
    try {
      const sdf = reg.updateLayer({
        id: "headline",
        kind: "text",
        version: 1,
        x: 0,
        y: 0,
        width: 80,
        height: 28,
        fill: { r: 255, g: 255, b: 255, a: 255 },
      });

      const first = evaluateMediaDistortion(
        {
          layerId: "headline",
          kind: "sdf_text",
          sdfResource: sdf,
          fontLoadGeneration: 1,
          width: 80,
          height: 28,
          textContent: "Hello World",
        },
        { kind: "grid_wave", pointerX: 20, pointerY: 14, progress: 0.5, webglEnabled: false },
        tracker
      );
      assert.equal(first.needsTextureReupload, true);
      assert.equal(first.fallback.active, true);
      assert.ok(first.fallback.svgFilterMarkup.includes("feDisplacementMap"));

      const same = evaluateMediaDistortion(
        {
          layerId: "headline",
          kind: "sdf_text",
          sdfResource: sdf,
          fontLoadGeneration: 1,
          width: 80,
          height: 28,
          textContent: "Hello World",
        },
        { kind: "grid_wave", pointerX: 20, pointerY: 14, progress: 0.5, webglEnabled: false },
        tracker
      );
      assert.equal(same.needsTextureReupload, false);

      const fontLoaded = evaluateMediaDistortion(
        {
          layerId: "headline",
          kind: "sdf_text",
          sdfResource: sdf,
          fontLoadGeneration: 2,
          width: 80,
          height: 28,
          textContent: "Hello World",
        },
        { kind: "grid_wave", pointerX: 20, pointerY: 14, progress: 0.5 },
        tracker
      );
      assert.equal(fontLoaded.needsTextureReupload, true);
    } finally {
      reg.unmountAll();
    }
  });
});
