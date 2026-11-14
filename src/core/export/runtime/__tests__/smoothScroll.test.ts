import { describe, it } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { buildSmoothScrollSource } from "../smoothScroll";

type Handler = (e: Record<string, unknown>) => void;
/** A page with a wheel, a scroll position, a frame clock and the listeners the script adds. */
function page(opts: { reduced?: boolean; height?: number; viewport?: number } = {}) {
  const listeners: Record<string, Handler[]> = {};
  const state = { scrollY: 0, scrolledTo: [] as number[] };
  const frames: ((now: number) => void)[] = [];
  const win: Record<string, unknown> = {
    get scrollY() { return state.scrollY; },
    innerHeight: opts.viewport ?? 800,
    matchMedia: () => ({ matches: !!opts.reduced }),
    addEventListener: (type: string, fn: Handler) => ((listeners[type] ??= []).push(fn)),
    scrollTo: (_x: number, y: number) => { state.scrollY = y; state.scrolledTo.push(y); (listeners.scroll ?? []).forEach((h) => h({})); },
    requestAnimationFrame: (fn: (now: number) => void) => { frames.push(fn); return frames.length; },
  };
  const ctx = vm.createContext({
    window: Object.assign(win, {}), document: { documentElement: { scrollHeight: opts.height ?? 4000 }, body: {} },
    performance: { now: () => 0 }, getComputedStyle: () => ({ overflowY: "visible" }), Math, JSON,
  });
  (ctx as { window: unknown }).window = win;
  vm.runInContext(buildSmoothScrollSource({ tau: 0.2 }).replace(/\bwindow\./g, "window."), ctx);
  const wheel = (deltaY: number, extra: Record<string, unknown> = {}) => {
    const e = { deltaY, deltaX: 0, deltaMode: 0, ctrlKey: false, metaKey: false, defaultPrevented: false, target: {}, prevented: false, preventDefault() { this.prevented = true; this.defaultPrevented = true; }, ...extra };
    (listeners.wheel ?? []).forEach((h) => h(e));
    return e;
  };
  /** Run animation frames for `seconds` at `fps`. */
  const run = (seconds: number, fps = 60) => {
    let now = 0;
    for (let i = 0; i < seconds * fps; i++) {
      now += 1000 / fps;
      const batch = frames.splice(0);
      batch.forEach((f) => f(now));
    }
  };
  return { state, listeners, wheel, run, win };
}

describe("smooth scrolling in the export (D14)", () => {
  it("a visitor who asked for less motion gets no smoothing: no listeners at all", () => {
    const p = page({ reduced: true });
    assert.equal(Object.keys(p.listeners).length, 0);
  });

  it("the wheel moves a target and the page eases to it: not a jump, and it arrives", () => {
    const p = page();
    const e = p.wheel(400);
    assert.equal(e.prevented, true, "the browser's own jump is replaced");
    p.run(0.05);
    assert.ok(p.state.scrollY > 0 && p.state.scrollY < 200, `after 50 ms it is on its way: ${p.state.scrollY}`);
    p.run(2);
    assert.equal(p.state.scrollY, 400);
  });

  it("it settles in about tau at any frame rate: after 3 tau it is within 5% of the way, at 30, 60 and 144 fps", () => {
    for (const fps of [30, 60, 144]) {
      const p = page();
      p.wheel(1000);
      p.run(0.6, fps); // 3 x 0.2 s
      assert.ok(Math.abs(p.state.scrollY - 1000) / 1000 < 0.06, `${fps} fps: ${p.state.scrollY}`);
    }
  });

  it("wheel clicks add up, and the target stays inside the page", () => {
    const p = page({ height: 1000, viewport: 800 }); // 200 px to scroll
    p.wheel(150); p.wheel(150); p.wheel(150);
    p.run(3);
    assert.equal(p.state.scrollY, 200);
    p.wheel(-500);
    p.run(3);
    assert.equal(p.state.scrollY, 0);
  });

  it("everything but the wheel is left to the browser: pinch zoom, sideways wheels, nothing to scroll", () => {
    const p = page();
    assert.equal(p.wheel(300, { ctrlKey: true }).prevented, false, "ctrl + wheel is zoom");
    assert.equal(p.wheel(300, { metaKey: true }).prevented, false);
    assert.equal(p.wheel(10, { deltaX: 80 }).prevented, false, "a mostly sideways wheel");
    assert.equal(p.wheel(0).prevented, false);
  });

  it("a scroll it did not make (a key, an anchor, the scrollbar) moves its target, so it never fights the browser", () => {
    const p = page();
    p.wheel(300);
    p.run(2);
    assert.equal(p.state.scrollY, 300);
    // End key / an anchor jump: the browser scrolls to 3000
    p.state.scrollY = 3000;
    (p.listeners.scroll ?? []).forEach((h) => h({}));
    p.run(1);
    assert.equal(p.state.scrollY, 3000, "it did not drag the page back");
    p.wheel(-100); // and the next wheel starts from where the page is now
    p.run(2);
    assert.equal(p.state.scrollY, 2900);
  });

  it("an inner scroller that can scroll keeps the wheel", () => {
    const listeners: Record<string, Handler[]> = {};
    const ctx = vm.createContext({
      window: { scrollY: 0, innerHeight: 800, matchMedia: () => ({ matches: false }), addEventListener: (t: string, f: Handler) => ((listeners[t] ??= []).push(f)), scrollTo() {}, requestAnimationFrame() { return 1; } },
      document: { documentElement: { scrollHeight: 4000 }, body: {} }, performance: { now: () => 0 },
      getComputedStyle: (el: { o?: string }) => ({ overflowY: el.o ?? "visible" }), Math,
    });
    vm.runInContext(buildSmoothScrollSource({ tau: 0.2 }), ctx);
    const list = { o: "auto", scrollHeight: 900, clientHeight: 300, parentElement: null };
    const item = { o: "visible", scrollHeight: 20, clientHeight: 20, parentElement: list };
    const e = { deltaY: 100, deltaX: 0, deltaMode: 0, ctrlKey: false, metaKey: false, defaultPrevented: false, target: item, prevented: false, preventDefault() { this.prevented = true; } };
    listeners.wheel.forEach((h) => h(e));
    assert.equal(e.prevented, false);
  });

  it("the script imports nothing", () => {
    assert.doesNotMatch(buildSmoothScrollSource({ tau: 0.2 }), /\bimport\b|\brequire\(/);
  });
});
