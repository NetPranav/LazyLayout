import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FULL_EFFECT_LIBRARY } from "../../effects/libraryWaves10To13";
import type { RasterBitmap } from "../../gpu/sceneRasteriser";
import {
  auditInteractiveAccessibility,
  detectGpuFrameFlashes,
  evaluateDynamicBackgroundContrast,
  evaluateInteractiveReducedMotion,
} from "../interactiveAccessibility";

function solidBitmap(r: number, g: number, b: number, w = 8, h = 8): RasterBitmap {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    const idx = i * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe("Phase 199: Interactive accessibility (closes AUD-14)", () => {
  it("eliminates spatial movement across reducedMotion freeze/calm/off policies under pointer tapes", () => {
    for (const policy of ["freeze", "calm", "off"] as const) {
      const out = evaluateInteractiveReducedMotion(
        policy,
        { dxPx: 42, dyPx: -18, rotationDeg: 25, opacity: 0.8 },
        true
      );
      assert.equal(out.dxPx, 0);
      assert.equal(out.dyPx, 0);
      assert.equal(out.rotationDeg, 0);
    }
  });

  it("detects unsafe > 3 flashes/s on sampled GPU frames and low dynamic contrast", () => {
    const strobe: RasterBitmap[] = [];
    for (let f = 0; f < 16; f += 1) {
      strobe.push(f % 2 === 0 ? solidBitmap(255, 255, 255) : solidBitmap(0, 0, 0));
    }
    const flash = detectGpuFrameFlashes(strobe, 1.0);
    assert.equal(flash.safe, false);
    assert.ok(flash.flashesPerSec > 3);

    const contrast = evaluateDynamicBackgroundContrast(
      { r: 220, g: 220, b: 230, a: 255 },
      [solidBitmap(20, 20, 20), solidBitmap(200, 200, 210)]
    );
    assert.equal(contrast.passes, false);
    assert.ok(contrast.minContrastRatio < 2);
  });

  it("audits rules 6.12–6.15 and returns 0 violations on compliant interactive exports", () => {
    const effect = FULL_EFFECT_LIBRARY[0]!;
    const bad = auditInteractiveAccessibility({
      effect,
      durationSec: 8,
      isEssentialMotion: false,
      hasPauseControl: false,
      hidesNativeCursorOverInput: true,
      targetDriftDuringHoverPx: 12,
      focusIndicatorSuppressed: true,
    });
    assert.equal(bad.length, 4);
    assert.ok(bad.every((d) => typeof d.applyQuickFix === "function"));

    const clean = auditInteractiveAccessibility({
      effect,
      durationSec: 8,
      isEssentialMotion: false,
      hasPauseControl: true,
      hidesNativeCursorOverInput: false,
      targetDriftDuringHoverPx: 0,
      focusIndicatorSuppressed: false,
      gpuFrames: [solidBitmap(20, 24, 34), solidBitmap(22, 26, 36), solidBitmap(21, 25, 35)],
      foregroundTextColor: { r: 248, g: 250, b: 252, a: 255 },
    });
    assert.equal(clean.length, 0);
  });
});

describe("Phase 199 · flash check uses the worst second and each region (review 2026-11-17)", () => {
  it("a 1-second strobe inside a 10-second capture is unsafe", () => {
    const frames: RasterBitmap[] = [];
    // 10 s at 10 fps: grey for 9 s, then 10 frames of black/white strobe.
    for (let f = 0; f < 90; f += 1) frames.push(solidBitmap(128, 128, 128));
    for (let f = 0; f < 11; f += 1) frames.push(f % 2 === 0 ? solidBitmap(255, 255, 255) : solidBitmap(0, 0, 0));
    const flash = detectGpuFrameFlashes(frames, 10);
    assert.equal(flash.safe, false, `worst second ${flash.flashesPerSec}/s`);
  });

  it("a strobe in one corner of a still frame is unsafe", () => {
    const corner = (on: boolean): RasterBitmap => {
      const bmp = solidBitmap(40, 40, 40, 64, 64);
      for (let y = 0; y < 16; y += 1) {
        for (let x = 0; x < 16; x += 1) {
          const i = (y * 64 + x) * 4;
          bmp.data[i] = bmp.data[i + 1] = bmp.data[i + 2] = on ? 255 : 0;
        }
      }
      return bmp;
    };
    const frames: RasterBitmap[] = [];
    for (let f = 0; f < 16; f += 1) frames.push(corner(f % 2 === 0));
    assert.equal(detectGpuFrameFlashes(frames, 1).safe, false);
  });
});
