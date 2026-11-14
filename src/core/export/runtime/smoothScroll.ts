/**
 * Smooth scrolling for the export (Design track D14, FX-EXP-01: readable source, no imports). The wheel moves a target and the
 * page eases toward it (`y += (target - y) * (1 - e^(-dt / tau))`, so it takes about `tau` seconds to settle at any frame rate).
 *
 * It only takes over the mouse wheel, and gives everything else to the browser, so nothing a visitor relies on breaks:
 * keyboard scrolling (arrows, space, page keys, home and end), find in page, anchor links and the URL hash, dragging the
 * scrollbar, touch, pinch zoom (a wheel with ctrl), and scrollers inside the page (a list, a map) are all native. Any scroll it
 * did not make itself resets its target to where the page now is, so it never fights the browser. A visitor who asked for less
 * motion gets no smoothing at all.
 */
export interface SmoothScrollOptions {
  /** Seconds the page takes to catch up with the wheel (about): 0.1 is snappy, 0.4 is floaty. */
  tau: number;
}

export function buildSmoothScrollSource(options: SmoothScrollOptions): string {
  const tau = Math.min(2, Math.max(0.02, options.tau));
  return `/*
 * Smooth scrolling, exported from LazyLayout. This file stands alone: it imports nothing and needs no package.
 * It eases the mouse wheel; keyboard, find in page, anchors, touch and the scrollbar stay native.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; /* the page scrolls as the browser does */
  var TAU = ${JSON.stringify(Math.round(tau * 1000) / 1000)};
  var y = window.scrollY, target = y, last = 0, running = false, written = y;
  function max() { return Math.max(0, document.documentElement.scrollHeight - window.innerHeight); }
  function inner(el) {
    /* a scroller inside the page that can scroll the way the wheel goes keeps the wheel */
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      var o = getComputedStyle(el).overflowY;
      if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight + 1) return true;
    }
    return false;
  }
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.1); last = now;
    y += (target - y) * (1 - Math.exp(-dt / TAU));
    if (Math.abs(target - y) < 0.4) y = target;
    written = Math.round(y * 100) / 100;
    window.scrollTo(0, written);
    if (y !== target) window.requestAnimationFrame(frame); else running = false;
  }
  window.addEventListener("wheel", function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (inner(e.target)) return;
    var unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    if (!running) { y = window.scrollY; target = y; }
    target = Math.min(max(), Math.max(0, target + e.deltaY * unit));
    e.preventDefault();
    if (!running) { running = true; last = performance.now(); window.requestAnimationFrame(frame); }
  }, { passive: false });
  /* any scroll that is not ours (a key, an anchor, the scrollbar, a script) is the browser's: follow it */
  window.addEventListener("scroll", function () {
    if (Math.abs(window.scrollY - written) > 1.5 && !running) { y = window.scrollY; target = y; written = y; }
    else if (Math.abs(window.scrollY - written) > 1.5 && running) { y = window.scrollY; target = y; running = false; }
  }, { passive: true });
})();
`;
}
