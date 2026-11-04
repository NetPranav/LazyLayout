import type { CubicBezierCurve, PlaybackMode } from "./types";
import type { SegmentedControlOption } from "@/editor/components/SegmentedControl";

export const DEFAULT_LAYERS: readonly string[] = [
  "Headline",
  "Subtitle",
  "Get started",
];

export const DEFAULT_PROPERTIES: readonly string[] = [
  "Opacity",
  "Position",
  "Scale",
];

export const DEFAULT_EASINGS: readonly string[] = [
  "Ease out",
  "Ease in",
  "Ease in out",
  "Linear",
];

export const PLAYBACK_OPTIONS: readonly SegmentedControlOption<PlaybackMode>[] = [
  { value: "Off", label: "Off" },
  { value: "Loop", label: "Loop" },
  { value: "Bounce", label: "Bounce" },
];

export const DEFAULT_BEZIER: CubicBezierCurve = {
  x1: 0,
  y1: 0,
  x2: 0.58,
  y2: 1,
};

export const EASING_BEZIERS: Record<string, CubicBezierCurve> = {
  "Ease out": { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  "Ease in": { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  "Ease in out": { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  Linear: { x1: 0, y1: 0, x2: 1, y2: 1 },
};

export const EASING_SVG_PATHS: Record<string, string> = {
  "Ease out": "M6 114C90 114 120 6 266 6",
  "Ease in": "M6 114C150 114 180 6 266 6",
  "Ease in out": "M6 114C120 114 150 6 266 6",
  Linear: "M6 114L266 6",
};
