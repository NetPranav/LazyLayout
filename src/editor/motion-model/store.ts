import { create } from "zustand";
import {
  clampN,
  copyKey,
  defaultComposition,
  DUR,
  makeLayer,
  newKeyId,
  PROPS,
  sortKeys,
  sortTracks,
  valueAt,
} from "./model";
import type { Bezier, Composition, EaseName, Keyframe, MotionLayer, PropId, SpringParams, ClipCategory, Trigger } from "./types";
import { transport, getTransport, subscribeTransport, type TransportState, type LoopMode } from "@/core/time/transport";
import { frameScheduler } from "@/core/time/scheduler";
import {
  setKeyframeAt,
  deleteKeyframes,
  ensureTrack,
  locateKeyframes,
  placementsOf,
  KEYFRAMES_CLIP_NAME,
  alignKeyframes,
  copyKeyframes,
  pasteKeyframes,
} from "@/core/timeline/keyframeOps";
import { addMarkerAt, removeMarkerById, setLayerSwitch } from "@/core/timeline/timelineOps";
import { useTimelineUiStore } from "@/core/store/useTimelineUiStore";
import { transaction } from "@/core/editing/editOps";
import { createId } from "@/core/ids";
import type { Clip, ClipTemplate } from "@/core/document/schema";
import { MAIN_COMPOSITION_ID } from "@/core/document/compositions";
import { getDocument, documentCommands } from "@/core/store/useDocumentStore";
import {
  UI_TO_CANONICAL_PATH,
  CANONICAL_TO_UI_PATH,
  uiToCanonicalValue,
  uiEaseToCanonical,
  uiClipTypeToCanonical,
  uiTriggerToCanonical,
  CATEGORY_DEFAULT_TRIGGERS,
} from "./sync";

export interface MotionState {
  comp: Composition;
  time: number;
  playhead: number;
  playheadGlide: boolean;
  subhead: number;
  readoutPlayhead: number;
  overlayFrame: number;
  overlayTime: number;
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

const initTransport = getTransport();
const initFps = initTransport.fps || 60;
const initFrame = Math.round(initTransport.time * initFps);

export const useMotionModel = create<MotionState>(() => ({
  comp: defaultComposition(),
  time: initTransport.time,
  playhead: initFrame,
  playheadGlide: false,
  subhead: initTransport.time * initFps,
  readoutPlayhead: initFrame,
  overlayFrame: initFrame,
  overlayTime: initTransport.time,
  playing: initTransport.playing,
  selectedKeys: {},
  selectedClip: 0,
  fps: initFps,
  speed: Math.abs(initTransport.rate) || 1,
  loop: initTransport.loop === "off" ? 0 : initTransport.loop === "loop" ? 1 : 2,
  dir: (initTransport.rate >= 0 ? 1 : -1) as 1 | -1,
  shuttle: initTransport.playing && initTransport.rate !== 1 ? initTransport.rate : 0,
  frames: false,
  zoom: 1,
  t0: 0,
  wa: {
    a: Math.round(initTransport.workArea.start * initFps),
    b: Math.round(initTransport.workArea.end * initFps),
  },
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

export const getOverlayFrame = (): number => {
  const s = useMotionModel.getState();
  return s.playing ? Math.round(getTransport().time * (getTransport().fps || 60)) : s.overlayFrame;
};

export const getOverlayTime = (): number => {
  const s = useMotionModel.getState();
  return s.playing ? getTransport().time : s.overlayTime;
};

export const useOverlayFrame = (): number => useMotionModel((s) => (s.playing ? s.overlayFrame : s.playhead));
export const useOverlayTime = (): number => useMotionModel((s) => (s.playing ? s.overlayTime : s.time));

function syncTransportToMotion(t: TransportState): void {
  const fps = t.fps || 60;
  const frame = Math.round(t.time * fps);
  const loopNum: 0 | 1 | 2 = t.loop === "off" ? 0 : t.loop === "loop" ? 1 : 2;
  const shuttleVal = t.playing && t.rate !== 1 ? t.rate : 0;
  const curComp = useMotionModel.getState().comp;
  const compDurFrames = Math.round(t.duration * fps);
  const durChanged = curComp.dur !== compDurFrames || curComp.fps !== fps;

  useMotionModel.setState({
    time: t.time,
    playhead: frame,
    subhead: t.time * fps,
    readoutPlayhead: frame,
    // Rule: while NOT playing, every time change (seek, step, scrub, pause) updates overlayFrame and overlayTime immediately
    ...(!t.playing ? { overlayFrame: frame, overlayTime: t.time } : {}),
    playing: t.playing,
    fps,
    loop: loopNum,
    dir: (t.rate >= 0 ? 1 : -1) as 1 | -1,
    shuttle: shuttleVal,
    speed: Math.abs(t.rate) || 1,
    wa: {
      a: Math.round(t.workArea.start * fps),
      b: Math.round(t.workArea.end * fps),
    },
    ...(durChanged ? { comp: { ...curComp, dur: compDurFrames, fps } } : {}),
  });
}

function syncOverlayFromTransport(t: TransportState): void {
  const fps = t.fps || 60;
  const frame = Math.round(t.time * fps);
  const cur = useMotionModel.getState();
  if (cur.overlayFrame !== frame || cur.overlayTime !== t.time) {
    useMotionModel.setState({
      overlayFrame: frame,
      overlayTime: t.time,
    });
  }
}

// ROADMAP Phase 55 & 56: Frame scheduler integration
// Ordered phases: input → evaluate → apply → render → overlay → stats
// During playback:
// 1. evaluate advances transport (see installTransportDriver in src/core/time/transportDriver.ts)
// 2. apply: direct DOM apply updates the stage; Motion store updates at <= 10 Hz (or per-step in deterministic mode)
// 3. render redraws the stage / timeline when needed
// 4. overlay updates playhead needle and overlays in direct DOM, throttled store sync at <= 10 Hz
let lastMotionSync = 0;
frameScheduler.register("apply", ({ now }) => {
  const t = getTransport();
  if (t.playing) {
    if (frameScheduler.stats.deterministic) {
      syncTransportToMotion(t);
    } else if (now - lastMotionSync >= 100) {
      lastMotionSync = now;
      syncTransportToMotion(t);
    }
  }
});

let lastOverlaySync = 0;
frameScheduler.register("overlay", ({ now }) => {
  const t = getTransport();
  if (t.playing) {
    if (frameScheduler.stats.deterministic) {
      syncOverlayFromTransport(t);
    } else if (now - lastOverlaySync >= 100) {
      lastOverlaySync = now;
      syncOverlayFromTransport(t);
    }
  }
});

// Single subscription: core transport is the ONE clock.
// When NOT playing (seek, step, scrub, pause, reset), apply at once so editing stays immediate.
// During playback, time and playhead are copied in the "apply" phase above, throttled to <= 10 Hz.
subscribeTransport((state, prev) => {
  if (!state.playing) {
    lastMotionSync = 0;
    lastOverlaySync = 0;
    syncTransportToMotion(state);
    syncOverlayFromTransport(state);
  } else {
    // Sync non-time playback flags immediately (loop, speed, direction, playing)
    const loopNum: 0 | 1 | 2 = state.loop === "off" ? 0 : state.loop === "loop" ? 1 : 2;
    const shuttleVal = state.rate !== 1 ? state.rate : 0;
    const fps = state.fps || 60;
    const curComp = useMotionModel.getState().comp;
    const compDurFrames = Math.round(state.duration * fps);
    const durChanged = curComp.dur !== compDurFrames || curComp.fps !== fps;

    useMotionModel.setState({
      playing: true,
      fps,
      loop: loopNum,
      dir: (state.rate >= 0 ? 1 : -1) as 1 | -1,
      shuttle: shuttleVal,
      speed: Math.abs(state.rate) || 1,
      wa: {
        a: Math.round(state.workArea.start * fps),
        b: Math.round(state.workArea.end * fps),
      },
      ...(durChanged ? { comp: { ...curComp, dur: compDurFrames, fps } } : {}),
    });
    if (!prev.playing) {
      frameScheduler.wake();
    }
  }
});

// Record mode and onion skin live in the core timeline UI store (the header buttons write there, the stage reads there).
// This model mirrors them so the footer toggles show the same state as the header ones.
useTimelineUiStore.subscribe((ui) => {
  const cur = useMotionModel.getState();
  if (cur.autoKey !== ui.recordMode || cur.onionSkin !== ui.onionSkin.enabled) {
    useMotionModel.setState({ autoKey: ui.recordMode, onionSkin: ui.onionSkin.enabled });
  }
});

function edit(fn: (comp: Composition) => void): void {
  useMotionModel.setState((s) => {
    const comp: Composition = structuredClone(s.comp);
    fn(comp);
    return { comp };
  });
}

/** Writes layer flags to the document when the layer exists there (the local row state is the fallback). */
function writeLayerFlags(layerId: string, flags: { visible?: boolean; locked?: boolean }): void {
  try {
    if (getDocument().layers[layerId]) documentCommands.setLayerFlags(layerId, flags);
  } catch {
    // standalone fallback
  }
}

/** The document clip behind a layer's Nth bar (same filter and order the document projection uses). */
function docClipAt(layerId: string, index: number): Clip | undefined {
  try {
    return Object.values(getDocument().clips).filter((c) => c.layerId === layerId && c.enabled)[index];
  } catch {
    return undefined;
  }
}

function fpsNow(): number {
  return useMotionModel.getState().fps || 60;
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
  setPlayhead(t: number, glideOrOptions?: boolean | { updateReadout?: boolean }): void {
    const s = useMotionModel.getState();
    const fps = s.fps || 60;
    const clampedFrame = clampN(t, 0, s.comp.dur);
    const glide = glideOrOptions === true;
    if (s.playheadGlide !== glide) useMotionModel.setState({ playheadGlide: glide });
    transport.seek(clampedFrame / fps);
  },
  seek(t: number, glide = false): void {
    const s = useMotionModel.getState();
    const fps = s.fps || 60;
    const clampedFrame = clampN(Math.round(t), 0, s.comp.dur);
    useMotionModel.setState({ playheadGlide: glide });
    transport.seek(clampedFrame / fps);
  },
  setReadoutPlayhead(frame: number): void {
    useMotionModel.setState({ readoutPlayhead: Math.round(frame) });
  },
  setPlaying(playing: boolean): void {
    if (playing) {
      transport.play();
    } else {
      transport.pause();
    }
  },
  setSpeed(speed: number): void {
    transport.setRate(speed);
  },
  setLoop(loop: 0 | 1 | 2 | LoopMode): void {
    if (loop === 0 || loop === "off") transport.setLoop("off");
    else if (loop === 1 || loop === "loop") transport.setLoop("loop");
    else if (loop === 2 || loop === "ping-pong") transport.setLoop("ping-pong");
  },
  toggleLoop(): void {
    transport.cycleLoop();
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
    const s = useMotionModel.getState();
    const fps = s.fps || 60;
    transport.setWorkArea({
      start: clampN(a, 0, s.comp.dur - 1) / fps,
      end: clampN(b, 1, s.comp.dur) / fps,
    });
  },
  resetWorkArea(): void {
    transport.setWorkArea({ start: 0, end: getTransport().duration });
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
    motionActions.setAutoKey(!useMotionModel.getState().autoKey);
  },
  setAutoKey(autoKey: boolean): void {
    useMotionModel.setState({ autoKey });
    // Core auto-key (record mode): changed properties get a keyframe at the playhead, in the same undo step.
    useTimelineUiStore.getState().setRecordMode(autoKey);
  },
  toggleOnionSkin(): void {
    motionActions.setOnionSkin(!useMotionModel.getState().onionSkin);
  },
  setOnionSkin(onionSkin: boolean): void {
    useMotionModel.setState({ onionSkin });
    // The core timeline UI store owns the onion-skin config that the stage draws.
    useTimelineUiStore.getState().setOnionSkin({ enabled: onionSkin });
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
    const cur = useMotionModel.getState().comp.layers.find((x) => x.id === layerId)?.mute ?? false;
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) l.mute = !l.mute;
    });
    // Mute (eye) is the layer's visibility in the document: one undo step, same flag the Layers panel writes.
    writeLayerFlags(layerId, { visible: cur });
  },
  toggleLayerLock(layerId: string): void {
    const cur = useMotionModel.getState().comp.layers.find((x) => x.id === layerId)?.lock ?? false;
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) l.lock = !l.lock;
    });
    writeLayerFlags(layerId, { locked: !cur });
  },
  toggleLayerSolo(layerId: string): void {
    const cur = useMotionModel.getState().comp.layers.find((x) => x.id === layerId)?.solo ?? false;
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) l.solo = !l.solo;
    });
    try {
      if (getDocument().layers[layerId]) setLayerSwitch([layerId], "solo", !cur);
    } catch {
      // standalone fallback
    }
  },
  setLayerLabel(layerId: string, lbl: number): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) l.lbl = lbl;
    });
  },
  setComp(patch: Partial<Pick<Composition, "fps" | "dur" | "markers">>): void {
    edit((c) => Object.assign(c, patch));
    const current = getTransport();
    const fps = patch.fps ?? current.fps;
    const durSec = patch.dur !== undefined ? patch.dur / fps : current.duration;
    if (patch.fps !== undefined || patch.dur !== undefined) {
      transport.setComposition({
        id: current.compositionId,
        fps,
        duration: durSec,
        workArea: current.workArea,
      });
    }
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
    // The bar's start is the clip's delay; its keyframes are relative to it, so they move with it.
    const moved = useMotionModel.getState().comp.layers.find((x) => x.id === layerId)?.clips[clipIndex];
    const dc = docClipAt(layerId, clipIndex);
    if (moved && dc && !useMotionModel.getState().comp.layers.find((x) => x.id === layerId)?.lock) {
      const delay = moved.s / fpsNow();
      if (Math.abs((dc.delay ?? 0) - delay) > 1e-9) {
        try {
          documentCommands.updateClip(dc.id, { delay }, "Move animation");
        } catch {
          // fallback
        }
      }
    }
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
    const trimmed = useMotionModel.getState().comp.layers.find((x) => x.id === layerId)?.clips[clipIndex];
    const dc = docClipAt(layerId, clipIndex);
    if (trimmed && dc) {
      const fps = fpsNow();
      const delay = trimmed.s / fps;
      const shift = delay - (dc.delay ?? 0);
      try {
        transaction("Trim animation", () => {
          if (edge === "s" && Math.abs(shift) > 1e-9) {
            // keep every keyframe where it is on the timeline: their times are relative to the delay
            for (const track of dc.tracks) {
              for (const kf of track.keyframes) {
                documentCommands.setKeyframe(dc.id, track.id, { ...kf, time: Math.max(0, kf.time - shift) });
              }
            }
          }
          documentCommands.updateClip(dc.id, { delay, duration: (trimmed.e - trimmed.s) / fps });
        });
      } catch {
        // fallback
      }
    }
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
    const dc = success ? docClipAt(layerId, clipIndex) : undefined;
    if (success && dc) {
      const fps = fpsNow();
      const at = atFrame / fps;
      const delay = dc.delay ?? 0;
      const end = delay + dc.duration;
      try {
        transaction("Split animation", () => {
          // keyframes after the split go to the new right-hand clip (times relative to its own delay)
          const rightTracks = dc.tracks
            .map((t) => ({
              id: createId("trk"),
              property: t.property,
              keyframes: t.keyframes
                .filter((k) => delay + k.time >= at)
                .map((k) => ({ ...k, id: createId("kf"), time: Math.max(0, delay + k.time - at) })),
            }))
            .filter((t) => t.keyframes.length > 0);
          for (const track of dc.tracks) {
            for (const kf of track.keyframes.filter((k) => delay + k.time >= at)) {
              documentCommands.removeKeyframe(dc.id, track.id, kf.id);
            }
          }
          documentCommands.updateClip(dc.id, { duration: at - delay });
          const { id: _id, layerId: _layerId, ...rest } = dc;
          void _id;
          void _layerId;
          documentCommands.addClip(layerId, { ...rest, id: createId("clip"), delay: at, duration: Math.max(1 / fps, end - at), tracks: rightTracks }, undefined, {
            compositionId: MAIN_COMPOSITION_ID,
          });
        });
      } catch {
        // fallback
      }
    }
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
    const dc = docClipAt(layerId, clipIndex);
    if (dc && !useMotionModel.getState().comp.layers.find((x) => x.id === layerId)?.lock) {
      const fps = fpsNow();
      try {
        const { id: _id, layerId: _layerId, ...rest } = dc;
        void _id;
        void _layerId;
        const nextDelay = Math.min((dc.delay ?? 0) + dc.duration, Math.max(0, useMotionModel.getState().comp.dur / fps - dc.duration));
        documentCommands.addClip(
          layerId,
          {
            ...rest,
            id: createId("clip"),
            delay: nextDelay,
            tracks: dc.tracks.map((t) => ({ ...t, id: createId("trk"), keyframes: t.keyframes.map((k) => ({ ...k, id: createId("kf") })) })),
          },
          "Duplicate animation",
          { compositionId: MAIN_COMPOSITION_ID },
        );
      } catch {
        // fallback
      }
    }
    useMotionModel.setState({ selectedClip: clipIndex + 1 });
  },
  deleteClip(layerId: string, clipIndex: number): void {
    const dc = docClipAt(layerId, clipIndex);
    if (dc && !useMotionModel.getState().comp.layers.find((x) => x.id === layerId)?.lock) {
      try {
        documentCommands.removeClip(dc.id, "Delete animation");
        useMotionModel.setState({ selectedClip: 0 });
        return; // the document change re-projects the layer's bars into this model
      } catch {
        // fallback
      }
    }
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
    try {
      copyKeyframes(Object.keys(selIds));
    } catch {
      // standalone fallback
    }
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
    try {
      const fps = useMotionModel.getState().fps || 60;
      const made = pasteKeyframes([layerId], atFrame / fps);
      if (made.length > 0) {
        useMotionModel.setState({ selectedKeys: Object.fromEntries(made.map((id) => [id, true as const])) });
        return;
      }
    } catch {
      // standalone fallback
    }
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
    try {
      // Document first: copies land 10 frames later in one undo step (same offset as the local fallback below).
      const locs = locateKeyframes(getDocument(), MAIN_COMPOSITION_ID, Object.keys(selIds));
      if (locs.length > 0) {
        const fps = s.fps || 60;
        const made: Record<string, true> = {};
        transaction("Duplicate keyframes", () => {
          for (const loc of locs) {
            const id = setKeyframeAt(loc.layerId, loc.property, loc.time + 10 / fps, {
              value: loc.keyframe.value,
              ease: loc.keyframe.ease,
            });
            if (id) made[id] = true;
          }
        });
        useMotionModel.setState({ selectedKeys: made });
        return;
      }
    } catch {
      // standalone fallback
    }
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
    try {
      // Document first: one undo step; the document change re-projects the keys into this model.
      if (alignKeyframes(Object.keys(selIds), "playhead") > 0) return;
    } catch {
      // standalone fallback
    }
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
    useMotionModel.setState({ playheadGlide: true });
    transport.stepFrame(delta);
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
      const fps = s.fps || 60;
      useMotionModel.setState({ playheadGlide: true });
      transport.seek(best / fps);
      transport.pause();
    }
  },
  shuttle(dir: 1 | -1 | "forward" | "reverse"): void {
    if (dir === 1 || dir === "forward") {
      transport.shuttle("forward");
    } else {
      transport.shuttle("reverse");
    }
  },
  ensureLayer(layerId: string): MotionLayer {
    let l = useMotionModel.getState().comp.layers.find((x) => x.id === layerId);
    if (!l) {
      edit((c) => {
        l = ensureLayer(c, layerId);
      });
    }
    return l ?? makeLayer(layerId, 0, []);
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

    try {
      const canonicalPath = UI_TO_CANONICAL_PATH[p];
      if (canonicalPath) {
        const fps = useMotionModel.getState().fps || 60;
        const tSec = t / fps;
        const val = clampN(v ?? (useMotionModel.getState().comp.layers.find(x => x.id === layerId)?.tr.find(tr => tr.p === p)?.keys.find(k => k.t === t)?.v ?? PROPS[p].d), PROPS[p].lo, PROPS[p].hi);
        const canonicalVal = uiToCanonicalValue(p, val);
        const kfId = setKeyframeAt(layerId, canonicalPath, tSec, { value: canonicalVal });
        if (kfId) id = kfId;
      }
    } catch {
      // Test or standalone fallback
    }

    return id;
  },
  setKeyValue(keyId: string, v: number): void {
    edit((c) => {
      const f = findKey(c, keyId);
      if (f) f.k.v = clampN(v, PROPS[f.tr.p].lo, PROPS[f.tr.p].hi);
    });

    try {
      const doc = getDocument();
      const locs = locateKeyframes(doc, MAIN_COMPOSITION_ID, [keyId]);
      if (locs.length > 0) {
        const loc = locs[0];
        const propId = CANONICAL_TO_UI_PATH[loc.property];
        const canonicalVal = propId ? uiToCanonicalValue(propId, v) : v;
        documentCommands.setKeyframe(loc.clipId, loc.trackId, { ...loc.keyframe, value: canonicalVal });
      }
    } catch {
      // fallback
    }
  },
  setKeyTime(keyId: string, t: number): void {
    edit((c) => {
      const f = findKey(c, keyId);
      if (f) {
        f.k.t = clampN(Math.round(t), 0, c.dur);
        sortKeys(f.tr);
      }
    });

    try {
      const doc = getDocument();
      const locs = locateKeyframes(doc, MAIN_COMPOSITION_ID, [keyId]);
      if (locs.length > 0) {
        const loc = locs[0];
        const fps = useMotionModel.getState().fps || 60;
        const tSec = t / fps;
        documentCommands.setKeyframe(loc.clipId, loc.trackId, { ...loc.keyframe, time: tSec });
      }
    } catch {
      // fallback
    }
  },
  setKeyEase(keyId: string, ease: EaseName, bz?: Bezier, spring?: SpringParams): void {
    edit((c) => {
      const f = findKey(c, keyId);
      if (!f) return;
      f.k.ease = ease;
      if (bz) f.k.bz = bz;
      if (spring) f.k.spring = spring;
    });

    try {
      const doc = getDocument();
      const locs = locateKeyframes(doc, MAIN_COMPOSITION_ID, [keyId]);
      if (locs.length > 0) {
        const loc = locs[0];
        documentCommands.setKeyframe(loc.clipId, loc.trackId, { ...loc.keyframe, ease: uiEaseToCanonical(ease) });
      }
    } catch {
      // fallback
    }
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

    try {
      const locs = locateKeyframes(getDocument(), MAIN_COMPOSITION_ID, keyIds);
      if (locs.length > 0) {
        transaction("Change easing", () => {
          for (const loc of locs) {
            documentCommands.setKeyframe(loc.clipId, loc.trackId, { ...loc.keyframe, ease: uiEaseToCanonical(ease) });
          }
        });
      }
    } catch {
      // fallback
    }
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

    try {
      deleteKeyframes(ids);
    } catch {
      // fallback
    }
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
  setClipSettings(
    layerId: string,
    settings: { category?: ClipCategory; trigger?: Trigger; clipIndex?: number }
  ): void {
    const s = useMotionModel.getState();
    const l = s.comp.layers.find((x) => x.id === layerId);
    const clipIdx = settings.clipIndex ?? s.selectedClip ?? 0;

    const newCategory = settings.category ?? l?.category ?? "Entrance";
    let newTrigger = settings.trigger ?? l?.trig ?? "On load";

    if (settings.category && !settings.trigger) {
      newTrigger = CATEGORY_DEFAULT_TRIGGERS[settings.category] ?? "On load";
    }

    const canonicalType = uiClipTypeToCanonical(newCategory);
    const canonicalTrigger = uiTriggerToCanonical(newTrigger);

    edit((c) => {
      const target = c.layers.find((x) => x.id === layerId);
      if (target) {
        target.category = newCategory;
        target.trig = newTrigger;
        if (newTrigger === "While scrolling") {
          target.scrub = true;
        }
      }
    });

    try {
      const doc = getDocument();
      if (!doc || !doc.layers[layerId]) return;

      const placed = placementsOf(doc, MAIN_COMPOSITION_ID, layerId);
      const existingClip =
        placed[clipIdx]?.clip ??
        placed[0]?.clip ??
        Object.values(doc.clips).find((c) => c.layerId === layerId && c.enabled);

      if (existingClip) {
        transaction("Update animation", () => {
          const patch: Partial<Omit<Clip, "id" | "layerId" | "tracks">> = {
            type: canonicalType,
            trigger: canonicalTrigger,
          };
          if (canonicalType === "stagger" && !existingClip.stagger) {
            patch.stagger = { each: 0.05, from: "start" };
          }
          if (canonicalTrigger !== "custom" && existingClip.event !== undefined) {
            patch.event = undefined;
          }
          documentCommands.updateClip(existingClip.id, patch);
        });
      } else {
        transaction("Add animation", () => {
          const comp = doc.compositions[MAIN_COMPOSITION_ID] ?? Object.values(doc.compositions)[0];
          const template: ClipTemplate = {
            id: createId("clip"),
            name: KEYFRAMES_CLIP_NAME,
            type: canonicalType,
            trigger: canonicalTrigger,
            duration: comp ? comp.duration : 5,
            easing: "power2.out",
            enabled: true,
            tracks: [],
            ...(canonicalType === "stagger" ? { stagger: { each: 0.05, from: "start" } } : {}),
          };
          documentCommands.addClip(layerId, template, undefined, {
            compositionId: comp?.id ?? MAIN_COMPOSITION_ID,
          });
        });
      }
    } catch {
      // Standalone or test fallback
    }
  },

  setClipCategory(layerId: string, category: ClipCategory): void {
    motionActions.setClipSettings(layerId, { category });
  },

  setClipTrigger(layerId: string, trigger: Trigger): void {
    motionActions.setClipSettings(layerId, { trigger });
  },

  setLayer(layerId: string, patch: Partial<MotionLayer>): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) Object.assign(l, patch);
    });

    if (patch.category !== undefined || patch.trig !== undefined) {
      motionActions.setClipSettings(layerId, {
        category: patch.category,
        trigger: patch.trig,
      });
    }
  },
  addProperty(layerId: string, p: PropId): void {
    edit((c) => {
      const l = ensureLayer(c, layerId);
      if (l.tr.some((t) => t.p === p)) return;
      l.tr.push({ p, keys: [] });
      sortTracks(l);
    });

    try {
      const canonicalPath = UI_TO_CANONICAL_PATH[p];
      if (canonicalPath) {
        transaction("Add track", () => {
          ensureTrack(layerId, canonicalPath);
        });
      }
    } catch {
      // fallback
    }
  },
  removeProperty(layerId: string, p: PropId): void {
    edit((c) => {
      const l = c.layers.find((x) => x.id === layerId);
      if (l) l.tr = l.tr.filter((t) => t.p !== p);
    });

    try {
      const canonicalPath = UI_TO_CANONICAL_PATH[p];
      if (canonicalPath) {
        const doc = getDocument();
        const placed = placementsOf(doc, MAIN_COMPOSITION_ID, layerId);
        for (const pl of placed) {
          const tr = pl.clip.tracks.find((t) => t.property === canonicalPath);
          if (tr) {
            documentCommands.removeTrack(pl.clip.id, tr.id);
          }
        }
      }
    } catch {
      // fallback
    }
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

    try {
      const s = useMotionModel.getState();
      const fps = s.fps || 60;
      const motionLayer = s.comp.layers.find(l => l.id === layerId);
      const startFrame = motionLayer ? Math.min(...motionLayer.clips.map(c => c.s)) : 0;
      const sSec = startFrame / fps;
      transaction("Apply preset", () => {
        if (preset === "Fade in") {
          setKeyframeAt(layerId, "appearance.opacity", sSec, { value: 0 });
          setKeyframeAt(layerId, "appearance.opacity", sSec + 36 / fps, { value: 1 });
        } else if (preset === "Slide up") {
          setKeyframeAt(layerId, "appearance.opacity", sSec, { value: 0 });
          setKeyframeAt(layerId, "appearance.opacity", sSec + 36 / fps, { value: 1 });
          setKeyframeAt(layerId, "transform.y", sSec, { value: 24 });
          setKeyframeAt(layerId, "transform.y", sSec + 36 / fps, { value: 0 });
        } else if (preset === "Pop") {
          setKeyframeAt(layerId, "appearance.opacity", sSec, { value: 0 });
          setKeyframeAt(layerId, "appearance.opacity", sSec + 24 / fps, { value: 1 });
          setKeyframeAt(layerId, "transform.scale", sSec, { value: 0.86, ease: "back-out" });
          setKeyframeAt(layerId, "transform.scale", sSec + 36 / fps, { value: 1 });
        }
      });
    } catch {
      // fallback
    }
  },
  addMarker(t: number, name?: string): void {
    let docId: string | null = null;
    if (!useMotionModel.getState().comp.markers.some((m) => m.t === Math.round(t))) {
      try {
        docId = addMarkerAt(t / (useMotionModel.getState().fps || 60), name ?? "");
      } catch {
        // standalone fallback
      }
    }
    edit((c) => {
      const hit = c.markers.find((m) => m.t === Math.round(t) || (docId && m.id === docId));
      if (hit) return;
      c.markers.push({
        id: docId ?? `m${c.markers.length + 1}`,
        t: Math.round(t),
        name: name ?? `Marker ${c.markers.length + 1}`,
      });
      c.markers.sort((a, b) => a.t - b.t);
    });
  },
  deleteMarker(id: string): void {
    try {
      removeMarkerById(id);
    } catch {
      // standalone fallback
    }
    edit((c) => {
      c.markers = c.markers.filter((m) => m.id !== id);
    });
  },
};

/**
 * Test seam: with `window.__LL_TEST__` set, `window.__LL_MOTION__` gives browser tests direct access
 * to the Motion store state.
 */
if (typeof window !== "undefined") {
  Object.defineProperty(window, "__LL_MOTION__", {
    configurable: true,
    get: () => {
      const w = window as unknown as { __LL_TEST__?: boolean };
      return w.__LL_TEST__ ? () => useMotionModel.getState() : undefined;
    },
  });
}

