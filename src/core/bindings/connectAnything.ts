import { PROPERTY_REGISTRY } from "../document/properties";
import { BindingDraftSchema, type BindingDraft, type Operator, type Signal } from "../document/signals";

export type ConnectFeel = "gentle" | "snappy" | "bouncy" | "direct";

export type ConnectInputTarget =
  | { readonly kind: "cursor"; readonly axis?: "x" | "y" }
  | { readonly kind: "scroll" }
  | { readonly kind: "key"; readonly code?: string; readonly axis?: "x" | "y" }
  | { readonly kind: "microphone"; readonly band?: number }
  | { readonly kind: "layerProp"; readonly sourceLayerId: string; readonly sourceLayerName?: string; readonly sourceProperty: string };

export interface ConnectRequest {
  readonly targetLayerId: string;
  readonly targetPath: string;
  readonly targetLabel?: string;
  readonly source: ConnectInputTarget;
  readonly feel?: ConnectFeel;
}

export interface ConnectBindingResult {
  readonly mode: "binding";
  readonly draft: BindingDraft;
  readonly feel: ConnectFeel;
  readonly sentence: string;
}

export interface ConnectLinkResult {
  readonly mode: "property-link";
  readonly linkSlot: {
    readonly targetPath: string;
    readonly sourceLayerId: string;
    readonly sourceProperty: string;
    readonly map: "range";
    readonly inMin: number;
    readonly inMax: number;
    readonly outMin: number;
    readonly outMax: number;
  };
  readonly feel: ConnectFeel;
  readonly sentence: string;
}

export type ConnectResult = ConnectBindingResult | ConnectLinkResult;

export const CONNECT_FEELS: ReadonlyArray<{ readonly id: ConnectFeel; readonly label: string; readonly adverb: string }> = [
  { id: "gentle", label: "Gentle", adverb: "gently" },
  { id: "snappy", label: "Snappy", adverb: "snappily" },
  { id: "bouncy", label: "Bouncy", adverb: "bouncily" },
  { id: "direct", label: "Direct", adverb: "directly" },
];

function inferPropertyLabel(path: string, fallback?: string): string {
  if (fallback && fallback.trim()) return fallback.trim();
  const leaf = path.split(".").pop() ?? path;
  return leaf.charAt(0).toUpperCase() + leaf.slice(1);
}

export function inferOutputRange(path: string): readonly [number, number] {
  if (path === "appearance.opacity" || path.endsWith(".opacity")) return [0.15, 1];
  if (path === "transform.rotate" || path.includes("rotate") || path.includes("rotation")) return [-45, 45];
  if (path === "transform.scale" || path === "transform.scaleX" || path === "transform.scaleY") return [0.85, 1.3];
  if (path.startsWith("transform.skew")) return [-18, 18];
  const def = PROPERTY_REGISTRY[path];
  if (def?.range && typeof def.range.min === "number" && typeof def.range.max === "number") {
    const span = def.range.max - def.range.min;
    if (Number.isFinite(span) && span <= 200) {
      return [def.range.min, def.range.max];
    }
  }
  return [-120, 120];
}

function feelOperators(feel: ConnectFeel): Operator[] {
  switch (feel) {
    case "direct":
      return [];
    case "snappy":
      return [{ op: "smooth", tau: 0.06 }];
    case "gentle":
      return [{ op: "smooth", tau: 0.24 }];
    case "bouncy":
      return [{ op: "spring", spring: { bounce: 0.45, time: 0.45 } }];
  }
}

function describeSource(source: ConnectInputTarget): string {
  switch (source.kind) {
    case "cursor":
      return source.axis === "y" ? "the cursor vertically" : "the cursor across";
    case "scroll":
      return "scroll progress";
    case "key":
      return source.code ? `key ${source.code}` : "arrow keys";
    case "microphone":
      return typeof source.band === "number" ? `microphone band ${source.band}` : "the microphone";
    case "layerProp":
      return `${source.sourceLayerName ?? source.sourceLayerId}'s ${source.sourceProperty}`;
  }
}

/**
 * Unifies Phase 76 pick-whip property links with every Stage 4 signal source:
 * dragging a property handle onto Cursor, Scroll, Key, Microphone, or another
 * layer's property compiles the right mapping, blend, feel, and plain sentence.
 */
export function connectPropertyToSource(request: ConnectRequest): ConnectResult {
  const feel: ConnectFeel = request.feel ?? "gentle";
  const adverb = CONNECT_FEELS.find((f) => f.id === feel)?.adverb ?? "gently";
  const propLabel = inferPropertyLabel(request.targetPath, request.targetLabel);
  const sentence = `${propLabel} follows ${describeSource(request.source)}, ${adverb}`;
  const [outMin, outMax] = inferOutputRange(request.targetPath);

  if (request.source.kind === "layerProp") {
    const srcRange = inferOutputRange(request.source.sourceProperty);
    return {
      mode: "property-link",
      linkSlot: {
        targetPath: request.targetPath,
        sourceLayerId: request.source.sourceLayerId,
        sourceProperty: request.source.sourceProperty,
        map: "range",
        inMin: srcRange[0],
        inMax: srcRange[1],
        outMin,
        outMax,
      },
      feel,
      sentence,
    };
  }

  let signal: Signal;
  const operators: Operator[] = [];
  let inMin = 0;
  let inMax = 1;

  if (request.source.kind === "cursor") {
    signal = { kind: "pointerIn", channel: "ndc", space: "frame" };
    operators.push({ op: "component", axis: request.source.axis ?? "x" });
    inMin = -1;
    inMax = 1;
  } else if (request.source.kind === "scroll") {
    signal = { kind: "scroll", channel: "progress" };
  } else if (request.source.kind === "key") {
    if (request.source.code) {
      signal = { kind: "keyHeld", code: request.source.code };
    } else {
      signal = { kind: "keyAxis", preset: "arrows", axis: request.source.axis ?? "x" };
      inMin = -1;
      inMax = 1;
    }
  } else {
    signal =
      typeof request.source.band === "number"
        ? { kind: "audio", layer: request.targetLayerId, channel: "band", band: request.source.band }
        : { kind: "audio", layer: request.targetLayerId, channel: "level" };
  }

  operators.push({ op: "remap", inMin, inMax, outMin, outMax, clamp: true });
  operators.push(...feelOperators(feel));

  const draft = BindingDraftSchema.parse({
    expr: { signal, operators },
    target: {
      kind: "property",
      on: { kind: "layer", ref: request.targetLayerId },
      path: request.targetPath,
    },
  });

  return { mode: "binding", draft, feel, sentence };
}
