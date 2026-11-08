import { create } from "zustand";
import {
  clampN,
  copyKey,
  defaultComposition,
  DUR,
  FPS,
  makeLayer,
  newKeyId,
  PROPS,
  sortKeys,
  sortTracks,
  valueAt,
} from "./model";
import type { Bezier, Composition, EaseName, Keyframe, MotionLayer, PropId, SpringParams } from "./types";

export interface MotionState {
  comp: Composition;
  playhead: number;
  playing: boolean;
  selectedKeys: Record<string, true>;
  selectedClip: number;
  fps: number;
  speed: number;
  loop: 0 | 1 | 2; // 0: off, 1: loop, 2: ping-pong
  dir: 1 | -1;
  shuttle: number;
  frames: boolean;
  zoom: number;
  t0: number; // left edge in seconds
  wa: { a: number; b: number };
  selectedProp: { layerId: string; p: PropId } | null;
  tool: "select" | "split";
  view: "timeline" | "graph";
  compact: boolean;
  snap: boolean;
  trackWidth: number;
  fullWidth: boolean;
  autoKey: boolean;
  onionSkin: boolean;
}

let clipAnimClipboard: { tr: { p: PropId; keys: Keyframe[] }[] } | null = null;
let keyClipboard: { p: PropId; k: Keyframe }[] | null = null;

export const useMotionModel = create<MotionState>(() => ({
  comp: defaultComposition(),
  playhead: 72,
  playing: false,
  selectedKeys: {},
  selectedClip: 0,
  fps: 60,
  speed: 1,
  loop: 0,
  dir: 1,
  shuttle: 0,
  frames: false,
  zoom: 1,
  t0: 0,
  wa: { a: 0, b: DUR },
  selectedProp: null,
  tool: "select",
  view: "timeline",
  compact: false,
  snap: true,
  trackWidth: 264,
  fullWidth: true,
  autoKey: false,
  onionSkin: false,
}));

function edit(fn: (comp: Composition) => void): void {
  useMotionModel.setState((s) => {
    const comp: Composition = structuredClone(s.comp);
    fn(comp);
    return { comp };
  });
}

function findKey(comp: Composition, id: string) {
  for (const l of comp.layers) {
    for (const tr of l.tr) {
      for (const k of tr.keys) {
        if (k.id === id) return { l, tr, k };
      }
    }
  }
  return null;
}

function ensureLayer(comp: Composition, id: string): MotionLayer {
  let l = comp.layers.find((x) => x.id === id);
  if (!l) {
    l = makeLayer(id, 0, []);
    comp.layers.push(l);
  }
  return l;
}

export const motionActions = {
  setPlayhead(t: number): void {
    useMotionModel.setState((s) => ({
      playhead: clampN(Math.round(t), 0, s.comp.dur),
    }));
  },
  setPlaying(playing: boolean): void {
    useMotionModel.setState({ playing, shuttle: 0 });
  },
  setSpeed(speed: number): void {
    useMotionModel.setState({ speed });
  },
  setLoop(loop: 0 | 1 | 2): void {
    useMotionModel.setState({ loop });
  },
  toggleLoop(): void {
    useMotionModel.setState((s) => ({ loop: ((s.loop + 1) % 3) as 0 | 1 | 2 }));
  },
  setFrames(frames: boolean): void {
    useMotionModel.setState({ frames });
  },
  toggleFrames(): void {
    useMotionModel.setState((s) => ({ frames: !s.frames }));
  },
  setZoom(zoom: number): void {
    useMotionModel.setState({ zoom: clampN(zoom, 1, 32) });
  },
  zoomAt(factor: number, anchorX: number, pps: number, pad = 24): void {
    useMotionModel.setState((s) => {
      const at = (anchorX - pad) / pps + s.t0;
      const nextZoom = clampN(s.zoom * factor, 1, 32);
      const nextPps = pps * (nextZoom / s.zoom);
      const nextT0 = at - (anchorX - pad) / nextPps;
      const maxSpan = s.comp.dur / s.fps;
      return {
        zoom: nextZoom,
        t0: Math.max(0, Math.min(nextT0, maxSpan - 0.2)),
      };
    });
  },
  setT0(t0: number): void {
    useMotionModel.setState((s) => {
      const maxSpan = s.comp.dur / s.fps;
      return { t0: Math.max(0, Math.min(t0, maxSpan - 0.2)) };
    });
  },
  setWorkArea(a: number, b: number): void {
    useMotionModel.setState((s) => ({
      wa: {
        a: clampN(Math.round(a), 0, s.comp.dur - 1),
        b: clampN(Math.round(b), 1, s.comp.dur),
      },
    }));
  },
  resetWorkArea(): void {
    useMotionModel.setState((s) => ({
      wa: { a: 0, b: s.comp.dur },
    }));
  },
  setSelectedProp(layerId: string | null, p: PropId | null): void {
    useMotionModel.setState({
      selectedProp: layerId && p ? { layerId, p } : null,
    });
  },
  setTool(tool: "select" | "split"): void {
    useMotionModel.setState({ tool });
  },
  setView(view: "timeline" | "graph"): void {
    useMotionModel.setState({ view });
  },
  setCompact(compact: boolean): void {
    useMotionModel.setState({ compact });
  },
  setSnap(snap: boolean): void {
    useMotionModel.setState({ snap });
  },
  toggleSnap(): void {
    useMotionModel.setState((s) => ({ snap: !s.snap }));
  },
  toggleAutoKey(): void {
    useMotionModel.setState((s) => ({ autoKey: !s.autoKey }));
  },
  setAutoKey(autoKey: boolean): void {
    useMotionModel.setState({ autoKey });
  },
  toggleOnionSkin(): void {
    useMotionModel.setState((s) => ({ onionSkin: !s.onionSkin }));
  },
  setOnionSkin(onionSkin: boolean): void {
    useMotionModel.setState({ onionSkin });
  },
  splitAtPlayhead(layerId?: string): boolean {
    const s = useMotionModel.getState();
    const playhead = s.playhead;
    const targetLayer = layerId
      ? s.comp.layers.find((x) => x.id === layerId)
      : s.comp.layers.find((x) => x.clips.some((c) => playhead > c.s && playhead < c.e));
    if (!targetLayer) return false;
    const clipIdx = targetLayer.clips.findIndex((c) => playhead > c.s && playhead < c.e);
    if (clipIdx < 0) return false;
    return motionActions.splitClip(targetLayer.id, clipIdx, playhead);
  },
  setTrackWidth(w: number): void {
    const hw = clampN(Math.round(w), 200, 420);
    useMotionModel.setState({ trackWidth: hw });
    try {
      localStorage.setItem("ll-tlhw", String(hw));
    } catch {
      // ignore
    }
  },
  setFullWidth(fw: boolean): void {
    useMotionModel.setState({ fullWidth: fw });
    try {
      localStorage.setItem("ll-tlfw", fw ? "1" : "0");
    } catch {
      // ignore
    }
  },
  toggleLayerOpen(layerId: string): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) l.open = !l.open;
    });
  },
  toggleLayerGroupOpen(layerId: string): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) l.gopen = !l.gopen;
    });
  },
  toggleLayerMute(layerId: string): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) l.mute = !l.mute;
    });
  },
  toggleLayerLock(layerId: string): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) l.lock = !l.lock;
    });
  },
  toggleLayerSolo(layerId: string): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) l.solo = !l.solo;
    });
  },
  setLayerLabel(layerId: string, lbl: number): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) l.lbl = lbl;
    });
  },
  setComp(patch: Partial<Pick<Composition, "fps" | "dur" | "markers">>): void {
    edit((c) => Object.assign(c, patch));
    if (patch.fps) useMotionModel.setState({ fps: patch.fps });
  },
  setClip(layerId: string, index: number, s: number, e: number): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l?.clips[index]) {
        l.clips[index].s = s;
        l.clips[index].e = e;
      }
    });
  },
  selectClip(index: number): void {
    useMotionModel.setState({ selectedClip: index });
  },
  moveClip(layerId: string, clipIndex: number, newStart: number): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (!l || !l.clips[clipIndex] || l.lock) return;
      const clip = l.clips[clipIndex];
      const len = clip.e - clip.s;
      const s = clampN(newStart, 0, c.dur - len);
      const d = s - clip.s;
      clip.s = s;
      clip.e = s + len;
      for (const tr of l.tr) {
        for (const k of tr.keys) {
          if (k.t >= clip.s - d && k.t <= clip.e - d) {
            k.t = clampN(k.t + d, 0, c.dur);
          }
        }
        sortKeys(tr);
      }
    });
  },
  trimClip(layerId: string, clipIndex: number, edge: "s" | "e", newTime: number): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (!l || !l.clips[clipIndex] || l.lock) return;
      const clip = l.clips[clipIndex];
      if (edge === "s") {
        clip.s = clampN(newTime, 0, clip.e - 1);
      } else {
        clip.e = clampN(newTime, clip.s + 1, c.dur);
      }
    });
  },
  splitClip(layerId: string, clipIndex: number, atFrame: number): boolean {
    let success = false;
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (!l || !l.clips[clipIndex] || l.lock) return;
      const clip = l.clips[clipIndex];
      if (atFrame <= clip.s + 1 || atFrame >= clip.e - 1) return;
      const oldEnd = clip.e;
      clip.e = atFrame;
      l.clips.splice(clipIndex + 1, 0, { s: atFrame, e: oldEnd });
      success = true;
    });
    if (success) {
      useMotionModel.setState({ selectedClip: clipIndex + 1 });
    }
    return success;
  },
  duplicateClip(layerId: string, clipIndex: number): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (!l || !l.clips[clipIndex] || l.lock) return;
      const clip = l.clips[clipIndex];
      const len = clip.e - clip.s;
      const s = Math.min(clip.e, c.dur - len);
      const d = s - clip.s;
      if (d > 0) {
        for (const tr of l.tr) {
          const newKeys = tr.keys
            .filter((k) => k.t >= clip.s && k.t <= clip.e)
            .map((k) => copyKey(k, k.t + d));
          tr.keys.push(...newKeys);
          sortKeys(tr);
        }
      }
      l.clips.splice(clipIndex + 1, 0, { s, e: s + len });
    });
    useMotionModel.setState({ selectedClip: clipIndex + 1 });
  },
  deleteClip(layerId: string, clipIndex: number): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (!l || !l.clips[clipIndex] || l.lock) return;
      const clip = l.clips[clipIndex];
      for (const tr of l.tr) {
        tr.keys = tr.keys.filter((k) => !(k.t >= clip.s && k.t <= clip.e));
      }
      if (l.clips.length > 1) {
        l.clips.splice(clipIndex, 1);
      } else {
        c.layers = c.layers.filter((x) => x.id !== layerId);
      }
    });
    useMotionModel.setState({ selectedClip: 0 });
  },
  reverseClip(layerId: string, clipIndex: number): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (!l || !l.clips[clipIndex] || l.lock) return;
      const clip = l.clips[clipIndex];
      for (const tr of l.tr) {
        const ks = tr.keys.filter((k) => k.t >= clip.s && k.t <= clip.e);
        if (ks.length < 2) continue;
        const lo = ks[0].t;
        const hi = ks[ks.length - 1].t;
        for (const k of ks) {
          k.t = lo + hi - k.t;
        }
        sortKeys(tr);
      }
    });
  },
  copyAnimation(layerId: string, clipIndex: number): void {
    const s = useMotionModel.getState();
    const l = s.comp.layers.find((x) => x.id === layerId);
    if (!l || !l.clips[clipIndex]) return;
    const clip = l.clips[clipIndex];
    clipAnimClipboard = {
      tr: l.tr.map((tr) => ({
        p: tr.p,
        keys: tr.keys
          .filter((k) => k.t >= clip.s && k.t <= clip.e)
          .map((k) => copyKey(k, k.t - clip.s)),
      })),
    };
  },
  pasteAnimation(layerId: string, atFrame: number): void {
    if (!clipAnimClipboard) return;
    edit((c) => {
      const l = ensureLayer(c, layerId);
      if (l.lock) return;
      for (const src of clipAnimClipboard!.tr) {
        let tr = l.tr.find((x) => x.p === src.p);
        if (!tr) {
          tr = { p: src.p, keys: [] };
          l.tr.push(tr);
        }
        for (const k of src.keys) {
          const t = clampN(atFrame + k.t, 0, c.dur);
          tr.keys = tr.keys.filter((o) => o.t !== t);
          tr.keys.push(copyKey(k, t));
        }
        sortKeys(tr);
      }
      sortTracks(l);
      l.open = true;
    });
  },
  copyKeys(): void {
    const s = useMotionModel.getState();
    const selIds = s.selectedKeys;
    const copied: { p: PropId; k: Keyframe }[] = [];
    let minT = Infinity;
    for (const l of s.comp.layers) {
      for (const tr of l.tr) {
        for (const k of tr.keys) {
          if (selIds[k.id]) {
            minT = Math.min(minT, k.t);
            copied.push({ p: tr.p, k });
          }
        }
      }
    }
    if (copied.length && isFinite(minT)) {
      keyClipboard = copied.map((item) => ({
        p: item.p,
        k: copyKey(item.k, item.k.t - minT),
      }));
    }
  },
  pasteKeys(layerId: string, targetProp: PropId | null, atFrame: number): void {
    if (!keyClipboard || !keyClipboard.length) return;
    const newSel: Record<string, true> = {};
    edit((c) => {
      const l = ensureLayer(c, layerId);
      if (l.lock) return;
      for (const item of keyClipboard!) {
        const p = targetProp ?? item.p;
        let tr = l.tr.find((x) => x.p === p);
        if (!tr) {
          tr = { p, keys: [] };
          l.tr.push(tr);
        }
        const t = clampN(atFrame + item.k.t, 0, c.dur);
        tr.keys = tr.keys.filter((o) => o.t !== t);
        const k = copyKey(item.k, t);
        tr.keys.push(k);
        sortKeys(tr);
        newSel[k.id] = true;
      }
      sortTracks(l);
      l.open = true;
    });
    useMotionModel.setState({ selectedKeys: newSel });
  },
  duplicateKeys(): void {
    const s = useMotionModel.getState();
    const selIds = s.selectedKeys;
    const newSel: Record<string, true> = {};
    edit((c) => {
      for (const l of c.layers) {
        if (l.lock) continue;
        for (const tr of l.tr) {
          const hits = tr.keys.filter((k) => selIds[k.id]);
          for (const k of hits) {
            const nextT = clampN(k.t + 10, 0, c.dur);
            const dup = copyKey(k, nextT);
            tr.keys.push(dup);
            newSel[dup.id] = true;
          }
          sortKeys(tr);
        }
      }
    });
    useMotionModel.setState({ selectedKeys: newSel });
  },
  alignKeysToPlayhead(): void {
    const s = useMotionModel.getState();
    const selIds = s.selectedKeys;
    const T = s.playhead;
    edit((c) => {
      for (const l of c.layers) {
        if (l.lock) continue;
        for (const tr of l.tr) {
          for (const k of tr.keys) {
            if (selIds[k.id]) {
              k.t = T;
            }
          }
          sortKeys(tr);
        }
      }
    });
  },
  stepFrame(delta: number): void {
    useMotionModel.setState((s) => ({
      playhead: clampN(s.playhead + delta, 0, s.comp.dur),
      playing: false,
      shuttle: 0,
    }));
  },
  jumpKey(dir: 1 | -1): void {
    const s = useMotionModel.getState();
    const T = s.playhead;
    let best: number | null = null;
    for (const l of s.comp.layers) {
      for (const tr of l.tr) {
        for (const k of tr.keys) {
          if (dir > 0 ? k.t > T : k.t < T) {
            if (best === null || (dir > 0 ? k.t < best : k.t > best)) {
              best = k.t;
            }
          }
        }
      }
    }
    if (best !== null) {
      useMotionModel.setState({ playhead: best, playing: false, shuttle: 0 });
    }
  },
  shuttle(dir: 1 | -1): void {
    useMotionModel.setState((s) => {
      const q = s.shuttle;
      const nextShut = q * dir > 0 ? clampN(q * 2, -8, 8) : dir;
      return {
        shuttle: nextShut,
        playing: true,
        dir: (nextShut >= 0 ? 1 : -1) as 1 | -1,
      };
    });
  },
  addKey(layerId: string, p: PropId, t: number, v?: number): string {
    let id = newKeyId();
    edit((comp) => {
      const l = ensureLayer(comp, layerId);
      let tr = l.tr.find((x) => x.p === p);
      if (!tr) {
        tr = { p, keys: [] };
        l.tr.push(tr);
        sortTracks(l);
      }
      const val = clampN(v ?? valueAt(l, p, t), PROPS[p].lo, PROPS[p].hi);
      const hit = tr.keys.find((k) => k.t === t);
      if (hit) {
        hit.v = val;
        id = hit.id;
      } else {
        tr.keys.push({ id, t, v: val, ease: "Ease out" });
      }
      sortKeys(tr);
    });
    return id;
  },
  setKeyValue(keyId: string, v: number): void {
    edit((c) => {
      const f = findKey(c, keyId);
      if (f) f.k.v = clampN(v, PROPS[f.tr.p].lo, PROPS[f.tr.p].hi);
    });
  },
  setKeyTime(keyId: string, t: number): void {
    edit((c) => {
      const f = findKey(c, keyId);
      if (f) {
        f.k.t = clampN(Math.round(t), 0, c.dur);
        sortKeys(f.tr);
      }
    });
  },
  setKeyEase(keyId: string, ease: EaseName, bz?: Bezier, spring?: SpringParams): void {
    edit((c) => {
      const f = findKey(c, keyId);
      if (!f) return;
      f.k.ease = ease;
      if (bz) f.k.bz = bz;
      if (spring) f.k.spring = spring;
    });
  },
  setKeysEase(keyIds: string[], ease: EaseName, bz?: Bezier, spring?: SpringParams): void {
    edit((c) => {
      for (const id of keyIds) {
        const f = findKey(c, id);
        if (!f) continue;
        f.k.ease = ease;
        if (bz) f.k.bz = bz;
        if (spring) f.k.spring = spring;
      }
    });
  },
  deleteKeys(ids: string[]): void {
    const set = new Set(ids);
    edit((c) => {
      for (const l of c.layers) {
        for (const tr of l.tr) {
          tr.keys = tr.keys.filter((k) => !set.has(k.id));
        }
      }
    });
    useMotionModel.setState((s) => {
      const selectedKeys = { ...s.selectedKeys };
      for (const id of ids) delete selectedKeys[id];
      return { selectedKeys };
    });
  },
  selectKeys(ids: string[], additive?: boolean): void {
    useMotionModel.setState((s) => {
      const selectedKeys: Record<string, true> = additive ? { ...s.selectedKeys } : {};
      for (const id of ids) selectedKeys[id] = true;
      return { selectedKeys };
    });
  },
  clearKeySelection(): void {
    useMotionModel.setState({ selectedKeys: {} });
  },
  setLayer(layerId: string, patch: Partial<MotionLayer>): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) Object.assign(l, patch);
    });
  },
  addProperty(layerId: string, p: PropId): void {
    edit((c) => {
      const l = ensureLayer(c, layerId);
      if (l.tr.some((t) => t.p === p)) return;
      l.tr.push({ p, keys: [] });
      sortTracks(l);
    });
  },
  removeProperty(layerId: string, p: PropId): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) l.tr = l.tr.filter((t) => t.p !== p);
    });
  },
  applyPreset(layerId: string, preset: string): void {
    edit((c) => {
      const l = ensureLayer(c, layerId);
      const s = Math.min(...l.clips.map((x) => x.s));
      const mk = (t: number, v: number, ease: EaseName = "Ease out"): Keyframe => ({
        id: newKeyId(),
        t,
        v,
        ease,
      });
      const put = (p: PropId, keys: Keyframe[]) => {
        l.tr = l.tr.filter((x) => x.p !== p);
        l.tr.push({ p, keys });
      };
      if (preset === "Fade in") {
        put("opacity", [mk(s, 0), mk(s + 36, 100)]);
      } else if (preset === "Slide up") {
        put("opacity", [mk(s, 0), mk(s + 36, 100)]);
        put("y", [mk(s, 24), mk(s + 36, 0)]);
      } else if (preset === "Pop") {
        put("opacity", [mk(s, 0), mk(s + 24, 100)]);
        put("scale", [mk(s, 86, "Back out"), mk(s + 36, 100)]);
      } else if (preset === "Stagger") {
        l.stag = 60;
        l.sfrom = "Start";
      }
      sortTracks(l);
    });
  },
  addMarker(t: number, name?: string): void {
    edit((c) => {
      const hit = c.markers.find((m) => m.t === t);
      if (hit) return;
      c.markers.push({
        id: `m${c.markers.length + 1}`,
        t: Math.round(t),
        name: name ?? `Marker ${c.markers.length + 1}`,
      });
      c.markers.sort((a, b) => a.t - b.t);
    });
  },
  deleteMarker(id: string): void {
    edit((c) => {
      c.markers = c.markers.filter((m) => m.id !== id);
    });
  },
};
