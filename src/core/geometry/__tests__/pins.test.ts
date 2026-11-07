import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePresetPinPosition,
  resolveCustomPinPosition,
  resolveLayerAnchor,
  formatCssTransformOrigin,
  findNearestPresetPin,
} from "../pins";

describe("Phase 72: Pins Resolution Engine", () => {
  const W = 100;
  const H = 60;

  it("resolves all 9 preset pins on a 100x60 box to exact local coordinates", () => {
    assert.deepEqual(resolvePresetPinPosition("topLeft", W, H), [0, 0]);
    assert.deepEqual(resolvePresetPinPosition("top", W, H), [50, 0]);
    assert.deepEqual(resolvePresetPinPosition("topRight", W, H), [100, 0]);
    assert.deepEqual(resolvePresetPinPosition("left", W, H), [0, 30]);
    assert.deepEqual(resolvePresetPinPosition("center", W, H), [50, 30]);
    assert.deepEqual(resolvePresetPinPosition("right", W, H), [100, 30]);
    assert.deepEqual(resolvePresetPinPosition("bottomLeft", W, H), [0, 60]);
    assert.deepEqual(resolvePresetPinPosition("bottom", W, H), [50, 60]);
    assert.deepEqual(resolvePresetPinPosition("bottomRight", W, H), [100, 60]);
  });

  it("resolves legacy and whitespace aliases correctly", () => {
    assert.deepEqual(resolvePresetPinPosition("top left", W, H), [0, 0]);
    assert.deepEqual(resolvePresetPinPosition("top right", W, H), [100, 0]);
    assert.deepEqual(resolvePresetPinPosition("bottom left", W, H), [0, 60]);
    assert.deepEqual(resolvePresetPinPosition("bottom right", W, H), [100, 60]);
    assert.deepEqual(resolvePresetPinPosition("bottomCentre", W, H), [50, 60]);
  });

  it("resolves custom pins in pixels and percentages", () => {
    const pxPin = { x: 25, y: 15, unit: "px" as const };
    assert.deepEqual(resolveCustomPinPosition(pxPin, W, H), [25, 15]);

    const pctPin = { x: 50, y: 25, unit: "%" as const };
    assert.deepEqual(resolveCustomPinPosition(pctPin, W, H), [50, 15]);
  });

  it("preserves out-of-bounds coordinates without clamping (Condition E)", () => {
    const outPx = { x: -30, y: -20, unit: "px" as const };
    assert.deepEqual(resolveCustomPinPosition(outPx, W, H), [-30, -20]);

    const outPct = { x: 120, y: 150, unit: "%" as const };
    assert.deepEqual(resolveCustomPinPosition(outPct, W, H), [120, 90]);
  });

  it("resolves layer anchor from transform.origin or custom named pins", () => {
    const layerWithPreset = {
      properties: { "transform.origin": "topRight" },
    };
    assert.deepEqual(resolveLayerAnchor(layerWithPreset, W, H), [100, 0]);

    const layerWithCustomPin = {
      pins: {
        pivot_knob: { x: -10, y: -10, unit: "px" as const },
      },
      properties: { "transform.origin": "pivot_knob" },
    };
    assert.deepEqual(resolveLayerAnchor(layerWithCustomPin, W, H), [-10, -10]);

    const layerDefault = {
      properties: {},
    };
    assert.deepEqual(resolveLayerAnchor(layerDefault, W, H), [50, 30]);
  });

  it("formats CSS transform-origin as pixel string", () => {
    assert.equal(formatCssTransformOrigin([50, 30]), "50px 30px");
    assert.equal(formatCssTransformOrigin([0, 0]), "0px 0px");
  });

  it("finds nearest preset pin within snapping threshold", () => {
    // Exactly at top-left
    const hit1 = findNearestPresetPin([0, 0], W, H, 8);
    assert.ok(hit1);
    assert.equal(hit1.name, "topLeft");

    // Near top-left (3px away)
    const hit2 = findNearestPresetPin([2, 2], W, H, 8);
    assert.ok(hit2);
    assert.equal(hit2.name, "topLeft");

    // Outside threshold (15px away)
    const hit3 = findNearestPresetPin([15, 15], W, H, 8);
    assert.equal(hit3, null);

    // Near center [50, 30] (at [52, 29])
    const hitCenter = findNearestPresetPin([52, 29], W, H, 8);
    assert.ok(hitCenter);
    assert.equal(hitCenter.name, "center");
    assert.deepEqual(hitCenter.position, [50, 30]);
  });
});
