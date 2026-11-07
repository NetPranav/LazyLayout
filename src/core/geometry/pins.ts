/**
 * ============================================================================
 * PIN MODEL & RESOLUTION ENGINE (ROADMAP Phase 72, Engine Spec §8.6.2)
 * ============================================================================
 * One unified pin model: 9 preset pins (3x3 grid) plus custom pins (stored in
 * `layer.pins[name]`), which may lie outside the layer frame box.
 *
 * The anchor is the active pin used as the pivot for rotation and scale.
 * It is designated by `layer.properties["transform.origin"]`.
 * ============================================================================
 */

import { PIN_PRESETS } from "../document/signals";
import type { Pin } from "../document/kinetics";

export const PRESET_PIN_NAMES = [
  "topLeft",
  "top",
  "topRight",
  "left",
  "center",
  "right",
  "bottomLeft",
  "bottom",
  "bottomRight",
] as const;

export type PresetPinName = (typeof PRESET_PIN_NAMES)[number];

export const PRESET_PIN_ALIASES: Readonly<Record<string, PresetPinName>> = {
  "top left": "topLeft",
  "top-left": "topLeft",
  "top right": "topRight",
  "top-right": "topRight",
  "bottom left": "bottomLeft",
  "bottom-left": "bottomLeft",
  "bottom right": "bottomRight",
  "bottom-right": "bottomRight",
  "bottomCentre": "bottom",
  "bottom-centre": "bottom",
  "bottom-center": "bottom",
  "middle": "center",
};

export interface LayerLikeForPins {
  pins?: Record<string, Pin>;
  properties?: Record<string, unknown>;
  frame?: { width?: number; height?: number };
}

/**
 * Resolves the layer-local position [x, y] of a preset pin in a `width × height` box.
 */
export function resolvePresetPinPosition(
  pin: string,
  width: number,
  height: number
): [number, number] {
  const canonical = PRESET_PIN_ALIASES[pin] || (pin as PresetPinName);

  switch (canonical) {
    case "topLeft":
      return [0, 0];
    case "top":
      return [width / 2, 0];
    case "topRight":
      return [width, 0];
    case "left":
      return [0, height / 2];
    case "center":
      return [width / 2, height / 2];
    case "right":
      return [width, height / 2];
    case "bottomLeft":
      return [0, height];
    case "bottom":
      return [width / 2, height];
    case "bottomRight":
      return [width, height];
    default:
      // Fallback: check general naming rules
      const x = pin.includes("Left") || pin.includes("left")
        ? 0
        : pin.includes("Right") || pin.includes("right")
        ? width
        : width / 2;
      const y = pin.startsWith("top")
        ? 0
        : pin.startsWith("bottom")
        ? height
        : height / 2;
      return [x, y];
  }
}

/**
 * Resolves a custom pin definition to local coordinates [x, y].
 * Supports units "px" and "%".
 * Does NOT clamp coordinates to the bounding box (Condition E / §8.6.2).
 */
export function resolveCustomPinPosition(
  pin: Pin,
  width: number,
  height: number
): [number, number] {
  const x = pin.unit === "%" ? (pin.x / 100) * width : pin.x;
  const y = pin.unit === "%" ? (pin.y / 100) * height : pin.y;
  return [x, y];
}

/**
 * Resolves any pin reference (preset name, custom pin name, coordinate string or object)
 * to local [x, y] coordinates.
 */
export function resolvePinPosition(
  layer: LayerLikeForPins | null | undefined,
  pinRef: string | [number, number] | Pin | undefined,
  width: number,
  height: number
): [number, number] {
  if (!pinRef) {
    return [width / 2, height / 2];
  }

  // Already a tuple [x, y]
  if (Array.isArray(pinRef) && pinRef.length === 2) {
    return [pinRef[0], pinRef[1]];
  }

  // Pin object { x, y, unit }
  if (typeof pinRef === "object" && "x" in pinRef && "y" in pinRef) {
    return resolveCustomPinPosition(pinRef as Pin, width, height);
  }

  if (typeof pinRef === "string") {
    const trimmed = pinRef.trim();

    // Check custom pins on layer
    if (layer?.pins && Object.prototype.hasOwnProperty.call(layer.pins, trimmed)) {
      return resolveCustomPinPosition(layer.pins[trimmed], width, height);
    }

    // Check presets and preset aliases
    if (
      PRESET_PIN_NAMES.includes(trimmed as PresetPinName) ||
      Object.prototype.hasOwnProperty.call(PRESET_PIN_ALIASES, trimmed) ||
      (PIN_PRESETS as readonly string[]).includes(trimmed)
    ) {
      return resolvePresetPinPosition(trimmed, width, height);
    }

    // Check CSS percentage / px strings: "50% 50%", "10px 20px"
    const parts = trimmed.split(/\s+/);
    if (parts.length === 2) {
      const parseCoord = (str: string, size: number): number | null => {
        if (str.endsWith("%")) {
          const val = parseFloat(str);
          return isNaN(val) ? null : (val / 100) * size;
        }
        if (str.endsWith("px")) {
          const val = parseFloat(str);
          return isNaN(val) ? null : val;
        }
        const val = parseFloat(str);
        return isNaN(val) ? null : val;
      };
      const x = parseCoord(parts[0], width);
      const y = parseCoord(parts[1], height);
      if (x !== null && y !== null) {
        return [x, y];
      }
    }
  }

  return [width / 2, height / 2];
}

/**
 * Resolves the active anchor point of a layer in local [x, y] coordinates.
 * Reads `layer.properties["transform.origin"]` (defaulting to "center").
 */
export function resolveLayerAnchor(
  layer: LayerLikeForPins | null | undefined,
  width: number,
  height: number
): [number, number] {
  const origin = layer?.properties?.["transform.origin"];
  const ref = typeof origin === "string" ? origin : "center";
  return resolvePinPosition(layer, ref, width, height);
}

/**
 * Formats a resolved anchor coordinate as a CSS `transform-origin` string in pixels.
 */
export function formatCssTransformOrigin(anchor: [number, number]): string {
  return `${anchor[0]}px ${anchor[1]}px`;
}

/**
 * Snapping helper: checks whether `localPoint` is within `thresholdPx` of any of the
 * 9 preset pins on a `width × height` box. Returns the nearest preset or null.
 */
export function findNearestPresetPin(
  localPoint: [number, number],
  width: number,
  height: number,
  thresholdPx = 8
): { name: PresetPinName; position: [number, number]; distance: number } | null {
  const [px, py] = localPoint;
  let nearest: { name: PresetPinName; position: [number, number]; distance: number } | null = null;

  for (const name of PRESET_PIN_NAMES) {
    const [tx, ty] = resolvePresetPinPosition(name, width, height);
    const dist = Math.hypot(px - tx, py - ty);
    if (dist <= thresholdPx && (!nearest || dist < nearest.distance)) {
      nearest = { name, position: [tx, ty], distance: dist };
    }
  }

  return nearest;
}
