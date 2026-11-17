import { BindingDraftSchema, type BindingDraft, type Operator, type Signal } from "../document/signals";
import type { ArchetypeId } from "../document/registry";

export type ReactivitySource = "cursor" | "scroll" | "hover" | "touch" | "keyboard" | "sound";

export type ReactivityAffordance =
  | "follow"
  | "bend"
  | "repel"
  | "ripple"
  | "glow"
  | "tilt"
  | "parallax"
  | "scale";

export interface ReactivitySourceMeta {
  readonly id: ReactivitySource;
  readonly label: string;
  readonly description: string;
}

export const REACTIVITY_SOURCES: readonly ReactivitySourceMeta[] = [
  { id: "cursor", label: "Cursor", description: "Moves or tilts with pointer position" },
  { id: "scroll", label: "Scroll", description: "Reacts as the page scrolls through view" },
  { id: "hover", label: "Hover on…", description: "Responds when a pointer hovers the layer or target" },
  { id: "touch", label: "Touch", description: "Drives motion from pointer press & touch pressure" },
  { id: "keyboard", label: "Keyboard", description: "Nudges and switches using Arrow keys / WASD" },
  { id: "sound", label: "Sound", description: "Pulses from microphone loudness or audio beats" },
];

export interface AffordanceSpec {
  readonly id: ReactivityAffordance;
  readonly label: string;
  readonly verb: string;
  readonly targetPath: string;
  readonly maxAmplitude: number;
  readonly blend: "add" | "replace" | "multiply";
  readonly compatibleSources: readonly ReactivitySource[];
  readonly excludedArchetypes?: readonly ArchetypeId[];
}

export const REACTIVITY_AFFORDANCES: readonly AffordanceSpec[] = [
  {
    id: "follow",
    label: "Follow",
    verb: "follows",
    targetPath: "transform.x",
    maxAmplitude: 80,
    blend: "add",
    compatibleSources: ["cursor", "touch", "keyboard"],
  },
  {
    id: "tilt",
    label: "Tilt",
    verb: "tilts with",
    targetPath: "transform.rotate",
    maxAmplitude: 18,
    blend: "add",
    compatibleSources: ["cursor", "hover", "touch", "keyboard"],
  },
  {
    id: "parallax",
    label: "Parallax",
    verb: "shifts in depth with",
    targetPath: "transform.y",
    maxAmplitude: 120,
    blend: "add",
    compatibleSources: ["cursor", "scroll"],
  },
  {
    id: "repel",
    label: "Repel",
    verb: "pushes away from",
    targetPath: "transform.x",
    maxAmplitude: -60,
    blend: "add",
    compatibleSources: ["cursor", "touch"],
    excludedArchetypes: ["background"],
  },
  {
    id: "bend",
    label: "Bend",
    verb: "skews toward",
    targetPath: "transform.skewX",
    maxAmplitude: 14,
    blend: "add",
    compatibleSources: ["cursor", "scroll", "hover", "sound"],
    excludedArchetypes: ["background", "divider"],
  },
  {
    id: "scale",
    label: "Scale",
    verb: "scales with",
    targetPath: "transform.scale",
    maxAmplitude: 1.35,
    blend: "multiply",
    compatibleSources: ["hover", "touch", "sound", "scroll"],
  },
  {
    id: "ripple",
    label: "Ripple",
    verb: "pulses on",
    targetPath: "transform.scaleY",
    maxAmplitude: 1.25,
    blend: "multiply",
    compatibleSources: ["touch", "hover", "sound"],
  },
  {
    id: "glow",
    label: "Glow",
    verb: "brightens with",
    // Brightness, multiplied: 1 at rest, up to 1.35. (It used to replace opacity with 0.35..1, so choosing Glow made
    // the layer semi-transparent at rest and never brighter.)
    targetPath: "adjust.brightness",
    maxAmplitude: 1.35,
    blend: "multiply",
    compatibleSources: ["cursor", "scroll", "hover", "sound", "keyboard"],
  },
];

/** Returns only the affordances supported for the given layer archetype & input source. */
export function affordancesForLayer(
  archetype: ArchetypeId | undefined,
  source: ReactivitySource
): readonly AffordanceSpec[] {
  return REACTIVITY_AFFORDANCES.filter(
    (a) =>
      a.compatibleSources.includes(source) &&
      (!archetype || !a.excludedArchetypes?.includes(archetype))
  );
}

export interface ReactivityCardConfig {
  readonly ownerLayerId: string;
  readonly layerName?: string;
  readonly source: ReactivitySource;
  readonly affordance: ReactivityAffordance;
  /** Strength slider 0..100. */
  readonly strength: number;
  /** Smoothness slider 0..100 (maps 0 -> 0.02 s crisp, 100 -> 0.55 s buttery). */
  readonly smoothness: number;
  /** Optional alternate target layer id for "Hover on…". */
  readonly hoverLayerId?: string;
}

export function smoothnessToTau(smoothness: number): number {
  const s = Math.max(0, Math.min(100, smoothness)) / 100;
  return Number((0.02 + s * 0.53).toFixed(3));
}

function sourceToSignal(config: ReactivityCardConfig, axis: "x" | "y"): Signal {
  const ref = config.hoverLayerId?.trim() || config.ownerLayerId;
  switch (config.source) {
    case "cursor":
      return { kind: "pointerIn", channel: "ndc", space: "frame" };
    case "scroll":
      return { kind: "scroll", channel: "progress" };
    case "hover":
      return { kind: "layerState", channel: "hover", layer: ref };
    case "touch":
      return { kind: "pointer", channel: axis === "x" ? "pressure" : "down" };
    case "keyboard":
      return { kind: "keyAxis", preset: "arrows", axis };
    case "sound":
      return { kind: "audio", layer: config.ownerLayerId, channel: "level" };
  }
}

/**
 * Compiles a Simple "Reacts to" configuration into one or more validated
 * `BindingDraft`s ready for `setDriversNamed`.
 */
export function buildReactivityDrafts(config: ReactivityCardConfig): BindingDraft[] {
  const spec = REACTIVITY_AFFORDANCES.find((a) => a.id === config.affordance) ?? REACTIVITY_AFFORDANCES[0]!;
  const strengthRatio = Math.max(0, Math.min(100, config.strength)) / 100;
  const tau = smoothnessToTau(config.smoothness);
  const targetOn = { kind: "layer" as const, ref: config.ownerLayerId };

  const makeDraft = (axis: "x" | "y", path: string, amp: number): BindingDraft => {
    const sig = sourceToSignal(config, axis);
    const ops: Operator[] = [];
    if (sig.kind === "pointerIn" || (sig.kind === "keyAxis" && axis === "y")) {
      ops.push({ op: "component", axis });
    }
    const isBipolar = sig.kind === "pointerIn" || sig.kind === "keyAxis";
    const inMin = isBipolar ? -1 : 0;
    const inMax = 1;
    const outMin = spec.blend === "multiply" ? 1 : isBipolar ? -amp * strengthRatio : 0;
    const outMax =
      spec.blend === "multiply"
        ? Number((1 + (amp - 1) * strengthRatio).toFixed(3))
        : Number((amp * strengthRatio).toFixed(3));
    ops.push({ op: "remap", inMin, inMax, outMin, outMax, clamp: true });
    if (tau > 0.02) {
      ops.push({ op: "smooth", tau });
    }
    return BindingDraftSchema.parse({
      expr: { signal: sig, operators: ops },
      target: { kind: "property", on: targetOn, path },
      blend: spec.blend,
    });
  };

  if (config.affordance === "follow" && (config.source === "cursor" || config.source === "keyboard")) {
    const xAmp = spec.maxAmplitude * strengthRatio;
    const yAmp = spec.maxAmplitude * strengthRatio;
    return [
      BindingDraftSchema.parse({
        expr: {
          signal: sourceToSignal(config, "x"),
          operators: [
            { op: "component", axis: "x" },
            { op: "remap", inMin: -1, inMax: 1, outMin: -xAmp, outMax: xAmp, clamp: true },
            ...(tau > 0.02 ? [{ op: "smooth" as const, tau }] : []),
          ],
        },
        target: { kind: "property", on: targetOn, path: "transform.x" },
        blend: "add",
      }),
      BindingDraftSchema.parse({
        expr: {
          signal: sourceToSignal(config, "y"),
          operators: [
            { op: "component", axis: "y" },
            { op: "remap", inMin: -1, inMax: 1, outMin: -yAmp, outMax: yAmp, clamp: true },
            ...(tau > 0.02 ? [{ op: "smooth" as const, tau }] : []),
          ],
        },
        target: { kind: "property", on: targetOn, path: "transform.y" },
        blend: "add",
      }),
    ];
  }

  return [makeDraft("x", spec.targetPath, spec.maxAmplitude)];
}

/** Generates a human-readable plain-language description of the reaction. */
export function describeReactivity(config: ReactivityCardConfig): string {
  const layerLabel = config.layerName?.trim() || "This layer";
  const spec = REACTIVITY_AFFORDANCES.find((a) => a.id === config.affordance) ?? REACTIVITY_AFFORDANCES[0]!;
  const sourcePhrase: Record<ReactivitySource, string> = {
    cursor: "the cursor",
    scroll: "page scroll",
    hover: config.hoverLayerId && config.hoverLayerId !== config.ownerLayerId ? `hover on ${config.hoverLayerId}` : "hover",
    touch: "touch pressure",
    keyboard: "keyboard arrows",
    sound: "sound level",
  };
  const feel =
    config.smoothness >= 70 ? "smoothly" : config.smoothness >= 30 ? "gently" : "snappily";
  const pct = Math.round(Math.max(0, Math.min(100, config.strength)));
  return `${layerLabel} ${spec.verb} ${sourcePhrase[config.source]} ${feel} at ${pct}% strength.`;
}

/** Normalized [0..1] live-meter bar fill for Law 17 feedback behind sliders. */
export function meterProgress(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}
