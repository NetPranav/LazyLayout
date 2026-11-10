import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { transport, getTransport, transportStore } from "../../../core/time/transport";
import { installTransportDriver } from "../../../core/time/transportDriver";
import { frameScheduler } from "../../../core/time/scheduler";
import { useMotionModel, getOverlayFrame, getOverlayTime } from "../store";

describe("Phase 55: Frame scheduler phases and one-clock synchronization", () => {
  let cleanupDriver: (() => void) | null = null;

  beforeEach(() => {
    frameScheduler.setDeterministic(false);
    transport.reset();
    transport.setComposition({ id: "comp_main", fps: 60, duration: 5 });
    cleanupDriver = installTransportDriver(frameScheduler);
  });

  afterEach(() => {
    frameScheduler.setDeterministic(false);
    cleanupDriver?.();
    cleanupDriver = null;
    transport.reset();
  });

  it("with frameScheduler.setDeterministic(true) and play, each step(1/60) advances the Motion store's playhead by exactly one frame, and the published overlay frame equals it after the step", () => {
    frameScheduler.setDeterministic(true);
    transport.seek(0);
    transport.play();
    assert.equal(getTransport().playing, true);
    assert.equal(useMotionModel.getState().playing, true);

    // Initial state at frame 0
    assert.equal(getTransport().time, 0);
    assert.equal(useMotionModel.getState().playhead, 0);
    assert.equal(getOverlayFrame(), 0);
    assert.equal(getOverlayTime(), 0);

    // Step 1: step(1 / 60)
    frameScheduler.step(1 / 60);
    assert.equal(Math.round(getTransport().time * 60), 1, "Transport advanced to frame 1");
    assert.equal(useMotionModel.getState().playhead, 1, "Motion playhead advanced to frame 1 in apply phase");
    assert.equal(getOverlayFrame(), 1, "Overlay frame published as frame 1 in overlay phase");
    assert.equal(getOverlayTime(), 1 / 60);

    // Step 2: step(1 / 60)
    frameScheduler.step(1 / 60);
    assert.equal(Math.round(getTransport().time * 60), 2, "Transport advanced to frame 2");
    assert.equal(useMotionModel.getState().playhead, 2, "Motion playhead advanced to frame 2");
    assert.equal(getOverlayFrame(), 2, "Overlay frame equals playhead after step");
    assert.equal(getOverlayTime(), 2 / 60);

    // Step through 10 more consecutive frames
    for (let f = 3; f <= 12; f++) {
      frameScheduler.step(1 / 60);
      assert.equal(Math.round(getTransport().time * 60), f, `Transport frame ${f}`);
      assert.equal(useMotionModel.getState().playhead, f, `Motion playhead at frame ${f}`);
      assert.equal(getOverlayFrame(), f, `Overlay frame at frame ${f}`);
    }
  });

  it("seeking while paused updates the store and overlay immediately without a step", () => {
    // Ensure paused
    transport.pause();
    assert.equal(getTransport().playing, false);
    assert.equal(useMotionModel.getState().playing, false);

    // Seek to 1.5s (90 frames at 60fps)
    transport.seek(1.5);
    assert.equal(getTransport().time, 1.5);
    assert.equal(useMotionModel.getState().time, 1.5);
    assert.equal(useMotionModel.getState().playhead, 90);
    assert.equal(getOverlayFrame(), 90);
    assert.equal(getOverlayTime(), 1.5);

    // Step frame while paused
    transport.stepFrame(1);
    const expectedTime = 91 / 60;
    assert.equal(getTransport().time, expectedTime);
    assert.equal(useMotionModel.getState().time, expectedTime);
    assert.equal(useMotionModel.getState().playhead, 91);
    assert.equal(getOverlayFrame(), 91);
    assert.equal(getOverlayTime(), expectedTime);

    // Step backwards while paused
    transport.stepFrame(-5);
    const expectedBack = 86 / 60;
    assert.equal(useMotionModel.getState().playhead, 86);
    assert.equal(getOverlayFrame(), 86);
    assert.equal(getOverlayTime(), expectedBack);

    // Seek back to start
    transport.seek(0);
    assert.equal(useMotionModel.getState().playhead, 0);
    assert.equal(getOverlayFrame(), 0);
    assert.equal(getOverlayTime(), 0);
  });

  it("phase ordering during playback: evaluate advances transport, apply advances Motion playhead, overlay publishes overlay frame", () => {
    frameScheduler.setDeterministic(true);
    transport.seek(0);
    transport.play();

    const phaseSnapshots: Array<{ phase: string; transportFrame: number; playhead: number; overlay: number }> = [];

    const unregEval = frameScheduler.register("evaluate", () => {
      // transportDriver runs in evaluate: record snapshot
      phaseSnapshots.push({
        phase: "evaluate",
        transportFrame: Math.round(getTransport().time * 60),
        playhead: useMotionModel.getState().playhead,
        overlay: getOverlayFrame(),
      });
    });

    const unregApply = frameScheduler.register("apply", () => {
      phaseSnapshots.push({
        phase: "apply",
        transportFrame: Math.round(getTransport().time * 60),
        playhead: useMotionModel.getState().playhead,
        overlay: getOverlayFrame(),
      });
    });

    const unregOverlay = frameScheduler.register("overlay", () => {
      phaseSnapshots.push({
        phase: "overlay",
        transportFrame: Math.round(getTransport().time * 60),
        playhead: useMotionModel.getState().playhead,
        overlay: getOverlayFrame(),
      });
    });

    frameScheduler.step(1 / 60);

    // Verify all phases fired in strict sequence
    assert.ok(phaseSnapshots.length >= 3);
    const evalSnap = phaseSnapshots.find((s) => s.phase === "evaluate")!;
    const applySnap = phaseSnapshots.find((s) => s.phase === "apply")!;
    const overlaySnap = phaseSnapshots.find((s) => s.phase === "overlay")!;

    assert.ok(evalSnap, "evaluate phase ran");
    assert.ok(applySnap, "apply phase ran");
    assert.ok(overlaySnap, "overlay phase ran");

    // After step completes: playhead and overlay are synchronized at frame 1
    assert.equal(useMotionModel.getState().playhead, 1);
    assert.equal(getOverlayFrame(), 1);

    unregEval();
    unregApply();
    unregOverlay();
  });

  for (const fps of [24, 30, 60] as const) {
    it(`deterministic stepping works with ${fps} fps composition`, () => {
      transport.setComposition({ id: "comp_main", fps, duration: 5 });
      frameScheduler.setDeterministic(true);
      transport.seek(0);
      transport.play();

      for (let i = 1; i <= 5; i++) {
        frameScheduler.step(1 / fps);
        assert.equal(useMotionModel.getState().playhead, i, `Frame ${i} at ${fps}fps in motion store`);
        assert.equal(getOverlayFrame(), i, `Frame ${i} at ${fps}fps in overlay clock`);
      }
    });
  }
});
