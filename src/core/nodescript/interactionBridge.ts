/**
 * @file interactionBridge.ts
 * @module core/nodescript/interactionBridge
 * @description Phase 160: Unifies the `Interaction` NodeScript namespace with
 * the canonical `BlueprintGraph` model and grammar (`Simple` rules & bindings
 * compile to/from canonical graph fragments so one validator and `.nls` text IR
 * serve both).
 */

import { ASTManager, type BlueprintGraph, type BlueprintNodeInstance, type BlueprintWire, type GraphValidationResult } from "../ast/ASTManager";
import type { Binding } from "../document/signals";
import { NodeScriptParser } from "./Parser";
import { NodeScriptSerializer } from "./Serializer";
import {
  INTERACTION_NODE_CATALOG,
  INTERACTION_NODE_MAP,
  validateInteractionGraph,
  type InteractionNodeSpec,
} from "./interactionLibrary";
import { toCanonicalNodeName, toRegistryNodeType } from "./stdlib";

export const INTERACTION_NAMESPACE = "Interaction";

/** Bidirectional registry mapping every `interaction/*` node to `Interaction.*`. */
export const INTERACTION_CANONICAL_MAP: Readonly<Record<string, string>> = Object.fromEntries(
  INTERACTION_NODE_CATALOG.map((spec) => [spec.type, spec.canonicalName]),
);

export const INTERACTION_REVERSE_MAP: Readonly<Record<string, string>> = Object.fromEntries(
  INTERACTION_NODE_CATALOG.map((spec) => [spec.canonicalName, spec.type]),
);

/** Resolves either `interaction/onHover` or `Interaction.onHover` to its `InteractionNodeSpec`. */
export function resolveInteractionNodeSpec(typeOrCanonical: string): InteractionNodeSpec | undefined {
  const direct = INTERACTION_NODE_MAP.get(typeOrCanonical);
  if (direct) return direct;
  const canonicalLookup = INTERACTION_REVERSE_MAP[typeOrCanonical] ?? toRegistryNodeType(typeOrCanonical);
  return INTERACTION_NODE_MAP.get(canonicalLookup);
}

/** Converts an `interaction/*` node type to canonical `.nls` `Interaction.*` form and back. */
export function toInteractionCanonicalName(nodeType: string): string {
  return INTERACTION_CANONICAL_MAP[nodeType] ?? toCanonicalNodeName(nodeType);
}

export interface SimpleRuleDescriptor {
  readonly id: string;
  readonly trigger: "hover" | "press" | "key" | "view" | "marker";
  readonly sourceLayerId: string;
  readonly targetLayerId: string;
  readonly propertyPath: string;
  readonly value: number | string | boolean;
  readonly keyCode?: string;
  readonly springBounce?: number;
  readonly springTimeSec?: number;
}

/**
 * Compiles a Simple rule or binding into a canonical `BlueprintGraph` fragment,
 * ensuring Simple rules and Pro Blueprints share one underlying AST and validator.
 */
export function compileSimpleRuleToGraphFragment(rule: SimpleRuleDescriptor): BlueprintGraph {
  const graph = ASTManager.createGraph(`graph_${rule.id}`, `SimpleRule_${rule.id}`, "event");

  const eventType =
    rule.trigger === "hover"
      ? "interaction/onHover"
      : rule.trigger === "key"
        ? "interaction/onKey"
        : rule.trigger === "view"
          ? "interaction/onView"
          : rule.trigger === "marker"
            ? "interaction/onMarker"
            : "interaction/onPointer";

  const useSpring = rule.springTimeSec !== undefined && typeof rule.value === "number";
  const actionType = useSpring ? "interaction/springProperty" : "interaction/setProperty";

  const evtNode: BlueprintNodeInstance = {
    id: "evt",
    type: eventType,
    title: toInteractionCanonicalName(eventType),
    position: { x: 40, y: 80 },
    customParams: {
      target: rule.sourceLayerId,
      ...(rule.keyCode ? { key: rule.keyCode } : {}),
    },
  };

  const actNode: BlueprintNodeInstance = {
    id: "act",
    type: actionType,
    title: toInteractionCanonicalName(actionType),
    position: { x: 320, y: 80 },
    customParams: {
      target: rule.targetLayerId,
      path: rule.propertyPath,
      value: rule.value,
      ...(useSpring ? { bounce: rule.springBounce ?? 0.25, time: rule.springTimeSec } : {}),
    },
  };

  graph.nodes[evtNode.id] = evtNode;
  graph.nodes[actNode.id] = actNode;
  graph.wires.push({
    id: "wire_evt_exec_act_exec",
    sourceNodeId: "evt",
    sourcePinId: "exec",
    targetNodeId: "act",
    targetPinId: "exec",
    pinType: "exec",
    isExec: true,
  });

  return graph;
}

/**
 * Compiles a continuous grammar `Binding` into a canonical `BlueprintGraph` fragment
 * so binding expressions validate and serialize alongside interactive Blueprints.
 */
export function compileBindingToGraphFragment(binding: Binding): BlueprintGraph {
  const graph = ASTManager.createGraph(`graph_${binding.id}`, `Binding_${binding.id}`, "event");
  const sigKind = binding.expr.signal.kind;
  const targetRef = binding.target.kind === "property" ? binding.target.on.ref : binding.ownerLayerId;
  const targetPath = binding.target.kind === "property" ? binding.target.path : binding.target.kind;

  graph.variables.push({
    id: "var_signal_kind",
    name: "signalKind",
    type: "string",
    defaultValue: sigKind,
    isPublic: true,
  });

  graph.nodes.evt = {
    id: "evt",
    type: "interaction/onSignalThreshold",
    title: "Interaction.onSignalThreshold",
    position: { x: 40, y: 80 },
    customParams: { signal: sigKind, crossed: true },
  };
  graph.nodes.act = {
    id: "act",
    type: "interaction/setProperty",
    title: "Interaction.setProperty",
    position: { x: 320, y: 80 },
    customParams: { target: targetRef, path: targetPath, value: 1 },
  };
  graph.wires.push({
    id: "wire_evt_exec_act_exec",
    sourceNodeId: "evt",
    sourcePinId: "exec",
    targetNodeId: "act",
    targetPinId: "exec",
    pinType: "exec",
    isExec: true,
  });

  return graph;
}

/** Validates any Simple rule / binding graph fragment using the unified Blueprint validator. */
export function validateUnifiedGraph(graph: BlueprintGraph): GraphValidationResult {
  return validateInteractionGraph(graph);
}

export interface NormalizedGraphShape {
  readonly name: string;
  readonly type: string;
  readonly variables: readonly { readonly name: string; readonly type: string; readonly defaultValue: unknown }[];
  readonly nodes: readonly { readonly id: string; readonly type: string; readonly x: number; readonly y: number; readonly params: Readonly<Record<string, unknown>> }[];
  readonly wires: readonly { readonly sourceNodeId: string; readonly sourcePinId: string; readonly targetNodeId: string; readonly targetPinId: string }[];
}

/** Canonicalizes a `BlueprintGraph` for structural `graph -> .nls -> graph` equality checks. */
export function normalizeGraphStructure(graph: BlueprintGraph): NormalizedGraphShape {
  const variables = [...graph.variables]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((v) => ({ name: v.name, type: v.type, defaultValue: v.defaultValue }));

  const nodes = Object.values(graph.nodes)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({
      id: n.id,
      type: n.type,
      x: Math.round(n.position?.x ?? 0),
      y: Math.round(n.position?.y ?? 0),
      params: Object.fromEntries(
        Object.entries(n.customParams ?? n.pinValues ?? {}).sort(([a], [b]) => a.localeCompare(b)),
      ),
    }));

  const wires = [...graph.wires]
    .sort((a: BlueprintWire, b: BlueprintWire) =>
      `${a.sourceNodeId}.${a.sourcePinId}->${a.targetNodeId}.${a.targetPinId}`.localeCompare(
        `${b.sourceNodeId}.${b.sourcePinId}->${b.targetNodeId}.${b.targetPinId}`,
      ),
    )
    .map((w) => ({
      sourceNodeId: w.sourceNodeId,
      sourcePinId: w.sourcePinId,
      targetNodeId: w.targetNodeId,
      targetPinId: w.targetPinId,
    }));

  return {
    name: graph.name,
    type: graph.type,
    variables,
    nodes,
    wires,
  };
}

/**
 * Serializes `graph` to canonical `.nls` text and parses it back into a `BlueprintGraph`.
 */
export function roundTripGraphViaNodeScript(graph: BlueprintGraph): {
  readonly nlsSource: string;
  readonly reparsed: BlueprintGraph;
} {
  const nlsSource = NodeScriptSerializer.serialize(graph, {
    includeHeader: true,
    includePositions: true,
  });
  const reparsed = NodeScriptParser.parse(nlsSource, {
    autoLayout: false,
    graphId: graph.id,
  });
  return { nlsSource, reparsed };
}
