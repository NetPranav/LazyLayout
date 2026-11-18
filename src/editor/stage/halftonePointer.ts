"use client";

import { frameScheduler } from "@/core/time/scheduler";

/**
 * The pointer side of the Halftone effect (see `halftoneFilterSpec` in `fxStack.ts`). Each frame it finds the halftone
 * filters the engine keeps in the page, and for each one puts the soft spot under the pointer, in the layer's own
 * pixels, easing after it so the dots trail a little, and fades the dots in while the pointer is near the layer and out
 * when it leaves. It only writes the attributes the filter leaves to it (the spot's box, the composite's `k3`).
 */
interface Spot {
  x: number;
  y: number;
  on: number;
}

/** How much of the way to the pointer the spot goes each frame (60 fps): lower trails further behind. */
const FOLLOW = 0.22;
/** How fast the dots fade in and out. */
const FADE = 0.12;

const set = (el: Element, name: string, value: number): void => {
  const text = String(Math.round(value * 100) / 100);
  if (el.getAttribute(name) !== text) el.setAttribute(name, text);
};

/** The pointer in a layer's own pixels: its box on screen, undone for the canvas zoom (and roughly for a small turn). */
function local(el: Element, clientX: number, clientY: number): { x: number; y: number; w: number; h: number } {
  const r = el.getBoundingClientRect();
  // a drawn vector is an <svg>, which has no offset size: its CSS box is its client size
  const w = (el as HTMLElement).offsetWidth || el.clientWidth || r.width || 1;
  const h = (el as HTMLElement).offsetHeight || el.clientHeight || r.height || 1;
  const sx = r.width / w || 1;
  const sy = r.height / h || 1;
  return { x: (clientX - r.left) / sx, y: (clientY - r.top) / sy, w, h };
}

/**
 * Starts following the pointer over `page` while `live()` says the canvas shows motion (Motion, Preview, playing).
 * Returns the function that stops it and puts every halftone back at rest.
 */
export function installHalftonePointer(page: HTMLElement, live: () => boolean): () => void {
  const doc = page.ownerDocument;
  const view = doc.defaultView;
  const spots = new Map<string, Spot>();
  let pointer: { x: number; y: number } | null = null;
  const onMove = (e: PointerEvent) => {
    pointer = { x: e.clientX, y: e.clientY };
  };
  const onLeave = () => {
    pointer = null;
  };
  view?.addEventListener("pointermove", onMove, { passive: true });
  doc.documentElement.addEventListener("pointerleave", onLeave);

  const frame = () => {
    const images = doc.querySelectorAll<SVGElement>("svg[data-fx-defs] feImage[data-ll-halftone]");
    const isLive = live();
    const seen = new Set<string>();
    for (const image of Array.from(images)) {
      const layerId = image.getAttribute("data-ll-halftone") ?? "";
      const composite = image.parentElement?.querySelector("feComposite[data-ll-halftone-k]");
      const el = page.querySelector(`[data-archetype][data-element-id="${CSS.escape(layerId)}"]`);
      if (!composite || !el) continue;
      const key = `${image.parentElement?.id ?? layerId}`;
      seen.add(key);
      const reach = Number(image.getAttribute("data-ll-halftone-reach")) || 180;
      const k = Number(composite.getAttribute("data-ll-halftone-k")) || 0;
      let spot = spots.get(key);
      let target = 0;
      if (isLive && pointer) {
        const p = local(el, pointer.x, pointer.y);
        const near = p.x > -reach / 2 && p.y > -reach / 2 && p.x < p.w + reach / 2 && p.y < p.h + reach / 2;
        if (near) {
          target = 1;
          if (!spot || spot.on < 0.01) spot = { x: p.x, y: p.y, on: spot?.on ?? 0 };
          spot.x += (p.x - spot.x) * FOLLOW;
          spot.y += (p.y - spot.y) * FOLLOW;
        }
      }
      if (!spot) continue;
      spot.on += (target - spot.on) * FADE;
      if (target === 0 && spot.on < 0.005) spot.on = 0;
      spots.set(key, spot);
      set(image, "x", spot.x - reach);
      set(image, "y", spot.y - reach);
      set(image, "width", reach * 2);
      set(image, "height", reach * 2);
      set(composite, "k3", -k * spot.on);
    }
    for (const key of Array.from(spots.keys())) if (!seen.has(key)) spots.delete(key);
  };
  const off = frameScheduler.register("overlay", frame);

  return () => {
    off();
    view?.removeEventListener("pointermove", onMove);
    doc.documentElement.removeEventListener("pointerleave", onLeave);
    for (const composite of Array.from(doc.querySelectorAll("svg[data-fx-defs] feComposite[data-ll-halftone-k]"))) composite.removeAttribute("k3");
  };
}
