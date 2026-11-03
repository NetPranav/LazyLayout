// Surface motion engine (IslandEngine reduced to an overlay surface) ported from Nook (the owner's own product)

import { Spring } from "./spring";
import { simAdd, simRemove, type Sim } from "./loop";
import { MOT, SP, EXIT } from "./presets";
import { getActivePreset, prefersReducedMotion } from "./feel";
import { springAnim, cancelAll } from "./ease";
import { measureFlip, playFlip } from "./flip";

export interface SurfaceOptions {
  up?: boolean;
  right?: boolean;
  from?: { w: number; h: number; r: number };
  slide?: number;
}

export interface MeasureResult {
  w: number;
  h: number;
  r: number;
  cw: number;
  ch: number;
  sh: number;
}

const BLOCK_SELECTOR = ".hl, .mh, .vgrp, .grp, .srow, .pubrow, .urow, [data-row]";

/**
 * Animate rows entering a surface layer from below with spring physics and blur fade
 */
export function enterRows(layer: HTMLElement, dir = 1): void {
  const p = getActivePreset();
  let g = 0;
  const children = Array.from(layer.children) as HTMLElement[];

  children.forEach((c, i) => {
    if (c.classList.contains("ll-hl") || c.offsetParent === null) return;
    if (i && c.matches(BLOCK_SELECTOR)) g++;
    cancelAll(c);
    const d = 40 + g * p.stagger;
    springAnim(
      c,
      [
        { translate: `0 ${dir * (p.travel[0] + g * p.travel[1])}px`, scale: p.rowScale },
        { translate: "0 0", scale: "1" },
      ],
      p.rows[0],
      p.rows[1],
      { delay: d, fill: "backwards" },
    );
    if (!prefersReducedMotion()) {
      c.animate(
        [
          { opacity: 0, filter: "blur(6px)" },
          { opacity: 1, filter: "blur(0px)" },
        ],
        { duration: 240, easing: "cubic-bezier(.2,.8,.3,1)", delay: d, fill: "backwards" },
      );
    }
  });
}

/**
 * Items of the surface blur out in place on exit
 */
export function exitItems(layer: HTMLElement): void {
  const children = Array.from(layer.children) as HTMLElement[];
  children.forEach((c) => {
    cancelAll(c);
    if (prefersReducedMotion()) {
      c.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 120,
        easing: "ease-out",
        fill: "forwards",
      });
      return;
    }
    c.animate(
      [
        { opacity: 1, filter: "blur(0px)" },
        { opacity: 0, filter: `blur(${EXIT.blur}px)`, scale: EXIT.scale },
      ],
      { duration: EXIT.ms, easing: EXIT.easing, fill: "forwards" },
    );
  });
}

/**
 * Surf is the single overlay surface motion controller (menus, popovers, insert panel).
 * Springs W (width), H (height), R (radius), P (press), G (gap), S (scale) drive geometry.
 */
export class Surf {
  readonly el: HTMLElement;
  readonly lay: HTMLElement;
  readonly W = new Spring(0, SP.width);
  readonly H = new Spring(0, SP.height);
  readonly R = new Spring(0, SP.height);
  readonly P = new Spring(1, SP.press);
  readonly G = new Spring(0, SP.width);
  readonly S = new Spring(1, SP.width);

  size = { w: 0, h: 0 };
  goal = { w: 0, h: 0 };
  from = { w: 0, h: 0, r: 0 };
  cw = 0;
  ch = 0;
  sh = 0;
  k = 1;
  lock = 0;
  up = false;
  right = false;
  slide = 0;
  mv = false;
  wind = false;

  private feelTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  readonly sim: Sim;

  constructor(el: HTMLElement, lay: HTMLElement) {
    this.el = el;
    this.lay = lay;
    this.sim = {
      sp: [this.W, this.H, this.R, this.P, this.G, this.S],
      apply: () => {
        if (this.mv) this.paint();
      },
      rest: () => {
        this.rest();
      },
    };
  }

  later(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      const idx = this.timers.indexOf(t);
      if (idx >= 0) this.timers.splice(idx, 1);
      fn();
    }, ms);
    this.timers.push(t);
  }

  live(): boolean {
    return this.el.classList.contains("open") || this.el.hasAttribute("data-lv");
  }

  measure(): MeasureResult {
    const el = this.el;
    const st = el.style;
    const ls = this.lay.style;
    let keep: [string, string, string, string, string, string] | null = null;

    if (this.mv) {
      keep = [st.width, st.height, st.borderRadius, st.translate, st.scale, ls.cssText];
      el.removeAttribute("data-mv");
      st.width = st.height = st.borderRadius = st.translate = st.scale = "";
      ls.cssText = "";
    }

    const cs = getComputedStyle(el);
    const m: MeasureResult = {
      w: el.offsetWidth,
      h: el.offsetHeight,
      r: parseFloat(cs.borderTopLeftRadius) || 0,
      cw: el.clientWidth - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0"),
      ch: el.clientHeight - parseFloat(cs.paddingTop || "0") - parseFloat(cs.paddingBottom || "0"),
      sh: this.lay.scrollHeight,
    };

    if (keep) {
      el.setAttribute("data-mv", "");
      st.width = keep[0];
      st.height = keep[1];
      st.borderRadius = keep[2];
      st.translate = keep[3];
      st.scale = keep[4];
      ls.cssText = keep[5];
    }

    return m;
  }

  fit(m: MeasureResult): void {
    this.size = { w: m.w, h: m.h };
    this.goal = { w: m.w, h: m.h };
    this.cw = m.cw;
    this.ch = m.ch;
    this.sh = m.sh;
    // Size scale: proportional to height against Nook's 140px card
    this.k = Math.min(1, m.h / 140);
  }

  begin(): void {
    this.mv = true;
    this.el.setAttribute("data-mv", "");
    const ls = this.lay.style;
    ls.width = `${this.cw}px`;
    ls.height = `${Math.max(this.ch, this.sh)}px`;
    ls.flex = "none";
  }

  end(): void {
    this.mv = false;
    this.el.removeAttribute("data-mv");
    const st = this.el.style;
    st.width = st.height = st.borderRadius = st.translate = st.scale = "";
    this.lay.style.cssText = "";
  }

  wake(): boolean {
    if (this.mv) return true;
    if (!this.live()) return false;
    const m = this.measure();
    this.fit(m);
    this.W.jump(m.w);
    this.H.jump(m.h);
    this.R.jump(m.r);
    this.begin();
    this.paint();
    return true;
  }

  paint(): void {
    const st = this.el.style;
    const w = Math.max(0, this.W.x);
    const h = Math.max(0, this.H.x);
    const dx = (this.right ? this.size.w - w : 0) + this.G.x;
    const sc = this.P.x * this.S.x;

    st.width = `${w}px`;
    st.height = `${h}px`;
    st.borderRadius = `${Math.max(0, this.R.x)}px`;
    st.translate = dx ? `${dx}px 0` : "";
    st.scale = sc === 1 ? "" : String(sc);

    this.lay.style.translate = `${this.right ? w - this.size.w : 0}px ${
      this.up ? h - this.size.h : 0
    }px`;
  }

  rest(): void {
    if (this.el.hasAttribute("data-lv") || this.P.to !== 1) return;
    this.end();
  }

  settleOrRun(): void {
    const isMoving = this.sim.sp.some((s) => s.x !== s.to || s.v !== 0);
    if (isMoving) {
      simAdd(this.sim);
    }
  }

  feel(ms: number, w?: [number, number], h?: [number, number]): void {
    const p = getActivePreset();
    this.W.tune(w || p.bW);
    this.H.tune(h || p.bH);
    if (this.feelTimer) clearTimeout(this.feelTimer);
    this.feelTimer = setTimeout(() => {
      this.W.tune(SP.width);
      this.H.tune(SP.height);
    }, ms);
  }

  shapeTo(size: { w: number; h: number }, radius: number): void {
    const p = getActivePreset();
    this.goal = size;
    this.R.to = radius;

    if (this.wind && !prefersReducedMotion()) {
      this.wind = false;
      this.W.to = this.W.x - p.wind * this.k;
      this.H.to = this.H.x - MOT.windUpH;
      this.later(MOT.windUpMs, () => {
        this.W.to = this.goal.w;
        this.H.to = this.goal.h;
        this.H.v += getActivePreset().enterKick * this.k;
        simAdd(this.sim);
      });
      return;
    }

    this.W.to = size.w;
    this.H.to = size.h;
  }

  punch(): void {
    this.feel(MOT.entryBouncyMs);
    this.wind = true;
  }

  squash(): void {
    this.feel(MOT.exitBouncyMs);
    this.H.v -= getActivePreset().exitSquash * this.k;
    this.settleOrRun();
  }

  glide(): void {
    const p = getActivePreset();
    if (!this.wake() || prefersReducedMotion()) return;
    this.wind = false;
    this.feel(1000, p.glideW, p.glideH);
  }

  endBump(dir: 1 | -1): void {
    const p = getActivePreset();
    if (prefersReducedMotion() || !p.endBump || !this.wake()) return;
    this.H.v += (dir > 0 ? 1 : -1) * p.endBump * this.k;
    simAdd(this.sim);
  }

  bump(b: { w?: number; h?: number }): void {
    if (prefersReducedMotion() || !this.wake()) return;
    this.W.v += b.w || 0;
    this.H.v += b.h || 0;
    simAdd(this.sim);
  }

  press(down: boolean): void {
    if (prefersReducedMotion() || !this.wake()) return;
    this.P.to = down ? MOT.pressScale : 1;
    this.settleOrRun();
  }

  reset(): void {
    this.timers.forEach(clearTimeout);
    this.timers.length = 0;
    if (this.feelTimer) clearTimeout(this.feelTimer);

    simRemove(this.sim);

    if (typeof this.el.getAnimations === "function") {
      this.el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    }

    this.el.classList.remove("open");
    this.el.removeAttribute("data-lv");
    this.end();

    this.W.tune(SP.width);
    this.H.tune(SP.height);
    this.R.tune(SP.height);
    this.G.tune(SP.width);
    this.S.tune(SP.width);

    this.W.v = this.H.v = this.R.v = 0;
    this.P.jump(1);
    this.G.jump(0);
    this.S.jump(1);
    this.wind = false;
    this.slide = 0;
  }

  open(options: SurfaceOptions = {}): void {
    const p = getActivePreset();
    this.up = !!options.up;
    this.right = !!options.right;
    this.slide = options.slide || 0;

    const m = this.measure();
    this.fit(m);
    const f = options.from || { w: 32, h: 32, r: m.r };
    this.from = f;

    this.el.classList.add("open");
    if (prefersReducedMotion()) {
      this.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "ease-out" });
      return;
    }

    this.begin();
    this.W.jump(f.w);
    this.H.jump(f.h);
    this.R.jump(f.r);

    if (this.slide) {
      this.G.tune(p.side[0]);
      this.S.tune(p.side[1]);
      this.G.jump(0);
      this.G.x = -this.slide * (f.w + 4);
      this.S.jump(1);
      this.S.x = 0.5;
    }

    this.paint();
    enterRows(this.lay, 1);
    this.punch();
    this.shapeTo(this.size, m.r);
    this.settleOrRun();
  }

  leave(): void {
    const el = this.el;
    if (!el.classList.contains("open")) return;
    el.classList.remove("open");
    el.setAttribute("data-lv", "");

    if (prefersReducedMotion()) {
      el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 120,
        easing: "ease-out",
        fill: "forwards",
      });
      this.later(120, () => this.reset());
      return;
    }

    this.timers.forEach(clearTimeout);
    this.timers.length = 0;
    if (!this.wake()) return;

    const f = this.from;
    this.wind = false;
    exitItems(this.lay);
    this.shapeTo(f, f.r);

    if (this.slide) {
      this.G.to = -this.slide * (f.w + 4);
      this.S.to = 0.5;
    }

    this.squash();
    el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: MOT.exitBouncyMs,
      easing: EXIT.easing,
      fill: "forwards",
    });
    this.later(MOT.exitBouncyMs, () => this.reset());
  }

  relayout(change: () => void): void {
    if (prefersReducedMotion() || !this.el.classList.contains("open")) {
      change();
      return;
    }
    const snap = measureFlip(this.lay);
    this.glide();
    change();
    const m = this.measure();
    this.fit(m);
    this.lay.style.width = `${m.cw}px`;
    this.lay.style.height = `${Math.max(m.ch, m.sh)}px`;
    this.shapeTo(this.size, m.r);
    this.settleOrRun();
    playFlip(this.lay, snap, this);
  }
}

/** Check if element or ancestor can scroll in direction d */
export function canScroll(n: HTMLElement, d: number): boolean {
  const max = n.scrollHeight - n.clientHeight;
  if (max <= 1) return false;
  const oy = getComputedStyle(n).overflowY;
  if (oy !== "auto" && oy !== "scroll") return false;
  return d < 0 ? n.scrollTop > 0 : n.scrollTop < max - 1;
}

/** Attach wheel-bump physics to an overlay element with Surf */
export function wheelAttach(root: HTMLElement & { sf?: Surf }): void {
  root.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      const s = root.sf;
      if (!s || !root.classList.contains("open")) return;
      const d = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      if (!d) return;

      let n: HTMLElement | null = e.target as HTMLElement | null;
      while (n && n !== root.parentElement) {
        if (n.nodeType === 1 && canScroll(n, d)) return;
        n = n.parentElement;
      }

      e.preventDefault();
      if (Date.now() < s.lock || Math.abs(d) < 4) return;
      s.endBump(d > 0 ? 1 : -1);
      s.lock = Date.now() + getActivePreset().lock;
    },
    { passive: false },
  );
}

/** Press interaction: springs element scale to pressScale and back on release */
export function pressEl(el: HTMLElement & { _pr?: { P: Spring; sim: Sim } }, down: boolean): void {
  let pr = el._pr;
  if (!pr) {
    const P = new Spring(1, SP.press);
    const sim: Sim = {
      sp: [P],
      apply: () => {
        el.style.scale = P.x === 1 ? "" : String(P.x);
      },
    };
    pr = el._pr = { P, sim };
  }
  pr.P.to = down ? MOT.pressScale : 1;
  simAdd(pr.sim);
}

/** Attach a new Surf instance to an overlay element */
export function surf(el: HTMLElement & { lay?: HTMLElement; sf?: Surf }): Surf {
  let lay = el.querySelector<HTMLElement>(".ll-lay");
  if (!lay) {
    lay = document.createElement("div");
    lay.className = "ll-lay";
    while (el.firstChild) {
      lay.appendChild(el.firstChild);
    }
    el.appendChild(lay);
  }
  el.lay = lay;
  const s = new Surf(el, lay);
  el.sf = s;
  wheelAttach(el);
  return s;
}

