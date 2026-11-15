/**
 * @file blueprintDebugger.ts
 * @module core/nodescript/blueprintDebugger
 * @description Phase 168: Blueprint graph editor operations (pin-aware node search,
 * comment boxes, reroute nodes, collapse-to-function, variables panel CRUD, bidirectional
 * Simple rule <-> Graph conversion) and Preview debugger (wire pulses, breakpoints,
 * pin watches, event log, transport step-through).
 */

import {
  ASTManager,
  type BlueprintGraph,
  type BlueprintNodeInstance,
  type BlueprintVariable,
  type BlueprintWire,
} from "../ast/ASTManager";
import type { PinDataType } from "../types/node-registry";
import { INTERACTION_NODE_CATALOG, type InteractionNodeSpec } from "./interactionLibrary";
import {
  compileSimpleRuleToBlueprint,
  type SimpleRuleEntry,
  type SimpleRuleEventKind,
} from "./simpleRulesEditor";
import {
  createBlueprintRuntime,
  type BlueprintRuntimeSnapshot,
  type RuntimeEventInput,
} from "./blueprintRuntime";

export interface GraphCommentBox {
  readonly id: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly nodeIds: readonly string[];
}

export interface BlueprintEditorState {
  readonly activeGraphId: string;
  readonly graphs: Readonly<Record<string, BlueprintGraph>>;
  readonly comments: Readonly<Record<string, readonly GraphCommentBox[]>>;
}

/** Pin-aware search: finds catalog nodes matching query AND compatible with dragged pin direction/type. */
export function searchNodesForPin(
  query: string,
  filter?: {
    readonly requiredPinDirection?: "input" | "output";
    readonly requiredPinType?: PinDataType;
  }
): readonly InteractionNodeSpec[] {
  const q = query.trim().toLowerCase();
  return INTERACTION_NODE_CATALOG.filter((spec) => {
    const textMatch =
      !q ||
      spec.canonicalName.toLowerCase().includes(q) ||
      spec.type.toLowerCase().includes(q) ||
      spec.group.toLowerCase().includes(q);
    if (!textMatch) return false;
    if (!filter?.requiredPinDirection && !filter?.requiredPinType) return true;
    return spec.pins.some((pin) => {
      if (filter.requiredPinDirection && pin.direction !== filter.requiredPinDirection) {
        return false;
      }
      if (
        filter.requiredPinType &&
        pin.type !== filter.requiredPinType &&
        pin.type !== "any" &&
        filter.requiredPinType !== "any"
      ) {
        return false;
      }
      return true;
    });
  });
}

export function addCommentBox(
  state: BlueprintEditorState,
  graphId: string,
  box: GraphCommentBox
): BlueprintEditorState {
  const prev = state.comments[graphId] ?? [];
  return {
    ...state,
    comments: {
      ...state.comments,
      [graphId]: [...prev.filter((c) => c.id !== box.id), box],
    },
  };
}

/** Insert a reroute node splitting an existing wire into two clean segments. */
export function insertRerouteOnWire(
  graph: BlueprintGraph,
  wireId: string,
  rerouteId: string,
  position: { readonly x: number; readonly y: number }
): BlueprintGraph {
  const wire = graph.wires.find((w) => w.id === wireId);
  if (!wire) return graph;

  const rerouteNode: BlueprintNodeInstance = {
    id: rerouteId,
    type: "interaction/reroute",
    title: "Reroute",
    position: { x: position.x, y: position.y },
    customParams: { pinType: wire.pinType },
  };

  const remainingWires = graph.wires.filter((w) => w.id !== wireId);
  const segA: BlueprintWire = {
    id: `${wireId}_in`,
    sourceNodeId: wire.sourceNodeId,
    sourcePinId: wire.sourcePinId,
    targetNodeId: rerouteId,
    targetPinId: wire.isExec ? "exec" : "in",
    pinType: wire.pinType,
    isExec: wire.isExec,
  };
  const segB: BlueprintWire = {
    id: `${wireId}_out`,
    sourceNodeId: rerouteId,
    sourcePinId: wire.isExec ? "exec" : "out",
    targetNodeId: wire.targetNodeId,
    targetPinId: wire.targetPinId,
    pinType: wire.pinType,
    isExec: wire.isExec,
  };

  return {
    ...graph,
    nodes: { ...graph.nodes, [rerouteId]: rerouteNode },
    wires: [...remainingWires, segA, segB],
  };
}

export function upsertGraphVariable(
  graph: BlueprintGraph,
  variable: BlueprintVariable
): BlueprintGraph {
  const next = [...graph.variables.filter((v) => v.id !== variable.id), variable];
  return { ...graph, variables: next };
}

export function removeGraphVariable(graph: BlueprintGraph, varId: string): BlueprintGraph {
  return { ...graph, variables: graph.variables.filter((v) => v.id !== varId) };
}

/**
 * Collapse a non-empty subset of non-event nodes into a reusable `function` graph,
 * replacing them in the parent graph with a single `callFunction` node.
 */
export function collapseSelectionToFunction(
  state: BlueprintEditorState,
  sourceGraphId: string,
  selectedNodeIds: readonly string[],
  functionName: string
): {
  readonly state: BlueprintEditorState;
  readonly functionGraphId: string;
  readonly callNodeId: string;
} {
  const srcGraph = state.graphs[sourceGraphId];
  if (!srcGraph) {
    throw new Error(`Graph "${sourceGraphId}" not found.`);
  }
  const selectedSet = new Set(selectedNodeIds);
  if (selectedSet.size === 0) {
    throw new Error("Collapse requires at least one selected node.");
  }

  const safeName = functionName.replace(/[^A-Za-z0-9_]/g, "_");
  const fnGraphId = `fn_${safeName}`;
  const callNodeId = `call_${safeName}`;
  const fnNodes: Record<string, BlueprintNodeInstance> = {};
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const id of selectedSet) {
    const n = srcGraph.nodes[id];
    if (n) {
      fnNodes[id] = n;
      sumX += n.position.x;
      sumY += n.position.y;
      count++;
    }
  }

  const internalWires = srcGraph.wires.filter(
    (w) => selectedSet.has(w.sourceNodeId) && selectedSet.has(w.targetNodeId)
  );
  const incomingWires = srcGraph.wires.filter(
    (w) => !selectedSet.has(w.sourceNodeId) && selectedSet.has(w.targetNodeId)
  );
  const outgoingWires = srcGraph.wires.filter(
    (w) => selectedSet.has(w.sourceNodeId) && !selectedSet.has(w.targetNodeId)
  );
  const untouchedWires = srcGraph.wires.filter(
    (w) => !selectedSet.has(w.sourceNodeId) && !selectedSet.has(w.targetNodeId)
  );

  const callNode: BlueprintNodeInstance = {
    id: callNodeId,
    type: "interaction/callFunction",
    title: functionName,
    position: {
      x: Math.round(sumX / Math.max(1, count)),
      y: Math.round(sumY / Math.max(1, count)),
    },
    customParams: { functionGraphId: fnGraphId, functionName },
  };

  const nextNodes: Record<string, BlueprintNodeInstance> = { [callNodeId]: callNode };
  for (const [id, node] of Object.entries(srcGraph.nodes)) {
    if (!selectedSet.has(id)) {
      nextNodes[id] = node;
    }
  }

  const rewiredIn: BlueprintWire[] = incomingWires.map((w, i) => ({
    ...w,
    id: `${w.id}_call_in_${i}`,
    targetNodeId: callNodeId,
    targetPinId: "exec",
  }));
  const rewiredOut: BlueprintWire[] = outgoingWires.map((w, i) => ({
    ...w,
    id: `${w.id}_call_out_${i}`,
    sourceNodeId: callNodeId,
    sourcePinId: "exec",
  }));

  const updatedSrc: BlueprintGraph = {
    ...srcGraph,
    nodes: nextNodes,
    wires: [...untouchedWires, ...rewiredIn, ...rewiredOut],
  };

  const fnGraph: BlueprintGraph = {
    ...ASTManager.createGraph(fnGraphId, functionName, "function"),
    nodes: fnNodes,
    wires: internalWires,
  };

  return {
    functionGraphId: fnGraphId,
    callNodeId,
    state: {
      ...state,
      graphs: {
        ...state.graphs,
        [sourceGraphId]: updatedSrc,
        [fnGraphId]: fnGraph,
      },
    },
  };
}

/** Open any Simple rule as a Pro Blueprint graph and attempt reverse recovery back to Simple. */
export function openSimpleRuleAsGraph(rule: SimpleRuleEntry): BlueprintGraph {
  const compiled = compileSimpleRuleToBlueprint(rule);
  return {
    ...compiled,
    metadata: {
      schemaVersion: ASTManager.SCHEMA_VERSION,
      description: `simple_rule:${rule.id}:${rule.event}`,
    },
  };
}

export function tryConvertGraphToSimpleRule(graph: BlueprintGraph): SimpleRuleEntry | null {
  const nodes = Object.values(graph.nodes);
  const evtNode = nodes.find((n) => n.type.startsWith("interaction/on"));
  const actionNodes = nodes.filter(
    (n) => !n.type.startsWith("interaction/on") && n.type !== "interaction/reroute"
  );
  if (!evtNode || actionNodes.length === 0) return null;

  const eventMap: Readonly<Record<string, SimpleRuleEventKind>> = {
    "interaction/onHover": "hovered",
    "interaction/onPointer": "clicked",
    "interaction/onDrag": "dragged",
    "interaction/onView": "viewed",
    "interaction/onKey": "key_pressed",
    "interaction/onCollider": "overlaps",
  };
  const event = eventMap[evtNode.type] ?? "clicked";
  const subjectLayerId = String(evtNode.customParams?.target ?? "layer");

  return {
    id: graph.id.replace(/^simple_/, ""),
    event,
    subjectLayerId,
    actions: actionNodes.map((n) => {
      const prop = String(n.customParams?.property ?? "");
      const kind =
        n.type === "interaction/spawnParticles"
          ? "confetti"
          : prop === "transform.rotateY"
            ? "flip"
            : prop === "effects.glow"
              ? "glow"
              : "move_to";
      return {
        kind,
        targetLayerId: String(n.customParams?.target ?? subjectLayerId),
      };
    }),
    feel: "snappy",
    intensity: "medium",
    enabled: true,
  };
}

export interface WirePulseState {
  readonly wireId: string;
  readonly intensity: number;
  readonly lastFiredFrame: number;
}

export interface DebuggerEventLogItem {
  readonly frame: number;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly viaPin: string;
}

export interface BlueprintDebugSession {
  addBreakpoint(nodeId: string): void;
  removeBreakpoint(nodeId: string): void;
  addWatch(label: string, propertyKey: string): void;
  enqueueEvent(evt: RuntimeEventInput): void;
  stepFrame(dtSec?: number): BlueprintRuntimeSnapshot;
  continueExecution(dtSec?: number): BlueprintRuntimeSnapshot;
  isPausedOnBreakpoint(): string | null;
  getWirePulses(): readonly WirePulseState[];
  getWatches(): Readonly<Record<string, unknown>>;
  getEventLog(): readonly DebuggerEventLogItem[];
  reset(): void;
}

/** Preview-integrated Blueprint debugger tracking wire pulses, breakpoints, watches, and single-step transport. */
export function createBlueprintDebugSession(graphs: readonly BlueprintGraph[]): BlueprintDebugSession {
  const runtime = createBlueprintRuntime(graphs);
  const breakpoints = new Set<string>();
  const watches = new Map<string, string>();
  const wireLastFired = new Map<string, number>();
  let pausedAtNodeId: string | null = null;
  let lastSnapshot: BlueprintRuntimeSnapshot = runtime.snapshot();

  return {
    addBreakpoint(nodeId: string): void {
      breakpoints.add(nodeId);
    },

    removeBreakpoint(nodeId: string): void {
      breakpoints.delete(nodeId);
    },

    addWatch(label: string, propertyKey: string): void {
      watches.set(label, propertyKey);
    },

    enqueueEvent(evt: RuntimeEventInput): void {
      runtime.enqueueEvent(evt);
    },

    stepFrame(dtSec = 1 / 60): BlueprintRuntimeSnapshot {
      const prevTraceCount = lastSnapshot.traceLog.length;
      pausedAtNodeId = null;
      lastSnapshot = runtime.step(dtSec);

      const newlyTraced = lastSnapshot.traceLog.slice(prevTraceCount);
      for (const entry of newlyTraced) {
        for (const g of graphs) {
          for (const w of g.wires) {
            if (w.targetNodeId === entry.nodeId || w.sourceNodeId === entry.nodeId) {
              wireLastFired.set(w.id, lastSnapshot.frame);
            }
          }
        }
        if (breakpoints.has(entry.nodeId)) {
          pausedAtNodeId = entry.nodeId;
        }
      }
      return lastSnapshot;
    },

    continueExecution(dtSec = 1 / 60): BlueprintRuntimeSnapshot {
      pausedAtNodeId = null;
      return this.stepFrame(dtSec);
    },

    isPausedOnBreakpoint(): string | null {
      return pausedAtNodeId;
    },

    getWirePulses(): readonly WirePulseState[] {
      const pulses: WirePulseState[] = [];
      for (const [wireId, frameFired] of wireLastFired.entries()) {
        const age = Math.max(0, lastSnapshot.frame - frameFired);
        const intensity = Math.max(0, 1 - age * 0.15);
        if (intensity > 0) {
          pulses.push({ wireId, intensity, lastFiredFrame: frameFired });
        }
      }
      return pulses.sort((a, b) => a.wireId.localeCompare(b.wireId));
    },

    getWatches(): Readonly<Record<string, unknown>> {
      const out: Record<string, unknown> = {};
      for (const [label, key] of watches.entries()) {
        out[label] = lastSnapshot.properties[key] ?? lastSnapshot.variables[key];
      }
      return out;
    },

    getEventLog(): readonly DebuggerEventLogItem[] {
      return lastSnapshot.traceLog.map((t) => ({
        frame: t.frame,
        nodeId: t.nodeId,
        nodeType: t.nodeType,
        viaPin: t.viaPin,
      }));
    },

    reset(): void {
      pausedAtNodeId = null;
      wireLastFired.clear();
      runtime.reset();
      lastSnapshot = runtime.snapshot();
    },
  };
}
