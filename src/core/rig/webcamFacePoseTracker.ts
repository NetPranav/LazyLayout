/**
 * ============================================================================
 * STAGE 5 · PHASE 214 — FACE & POSE TRACKING AS AN INPUT
 * ============================================================================
 * On-device face and upper-body pose signal extraction from 2D landmarks,
 * deterministic tracking tape recording/replay, and seamless cursor fallback
 * when camera access is denied. Video frames never leave the device.
 * ============================================================================
 */

import { type Point2D } from "./rigModel";

export interface WebcamLandmarkFrame {
  readonly timestampMs: number;
  readonly noseTip: Point2D;
  readonly leftEyeTop: Point2D;
  readonly leftEyeBottom: Point2D;
  readonly leftEyeCenter: Point2D;
  readonly rightEyeTop: Point2D;
  readonly rightEyeBottom: Point2D;
  readonly rightEyeCenter: Point2D;
  readonly mouthTop: Point2D;
  readonly mouthBottom: Point2D;
  readonly mouthLeft: Point2D;
  readonly mouthRight: Point2D;
  readonly leftWrist?: Point2D;
  readonly rightWrist?: Point2D;
}

export interface TrackedRigSignals {
  readonly timestampMs: number;
  readonly headYawDeg: number;
  readonly headPitchDeg: number;
  readonly headRollDeg: number;
  readonly blinkLeft: number;
  readonly blinkRight: number;
  readonly mouthOpen: number;
  readonly mouthWidth: number;
  readonly handLeft: Point2D;
  readonly handRight: Point2D;
  readonly source: "webcam" | "cursor-fallback";
  readonly videoLeavesDevice: false;
}

export interface RecordedTrackingTape {
  readonly id: string;
  readonly frames: readonly TrackedRigSignals[];
}

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Pure on-device landmark geometry solver turning normalized 0..1 face/pose
 * landmarks into deterministic character rig driver signals.
 */
export function extractRigSignalsFromLandmarks(
  frame: WebcamLandmarkFrame,
): TrackedRigSignals {
  const eyeMidX = (frame.leftEyeCenter.x + frame.rightEyeCenter.x) / 2;
  const eyeMidY = (frame.leftEyeCenter.y + frame.rightEyeCenter.y) / 2;
  const eyeSpan = Math.max(
    1e-3,
    Math.hypot(
      frame.rightEyeCenter.x - frame.leftEyeCenter.x,
      frame.rightEyeCenter.y - frame.leftEyeCenter.y,
    ),
  );

  const yawNorm = (frame.noseTip.x - eyeMidX) / eyeSpan;
  const pitchNorm = (frame.noseTip.y - eyeMidY - eyeSpan * 0.35) / eyeSpan;

  const headYawDeg = Math.max(-45, Math.min(45, yawNorm * 90));
  const headPitchDeg = Math.max(-35, Math.min(35, pitchNorm * 70));
  const headRollDeg =
    Math.atan2(
      frame.rightEyeCenter.y - frame.leftEyeCenter.y,
      frame.rightEyeCenter.x - frame.leftEyeCenter.x,
    ) * RAD_TO_DEG;

  const eyeOpenL = Math.abs(frame.leftEyeBottom.y - frame.leftEyeTop.y) / eyeSpan;
  const eyeOpenR = Math.abs(frame.rightEyeBottom.y - frame.rightEyeTop.y) / eyeSpan;
  const blinkLeft = Math.max(0, Math.min(1, 1 - eyeOpenL / 0.18));
  const blinkRight = Math.max(0, Math.min(1, 1 - eyeOpenR / 0.18));

  const mouthH = Math.abs(frame.mouthBottom.y - frame.mouthTop.y) / eyeSpan;
  const mouthW = Math.hypot(
    frame.mouthRight.x - frame.mouthLeft.x,
    frame.mouthRight.y - frame.mouthLeft.y,
  ) / eyeSpan;

  return {
    timestampMs: frame.timestampMs,
    headYawDeg,
    headPitchDeg,
    headRollDeg,
    blinkLeft,
    blinkRight,
    mouthOpen: Math.max(0, Math.min(1, mouthH / 0.45)),
    mouthWidth: Math.max(0.1, Math.min(1, mouthW / 0.9)),
    handLeft: frame.leftWrist ?? { x: 0.3, y: 0.8 },
    handRight: frame.rightWrist ?? { x: 0.7, y: 0.8 },
    source: "webcam",
    videoLeavesDevice: false,
  };
}

export interface TrackingFallbackInput {
  readonly cameraPermission: "granted" | "denied" | "prompt";
  readonly landmarkFrame?: WebcamLandmarkFrame;
  readonly cursor: {
    readonly x: number;
    readonly y: number;
    readonly viewportWidth: number;
    readonly viewportHeight: number;
    readonly timestampMs?: number;
  };
}

/**
 * Resolve tracking signals from webcam landmarks when permitted, automatically
 * falling back to cursor coordinates when the camera is denied or absent.
 */
export function resolveTrackingInputWithFallback(
  input: TrackingFallbackInput,
): TrackedRigSignals {
  if (input.cameraPermission === "granted" && input.landmarkFrame) {
    return extractRigSignalsFromLandmarks(input.landmarkFrame);
  }
  const w = Math.max(1, input.cursor.viewportWidth);
  const h = Math.max(1, input.cursor.viewportHeight);
  const nx = Math.max(-1, Math.min(1, (input.cursor.x / w) * 2 - 1));
  const ny = Math.max(-1, Math.min(1, (input.cursor.y / h) * 2 - 1));

  return {
    timestampMs: input.cursor.timestampMs ?? 0,
    headYawDeg: nx * 35,
    headPitchDeg: ny * 25,
    headRollDeg: nx * 8,
    blinkLeft: 0,
    blinkRight: 0,
    mouthOpen: 0,
    mouthWidth: 0.5,
    handLeft: { x: 0.25 + nx * 0.15, y: 0.65 + ny * 0.15 },
    handRight: { x: 0.75 + nx * 0.15, y: 0.65 + ny * 0.15 },
    source: "cursor-fallback",
    videoLeavesDevice: false,
  };
}

/** Record landmark frames into a replayable tracking tape. */
export function recordTrackingTape(
  id: string,
  frames: readonly WebcamLandmarkFrame[],
): RecordedTrackingTape {
  return {
    id,
    frames: frames
      .map(extractRigSignalsFromLandmarks)
      .sort((a, b) => a.timestampMs - b.timestampMs),
  };
}

/** Replay a recorded tracking tape deterministically at `timestampMs`. */
export function replayTrackingTape(
  tape: RecordedTrackingTape,
  timestampMs: number,
): TrackedRigSignals | null {
  if (tape.frames.length === 0) return null;
  if (timestampMs <= tape.frames[0].timestampMs) return tape.frames[0];
  const last = tape.frames[tape.frames.length - 1];
  if (timestampMs >= last.timestampMs) return last;

  for (let i = 1; i < tape.frames.length; i++) {
    const f0 = tape.frames[i - 1];
    const f1 = tape.frames[i];
    if (timestampMs <= f1.timestampMs) {
      const span = f1.timestampMs - f0.timestampMs;
      const u = span <= 1e-6 ? 1 : (timestampMs - f0.timestampMs) / span;
      const lerp = (a: number, b: number) => a + (b - a) * u;
      return {
        timestampMs,
        headYawDeg: lerp(f0.headYawDeg, f1.headYawDeg),
        headPitchDeg: lerp(f0.headPitchDeg, f1.headPitchDeg),
        headRollDeg: lerp(f0.headRollDeg, f1.headRollDeg),
        blinkLeft: lerp(f0.blinkLeft, f1.blinkLeft),
        blinkRight: lerp(f0.blinkRight, f1.blinkRight),
        mouthOpen: lerp(f0.mouthOpen, f1.mouthOpen),
        mouthWidth: lerp(f0.mouthWidth, f1.mouthWidth),
        handLeft: {
          x: lerp(f0.handLeft.x, f1.handLeft.x),
          y: lerp(f0.handLeft.y, f1.handLeft.y),
        },
        handRight: {
          x: lerp(f0.handRight.x, f1.handRight.x),
          y: lerp(f0.handRight.y, f1.handRight.y),
        },
        source: f0.source,
        videoLeavesDevice: false,
      };
    }
  }
  return last;
}
