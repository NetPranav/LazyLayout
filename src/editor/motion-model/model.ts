import type {
  Bezier, Composition, EaseName, Keyframe, MotionLayer, PropId, PropSpec, PropTrack, SpringParams,
} from "./types";
import { documentStore } from "@/core/store/useDocumentStore";

export const FPS = 60;
export const DUR = 300;
export const DEFAULT_SPRING: SpringParams = { response: 0.35, damping: 0.6 };

export const PROPS: Record<PropId, PropSpec> = {
  opacity: { n: "Opacity", u: "%", d: 100, lo: 0, hi: 100 },
  x: { n: "Position X", u: "px", d: 0, lo: -2000, hi: 2000 },
  y: { n: "Position Y", u: "px", d: 0, lo: -2000, hi: 2000 },
  scale: { n: "Scale", u: "%", d: 100, lo: 0, hi: 500 },
  rot: { n: "Rotation", u: "°", d: 0, lo: -3600, hi: 3600 },
};
export const PORD: readonly PropId[] = ["opacity", "x", "y", "scale", "rot"];
export const EZ: Record<string, Bezier> = {
  Linear: [0, 0, 1, 1],
  "Ease in": [0.42, 0, 1, 1],
  "Ease out": [0, 0, 0.58, 1],
  "Ease in out": [0.42, 0, 0.58, 1],
  "Back out": [0.34, 1.56, 0.64, 1],
  Anticipate: [0.36, 0, 0.66, -0.56],
};
export const EZL: readonly EaseName[] = ["Linear", "Ease in", "Ease out", "Ease in out", "Back out", "Anticipate", "Spring", "Custom"];

let kid = 0;
export function newKeyId(): string { kid += 1; return `k${kid}`; }
function mkk(t: number, v: number, ease: EaseName = "Ease out"): Keyframe { return { id: newKeyId(), t, v, ease }; }
function mkt(p: PropId, keys: Keyframe[]): PropTrack { return { p, keys }; }
export function makeLayer(id: string, s: number, tr: PropTrack[]): MotionLayer {
  return {
    id, lbl: 0, gopen: true, clips: [{ s, e: DUR }], open: false, mute: false, lock: false, solo: false,
    trig: "On load", ease: "Ease out", rep: "Once", rn: 3, yoyo: false, ss: "top 80%", se: "bottom 20%",
    scrub: false, pin: false, sprev: 0, stag: 60, sfrom: "Start", tr,
  };
}

export function defaultComposition(layers?: Record<string, { id: string; name?: string; archetype?: string }>): Composition {
  let docLayers = layers;
  if (!docLayers && typeof window !== "undefined") {
    try {
      docLayers = documentStore.getState().document.layers;
    } catch {
      // ignore
    }
  }

  let heroId = "hero";
  let headlineId = "headline";
  let subtitleId = "subtitle";
  let buttonId = "button";
  let imageId = "image";

  if (docLayers) {
    const list = Object.values(docLayers);
    const heroLayer = list.find((l) => l.id === "hero" || l.name?.toLowerCase() === "hero");
    const headlineLayer = list.find((l) => l.id === "headline" || (l.archetype === "text" && l.name?.toLowerCase().includes("headline")));
    const subtitleLayer = list.find((l) => l.id === "subtitle" || (l.archetype === "text" && l.name?.toLowerCase().includes("subtitle")));
    const buttonLayer = list.find((l) => l.id === "button" || l.archetype === "button" || l.name?.toLowerCase().includes("started"));
    const imageLayer = list.find((l) => l.id === "image" || l.archetype === "image" || l.name?.toLowerCase().includes("image"));

    if (heroLayer) heroId = heroLayer.id;
    if (headlineLayer) headlineId = headlineLayer.id;
    if (subtitleLayer) subtitleId = subtitleLayer.id;
    if (buttonLayer) buttonId = buttonLayer.id;
    if (imageLayer) imageId = imageLayer.id;
  }

  const hero = makeLayer(heroId, 0, []);
  hero.stag = 0;
  const headline = makeLayer(headlineId, 0, [
    mkt("opacity", [mkk(0, 0), mkk(36, 100)]),
    mkt("y", [mkk(0, 24), mkk(36, 0)]),
  ]);
  headline.open = true;

  return {
    fps: FPS,
    dur: DUR,
    markers: [{ id: "m1", t: 150, name: "Marker 1" }],
    layers: [
      hero,
      headline,
      makeLayer(subtitleId, 18, [
        mkt("opacity", [mkk(18, 0), mkk(60, 100)]),
        mkt("y", [mkk(18, 16), mkk(60, 0)]),
      ]),
      makeLayer(buttonId, 48, [
        mkt("opacity", [mkk(48, 0), mkk(72, 100)]),
        mkt("scale", [mkk(48, 86, "Back out"), mkk(84, 100)]),
      ]),
      makeLayer(imageId, 12, [
        mkt("opacity", [mkk(12, 0), mkk(60, 100)]),
        mkt("x", [mkk(12, 40), mkk(66, 0)]),
        mkt("rot", [mkk(12, 4), mkk(66, 0)]),
      ]),
    ],
  };
}

export function bezierOf(k: Keyframe): Bezier {
  return k.ease === "Custom" ? (k.bz ?? EZ["Ease out"]) : (EZ[k.ease] ?? EZ["Ease out"]);
}

export function bez(x1: number, y1: number, x2: number, y2: number, u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  let lo = 0, hi = 1, t = u;
  for (let i = 0; i < 22; i++) {
    const x = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    if (x < u) lo = t; else hi = t;
    t = (lo + hi) / 2;
  }
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
}

export function springX(sp: SpringParams, t: number): number {
  const w = (2 * Math.PI) / sp.response, z = sp.damping;
  if (t <= 0) return 0;
  if (z >= 0.999) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

export function easeAt(k: Keyframe, u: number, sec: number): number {
  if (k.ease === "Spring") return u >= 1 ? 1 : springX(k.spring ?? DEFAULT_SPRING, u * (sec || 1));
  const b = bezierOf(k);
  return bez(b[0], b[1], b[2], b[3], u);
}

export function trackValueAt(tr: PropTrack, f: number, fps: number = FPS): number {
  const ks = tr.keys, n = ks.length;
  if (!n) return PROPS[tr.p].d;
  if (f <= ks[0].t) return ks[0].v;
  if (f >= ks[n - 1].t) return ks[n - 1].v;
  for (let i = 0; i < n - 1; i++) {
    const a = ks[i], b = ks[i + 1];
    if (f < b.t) return a.v + (b.v - a.v) * easeAt(a, (f - a.t) / (b.t - a.t), (b.t - a.t) / fps);
  }
  return ks[n - 1].v;
}

export function valueAt(layer: MotionLayer, p: PropId, t: number): number {
  const tr = layer.tr.find((x) => x.p === p);
  return tr ? trackValueAt(tr, t) : PROPS[p].d;
}

export const clampN = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const layerStart = (l: MotionLayer): number => Math.min(...l.clips.map((c) => c.s));
export const layerEnd = (l: MotionLayer): number => Math.max(...l.clips.map((c) => c.e));
export const layerLength = (l: MotionLayer): number => l.clips.reduce((a, c) => a + c.e - c.s, 0);
export const allKeys = (l: MotionLayer): Keyframe[] => l.tr.flatMap((t) => t.keys);
export const sortKeys = (tr: PropTrack): void => { tr.keys.sort((a, b) => a.t - b.t); };
export const sortTracks = (l: MotionLayer): void => { l.tr.sort((a, b) => PORD.indexOf(a.p) - PORD.indexOf(b.p)); };

const pad2 = (n: number): string => (n < 10 ? "0" : "") + n;
export function timecode(f: number, fps: number = FPS): string {
  const r = Math.max(0, Math.round(f)), s = Math.floor(r / fps);
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}.${pad2(r % fps)}`;
}
export function parseTime(str: string, fps: number = FPS): number {
  const s = str.trim();
  if (/^\d+$/.test(s)) return Number(s);
  const m = /^(?:(\d+):)?(\d+)(?:\.(\d+))?$/.exec(s);
  return m ? ((Number(m[1]) || 0) * 60 + Number(m[2])) * fps + (Number(m[3]) || 0) : NaN;
}
export const numStr = (v: number): string => String(+v.toFixed(2));
export const formatValue = (p: PropId, v: number): string => numStr(v) + PROPS[p].u;

export const LABEL_COLORS = ["Slate", "Sage", "Sand", "Clay", "Rose", "Lavender"] as const;

export const LAYER_NAMES: Record<string, string> = {
  hero: "Hero",
  headline: "Headline",
  subtitle: "Subtitle",
  button: "Get started",
  image: "Hero image",
  features: "Features",
  footer: "Footer",
  others: "Other elements",
};

export const LAYER_TYPES: Record<string, string> = {
  headline: "text",
  subtitle: "text",
  button: "button",
  image: "image",
  hero: "frame",
  features: "frame",
  footer: "frame",
  others: "frame",
  input: "text",
  toggle: "circle",
  divider: "divider",
  background: "image",
  icon: "star",
  shape: "shape",
  counter: "text",
  object3d: "box",
};

export function layerName(id: string): string {
  if (typeof window !== "undefined") {
    try {
      const docLayer = documentStore.getState().document.layers[id];
      if (docLayer?.name) return docLayer.name;
    } catch {
      // ignore
    }
  }
  return LAYER_NAMES[id] ?? id;
}

export function layerType(id: string): string {
  if (typeof window !== "undefined") {
    try {
      const docLayer = documentStore.getState().document.layers[id];
      if (docLayer?.archetype) {
        const arch = docLayer.archetype;
        if (arch === "container" || (arch as string) === "frame") return "frame";
        if (arch === "text" || arch === "svgText") return "text";
        if (arch === "button" || arch === "fab") return "button";
        if (arch === "image" || arch === "background") return "image";
        if (arch === "input") return "text";
        if (arch === "toggle") return "circle";
        if (arch === "divider" || arch === "line") return "divider";
        if (arch === "star" || arch === "icon") return "star";
        return arch;
      }
    } catch {
      // ignore
    }
  }
  return LAYER_TYPES[id] ?? "frame";
}

export function isGrp(l: MotionLayer): boolean {
  return layerType(l.id) === "frame" || l.id === "hero" || l.id === "features" || l.id === "footer" || l.id === "others";
}

export function lblDef(id: string): number {
  const k = layerType(id);
  if (k === "text" || k === "input" || k === "counter") return 1;
  if (k === "button") return 2;
  if (k === "frame") return 3;
  if (k === "image" || k === "background") return 4;
  if (k === "shape" || k === "icon" || k === "divider") return 5;
  return 6;
}

export function lblOf(l: MotionLayer): number {
  return l.lbl || lblDef(l.id);
}

export function majorOf(p: number, fps: number = FPS): number {
  const c = [1, 2, 5, 10, Math.round(fps / 2), fps, fps * 2, fps * 5];
  for (let i = 0; i < c.length; i++) {
    if ((c[i] / fps) * p >= 84) return c[i];
  }
  return fps * 5;
}

export function minorOf(m: number): number {
  const c = [6, 5, 4, 3, 2];
  for (let i = 0; i < c.length; i++) {
    if (m % c[i] === 0 && m / c[i] >= 1) return m / c[i];
  }
  return m;
}

export function X(f: number, pps: number, t0: number = 0, pad: number = 24, fps: number = FPS): number {
  return pad + (f / fps - t0) * pps;
}

export function Fx(x: number, pps: number, t0: number = 0, pad: number = 24, fps: number = FPS): number {
  return ((x - pad) / pps + t0) * fps;
}

export function copyKey(k: Keyframe, t: number): Keyframe {
  return {
    id: newKeyId(),
    t,
    v: k.v,
    ease: k.ease,
    bz: k.bz ? ([...k.bz] as const) : undefined,
    spring: k.spring ? { ...k.spring } : undefined,
  };
}

export function snapT(
  f: number,
  comp: Composition,
  snapEnabled: boolean,
  pps: number,
  fps: number = FPS,
  excludeKeys?: Record<string, true>,
  excludeClip?: { s: number; e: number },
  noHead?: boolean,
  playhead?: number
): { snapped: number; hit: boolean } {
  if (!snapEnabled) return { snapped: f, hit: false };
  const pts: number[] = [0, comp.dur];
  const bd = Math.max(1, Math.round((7 / pps) * fps)) + 1;

  for (const l of comp.layers) {
    for (const k of allKeys(l)) {
      if (!(excludeKeys && excludeKeys[k.id])) pts.push(k.t);
    }
    for (const c of l.clips) {
      if (c !== excludeClip) {
        pts.push(c.s);
        pts.push(c.e);
      }
    }
  }

  for (const m of comp.markers) pts.push(m.t);
  if (!noHead && playhead !== undefined) pts.push(Math.round(playhead));

  let best = f;
  let hit = false;
  let bestDist = bd;

  for (const p of pts) {
    const d = Math.abs(p - f);
    if (d < bestDist) {
      bestDist = d;
      best = p;
      hit = true;
    }
  }

  return { snapped: hit ? best : f, hit };
}

