/**
 * Design track D11 (Main 81, export): scroll clips in the exported page. A scrubbed clip follows the scroll, a reveal plays
 * once when its layer comes into view, and a pin holds the layer while the page scrolls through its range, as the editor
 * does (`core/scroll`).
 *
 * The clip is sampled at export time into a table (so every easing, keyframe and hold is exactly what the kernel gives) and
 * the page script only reads the table: the same range maths as `core/scroll/model.ts`, scrub smoothing, and a position
 * offset written as `translate`, `rotate`, `scale` and `opacity` on top of the layer's own CSS. Pure: no page access here.
 */
import type { MotionDocument } from "../../document/schema";
import { sampleClip } from "../../kernel/evaluate";
import { isScrollPosition } from "../../scroll/model";

const PROPS = ["transform.x", "transform.y", "transform.rotate", "transform.scale", "appearance.opacity"] as const;
type Prop = (typeof PROPS)[number];
const BASE_DEFAULT: Record<Prop, number> = { "transform.x": 0, "transform.y": 0, "transform.rotate": 0, "transform.scale": 1, "appearance.opacity": 1 };
const SCRUB_SAMPLES = 64;

export interface ScrollClipJson {
  layer: string;
  kind: "scrub" | "reveal";
  start: string;
  end: string;
  /** Seconds a scrubbed clip takes to catch up with the scroll; 0 follows exactly. */
  smoothing: number;
  pin: boolean;
  /** Seconds a reveal plays for. */
  duration: number;
  tracks: { prop: Prop; base: number; table: number[] }[];
}

export interface ScrollClipsExport {
  clips: ScrollClipJson[];
  layerIds: Set<string>;
  warnings: string[];
}

export function exportableScrollClips(doc: MotionDocument): ScrollClipsExport {
  const clips: ScrollClipJson[] = [];
  const warnings: string[] = [];
  for (const clip of Object.values(doc.clips)) {
    if (!clip.enabled || (clip.trigger !== "scrollProgress" && clip.trigger !== "inView")) continue;
    const layer = doc.layers[clip.layerId];
    if (!layer) continue;
    const label = `The scroll animation "${clip.name}" on ${layer.name}`;
    const kind = clip.trigger === "scrollProgress" ? "scrub" : "reveal";
    const tracks = clip.tracks.filter((t) => !t.muted);
    const usable = tracks.filter((t) => (PROPS as readonly string[]).includes(t.property));
    for (const t of tracks) if (!(PROPS as readonly string[]).includes(t.property)) warnings.push(`${label} animates ${t.property}, which is not in the export yet (position, rotation, scale and opacity are).`);
    if (usable.length === 0) continue;
    const st = clip.scrollTrigger ?? {};
    const start = st.start && isScrollPosition(st.start) ? st.start : "top bottom";
    const end = st.end && isScrollPosition(st.end) ? st.end : "bottom top";
    const duration = Math.max(0.01, clip.duration);
    const n = kind === "scrub" ? SCRUB_SAMPLES : Math.min(240, Math.max(8, Math.round(duration * 60)));
    const out: ScrollClipJson["tracks"] = [];
    for (const t of usable) {
      const table: number[] = [];
      let ok = true;
      for (let i = 0; i <= n; i++) {
        const v = sampleClip(clip, (duration * i) / n, layer.properties)[t.property];
        if (typeof v !== "number" || !Number.isFinite(v)) { ok = false; break; }
        table.push(Math.round(v * 1e5) / 1e5);
      }
      if (!ok) { warnings.push(`${label} has a ${t.property} value that is not a number; it is not in the export.`); continue; }
      const own = layer.properties[t.property];
      out.push({ prop: t.property as Prop, base: typeof own === "number" ? own : BASE_DEFAULT[t.property as Prop], table });
    }
    if (out.length === 0) continue;
    clips.push({ layer: clip.layerId, kind, start, end, smoothing: typeof st.scrub === "number" && st.scrub > 0 ? st.scrub : 0, pin: st.pin === true, duration, tracks: out });
  }
  return { clips, layerIds: new Set(clips.map((c) => c.layer)), warnings };
}

const SCRIPT = String.raw`
/* LazyLayout scroll animations: scrub, reveal and pin. Reads tables sampled at export time. */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var WORDS = { top: 0, center: 0.5, centre: 0.5, middle: 0.5, bottom: 1 };
  function edge(t) { t = t.trim().toLowerCase(); if (t in WORDS) return { f: WORDS[t] }; var m = /^(-?\d+(?:\.\d+)?)%$/.exec(t); if (m) return { f: +m[1] / 100 }; m = /^(-?\d+(?:\.\d+)?)(?:px)?$/.exec(t); return m ? { p: +m[1] } : { f: 0 }; }
  function pos(s) { var a = s.trim().split(/\s+/); return { e: edge(a[0]), v: edge(a[1] || "top") }; }
  function along(x, size) { return "f" in x ? x.f * size : x.p; }
  function scrollAt(p, top, h, vh) { return top + along(p.e, h) - along(p.v, vh); }
  function lerp(table, t) { var n = table.length - 1, x = Math.min(1, Math.max(0, t)) * n, i = Math.min(n - 1, Math.floor(x)); if (n < 1) return table[0]; return table[i] + (table[i + 1] - table[i]) * (x - i); }
  var CLIPS = __CLIPS__;
  var items = CLIPS.map(function (c) { return { c: c, el: null, top: 0, h: 0, from: 0, to: 0, shown: 0, target: 0, entered: false, startedAt: 0, last: null }; });
  var vh = window.innerHeight;
  function apply(it, t, pinY) {
    var el = it.el, tx = null, ty = null, rot = null, sc = null, op = null;
    it.c.tracks.forEach(function (tr) {
      var v = lerp(tr.table, t);
      if (tr.prop === "transform.x") tx = v - tr.base; else if (tr.prop === "transform.y") ty = v - tr.base;
      else if (tr.prop === "transform.rotate") rot = v - tr.base; else if (tr.prop === "transform.scale") sc = tr.base !== 0 ? v / tr.base : v; else op = Math.min(1, Math.max(0, v));
    });
    if (tx !== null || ty !== null || pinY) el.style.translate = (tx || 0) + "px " + ((ty || 0) + (pinY || 0)) + "px";
    if (rot !== null) el.style.rotate = rot + "deg";
    if (sc !== null) el.style.scale = String(sc);
    if (op !== null) el.style.opacity = String(op);
  }
  function measure() {
    vh = window.innerHeight;
    items.forEach(function (it) {
      if (!it.el) it.el = document.querySelector('[data-ll-scroll="' + it.c.layer + '"]');
      var el = it.el; if (!el) return;
      var keep = [el.style.translate, el.style.rotate, el.style.scale];
      el.style.translate = ""; el.style.rotate = ""; el.style.scale = "";
      var r = el.getBoundingClientRect();
      it.top = r.top + window.scrollY; it.h = r.height;
      el.style.translate = keep[0]; el.style.rotate = keep[1]; el.style.scale = keep[2];
      it.from = scrollAt(pos(it.c.start), it.top, it.h, vh); it.to = scrollAt(pos(it.c.end), it.top, it.h, vh);
    });
  }
  function progress(it, y) { var span = it.to - it.from; return span > 0 ? Math.min(1, Math.max(0, (y - it.from) / span)) : (y >= it.from ? 1 : 0); }
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    var y = window.scrollY;
    items.forEach(function (it) {
      if (!it.el) return;
      var p = progress(it, y), pin = 0;
      if (it.c.pin) { var span = Math.max(0, it.to - it.from); pin = Math.min(span, Math.max(0, y - it.from)); }
      if (it.c.kind === "scrub") {
        if (reduce) { if (pin) apply({ c: { tracks: [] }, el: it.el }, 0, pin); return; }
        var s = it.c.smoothing; it.target = p;
        it.shown = s > 0 ? it.shown + (p - it.shown) * (1 - Math.exp(-dt / s)) : p;
        if (Math.abs(p - it.shown) < 1e-4) it.shown = p;
        apply(it, it.shown, pin);
      } else {
        if (it.last === null) it.last = p;
        if (!it.entered && p > 0) { it.entered = true; it.startedAt = now; }
        it.last = p;
        var t = !it.entered ? 0 : reduce ? 1 : Math.min(1, (now - it.startedAt) / 1000 / it.c.duration);
        apply(it, t, pin);
      }
    });
    requestAnimationFrame(frame);
  }
  function start() { measure(); requestAnimationFrame(frame); }
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure);
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
})();
`;

export function buildScrollClipsSource(clips: readonly ScrollClipJson[]): string {
  return SCRIPT.replace("__CLIPS__", JSON.stringify(clips));
}
