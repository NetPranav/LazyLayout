/**
 * @file blueprintRuntime.ts
 * @module core/nodescript/blueprintRuntime
 * @description Phase 161: Deterministic Blueprint execution engine for Preview and
 * Playground: input-phase event queue, resumable/cancellable latent continuations,
 * per-frame node execution budget & loop guards, and deterministic tape replay.
 */

import type { BlueprintGraph, BlueprintNodeInstance, BlueprintWire } from "../ast/ASTManager";

export interface RuntimeEventInput {
  readonly eventType: string;
  readonly target?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface LatentContinuation {
  readonly continuationId: string;
  readonly graphId: string;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly nextExecPin: string;
  readonly remainingSec: number;
  readonly totalSec: number;
  readonly target?: string;
  readonly path?: string;
  readonly startValue?: number;
  readonly targetValue?: number;
  readonly cancelled: boolean;
}

export interface EmittedRuntimeAction {
  readonly frame: number;
  readonly timeSec: number;
  readonly graphId: string;
  readonly nodeId: string;
  readonly actionType: string;
  readonly params: Readonly<Record<string, unknown>>;
}

export interface RuntimeTraceEntry {
  readonly frame: number;
  readonly graphId: string;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly viaPin: string;
}

export interface BlueprintRuntimeSnapshot {
  readonly frame: number;
  readonly timeSec: number;
  readonly variables: Readonly<Record<string, unknown>>;
  readonly properties: Readonly<Record<string, number | string | boolean>>;
  readonly visibility: Readonly<Record<string, boolean>>;
  readonly stateMachines: Readonly<Record<string, string>>;
  readonly activeContinuations: readonly LatentContinuation[];
  readonly emittedActions: readonly EmittedRuntimeAction[];
  readonly traceLog: readonly RuntimeTraceEntry[];
  readonly budgetExceededCount: number;
}

export interface BlueprintRuntimeOptions {
  readonly maxNodesPerFrame?: number;
  readonly maxLoopIterations?: number;
}

export interface BlueprintRuntime {
  enqueueEvent(event: RuntimeEventInput): void;
  cancelContinuation(continuationId: string): boolean;
  cancelNodeContinuations(nodeId: string): number;
  stepFrame(dtSec: number): BlueprintRuntimeSnapshot;
  snapshot(): BlueprintRuntimeSnapshot;
  reset(): void;
}

const EVENT_TYPE_ALIASES: Readonly<Record<string, string>> = {
  "interaction/onPointer": "pointer",
  "Interaction.onPointer": "pointer",
  "interaction/onHover": "hover",
  "Interaction.onHover": "hover",
  "interaction/onFocus": "focus",
  "Interaction.onFocus": "focus",
  "interaction/onKey": "key",
  "Interaction.onKey": "key",
  "interaction/onDrag": "drag",
  "Interaction.onDrag": "drag",
  "interaction/onView": "view",
  "Interaction.onView": "view",
  "interaction/onScrollCrossing": "scrollCrossing",
  "interaction/onBreakpoint": "breakpoint",
  "interaction/onMount": "mount",
  "interaction/onMarker": "marker",
  "interaction/onStateChange": "stateChange",
  "interaction/onVariableChange": "variableChange",
  "interaction/onSignalThreshold": "signalThreshold",
  "interaction/onTimer": "timer",
  "interaction/onOverlap": "overlap",
  "interaction/onHit": "hit",
  "interaction/onCustomEvent": "customEvent",
  "event/onClick": "pointer",
  "Event.onClick": "pointer",
  "event/onHover": "hover",
  "Event.onHover": "hover",
  "event/onPageLoad": "mount",
  "Event.onPageLoad": "mount",
  "event/onTimer": "timer",
  "Event.onTimer": "timer",
};

/**
 * Creates a deterministic Blueprint runtime capable of running multiple graphs
 * in lockstep with Preview and tape replay checkpoints.
 */
export function createBlueprintRuntime(
  graphs: readonly BlueprintGraph[],
  options: BlueprintRuntimeOptions = {},
): BlueprintRuntime {
  const maxNodesPerFrame = Math.max(1, options.maxNodesPerFrame ?? 1000);
  const maxLoopIterations = Math.max(1, options.maxLoopIterations ?? 256);

  let frame = 0;
  let timeSec = 0;
  let nextContinuationSeq = 1;
  let budgetExceededCount = 0;
  let eventQueue: RuntimeEventInput[] = [];
  let continuations: LatentContinuation[] = [];
  let emittedActions: EmittedRuntimeAction[] = [];
  let traceLog: RuntimeTraceEntry[] = [];

  const variables: Record<string, unknown> = {};
  const properties: Record<string, number | string | boolean> = {};
  const visibility: Record<string, boolean> = {};
  const stateMachines: Record<string, string> = {};

  // Per-node stateful flow tracking
  const doOnceFired = new Set<string>();
  const doNCount = new Map<string, number>();
  const flipFlopState = new Map<string, boolean>();
  const gateOpen = new Map<string, boolean>();

  const initVariables = (): void => {
    for (const k of Object.keys(variables)) delete variables[k];
    for (const k of Object.keys(properties)) delete properties[k];
    for (const k of Object.keys(visibility)) delete visibility[k];
    for (const k of Object.keys(stateMachines)) delete stateMachines[k];
    for (const g of graphs) {
      for (const v of g.variables) {
        variables[v.name] = v.defaultValue;
      }
    }
  };

  initVariables();

  const wireExecTargets = (graph: BlueprintGraph, nodeId: string, pinId: string): readonly BlueprintWire[] =>
    graph.wires.filter((w) => w.sourceNodeId === nodeId && w.sourcePinId === pinId && (w.pinType === "exec" || w.isExec));

  const readInput = (
    graph: BlueprintGraph,
    node: BlueprintNodeInstance,
    pinId: string,
    nodeOutputs: Map<string, Record<string, unknown>>,
    fallback?: unknown,
  ): unknown => {
    const dataWire = graph.wires.find((w) => w.targetNodeId === node.id && w.targetPinId === pinId && w.pinType !== "exec" && !w.isExec);
    if (dataWire) {
      const upstream = nodeOutputs.get(dataWire.sourceNodeId);
      if (upstream && dataWire.sourcePinId in upstream) {
        return upstream[dataWire.sourcePinId];
      }
    }
    const params = node.customParams ?? node.pinValues ?? {};
    if (pinId in params) return params[pinId];
    return fallback;
  };

  const executeExecChain = (
    graph: BlueprintGraph,
    startNodeId: string,
    startPinId: string,
    nodeOutputs: Map<string, Record<string, unknown>>,
    frameBudget: { used: number },
  ): void => {
    const stack: Array<{ nodeId: string; inPin: string }> = [{ nodeId: startNodeId, inPin: startPinId }];

    while (stack.length > 0) {
      const top = stack.shift()!;
      if (frameBudget.used >= maxNodesPerFrame) {
        budgetExceededCount++;
        return;
      }
      const node = graph.nodes[top.nodeId];
      if (!node) continue;

      frameBudget.used++;
      traceLog.push({
        frame,
        graphId: graph.id,
        nodeId: node.id,
        nodeType: node.type,
        viaPin: top.inPin,
      });

      const nodeKey = `${graph.id}::${node.id}`;
      const followWires = (outPin: string): void => {
        const edges = wireExecTargets(graph, node.id, outPin);
        for (const edge of edges) {
          stack.push({ nodeId: edge.targetNodeId, inPin: edge.targetPinId });
        }
      };

      switch (node.type) {
        case "interaction/branch":
        case "flow/branch":
        case "Flow.branch": {
          const cond = Boolean(readInput(graph, node, "condition", nodeOutputs, true));
          followWires(cond ? "then" : "else");
          break;
        }
        case "interaction/sequence":
        case "flow/sequence":
        case "Flow.sequence": {
          for (const pin of ["then0", "then1", "then2"]) followWires(pin);
          break;
        }
        case "interaction/doOnce": {
          if (top.inPin === "reset") {
            doOnceFired.delete(nodeKey);
          } else if (!doOnceFired.has(nodeKey)) {
            doOnceFired.add(nodeKey);
            followWires("completed");
          }
          break;
        }
        case "interaction/doN": {
          if (top.inPin === "reset") {
            doNCount.set(nodeKey, 0);
          } else {
            const maxN = Number(readInput(graph, node, "n", nodeOutputs, 1));
            const cur = doNCount.get(nodeKey) ?? 0;
            if (cur < maxN) {
              const next = cur + 1;
              doNCount.set(nodeKey, next);
              nodeOutputs.set(node.id, { counter: next });
              followWires("exit");
            }
          }
          break;
        }
        case "interaction/flipFlop": {
          const nextIsA = !(flipFlopState.get(nodeKey) ?? false);
          flipFlopState.set(nodeKey, nextIsA);
          nodeOutputs.set(node.id, { isA: nextIsA });
          followWires(nextIsA ? "a" : "b");
          break;
        }
        case "interaction/gate": {
          if (top.inPin === "open") gateOpen.set(nodeKey, true);
          else if (top.inPin === "close") gateOpen.set(nodeKey, false);
          else if (top.inPin === "toggle") gateOpen.set(nodeKey, !(gateOpen.get(nodeKey) ?? true));
          else if (gateOpen.get(nodeKey) ?? true) followWires("exit");
          break;
        }
        case "interaction/switch": {
          const val = String(readInput(graph, node, "value", nodeOutputs, ""));
          const matched = wireExecTargets(graph, node.id, val === "0" ? "case0" : val === "1" ? "case1" : "default");
          if (matched.length > 0) {
            for (const edge of matched) stack.push({ nodeId: edge.targetNodeId, inPin: edge.targetPinId });
          } else {
            followWires("default");
          }
          break;
        }
        case "interaction/forEach": {
          const rawItems = readInput(graph, node, "items", nodeOutputs, []);
          const items = Array.isArray(rawItems) ? rawItems : [];
          const cap = Math.min(maxLoopIterations, Number(readInput(graph, node, "maxIterations", nodeOutputs, maxLoopIterations)));
          const limit = Math.min(items.length, cap);
          for (let idx = 0; idx < limit; idx++) {
            nodeOutputs.set(node.id, { item: items[idx], index: idx });
            for (const edge of wireExecTargets(graph, node.id, "loopBody")) {
              executeExecChain(graph, edge.targetNodeId, edge.targetPinId, nodeOutputs, frameBudget);
            }
          }
          followWires("completed");
          break;
        }
        case "interaction/delay":
        case "flow/delay":
        case "Flow.delay": {
          const seconds = Math.max(0, Number(readInput(graph, node, "seconds", nodeOutputs, 0.25)));
          if (seconds <= 1e-6) {
            followWires("completed");
          } else {
            continuations.push({
              continuationId: `cont_${nextContinuationSeq++}`,
              graphId: graph.id,
              nodeId: node.id,
              nodeType: node.type,
              nextExecPin: "completed",
              remainingSec: seconds,
              totalSec: seconds,
              cancelled: false,
            });
          }
          break;
        }
        case "interaction/springProperty": {
          const target = String(readInput(graph, node, "target", nodeOutputs, "layer"));
          const path = String(readInput(graph, node, "path", nodeOutputs, "transform.y"));
          const targetValue = Number(readInput(graph, node, "value", nodeOutputs, 0));
          const dur = Math.max(0, Number(readInput(graph, node, "time", nodeOutputs, 0.2)));
          const key = `${target}.${path}`;
          const startValue = typeof properties[key] === "number" ? (properties[key] as number) : 0;
          if (dur <= 1e-6) {
            properties[key] = targetValue;
            followWires("completed");
          } else {
            continuations.push({
              continuationId: `cont_${nextContinuationSeq++}`,
              graphId: graph.id,
              nodeId: node.id,
              nodeType: node.type,
              nextExecPin: "completed",
              remainingSec: dur,
              totalSec: dur,
              target,
              path,
              startValue,
              targetValue,
              cancelled: false,
            });
          }
          break;
        }
        case "interaction/setProperty": {
          const target = String(readInput(graph, node, "target", nodeOutputs, "layer"));
          const path = String(readInput(graph, node, "path", nodeOutputs, "appearance.opacity"));
          const value = readInput(graph, node, "value", nodeOutputs, 1);
          if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
            properties[`${target}.${path}`] = value;
          }
          followWires("exec");
          break;
        }
        case "interaction/showHide": {
          const target = String(readInput(graph, node, "target", nodeOutputs, "layer"));
          const vis = Boolean(readInput(graph, node, "visible", nodeOutputs, true));
          visibility[target] = vis;
          followWires("exec");
          break;
        }
        case "interaction/setState": {
          const machineId = String(readInput(graph, node, "machineId", nodeOutputs, "default"));
          const stateId = String(readInput(graph, node, "stateId", nodeOutputs, "idle"));
          stateMachines[machineId] = stateId;
          followWires("exec");
          break;
        }
        case "variables/set":
        case "Variables.set": {
          const name = String(readInput(graph, node, "name", nodeOutputs, "var"));
          const value = readInput(graph, node, "value", nodeOutputs, 0);
          variables[name] = value;
          followWires("exec");
          break;
        }
        case "interaction/reroute": {
          followWires("exec");
          followWires("out");
          break;
        }
        default: {
          // Record action emission (play, seek, reverse, burst, playSound, spawn, physics, etc.)
          const params = { ...(node.customParams ?? node.pinValues ?? {}) };
          emittedActions.push({
            frame,
            timeSec,
            graphId: graph.id,
            nodeId: node.id,
            actionType: node.type,
            params,
          });
          followWires("exec");
          break;
        }
      }
    }
  };

  const buildSnapshot = (): BlueprintRuntimeSnapshot => ({
    frame,
    timeSec,
    variables: { ...variables },
    properties: { ...properties },
    visibility: { ...visibility },
    stateMachines: { ...stateMachines },
    activeContinuations: continuations.map((c) => ({ ...c })),
    emittedActions: [...emittedActions],
    traceLog: [...traceLog],
    budgetExceededCount,
  });

  return {
    enqueueEvent(event: RuntimeEventInput): void {
      eventQueue.push(event);
    },

    cancelContinuation(continuationId: string): boolean {
      const target = continuations.find((c) => c.continuationId === continuationId && !c.cancelled);
      if (!target) return false;
      continuations = continuations.filter((c) => c.continuationId !== continuationId);
      return true;
    },

    cancelNodeContinuations(nodeId: string): number {
      const before = continuations.length;
      continuations = continuations.filter((c) => c.nodeId !== nodeId);
      return before - continuations.length;
    },

    stepFrame(dtSec: number): BlueprintRuntimeSnapshot {
      const dt = Math.max(0, Math.min(0.25, Number.isFinite(dtSec) ? dtSec : 0));
      frame++;
      timeSec += dt;

      const frameBudget = { used: 0 };
      const nodeOutputs = new Map<string, Record<string, unknown>>();
      const graphById = new Map<string, BlueprintGraph>(graphs.map((g) => [g.id, g]));

      // 1) Advance latent continuations and fire completed downstream nodes
      const stillPending: LatentContinuation[] = [];
      for (const cont of continuations) {
        if (cont.cancelled) continue;
        const nextRemaining = cont.remainingSec - dt;

        if (cont.nodeType === "interaction/springProperty" && cont.target && cont.path) {
          const progress = cont.totalSec > 0 ? Math.min(1, Math.max(0, 1 - nextRemaining / cont.totalSec)) : 1;
          const a = cont.startValue ?? 0;
          const b = cont.targetValue ?? 0;
          properties[`${cont.target}.${cont.path}`] = a + (b - a) * progress;
        }

        if (nextRemaining <= 1e-6) {
          const g = graphById.get(cont.graphId);
          if (g) {
            for (const edge of wireExecTargets(g, cont.nodeId, cont.nextExecPin)) {
              executeExecChain(g, edge.targetNodeId, edge.targetPinId, nodeOutputs, frameBudget);
            }
          }
        } else {
          stillPending.push({ ...cont, remainingSec: nextRemaining });
        }
      }
      continuations = stillPending;

      // 2) Drain input-phase event queue
      const events = eventQueue.splice(0, eventQueue.length);
      for (const evt of events) {
        for (const g of graphs) {
          if (g.type !== "event") continue;
          const entryNodes = Object.values(g.nodes).filter((node) => {
            const alias = EVENT_TYPE_ALIASES[node.type] ?? node.type;
            if (alias !== evt.eventType && node.type !== evt.eventType) return false;
            const nodeTarget = (node.customParams?.target ?? node.pinValues?.target) as string | undefined;
            if (nodeTarget && evt.target && nodeTarget !== evt.target) return false;
            return true;
          });

          for (const entry of entryNodes) {
            nodeOutputs.set(entry.id, { ...(evt.payload ?? {}), target: evt.target ?? "" });
            traceLog.push({
              frame,
              graphId: g.id,
              nodeId: entry.id,
              nodeType: entry.type,
              viaPin: "event",
            });
            for (const edge of wireExecTargets(g, entry.id, "exec")) {
              executeExecChain(g, edge.targetNodeId, edge.targetPinId, nodeOutputs, frameBudget);
            }
          }
        }
      }

      return buildSnapshot();
    },

    snapshot: buildSnapshot,

    reset(): void {
      frame = 0;
      timeSec = 0;
      nextContinuationSeq = 1;
      budgetExceededCount = 0;
      eventQueue = [];
      continuations = [];
      emittedActions = [];
      traceLog = [];
      doOnceFired.clear();
      doNCount.clear();
      flipFlopState.clear();
      gateOpen.clear();
      initVariables();
    },
  };
}
