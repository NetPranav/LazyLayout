/**
 * Collects and clones layer-associated document entities (states, behaviours, transitions,
 * surfaces, effect instances, bindings, interaction graphs, sequences, assets, styles, variables)
 * so pasted designs preserve animations, interactive rules, effects, and tokens across windows.
 */

import { createUniqueId } from "../ids";
import { bindingLayerRefs, type Binding, type SignalExpr } from "../document/signals";
import { LAYER_PARAMS, type InteractionGraph } from "../document/graph";
import type { Behaviour, LayerState, Sequence, Transition } from "../document/motion";
import type { EffectInstance, Surface } from "../document/effects";
import type { AssetEntry, Layer, MotionDocument, StyleEntry, VariableEntry } from "../document/schema";
import type { ClipPayload } from "./clipboard";

export interface InsertLayerExtras {
  states?: LayerState[];
  behaviours?: Behaviour[];
  transitions?: Transition[];
  surfaces?: Surface[];
  effects?: EffectInstance[];
  bindings?: Binding[];
  graphs?: InteractionGraph[];
  sequences?: Sequence[];
  assets?: Record<string, AssetEntry>;
  variables?: Record<string, VariableEntry>;
  styles?: Record<string, StyleEntry>;
}

const ASSET_REF_RE = /asset:([0-9a-f]{64})/gi;

function collectAssetIds(layers: readonly Layer[]): Set<string> {
  const ids = new Set<string>();
  const scanValue = (val: unknown) => {
    if (typeof val !== "string" || !val.includes("asset:")) return;
    ASSET_REF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ASSET_REF_RE.exec(val)) !== null) ids.add(m[1].toLowerCase());
  };
  for (const layer of layers) {
    scanValue(layer.properties["media.src"]);
    scanValue(layer.properties["paint.fills"]);
    for (const over of Object.values(layer.overrides ?? {})) {
      scanValue(over["media.src"]);
      scanValue(over["paint.fills"]);
    }
  }
  return ids;
}

function collectStylesAndVariables(
  doc: MotionDocument,
  layers: readonly Layer[],
): { styles?: Record<string, StyleEntry>; variables?: Record<string, VariableEntry> } {
  const styles: Record<string, StyleEntry> = {};
  const varIds = new Set<string>();
  for (const layer of layers) {
    for (const ref of Object.values(layer.styleRefs ?? {})) {
      if (ref && doc.styles?.[ref] && !styles[ref]) {
        const s = structuredClone(doc.styles[ref]);
        styles[ref] = s;
        for (const vid of Object.values(s.bound ?? {})) varIds.add(vid);
      }
    }
    for (const tok of Object.values(layer.tokens ?? {})) {
      if (tok.variable) varIds.add(tok.variable);
    }
  }
  const variables: Record<string, VariableEntry> = {};
  const queue = Array.from(varIds);
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (variables[id] || !doc.variables?.[id]) continue;
    const entry = structuredClone(doc.variables[id]);
    variables[id] = entry;
    for (const v of Object.values(entry.values)) {
      if (v && typeof v === "object" && "alias" in v && typeof v.alias === "string") {
        queue.push(v.alias);
      }
    }
  }
  return {
    ...(Object.keys(styles).length > 0 ? { styles } : {}),
    ...(Object.keys(variables).length > 0 ? { variables } : {}),
  };
}

/** Collects all portable dependent records for a copied layer + clip selection. */
export function collectClipboardExtras(
  doc: MotionDocument,
  includeLayers: ReadonlySet<string>,
  copiedLayers: readonly Layer[],
  includeClips: ReadonlySet<string>,
): InsertLayerExtras {
  const states = Object.values(doc.states).filter((s) => includeLayers.has(s.layerId)).map((s) => structuredClone(s));
  const behaviours = Object.values(doc.behaviours).filter((b) => includeLayers.has(b.layerId)).map((b) => structuredClone(b));
  const transitions = Object.values(doc.transitions).filter((t) => includeLayers.has(t.layerId)).map((t) => structuredClone(t));
  const surfaces = Object.values(doc.surfaces).filter((s) => includeLayers.has(s.layerId)).map((s) => structuredClone(s));
  const effects = Object.values(doc.effects).filter((e) => includeLayers.has(e.layerId)).map((e) => structuredClone(e));
  const bindings = Object.values(doc.bindings)
    .filter((b) => includeLayers.has(b.ownerLayerId))
    .map((b) => structuredClone(b));
  const graphs = Object.values(doc.graphs)
    .filter((g) => g.ownerLayerId !== null && includeLayers.has(g.ownerLayerId))
    .map((g) => structuredClone(g));
  const sequences = Object.values(doc.sequences)
    .filter((seq) => seq.items.length > 0 && seq.items.every((item) => includeClips.has(item.clipId)))
    .map((seq) => structuredClone(seq));

  const assets: Record<string, AssetEntry> = {};
  for (const id of collectAssetIds(copiedLayers)) {
    if (doc.assets?.[id]) assets[id] = structuredClone(doc.assets[id]);
  }
  const { styles, variables } = collectStylesAndVariables(doc, copiedLayers);

  return {
    ...(states.length > 0 ? { states } : {}),
    ...(behaviours.length > 0 ? { behaviours } : {}),
    ...(transitions.length > 0 ? { transitions } : {}),
    ...(surfaces.length > 0 ? { surfaces } : {}),
    ...(effects.length > 0 ? { effects } : {}),
    ...(bindings.length > 0 ? { bindings } : {}),
    ...(graphs.length > 0 ? { graphs } : {}),
    ...(sequences.length > 0 ? { sequences } : {}),
    ...(Object.keys(assets).length > 0 ? { assets } : {}),
    ...(variables ? { variables } : {}),
    ...(styles ? { styles } : {}),
  };
}

function remapSignalExprRefs(expr: SignalExpr, remap: (ref: string) => string): SignalExpr {
  const signal = "layer" in expr.signal ? { ...expr.signal, layer: remap(expr.signal.layer) } : expr.signal;
  const operators = expr.operators.map((op) => {
    if (op.op === "sampleHold") return { ...op, trigger: remapSignalExprRefs(op.trigger, remap) };
    if (op.op === "mix") return { ...op, with: remapSignalExprRefs(op.with, remap) };
    if (op.op === "distance" || op.op === "angleTo") return { ...op, to: remapSignalExprRefs(op.to, remap) };
    if (op.op === "select") {
      return { ...op, whenTrue: remapSignalExprRefs(op.whenTrue, remap), whenFalse: remapSignalExprRefs(op.whenFalse, remap) };
    }
    return op;
  });
  return { signal, operators };
}

function cloneBinding(
  b: Binding,
  idMap: Map<string, string>,
  doc: MotionDocument,
  usedIds: Set<string>,
): Binding | null {
  const ownerLayerId = idMap.get(b.ownerLayerId);
  if (!ownerLayerId) return null;
  const copiedLayerIds = new Set(idMap.values());
  const remapRef = (ref: string): string => (ref === "self" || ref === "parent" ? ref : idMap.get(ref) ?? ref);
  const canResolve = (ref: string): boolean => {
    if (ref === "self" || ref === "parent") return true;
    return copiedLayerIds.has(ref) || Boolean(doc.layers[ref]);
  };

  const cloned = structuredClone(b);
  cloned.id = createUniqueId("bind", usedIds);
  usedIds.add(cloned.id);
  cloned.ownerLayerId = ownerLayerId;
  cloned.expr = remapSignalExprRefs(cloned.expr, remapRef);
  if (cloned.guard) {
    cloned.guard = {
      ...cloned.guard,
      conditions: cloned.guard.conditions.map((c) =>
        c.kind === "compare" ? { ...c, expr: remapSignalExprRefs(c.expr, remapRef) } : c,
      ),
    };
  }
  if ("on" in cloned.target && (cloned.target.on.kind === "layer" || cloned.target.on.kind === "group")) {
    cloned.target = { ...cloned.target, on: { ...cloned.target.on, ref: remapRef(cloned.target.on.ref) } };
  }
  if (!bindingLayerRefs(cloned).every((r) => canResolve(r.ref))) return null;
  return cloned;
}

/** Clones and re-ids all portable extras from `payload` for insertion into `doc`. */
export function cloneClipboardExtras(
  payload: ClipPayload,
  doc: MotionDocument,
  idMap: Map<string, string>,
  clipIdMap: Map<string, string>,
): InsertLayerExtras {
  const extras: InsertLayerExtras = {};
  const stateIdMap = new Map<string, string>();
  const stateIds = new Set(Object.keys(doc.states));
  const copiedLayerIds = new Set(idMap.values());

  if (payload.states?.length) {
    extras.states = payload.states
      .filter((s) => idMap.has(s.layerId))
      .map((s) => {
        const id = createUniqueId("state", stateIds);
        stateIds.add(id);
        stateIdMap.set(s.id, id);
        return { ...structuredClone(s), id, layerId: idMap.get(s.layerId)! };
      });
  }

  if (payload.behaviours?.length) {
    const used = new Set(Object.keys(doc.behaviours));
    extras.behaviours = payload.behaviours
      .filter((b) => idMap.has(b.layerId))
      .map((b) => {
        const id = createUniqueId("beh", used);
        used.add(id);
        return { ...structuredClone(b), id, layerId: idMap.get(b.layerId)! };
      });
  }

  if (payload.transitions?.length) {
    const used = new Set(Object.keys(doc.transitions));
    extras.transitions = payload.transitions
      .filter((t) => idMap.has(t.layerId) && (t.from === "*" || stateIdMap.has(t.from)) && (t.to === "*" || stateIdMap.has(t.to)))
      .map((t) => {
        const id = createUniqueId("tr", used);
        used.add(id);
        return {
          ...structuredClone(t),
          id,
          layerId: idMap.get(t.layerId)!,
          from: t.from === "*" ? "*" : stateIdMap.get(t.from)!,
          to: t.to === "*" ? "*" : stateIdMap.get(t.to)!,
        };
      });
  }

  if (payload.surfaces?.length) {
    const used = new Set(Object.keys(doc.surfaces));
    extras.surfaces = payload.surfaces
      .filter((s) => idMap.has(s.layerId))
      .map((s) => {
        const id = createUniqueId("surf", used);
        used.add(id);
        return { ...structuredClone(s), id, layerId: idMap.get(s.layerId)! };
      });
  }

  if (payload.effects?.length) {
    const used = new Set(Object.keys(doc.effects));
    extras.effects = payload.effects
      .filter((e) => idMap.has(e.layerId))
      .map((e) => {
        const id = createUniqueId("fx", used);
        used.add(id);
        return { ...structuredClone(e), id, layerId: idMap.get(e.layerId)! };
      });
  }

  if (payload.bindings?.length) {
    const used = new Set(Object.keys(doc.bindings));
    const list = payload.bindings.map((b) => cloneBinding(b, idMap, doc, used)).filter((b): b is Binding => b !== null);
    if (list.length > 0) extras.bindings = list;
  }

  if (payload.graphs?.length) {
    const used = new Set(Object.keys(doc.graphs));
    const list: InteractionGraph[] = [];
    for (const g of payload.graphs) {
      if (!g.ownerLayerId || !idMap.has(g.ownerLayerId)) continue;
      const cloned = structuredClone(g);
      cloned.id = createUniqueId("graph", used);
      used.add(cloned.id);
      cloned.ownerLayerId = idMap.get(g.ownerLayerId)!;
      let valid = true;
      for (const node of cloned.nodes) {
        for (const param of LAYER_PARAMS) {
          const val = node.params[param];
          if (typeof val !== "string" || val === "self") continue;
          const mapped = idMap.get(val) ?? val;
          if (!copiedLayerIds.has(mapped) && !doc.layers[mapped]) {
            valid = false;
            break;
          }
          node.params[param] = mapped;
        }
        if (!valid) break;
      }
      if (valid) list.push(cloned);
    }
    if (list.length > 0) extras.graphs = list;
  }

  if (payload.sequences?.length) {
    const used = new Set(Object.keys(doc.sequences));
    const list = payload.sequences
      .filter((seq) => seq.items.every((item) => clipIdMap.has(item.clipId)))
      .map((seq) => {
        const id = createUniqueId("seq", used);
        used.add(id);
        return {
          ...structuredClone(seq),
          id,
          items: seq.items.map((item) => ({ ...item, clipId: clipIdMap.get(item.clipId)! })),
        };
      });
    if (list.length > 0) extras.sequences = list;
  }

  if (payload.assets) extras.assets = structuredClone(payload.assets);
  if (payload.variables) extras.variables = structuredClone(payload.variables);
  if (payload.styles) extras.styles = structuredClone(payload.styles);
  return extras;
}
