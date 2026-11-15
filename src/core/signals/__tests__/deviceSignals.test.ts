import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { busFrame, newBusState, type InputSource } from "../../bindings/inputBus";
import { DeviceSignalController, sampleAudioBins, sampleCameraPixels, sampleGamepadState, createAudioAnalyzerState, createCameraAnalyzerState } from "../deviceSignals";

describe("Phase 135 — Microphone, Camera, Gamepad & Device Tilt Signals", () => {
  it("falls back safely to zeros when permission is denied or unavailable", () => {
    const ctrl = new DeviceSignalController();
    ctrl.setPermission("audio", "denied");
    ctrl.setPermission("camera", "unavailable");
    ctrl.setPermission("tilt", "denied");
    const snap = ctrl.update({
      dt: 1 / 60,
      audioBins: new Uint8Array([255, 255, 255, 255]),
      cameraRgba: new Uint8Array([255, 255, 255, 255]),
      gamepad: null,
      orientation: { alpha: 90, beta: 30, gamma: -20 },
    });
    assert.equal(snap.audio.level, 0);
    assert.equal(snap.audio.beat, false);
    assert.equal(snap.camera.brightness, 0);
    assert.equal(snap.tilt.tiltX, 0);
    assert.equal(snap.gamepad.connected, false);
  });

  it("extracts audio frequency bands & beats, camera brightness & motion, gamepad sticks, and calibrated tilt", () => {
    const audioSt = createAudioAnalyzerState("granted");
    const quiet = sampleAudioBins(new Uint8Array([10, 10, 10, 10, 10, 10, 10, 10]), 1 / 60, audioSt);
    assert.equal(quiet.beat, false);
    const kick = sampleAudioBins(new Uint8Array([240, 220, 40, 20, 10, 10, 10, 10]), 1 / 60, audioSt);
    assert.equal(kick.beat, true);
    assert.ok(kick.bass > kick.treble);

    const camSt = createCameraAnalyzerState("granted");
    const dark = sampleCameraPixels(new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255]), camSt);
    assert.equal(dark.brightness, 0);
    const lit = sampleCameraPixels(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]), camSt);
    assert.ok(lit.brightness > 0.99);
    assert.ok(lit.motion > 0.5);

    const pad = sampleGamepadState({ connected: true, axes: [0.05, -0.5, 1, 0], buttons: [{ value: 1 }] }, 0.1);
    assert.equal(pad.stickLX, 0); // inside deadzone
    assert.ok(pad.stickLY < 0);
    assert.equal(pad.stickRX, 1);
    assert.equal(pad.buttons[0], 1);

    const ctrl = new DeviceSignalController();
    ctrl.setPermission("tilt", "granted");
    ctrl.setPermission("audio", "granted");
    ctrl.update({ dt: 1 / 60, orientation: { alpha: 100, beta: 20, gamma: 15 } });
    ctrl.calibrateTilt();
    const afterCal = ctrl.update({
      dt: 1 / 60,
      audioBins: new Uint8Array([255, 255, 128, 64, 64, 64, 32, 32]),
      orientation: { alpha: 100, beta: 20, gamma: 60 }, // +45 deg gamma
    });
    assert.equal(afterCal.tilt.tiltY, 0);
    assert.equal(afterCal.tilt.tiltX, 1);

    const src: InputSource = {
      pointer: () => null,
      pageSize: () => ({ width: 800, height: 600 }),
      scroll: () => ({ y: 0, max: 0 }),
      device: () => afterCal.tilt,
      audio: () => afterCal.audio,
    };
    const frame = busFrame(src, newBusState(), 0, 1 / 60);
    assert.equal(frame.read({ kind: "device", channel: "tiltX" }), 1);
    assert.ok((frame.read({ kind: "audio", layer: "mic", channel: "band", band: 1 }) as number) > 0.9);
  });
});
