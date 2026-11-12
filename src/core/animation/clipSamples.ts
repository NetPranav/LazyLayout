import type { MotionDocument } from "@/core/document/schema";
import type { Clip, Trigger } from "@/core/document/motion";
import type { AnimationSample, AnimationTrack, AnimationTrackId, AnimationTrigger } from "@/core/types/animations";

/**
 * ROADMAP Phase 68: the document's clips as the exporters' animation samples. The GSAP, Vue and Git exporters still
 * take `AnimationSample`s; this is how what the timeline makes (document clips) reaches the generated code, instead
 * of the legacy `useProjectStore.animationSamples`. Pure: no store, no DOM.
 */

/** Document property paths the exporters have a track for. Others (layout, colours by token …) are left out. */
const TRACK_OF: Record<string, AnimationTrackId> = {
  "transform.x": "translateX",
  "transform.translateX": "translateX",
  "transform.y": "translateY",
  "transform.translateY": "translateY",
  "transform.z": "translateZ",
  "transform.scale": "scale",
  "transform.scaleX": "scaleX",
  "transform.scaleY": "scaleY",
  "transform.rotate": "rotate",
  "transform.rotateZ": "rotate",
  "transform.rotateX": "rotateX",
  "transform.rotateY": "rotateY",
  "transform.skewX": "skewX",
  "transform.skewY": "skewY",
  "appearance.opacity": "opacity",
  opacity: "opacity",
  "appearance.radius": "borderRadius",
  "appearance.fill": "backgroundColor",
  "effects.blur": "filterBlur",
  "text.color": "color",
  "text.size": "fontSize",
  "text.letterSpacing": "letterSpacing",
  "text.lineHeight": "lineHeight",
};

const TRIGGER_OF: Partial<Record<Trigger, AnimationTrigger>> = {
  mount: "onMount",
  time: "onMount",
  hover: "onHover",
  press: "onClick",
  inView: "onScroll",
  scrollProgress: "onScroll",
};

export function sampleFromClip(clip: Clip, layerName: string): AnimationSample | null {
  const duration = clip.duration > 0 ? clip.duration : 0;
  const tracks: AnimationTrack[] = [];
  for (const track of clip.tracks) {
    const trackId = TRACK_OF[track.property];
    if (!trackId || track.keyframes.length === 0) continue;
    tracks.push({
      trackId,
      keyframes: track.keyframes.map((k) => ({
        offset: duration > 0 ? Math.round((k.time / duration) * 10000) / 100 : 0,
        value: k.value as number | string,
        ...(k.ease ? { easing: k.ease } : {}),
      })),
    });
  }
  if (tracks.length === 0) return null;
  const repeat = clip.repeat ?? 0;
  return {
    id: clip.id,
    name: `${layerName} ${clip.name || "animation"}`.trim(),
    duration: Math.round(duration * 1000),
    ...(clip.delay ? { delay: Math.round(clip.delay * 1000) } : {}),
    easing: clip.easing || "linear",
    iterations: repeat === -1 ? "infinite" : repeat + 1,
    direction: clip.direction === "alternate" ? "alternate" : clip.direction === "reverse" ? "reverse" : "normal",
    fillMode: "both",
    tracks,
    trigger: TRIGGER_OF[clip.trigger] ?? "manual",
  };
}

/** Every enabled clip of the document that has a track the exporters understand, by clip id. */
export function samplesFromClips(doc: Pick<MotionDocument, "clips" | "layers">): Record<string, AnimationSample> {
  const out: Record<string, AnimationSample> = {};
  for (const clip of Object.values(doc.clips)) {
    if (clip.enabled === false) continue;
    const sample = sampleFromClip(clip, doc.layers[clip.layerId]?.name ?? clip.layerId);
    if (sample) out[clip.id] = sample;
  }
  return out;
}

/** What to export: the legacy samples a project may still hold, then the document's clips (which win on the same id). */
export function exportSamples(doc: Pick<MotionDocument, "clips" | "layers">, legacy: Record<string, AnimationSample>): Record<string, AnimationSample> {
  return { ...legacy, ...samplesFromClips(doc) };
}
