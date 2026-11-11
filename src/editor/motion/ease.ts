// Spring easing generator and element animator ported from Nook (the owner's own product)

import { prefersReducedMotion, isUserMotionOff } from "./reducedMotion";

export interface SpringEaseResult {
  easing: string;
  duration: number;
}

const EASES = new Map<string, SpringEaseResult>();

/**
 * Simulates a mass-1 spring (k = (2π/response)², c = 4π·ζ/response) from 0 to 1
 * sampled at 60 Hz into a CSS linear() easing string. Cached per parameter pair.
 */
export function springEase(response: number, ratio: number): SpringEaseResult {
  const key = `${response}/${ratio}`;
  const cached = EASES.get(key);
  if (cached) return cached;

  const k = ((2 * Math.PI) / response) ** 2;
  const c = (4 * Math.PI * ratio) / response;
  let x = 0;
  let v = 0;
  const to = 1;

  const pts: number[] = [0];
  const dt = 1 / 600;
  let t = 0;
  let next = 1 / 60;

  while (t < 2) {
    const a = -k * (x - to) - c * v;
    v += a * dt;
    x += v * dt;
    t += dt;
    if (t >= next) {
      pts.push(Number(x.toFixed(4)));
      next += 1 / 60;
      const atRest = Math.abs(x - to) < 0.01 && Math.abs(v) < 0.05;
      if (atRest) break;
    }
  }
  pts[pts.length - 1] = 1;

  const duration = Math.round(((pts.length - 1) / 60) * 1000);
  const res: SpringEaseResult = {
    easing: `linear(${pts.join(", ")})`,
    duration,
  };
  EASES.set(key, res);
  return res;
}


/**
 * Animates an element using a CSS linear() spring simulation easing curve.
 * Fallback under prefers-reduced-motion: 120 ms opacity fade.
 */
export function springAnim(
  el: HTMLElement,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  response: number,
  ratio: number,
  extra: KeyframeAnimationOptions = {},
): Animation | null {
  if (typeof el.animate !== "function") {
    return null;
  }

  if (isUserMotionOff()) {
    // "Disable animations": jump to the end state; keeps a finished Animation for callers.
    return el.animate(keyframes, { ...extra, duration: 0, delay: 0, endDelay: 0 });
  }

  if (prefersReducedMotion()) {
    return el.animate(
      Array.isArray(keyframes)
        ? [{ opacity: 0 }, { opacity: 1 }]
        : { opacity: [0, 1] },
      {
        duration: 120,
        easing: "ease-out",
        fill: "backwards",
        ...extra,
      },
    );
  }

  const e = springEase(response, ratio);
  return el.animate(keyframes, {
    duration: e.duration,
    easing: e.easing,
    ...extra,
  });
}

/** Cancel all active Web Animations on an element */
export function cancelAll(el: HTMLElement): void {
  if (typeof el.getAnimations === "function") {
    el.getAnimations().forEach((a) => a.cancel());
  }
}

