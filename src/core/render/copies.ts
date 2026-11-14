/**
 * The copies a layer draws (Design track D8, D9, D10), as CSS per copy: from its repeater or its cloner, then varied by its
 * effector. One function used by the renderer (the drawn page, Preview, the export) and by the live driver (a pointer
 * effector re-styles the copies every frame), so what the pointer does to a copy is always `copyStyles` with a pointer.
 *
 * The cloner wins over the repeater when both are on. Index and noise effectors need no pointer; a pointer effector with no
 * pointer leaves the copies as made.
 */
import { cloneTransform, clonerCopies, readCloner, type Box } from "./cloner";
import { effectCopy, influence, readEffector } from "./effector";
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

export function copyStyles(
  get: (path: string) => unknown,
  frame: Box,
  parent: { width: number; height: number },
  live: LiveInputs = {},
): CopyStyle[] {
  const cloner = readCloner(get);
  const repeater = cloner ? null : readRepeater(get);
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  let base: (CopyStyle & { centre: [number, number] })[] = [];
  if (cloner) {
    base = clonerCopies(cloner, frame, parent).map((c) => ({ index: c.index, transform: cloneTransform(c), origin: `${cx}px ${cy}px`, opacity: 1, centre: [cx + c.dx, cy + c.dy] }));
  } else if (repeater) {
    base = repeatCopies(repeater, frame).map((c) => ({ ...c, centre: repeatPoint(repeater, frame, c.index, [cx, cy]) }));
  }
  const effector = readEffector(get);
  if (!effector || base.length === 0) return base.map(({ centre: _c, ...c }) => c);
  const count = base.length + 1;
  return base.map(({ centre, ...c }) => {
    const distance = live.pointer ? Math.hypot(centre[0] - live.pointer.x, centre[1] - live.pointer.y) : undefined;
    const f = influence(effector, c.index, count, distance, live.progress ?? undefined);
    if (f === 0) return c;
    const e = effectCopy(effector, f);
    // the shift first (outermost), then the copy's own transform, then the size change about the layer's centre
    return { ...c, transform: `translate(${Math.round(e.dx * 1e4) / 1e4}px, ${Math.round(e.dy * 1e4) / 1e4}px) ${c.transform} scale(${Math.round(e.scale * 1e4) / 1e4})`, opacity: Math.round(c.opacity * e.opacity * 1e4) / 1e4, ...(e.hue !== 0 ? { filter: `hue-rotate(${Math.round(e.hue * 100) / 100}deg)` } : {}) };
  });
}

/** True when a layer has copies that react to the pointer or the scroll (so the live driver must style them). */
export const hasLiveEffector = (get: (path: string) => unknown): boolean => {
  const e = readEffector(get);
  return !!e && (e.mode === "pointer" || e.mode === "scroll") && (readCloner(get) !== null || readRepeater(get) !== null);
};
