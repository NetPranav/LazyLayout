import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateDepthParallaxScene,
  type DepthPlaneSpec,
} from "../depthParallax";

const FIVE_HERO_PLANES: DepthPlaneSpec[] = [
  { id: "sky-backdrop", depthZPx: -600 },
  { id: "mountains", depthZPx: -300 },
  { id: "hero-title", depthZPx: 0 },
  { id: "floating-badge", depthZPx: 140 },
  { id: "foreground-leaf", depthZPx: 300 },
];

describe("Phase 190: Depth parallax by scroll and cursor", () => {
  it("projects 5 hero depth planes accurately across scroll and cursor checkpoints", () => {
    const res = evaluateDepthParallaxScene(
      FIVE_HERO_PLANES,
      { preset: "multi_plane_parallax", focalLengthPx: 1000, scrollRangePx: 200, cursorStrengthPx: 50 },
      { scrollProgress: 1.0, pointerNdcX: 0.8, pointerNdcY: -0.4 }
    );

    assert.equal(res.planes.length, 5);
    const sky = res.planes[0]!;
    const hero = res.planes[2]!;
    const fg = res.planes[4]!;

    // Focal plane at z=0 stays centered; background and foreground shift oppositely!
    assert.equal(hero.offsetX, 0);
    assert.equal(hero.offsetY, 0);
    assert.equal(hero.scale, 1);

    assert.ok(sky.scale < 1, "deep background plane scales down");
    assert.ok(fg.scale > 1, "foreground plane scales up");
    assert.ok(sky.offsetX > 0 && fg.offsetX < 0, "opposite horizontal parallax across z=0");
    assert.ok(fg.cssTransform3d.includes("translate3d("));
  });

  it("supports dolly_on_scroll, cursor_look_around, phone_tilt, and collapses motion under reducedMotion", () => {
    const dolly = evaluateDepthParallaxScene(
      FIVE_HERO_PLANES,
      { preset: "dolly_on_scroll", focalLengthPx: 1000, dollyTravelPx: 300 },
      { scrollProgress: 0.75, pointerNdcX: 0, pointerNdcY: 0 }
    );
    assert.equal(dolly.cameraZ, 225);
    assert.ok(dolly.planes[2]!.scale < 1, "focal plane recedes relative to camera when camera dollies or advances");

    const look = evaluateDepthParallaxScene(
      FIVE_HERO_PLANES,
      { preset: "cursor_look_around", maxTiltDeg: 8 },
      { scrollProgress: 0, pointerNdcX: 0.5, pointerNdcY: -0.5 }
    );
    assert.equal(look.planes[0]!.rotateYDeg, 4);
    assert.equal(look.planes[0]!.rotateXDeg, 4);

    const tilt = evaluateDepthParallaxScene(
      FIVE_HERO_PLANES,
      { preset: "phone_tilt", maxTiltDeg: 6 },
      { scrollProgress: 0, pointerNdcX: 0, pointerNdcY: 0, tiltNdcX: -1, tiltNdcY: 0.5 }
    );
    assert.ok(tilt.planes[0]!.rotateYDeg < -5);

    const calm = evaluateDepthParallaxScene(
      FIVE_HERO_PLANES,
      { preset: "cursor_look_around", reducedMotion: true },
      { scrollProgress: 0.9, pointerNdcX: 1, pointerNdcY: 1 }
    );
    assert.equal(calm.cameraX, 0);
    assert.equal(calm.cameraY, 0);
    assert.equal(calm.planes[0]!.rotateYDeg, 0);
  });
});
