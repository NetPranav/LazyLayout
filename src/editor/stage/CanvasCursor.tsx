"use client";

import React, { useEffect, useRef } from "react";
import { useToolStore } from "@/core/store/useToolStore";
import { springEase, cancelAll } from "@/editor/motion/ease";
import { getActivePreset, prefersReducedMotion } from "@/editor/motion/feel";
import { defaultHost } from "@/editor/motion/loop";
import type { FrameInfo } from "@/core/time/scheduler";
import "./stage.css";

export type CursorKind =
  | "sel"
  | "move"
  | "hand"
  | "grabbing"
  | "x"
  | "ibeam"
  | "eye"
  | "zin"
  | "zout"
  | "copy"
  | "add"
  | "locked"
  | "rs"
  | "rot"
  | "x-frame"
  | "x-rect"
  | "x-ellipse"
  | "x-line"
  | "x-arrow"
  | "x-polygon"
  | "x-star"
  | "x-image";

interface GlyphDef {
  x: number;
  y: number;
  t?: string;
  p: [string, string][];
}

const ARROW = "M6 5L21 11L13.8 13.4L11.4 20.6Z";
const CROSS = "M12 3V9M12 15V21M3 12H9M15 12H21";

const BADGE: Record<string, string> = {
  frame: "M24.5 22V30M27.5 22V30M22 24.5H30M22 27.5H30",
  rect: "M22.5 22.5H29.5V29.5H22.5Z",
  ellipse: "M26 22.5A3.5 3.5 0 1 1 25.99 22.5Z",
  line: "M22.5 29.5L29.5 22.5",
  image: "M22.5 22.5H29.5V29.5H22.5ZM22.5 28L25 25.5L27 27.5L29.5 25",
  polygon: "M24 22.5H28L30 26L28 29.5H24L22 26Z",
  star: "M26 22L27.2 24.8L30 25.1L28 27L28.6 30L26 28.5L23.4 30L24 27L22 25.1L24.8 24.8Z",
  arrow: "M22.5 26H29.5M27 23.5L29.5 26L27 28.5",
};

export const GLYPHS: Record<string, GlyphDef> = {
  sel: { x: 6, y: 5, p: [["a", ARROW]] },
  move: {
    x: 16,
    y: 16,
    p: [["s", "M16 5V27M5 16H27M12 9L16 5L20 9M12 23L16 27L20 23M9 12L5 16L9 20M23 12L27 16L23 20"]],
  },
  hand: {
    x: 16,
    y: 16,
    t: "translate(4 4)",
    p: [["s", "M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"]],
  },
  grabbing: {
    x: 16,
    y: 16,
    p: [["s", "M8 14a2 2 0 0 1 4 0a2 2 0 0 1 4 0a2 2 0 0 1 4 0a2 2 0 0 1 4 0V19a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6ZM8 14V13"]],
  },
  x: { x: 12, y: 12, p: [["s", CROSS]] },
  ibeam: { x: 16, y: 16, p: [["s", "M11 5H21M11 27H21M16 5V27"]] },
  eye: {
    x: 5,
    y: 27,
    p: [["s", "M5 27L6 22L19 9L23 13L10 26ZM17.5 10.5L22 6A2.8 2.8 0 0 1 26 10L21.5 14.5"]],
  },
  zin: {
    x: 13,
    y: 13,
    p: [["s", "M13 5A8 8 0 1 1 12.99 5ZM19 19L27 27M13 9.5V16.5M9.5 13H16.5"]],
  },
  zout: {
    x: 13,
    y: 13,
    p: [["s", "M13 5A8 8 0 1 1 12.99 5ZM19 19L27 27M9.5 13H16.5"]],
  },
  copy: {
    x: 6,
    y: 5,
    p: [
      ["a", ARROW],
      ["w", "M19.5 19.5H29.5V29.5H19.5Z"],
      ["s", "M24.5 22V27M22 24.5H27"],
    ],
  },
  add: {
    x: 6,
    y: 5,
    p: [
      ["a", ARROW],
      ["s", "M25 20V28M21 24H29"],
    ],
  },
  locked: {
    x: 16,
    y: 16,
    p: [["s", "M16 7A9 9 0 1 1 15.99 7ZM9.6 22.4L22.4 9.6"]],
  },
  rs: {
    x: 16,
    y: 16,
    p: [["s", "M5 16H27M10 11L5 16L10 21M22 11L27 16L22 21"]],
  },
  rot: {
    x: 16,
    y: 16,
    t: "translate(-2 -2)",
    p: [["s", "M24 8A16 16 0 0 1 8 24M19.5 12.5L24 8L28.5 12.5M12.5 19.5L8 24L12.5 28.5"]],
  },
};

// Wire crosshair shape badges
for (const [key, d] of Object.entries(BADGE)) {
  GLYPHS[`x-${key}`] = { x: 12, y: 12, p: [["s", CROSS], ["s", d]] };
}

const PER: Record<string, number> = { rs: 180, rot: 360 };
const RSB: Record<string, number> = { e: 0, w: 0, se: 45, nw: 45, s: 90, n: 90, sw: 135, ne: 135 };
const ROB: Record<string, number> = { se: 0, sw: 90, nw: 180, ne: 270 };

// Lane B4 Motion & Dimension Constants
const GLYPH_GRID = 32; // glyph artwork viewBox units; scaled to --ll-size-cursor
const CURSOR_FADE_DURATION_MS = 80;
const CURSOR_MAX_OUT_DURATION_MS = 140;
const CURSOR_BLUR_IN = "blur(0px)";
const CURSOR_BLUR_OUT = "blur(4px)";
const CURSOR_SCALE_NORMAL = "scale(1)";
const CURSOR_SCALE_INITIAL = "scale(0.85)";
const CURSOR_SCALE_PRESSED = 0.9;
const CURSOR_SCALE_UNPRESSED = 1;
const XF: [number, number] = [0.11, 1];
const ROT_SP: [number, number] = [0.2, 0.8];
const PRESS_SP: [number, number] = [0.1, 0.7];
const LEAN: Record<string, number> = { sel: 1, copy: 1, add: 1, hand: 0.5, grabbing: 0.5 };
const ARR: Record<string, number> = { sel: 1, copy: 1, add: 1, move: 1 };
const HOV = "button,[role=button],[role=tab],[role=treeitem],a,.row,[data-handle],[data-r],[data-sel]";
const NAT = "input,textarea,select,button,a,[role=menu],.menu,[role=dialog]";

const SVGS: Record<string, string> = {};

export function renderCursorSvg(kd: string): string {
  if (SVGS[kd]) return SVGS[kd];
  const g = GLYPHS[kd] || GLYPHS.sel;
  let h = "";
  let b = "";
  for (const [t, d] of g.p) {
    if (t === "a") {
      h += `<path class="ah" d="${d}"/>`;
      b += `<path class="ab" d="${d}"/>`;
    } else {
      h += `<path class="h" d="${d}"/>`;
      b += `<path class="${t === "w" ? "wl" : "l"}" d="${d}"/>`;
    }
  }
  const inner = g.t ? `<g transform="${g.t}">${h}${b}</g>` : `${h}${b}`;
  const res = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true">${inner}</svg>`;
  SVGS[kd] = res;
  return res;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

interface CanvasCursorProps {
  viewportRef: React.RefObject<HTMLDivElement | null>;
}

export const CanvasCursor: React.FC<CanvasCursorProps> = ({ viewportRef }) => {
  const curRef = useRef<HTMLDivElement | null>(null);
  const cpRef = useRef<HTMLDivElement | null>(null);
  const cvRef = useRef<HTMLDivElement | null>(null);
  const s0Ref = useRef<HTMLDivElement | null>(null);
  const r0Ref = useRef<HTMLDivElement | null>(null);
  const s1Ref = useRef<HTMLDivElement | null>(null);
  const r1Ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const cur = curRef.current;
    const cp = cpRef.current;
    const cv = cvRef.current;
    const s0 = s0Ref.current;
    const r0 = r0Ref.current;
    const s1 = s1Ref.current;
    const r1 = r1Ref.current;
    const vp = viewportRef.current;

    if (!cur || !cp || !cv || !s0 || !r0 || !s1 || !r1 || !vp) return;
    const viewport: HTMLDivElement = vp;

    const slots = [
      { s: s0, r: r0 },
      { s: s1, r: r1 },
    ];
    let front = -1;
    let kind: string | null = null;
    let ang = 0;
    let shown = false;
    let ps = 1;
    let drag = false;
    let lock: { k: string; a: number } | null = null;
    let held = false;
    let unregisterSched: (() => void) | null = null;
    let last: PointerEvent | null = null;
    const mods = { alt: false, shift: false, z: false };

    // Motion physics state
    const LS = { x: 0, v: 0 };
    const SS = { x: 0, v: 0 };
    const PS = { x: 0, v: 0 };
    let accX = 0;
    let accY = 0;
    let px: number | null = null;
    let py: number | null = null;
    let vsx = 0;
    let vsy = 0;
    let dirA = 0;
    let unregisterMloop: (() => void) | null = null;
    let hoverN: Element | null = null;
    let tcur = "";

    function on() {
      if (shown) return;
      shown = true;
      cur?.classList.add("on");
      viewport?.classList.add("ll-stage-cursor-active");
    }

    function off() {
      if (!shown) return;
      shown = false;
      cur?.classList.remove("on");
      viewport?.classList.remove("ll-stage-cursor-active");
    }

    function setKind(kd: string, a: number, fade: boolean) {
      const inc = slots[front < 0 ? 0 : 1 - front];
      const out = front < 0 ? null : slots[front];
      const g = GLYPHS[kd] || GLYPHS.sel;
      const per = PER[kd];

      cancelAll(inc.s);
      cancelAll(inc.r);
      inc.r.innerHTML = renderCursorSvg(kd);
      inc.s.style.left = `calc(-${g.x} * var(--ll-size-cursor) / ${GLYPH_GRID})`;
      inc.s.style.top = `calc(-${g.y} * var(--ll-size-cursor) / ${GLYPH_GRID})`;
      inc.s.style.transformOrigin = `calc(${g.x} * var(--ll-size-cursor) / ${GLYPH_GRID}) calc(${g.y} * var(--ll-size-cursor) / ${GLYPH_GRID})`;

      ang = per ? a : 0;
      inc.r.style.transform = per ? `rotate(${ang}deg)` : "";
      inc.s.style.opacity = "1";

      if (out) {
        cancelAll(out.s);
        out.s.style.opacity = "0";
      }

      if (fade && typeof inc.s.animate === "function") {
        if (prefersReducedMotion()) {
          const opt: KeyframeAnimationOptions = { duration: CURSOR_FADE_DURATION_MS, easing: "ease-out" };
          inc.s.animate([{ opacity: 0 }, { opacity: 1 }], opt);
          if (out) out.s.animate([{ opacity: 1 }, { opacity: 0 }], opt);
        } else {
          const e = springEase(XF[0], XF[1]);
          inc.s.animate(
            [
              { opacity: 0, filter: CURSOR_BLUR_OUT, transform: CURSOR_SCALE_INITIAL },
              { opacity: 1, filter: CURSOR_BLUR_IN, transform: CURSOR_SCALE_NORMAL },
            ],
            { duration: e.duration, easing: e.easing }
          );
          if (out) {
            out.s.animate(
              [
                { opacity: 1, filter: CURSOR_BLUR_IN, transform: CURSOR_SCALE_NORMAL },
                { opacity: 0, filter: CURSOR_BLUR_OUT, transform: CURSOR_SCALE_INITIAL },
              ],
              { duration: Math.min(e.duration, CURSOR_MAX_OUT_DURATION_MS), easing: "ease-out" }
            );
          }
        }
      }

      front = front < 0 ? 0 : 1 - front;
      kind = kd;
    }

    function rotateTo(a: number) {
      if (!kind) return;
      const per = PER[kind];
      let d = mod(a - ang, per);
      const r = slots[front].r;
      if (d > per / 2) d -= per;
      if (!d) return;

      if (prefersReducedMotion() || typeof r.animate !== "function") {
        ang += d;
        r.style.transform = `rotate(${ang}deg)`;
        return;
      }

      let from = ang;
      if (r.getAnimations().length) {
        const m = getComputedStyle(r).transform;
        if (m && m !== "none") {
          const match = m.match(/matrix\(([^)]+)\)/);
          if (match) {
            const parts = match[1].split(",");
            from = (Math.atan2(+parts[1], +parts[0]) * 180) / Math.PI;
            from += 360 * Math.round((ang - from) / 360);
          }
        }
      }

      cancelAll(r);
      ang += d;
      const e = springEase(ROT_SP[0], ROT_SP[1]);
      r.animate(
        [
          { transform: `rotate(${from}deg)` },
          { transform: `rotate(${ang}deg)` },
        ],
        { duration: e.duration, easing: e.easing }
      );
      r.style.transform = `rotate(${ang}deg)`;
    }

    function apply(kd: string, a: number) {
      if (kd !== kind) setKind(kd, a, shown);
      else if (PER[kd]) rotateTo(a);
    }

    function press(v: number) {
      if (v === ps || !cp) return;
      ps = v;
      if (prefersReducedMotion() || typeof cp.animate !== "function") {
        cp.style.transform = v === 1 ? "" : `scale(${v})`;
        return;
      }
      const from = getComputedStyle(cp).transform;
      cancelAll(cp);
      const m = getActivePreset();
      const e = springEase(
        v === 1 && m ? m.pop[0] * 0.6 : PRESS_SP[0],
        v === 1 && m ? Math.min(m.pop[1], 0.5) : PRESS_SP[1]
      );
      cp.animate([{ transform: from }, { transform: `scale(${v})` }], {
        duration: e.duration,
        easing: e.easing,
      });
      cp.style.transform = `scale(${v})`;
    }

    function sstep(s: { x: number; v: number }, to: number, sp: [number, number], dt: number) {
      const k = Math.pow((2 * Math.PI) / sp[0], 2);
      const c = (4 * Math.PI * sp[1]) / sp[0];
      const h = dt / 3;
      for (let i = 0; i < 3; i++) {
        s.v += (-k * (s.x - to) - c * s.v) * h;
        s.x += s.v * h;
      }
    }

    function mclear() {
      if (unregisterMloop) {
        unregisterMloop();
        unregisterMloop = null;
      }
      LS.x = LS.v = SS.x = SS.v = PS.x = PS.v = 0;
      accX = accY = vsx = vsy = 0;
      if (cv && tcur) {
        cv.style.transform = "";
        tcur = "";
      }
    }

    function mloop(info: FrameInfo) {
      if (prefersReducedMotion() || !cv) {
        mclear();
        return;
      }
      const m = getActivePreset();
      const dt = Math.min(Math.max(info.dt || 0.016, 0.001), 0.032);
      const vx = accX / dt;
      const vy = accY / dt;
      accX = accY = 0;
      const al = 1 - Math.exp(-dt / 0.06);
      vsx += (vx - vsx) * al;
      vsy += (vy - vsy) * al;
      const sp = Math.sqrt(vsx * vsx + vsy * vsy);
      if (sp > 25) dirA = (Math.atan2(vsy, vsx) * 180) / Math.PI;

      const lf = kind ? LEAN[kind] || 0 : 0;
      const lm = 10 * (0.15 + (0.85 * m.wiggle) / 12) * lf;
      const sm = (m.stretch / 0.015) * 0.06 * (lf ? 1 : 0.5);
      const hl: [number, number] = [m.hl[0] * 0.6, m.hl[1]];

      sstep(LS, Math.max(-1, Math.min(1, vsx / 1400)) * lm, hl, dt);
      sstep(SS, Math.min(sp / 1800, 1) * sm, hl, dt);
      sstep(PS, 0, [m.pop[0] * 0.7, m.pop[1]], dt);

      let tr: string;
      if (lf) {
        tr = `rotate(${LS.x.toFixed(2)}deg) scale(${(1 + PS.x).toFixed(4)}) rotate(${dirA.toFixed(1)}deg) scale(${(1 + SS.x).toFixed(4)},${(1 - SS.x * 0.35).toFixed(4)}) rotate(${(-dirA).toFixed(1)}deg)`;
      } else {
        tr = `scale(${(1 + PS.x + SS.x).toFixed(4)})`;
      }

      if (tr !== tcur) {
        cv.style.transform = tr;
        tcur = tr;
      }

      if (
        sp < 8 &&
        Math.abs(LS.x) < 0.02 &&
        Math.abs(LS.v) < 0.2 &&
        Math.abs(SS.x) < 0.0004 &&
        Math.abs(SS.v) < 0.01 &&
        Math.abs(PS.x) < 0.0008 &&
        Math.abs(PS.v) < 0.01
      ) {
        mclear();
        return;
      }
    }

    function mwake() {
      if (!unregisterMloop && cv && !prefersReducedMotion()) {
        unregisterMloop = defaultHost.register(mloop);
      }
    }

    function pop(amp: number) {
      if (!kind || !ARR[kind] || prefersReducedMotion()) return;
      const m = getActivePreset();
      const w = (2 * Math.PI) / (m.pop[0] * 0.7);
      const z = m.pop[1];
      const pk = Math.exp((-z / Math.sqrt(1 - z * z)) * Math.atan(Math.sqrt(1 - z * z) / z));
      PS.v = (amp * w) / pk;
      mwake();
    }

    function inRegion(t: EventTarget | null): boolean {
      if (!t || !(t instanceof Element)) return false;
      if (!viewport.contains(t)) return false;
      const nat = t.closest(NAT);
      // Native elements outside stage elements stay native
      return !(nat && !nat.closest("[data-element-id],[data-sel]"));
    }

    function getHandleInfo(h: Element): { kind: string; angle: number } {
      const handleName = h.getAttribute("data-handle") || h.getAttribute("data-h");
      const rotName = h.getAttribute("data-r");
      if (handleName) {
        const base = RSB[handleName] ?? 0;
        return { kind: "rs", angle: mod(base, 180) };
      }
      if (rotName) {
        const base = ROB[rotName] ?? 0;
        return { kind: "rot", angle: mod(base, 360) };
      }
      return { kind: "rs", angle: 0 };
    }

    function getDrawKind(): string {
      const active = useToolStore.getState().current;
      switch (active) {
        case "text":
          return "ibeam";
        case "pan":
          return "hand";
        case "frame":
          return "x-frame";
        case "rectangle":
          return "x-rect";
        case "ellipse":
          return "x-ellipse";
        case "line":
          return "x-line";
        case "arrow":
          return "x-arrow";
        case "polygon":
          return "x-polygon";
        case "star":
          return "x-star";
        default:
          return active === "select" || active === "deepSelect" ? "sel" : "x";
      }
    }

    function update() {
      const e = last;
      if (!e || !cur) return;
      if (e.pointerType !== "mouse") {
        off();
        return;
      }
      const t = e.target as Element | null;
      if (held) {
        off();
        return;
      }

      // Check context menu presence
      if (document.querySelector(".menu:not([hidden]),[role=menu]")) {
        off();
        return;
      }

      if (!drag && !inRegion(t)) {
        off();
        return;
      }

      let kd = "sel";
      let a = 0;
      const ed = t && t.closest("[contenteditable]");
      const h = !e.buttons && !lock && t && t.closest("[data-handle],[data-r]");

      if (lock) {
        kd = lock.k;
        a = lock.a;
      } else if (h) {
        const info = getHandleInfo(h);
        kd = info.kind;
        a = info.angle;
      } else if (mods.z) {
        kd = mods.alt ? "zout" : "zin";
      } else if (ed) {
        kd = "ibeam";
      } else {
        const activeTool = useToolStore.getState().current;
        if (activeTool === "pan") {
          kd = e.buttons ? "grabbing" : "hand";
        } else if (activeTool !== "select" && activeTool !== "deepSelect") {
          kd = getDrawKind();
        } else {
          // Select mode
          const el = t ? t.closest("[data-element-id],[data-sel]") : null;
          const isSelected = el?.getAttribute("data-selected") === "true";
          const isLocked = el?.getAttribute("data-locked") === "true";

          if (isLocked) {
            kd = "locked";
          } else if (isSelected) {
            kd = mods.alt ? "copy" : "move";
          } else if (mods.shift && el) {
            kd = "add";
          } else {
            kd = "sel";
          }
        }
      }

      apply(kd, a);
      on();
    }

    function sched() {
      if (!unregisterSched) {
        unregisterSched = defaultHost.register(() => {
          if (unregisterSched) {
            unregisterSched();
            unregisterSched = null;
          }
          update();
        });
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (held && last && (Math.abs(e.clientX - last.clientX) > 2 || Math.abs(e.clientY - last.clientY) > 2)) {
        held = false;
      }
      last = e;
      mods.alt = e.altKey;
      mods.shift = e.shiftKey;

      if (cur && e.pointerType === "mouse") {
        cur.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
        if (px !== null && py !== null) {
          accX += e.clientX - px;
          accY += e.clientY - py;
          mwake();
        }
        px = e.clientX;
        py = e.clientY;
      }
      sched();
    };

    const onPointerDown = (e: PointerEvent) => {
      last = e;
      if (e.pointerType !== "mouse") return;
      const h = (e.target as Element | null)?.closest("[data-handle],[data-r]");
      if (h) {
        const info = getHandleInfo(h);
        lock = { k: info.kind, a: info.angle };
      }
      if (inRegion(e.target)) {
        drag = true;
        document.documentElement.classList.add("ll-drag");
        press(CURSOR_SCALE_PRESSED);
      }
      sched();
    };

    const endDrag = () => {
      lock = null;
      drag = false;
      document.documentElement.classList.remove("ll-drag");
      press(CURSOR_SCALE_UNPRESSED);
      sched();
    };

    const onContextMenu = () => {
      held = true;
      endDrag();
      off();
    };

    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.buttons) return;
      const target = e.target as Element | null;
      if (!target || !inRegion(target)) return;
      const h = target.closest(HOV);
      if (h && h !== hoverN) {
        pop(h.closest("[data-element-id],[data-sel]") ? 0.06 : 0.12);
      }
      hoverN = h;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      mods.alt = e.altKey;
      mods.shift = e.shiftKey;
      const k = e.key;
      const isInput = (e.target as HTMLElement | null)?.matches?.(NAT);
      if ((k === "z" || k === "Z") && !e.ctrlKey && !e.metaKey && !isInput) {
        mods.z = true;
      }
      sched();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      mods.alt = e.altKey;
      mods.shift = e.shiftKey;
      if (e.key === "z" || e.key === "Z") {
        mods.z = false;
      }
      sched();
    };

    const onMouseLeave = () => {
      px = null;
      py = null;
      hoverN = null;
      off();
    };

    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", endDrag, true);
    window.addEventListener("pointercancel", endDrag, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("blur", () => {
      mods.alt = mods.shift = mods.z = false;
      endDrag();
      off();
    });
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);

    // Initial cursor setup
    setKind("sel", 0, false);

    return () => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", endDrag, true);
      window.removeEventListener("pointercancel", endDrag, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      document.documentElement.classList.remove("ll-drag");
      viewport?.classList.remove("ll-stage-cursor-active");
      if (unregisterSched) {
        unregisterSched();
        unregisterSched = null;
      }
      if (unregisterMloop) {
        unregisterMloop();
        unregisterMloop = null;
      }
    };
  }, [viewportRef]);

  return (
    <div id="ll-cur" ref={curRef} aria-hidden="true">
      <div className="ll-cp" ref={cpRef}>
        <div className="ll-cv" ref={cvRef}>
          <div className="ll-cs" ref={s0Ref}>
            <div className="ll-cr" ref={r0Ref} />
          </div>
          <div className="ll-cs" ref={s1Ref}>
            <div className="ll-cr" ref={r1Ref} />
          </div>
        </div>
      </div>
    </div>
  );
};
