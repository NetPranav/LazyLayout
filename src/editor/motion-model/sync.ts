"use client";

import { documentStore, getDocument } from "@/core/store/useDocumentStore";
import type { MotionDocument, Layer } from "@/core/document/schema";
import { MAIN_COMPOSITION_ID } from "@/core/document/compositions";
import { useMotionModel } from "./store";
import { makeLayer, PROPS, sortTracks } from "./model";
import type { Composition, EaseName, Keyframe, MotionLayer, PropId, PropTrack } from "./types";

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
  if (lower.includes("linear")) return "Linear";
  if (lower.includes("in-out") || lower.includes("inout")) return "Ease in out";
  if (lower.includes("in")) return "Ease in";
  if (lower.includes("back")) return "Back out";
  if (lower.includes("anticipate")) return "Anticipate";
  if (lower.includes("spring")) return "Spring";
  if (lower.includes("custom") || lower.includes("cubic")) return "Custom";
  return "Ease out";
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
      return "back-out";
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
  // Non-root layers with parentId or valid archetypes
  return true;
}

/** Pure projection: constructs an updated Composition from canonical MotionDocument */
export function syncDocumentToMotion(doc: MotionDocument, prevComp: Composition): Composition {
  const fps = prevComp.fps || 60;
  const dur = prevComp.dur || 300;
  const existingLayerMap = new Map(prevComp.layers.map((l) => [l.id, l]));

  // Find all eligible layers from doc.layers
  const docLayers = Object.values(doc.layers).filter(isEligibleMotionLayer);
  const nextLayers: MotionLayer[] = [];

  for (const docLayer of docLayers) {
    const prevLayer = existingLayerMap.get(docLayer.id);

    // Look for canonical clips in doc.clips for this layer
    const layerClips = Object.values(doc.clips).filter((c) => c.layerId === docLayer.id && c.enabled);

    let clips = prevLayer?.clips ?? [{ s: 0, e: dur }];
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
          }));
          const existing = trMap.get(propId) ?? [];
          trMap.set(propId, [...existing, ...keys]);
        }
      }
    } else if (prevLayer && prevLayer.tr.length > 0) {
      // Retain existing tracks if canonical clips haven't been generated yet
      for (const tr of prevLayer.tr) {
        trMap.set(tr.p, [...tr.keys]);
      }
    }

    const tr: PropTrack[] = Array.from(trMap.entries()).map(([p, keys]) => ({
      p,
      keys: keys.sort((a, b) => a.t - b.t),
    }));

    const motionLayer: MotionLayer = {
      id: docLayer.id,
      lbl: prevLayer?.lbl ?? 0,
      gopen: prevLayer?.gopen ?? true,
      clips,
      open: prevLayer?.open ?? false,
      mute: prevLayer?.mute ?? false,
      lock: prevLayer?.lock ?? false,
      solo: prevLayer?.solo ?? false,
      trig: prevLayer?.trig ?? "On load",
      ease: prevLayer?.ease ?? "Ease out",
      rep: prevLayer?.rep ?? "Once",
      rn: prevLayer?.rn ?? 3,
      yoyo: prevLayer?.yoyo ?? false,
      ss: prevLayer?.ss ?? "top 80%",
      se: prevLayer?.se ?? "bottom 20%",
      scrub: prevLayer?.scrub ?? false,
      pin: prevLayer?.pin ?? false,
      sprev: prevLayer?.sprev ?? 0,
      stag: prevLayer?.stag ?? 60,
      sfrom: prevLayer?.sfrom ?? "Start",
      tr,
    };
    sortTracks(motionLayer);
    nextLayers.push(motionLayer);
  }

  return {
    ...prevComp,
    layers: nextLayers,
  };
}

let activeSubscriptionCount = 0;
let unsubscribeDocumentStore: (() => void) | null = null;
let isSyncing = false;
let lastLayersRef: Record<string, Layer> | null = null;
let lastClipsRef: Record<string, unknown> | null = null;

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
        const currentComp = useMotionModel.getState().comp;
        const nextComp = syncDocumentToMotion(doc, currentComp);
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
      if (doc.layers === lastLayersRef && doc.clips === lastClipsRef) {
        return;
      }
      lastLayersRef = doc.layers;
      lastClipsRef = doc.clips;

      isSyncing = true;
      try {
        const currentComp = useMotionModel.getState().comp;
        const nextComp = syncDocumentToMotion(doc, currentComp);
        useMotionModel.setState({ comp: nextComp });
      } finally {
        isSyncing = false;
      }
    });
  }

  return () => {
    activeSubscriptionCount--;
    if (activeSubscriptionCount <= 0) {
      activeSubscriptionCount = 0;
      if (unsubscribeDocumentStore) {
        unsubscribeDocumentStore();
        unsubscribeDocumentStore = null;
      }
      lastLayersRef = null;
      lastClipsRef = null;
    }
  };
}
