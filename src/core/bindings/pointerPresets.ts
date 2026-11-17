import { BindingDraftSchema, type BindingDraft } from "../document/signals";
import { noise1 } from "./evaluate";

export type PointerPresetId =
  | "magnet"
  | "tilt"
  | "followLag"
  | "proximity"
  | "spotlight"
  | "inertia"
  | "noise"
  | "wander";

export interface PointerLayerBox {
  readonly id: string;
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
}

export interface PointerFrameInput {
  readonly time: number;
  readonly dt: number;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly pointerDown: boolean;
}

export interface PointerPresetConfig {
  readonly layer: PointerLayerBox;
  readonly preset: PointerPresetId;
  readonly radiusPx?: number;
  readonly strength?: number;
  readonly maxTiltDeg?: number;
  readonly lagSec?: number;
  readonly friction?: number;
  readonly amplitudePx?: number;
  readonly frequencyHz?: number;
  readonly seed?: number;
}

export interface PointerPresetState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotate: number;
  rotateX: number;
  rotateY: number;
  scale: number;
  opacity: number;
  spotlightX: number;
  spotlightY: number;
  wasDown: boolean;
  lastPointerX: number;
  lastPointerY: number;
}

export function createPointerPresetState(): PointerPresetState {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rotate: 0,
    rotateX: 0,
    rotateY: 0,
    scale: 1,
    opacity: 1,
    spotlightX: 0,
    spotlightY: 0,
    wasDown: false,
    lastPointerX: 0,
    lastPointerY: 0,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function smoothFactor(dt: number, tau: number): number {
  const safeDt = Math.max(0, Math.min(dt, 1 / 15));
  return 1 - Math.exp(-safeDt / Math.max(tau, 1e-4));
}

/**
 * Steps one pointer preset frame deterministically across all 8 Stage 4 presets:
 * `magnet`, `tilt`, `followLag`, `proximity`, `spotlight`, `inertia`, `noise`, `wander`.
 */
export function stepPointerPreset(
  config: PointerPresetConfig,
  input: PointerFrameInput,
  state: PointerPresetState
): PointerPresetState {
  const { layer, preset } = config;
  const dx = input.pointerX - layer.centerX;
  const dy = input.pointerY - layer.centerY;
  const dist = Math.hypot(dx, dy);
  const dt = Math.max(1 / 240, Math.min(input.dt, 1 / 15));
  const lag = config.lagSec ?? 0.12;
  const k = smoothFactor(dt, lag);

  switch (preset) {
    case "magnet": {
      const radius = Math.max(1, config.radiusPx ?? 180);
      const strength = config.strength ?? 0.35;
      const influence = dist < radius ? 1 - dist / radius : 0;
      const targetX = dx * influence * strength;
      const targetY = dy * influence * strength;
      state.x += (targetX - state.x) * k;
      state.y += (targetY - state.y) * k;
      break;
    }
    case "tilt": {
      const maxDeg = config.maxTiltDeg ?? 15;
      const nx = Math.max(-1, Math.min(1, dx / Math.max(1, layer.width / 2)));
      const ny = Math.max(-1, Math.min(1, dy / Math.max(1, layer.height / 2)));
      state.rotateY += (nx * maxDeg - state.rotateY) * k;
      state.rotateX += (-ny * maxDeg - state.rotateX) * k;
      state.rotate += (nx * ny * (maxDeg * 0.25) - state.rotate) * k;
      break;
    }
    case "followLag": {
      const targetX = dx * (config.strength ?? 1);
      const targetY = dy * (config.strength ?? 1);
      state.x += (targetX - state.x) * k;
      state.y += (targetY - state.y) * k;
      break;
    }
    case "proximity": {
      const radius = Math.max(1, config.radiusPx ?? 240);
      const factor = clamp01(1 - dist / radius);
      const boost = config.strength ?? 0.25;
      state.scale += (1 + factor * boost - state.scale) * k;
      state.opacity += (0.5 + factor * 0.5 - state.opacity) * k;
      break;
    }
    case "spotlight": {
      state.spotlightX = input.pointerX - (layer.centerX - layer.width / 2);
      state.spotlightY = input.pointerY - (layer.centerY - layer.height / 2);
      break;
    }
    case "inertia": {
      const friction = config.friction ?? 6;
      if (input.pointerDown) {
        if (state.wasDown) {
          const stepDx = input.pointerX - state.lastPointerX;
          const stepDy = input.pointerY - state.lastPointerY;
          state.x += stepDx;
          state.y += stepDy;
          state.vx = stepDx / dt;
          state.vy = stepDy / dt;
        }
      } else {
        const decay = Math.exp(-friction * dt);
        state.x += state.vx * dt;
        state.y += state.vy * dt;
        state.vx *= decay;
        state.vy *= decay;
      }
      state.wasDown = input.pointerDown;
      state.lastPointerX = input.pointerX;
      state.lastPointerY = input.pointerY;
      break;
    }
    case "noise": {
      const amp = config.amplitudePx ?? 16;
      const freq = config.frequencyHz ?? 0.8;
      const seed = config.seed ?? 11;
      state.x = noise1(input.time * freq, seed) * amp;
      state.y = noise1(input.time * freq + 19.7, seed + 17) * amp;
      break;
    }
    case "wander": {
      const amp = config.amplitudePx ?? 32;
      const freq = config.frequencyHz ?? 0.5;
      const seed = config.seed ?? 5;
      const phi = seed * 1.1;
      state.x = Math.sin(input.time * freq * Math.PI * 2 + phi) * amp * 0.7 + noise1(input.time * 0.4, seed) * amp * 0.3;
      state.y = Math.cos(input.time * freq * 1.3 * Math.PI * 2 + phi) * amp * 0.7 + noise1(input.time * 0.4 + 7.1, seed + 23) * amp * 0.3;
      break;
    }
  }

  return state;
}

/** Generates validated `BindingDraft` presets representing the 8 pointer behaviours. */
export function buildPointerPresetDrafts(
  layerId: string,
  preset: PointerPresetId,
  strength = 1
): BindingDraft[] {
  const on = { kind: "layer" as const, ref: layerId };
  /** The cursor's offset from the layer's centre, -1..1 per axis (clamped outside the layer), remapped to ±`px`. */
  const towardCursor = (axis: "x" | "y", px: number, tau: number): BindingDraft =>
    BindingDraftSchema.parse({
      expr: {
        signal: { kind: "pointerIn", channel: "ndc", space: "local" },
        operators: [
          { op: "component", axis },
          { op: "remap", inMin: -1, inMax: 1, outMin: -px, outMax: px, clamp: true },
          { op: "smooth", tau },
        ],
      },
      target: { kind: "property", on, path: axis === "x" ? "transform.x" : "transform.y" },
      blend: "add",
    });
  switch (preset) {
    case "magnet":
      // Pulls toward the cursor on both axes (was: proximity added to x only, which always pushed right).
      return [towardCursor("x", 16 * strength, 0.1), towardCursor("y", 16 * strength, 0.1)];
    case "tilt":
      return [
        BindingDraftSchema.parse({
          expr: { signal: { kind: "pointerIn", channel: "ndc", space: "local" }, operators: [{ op: "component", axis: "x" }, { op: "remap", inMin: -1, inMax: 1, outMin: -15 * strength, outMax: 15 * strength, clamp: true }, { op: "smooth", tau: 0.08 }] },
          target: { kind: "property", on, path: "transform.rotateY" },
          blend: "add",
        }),
        BindingDraftSchema.parse({
          expr: { signal: { kind: "pointerIn", channel: "ndc", space: "local" }, operators: [{ op: "component", axis: "y" }, { op: "remap", inMin: -1, inMax: 1, outMin: 15 * strength, outMax: -15 * strength, clamp: true }, { op: "smooth", tau: 0.08 }] },
          target: { kind: "property", on, path: "transform.rotateX" },
          blend: "add",
        }),
      ];
    case "followLag":
      // Leans after the cursor with a lag, as an offset from where the layer is (was: `replace` with the page-space
      // pointer, which jumped the layer to page coordinates whatever its parent).
      return [towardCursor("x", 60 * strength, 0.14), towardCursor("y", 60 * strength, 0.14)];
    case "proximity":
      return [
        BindingDraftSchema.parse({
          expr: { signal: { kind: "proximity", layer: layerId, measure: "center" }, operators: [{ op: "falloff", shape: "smoothstep", radius: 240 }, { op: "remap", inMin: 0, inMax: 1, outMin: 1, outMax: 1 + 0.25 * strength, clamp: true }] },
          target: { kind: "property", on, path: "transform.scale" },
          blend: "multiply",
        }),
      ];
    case "spotlight":
      return [
        BindingDraftSchema.parse({
          expr: { signal: { kind: "pointerIn", channel: "px", space: "local" }, operators: [{ op: "component", axis: "x" }] },
          target: { kind: "cssvar", on, name: "spotlight-x" },
        }),
        BindingDraftSchema.parse({
          expr: { signal: { kind: "pointerIn", channel: "px", space: "local" }, operators: [{ op: "component", axis: "y" }] },
          target: { kind: "cssvar", on, name: "spotlight-y" },
        }),
      ];
    case "inertia": {
      // Only while the pointer is pressed does its velocity feed the leaky integrator, so the layer is flung in the
      // drag direction and settles back (was: pointer dx accumulated on every hover move, so the layer drifted).
      const flung = (axis: "x" | "y"): BindingDraft =>
        BindingDraftSchema.parse({
          expr: {
            signal: { kind: "pointer", channel: "down" },
            operators: [
              {
                op: "select",
                whenTrue: { signal: { kind: "pointer", channel: "velocity" }, operators: [{ op: "component", axis }] },
                whenFalse: { signal: { kind: "constant", value: 0 }, operators: [] },
              },
              { op: "accumulate", decay: 5 },
              { op: "mul", x: 0.3 * strength },
            ],
          },
          target: { kind: "property", on, path: axis === "x" ? "transform.x" : "transform.y" },
          blend: "add",
        });
      return [flung("x"), flung("y")];
    }
    case "noise":
    case "wander": {
      const frequency = preset === "wander" ? 0.45 : 1.1;
      const seed = preset === "wander" ? 5 : 11;
      const drift = (axis: "x" | "y", axisSeed: number): BindingDraft =>
        BindingDraftSchema.parse({
          expr: { signal: { kind: "time" }, operators: [{ op: "noise", frequency, amplitude: 20 * strength, seed: axisSeed }] },
          target: { kind: "property", on, path: axis === "x" ? "transform.x" : "transform.y" },
          blend: "add",
        });
      // Both axes, with different seeds (was: x only).
      return [drift("x", seed), drift("y", seed + 17)];
    }
  }
}

export function stepPointerPresetsBatch(
  entries: readonly { readonly config: PointerPresetConfig; readonly state: PointerPresetState }[],
  input: PointerFrameInput
): void {
  for (const item of entries) {
    stepPointerPreset(item.config, input, item.state);
  }
}
