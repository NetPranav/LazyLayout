import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeCarousel3DPoses,
  computeMarqueeStep,
  createScrollerController,
  wrapSeamlessLoop,
  type MarqueeState,
} from "../carouselsAndLoops.js";

describe("Phase 149 · Carousels, scrollers & seamless loops", () => {
  it("runs a 10-minute (36,000-frame) seamless loop without seam jumps or drift", () => {
    const itemCount = 8;
    const itemSpanPx = 220;
    const totalSpan = itemCount * itemSpanPx;
    let state: MarqueeState = { offsetPx: 0, effectiveSpeedPxPerSec: 0, wrapCount: 0 };

    let prevItem0Offset = wrapSeamlessLoop(state.offsetPx, itemCount, itemSpanPx).items[0]!.offsetPx;
    for (let frame = 0; frame < 36_000; frame++) {
      state = computeMarqueeStep(
        state,
        {
          totalSpanPx: totalSpan,
          baseSpeedPxPerSec: 120,
          scrollVelocityFactor: 0.4,
        },
        frame % 600 < 60 ? 300 : 0,
        1 / 60,
      );
      assert.ok(state.offsetPx >= 0 && state.offsetPx < totalSpan);
      const wrapped = wrapSeamlessLoop(state.offsetPx, itemCount, itemSpanPx);
      const item0Offset = wrapped.items[0]!.offsetPx;
      // Either small forward/backward step or clean wrap from -totalSpan/2 to +totalSpan/2
      const delta = Math.abs(item0Offset - prevItem0Offset);
      assert.ok(delta < 25 || Math.abs(delta - totalSpan) < 25, `unexpected seam jump at frame ${frame}: ${delta}`);
      prevItem0Offset = item0Offset;
    }
    assert.ok(state.wrapCount > 30, "expected multiple full seamless loops across 10 minutes");
  });

  it("supports scroller drag, momentum coast, nearest snap, wheel, arrow keys, and autoplay", () => {
    const scroller = createScrollerController({
      itemCount: 5,
      itemSpanPx: 300,
      loop: true,
      snap: true,
      friction: 8,
      autoplayPxPerSec: 90,
    });

    // Autoplay advances when not paused and idle
    const afterAuto = scroller.step(1 / 60);
    assert.ok(afterAuto.offsetPx > 0);
    assert.equal(afterAuto.lastSource, "autoplay");

    // Drag and release with momentum coasts to snap index
    scroller.setPaused(true);
    scroller.beginDrag();
    scroller.dragBy(-140, 1 / 60);
    scroller.endDrag(780);
    let snap = scroller.snapshot();
    for (let i = 0; i < 120; i++) {
      snap = scroller.step(1 / 60);
    }
    assert.equal(snap.settled, true);
    assert.ok(Math.abs((snap.offsetPx % 300) - 0) < 1 || Math.abs(snap.offsetPx - 300 * snap.activeIndex) < 1);

    // Arrow key steps by one card cleanly
    const beforeIdx = snap.activeIndex;
    scroller.stepArrowKey("ArrowRight");
    for (let i = 0; i < 90; i++) {
      snap = scroller.step(1 / 60);
    }
    assert.equal(snap.activeIndex, (beforeIdx + 1) % 5);
  });

  it("modulates marquee speed with scroll velocity and supports reverseWithScroll", () => {
    const initial: MarqueeState = { offsetPx: 100, effectiveSpeedPxPerSec: 0, wrapCount: 0 };
    const accelerated = computeMarqueeStep(
      initial,
      { totalSpanPx: 1000, baseSpeedPxPerSec: 100, scrollVelocityFactor: 0.5, maxSpeedPxPerSec: 500 },
      400,
      0.1,
    );
    assert.equal(accelerated.effectiveSpeedPxPerSec, 300);

    const reversed = computeMarqueeStep(
      initial,
      { totalSpanPx: 1000, baseSpeedPxPerSec: 100, scrollVelocityFactor: 0.5, reverseWithScroll: true },
      -400,
      0.1,
    );
    assert.equal(reversed.effectiveSpeedPxPerSec, -300);
  });

  it("computes deterministic 3D carousel poses for ring, arc, and stack arrangements", () => {
    const ring = computeCarousel3DPoses(6, 60, 300, "ring");
    assert.equal(ring.length, 6);
    const front = ring.find((p) => p.frontmost);
    assert.ok(front);
    assert.equal(front.index, 1);
    assert.ok(Math.abs(front.z - 300) < 1e-6);

    const arc = computeCarousel3DPoses(5, 0, 240, "arc");
    assert.equal(arc.filter((p) => p.frontmost).length, 1);

    const stack = computeCarousel3DPoses(4, 0, 200, "stack");
    assert.equal(stack[0]!.z, 0);
    assert.ok(stack[1]!.z < stack[0]!.z);
  });
});
