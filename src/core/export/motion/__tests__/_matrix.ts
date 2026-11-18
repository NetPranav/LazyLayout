import type { AnimationSample, AnimationTrack } from "../../../types/animations";

/** Every property path the three generators know, taken from their `case` labels, plus two they do not. */
export const TRACK_IDS: string[] = [
  "transform.x", "transform.y", "transform.z", "transform.scale", "transform.scaleX", "transform.scaleY", "transform.rotate", "transform.rotateX", "transform.rotateY", "transform.skewX",
  "appearance.opacity", "appearance.borderRadius", "appearance.shadow", "appearance.background.color", "typography.color", "filter.blur", "media.filter.contrast", "media.clipPath", "svg.strokeDashoffset", "divider.length", "background.gradient.angle",
  "translateX", "scale", "opacity", "something.unknown", "x",
];

const kf = (offset: number, value: number | string) => ({ offset, value } as never);
export const tracksFor = (ids: string[]): AnimationTrack[] => ids.map((trackId, i) => ({ trackId, keyframes: [kf(0, i % 2 ? "10px" : i), kf(50, i + 1), kf(100, i % 3 ? i + 2 : "20px")] }) as unknown as AnimationTrack);

export const SAMPLES: AnimationSample[] = [
  { id: "fade", name: "Fade", duration: 800, easing: "power2.out", iterations: 1, direction: "normal", fillMode: "forwards", tracks: tracksFor(["appearance.opacity", "transform.y"]) },
  { id: "pulse", name: "Pulse", duration: 1200, delay: 250, easing: "linear", iterations: "infinite", direction: "alternate", fillMode: "both", tracks: tracksFor(["transform.scale", "appearance.opacity", "filter.blur"]) },
  { id: "bounce", name: "Bounce", duration: 600, easing: "cubic-bezier(0.4, 0, 0.2, 1)", iterations: 3, direction: "alternate", fillMode: "backwards", tracks: tracksFor(TRACK_IDS) },
  { id: "empty", name: "Empty", duration: 100, easing: "linear", iterations: 1, direction: "reverse", fillMode: "forwards", tracks: [] },
];
