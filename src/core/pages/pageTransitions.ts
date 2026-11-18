/**
 * Page transitions (ROADMAP Phase 89): how Preview moves from one page to the next. A page says how it is entered
 * (`pageTransition.type`, `.duration`); a layer on two pages can be a shared element (`sharedElement.id`) that
 * travels from where it was to where it is. Two paths draw the same thing:
 *  - native: the browser's View Transitions API (`document.startViewTransition`), steered by a style sheet made here;
 *  - fallback: `sampleTransition` gives the two pages' opacity, offset and scale at any time, and `playFallback`
 *    plays them with Web Animations. The same function is what the tests sample, so both paths are one recipe.
 */

import type { Layer, MotionDocument } from "../document/schema";
import { sampleCubicBezier } from "../kernel/easing";

export const PAGE_TRANSITION_TYPES = ["none", "fade", "slide", "push", "zoom"] as const;
export type PageTransitionType = (typeof PAGE_TRANSITION_TYPES)[number];
export type NavDirection = "forward" | "back";

export interface PageTransitionSpec {
  type: PageTransitionType;
  /** Seconds. */
  duration: number;
}

export const DEFAULT_PAGE_TRANSITION: PageTransitionSpec = { type: "none", duration: 0.4 };

/** How a page is entered, read from its frame. Unknown values read as the default. */
export function pageTransitionOf(layer: Layer | undefined): PageTransitionSpec {
  const p = layer?.properties ?? {};
  const type = PAGE_TRANSITION_TYPES.find((t) => t === p["pageTransition.type"]) ?? DEFAULT_PAGE_TRANSITION.type;
  const d = Number(p["pageTransition.duration"]);
  return { type, duration: Number.isFinite(d) && d > 0 ? Math.min(10, d) : DEFAULT_PAGE_TRANSITION.duration };
}

export interface PageLook {
  opacity: number;
  /** Fraction of the page's width the page is shifted by (negative is left). */
  x: number;
  scale: number;
}

/** The same curve the native path uses (`cubic-bezier(.65,0,.35,1)`), so both paths agree at every time. */
const ease = (p: number): number => sampleCubicBezier(0.65, 0, 0.35, 1, Math.min(1, Math.max(0, p)));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The page leaving and the page arriving at progress `p` (0 to 1). Going back mirrors a slide and a push.
 * `fade`: cross-fade. `slide`: the new page slides over the old one, which stays. `push`: the old page is pushed away.
 * `zoom`: the old page grows and fades while the new one grows in.
 */
export function sampleTransition(type: PageTransitionType, direction: NavDirection, p: number): { out: PageLook; in: PageLook } {
  const t = type === "none" ? 1 : ease(p);
  const s = direction === "forward" ? 1 : -1;
  switch (type) {
    case "none":
      return { out: { opacity: 0, x: 0, scale: 1 }, in: { opacity: 1, x: 0, scale: 1 } };
    case "fade":
      return { out: { opacity: 1 - t, x: 0, scale: 1 }, in: { opacity: t, x: 0, scale: 1 } };
    case "slide":
      return { out: { opacity: 1, x: 0, scale: 1 }, in: { opacity: 1, x: s * (1 - t), scale: 1 } };
    case "push":
      return { out: { opacity: 1, x: -s * t, scale: 1 }, in: { opacity: 1, x: s * (1 - t), scale: 1 } };
    case "zoom":
      return { out: { opacity: 1 - t, x: 0, scale: lerp(1, 1.08, t) }, in: { opacity: t, x: 0, scale: lerp(0.92, 1, t) } };
  }
}

/** The shared elements of a page: layers inside the frame with a `sharedElement.id`, by that id. */
export function sharedElementsOf(doc: MotionDocument, frameId: string): Record<string, string> {
  const out: Record<string, string> = {};
  const inside = (id: string): boolean => {
    for (let cur: Layer | undefined = doc.layers[id]; cur; cur = cur.parentId ? doc.layers[cur.parentId] : undefined) if (cur.id === frameId) return true;
    return false;
  };
  for (const layer of Object.values(doc.layers)) {
    const id = layer.properties["sharedElement.id"];
    if (typeof id === "string" && id !== "" && inside(layer.id) && out[id] === undefined) out[id] = layer.id;
  }
  return out;
}

/** The layers that exist on both pages under one shared id: `[sharedId, layerOnFrom, layerOnTo]`. */
export function sharedPairs(doc: MotionDocument, fromFrame: string, toFrame: string): Array<[string, string, string]> {
  const a = sharedElementsOf(doc, fromFrame);
  const b = sharedElementsOf(doc, toFrame);
  return Object.keys(a).filter((k) => b[k] !== undefined).sort().map((k) => [k, a[k], b[k]]);
}

export interface Box { x: number; y: number; w: number; h: number }

/** Where a shared element is at progress `p`: its box travels from the old page's to the new page's. */
export function sharedBoxAt(from: Box, to: Box, p: number): Box {
  const t = ease(p);
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), w: lerp(from.w, to.w, t), h: lerp(from.h, to.h, t) };
}

/** A name safe for `view-transition-name`. */
export const viewNameOf = (sharedId: string): string => `ll-shared-${sharedId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

/** CSS that steers the native transition: the root pair follows `sampleTransition`'s recipe, shared names travel on their own. */
export function nativeTransitionCss(spec: PageTransitionSpec, direction: NavDirection): string {
  const ms = Math.round(spec.duration * 1000);
  const s = direction === "forward" ? 1 : -1;
  const common = `animation-duration:${ms}ms;animation-timing-function:cubic-bezier(.65,0,.35,1);animation-fill-mode:both;mix-blend-mode:normal;`;
  const kf = (name: string, from: string, to: string) => `@keyframes ${name}{from{${from}}to{${to}}}`;
  let css = `::view-transition-group(*){animation-duration:${ms}ms;animation-timing-function:cubic-bezier(.65,0,.35,1);}`;
  switch (spec.type) {
    case "none":
      return "::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){animation:none!important;}";
    case "fade":
      css += kf("ll-pt-out", "opacity:1", "opacity:0") + kf("ll-pt-in", "opacity:0", "opacity:1") + `::view-transition-old(root){${common}animation-name:ll-pt-out;}::view-transition-new(root){${common}animation-name:ll-pt-in;}`;
      break;
    case "slide":
      css += kf("ll-pt-in", `transform:translateX(${s * 100}%)`, "transform:translateX(0)") + `::view-transition-old(root){${common}animation:none;}::view-transition-new(root){${common}animation-name:ll-pt-in;z-index:2;}`;
      break;
    case "push":
      css += kf("ll-pt-out", "transform:translateX(0)", `transform:translateX(${-s * 100}%)`) + kf("ll-pt-in", `transform:translateX(${s * 100}%)`, "transform:translateX(0)") + `::view-transition-old(root){${common}animation-name:ll-pt-out;}::view-transition-new(root){${common}animation-name:ll-pt-in;}`;
      break;
    case "zoom":
      css += kf("ll-pt-out", "opacity:1;transform:scale(1)", "opacity:0;transform:scale(1.08)") + kf("ll-pt-in", "opacity:0;transform:scale(.92)", "opacity:1;transform:scale(1)") + `::view-transition-old(root){${common}animation-name:ll-pt-out;}::view-transition-new(root){${common}animation-name:ll-pt-in;}`;
      break;
  }
  return css;
}

export type TransitionPath = "native" | "fallback" | "none";

interface ViewTransitionDocument { startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> } }

/** Which path this browser takes. */
export function transitionPath(spec: PageTransitionSpec, reduced = false): TransitionPath {
  if (spec.type === "none" || reduced || typeof document === "undefined") return "none";
  return typeof (document as unknown as ViewTransitionDocument).startViewTransition === "function" ? "native" : "fallback";
}

/** Waits for the page just shown to be drawn (a couple of frames). */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 34));

/**
 * Runs `update` (which changes the page shown) inside a transition. Native: View Transitions with the shared elements
 * named. Fallback: `update` runs, then `getPages()`'s two elements play `sampleTransition` with Web Animations.
 * `reduced` skips the movement (the update still happens). Returns which path ran.
 */
export async function runPageTransition(opts: {
  spec: PageTransitionSpec;
  direction: NavDirection;
  update: () => void;
  /** The elements of the shared layers on the old page, by shared id, so they can be named before the change. */
  sharedBefore?: Record<string, HTMLElement | null>;
  sharedAfter?: () => Record<string, HTMLElement | null>;
  /** Fallback only: the page elements before and after the update. */
  pages?: () => { out: HTMLElement | null; in: HTMLElement | null };
  reduced?: boolean;
}): Promise<TransitionPath> {
  const path = transitionPath(opts.spec, opts.reduced);
  if (path === "none") {
    opts.update();
    return "none";
  }
  if (path === "native") {
    const style = document.createElement("style");
    style.setAttribute("data-ll-page-transition", "");
    style.textContent = nativeTransitionCss(opts.spec, opts.direction);
    document.head.appendChild(style);
    const named: HTMLElement[] = [];
    const name = (map?: Record<string, HTMLElement | null>) => {
      for (const [id, el] of Object.entries(map ?? {})) if (el) { el.style.setProperty("view-transition-name", viewNameOf(id)); named.push(el); }
    };
    name(opts.sharedBefore);
    const vt = (document as unknown as ViewTransitionDocument).startViewTransition!(async () => {
      named.splice(0).forEach((el) => el.style.removeProperty("view-transition-name"));
      opts.update();
      await settle();
      name(opts.sharedAfter?.());
    });
    try { await vt.finished; } catch { /* a skipped transition still lands on the new page */ }
    named.splice(0).forEach((el) => el.style.removeProperty("view-transition-name"));
    style.remove();
    return "native";
  }
  const before = opts.pages?.().out ?? null;
  opts.update();
  await settle();
  playFallback(before, opts.pages?.().in ?? null, opts.spec, opts.direction);
  return "fallback";
}

/** Plays the recipe on two elements with Web Animations (the old page's element may be gone: then only the new one moves). */
export function playFallback(outEl: HTMLElement | null, inEl: HTMLElement | null, spec: PageTransitionSpec, direction: NavDirection): void {
  const steps = 8;
  const frames = (side: "out" | "in"): Keyframe[] =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const look = sampleTransition(spec.type, direction, i / steps)[side];
      return { offset: i / steps, opacity: look.opacity, transform: `translateX(${look.x * 100}%) scale(${look.scale})` };
    });
  const opts: KeyframeAnimationOptions = { duration: spec.duration * 1000, fill: "both" };
  if (outEl && outEl !== inEl && typeof outEl.animate === "function") outEl.animate(frames("out"), opts);
  if (inEl && typeof inEl.animate === "function") inEl.animate(frames("in"), opts);
}
