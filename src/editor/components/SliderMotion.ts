"use client";

/**
 * Motion for the shared Slider. Three real springs (position, thumb grow, stretch with
 * velocity) run in the one global loop and write straight into the DOM, so a drag is
 * 1:1 with the pointer and never waits for a React render. With animations off every
 * change lands at once.
 */

import { Spring, type SpringParam } from "@/editor/motion/spring";
import { simAdd, simRemove, type Sim } from "@/editor/motion/loop";
import { isMotionOff } from "@/editor/motion/reducedMotion";

/** Click-to-jump and outside changes: a calm glide with a slight overshoot. */
export const SLIDER_POS_SPRING: SpringParam = [0.32, 0.66];
/** Thumb grows on hover and press, and settles with a small bounce on release. */
export const SLIDER_GROW_SPRING: SpringParam = [0.24, 0.5];
/** Stretch along the drag direction, from the prototype's slider. */
export const SLIDER_STRETCH_SPRING: SpringParam = [0.26, 0.5];

const HOVER_GROW = 0.35;
const PRESS_GROW = 1;
const EDGE = 3;

export interface SliderParts {
  fill: () => HTMLElement | null;
  thumb: () => HTMLElement | null;
  bubble: () => HTMLElement | null;
}

export interface SliderMotion {
  /** Put the thumb at a fraction (0..1) with no motion. */
  place(frac: number): void;
  /** Spring to a fraction. */
  glideTo(frac: number): void;
  /** Follow the pointer 1:1 (no lag). */
  follow(frac: number): void;
  press(on: boolean): void;
  hover(on: boolean): void;
  stretch(px: number): void;
  /** A short pulse for keyboard steps. */
  nudge(): void;
  dispose(): void;
}

export function createSliderMotion(parts: SliderParts): SliderMotion {
  const pos = new Spring(0, SLIDER_POS_SPRING);
  const grow = new Spring(0, SLIDER_GROW_SPRING);
  const str = new Spring(0, SLIDER_STRETCH_SPRING);
  let pressed = false;
  let hovered = false;

  const growTarget = () => (pressed ? PRESS_GROW : hovered ? HOVER_GROW : 0);

  function paint(): void {
    const p = Math.max(0, Math.min(1, pos.x));
    const at = `calc(${EDGE}px + (100% - ${EDGE * 2}px) * ${p.toFixed(5)})`;
    const fill = parts.fill();
    if (fill) fill.style.width = at;
    const bubble = parts.bubble();
    if (bubble) bubble.style.left = at;
    const thumb = parts.thumb();
    if (thumb) {
      const s = str.x;
      const g = Math.max(-0.2, grow.x);
      const sx = (1 + Math.abs(s) / 6) * (1 + g * 0.2);
      const sy = 1 + g * 0.22;
      const shift = (s > 0 ? -s : 0) - (EDGE * g * 0.2);
      thumb.style.left = `calc(${EDGE}px + (100% - ${EDGE * 2}px) * ${p.toFixed(5)} - ${EDGE}px)`;
      thumb.style.transform = `translateX(${shift.toFixed(2)}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    }
  }

  const sim: Sim = { sp: [pos, grow, str], apply: paint, rest: paint };

  function run(): void {
    if (isMotionOff()) {
      pos.snap();
      grow.jump(growTarget());
      str.jump(0);
      paint();
      return;
    }
    simAdd(sim);
  }

  return {
    place(frac) {
      pos.jump(frac);
      grow.jump(growTarget());
      paint();
    },
    glideTo(frac) {
      pos.to = frac;
      run();
    },
    follow(frac) {
      pos.jump(frac);
      paint();
    },
    press(on) {
      pressed = on;
      grow.to = growTarget();
      run();
    },
    hover(on) {
      hovered = on;
      grow.to = growTarget();
      run();
    },
    stretch(px) {
      if (isMotionOff()) return;
      str.to = px;
      simAdd(sim);
    },
    nudge() {
      if (isMotionOff()) return;
      grow.x = Math.max(grow.x, 0.7);
      grow.to = growTarget();
      simAdd(sim);
    },
    dispose() {
      simRemove(sim);
    },
  };
}
