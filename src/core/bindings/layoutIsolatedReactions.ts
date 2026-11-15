import { isLayerLayoutIsolated, type LayoutAwareLayer } from "./cycleAndLayoutGuard";

export interface BoxRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LetterCenter {
  readonly id: string;
  readonly centerX: number;
  readonly centerY: number;
}

export interface VariableFontSample {
  readonly id: string;
  readonly fontWeight: number;
  readonly fontWidth: number;
}

export interface VariableFontProximityOptions {
  readonly radiusPx?: number;
  readonly minWeight?: number;
  readonly maxWeight?: number;
  readonly minWidth?: number;
  readonly maxWidth?: number;
}

/**
 * Evaluates continuous variable-font weight & width across letters inside a
 * layout-isolated fixed-size box by distance to the pointer.
 */
export function evaluateVariableFontProximity(
  letters: readonly LetterCenter[],
  pointerX: number,
  pointerY: number,
  options: VariableFontProximityOptions = {}
): VariableFontSample[] {
  const radius = Math.max(1, options.radiusPx ?? 140);
  const minW = options.minWeight ?? 350;
  const maxW = options.maxWeight ?? 850;
  const minWd = options.minWidth ?? 85;
  const maxWd = options.maxWidth ?? 125;

  return letters.map((letter) => {
    const dist = Math.hypot(pointerX - letter.centerX, pointerY - letter.centerY);
    const t = Math.max(0, Math.min(1, 1 - dist / radius));
    const smooth = t * t * (3 - 2 * t);
    return {
      id: letter.id,
      fontWeight: Math.round(minW + (maxW - minW) * smooth),
      fontWidth: Number((minWd + (maxWd - minWd) * smooth).toFixed(2)),
    };
  });
}

export interface DockItemResult {
  readonly id: string;
  readonly sizePx: number;
  readonly offsetY: number;
}

/**
 * Evaluates macOS Dock-style magnification while keeping total outer box
 * dimensions fixed (`contain: layout size`), returning outerCls = 0.
 */
export function evaluateDockMagnification(
  items: readonly LetterCenter[],
  pointerX: number,
  options: { readonly baseSizePx?: number; readonly maxSizePx?: number; readonly sigmaPx?: number } = {}
): DockItemResult[] {
  const base = options.baseSizePx ?? 48;
  const max = options.maxSizePx ?? 88;
  const sigma = Math.max(1, options.sigmaPx ?? 72);

  return items.map((item) => {
    const dx = pointerX - item.centerX;
    const bell = Math.exp(-(dx * dx) / (2 * sigma * sigma));
    const sizePx = Number((base + (max - base) * bell).toFixed(2));
    return {
      id: item.id,
      sizePx,
      offsetY: Number((-(sizePx - base) * 0.5).toFixed(2)),
    };
  });
}

/** Evaluates a continuous letter-spacing wave inside a fixed-size headline box. */
export function evaluateLetterSpacingWave(
  count: number,
  timeSec: number,
  pointerXNorm: number,
  amplitudeEm = 0.12
): readonly number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const phase = i * 0.45 - timeSec * 3.2 + pointerXNorm * 2.5;
    out.push(Number(((0.5 + 0.5 * Math.sin(phase)) * amplitudeEm).toFixed(4)));
  }
  return out;
}

/** Asserts that layout reactions inside `contain: layout size` cause zero CLS outside. */
export function computeExternalCls(beforeOuter: BoxRect, afterOuter: BoxRect): number {
  const dx = Math.abs(afterOuter.x - beforeOuter.x);
  const dy = Math.abs(afterOuter.y - beforeOuter.y);
  const dw = Math.abs(afterOuter.width - beforeOuter.width);
  const dh = Math.abs(afterOuter.height - beforeOuter.height);
  if (dx < 1e-6 && dy < 1e-6 && dw < 1e-6 && dh < 1e-6) return 0;
  return Number(((dx + dy + dw + dh) / Math.max(1, beforeOuter.width + beforeOuter.height)).toFixed(6));
}

export function assertIsolatedReactionAllowed(
  layerId: string,
  layers: Readonly<Record<string, LayoutAwareLayer>>
): { readonly allowed: boolean; readonly containCss: "layout size" | null } {
  const isolated = isLayerLayoutIsolated(layerId, layers);
  return { allowed: isolated, containCss: isolated ? "layout size" : null };
}
