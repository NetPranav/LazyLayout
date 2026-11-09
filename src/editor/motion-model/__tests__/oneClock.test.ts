import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { transport, getTransport, transportStore } from "../../../core/time/transport";
import { useMotionModel, motionActions } from "../store";

describe("Phase 54: One clock - transportStore is single source of truth for motion model", () => {
  beforeEach(() => {
    transport.reset();
    transport.setComposition({ id: "comp_main", fps: 60, duration: 5 });
  });

  it("after transport.seek / stepFrame / play+advance, the motion model reports the same time and playing", () => {
    // 1. Seek
    transport.seek(1.5);
    assert.equal(getTransport().time, 1.5);
    assert.equal(useMotionModel.getState().time, 1.5);
    assert.equal(useMotionModel.getState().playhead, 90);

    // 2. Step frame
    transport.stepFrame(1);
    const expectedTime = 91 / 60;
    assert.equal(getTransport().time, expectedTime);
    assert.equal(useMotionModel.getState().time, expectedTime);
    assert.equal(useMotionModel.getState().playhead, 91);

    // 3. Play + advance
    transport.play();
    assert.equal(transportStore.getState().playing, true);
    assert.equal(useMotionModel.getState().playing, true);

    transport.tick(0.05); // Advance 50ms (3 frames at 60fps)
    const advancedTime = getTransport().time;
    assert.equal(useMotionModel.getState().time, advancedTime);
    assert.equal(useMotionModel.getState().playhead, Math.round(advancedTime * 60));
    assert.equal(useMotionModel.getState().playing, true);

    // 4. Pause
    transport.pause();
    assert.equal(transportStore.getState().playing, false);
    assert.equal(useMotionModel.getState().playing, false);
  });

  it("motionActions.stepFrame moves transportStore directly", () => {
    transport.setComposition({ id: "comp_main", fps: 30, duration: 5 });
    transport.seek(0);

    assert.equal(transportStore.getState().time, 0);
    assert.equal(useMotionModel.getState().playhead, 0);

    motionActions.stepFrame(1);
    assert.equal(transportStore.getState().time, 1 / 30);
    assert.equal(useMotionModel.getState().playhead, 1);
    assert.equal(useMotionModel.getState().time, 1 / 30);

    motionActions.stepFrame(2);
    assert.equal(transportStore.getState().time, 3 / 30);
    assert.equal(useMotionModel.getState().playhead, 3);
    assert.equal(useMotionModel.getState().time, 3 / 30);

    // motionActions.setPlayhead routes to transport.seek
    motionActions.setPlayhead(15);
    assert.equal(transportStore.getState().time, 0.5);
    assert.equal(useMotionModel.getState().playhead, 15);
    assert.equal(useMotionModel.getState().time, 0.5);
  });

  for (const fps of [24, 30, 60]) {
    it(`frame stepping lands on exact frame times at ${fps} fps`, () => {
      transport.setComposition({ id: "comp_main", fps, duration: 5 });
      transport.seek(0);

      for (let n = 1; n <= fps; n++) {
        motionActions.stepFrame(1);
        const expected = n / fps;
        assert.equal(transportStore.getState().time, expected, `Forward step ${n} at ${fps}fps in transport`);
        assert.equal(useMotionModel.getState().time, expected, `Forward step ${n} at ${fps}fps in motion model`);
        assert.equal(useMotionModel.getState().playhead, n, `Forward playhead ${n} at ${fps}fps`);
      }

      for (let n = fps - 1; n >= 0; n--) {
        motionActions.stepFrame(-1);
        const expected = n / fps;
        assert.equal(transportStore.getState().time, expected, `Backward step ${n} at ${fps}fps in transport`);
        assert.equal(useMotionModel.getState().time, expected, `Backward step ${n} at ${fps}fps in motion model`);
        assert.equal(useMotionModel.getState().playhead, n, `Backward playhead ${n} at ${fps}fps`);
      }
    });
  }

  it("loop modes and play/pause toggle in motionActions sync to transport", () => {
    assert.equal(transportStore.getState().loop, "off");
    assert.equal(useMotionModel.getState().loop, 0);

    motionActions.toggleLoop();
    assert.equal(transportStore.getState().loop, "loop");
    assert.equal(useMotionModel.getState().loop, 1);

    motionActions.toggleLoop();
    assert.equal(transportStore.getState().loop, "ping-pong");
    assert.equal(useMotionModel.getState().loop, 2);

    motionActions.toggleLoop();
    assert.equal(transportStore.getState().loop, "off");
    assert.equal(useMotionModel.getState().loop, 0);

    motionActions.setPlaying(true);
    assert.equal(transportStore.getState().playing, true);
    assert.equal(useMotionModel.getState().playing, true);

    motionActions.setPlaying(false);
    assert.equal(transportStore.getState().playing, false);
    assert.equal(useMotionModel.getState().playing, false);
  });
});
