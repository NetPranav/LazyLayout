/**
 * Phase 135 — Permission-Gated Device Inputs: Microphone, Camera, Gamepad & Tilt.
 *
 * Pure signal extraction & state machine with clean fallbacks when hardware is
 * missing or permission is denied (nothing is uploaded). Feeds both live Preview
 * (`inputBus`) and deterministic Input Tapes (Phase 136).
 */

export type PermissionStatus = "prompt" | "granted" | "denied" | "unavailable";

export interface AudioFrame {
  readonly status: PermissionStatus;
  readonly level: number;
  readonly bass: number;
  readonly mid: number;
  readonly treble: number;
  readonly beat: boolean;
  readonly bands: readonly number[];
}

export interface CameraFrame {
  readonly status: PermissionStatus;
  readonly brightness: number;
  readonly motion: number;
}

export interface GamepadFrame {
  readonly connected: boolean;
  readonly stickLX: number;
  readonly stickLY: number;
  readonly stickRX: number;
  readonly stickRY: number;
  readonly buttons: readonly number[];
}

export interface TiltFrame {
  readonly status: PermissionStatus;
  readonly tiltX: number;
  readonly tiltY: number;
  readonly orientation: number;
}

export interface DeviceSignalsSnapshot {
  readonly audio: AudioFrame;
  readonly camera: CameraFrame;
  readonly gamepad: GamepadFrame;
  readonly tilt: TiltFrame;
}

export const DEFAULT_AUDIO_FRAME: AudioFrame = { status: "prompt", level: 0, bass: 0, mid: 0, treble: 0, beat: false, bands: [0, 0, 0, 0] };
export const DEFAULT_CAMERA_FRAME: CameraFrame = { status: "prompt", brightness: 0, motion: 0 };
export const DEFAULT_GAMEPAD_FRAME: GamepadFrame = { connected: false, stickLX: 0, stickLY: 0, stickRX: 0, stickRY: 0, buttons: [] };
export const DEFAULT_TILT_FRAME: TiltFrame = { status: "prompt", tiltX: 0, tiltY: 0, orientation: 0 };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp11 = (v: number) => Math.max(-1, Math.min(1, v));

export interface AudioAnalyzerState {
  status: PermissionStatus;
  prevEnergy: number;
  cooldownSec: number;
}

export function createAudioAnalyzerState(status: PermissionStatus = "prompt"): AudioAnalyzerState {
  return { status, prevEnergy: 0, cooldownSec: 0 };
}

/** Extracts `level`, `bass`, `mid`, `treble`, and `beat` from 0..255 FFT frequency bins. */
export function sampleAudioBins(bins: ArrayLike<number>, dt: number, state: AudioAnalyzerState): AudioFrame {
  if (state.status !== "granted" || bins.length === 0) {
    return { ...DEFAULT_AUDIO_FRAME, status: state.status };
  }
  const n = bins.length;
  const bassEnd = Math.max(1, Math.floor(n * 0.15));
  const midEnd = Math.max(bassEnd + 1, Math.floor(n * 0.5));
  let sumAll = 0;
  let sumBass = 0;
  let sumMid = 0;
  let sumTreble = 0;

  for (let i = 0; i < n; i++) {
    const v = clamp01(bins[i] / 255);
    sumAll += v;
    if (i < bassEnd) sumBass += v;
    else if (i < midEnd) sumMid += v;
    else sumTreble += v;
  }

  const level = clamp01(sumAll / n);
  const bass = clamp01(sumBass / bassEnd);
  const mid = clamp01(sumMid / Math.max(1, midEnd - bassEnd));
  const treble = clamp01(sumTreble / Math.max(1, n - midEnd));

  state.cooldownSec = Math.max(0, state.cooldownSec - Math.max(0, dt));
  const flux = bass - state.prevEnergy;
  const beat = state.cooldownSec <= 0 && bass > 0.25 && flux > 0.14;
  if (beat) state.cooldownSec = 0.22;
  state.prevEnergy = state.prevEnergy * 0.8 + bass * 0.2;

  return { status: "granted", level, bass, mid, treble, beat, bands: [level, bass, mid, treble] };
}

export interface CameraAnalyzerState {
  status: PermissionStatus;
  prevLuma: Float32Array | null;
}

export function createCameraAnalyzerState(status: PermissionStatus = "prompt"): CameraAnalyzerState {
  return { status, prevLuma: null };
}

/** Computes mean `brightness` (0..1) and frame-diff `motion` (0..1) from RGBA pixel bytes. Nothing leaves the browser. */
export function sampleCameraPixels(rgba: ArrayLike<number>, state: CameraAnalyzerState): CameraFrame {
  if (state.status !== "granted" || rgba.length < 4) {
    return { ...DEFAULT_CAMERA_FRAME, status: state.status };
  }
  const pxCount = Math.floor(rgba.length / 4);
  const luma = new Float32Array(pxCount);
  let totalBright = 0;
  let totalDiff = 0;
  const prev = state.prevLuma;
  for (let i = 0; i < pxCount; i++) {
    const idx = i * 4;
    const y = (0.2126 * rgba[idx] + 0.7152 * rgba[idx + 1] + 0.0722 * rgba[idx + 2]) / 255;
    luma[i] = y;
    totalBright += y;
    if (prev && prev.length === pxCount) totalDiff += Math.abs(y - prev[i]);
  }
  state.prevLuma = luma;
  return {
    status: "granted",
    brightness: clamp01(totalBright / pxCount),
    motion: prev && prev.length === pxCount ? clamp01((totalDiff / pxCount) * 3) : 0,
  };
}

/** Samples standard gamepad axes (with deadzone) and button pressures. */
export function sampleGamepadState(
  pad: { connected: boolean; axes: readonly number[]; buttons: readonly { value: number }[] } | null,
  deadzone = 0.12
): GamepadFrame {
  if (!pad || !pad.connected) return DEFAULT_GAMEPAD_FRAME;
  const axis = (raw: number | undefined) => {
    const v = raw ?? 0;
    if (Math.abs(v) <= deadzone) return 0;
    return clamp11((Math.sign(v) * (Math.abs(v) - deadzone)) / (1 - deadzone));
  };
  return {
    connected: true,
    stickLX: axis(pad.axes[0]),
    stickLY: axis(pad.axes[1]),
    stickRX: axis(pad.axes[2]),
    stickRY: axis(pad.axes[3]),
    buttons: pad.buttons.map((b) => clamp01(b.value)),
  };
}

export interface TiltCalibrationState {
  status: PermissionStatus;
  zeroBeta: number;
  zeroGamma: number;
  zeroAlpha: number;
  maxTiltDeg: number;
  rawAlpha: number;
  rawBeta: number;
  rawGamma: number;
}

export function createTiltCalibrationState(status: PermissionStatus = "prompt", maxTiltDeg = 45): TiltCalibrationState {
  return { status, zeroBeta: 0, zeroGamma: 0, zeroAlpha: 0, maxTiltDeg, rawAlpha: 0, rawBeta: 0, rawGamma: 0 };
}

/** Zero-calibrates phone/tablet tilt around current ergonomic holding posture. */
export function calibrateDeviceTilt(state: TiltCalibrationState): void {
  state.zeroAlpha = state.rawAlpha;
  state.zeroBeta = state.rawBeta;
  state.zeroGamma = state.rawGamma;
}

export function sampleDeviceTilt(
  reading: { alpha: number | null; beta: number | null; gamma: number | null } | null,
  state: TiltCalibrationState
): TiltFrame {
  if (state.status !== "granted" || !reading) {
    return { ...DEFAULT_TILT_FRAME, status: state.status };
  }
  state.rawAlpha = reading.alpha ?? 0;
  state.rawBeta = reading.beta ?? 0;
  state.rawGamma = reading.gamma ?? 0;
  const maxD = Math.max(1, state.maxTiltDeg);
  return {
    status: "granted",
    tiltX: clamp11((state.rawGamma - state.zeroGamma) / maxD),
    tiltY: clamp11((state.rawBeta - state.zeroBeta) / maxD),
    orientation: ((state.rawAlpha - state.zeroAlpha) % 360 + 360) % 360,
  };
}

export class DeviceSignalController {
  readonly audioState = createAudioAnalyzerState("prompt");
  readonly cameraState = createCameraAnalyzerState("prompt");
  readonly tiltState = createTiltCalibrationState("prompt");
  private lastGamepad: GamepadFrame = DEFAULT_GAMEPAD_FRAME;
  private latestSnapshot: DeviceSignalsSnapshot = {
    audio: DEFAULT_AUDIO_FRAME,
    camera: DEFAULT_CAMERA_FRAME,
    gamepad: DEFAULT_GAMEPAD_FRAME,
    tilt: DEFAULT_TILT_FRAME,
  };

  setPermission(kind: "audio" | "camera" | "tilt", status: PermissionStatus): void {
    if (kind === "audio") this.audioState.status = status;
    else if (kind === "camera") this.cameraState.status = status;
    else this.tiltState.status = status;
  }

  calibrateTilt(): void {
    calibrateDeviceTilt(this.tiltState);
  }

  update(inputs: {
    dt: number;
    audioBins?: ArrayLike<number>;
    cameraRgba?: ArrayLike<number>;
    gamepad?: { connected: boolean; axes: readonly number[]; buttons: readonly { value: number }[] } | null;
    orientation?: { alpha: number | null; beta: number | null; gamma: number | null } | null;
  }): DeviceSignalsSnapshot {
    const audio = inputs.audioBins
      ? sampleAudioBins(inputs.audioBins, inputs.dt, this.audioState)
      : { ...DEFAULT_AUDIO_FRAME, status: this.audioState.status };
    const camera = inputs.cameraRgba
      ? sampleCameraPixels(inputs.cameraRgba, this.cameraState)
      : { ...DEFAULT_CAMERA_FRAME, status: this.cameraState.status };
    if (inputs.gamepad !== undefined) {
      this.lastGamepad = sampleGamepadState(inputs.gamepad);
    }
    const tilt = inputs.orientation !== undefined
      ? sampleDeviceTilt(inputs.orientation, this.tiltState)
      : { ...DEFAULT_TILT_FRAME, status: this.tiltState.status };
    this.latestSnapshot = { audio, camera, gamepad: this.lastGamepad, tilt };
    return this.latestSnapshot;
  }

  snapshot(): DeviceSignalsSnapshot {
    return this.latestSnapshot;
  }
}
