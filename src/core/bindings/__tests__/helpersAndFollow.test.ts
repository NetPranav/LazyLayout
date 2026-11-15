import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateLayerPinTarget,
  filterExportableLayers,
  getFollowSimpleFaceSpec,
  stepFollowComponent,
  type FollowComponentConfig,
  type FollowComponentState,
} from "../helpersAndFollow.js";

describe("Phase 152 · Helpers, pins & Follow component", () => {
  it("excludes helper layers from exported DOM while keeping them active in evaluation", () => {
    const layers = [
      { id: "hero", isHelper: false },
      { id: "cursor-guide", isHelper: true },
      { id: "focus-anchor", role: "helper" },
      { id: "cta", isHelper: false },
    ];
    const exported = filterExportableLayers(layers);
    assert.deepEqual(
      exported.map((l) => l.id),
      ["hero", "cta"],
    );
    assert.equal(getFollowSimpleFaceSpec().pins.length, 9);
  });

  it("evaluates L.position(pin) accurately and matches tape checkpoints with rotation & scale", () => {
    // 100x50 box at (100, 100), center = (150, 125). Bottom pin unrotated is (150, 150).
    // Rotated 90deg clockwise around center: local offset (0, +25) maps to (-25, 0) -> (125, 125).
    const rotatedBottom = evaluateLayerPinTarget(
      { x: 100, y: 100, width: 100, height: 50 },
      "bottom",
      { rotate: 90, scaleX: 1, scaleY: 1 },
    );
    assert.ok(Math.abs(rotatedBottom[0] - 125) < 1e-6);
    assert.ok(Math.abs(rotatedBottom[1] - 125) < 1e-6);

    const config: FollowComponentConfig = {
      id: "follow-helper",
      layerId: "cursor-guide",
      homeBox: { x: 0, y: 0, width: 40, height: 40 },
      target: { kind: "pointer" },
      pin: "bottom", // basePin is (20, 40)
      offsetX: 0,
      offsetY: 0,
      bounce: 0.25,
      timeSec: 0.2,
      autoRotate: true,
      scaleBySpeed: { minScale: 1, maxScale: 1.35, referenceSpeedPxPerSec: 1200 },
      leaveBehaviour: "returnHome",
    };

    let state: FollowComponentState | null = null;
    for (let i = 0; i < 60; i++) {
      state = stepFollowComponent(
        config,
        state,
        { pointerX: 220, pointerY: 140, pointerActive: true, pointerType: "mouse" },
        1 / 60,
      );
    }
    assert.ok(state !== null);
    assert.ok(Math.abs(state.pinWorldX - 220) < 2, `pinWorldX expected ~220, got ${state.pinWorldX}`);
    assert.ok(Math.abs(state.pinWorldY - 140) < 2, `pinWorldY expected ~140, got ${state.pinWorldY}`);

    // Reduced-motion "off" snaps helper straight to home
    const reduced = stepFollowComponent(
      { ...config, reducedMotionPolicy: "off" },
      state,
      { pointerX: 500, pointerY: 500, pointerActive: true, pointerType: "mouse", reducedMotion: true },
      1 / 60,
    );
    assert.equal(reduced.pinWorldX, 20);
    assert.equal(reduced.pinWorldY, 40);
  });
});
