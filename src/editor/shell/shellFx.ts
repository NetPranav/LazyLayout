"use client";

import { useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  Spring,
  simAdd,
  simRemove,
  springAnim,
  getActivePreset,
  prefersReducedMotion,
  type Sim,
} from "@/editor/motion";
import type { EditorMode } from "@/editor/components";

/*
 * Shell motion: the shared spring panel transition (P "panelFx"), mode-switch content
 * transitions (P "modeFx") and the bottom height splitter.
 *
 * The engine writes --lw, --rw, --bh and --fw as inline styles on the shell root while a change
 * plays and removes them at rest. React never renders a style or those attributes on the root:
 * it only renders data-mode / data-lc / data-rc / data-zen / data-fw, which the CSS turns into
 * the resting values (animations.css, lane L8).
 */

/** Spring used for the panel sizes while the mode changes (response in seconds, damping ratio). */
const MODE_SPRING: [number, number] = [0.22, 0.6];
/** Spring for content sliding in and out. */
const CONTENT_SPRING: [number, number] = [0.2, 0.8];
/** Initial feel of the four panel springs, retuned from the active preset on every change. */
const PANEL_SPRING_SEED: [number, number] = [0.4, 0.6];
/** Content travel on a mode switch: side panels, bottom panel, inspector section rise (CSS px). */
const SLIDE_SIDE = 28;
const SLIDE_BOTTOM = 32;
const SECTION_RISE = 10;
const MODE_BLUR = 5;
/** Section cascade, in ms. */
const CASCADE_STEP = 20;
const CASCADE_MAX = 120;
/** Smallest ghost worth drawing (CSS px). */
const GHOST_MIN = 8;
/** Splitter limits: smallest bottom height in CSS px, largest and default as a fraction of the window height. */
const BOTTOM_MIN = 180;
const BOTTOM_MAX_RATIO = 0.7;
const BOTTOM_DEFAULT_RATIO = 0.4;
/** A layout change smaller than this (CSS px) is not animated. */
const MIN_CHANGE = 0.5;

const MODE_ORDER: readonly EditorMode[] = ["design", "motion", "code"];

interface LayoutVals {
  lw: number;
  rw: number;
  bh: number;
  fw: number;
}

interface Ghosts {
  left: HTMLElement | null;
  right: HTMLElement | null;
  bottom: HTMLElement | null;
}

interface PendingMode {
  dir: number;
  ghosts: Ghosts;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function measure(root: HTMLElement): LayoutVals {
  const cs = getComputedStyle(root);
  const cols = cs.gridTemplateColumns.split(" ").map(parseFloat);
  const rows = cs.gridTemplateRows.split(" ").map(parseFloat);
  return {
    lw: cols[0] || 0,
    rw: cols[2] || 0,
    bh: rows[2] || 0,
    fw: parseFloat(cs.getPropertyValue("--fw")) || 0,
  };
}

function ghostOf(zone: HTMLElement | null): HTMLElement | null {
  if (!zone) return null;
  const r = zone.getBoundingClientRect();
  if (r.width < GHOST_MIN || r.height < GHOST_MIN) return null;
  const ghost = document.createElement("div");
  ghost.className = "ll-mgh";
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.width = `${r.width}px`;
  ghost.style.height = `${r.height}px`;
  let n = 0;
  Array.from(zone.children).forEach((child) => {
    if (child.classList.contains("ll-mgh")) return;
    const copy = child.cloneNode(true) as HTMLElement;
    copy.removeAttribute("id");
    copy.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
    ghost.appendChild(copy);
    n++;
  });
  return n ? ghost : null;
}

function slideOut(el: HTMLElement, dx: number, dy: number): void {
  const anim = springAnim(
    el,
    [
      { translate: "0 0", opacity: 1, filter: "blur(0px)" },
      { translate: `${dx}px ${dy}px`, opacity: 0, filter: `blur(${MODE_BLUR}px)` },
    ],
    CONTENT_SPRING[0],
    CONTENT_SPRING[1],
    { fill: "forwards" },
  );
  if (anim) anim.onfinish = () => el.remove();
  else el.remove();
}

export class ShellFx {
  private root: HTMLElement | null = null;
  private mode: EditorMode | null = null;
  private last: LayoutVals | null = null;
  private live = false;
  private pending: PendingMode | null = null;

  private readonly lw = new Spring(0, PANEL_SPRING_SEED);
  private readonly rw = new Spring(0, PANEL_SPRING_SEED);
  private readonly bh = new Spring(0, PANEL_SPRING_SEED);
  private readonly fw = new Spring(0, PANEL_SPRING_SEED);
  private readonly sim: Sim = {
    sp: [this.lw, this.rw, this.bh, this.fw],
    apply: () => this.applyVars(),
    rest: () => this.end(),
  };

  /** The splitter spring: dragging writes it directly, a double click glides it back. */
  private readonly mbh = new Spring(0, PANEL_SPRING_SEED);
  private readonly mbhSim: Sim = {
    sp: [this.mbh],
    apply: () => this.root?.style.setProperty("--mbh", `${this.mbh.x}px`),
    rest: () => {},
  };

  /** Ref callback for the shell root. */
  readonly attach = (el: HTMLElement | null): void => {
    if (this.root) window.removeEventListener("resize", this.onResize);
    this.root = el;
    if (el) {
      window.addEventListener("resize", this.onResize);
    } else {
      simRemove(this.sim);
      simRemove(this.mbhSim);
      this.live = false;
    }
  };

  private readonly onResize = (): void => {
    if (this.root && !this.live) this.last = measure(this.root);
  };

  private applyVars(): void {
    const root = this.root;
    if (!root || !this.live) return;
    root.style.setProperty("--lw", `${Math.max(0, this.lw.x).toFixed(2)}px`);
    root.style.setProperty("--rw", `${Math.max(0, this.rw.x).toFixed(2)}px`);
    root.style.setProperty("--bh", `${Math.max(0, this.bh.x).toFixed(2)}px`);
    root.style.setProperty("--fw", this.fw.x.toFixed(4));
  }

  private clearVars(): void {
    const root = this.root;
    if (!root) return;
    ["--lw", "--rw", "--bh", "--fw"].forEach((p) => root.style.removeProperty(p));
  }

  private end(): void {
    const root = this.root;
    if (!root || !this.live) return;
    this.live = false;
    this.clearVars();
    root.removeAttribute("data-pfx");
    this.last = measure(root);
  }

  /** Called synchronously before the mode state changes: copies the old panel content. */
  readonly captureMode = (next: EditorMode): void => {
    const root = this.root;
    if (!root || this.mode === null || next === this.mode) return;
    root.querySelectorAll(".ll-mgh").forEach((e) => e.remove());
    const dir = MODE_ORDER.indexOf(next) >= MODE_ORDER.indexOf(this.mode) ? 1 : -1;
    const reduced = prefersReducedMotion();
    this.pending = {
      dir,
      ghosts: reduced
        ? { left: null, right: null, bottom: null }
        : {
            left: ghostOf(root.querySelector<HTMLElement>(".ll-shell-left")),
            right: ghostOf(root.querySelector<HTMLElement>(".ll-shell-right")),
            bottom: ghostOf(root.querySelector<HTMLElement>(".ll-shell-bottom")),
          },
    };
  };

  /**
   * Runs in a layout effect after every commit that can change the layout. The attributes are
   * already new, so the grid is measured at its target, then the springs start from the old values.
   */
  sync(mode: EditorMode): void {
    const root = this.root;
    if (!root) return;
    const pending = this.pending;
    this.pending = null;
    const modeChanged = this.mode !== null && this.mode !== mode;
    this.mode = mode;

    const wasLive = this.live;
    let a: LayoutVals | null;
    if (wasLive) {
      a = { lw: this.lw.x, rw: this.rw.x, bh: this.bh.x, fw: this.fw.x };
      this.clearVars();
    } else {
      a = this.last;
    }
    const b = measure(root);

    if (!a) {
      this.last = b;
      return;
    }

    const reduced = prefersReducedMotion();
    const moved =
      Math.abs(a.lw - b.lw) + Math.abs(a.rw - b.rw) + Math.abs(a.bh - b.bh) + Math.abs(a.fw - b.fw) >= MIN_CHANGE;

    if (reduced || (!wasLive && !moved)) {
      if (wasLive) {
        this.live = false;
        simRemove(this.sim);
        root.removeAttribute("data-pfx");
      }
      this.last = b;
    } else {
      const spec = modeChanged && pending ? MODE_SPRING : getActivePreset().shape;
      [this.lw, this.rw, this.bh, this.fw].forEach((s) => s.tune(spec));
      if (!wasLive) {
        this.lw.x = a.lw;
        this.rw.x = a.rw;
        this.bh.x = a.bh;
        this.fw.x = a.fw;
        [this.lw, this.rw, this.bh, this.fw].forEach((s) => {
          s.v = 0;
        });
      }
      this.lw.to = b.lw;
      this.rw.to = b.rw;
      this.bh.to = b.bh;
      this.fw.to = b.fw;
      this.live = true;
      root.setAttribute("data-pfx", "");
      this.applyVars();
      simAdd(this.sim);
    }

    if (modeChanged && pending) this.playModeFx(root, pending);
  }

  private playModeFx(root: HTMLElement, pending: PendingMode): void {
    const { dir, ghosts } = pending;
    const left = root.querySelector<HTMLElement>(".ll-shell-left");
    const right = root.querySelector<HTMLElement>(".ll-shell-right");
    const bottom = root.querySelector<HTMLElement>(".ll-shell-bottom");
    const reduced = prefersReducedMotion();

    const zones: Array<[HTMLElement | null, HTMLElement | null]> = [
      [ghosts.left, left],
      [ghosts.right, right],
    ];
    zones.forEach(([ghost, zone]) => {
      if (!zone) return;
      if (ghost) {
        zone.appendChild(ghost);
        slideOut(ghost, -dir * SLIDE_SIDE, 0);
      }
      Array.from(zone.children).forEach((child) => {
        const c = child as HTMLElement;
        if (c === ghost || c.classList.contains("ll-mgh")) return;
        springAnim(
          c,
          [
            { translate: `${dir * SLIDE_SIDE}px 0`, opacity: 0, filter: `blur(${MODE_BLUR}px)` },
            { translate: "0 0", opacity: 1, filter: "blur(0px)" },
          ],
          CONTENT_SPRING[0],
          CONTENT_SPRING[1],
        );
      });
    });

    if (reduced) {
      if (bottom) {
        Array.from(bottom.children).forEach((child) => {
          springAnim(child as HTMLElement, [{ opacity: 0 }, { opacity: 1 }], CONTENT_SPRING[0], CONTENT_SPRING[1]);
        });
      }
      return;
    }

    if (bottom && ghosts.bottom) {
      bottom.appendChild(ghosts.bottom);
      slideOut(ghosts.bottom, 0, SLIDE_BOTTOM);
    }

    const sections = Array.from(root.querySelectorAll<HTMLElement>(".ll-shell-right .ll-dsec")).filter(
      (e) => e.getClientRects().length > 0,
    );
    sections.forEach((el, i) => {
      springAnim(
        el,
        [
          { translate: `0 ${SECTION_RISE}px`, opacity: 0 },
          { translate: "0 0", opacity: 1 },
        ],
        CONTENT_SPRING[0],
        CONTENT_SPRING[1],
        { delay: Math.min(i * CASCADE_STEP, CASCADE_MAX), fill: "backwards" },
      );
    });
  }

  /** Splitter: drag to resize. */
  readonly onSplitDown = (e: ReactPointerEvent<HTMLElement>): void => {
    const root = this.root;
    const bottom = e.currentTarget.parentElement;
    if (!root || !bottom) return;
    e.preventDefault();
    const handle = e.currentTarget;
    const y0 = e.clientY;
    const h0 = bottom.offsetHeight;
    this.mbh.jump(h0);
    simAdd(this.mbhSim);
    handle.setAttribute("data-on", "");
    handle.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent): void => {
      const h = clamp(h0 - (ev.clientY - y0), BOTTOM_MIN, Math.round(window.innerHeight * BOTTOM_MAX_RATIO));
      this.mbh.jump(h);
      root.style.setProperty("--mbh", `${h}px`);
    };
    const up = (): void => {
      handle.removeAttribute("data-on");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  /** Splitter: double click glides back to 40% of the window. */
  readonly onSplitDouble = (e: ReactMouseEvent<HTMLElement>): void => {
    const root = this.root;
    const bottom = e.currentTarget.parentElement;
    if (!root || !bottom) return;
    const h = Math.round(window.innerHeight * BOTTOM_DEFAULT_RATIO);
    this.mbh.jump(bottom.offsetHeight);
    if (prefersReducedMotion()) {
      this.mbh.jump(h);
      root.style.setProperty("--mbh", `${h}px`);
      return;
    }
    this.mbh.tune(getActivePreset().shape);
    this.mbh.to = h;
    simAdd(this.mbhSim);
  };
}

export interface ShellFxApi {
  bindRoot: (el: HTMLElement | null) => void;
  captureMode: (next: EditorMode) => void;
  sync: (mode: EditorMode) => void;
  onSplitDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onSplitDouble: (e: ReactMouseEvent<HTMLElement>) => void;
}

/** One ShellFx per shell, created once. */
export function useShellFx(): ShellFxApi {
  const [api] = useState<ShellFxApi>(() => {
    const fx = new ShellFx();
    return {
      bindRoot: fx.attach,
      captureMode: fx.captureMode,
      sync: (mode) => fx.sync(mode),
      onSplitDown: fx.onSplitDown,
      onSplitDouble: fx.onSplitDouble,
    };
  });
  return api;
}
