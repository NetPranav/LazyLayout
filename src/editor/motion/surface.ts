// Surface motion engine (IslandEngine overlay surface) ported from Nook & prototype

import { Spring } from "./spring";
import { simAdd, simRemove, type Sim } from "./loop";
import { MOT, SP, EXIT, MENU_FALLBACKS } from "./presets";
import { getActivePreset, prefersReducedMotion } from "./feel";
import { springAnim, cancelAll } from "./ease";
import { isUserMotionOff } from "./reducedMotion";
import { measureFlip, playFlip } from "./flip";

export interface SurfaceOptions {
  up?: boolean;
  right?: boolean;
  from?: { w: number; h: number; r: number };
  y0?: number;
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

function shp(): [number, number] {
  return getActivePreset().shape;
}

/**
 * Blur and fade an item into view (runs on CSS animation, never on a spring)
 */
export function blurIn(c: HTMLElement, d: number): void {
  if (typeof c.animate !== "function" || isUserMotionOff()) return;
  c.animate(
    [
      { opacity: 0, filter: `blur(${MOT.blur[0]}px)` },
      { opacity: 1, filter: "blur(0px)" },
    ],
    {
      duration: MOT.blurMs,
      easing: "cubic-bezier(.2,.8,.3,1)",
      delay: d,
      fill: "backwards",
    }
  );
}

/**
 * Animate rows entering a surface layer from trigger with spring physics and blur fade
 */
export function enterRows(layer: HTMLElement): void {
  const p = getActivePreset();
  let n = 0;
  const isMenu = layer.parentElement?.classList.contains("ll-menu");
  const sc = isMenu
    ? (typeof p.rowScale === "number" ? p.rowScale : 0.9)
    : 1 - (1 - (typeof p.rowScale === "number" ? p.rowScale : 0.9)) / 3;
  const children = Array.from(layer.children) as HTMLElement[];

  children.forEach((c) => {
    if (c.classList.contains("ll-hl") || c.offsetParent === null) return;
    cancelAll(c);
    const d = 40 + Math.min(n++, 10) * p.stagger;
    springAnim(
      c,
      [{ scale: String(sc) }, { scale: "1" }],
      p.rows[0],
      p.rows[1],
      { delay: d, fill: "backwards" }
    );
    blurIn(c, d);
  });
}

/**
 * A submenu changes list: new items slide in from opposite direction with tiny stagger
 */
export function swapIn(layer: HTMLElement, dir: number): void {
  const p = getActivePreset();
  let n = 0;
  const children = Array.from(layer.children) as HTMLElement[];

  children.forEach((c) => {
    if (c.classList.contains("ll-hl") || c.offsetParent === null) return;
    cancelAll(c);
    const d = 20 + Math.min(n++, 10) * Math.max(2, Math.round(p.stagger / 3));
    springAnim(
      c,
      [{ translate: `0 ${-dir * MOT.slide}px` }, { translate: "0 0" }],
      p.rows[0],
      p.rows[1],
      { delay: d, fill: "backwards" }
    );
    blurIn(c, d);
  });
}

/**
 * Items of the surface blur out in place on exit
 */
export function exitItems(layer: HTMLElement): void {
  const children = Array.from(layer.children) as HTMLElement[];
  children.forEach((c) => {
    cancelAll(c);
    if (typeof c.animate !== "function") return;
    c.animate(
      [
        { opacity: 1, filter: "blur(0px)" },
        { opacity: 0, filter: `blur(${MOT.blur[1]}px)` },
      ],
      { duration: MOT.blurMs, easing: EXIT.easing, fill: "forwards" }
    );
  });
}

/**
 * The old list of a submenu, copied and left behind to slide, fade and blur out while surface retargets
 */
export function ghostOf(root: HTMLElement & { lay?: HTMLElement }, dir: number): void {
  const lay = root.lay;
  if (!lay) return;
  const g = document.createElement("div");
  const c = lay.cloneNode(true) as HTMLElement;
  const h = c.querySelector(".ll-hl");
  if (h) h.remove();
  c.removeAttribute("style");
  g.setAttribute("aria-hidden", "true");
  g.style.cssText = `position:absolute;left:${lay.offsetLeft}px;top:${lay.offsetTop}px;width:${lay.offsetWidth}px;height:${lay.offsetHeight}px;translate:${lay.style.translate || "0 0"};pointer-events:none`;
  g.appendChild(c);
  root.insertBefore(g, lay);
  const a = c.animate(
    [
      { opacity: 1, filter: "blur(0px)", translate: "0 0" },
      { opacity: 0, filter: `blur(${MOT.blur[1]}px)`, translate: `0 ${dir * MOT.slide}px` },
    ],
    { duration: MOT.blurMs, easing: EXIT.easing, fill: "forwards" }
  );
  a.onfinish = a.oncancel = () => g.remove();
}

/**
 * Pop an item row upon selection: scale 1.12 back to 1
 */
export function popRow(t: HTMLElement): void {
  if (!prefersReducedMotion()) {
    springAnim(t, [{ scale: "1.12" }, { scale: "1" }], 0.2, 0.4);
  }
}

/**
 * Icon wiggle on row hover: rotates back and forth
 */
export function wiggle(row: HTMLElement): void {
  const p = getActivePreset();
  const ic = row.querySelector<HTMLElement>(".ll-ico, svg, [data-icon]");
  if (prefersReducedMotion() || !p.wiggle || !ic) return;
  const parent = row.parentElement;
  const idx = parent ? Array.from(parent.children).indexOf(row) : 0;
  const deg = (idx & 1 ? -1 : 1) * p.wiggle;
  springAnim(ic, [{ rotate: `${deg}deg` }, { rotate: "0deg" }], 0.26, 0.35);
}

/**
 * Surf is IslandEngine for one overlay surface (Menu, SubMenu, Popover, Select, CommandPalette).
 * Springs W, H, R, P, G, Y drive physics.
 */
export class Surf {
  readonly el: HTMLElement;
  readonly lay: HTMLElement;
  readonly W = new Spring(0, shp());
  readonly H = new Spring(0, shp());
  readonly R = new Spring(0, shp());
  readonly P = new Spring(1, SP.press);
  readonly G = new Spring(0, shp());
  readonly Y = new Spring(0, shp());

  size = { w: 0, h: 0 };
  from = { w: 0, h: 0, r: 0 };
  cw = 0;
  ch = 0;
  sh = 0;
  k = 1;
  lock = 0;
  feelT: ReturnType<typeof setTimeout> | undefined;
  timers: ReturnType<typeof setTimeout>[] = [];
  up = false;
  right = false;
  slide = 0;
  exitY = 0;
  mv = false;
  initialInlineWidth: string | null = null;

  readonly sim: Sim;

  constructor(el: HTMLElement, lay: HTMLElement) {
    this.el = el;
    this.lay = lay;
    this.sim = {
      sp: [this.W, this.H, this.R, this.P, this.G, this.Y],
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
    return this.el.classList.contains("ll-open") || this.el.hasAttribute("data-lv");
  }

  measure(): MeasureResult {
    const el = this.el;
    const st = el.style;
    const ls = this.lay.style;
    let keep: [string, string, string, string, string, string] | null = null;

    if (this.mv) {
      keep = [st.width, st.height, st.borderRadius, st.translate, st.scale, ls.cssText];
      el.removeAttribute("data-mv");
      st.width = this.initialInlineWidth || "";
      st.height = st.borderRadius = st.translate = st.scale = "";
      ls.cssText = "";
    } else {
      if (this.initialInlineWidth === null && st.width) {
        this.initialInlineWidth = st.width;
      }
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
    this.cw = m.cw;
    this.ch = m.ch;
    this.sh = m.sh;
    this.k = Math.min(1, m.h / 140);
  }

  begin(): void {
    // Only an inline width that was there before the surface started painting is the element's own. Once painting, the
    // width is the animation's: reading it as the original (a second open before the first has finished does) pinned
    // the surface to its small starting size, so a submenu opened as a narrow sliver.
    if (!this.mv && this.initialInlineWidth === null && this.el.style.width) {
      this.initialInlineWidth = this.el.style.width;
    }
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
    st.width = this.initialInlineWidth || (this.size.w ? `${this.size.w}px` : "");
    st.height = st.borderRadius = st.translate = st.scale = "";
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
    const dy = this.Y.x;

    st.width = `${w}px`;
    st.height = `${h}px`;
    st.borderRadius = `${Math.max(0, this.R.x)}px`;
    st.translate = dx || dy ? `${dx}px ${dy}px` : "";
    st.scale = this.P.x === 1 ? "" : String(this.P.x);

    this.lay.style.translate = `${this.right ? w - this.size.w : 0}px ${
      this.up ? h - this.size.h : 0
    }px`;
  }

  rest(): void {
    if (this.el.hasAttribute("data-lv") || this.P.to !== 1) return;
    this.end();
  }

  settleOrRun(): void {
    if (this.sim.sp.some((x) => x.x !== x.to || x.v !== 0)) {
      simAdd(this.sim);
    }
  }

  feel(ms: number, w?: [number, number], h?: [number, number]): void {
    const s = shp();
    this.W.tune(w || s);
    this.H.tune(h || s);
    if (this.feelT) clearTimeout(this.feelT);
    this.feelT = setTimeout(() => {
      this.W.tune(shp());
      this.H.tune(shp());
    }, ms);
  }

  shapeTo(size: { w: number; h: number }, radius: number): void {
    this.R.to = radius;
    this.W.to = size.w;
    this.H.to = size.h;
  }

  glide(): void {
    const p = getActivePreset();
    if (!this.wake() || prefersReducedMotion()) return;
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
    this.timers = [];
    if (this.feelT) clearTimeout(this.feelT);
    simRemove(this.sim);

    if (typeof this.el.getAnimations === "function") {
      this.el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    }

    this.el.classList.remove("ll-open");
    this.el.removeAttribute("data-lv");
    this.end();

    const s = shp();
    [this.W, this.H, this.R, this.G, this.Y].forEach((x) => {
      x.tune(s);
      x.v = 0;
    });

    this.P.jump(1);
    this.G.jump(0);
    this.Y.jump(0);
    this.slide = 0;
    this.exitY = 0;
  }

  open(options: SurfaceOptions = {}): void {
    const s = shp();
    this.up = !!options.up;
    this.right = !!options.right;
    this.slide = options.slide || 0;
    this.exitY = options.y0 || 0;

    const m = this.measure();
    this.fit(m);
    const f = options.from || { ...MENU_FALLBACKS.surfaceSeedDefault };
    this.from = f;

    this.el.classList.add("ll-open");
    if (prefersReducedMotion()) {
      this.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MENU_FALLBACKS.reducedMotionDuration, easing: "ease-out" });
      return;
    }

    [this.W, this.H, this.R, this.G, this.Y].forEach((x) => x.tune(s));
    this.begin();
    this.W.jump(f.w);
    this.H.jump(f.h);
    this.R.jump(f.r);
    this.Y.jump(this.exitY);
    this.G.jump(0);
    if (this.slide) this.G.x = -this.slide * MOT.edge;
    this.paint();
    enterRows(this.lay);
    this.shapeTo(this.size, m.r);
    this.Y.to = 0;
    this.G.to = 0;
    this.settleOrRun();
  }

  leave(): void {
    const el = this.el;
    if (!el.classList.contains("ll-open")) return;
    el.classList.remove("ll-open");
    el.setAttribute("data-lv", "");

    if (prefersReducedMotion()) {
      el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: MENU_FALLBACKS.reducedMotionDuration,
        easing: "ease-out",
        fill: "forwards",
      });
      this.later(MENU_FALLBACKS.reducedMotionDuration, () => this.reset());
      return;
    }

    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (!this.wake()) return;

    const f = this.from;
    exitItems(this.lay);
    this.shapeTo(f, f.r);
    this.Y.to = this.exitY;
    if (this.slide) this.G.to = -this.slide * MOT.edge;
    this.settleOrRun();

    el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: MOT.exitMs,
      delay: MOT.exitDelay,
      easing: EXIT.easing,
      fill: "forwards",
    });
    this.later(MOT.exitDelay + MOT.exitMs, () => this.reset());
  }

  relayout(change: () => void): void {
    if (prefersReducedMotion() || (!this.el.classList.contains("ll-open"))) {
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
      if (!s || (!root.classList.contains("ll-open"))) return;
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
    { passive: false }
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

/** Highlight state and momentum spring engine */
export interface HighlightState {
  el: HTMLElement;
  y: Spring;
  h: Spring;
  sim: Sim;
}

export function hsOf(root: HTMLElement & { hs?: HighlightState }, hl: HTMLElement): HighlightState {
  let hs = root.hs;
  if (!hs || hs.el !== hl) {
    const p = getActivePreset();
    const y = new Spring(0, p.hl);
    const h = new Spring(32, p.hl);
    const sim: Sim = {
      sp: [y, h],
      apply: () => hlApply(root),
    };
    hs = root.hs = { el: hl, y, h, sim };
  }
  return hs;
}

export function hlApply(root: HTMLElement & { hs?: HighlightState }): void {
  const hs = root.hs;
  if (!hs) return;
  const p = getActivePreset();
  const v = hs.y.v;
  const st = Math.min(Math.abs(v) * p.stretch, 14);
  let y = hs.y.x;
  if (v < 0) y -= st;
  hs.el.style.height = `${Math.max(0, hs.h.x + st).toFixed(2)}px`;
  hs.el.style.transform = `translate3d(0,${y.toFixed(2)}px,0)`;
}

export function hlMove(
  root: HTMLElement & { hs?: HighlightState; hlRow?: HTMLElement | null },
  row: HTMLElement,
  instant = false
): void {
  const hl = root.querySelector<HTMLElement>(".ll-hl");
  if (!hl || !row || (row as HTMLButtonElement).disabled) return;
  const hs = hsOf(root, hl);
  const p = getActivePreset();
  const first = !hl.classList.contains("ll-show");
  root.hlRow = row;
  hl.style.left = `${row.offsetLeft}px`;
  hl.style.width = `${row.offsetWidth}px`;
  hs.y.tune(p.hl);
  hs.h.tune(p.hl);
  hs.y.to = row.offsetTop;
  hs.h.to = row.offsetHeight;
  if (instant || first || prefersReducedMotion()) {
    hs.y.snap();
    hs.h.snap();
  }
  hl.classList.add("ll-show");
  hlApply(root);
  simAdd(hs.sim);
}

export function hlHide(root: HTMLElement & { hlRow?: HTMLElement | null }): void {
  const hl = root.querySelector<HTMLElement>(".ll-hl");
  if (hl) hl.classList.remove("ll-show");
  root.hlRow = null;
  root.querySelectorAll(".ll-lay > .ll-on").forEach((x) => x.classList.remove("ll-on"));
}

/**
 * Safe triangle: while a submenu is open, pointer heading toward it must not switch rows or close it
 */
export function inSafeTriangle(
  subEl: HTMLElement,
  mousePos: { x: number; y: number; prevX: number; prevY: number }
): boolean {
  const sf = (subEl as HTMLElement & { sf?: Surf }).sf;
  const z = sf?.size || { w: subEl.offsetWidth, h: subEl.offsetHeight };
  const l = parseFloat(subEl.style.left) || 0;
  const top = parseFloat(subEl.style.top) || 0;
  const bot = top + z.h;
  const ex = subEl.hasAttribute("data-flip") ? l + z.w : l;
  const cx = mousePos.x;
  const cy = mousePos.y;

  function sg(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  }

  const d1 = sg(cx, cy, mousePos.prevX, mousePos.prevY, ex, top);
  const d2 = sg(cx, cy, ex, top, ex, bot);
  const d3 = sg(cx, cy, ex, bot, mousePos.prevX, mousePos.prevY);

  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
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
