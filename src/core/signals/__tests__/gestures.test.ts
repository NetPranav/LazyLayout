import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGestureRecognizer } from "../gestures";

describe("Stage 4 Phase 147: hold, swipe, fling, slingshot, double tap, pinch & rotate", () => {
  it("tracks hold progress to 1.0, fires longPress, and supports double tap", () => {
    const rec = createGestureRecognizer({ holdDurationSec: 0.5, doubleTapWindowSec: 0.4 });
    let out = rec.step({ time: 0, down: true, x: 100, y: 100 });
    assert.equal(out.holdProgress, 0);
    out = rec.step({ time: 0.25, down: true, x: 101, y: 100 });
    assert.ok(Math.abs(out.holdProgress - 0.5) < 1e-6);
    out = rec.step({ time: 0.5, down: true, x: 101, y: 100 });
    assert.equal(out.holdProgress, 1);
    assert.equal(out.longPressFired, true);
    rec.step({ time: 0.55, down: false, x: 101, y: 100 });

    // Two quick taps fire doubleTap
    rec.step({ time: 1.0, down: true, x: 50, y: 50 });
    rec.step({ time: 1.05, down: false, x: 50, y: 50 });
    rec.step({ time: 1.15, down: true, x: 52, y: 51 });
    const dbl = rec.step({ time: 1.2, down: false, x: 52, y: 51 });
    assert.equal(dbl.doubleTapFired, true);
  });

  it("recognizes swipe direction, fling speed, and slingshot launch opposite pull vector", () => {
    const rec = createGestureRecognizer({ swipeMinDistPx: 40, flingMinSpeedPxPerSec: 300, maxPullPx: 100 });
    rec.step({ time: 0, down: true, x: 200, y: 200 });
    const pull = rec.step({ time: 0.05, down: true, x: 140, y: 200 });
    assert.equal(pull.slingshot.tension, 0.6);
    const release = rec.step({ time: 0.1, down: false, x: 120, y: 200 });
    assert.deepEqual(release.swipe, { direction: "left", distancePx: 80 });
    assert.ok(release.fling && release.fling.speedPxPerSec >= 300);
    assert.equal(release.slingshot.launched, true);
    assert.ok(release.slingshot.launchVx > 0);
  });

  it("measures dual-touch pinch scale, two-finger rotation, and keyboard parity actions", () => {
    const rec = createGestureRecognizer();
    rec.step({ time: 0, down: true, x: 0, y: 0, touches: [{ x: 100, y: 100 }, { x: 200, y: 100 }] });
    const zoomed = rec.step({
      time: 0.1,
      down: true,
      x: 0,
      y: 0,
      touches: [{ x: 150, y: 0 }, { x: 150, y: 200 }],
    });
    assert.equal(zoomed.pinchScale, 2);
    assert.equal(zoomed.twoFingerRotateDeg, 90);

    const keySwipe = rec.step({ time: 0.2, down: false, x: 0, y: 0, keyAction: "swipeRight" });
    assert.equal(keySwipe.swipe?.direction, "right");
  });
});

describe("Phase 147 · a long press is not a tap (review 2026-11-17)", () => {
  it("long press followed by a quick tap is not a double-tap", async () => {
    const { createGestureRecognizer } = await import("../gestures");
    const g = createGestureRecognizer({ holdDurationSec: 0.5, doubleTapWindowSec: 0.35 });
    let t = 0;
    const at = (down: boolean) => g.step({ time: t, down, x: 10, y: 10 });
    at(true);
    for (; t < 0.7; t += 0.05) at(true); // held past the long-press time
    at(false);
    t += 0.1;
    at(true);
    t += 0.05;
    const release = at(false);
    assert.equal(release.doubleTapFired, false);
  });
});
