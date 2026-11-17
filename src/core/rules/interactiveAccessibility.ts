/**
 * @file interactiveAccessibility.ts
 * @module core/rules/interactiveAccessibility
 * @description Phase 199 (closes AUD-14): Interactive accessibility verifier
 * & runtime safeguards — per-effect reduced-motion policy (`freeze`, `calm`,
 * `off`), > 5 s pause control & page-wide toggle, GPU sampled frame WCAG 2.3.1
 * flash detector, dynamic contrast over animated backgrounds, target stability,
 * cursor safeguards, runtime rules 6.12–6.15, and one-click inspector fixes.
 */

import type { EffectDefinitionV1, ReducedMotionPolicy } from "../effects/effectSdk";
import type { RasterBitmap, RgbaColor } from "../gpu/sceneRasteriser";
import { resolveNativeCursorHidden } from "../signals/cursorOverlay";
import { MAX_FLASHES_PER_SECOND } from "./accessibility";

export interface ReducedMotionOutput {
  readonly policy: ReducedMotionPolicy;
  readonly active: boolean;
  readonly dxPx: number;
  readonly dyPx: number;
  readonly rotationDeg: number;
  readonly opacity: number;
}

export interface AccessibilityDiagnostic {
  readonly ruleId: "6.12" | "6.13" | "6.14" | "6.15" | "WCAG-2.3.1" | "WCAG-1.4.3";
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly quickFixLabel: string;
  readonly applyQuickFix?: () => Record<string, unknown>;
}

/** Enforce zero spatial displacement whenever `reducedMotion` is enabled. */
export function evaluateInteractiveReducedMotion(
  policy: ReducedMotionPolicy,
  spatialSample: { readonly dxPx: number; readonly dyPx: number; readonly rotationDeg: number; readonly opacity: number },
  reducedMotion: boolean
): ReducedMotionOutput {
  if (!reducedMotion) {
    return { policy, active: true, ...spatialSample };
  }
  if (policy === "off") {
    return { policy, active: false, dxPx: 0, dyPx: 0, rotationDeg: 0, opacity: 1 };
  }
  if (policy === "freeze") {
    return { policy, active: true, dxPx: 0, dyPx: 0, rotationDeg: 0, opacity: 1 };
  }
  // calm: zero spatial movement, gentle opacity crossfade only
  const dampedOpacity = 0.85 + Math.max(0, Math.min(1, spatialSample.opacity)) * 0.15;
  return { policy, active: true, dxPx: 0, dyPx: 0, rotationDeg: 0, opacity: Number(dampedOpacity.toFixed(3)) };
}

/** WCAG 2.1 relative luminance `0..1` from sRGB bytes `0..255`. */
export function relativeLuminance(c: RgbaColor): number {
  const chan = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(c.r) + 0.7152 * chan(c.g) + 0.0722 * chan(c.b);
}

export function contrastRatio(a: RgbaColor, b: RgbaColor): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Sample mean luminance per GPU frame and count WCAG 2.3.1 luminance reversals/sec. */
/**
 * Flash check over sampled frames (WCAG 2.3.1: no more than 3 flashes in any one second).
 *
 * Each frame is split into a 4x4 grid and every cell is checked on its own, so a flash in part of the frame isn't
 * averaged away by a still background. A flash is a pair of opposing luminance swings of at least 0.1 where the
 * darker side is below 0.8. The rate is the most flashes in any 1-second window, not the average over the capture.
 * Review 2026-11-17: it used to average the whole frame and divide the flash count by the total duration, so 10
 * flashes in one second of a 10 s capture read as 1/s.
 */
export function detectGpuFrameFlashes(
  frames: readonly RasterBitmap[],
  totalDurationSec: number
): { readonly flashesPerSec: number; readonly safe: boolean; readonly measured: boolean } {
  // Fewer than 3 frames, or no duration: nothing to measure. `safe` stays true so it raises no diagnostic, and
  // `measured: false` says the check did not run (it is not a pass).
  if (frames.length < 3 || totalDurationSec <= 0) {
    return { flashesPerSec: 0, safe: true, measured: false };
  }
  const GRID = 4;
  const frameTime = (i: number) => (i * totalDurationSec) / (frames.length - 1);

  /** Mean relative luminance of each grid cell of one frame (sampled, at most ~64 pixels per cell). */
  const cellLums = (bmp: RasterBitmap): number[] => {
    const out: number[] = [];
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const x0 = Math.floor((gx * bmp.width) / GRID);
        const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * bmp.width) / GRID));
        const y0 = Math.floor((gy * bmp.height) / GRID);
        const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * bmp.height) / GRID));
        const stepX = Math.max(1, Math.floor((x1 - x0) / 8));
        const stepY = Math.max(1, Math.floor((y1 - y0) / 8));
        let sum = 0;
        let count = 0;
        for (let y = y0; y < Math.min(y1, bmp.height); y += stepY) {
          for (let x = x0; x < Math.min(x1, bmp.width); x += stepX) {
            const idx = (y * bmp.width + x) * 4;
            sum += relativeLuminance({ r: bmp.data[idx]!, g: bmp.data[idx + 1]!, b: bmp.data[idx + 2]!, a: 255 });
            count += 1;
          }
        }
        out.push(count > 0 ? sum / count : 0);
      }
    }
    return out;
  };

  const perFrame = frames.map(cellLums);
  let worst = 0;
  for (let cell = 0; cell < GRID * GRID; cell++) {
    const lums = perFrame.map((f) => f[cell] ?? 0);
    // Times of qualifying swing reversals in this cell.
    const swings: number[] = [];
    let prevDir: 1 | -1 | 0 = 0;
    let lastExtreme = lums[0]!;
    for (let i = 1; i < lums.length; i += 1) {
      const delta = lums[i]! - lums[i - 1]!;
      if (Math.abs(delta) < 1e-4) continue;
      const dir: 1 | -1 = delta > 0 ? 1 : -1;
      if (prevDir !== 0 && dir !== prevDir) {
        const swing = Math.abs(lums[i - 1]! - lastExtreme);
        if (swing >= 0.1 && Math.min(lums[i - 1]!, lastExtreme) < 0.8) swings.push(frameTime(i - 1));
        lastExtreme = lums[i - 1]!;
      }
      prevDir = dir;
    }
    // The last swing ends at the final frame.
    const lastSwing = Math.abs(lums[lums.length - 1]! - lastExtreme);
    if (prevDir !== 0 && lastSwing >= 0.1 && Math.min(lums[lums.length - 1]!, lastExtreme) < 0.8) {
      swings.push(frameTime(lums.length - 1));
    }
    // Most swings inside any 1-second window; two swings make one flash.
    let lo = 0;
    for (let hi = 0; hi < swings.length; hi += 1) {
      while (swings[hi]! - swings[lo]! > 1 + 1e-9) lo += 1;
      worst = Math.max(worst, Math.floor((hi - lo + 1) / 2));
    }
  }
  // For captures shorter than a second, scale up to a per-second rate.
  const flashesPerSec = totalDurationSec < 1 ? worst / totalDurationSec : worst;
  return {
    flashesPerSec,
    safe: flashesPerSec <= MAX_FLASHES_PER_SECOND,
    measured: true,
  };
}

/** Sample contrast across every animated background frame underneath foreground text. */
export function evaluateDynamicBackgroundContrast(
  textColor: RgbaColor,
  backgroundFrames: readonly RasterBitmap[],
  minRequiredRatio = 4.5
): { readonly minContrastRatio: number; readonly passes: boolean } {
  let minRatio = Number.POSITIVE_INFINITY;
  for (const bg of backgroundFrames) {
    if (bg.width === 0 || bg.height === 0) continue;
    const midIdx = (Math.floor(bg.height * 0.5) * bg.width + Math.floor(bg.width * 0.5)) * 4;
    const bgColor: RgbaColor = {
      r: bg.data[midIdx]!,
      g: bg.data[midIdx + 1]!,
      b: bg.data[midIdx + 2]!,
      a: 255,
    };
    minRatio = Math.min(minRatio, contrastRatio(textColor, bgColor));
  }
  if (!Number.isFinite(minRatio)) minRatio = 21;
  return { minContrastRatio: Number(minRatio.toFixed(2)), passes: minRatio >= minRequiredRatio };
}

export interface InteractiveA11yAuditInput {
  readonly effect: EffectDefinitionV1;
  readonly durationSec: number;
  readonly isEssentialMotion: boolean;
  readonly hasPauseControl: boolean;
  readonly hidesNativeCursorOverInput: boolean;
  readonly targetDriftDuringHoverPx: number;
  readonly focusIndicatorSuppressed: boolean;
  readonly gpuFrames?: readonly RasterBitmap[];
  readonly foregroundTextColor?: RgbaColor;
}

/** Audit runtime rules 6.12–6.15 and WCAG 2.3.1 / 1.4.3 / 2.2.2 with one-click fixes. */
export function auditInteractiveAccessibility(
  input: InteractiveA11yAuditInput
): readonly AccessibilityDiagnostic[] {
  const diags: AccessibilityDiagnostic[] = [];

  // Rule 6.12: Motion > 5 s must expose a pause control & page switch
  if (!input.isEssentialMotion && input.durationSec > 5 && !input.hasPauseControl) {
    diags.push({
      ruleId: "6.12",
      severity: "error",
      message: `Effect "${input.effect.name}" runs longer than 5s without a user pause control.`,
      quickFixLabel: "Add pause switch & bind to page toggle",
      applyQuickFix: () => ({ hasPauseControl: true, bindPagePauseToggle: true }),
    });
  }

  // Rule 6.13: Hit-target stability under hover/focus (<= 4 px drift)
  if (input.targetDriftDuringHoverPx > 4) {
    diags.push({
      ruleId: "6.13",
      severity: "error",
      message: `Interactive target shifts ${input.targetDriftDuringHoverPx}px during hover/focus (> 4px stability limit).`,
      quickFixLabel: "Move visual warp to decorative child wrapper",
      applyQuickFix: () => ({ separateHitTargetWrapper: true, maxDriftPx: 0 }),
    });
  }

  // Rule 6.14: Focus indicators & text-input native cursor must never be hidden
  if (input.focusIndicatorSuppressed) {
    diags.push({
      ruleId: "6.14",
      severity: "error",
      message: "Custom focus/cursor effect suppressed native focus ring.",
      quickFixLabel: "Restore focus-visible outline",
      applyQuickFix: () => ({ focusIndicatorSuppressed: false }),
    });
  }

  if (
    input.hidesNativeCursorOverInput ||
    resolveNativeCursorHidden(
      { surfaceMode: "preview", hideNativeCursorOptIn: true, reducedMotion: false },
      "mouse",
      { id: "inp", role: "text_input", x: 0, y: 0, width: 100, height: 32 }
    )
  ) {
    diags.push({
      ruleId: "6.15",
      severity: "error",
      message: "Native cursor must remain visible over text inputs.",
      quickFixLabel: "Restore native cursor on text inputs",
      applyQuickFix: () => ({ hidesNativeCursorOverInput: false }),
    });
  }

  if (input.gpuFrames && input.gpuFrames.length >= 3) {
    const flash = detectGpuFrameFlashes(input.gpuFrames, input.durationSec);
    if (!flash.safe) {
      diags.push({
        ruleId: "WCAG-2.3.1",
        severity: "error",
        message: `Sampled GPU output flashes at ${flash.flashesPerSec.toFixed(1)}/s (> ${MAX_FLASHES_PER_SECOND}/s).`,
        quickFixLabel: "Cap luminance swing below 0.1 & lower frequency",
        applyQuickFix: () => ({ clampLuminanceSwing: true }),
      });
    }
  }

  if (input.foregroundTextColor && input.gpuFrames && input.gpuFrames.length > 0) {
    const contrast = evaluateDynamicBackgroundContrast(
      input.foregroundTextColor,
      input.gpuFrames
    );
    if (!contrast.passes) {
      diags.push({
        ruleId: "WCAG-1.4.3",
        severity: "warning",
        message: `Dynamic contrast drops to ${contrast.minContrastRatio}:1 (< 4.5:1) during background motion.`,
        quickFixLabel: "Add adaptive 48% dark scrim behind text",
        applyQuickFix: () => ({ addContrastScrimOpacity: 0.48 }),
      });
    }
  }

  return diags;
}
