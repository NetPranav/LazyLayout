/**
 * The copies a layer draws (Design track D8, D9, D10), as CSS per copy: from its repeater or its cloner, then varied by its
 * effector. One function used by the renderer (the drawn page, Preview, the export) and by the live driver (a pointer
 * effector re-styles the copies every frame), so what the pointer does to a copy is always `copyStyles` with a pointer.
 *
 * The cloner wins over the repeater when both are on. Index and noise effectors need no pointer; a pointer effector with no
 * pointer leaves the copies as made.
 */
import { cloneTransform, clonerCopies, readCloner, type Box } from "./cloner";
import { effectCopy, influence, readEffector, type EffectorSettings } from "./effector";
import { readRepeater, repeatCopies, repeatPoint } from "./repeater";

export interface CopyStyle {
  /** 1-based; the layer itself is 0 and is not listed. */
  index: number;
  transform: string;
  origin: string;
  opacity: number;
  /** CSS `filter` for a hue turn, or undefined. */
  filter?: string;
}

/** What the page is doing right now, for effectors that react to it. Absent: the copies are as made. */
export interface LiveInputs {
  pointer?: { x: number; y: number } | null;
  /** How far the previewed frame is scrolled, 0..1. */
  progress?: number | null;
}

/** A layer's copies as made (before any live effect), each with where its centre is, in the coordinates of the layer's parent. */
export interface BaseCopy extends CopyStyle {
  centre: [number, number];
}

export function baseCopies(get: (path: string) => unknown, frame: Box, parent: { width: number; height: number }): BaseCopy[] {
  const cloner = readCloner(get);
  const repeater = cloner ? null : readRepeater(get);
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  if (cloner) {
    return clonerCopies(cloner, frame, parent).map((c) => ({ index: c.index, transform: cloneTransform(c), origin: `${cx}px ${cy}px`, opacity: 1, centre: [cx + c.dx, cy + c.dy] as [number, number] }));
  }
  if (repeater) return repeatCopies(repeater, frame).map((c) => ({ ...c, centre: repeatPoint(repeater, frame, c.index, [cx, cy]) }));
  return [];
}

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** One copy as the effector changes it: its CSS when the field's influence on it is `f` (not 0). The one place that writes this string. */
export function effectedStyle(c: CopyStyle, effector: EffectorSettings, f: number): CopyStyle {
  const e = effectCopy(effector, f);
  // the shift first (outermost), then the copy's own transform, then the size change about the layer's centre
  return { ...c, transform: `translate(${r4(e.dx)}px, ${r4(e.dy)}px) ${c.transform} scale(${r4(e.scale)})`, opacity: r4(c.opacity * e.opacity), ...(e.hue !== 0 ? { filter: `hue-rotate(${Math.round(e.hue * 100) / 100}deg)` } : {}) };
}

/** The influence of a live field on one copy, given what the page is doing. */
export function liveInfluence(effector: EffectorSettings, centre: [number, number], index: number, count: number, live: LiveInputs): number {
  const distance = live.pointer ? Math.hypot(centre[0] - live.pointer.x, centre[1] - live.pointer.y) : undefined;
  return influence(effector, index, count, distance, live.progress ?? undefined);
}

export function copyStyles(
  get: (path: string) => unknown,
  frame: Box,
  parent: { width: number; height: number },
  live: LiveInputs = {},
): CopyStyle[] {
  const base = baseCopies(get, frame, parent);
  const effector = readEffector(get);
  if (!effector || base.length === 0) return base.map(({ centre: _c, ...c }) => c);
  const count = base.length + 1;
  return base.map(({ centre, ...c }) => {
    const f = liveInfluence(effector, centre, c.index, count, live);
    return f === 0 ? c : effectedStyle(c, effector, f);
  });
}

/** True when a layer has copies that react to the pointer or the scroll (so the live driver must style them). */
export const hasLiveEffector = (get: (path: string) => unknown): boolean => {
  const e = readEffector(get);
  return !!e && (e.mode === "pointer" || e.mode === "scroll") && (readCloner(get) !== null || readRepeater(get) !== null);
};
