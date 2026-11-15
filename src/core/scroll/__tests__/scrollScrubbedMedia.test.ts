import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createScrollScrubMediaController,
  resolveScrollMediaTierBudget,
} from "../scrollScrubbedMedia";

describe("Phase 188: Scroll-scrubbed image sequences & video", () => {
  it("maps 20 scroll positions across pinned sections accurately to frames while staying within tier memory budgets", () => {
    const controller = createScrollScrubMediaController(
      {
        id: "hero-orbit-product",
        kind: "image_sequence",
        frameCount: 120,
        posterUrl: "posters/orbit.jpg",
        bytesPerDecodedFrame: 1_500_000, // 1.5 MB each
        pinStartPx: 400,
        pinEndPx: 2400,
      },
      "T2"
    );

    const budget = resolveScrollMediaTierBudget("T2");
    for (let i = 0; i < 20; i += 1) {
      const scrollY = 400 + (i / 19) * 2000;
      const state = controller.evaluateAtScroll(scrollY);
      const expectedProgress = i / 19;
      const expectedFrame = Math.round(expectedProgress * 119);
      assert.equal(state.isPinned, true);
      assert.equal(state.frameIndex, expectedFrame);
      assert.equal(state.withinMemoryBudget, true);
      assert.ok(state.cachedMemoryBytes <= budget.maxMemoryBytes);
      assert.equal(state.usingPosterFallback, false);
    }

    // Outside pinned window unpins cleanly
    const beforePin = controller.evaluateAtScroll(150);
    assert.equal(beforePin.isPinned, false);
    assert.equal(beforePin.frameIndex, 0);

    const afterPin = controller.evaluateAtScroll(3000);
    assert.equal(afterPin.isPinned, false);
    assert.equal(afterPin.frameIndex, 119);
    assert.equal(afterPin.pinTranslatePx, 2000);
  });

  it("activates poster fallback on low-tier T0 when frames are unbuffered and supports arbitrary signal input", () => {
    const videoScrub = createScrollScrubMediaController(
      {
        id: "turntable-video",
        kind: "video",
        frameCount: 90,
        durationSec: 3,
        posterUrl: "posters/turntable.jpg",
        bytesPerDecodedFrame: 1_000_000,
        pinStartPx: 0,
        pinEndPx: 1000,
      },
      "T0"
    );

    const unbuffered = videoScrub.evaluateAtScroll(500);
    assert.equal(unbuffered.usingPosterFallback, true);
    assert.equal(unbuffered.activeUrl, "posters/turntable.jpg");
    assert.ok(Math.abs(unbuffered.videoTimestampSec - 1.5) < 1e-6);

    // Explicitly decode middle frame -> switches from poster to active frame
    videoScrub.markFrameDecoded(unbuffered.frameIndex);
    const buffered = videoScrub.evaluateAtScroll(500);
    assert.equal(buffered.usingPosterFallback, false);
  });
});
