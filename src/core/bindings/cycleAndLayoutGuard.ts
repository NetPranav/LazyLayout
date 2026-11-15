import type { Binding, BindingTarget, Condition, ExprOperator, SignalExpr, TargetSet } from "../document/signals";
import type { Diagnostic } from "./runtime";

export interface PropertyLinkEdge {
  readonly sourceLayerId: string;
  readonly sourcePath: string;
  readonly targetLayerId: string;
  readonly targetPath: string;
}

export interface LayoutAwareLayer {
  readonly id?: string;
  readonly parentId?: string | null;
  readonly properties?: Readonly<Record<string, unknown>>;
}

/**
 * Phase 139 (v4.1 carve-out): checks whether a layer (or an ancestor box) is
 * layout-isolated with a fixed outer box (`layout.isolated === true` or
 * `layout.contain === "layout size"` / `"strict"`), allowing continuous
 * layout-property bindings inside it without moving anything outside.
 */
export function isLayerLayoutIsolated(
  layerId: string,
  layers: Readonly<Record<string, LayoutAwareLayer>>
): boolean {
  let cursor: string | null | undefined = layerId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const layer = layers[cursor];
    if (!layer) break;
    const props = layer.properties ?? {};
    const contain = props["layout.contain"];
    if (
      props["layout.isolated"] === true ||
      contain === "layout size" ||
      contain === "strict"
    ) {
      return true;
    }
    cursor = layer.parentId ?? undefined;
  }
  return false;
}

/** Reads Phase 76 `link.1..8.*` edges from document layer property bags. */
export function extractLayerLinks(
  layers: Readonly<Record<string, { readonly properties?: Readonly<Record<string, unknown>> }>>
): PropertyLinkEdge[] {
  const edges: PropertyLinkEdge[] = [];
  for (const [targetLayerId, layer] of Object.entries(layers)) {
    const props = layer.properties;
    if (!props) continue;
    for (let slot = 1; slot <= 8; slot++) {
      const enabled = props[`link.${slot}.enabled`];
      if (enabled === false) continue;
      const targetPath = props[`link.${slot}.target`];
      const sourceLayerId = props[`link.${slot}.source`];
      const sourcePath = props[`link.${slot}.sourceProperty`];
      if (
        typeof targetPath === "string" &&
        targetPath.length > 0 &&
        typeof sourceLayerId === "string" &&
        sourceLayerId.length > 0 &&
        typeof sourcePath === "string" &&
        sourcePath.length > 0
      ) {
        edges.push({ sourceLayerId, sourcePath, targetLayerId, targetPath });
      }
    }
  }
  return edges;
}

function collectExprReads(
  expr: SignalExpr,
  ownerLayerId: string,
  out: Set<string>,
  targetResolver: (on: TargetSet) => readonly string[]
): void {
  const sig = expr.signal;
  if (sig.kind === "prop") {
    out.add(`prop:${ownerLayerId}:${sig.name}`);
  } else if (sig.kind === "var") {
    out.add(`var:${sig.name}`);
  } else if (sig.kind === "sm") {
    out.add(`sm:${ownerLayerId}:${sig.input}`);
  }

  for (const op of expr.operators as readonly ExprOperator[]) {
    if (op.op === "mix") {
      collectExprReads(op.with, ownerLayerId, out, targetResolver);
    } else if (op.op === "select") {
      collectExprReads(op.whenTrue, ownerLayerId, out, targetResolver);
      collectExprReads(op.whenFalse, ownerLayerId, out, targetResolver);
    } else if (op.op === "sampleHold") {
      collectExprReads(op.trigger, ownerLayerId, out, targetResolver);
    }
  }
}

function collectGuardReads(
  conditions: readonly Condition[],
  ownerLayerId: string,
  out: Set<string>,
  targetResolver: (on: TargetSet) => readonly string[]
): void {
  for (const c of conditions) {
    if (c.kind === "compare") {
      collectExprReads(c.expr, ownerLayerId, out, targetResolver);
    }
  }
}

function resolveTargetNodes(
  target: BindingTarget,
  resolveLayers: (on: TargetSet) => readonly string[]
): string[] {
  switch (target.kind) {
    case "property":
      return resolveLayers(target.on).map((id) => `prop:${id}:${target.path}`);
    case "input":
      return resolveLayers(target.on).map((id) => `sm:${id}:${target.name}`);
    case "cssvar":
      return resolveLayers(target.on).map((id) => `cssvar:${id}:${target.name}`);
    case "position":
      return resolveLayers(target.on).map((id) => `position:${id}:${target.pin}`);
    case "uniform":
      return resolveLayers(target.on).map((id) => `uniform:${id}:${target.name}`);
    case "param":
      return resolveLayers(target.on).map((id) => `param:${id}:${target.name}`);
    case "event":
      return [`event:${target.name}`];
  }
}

export interface CycleReport {
  readonly ok: boolean;
  readonly cyclicBindingIds: ReadonlySet<string>;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Unifies Phase 76 property links and Phase 139 signal bindings into one
 * directed dependency graph (`targetNode` depends on `sourceNode`) and rejects
 * any cycle with `[SIGNAL_CYCLE]` plus the exact chain.
 */
export function detectSignalAndLinkCycles(options: {
  readonly bindings: readonly Binding[];
  readonly links?: readonly PropertyLinkEdge[];
  readonly layers?: Readonly<Record<string, { readonly properties?: Readonly<Record<string, unknown>> }>>;
  readonly resolveLayers?: (on: TargetSet) => readonly string[];
}): CycleReport {
  const resolveLayers =
    options.resolveLayers ??
    ((on: TargetSet) => (on.kind === "layer" || on.kind === "group" ? [on.ref] : [on.tag]));

  // adjacency: targetNode -> Array<{ dep: string; bindingId?: string }>
  const graph = new Map<string, { dep: string; bindingId?: string }[]>();
  const addEdge = (target: string, dep: string, bindingId?: string) => {
    const list = graph.get(target) ?? [];
    list.push({ dep, bindingId });
    graph.set(target, list);
  };

  const links = [...(options.links ?? []), ...(options.layers ? extractLayerLinks(options.layers) : [])];
  for (const link of links) {
    addEdge(`prop:${link.targetLayerId}:${link.targetPath}`, `prop:${link.sourceLayerId}:${link.sourcePath}`);
  }

  for (const binding of options.bindings) {
    if (!binding.enabled) continue;
    const reads = new Set<string>();
    collectExprReads(binding.expr, binding.ownerLayerId, reads, resolveLayers);
    if (binding.guard) {
      collectGuardReads(binding.guard.conditions, binding.ownerLayerId, reads, resolveLayers);
    }
    const writes = resolveTargetNodes(binding.target, resolveLayers);
    for (const w of writes) {
      for (const r of reads) {
        addEdge(w, r, binding.id);
      }
    }
  }

  const state = new Map<string, 1 | 2>(); // 1 = visiting, 2 = visited
  const stack: { node: string; bindingId?: string }[] = [];
  const cyclicBindingIds = new Set<string>();
  const diagnostics: Diagnostic[] = [];
  const reportedChains = new Set<string>();

  const dfs = (node: string) => {
    state.set(node, 1);
    for (const edge of graph.get(node) ?? []) {
      const nextState = state.get(edge.dep);
      if (nextState === 1) {
        const startIdx = stack.findIndex((entry) => entry.node === edge.dep);
        const segment = startIdx >= 0 ? stack.slice(startIdx) : [...stack];
        const chainNodes = [...segment.map((s) => s.node), edge.dep];
        const key = chainNodes.join(" -> ");
        if (!reportedChains.has(key)) {
          reportedChains.add(key);
          const involvedBindings = [
            ...segment.map((s) => s.bindingId).filter((id): id is string => Boolean(id)),
            ...(edge.bindingId ? [edge.bindingId] : []),
          ];
          for (const id of involvedBindings) {
            cyclicBindingIds.add(id);
          }
          const primaryBindingId = involvedBindings[0] ?? "link-cycle";
          diagnostics.push({
            bindingId: primaryBindingId,
            code: "SIGNAL_CYCLE",
            message: `[SIGNAL_CYCLE] Dependency cycle detected across links/bindings: ${key}`,
          });
        }
      } else if (!nextState) {
        stack.push({ node: edge.dep, bindingId: edge.bindingId });
        dfs(edge.dep);
        stack.pop();
      }
    }
    state.set(node, 2);
  };

  for (const node of graph.keys()) {
    if (!state.get(node)) {
      stack.push({ node });
      dfs(node);
      stack.pop();
    }
  }

  return {
    ok: diagnostics.length === 0,
    cyclicBindingIds,
    diagnostics,
  };
}

/** Guards non-finite (`NaN`/`Infinity`) binding outputs with a clean fallback. */
export function guardFiniteBindingValue(
  bindingId: string,
  raw: number,
  fallback = 0
): { readonly value: number; readonly diagnostic: Diagnostic | null } {
  if (Number.isFinite(raw)) {
    return { value: raw, diagnostic: null };
  }
  return {
    value: fallback,
    diagnostic: {
      bindingId,
      code: "SIGNAL_NAN_GUARD",
      message: `[SIGNAL_NAN_GUARD] Non-finite binding result (${String(raw)}) replaced with fallback ${fallback}.`,
    },
  };
}
