import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSmoothScrollController } from "../smoothScrolling";

describe("Phase 189: Smooth scrolling & scroll physics", () => {
  it("smooths wheel input toward section snap targets and exposes scroll velocity", () => {
    const scroller = createSmoothScrollController({
      maxScrollY: 3000,
      snapSectionsPx: [0, 800, 1600, 2400],
      reducedMotion: false,
    });

    scroller.wheelDelta(760);
    const first = scroller.step(1 / 60);
    assert.equal(first.smoothingActive, true);
    assert.ok(first.currentY > 0 && first.currentY < 760);
    assert.ok(first.velocityPxPerSec > 0);

    for (let i = 0; i < 120; i += 1) {
      scroller.step(1 / 60);
    }
    const settled = scroller.getState();
    assert.equal(settled.snappedSectionIndex, 1);
    assert.ok(Math.abs(settled.currentY - 800) < 0.5);
  });

  it("disables smoothing on reducedMotion and respects keyboard, anchor links, and find-in-page jumps immediately", () => {
    const scroller = createSmoothScrollController({
      maxScrollY: 4000,
      snapSectionsPx: [0, 1000, 2000],
      reducedMotion: false,
    });

    scroller.keyboardJump("PageDown", 800);
    for (let i = 0; i < 60; i += 1) {
      scroller.step(1 / 60);
    }
    assert.ok(scroller.getState().currentY > 600);

    // Find-in-page and anchor links must never be fought by smoothing
    scroller.syncNativeScrollFromFindInPage(2450);
    assert.equal(scroller.getState().currentY, 2450);
    assert.equal(scroller.getState().targetY, 2450);

    scroller.jumpToAnchor(1000);
    assert.equal(scroller.getState().currentY, 1000);

    // Reduced motion turns smoothing completely off
    scroller.setReducedMotion(true);
    scroller.wheelDelta(500);
    const rm = scroller.getState();
    assert.equal(rm.smoothingActive, false);
    assert.equal(rm.currentY, 1500);
  });
});
