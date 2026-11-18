"use client";

import { frameScheduler } from "@/core/time/scheduler";

/**
 * Lenses (a Live fill with `lens` on, see `shapePaint.tsx`): each frame, the copy of the source drawn inside the shape is
 * lined up with the source as it is drawn on the page, then magnified about the shape's centre. It reads both from the
 * page, so it follows the shape however it moves: dragged, keyframed, driven by the pointer or by scroll. It runs only
 * while a lens is on the page.
 */
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * The transform that puts the source, magnified by `m` about the lens's centre, where it sits under the lens. Pure: `box`
 * is the lens's drawing box on screen and `boxScale` its screen px per px of its own (zoom, and any viewBox stretch);
 * `source` is where the source's corner is on screen and `sourceScale` its screen px per px.
 */
export function lensTransform(lens: { left: number; top: number; width: number; height: number }, box: { left: number; top: number }, boxScale: number, source: { left: number; top: number }, sourceScale: number, m: number): string {
  const kb = boxScale > 0 ? boxScale : 1;
  const ks = sourceScale > 0 ? sourceScale : 1;
  const cx = lens.left + lens.width / 2;
  const cy = lens.top + lens.height / 2;
  const tx = (cx - box.left + m * (source.left - cx)) / kb;
  const ty = (cy - box.top + m * (source.top - cy)) / kb;
  return `translate(${round(tx)}px, ${round(ty)}px) scale(${round((m * ks) / kb)})`;
}

export function installLiveLens(page: HTMLElement): () => void {
  let off: (() => void) | null = null;
  const frame = () => {
    const lenses = page.querySelectorAll<HTMLElement>("[data-live-lens]");
    if (lenses.length === 0) return;
    for (const wrapper of Array.from(lenses)) {
      const sourceId = wrapper.getAttribute("data-live-lens") ?? "";
      const m = Number(wrapper.getAttribute("data-lens-scale")) || 1;
      // the shape that owns the fill (outside the copy), and the source as drawn on the page (not a copy inside a lens)
      // the box the copy is drawn in (inside the shape's own drawing), and the source as drawn on the page (not a copy inside a lens)
      const box = wrapper.closest<HTMLElement>("[data-live-fill]");
      const lens = box?.parentElement?.closest<Element>("[data-element-id]");
      const source = Array.from(page.querySelectorAll<HTMLElement>(`[data-archetype][data-element-id="${CSS.escape(sourceId)}"]`)).find((el) => !el.closest("[data-live-fill]"));
      if (!box || !lens || !source) continue;
      const rb = box.getBoundingClientRect();
      const rs = source.getBoundingClientRect();
      const t = lensTransform(lens.getBoundingClientRect(), rb, box.offsetWidth > 0 ? rb.width / box.offsetWidth : 1, rs, source.offsetWidth > 0 ? rs.width / source.offsetWidth : 1, m);
      if (wrapper.style.transform !== t) {
        wrapper.style.transformOrigin = "0 0";
        wrapper.style.transform = t;
      }
    }
  };
  const sync = () => {
    const has = page.querySelector("[data-live-lens]") !== null;
    if (has && !off) off = frameScheduler.register("overlay", frame);
    else if (!has && off) {
      off();
      off = null;
    }
  };
  const watch = new MutationObserver(sync);
  // a fill turned into a lens in place only gains the attribute, so attribute changes count too
  watch.observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-live-lens"] });
  sync();
  return () => {
    watch.disconnect();
    off?.();
    off = null;
  };
}
