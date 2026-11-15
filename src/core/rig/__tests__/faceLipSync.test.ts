import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyVisemeFromAudioBands,
  compileTranscriptToVisemeTrack,
  evaluateFaceRigAtTime,
  type VisemeKeyframe,
} from "../faceLipSync";

describe("Phase 213 · Faces: expressions, blinks & lip sync (3 voice clips within 1 frame)", () => {
  const FRAME_MS = 1000 / 60; // 16.67ms

  it("matches reference viseme timing within 1 frame across 3 voice clips + auto-blink + breathing", () => {
    const clips: { name: string; transcript: string; dur: number; checkTimes: number[] }[] = [
      { name: "Clip 1 Greeting", transcript: "HELLO", dur: 0.5, checkTimes: [0.02, 0.15, 0.35, 0.52] },
      { name: "Clip 2 Boom", transcript: "BOOM WOW", dur: 0.8, checkTimes: [0.03, 0.25, 0.65, 0.82] },
      { name: "Clip 3 Name", transcript: "LAZYLAYOUT", dur: 1.0, checkTimes: [0.05, 0.45, 0.75, 1.02] },
    ];

    for (const clip of clips) {
      const track: VisemeKeyframe[] = compileTranscriptToVisemeTrack(clip.transcript, clip.dur);
      for (const t of clip.checkTimes) {
        const expected = track
          .filter((k) => k.timeSec <= t + FRAME_MS / 1000)
          .slice(-1)[0];
        const evaluated = evaluateFaceRigAtTime(t, track, { browExpression: "happy" });
        assert.equal(evaluated.viseme, expected?.viseme);
        assert.ok(evaluated.browRaiseLeft > 0);
      }
      const endState = evaluateFaceRigAtTime(clip.dur + 0.05, track);
      assert.equal(endState.viseme, "REST");
    }

    // Automatic blink fires during blink window (interval=3.2s, dur=0.16s -> t=3.12s mid-blink)
    const midBlink = evaluateFaceRigAtTime(3.12, []);
    assert.ok(midBlink.blinkLeft > 0.5 && midBlink.blinkRight > 0.5);
    assert.ok(midBlink.breathOffset >= 0 && midBlink.breathOffset <= 1);
  });

  it("classifies instantaneous audio frequency bands to distinct mouth visemes", () => {
    assert.equal(classifyVisemeFromAudioBands({ sub: 0, low: 0, mid: 0, high: 0, rms: 0.01 }), "REST");
    assert.equal(classifyVisemeFromAudioBands({ sub: 0.4, low: 0.6, mid: 0.3, high: 0.1, rms: 0.5 }), "OU");
    assert.equal(classifyVisemeFromAudioBands({ sub: 0.1, low: 0.2, mid: 0.7, high: 0.4, rms: 0.6 }), "EE");
    assert.equal(classifyVisemeFromAudioBands({ sub: 0.2, low: 0.4, mid: 0.5, high: 0.1, rms: 0.6 }), "AA");
  });
});
