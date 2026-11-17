/**
 * Phase 133 — Typed Signal Catalogue (`src/core/signals/catalogue.ts`).
 *
 * Central metadata registry for every built-in input & signal in the studio:
 * pointer, keyboard (`key.down`, `key.held`, `key.axis`, `key.lastPressed`, `focusVisible`),
 * scroll, view, time, device, audio, and internal state/variable signals.
 * Every entry declares `unit`, `range`, `defaultValue`, and `touchBehaviour` so the UI,
 * accessibility checks, and exporter handle every signal uniformly.
 */
import type { Signal } from "../document/signals";
import type { Value } from "../bindings/evaluate";

export type SignalCategory = "pointer" | "scroll" | "keyboard" | "time" | "layer" | "device" | "audio" | "state";
export type SignalUnit = "px" | "uv" | "ndc" | "deg" | "s" | "px/s" | "0..1" | "-1..1" | "bool" | "id" | "scalar";
export type SignalTouchFallback = "tap" | "while-pressed" | "hold-last" | "zero" | "drag-fallback" | "native";

export interface SignalCatalogueEntry {
  readonly id: string;
  readonly label: string;
  readonly category: SignalCategory;
  readonly unit: SignalUnit;
  readonly valueType: "number" | "boolean" | "vec2";
  readonly range: readonly [number, number];
  readonly defaultValue: number | boolean | readonly [number, number];
  readonly touchBehaviour: SignalTouchFallback;
  readonly description: string;
  createSignal(layerId?: string, param?: string): Signal;
}

export const SIGNAL_CATALOGUE: readonly SignalCatalogueEntry[] = [
  // Pointer
  {
    id: "pointer.x",
    label: "Cursor X",
    category: "pointer",
    unit: "px",
    valueType: "number",
    range: [0, 1920],
    defaultValue: 0,
    touchBehaviour: "drag-fallback",
    description: "Pointer horizontal position in page pixels.",
    createSignal: () => ({ kind: "pointer", channel: "x" }),
  },
  {
    id: "pointer.y",
    label: "Cursor Y",
    category: "pointer",
    unit: "px",
    valueType: "number",
    range: [0, 1080],
    defaultValue: 0,
    touchBehaviour: "drag-fallback",
    description: "Pointer vertical position in page pixels.",
    createSignal: () => ({ kind: "pointer", channel: "y" }),
  },
  {
    id: "pointer.uv.frame",
    label: "Cursor UV (Frame)",
    category: "pointer",
    unit: "uv",
    valueType: "vec2",
    range: [0, 1],
    defaultValue: [0, 0],
    touchBehaviour: "drag-fallback",
    description: "Normalised 0..1 cursor position inside the frame.",
    createSignal: () => ({ kind: "pointerIn", channel: "uv", space: "frame" }),
  },
  {
    id: "pointer.px.local",
    label: "Cursor Position (Layer)",
    category: "pointer",
    unit: "px",
    valueType: "vec2",
    range: [0, 1920],
    defaultValue: [0, 0],
    touchBehaviour: "drag-fallback",
    description: "Pointer position in px relative to the layer's top-left corner.",
    createSignal: () => ({ kind: "pointerIn", channel: "px", space: "local" }),
  },
  {
    id: "pointer.ndc.local",
    label: "Cursor NDC (Layer)",
    category: "pointer",
    unit: "ndc",
    valueType: "vec2",
    range: [-1, 1],
    defaultValue: [0, 0],
    touchBehaviour: "while-pressed",
    description: "Centered -1..1 pointer offset relative to the target layer.",
    createSignal: () => ({ kind: "pointerIn", channel: "ndc", space: "local" }),
  },
  {
    id: "pointer.speed",
    label: "Cursor Speed",
    category: "pointer",
    unit: "px/s",
    valueType: "number",
    range: [0, 2400],
    defaultValue: 0,
    touchBehaviour: "while-pressed",
    description: "Smoothed pointer speed in pixels per second.",
    createSignal: () => ({ kind: "pointer", channel: "speed" }),
  },
  {
    id: "pointer.angle",
    label: "Cursor Angle",
    category: "pointer",
    unit: "deg",
    valueType: "number",
    range: [-180, 180],
    defaultValue: 0,
    touchBehaviour: "hold-last",
    description: "Heading angle of recent pointer movement in degrees.",
    createSignal: () => ({ kind: "pointer", channel: "angle" }),
  },
  {
    id: "pointer.velocity",
    label: "Cursor Velocity",
    category: "pointer",
    unit: "px/s",
    valueType: "vec2",
    range: [-2000, 2000],
    defaultValue: [0, 0],
    touchBehaviour: "while-pressed",
    description: "2D pointer velocity vector [vx, vy] in px/s.",
    createSignal: () => ({ kind: "pointer", channel: "velocity" }),
  },
  {
    id: "pointer.down",
    label: "Pointer Down",
    category: "pointer",
    unit: "bool",
    valueType: "boolean",
    range: [0, 1],
    defaultValue: false,
    touchBehaviour: "while-pressed",
    description: "True while primary mouse button or finger touch is down.",
    createSignal: () => ({ kind: "pointer", channel: "down" }),
  },
  {
    id: "pointer.pressure",
    label: "Pointer Pressure",
    category: "pointer",
    unit: "0..1",
    valueType: "number",
    range: [0, 1],
    defaultValue: 0,
    touchBehaviour: "while-pressed",
    description: "Pen or touch contact pressure in 0..1.",
    createSignal: () => ({ kind: "pointer", channel: "pressure" }),
  },
  {
    id: "pointer.inside",
    label: "Pointer Inside Layer",
    category: "layer",
    unit: "bool",
    valueType: "boolean",
    range: [0, 1],
    defaultValue: false,
    touchBehaviour: "while-pressed",
    description: "Raw boolean inside hit bounds of the named layer.",
    createSignal: (layerId = "self") => ({ kind: "pointerInside", layer: layerId }),
  },
  {
    id: "hover",
    label: "Layer Hover",
    category: "layer",
    unit: "0..1",
    valueType: "number",
    range: [0, 1],
    defaultValue: 0,
    touchBehaviour: "tap",
    description: "Edge-smoothed (80 ms) hover scalar 0..1 on the layer.",
    createSignal: (layerId = "self") => ({ kind: "layerState", channel: "hover", layer: layerId }),
  },
  {
    id: "press",
    label: "Layer Press",
    category: "layer",
    unit: "0..1",
    valueType: "number",
    range: [0, 1],
    defaultValue: 0,
    touchBehaviour: "while-pressed",
    description: "Edge-smoothed (80 ms) press scalar 0..1 on the layer.",
    createSignal: (layerId = "self") => ({ kind: "layerState", channel: "press", layer: layerId }),
  },
  {
    id: "focus",
    label: "Layer Focus",
    category: "keyboard",
    unit: "bool",
    valueType: "boolean",
    range: [0, 1],
    defaultValue: false,
    touchBehaviour: "tap",
    description: "True while the layer holds DOM focus.",
    createSignal: (layerId = "self") => ({ kind: "layerState", channel: "focus", layer: layerId }),
  },
  {
    id: "focusVisible",
    label: "Keyboard Focus Visible",
    category: "keyboard",
    unit: "bool",
    valueType: "boolean",
    range: [0, 1],
    defaultValue: false,
    touchBehaviour: "zero",
    description: "True when the layer holds keyboard-initiated focus.",
    createSignal: (layerId = "self") => ({ kind: "focusVisible", layer: layerId }),
  },
  {
    id: "proximity",
    label: "Cursor Distance",
    category: "layer",
    unit: "px",
    valueType: "number",
    range: [0, 600],
    defaultValue: 0,
    touchBehaviour: "zero",
    description: "Euclidean distance from pointer to layer edge or centre.",
    createSignal: (layerId = "self") => ({ kind: "proximity", layer: layerId, measure: "edge" }),
  },
  // Scroll & View
  {
    id: "scroll.y",
    label: "Scroll Y",
    category: "scroll",
    unit: "px",
    valueType: "number",
    range: [0, 5000],
    defaultValue: 0,
    touchBehaviour: "native",
    description: "Vertical scroll offset in pixels.",
    createSignal: () => ({ kind: "scroll", channel: "y" }),
  },
  {
    id: "scroll.progress",
    label: "Scroll Progress",
    category: "scroll",
    unit: "0..1",
    valueType: "number",
    range: [0, 1],
    defaultValue: 0,
    touchBehaviour: "native",
    description: "Normalised page/frame scroll progress from 0 to 1.",
    createSignal: () => ({ kind: "scroll", channel: "progress" }),
  },
  {
    id: "scroll.velocity",
    label: "Scroll Velocity",
    category: "scroll",
    unit: "px/s",
    valueType: "number",
    range: [-3000, 3000],
    defaultValue: 0,
    touchBehaviour: "native",
    description: "Smoothed vertical scroll speed in px/s.",
    createSignal: () => ({ kind: "scroll", channel: "velocity" }),
  },
  {
    id: "view.progress",
    label: "In-View Progress",
    category: "scroll",
    unit: "0..1",
    valueType: "number",
    range: [0, 1],
    defaultValue: 0,
    touchBehaviour: "native",
    description: "Layer's enter-to-exit progress through the viewport.",
    createSignal: (layerId = "self") => ({ kind: "view", layer: layerId, channel: "progress" }),
  },
  {
    id: "view.visible",
    label: "Visible Fraction",
    category: "scroll",
    unit: "0..1",
    valueType: "number",
    range: [0, 1],
    defaultValue: 0,
    touchBehaviour: "native",
    description: "Share of the layer's height currently inside the viewport.",
    createSignal: (layerId = "self") => ({ kind: "view", layer: layerId, channel: "visible" }),
  },
  // Keyboard
  {
    id: "key.down",
    label: "Key Down",
    category: "keyboard",
    unit: "bool",
    valueType: "boolean",
    range: [0, 1],
    defaultValue: false,
    touchBehaviour: "zero",
    description: "True while physical key code K (e.g. Space, KeyW) is held.",
    createSignal: (_layerId, code = "Space") => ({ kind: "keyDown", code }),
  },
  {
    id: "key.held",
    label: "Key Hold Duration",
    category: "keyboard",
    unit: "s",
    valueType: "number",
    range: [0, 10],
    defaultValue: 0,
    touchBehaviour: "zero",
    description: "Seconds key K has been held continuously.",
    createSignal: (_layerId, code = "Space") => ({ kind: "keyHeld", code }),
  },
  {
    id: "key.axis",
    label: "2D Key Axis (WASD / Arrows)",
    category: "keyboard",
    unit: "-1..1",
    valueType: "vec2",
    range: [-1, 1],
    defaultValue: [0, 0],
    touchBehaviour: "drag-fallback",
    description: "Directional [-1..1, -1..1] vector from WASD or Arrow keys.",
    createSignal: (_layerId, preset = "arrows") => ({
      kind: "keyAxis",
      preset: preset === "wasd" ? "wasd" : "arrows",
    }),
  },
  {
    id: "key.lastPressed",
    label: "Last Key Pressed Hash",
    category: "keyboard",
    unit: "id",
    valueType: "number",
    range: [0, 65536],
    defaultValue: 0,
    touchBehaviour: "zero",
    description: "Stable numeric code identifier for the most recently pressed key.",
    createSignal: () => ({ kind: "keyLastPressed" }),
  },
  // Time & Deterministic
  {
    id: "time",
    label: "Time",
    category: "time",
    unit: "s",
    valueType: "number",
    range: [0, 60],
    defaultValue: 0,
    touchBehaviour: "native",
    description: "Elapsed transport time in seconds.",
    createSignal: () => ({ kind: "time" }),
  },
  {
    id: "frame.dt",
    label: "Frame Delta",
    category: "time",
    unit: "s",
    valueType: "number",
    range: [0, 0.067],
    defaultValue: 1 / 60,
    touchBehaviour: "native",
    description: "Clamped frame step duration in seconds.",
    createSignal: () => ({ kind: "frameDt" }),
  },
  {
    id: "seed",
    label: "Instance Seed",
    category: "state",
    unit: "scalar",
    valueType: "number",
    range: [0, 1000000],
    defaultValue: 0,
    touchBehaviour: "native",
    description: "Deterministic per-instance seed integer.",
    createSignal: () => ({ kind: "seed" }),
  },
  // Device & Audio & State placeholders (populated in Phase 135 & State Machine phases)
  {
    id: "audio.level",
    label: "Audio Level",
    category: "audio",
    unit: "0..1",
    valueType: "number",
    range: [0, 1],
    defaultValue: 0,
    touchBehaviour: "native",
    description: "Microphone or audio element RMS amplitude (0..1).",
    createSignal: (layerId = "mic") => ({ kind: "audio", layer: layerId, channel: "level" }),
  },
  {
    id: "device.tiltX",
    label: "Device Tilt X",
    category: "device",
    unit: "-1..1",
    valueType: "number",
    range: [-1, 1],
    defaultValue: 0,
    touchBehaviour: "native",
    description: "Normalised phone/tablet left-right tilt (permission-gated).",
    createSignal: () => ({ kind: "device", channel: "tiltX" }),
  },
  {
    id: "device.tiltY",
    label: "Device Tilt Y",
    category: "device",
    unit: "-1..1",
    valueType: "number",
    range: [-1, 1],
    defaultValue: 0,
    touchBehaviour: "native",
    description: "Normalised phone/tablet front-back tilt (permission-gated).",
    createSignal: () => ({ kind: "device", channel: "tiltY" }),
  },
  {
    id: "device.orientation",
    label: "Device Heading",
    category: "device",
    unit: "deg",
    valueType: "number",
    range: [0, 360],
    defaultValue: 0,
    touchBehaviour: "native",
    description: "Compass-style heading of the device in degrees (permission-gated).",
    createSignal: () => ({ kind: "device", channel: "orientation" }),
  },
  {
    id: "state",
    label: "State Input",
    category: "state",
    unit: "bool",
    valueType: "boolean",
    range: [0, 1],
    defaultValue: false,
    touchBehaviour: "tap",
    description: "Active state flag by name.",
    createSignal: (_layerId, name = "hover") => ({ kind: "state", name }),
  },
  {
    id: "sm",
    label: "State Machine Input",
    category: "state",
    unit: "scalar",
    valueType: "number",
    range: [0, 1],
    defaultValue: 0,
    touchBehaviour: "tap",
    description: "Reads a numeric or boolean State Machine input.",
    createSignal: (_layerId, input = "progress") => ({ kind: "sm", input }),
  },
  {
    id: "prop",
    label: "Component Property",
    category: "state",
    unit: "scalar",
    valueType: "number",
    range: [0, 100],
    defaultValue: 0,
    touchBehaviour: "native",
    description: "Reads an exposed component property.",
    createSignal: (_layerId, name = "amount") => ({ kind: "prop", name }),
  },
  {
    id: "var",
    label: "Document Variable",
    category: "state",
    unit: "scalar",
    valueType: "number",
    range: [0, 100],
    defaultValue: 0,
    touchBehaviour: "native",
    description: "Reads a numeric design variable or token.",
    createSignal: (_layerId, name = "scale") => ({ kind: "var", name }),
  },
];

export function listSignalsByCategory(category?: SignalCategory): readonly SignalCatalogueEntry[] {
  if (!category) return SIGNAL_CATALOGUE;
  return SIGNAL_CATALOGUE.filter((entry) => entry.category === category);
}

export function findCatalogueEntry(signal: Signal): SignalCatalogueEntry | undefined {
  switch (signal.kind) {
    case "pointer":
      return SIGNAL_CATALOGUE.find((e) => e.id === `pointer.${signal.channel}`);
    case "pointerIn":
      // The exact space/unit pair when listed; otherwise another entry with the same unit, so the meter's range and
      // unit are right even for pairs the catalogue doesn't list one by one.
      return (
        SIGNAL_CATALOGUE.find((e) => e.id === `pointer.${signal.channel}.${signal.space}`) ??
        SIGNAL_CATALOGUE.find((e) => e.id.startsWith(`pointer.${signal.channel}.`))
      );
    case "pointerInside":
      return SIGNAL_CATALOGUE.find((e) => e.id === "pointer.inside");
    case "layerState":
      return SIGNAL_CATALOGUE.find((e) => e.id === signal.channel);
    case "focusVisible":
      return SIGNAL_CATALOGUE.find((e) => e.id === "focusVisible");
    case "proximity":
      return SIGNAL_CATALOGUE.find((e) => e.id === "proximity");
    case "scroll":
      return SIGNAL_CATALOGUE.find((e) => e.id === `scroll.${signal.channel}`);
    case "view":
      return SIGNAL_CATALOGUE.find((e) => e.id === `view.${signal.channel}`);
    case "keyDown":
      return SIGNAL_CATALOGUE.find((e) => e.id === "key.down");
    case "keyHeld":
      return SIGNAL_CATALOGUE.find((e) => e.id === "key.held");
    case "keyAxis":
      return SIGNAL_CATALOGUE.find((e) => e.id === "key.axis");
    case "keyLastPressed":
      return SIGNAL_CATALOGUE.find((e) => e.id === "key.lastPressed");
    case "time":
      return SIGNAL_CATALOGUE.find((e) => e.id === "time");
    case "frameDt":
      return SIGNAL_CATALOGUE.find((e) => e.id === "frame.dt");
    case "seed":
      return SIGNAL_CATALOGUE.find((e) => e.id === "seed");
    case "audio":
      return SIGNAL_CATALOGUE.find((e) => e.id === "audio.level");
    case "device":
      // Each channel its own entry (every device signal used to show the tilt-X label and range).
      return SIGNAL_CATALOGUE.find((e) => e.id === `device.${signal.channel}`);
    default:
      return SIGNAL_CATALOGUE.find((e) => e.id === signal.kind);
  }
}

export function normalizeMeterFill(value: Value, range: readonly [number, number]): number {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "boolean"
        ? value
          ? 1
          : 0
        : Math.hypot(value[0], value[1]);
  const span = range[1] - range[0];
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (num - range[0]) / span));
}

export function formatSignalValue(value: Value, unit: SignalUnit): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value !== "number") return `[${value[0].toFixed(2)}, ${value[1].toFixed(2)}]`;
  if (unit === "bool") return value >= 0.5 ? "true" : "false";
  if (unit === "px" || unit === "px/s" || unit === "id") return `${Math.round(value)} ${unit === "id" ? "" : unit}`.trim();
  if (unit === "deg") return `${value.toFixed(1)}°`;
  return value.toFixed(2);
}
