import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLayerTextureSdfRegistry } from "../layerTexturesAndSdf";
import {
  buildDeformedMesh,
  evaluateDeformedPoint,
  rasteriseDeformedLayer,
  type DeformationModifierKind,
} from "../deformationWarpPeel";

describe("Phase 185: Deformation (mesh warp, bend & peel)", () => {
  it("evaluates all warp and curl/peel modifiers while preserving real DOM accessibility guarantees", () => {
    const kinds: DeformationModifierKind[] = [
      "envelope",
      "bend",
      "bulge",
      "wave",
      "flag",
      "sticker_peel",
      "page_curl",
    ];

    for (const kind of kinds) {
      const mesh = buildDeformedMesh(120, 80, {
        kind,
        progress: 0.45,
        strength: 0.4,
        phaseRad: 0.9,
      });
      assert.equal(mesh.cols, 16);
      assert.equal(mesh.rows, 12);
      assert.equal(mesh.vertices.length, 17 * 13);
      assert.equal(mesh.domAccessibilityPreserved, true);
      assert.equal(mesh.domNodeHiddenFromLayout, false);
      assert.equal(mesh.ariaAttributeMutationCount, 0);
    }

    // Left edge of flag remains pinned at x = 0, y = v*h
    const pinnedLeft = evaluateDeformedPoint(0, 0.5, 100, 60, { kind: "flag", phaseRad: 1.4 });
    assert.equal(pinnedLeft.x, 0);
    assert.equal(pinnedLeft.y, 30);
  });

  it("peels a sticker corner onto backside cylinder shading from Phase 175 layer texture", () => {
    const reg = createLayerTextureSdfRegistry("p185-peel");
    try {
      const sticker = reg.updateLayer({
        id: "sticker",
        kind: "rectangle",
        version: 1,
        x: 0,
        y: 0,
        width: 90,
        height: 90,
        fill: { r: 250, g: 195, b: 45, a: 255 },
      });

      const peel = rasteriseDeformedLayer(sticker, {
        kind: "sticker_peel",
        progress: 0.55,
        peelCorner: "bottom_right",
        curlRadiusPx: 14,
      });

      assert.ok(peel.backfacePixelCount > 50, "rolled sticker corner shows backside shading");
      assert.equal(peel.mesh.domAccessibilityPreserved, true);
    } finally {
      reg.unmountAll();
    }
  });
});
