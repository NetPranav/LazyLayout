// Spring FLIP layout animation ported from Nook (the owner's own product)

import { getActivePreset, prefersReducedMotion } from "./feel";
import { springAnim } from "./ease";

const FLIP_SELECTOR =
  "[data-flip], .row, .tc-num, .tc-label, .tc-btn, .card-btn, .card";

export interface FlipSnapshot {
  box0: DOMRect;
  before: Map<Element, DOMRect>;
}

/**
 * Captures positions of elements before a layout change.
 */
export function measureFlip(root: HTMLElement): FlipSnapshot {
  const box0 = root.getBoundingClientRect();
  const before = new Map<Element, DOMRect>();
  for (const e of root.querySelectorAll(FLIP_SELECTOR)) {
    if ((e as HTMLElement).offsetParent !== null) {
      before.set(e, e.getBoundingClientRect());
    }
  }
  return { box0, before };
}

/**
 * Plays spring FLIP animations from a previously captured snapshot.
 */
export function playFlip(
  root: HTMLElement,
  snapshot: FlipSnapshot,
  engine?: {
    glide?: (dir?: 1 | -1 | 0) => void;
    bump?: (b: { w?: number; h?: number }) => void;
  } | null,
): void {
  if (prefersReducedMotion()) return;
  const p = getActivePreset();
  const { box0, before } = snapshot;

  if (p.flipKick && engine?.bump) {
    engine.bump({ h: p.flipKick, w: -p.flipKick * 0.5 });
  }

  const box1 = root.getBoundingClientRect();
  for (const e of root.querySelectorAll(FLIP_SELECTOR)) {
    const el = e as HTMLElement;
    if (el.offsetParent === null) continue;
    const a = el.getBoundingClientRect();
    const b = before.get(el);
    if (!b) {
      springAnim(
        el,
        [
          { opacity: 0, scale: 0.8, filter: "blur(4px)" },
          { opacity: 1, scale: 1, filter: "blur(0px)" },
        ],
        p.flip[0],
        p.flip[1],
      );
      continue;
    }
    const dx = b.left - box0.left - (a.left - box1.left);
    const dy = b.top - box0.top - (a.top - box1.top);
    if (Math.abs(dx) + Math.abs(dy) < 0.5) continue;
    springAnim(
      el,
      [{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }],
      p.flip[0],
      p.flip[1],
    );
  }
}

/**
 * Animates layout changes of rows/buttons within an open container using FLIP.
 */
export function flipCard(
  root: HTMLElement,
  change: () => void,
  engine?: {
    glide?: (dir?: 1 | -1 | 0) => void;
    bump?: (b: { w?: number; h?: number }) => void;
  } | null,
): void {
  if (prefersReducedMotion()) {
    change();
    return;
  }
  const snapshot = measureFlip(root);
  engine?.glide?.();
  change();
  playFlip(root, snapshot, engine);
}

