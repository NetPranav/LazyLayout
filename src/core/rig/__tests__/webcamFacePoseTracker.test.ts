import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractRigSignalsFromLandmarks,
  resolveTrackingInputWithFallback,
  recordTrackingTape,
  replayTrackingTape,
  type WebcamLandmarkFrame,
} from "../webcamFacePoseTracker";

describe("Phase 214 · Face & pose tracking as an input (on-device + cursor fallback)", () => {
  const sampleFrame = (t: number, noseOffsetX: number, eyeOpen = 0.04): WebcamLandmarkFrame => ({
    timestampMs: t,
    leftEyeCenter: { x: 0.4, y: 0.4 },
    leftEyeTop: { x: 0.4, y: 0.4 - eyeOpen / 2 },
    leftEyeBottom: { x: 0.4, y: 0.4 + eyeOpen / 2 },
    rightEyeCenter: { x: 0.6, y: 0.4 },
    rightEyeTop: { x: 0.6, y: 0.4 - eyeOpen / 2 },
    rightEyeBottom: { x: 0.6, y: 0.4 + eyeOpen / 2 },
    noseTip: { x: 0.5 + noseOffsetX, y: 0.5 },
    mouthTop: { x: 0.5, y: 0.6 },
    mouthBottom: { x: 0.5, y: 0.65 },
    mouthLeft: { x: 0.45, y: 0.625 },
    mouthRight: { x: 0.55, y: 0.625 },
  });

  it("extracts on-device signals with videoLeavesDevice=false and replays recorded tapes identically", () => {
    const f1 = sampleFrame(0, 0.04, 0.04);
    const f2 = sampleFrame(100, -0.04, 0.002); // turned left & blinking
    const tape = recordTrackingTape("cam_take_1", [f1, f2]);

    const r1 = replayTrackingTape(tape, 0)!;
    const r2 = replayTrackingTape(tape, 100)!;
    const r2Repeat = replayTrackingTape(tape, 100)!;

    assert.deepEqual(r2, r2Repeat);
    assert.equal(r1.source, "webcam");
    assert.equal(r1.videoLeavesDevice, false);
    assert.ok(r1.headYawDeg > 5);
    assert.ok(r2.headYawDeg < -5);
    assert.ok(r2.blinkLeft > 0.8);
    assert.deepEqual(extractRigSignalsFromLandmarks(f1).headYawDeg, r1.headYawDeg);
  });

  it("falls back smoothly to cursor driving when camera permission is denied", () => {
    const fallback = resolveTrackingInputWithFallback({
      cameraPermission: "denied",
      landmarkFrame: sampleFrame(0, 0.05),
      cursor: { x: 960, y: 200, viewportWidth: 1200, viewportHeight: 800, timestampMs: 16 },
    });
    assert.equal(fallback.source, "cursor-fallback");
    assert.equal(fallback.videoLeavesDevice, false);
    assert.ok(fallback.headYawDeg > 15);
    assert.ok(fallback.headPitchDeg < -5);
  });
});
