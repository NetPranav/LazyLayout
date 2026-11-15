/**
 * @file soundAndHaptics.test.ts
 * @description Phase 171 tests: original procedural SFX library, zero playback
 * prior to user interaction, signal-bound pitch/volume/pan modulation, mobile
 * haptic fallback, global mute, and deterministic tape-frame firing parity.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ORIGINAL_SFX_LIBRARY,
  bindSoundParamsToSignal,
  createSoundAndHapticsEngine,
} from "../soundAndHaptics";

describe("Phase 171: Sound design & haptics", () => {
  it("plays nothing before user interaction and respects global mute", () => {
    let synthCalls = 0;
    let vibCalls = 0;
    const engine = createSoundAndHapticsEngine({
      triggerSynth: () => {
        synthCalls++;
      },
      vibrate: () => {
        vibCalls++;
        return true;
      },
    });

    assert.equal(engine.isUnlocked(), false);
    assert.equal(engine.trigger("click", { frame: 10, timeSec: 0.16 }), null);
    assert.equal(engine.trigger("whoosh", { frame: 12, timeSec: 0.2 }), null);
    assert.equal(synthCalls, 0);
    assert.equal(vibCalls, 0);

    engine.unlockAudioFromUserGesture();
    assert.equal(engine.isUnlocked(), true);

    const first = engine.trigger("click", { frame: 30, timeSec: 0.5 });
    assert.ok(first);
    assert.equal(first.hapticDispatched, true);
    assert.equal(synthCalls, 1);

    engine.setMuted(true);
    assert.equal(engine.trigger("chime", { frame: 40, timeSec: 0.66 }), null);
    assert.equal(synthCalls, 1);
  });

  it("binds faster drag speeds to higher pitch and viewport X to stereo pan", () => {
    const slow = bindSoundParamsToSignal("whoosh", { dragSpeedNorm: 0.1, normalizedX: 0.2 });
    const fast = bindSoundParamsToSignal("whoosh", { dragSpeedNorm: 1.4, normalizedX: 0.9 });

    assert.ok(fast.pitchMultiplier > slow.pitchMultiplier);
    assert.ok(fast.startFreqHz > slow.startFreqHz);
    assert.ok(slow.pan < 0 && fast.pan > 0);
  });

  it("includes all 5 original licence-clean SFX presets and matches tape replay", () => {
    assert.deepEqual(
      Object.keys(ORIGINAL_SFX_LIBRARY).sort(),
      ["chime", "click", "pop", "tick", "whoosh"]
    );

    const runTape = () => {
      const eng = createSoundAndHapticsEngine({ triggerSynth: () => {}, vibrate: () => true });
      eng.unlockAudioFromUserGesture();
      eng.trigger("click", { frame: 6, timeSec: 0.1 });
      eng.trigger("whoosh", { frame: 18, timeSec: 0.3, signals: { dragSpeedNorm: 0.8, normalizedX: 0.75 } });
      eng.trigger("chime", { frame: 48, timeSec: 0.8 });
      return eng.getFiredEvents();
    };

    assert.deepEqual(runTape(), runTape());
  });
});
