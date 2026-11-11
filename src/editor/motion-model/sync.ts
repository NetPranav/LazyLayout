"use client";

import { documentStore, getDocument } from "@/core/store/useDocumentStore";
import { getTransport, subscribeTransport } from "@/core/time/transport";
import { useTimelineUiStore } from "@/core/store/useTimelineUiStore";
import type { MotionDocument, Layer } from "@/core/document/schema";
import type { Trigger as CanonicalTrigger, ClipType } from "@/core/document/motion";
import { MAIN_COMPOSITION_ID } from "@/core/document/compositions";
import { useMotionModel } from "./store";
import { makeLayer, PROPS, sortTracks } from "./model";
import { bezierEase, bezierHandles, easeKind, springEase, springParams } from "@/core/timeline/graph";
import type { Bezier, SpringParams } from "./types";
import type { Composition, EaseName, Keyframe, MotionLayer, PropId, PropTrack, Trigger as UiTrigger, ClipCategory } from "./types";

/** Maps canonical document trigger to UI trigger name */
export const CANONICAL_TO_UI_TRIGGER: Record<CanonicalTrigger, UiTrigger> = {
  mount: "On load",
  hover: "On hover",
  press: "On press",
  focus: "On focus",
  inView: "On scroll into view",
  scrollProgress: "While scrolling",
  pointerMove: "Follow the pointer",
  drag: "While dragged",
  time: "On a timer",
  unmount: "On leave",
  layoutChange: "When its layout changes",
  custom: "Custom",
};

/** Maps UI trigger name (including legacy aliases) to canonical document trigger */
export const UI_TO_CANONICAL_TRIGGER: Record<UiTrigger, CanonicalTrigger> = {
  "On load": "mount",
  "On hover": "hover",
  "On press": "press",
  "On click": "press", // legacy UI alias mapped to press
  "On focus": "focus",
  "On scroll into view": "inView",
  "While scrolling": "scrollProgress",
  "Follow the pointer": "pointerMove",
  "While dragged": "drag",
  "On a timer": "time",
  "On leave": "unmount",
  "When its layout changes": "layoutChange",
  Custom: "custom",
};

/** Maps canonical document clip type to UI category name */
export const CANONICAL_TO_UI_CLIP_TYPE: Record<ClipType, ClipCategory> = {
  entrance: "Entrance",
  hover: "Hover",
  tap: "Tap",
  scroll: "Scroll",
  loop: "Loop",
  morph: "Morph",
  exit: "Exit",
  focus: "Focus",
  stagger: "Stagger",
  layout: "Layout",
};

/** Maps UI category name to canonical document clip type */
export const UI_TO_CANONICAL_CLIP_TYPE: Record<ClipCategory, ClipType> = {
  Entrance: "entrance",
  Hover: "hover",
  Tap: "tap",
  Scroll: "scroll",
  Loop: "loop",
  Morph: "morph",
  Exit: "exit",
  Focus: "focus",
  Stagger: "stagger",
  Layout: "layout",
};

/** Default trigger assigned when choosing a category */
export const CATEGORY_DEFAULT_TRIGGERS: Record<ClipCategory, UiTrigger> = {
  Exit: "On leave",
  Focus: "On focus",
  Layout: "When its layout changes",
  Hover: "On hover",
  Tap: "On press",
  Scroll: "While scrolling",
  Entrance: "On load",
  Loop: "On load",
  Morph: "On load",
  Stagger: "On load",
};

export function canonicalTriggerToUi(trigger?: CanonicalTrigger | string): UiTrigger {
  if (!trigger) return "On load";
  if (Object.prototype.hasOwnProperty.call(CANONICAL_TO_UI_TRIGGER, trigger)) {
    return CANONICAL_TO_UI_TRIGGER[trigger as CanonicalTrigger];
  }
  return "On load";
}

export function uiTriggerToCanonical(trigger: UiTrigger): CanonicalTrigger {
  return UI_TO_CANONICAL_TRIGGER[trigger] ?? "mount";
}

export function canonicalClipTypeToUi(type?: ClipType | string): ClipCategory {
  if (!type) return "Entrance";
  if (Object.prototype.hasOwnProperty.call(CANONICAL_TO_UI_CLIP_TYPE, type)) {
    return CANONICAL_TO_UI_CLIP_TYPE[type as ClipType];
  }
  return "Entrance";
}

export function uiClipTypeToCanonical(category: ClipCategory): ClipType {
  return UI_TO_CANONICAL_CLIP_TYPE[category] ?? "entrance";
}

/** Maps UI property id to canonical MDM property path */
export const UI_TO_CANONICAL_PATH: Record<PropId, string> = {
  opacity: "appearance.opacity",
  x: "transform.x",
  y: "transform.y",
  rot: "transform.rotate",
  scale: "transform.scale",
};

/** Maps canonical MDM property path (and aliases) to UI property id */
export const CANONICAL_TO_UI_PATH: Record<string, PropId> = {
  "appearance.opacity": "opacity",
  opacity: "opacity",
  "transform.x": "x",
  "transform.translateX": "x",
  "transform.y": "y",
  "transform.translateY": "y",
  "transform.rotate": "rot",
  "transform.rotateZ": "rot",
  "transform.scale": "scale",
};

export function canonicalEaseToUi(ease?: string): EaseName {
  if (!ease) return "Ease out";
  const lower = ease.toLowerCase();
  // springs and bezier curves first ("spring" contains "in")
  if (lower.includes("spring")) return "Spring";
  if (lower.includes("cubic") || lower.includes("custom")) return "Custom";
  if (lower.includes("linear")) return "Linear";
  if (lower.includes("in-out") || lower.includes("inout")) return "Ease in out";
  if (lower.includes("in")) return "Ease in";
  if (lower.includes("back")) return "Back out";
  if (lower.includes("anticipate")) return "Anticipate";
  if (lower.includes("spring")) return "Spring";
  if (lower.includes("custom") || lower.includes("cubic")) return "Custom";
  return "Ease out";
}

/** Phase 67: a keyframe's bezier handles and spring, read from its easing string, so the easing editor shows what is saved. */
function easeDetails(ease: string | undefined): Pick<Keyframe, "bz" | "spring"> {
  const kind = easeKind(ease);
  if (kind === "bezier") {
    const h = bezierHandles(ease);
    return h ? { bz: [h.x1, h.y1, h.x2, h.y2] } : {};
  }
  if (kind === "spring") {
    const sp = springParams(ease);
    return sp ? { spring: { response: sp.time, damping: Math.min(1, Math.max(0, 1 - sp.bounce)) } } : {};
  }
  return {};
}

/** Phase 67: the easing string saved for a timeline easing: curves keep their handles, springs their Bounce and Time. */
export function uiEaseToCanonicalString(ease: EaseName, bz?: Bezier, spring?: SpringParams): string {
  if (ease === "Spring") {
    const sp = spring ?? { response: 0.35, damping: 0.6 };
    return springEase(1 - sp.damping, sp.response);
  }
  if (ease === "Custom") {
    const h = bz ?? [0.25, 0.1, 0.25, 1];
    return bezierEase({ x1: h[0], y1: h[1], x2: h[2], y2: h[3] });
  }
  return uiEaseToCanonical(ease);
}

export function uiEaseToCanonical(ease: EaseName): string {
  switch (ease) {
    case "Linear":
      return "linear";
    case "Ease in":
      return "ease-in";
    case "Ease out":
      return "ease-out";
    case "Ease in out":
      return "ease-in-out";
    case "Back out":
      return "back.out"; // the kernel's name ("back-out" was never a valid easing)
    case "Anticipate":
      return "anticipate";
    case "Spring":
      return "spring";
    case "Custom":
      return "custom";
    default:
      return "ease-out";
  }
}

export function canonicalToUiValue(p: PropId, val: unknown): number {
  const num = typeof val === "number" ? val : PROPS[p].d;
  if (p === "opacity") {
    // Canonical 0..1 -> UI 0..100%
    return num <= 1.0 ? Math.round(num * 100) : num;
  }
  if (p === "scale") {
    // Canonical 1.0 -> UI 100%
    return num <= 5.0 && num > 0 ? Math.round(num * 100) : num;
  }
  return num;
}

export function uiToCanonicalValue(p: PropId, val: number): number {
  if (p === "opacity") {
    return val / 100;
  }
  if (p === "scale") {
    return val / 100;
  }
  return val;
}

/** Determines if a layer in MDM is an animatable canvas element */
export function isEligibleMotionLayer(layer: Layer): boolean {
  if (!layer) return false;
  // Canvas root containers are not animatable elements
  if (layer.id === "elem_canvas_root" || layer.id === "el_root_container") return false;
  // If the document has both "button" and "el_buy_button", skip the legacy duplicate
  if (layer.id === "el_buy_button") {
    try {
      const doc = getDocument();
      if (doc?.layers?.["button"]) return false;
    } catch {
      // ignore
    }
  }
  // Non-root layers with parentId or valid archetypes
  return true;
}

/** Pure projection: constructs an updated Composition from canonical MotionDocument */
export function syncDocumentToMotion(doc: MotionDocument, prevComp: Composition, compositionId: string = MAIN_COMPOSITION_ID): Composition {
  const fps = prevComp.fps || 60;
  const dur = prevComp.dur || 300;
  // Phase 65: Main lists every clip (an interaction clip is still shown on its layer there, as before); an interaction
  // composition or an opened precomp lists only the clips placed in it, at their placement's offset.
  const shown = compositionId !== MAIN_COMPOSITION_ID ? doc.compositions?.[compositionId] : undefined;
  const placementOffset = shown ? new Map(shown.clips.map((p) => [p.clipId, p.offset])) : null;
  const existingLayerMap = new Map(prevComp.layers.map((l) => [l.id, l]));

  // Find all eligible layers from doc.layers
  const docLayers = Object.values(doc.layers).filter(isEligibleMotionLayer);
  const nextLayers: MotionLayer[] = [];

  for (const docLayer of docLayers) {
    const prevLayer = existingLayerMap.get(docLayer.id);

    // Look for canonical clips in doc.clips for this layer
    const layerClips = Object.values(doc.clips)
      .filter((c) => c.layerId === docLayer.id && c.enabled && (!placementOffset || placementOffset.has(c.id)))
      .map((c) => (placementOffset ? { ...c, delay: (placementOffset.get(c.id) ?? 0) + (c.delay ?? 0) } : c));

    let clips = (placementOffset ? undefined : prevLayer?.clips) ?? [{ s: 0, e: dur }];
    const trMap = new Map<PropId, Keyframe[]>();

    if (layerClips.length > 0) {
      clips = layerClips.map((c) => ({
        s: Math.round((c.delay ?? 0) * fps),
        e: Math.round(((c.delay ?? 0) + c.duration) * fps),
      }));

      for (const clip of layerClips) {
        const offsetSec = clip.delay ?? 0;
        for (const track of clip.tracks) {
          const propId = CANONICAL_TO_UI_PATH[track.property];
          if (!propId) continue; // preserve unknown/unsupported tracks in MDM without crashing UI
          const keys: Keyframe[] = track.keyframes.map((k) => ({
            id: k.id,
            t: Math.round((offsetSec + k.time) * fps),
            v: canonicalToUiValue(propId, k.value),
            ease: canonicalEaseToUi(k.ease),
            ...easeDetails(k.ease),
          }));
          const existing = trMap.get(propId) ?? [];
          trMap.set(propId, [...existing, ...keys]);
        }
      }
    } else if (!placementOffset && prevLayer && prevLayer.tr.length > 0) {
      // Retain existing tracks if canonical clips haven't been generated yet
      for (const tr of prevLayer.tr) {
        trMap.set(tr.p, [...tr.keys]);
      }
    }

    const tr: PropTrack[] = Array.from(trMap.entries()).map(([p, keys]) => ({
      p,
      keys: keys.sort((a, b) => a.t - b.t),
    }));

    const primaryClip = layerClips[0];
    const category: ClipCategory = primaryClip
      ? canonicalClipTypeToUi(primaryClip.type)
      : (prevLayer?.category ?? "Entrance");
    const trig: UiTrigger = primaryClip
      ? canonicalTriggerToUi(primaryClip.trigger)
      : (prevLayer?.trig ? (prevLayer.trig === "On click" ? "On press" : prevLayer.trig) : "On load");

    const motionLayer: MotionLayer = {
      id: docLayer.id,
      lbl: prevLayer?.lbl ?? 0,
      gopen: prevLayer?.gopen ?? true,
      clips,
      open: prevLayer?.open ?? false,
      mute: docLayer.visible === false,
      lock: docLayer.locked === true,
      solo: docLayer.solo === true,
      category,
      trig,
      ease: prevLayer?.ease ?? (primaryClip ? canonicalEaseToUi(primaryClip.easing) : "Ease out"),
      rep: prevLayer?.rep ?? (primaryClip?.repeat === -1 ? "Forever" : (primaryClip?.repeat && primaryClip.repeat > 0) ? "Number" : "Once"),
      rn: prevLayer?.rn ?? (primaryClip?.repeat && primaryClip.repeat > 0 ? primaryClip.repeat : 3),
      yoyo: prevLayer?.yoyo ?? (primaryClip?.direction === "alternate"),
      ss: prevLayer?.ss ?? (primaryClip?.scrollTrigger?.start ?? "top 80%"),
      se: prevLayer?.se ?? (primaryClip?.scrollTrigger?.end ?? "bottom 20%"),
      scrub: prevLayer?.scrub ?? (Boolean(primaryClip?.scrollTrigger?.scrub) || trig === "While scrolling"),
      pin: prevLayer?.pin ?? Boolean(primaryClip?.scrollTrigger?.pin),
      sprev: prevLayer?.sprev ?? 0,
      stag: prevLayer?.stag ?? (primaryClip?.stagger?.each ? Math.round(primaryClip.stagger.each * 1000) : 60),
      sfrom: prevLayer?.sfrom ?? (typeof primaryClip?.stagger?.from === "string" ? (primaryClip.stagger.from === "center" ? "Center" : primaryClip.stagger.from === "end" ? "End" : "Start") : "Start"),
      tr,
    };
    sortTracks(motionLayer);
    nextLayers.push(motionLayer);
  }

  const mainComp = doc.compositions?.[compositionId] ?? doc.compositions?.[MAIN_COMPOSITION_ID];
  const markers = mainComp
    ? (mainComp.markers ?? []).map((m) => ({ id: m.id, t: Math.round(m.time * fps), name: m.label }))
    : prevComp.markers;

  return {
    ...prevComp,
    layers: nextLayers,
    markers,
  };
}

let activeSubscriptionCount = 0;
let unsubscribeDocumentStore: (() => void) | null = null;
let isSyncing = false;
let lastLayersRef: Record<string, Layer> | null = null;
let lastClipsRef: Record<string, unknown> | null = null;
let lastCompsRef: Record<string, unknown> | null = null;
let lastCompositionId: string | null = null;
let unsubscribeTransport: (() => void) | null = null;
let unsubscribeKeySelection: (() => void) | null = null;
const shownCompositionId = (): string => getTransport().compositionId || MAIN_COMPOSITION_ID;

/**
 * Installs the centralized, idempotent document-to-motion synchronizer.
 * Returns an unregister function to be called on component unmount.
 */
export function installDocumentMotionSync(): () => void {
  activeSubscriptionCount++;

  if (activeSubscriptionCount === 1) {
    // Initial projection run
    try {
      const doc = getDocument();
      if (doc?.layers) {
        lastLayersRef = doc.layers;
        lastClipsRef = doc.clips;
        lastCompsRef = doc.compositions;
        lastCompositionId = shownCompositionId();
        const currentComp = useMotionModel.getState().comp;
        const nextComp = syncDocumentToMotion(doc, currentComp, lastCompositionId);
        useMotionModel.setState({ comp: nextComp });
      }
    } catch {
      // Fallback if documentStore not ready
    }

    unsubscribeDocumentStore = documentStore.subscribe((state) => {
      if (isSyncing) return;
      const doc = state.document;
      if (!doc || !doc.layers) return;

      // Only re-project if layers or clips references actually changed
      if (doc.layers === lastLayersRef && doc.clips === lastClipsRef && doc.compositions === lastCompsRef && shownCompositionId() === lastCompositionId) {
        return;
      }
      lastCompositionId = shownCompositionId();
      lastLayersRef = doc.layers;
      lastClipsRef = doc.clips;
      lastCompsRef = doc.compositions;

      isSyncing = true;
      try {
        const currentComp = useMotionModel.getState().comp;
        const nextComp = syncDocumentToMotion(doc, currentComp, lastCompositionId);
        useMotionModel.setState({ comp: nextComp });
      } finally {
        isSyncing = false;
      }
    });
    // Phase 66/67: the keyframes selected here are the engine's selection too, so its timeline commands (F9 Easy Ease,
    // Ctrl+C / Ctrl+V, the graph editor) act on them.
    unsubscribeKeySelection = useMotionModel.subscribe((state, prev) => {
      if (state.selectedKeys === prev.selectedKeys) return;
      useTimelineUiStore.getState().selectKeys(Object.keys(state.selectedKeys).filter((id) => state.selectedKeys[id]), "replace");
    });
    // Opening another composition (a tab, a breadcrumb, a precomp bar) shows its clips.
    unsubscribeTransport = subscribeTransport((t) => {
      const id = t.compositionId || MAIN_COMPOSITION_ID;
      if (id === lastCompositionId) return;
      lastCompositionId = id;
      const doc = getDocument();
      if (!doc?.layers) return;
      useMotionModel.setState({ comp: syncDocumentToMotion(doc, useMotionModel.getState().comp, id) });
    });
  }

  return () => {
    activeSubscriptionCount--;
    if (activeSubscriptionCount <= 0) {
      activeSubscriptionCount = 0;
      unsubscribeTransport?.();
      unsubscribeKeySelection?.();
      unsubscribeKeySelection = null;
      unsubscribeTransport = null;
      lastCompositionId = null;
      if (unsubscribeDocumentStore) {
        unsubscribeDocumentStore();
        unsubscribeDocumentStore = null;
      }
      lastLayersRef = null;
      lastClipsRef = null;
      lastCompsRef = null;
    }
  };
}
