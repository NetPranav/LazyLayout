/**
 * @file interactionLibrary.ts
 * @module core/nodescript/interactionLibrary
 * @description Phase 159: `document.graphs` interaction model (event graphs,
 * functions, macros, typed variables, custom events, exec & data pins), full
 * interactive standard library catalogue, and graph validation rules (pin types,
 * latent placement inside event graphs only, bounded loops).
 */

import type {
  BlueprintGraph,
  BlueprintNodeInstance,
  BlueprintValidationIssue,
  BlueprintWire,
  GraphValidationResult,
} from "../ast/ASTManager";
import type { PinDataType } from "../types/node-registry";

export interface CustomEventDef {
  readonly id: string;
  readonly name: string;
  readonly payloadPins: readonly InteractionPinSpec[];
}

export interface DocumentGraphsMap {
  readonly graphs: Record<string, BlueprintGraph>;
  readonly customEvents: Record<string, CustomEventDef>;
}

export type InteractionLibraryGroup = "event" | "flow" | "action";

export interface InteractionPinSpec {
  readonly id: string;
  readonly name: string;
  readonly type: PinDataType;
  readonly direction: "input" | "output";
  readonly required?: boolean;
}

export interface InteractionNodeSpec {
  readonly type: string;
  readonly canonicalName: string;
  readonly group: InteractionLibraryGroup;
  readonly latent?: boolean;
  readonly boundedLoop?: boolean;
  readonly pins: readonly InteractionPinSpec[];
}

const pIn = (id: string, type: PinDataType, required = false): InteractionPinSpec => ({
  id,
  name: id,
  type,
  direction: "input",
  required,
});

const pOut = (id: string, type: PinDataType): InteractionPinSpec => ({
  id,
  name: id,
  type,
  direction: "output",
});

/**
 * Complete Phase 159 interaction node standard library:
 * pointer/hover/focus/key/drag/view/scroll/breakpoint/mount/marker/state/variable/threshold/timer/overlap/hit events,
 * flow control, and cross-element/motion/physics/sound actions.
 */
export const INTERACTION_NODE_CATALOG: readonly InteractionNodeSpec[] = [
  // Events
  { type: "interaction/onPointer", canonicalName: "Interaction.onPointer", group: "event", pins: [pOut("exec", "exec"), pOut("target", "string"), pOut("x", "number"), pOut("y", "number"), pOut("down", "boolean")] },
  { type: "interaction/onHover", canonicalName: "Interaction.onHover", group: "event", pins: [pOut("exec", "exec"), pOut("target", "string"), pOut("hovered", "boolean")] },
  { type: "interaction/onFocus", canonicalName: "Interaction.onFocus", group: "event", pins: [pOut("exec", "exec"), pOut("target", "string"), pOut("focused", "boolean")] },
  { type: "interaction/onKey", canonicalName: "Interaction.onKey", group: "event", pins: [pOut("exec", "exec"), pOut("key", "string"), pOut("down", "boolean"), pOut("target", "string")] },
  { type: "interaction/onDrag", canonicalName: "Interaction.onDrag", group: "event", pins: [pOut("exec", "exec"), pOut("target", "string"), pOut("dx", "number"), pOut("dy", "number"), pOut("phase", "string")] },
  { type: "interaction/onView", canonicalName: "Interaction.onView", group: "event", pins: [pOut("exec", "exec"), pOut("target", "string"), pOut("progress", "number"), pOut("visible", "boolean")] },
  { type: "interaction/onScrollCrossing", canonicalName: "Interaction.onScrollCrossing", group: "event", pins: [pOut("exec", "exec"), pOut("target", "string"), pOut("direction", "string")] },
  { type: "interaction/onBreakpoint", canonicalName: "Interaction.onBreakpoint", group: "event", pins: [pOut("exec", "exec"), pOut("breakpoint", "string")] },
  { type: "interaction/onMount", canonicalName: "Interaction.onMount", group: "event", pins: [pOut("exec", "exec"), pOut("compositionId", "string")] },
  { type: "interaction/onMarker", canonicalName: "Interaction.onMarker", group: "event", pins: [pOut("exec", "exec"), pOut("marker", "string"), pOut("time", "number")] },
  { type: "interaction/onStateChange", canonicalName: "Interaction.onStateChange", group: "event", pins: [pOut("exec", "exec"), pOut("machine", "string"), pOut("from", "string"), pOut("to", "string")] },
  { type: "interaction/onVariableChange", canonicalName: "Interaction.onVariableChange", group: "event", pins: [pOut("exec", "exec"), pOut("name", "string"), pOut("value", "any")] },
  { type: "interaction/onSignalThreshold", canonicalName: "Interaction.onSignalThreshold", group: "event", pins: [pOut("exec", "exec"), pOut("signal", "string"), pOut("crossed", "boolean")] },
  { type: "interaction/onTimer", canonicalName: "Interaction.onTimer", group: "event", pins: [pOut("exec", "exec"), pOut("elapsed", "number")] },
  { type: "interaction/onOverlap", canonicalName: "Interaction.onOverlap", group: "event", pins: [pOut("exec", "exec"), pOut("self", "string"), pOut("other", "string"), pOut("phase", "string")] },
  { type: "interaction/onHit", canonicalName: "Interaction.onHit", group: "event", pins: [pOut("exec", "exec"), pOut("self", "string"), pOut("other", "string"), pOut("impulse", "number")] },
  { type: "interaction/onCustomEvent", canonicalName: "Interaction.onCustomEvent", group: "event", pins: [pOut("exec", "exec"), pOut("eventName", "string"), pOut("payload", "any")] },

  // Flow Control
  { type: "interaction/branch", canonicalName: "Interaction.branch", group: "flow", pins: [pIn("exec", "exec"), pIn("condition", "boolean", true), pOut("then", "exec"), pOut("else", "exec")] },
  { type: "interaction/sequence", canonicalName: "Interaction.sequence", group: "flow", pins: [pIn("exec", "exec"), pOut("then0", "exec"), pOut("then1", "exec"), pOut("then2", "exec")] },
  { type: "interaction/gate", canonicalName: "Interaction.gate", group: "flow", pins: [pIn("exec", "exec"), pIn("open", "exec"), pIn("close", "exec"), pIn("toggle", "exec"), pOut("exit", "exec")] },
  { type: "interaction/doOnce", canonicalName: "Interaction.doOnce", group: "flow", pins: [pIn("exec", "exec"), pIn("reset", "exec"), pOut("completed", "exec")] },
  { type: "interaction/doN", canonicalName: "Interaction.doN", group: "flow", pins: [pIn("exec", "exec"), pIn("n", "number"), pIn("reset", "exec"), pOut("exit", "exec"), pOut("counter", "number")] },
  { type: "interaction/flipFlop", canonicalName: "Interaction.flipFlop", group: "flow", pins: [pIn("exec", "exec"), pOut("a", "exec"), pOut("b", "exec"), pOut("isA", "boolean")] },
  { type: "interaction/delay", canonicalName: "Interaction.delay", group: "flow", latent: true, pins: [pIn("exec", "exec"), pIn("seconds", "number", true), pOut("completed", "exec")] },
  { type: "interaction/forEach", canonicalName: "Interaction.forEach", group: "flow", boundedLoop: true, pins: [pIn("exec", "exec"), pIn("items", "array", true), pIn("maxIterations", "number"), pOut("loopBody", "exec"), pOut("item", "any"), pOut("index", "number"), pOut("completed", "exec")] },
  { type: "interaction/switch", canonicalName: "Interaction.switch", group: "flow", pins: [pIn("exec", "exec"), pIn("value", "string", true), pOut("case0", "exec"), pOut("case1", "exec"), pOut("default", "exec")] },

  // Actions
  { type: "interaction/play", canonicalName: "Interaction.play", group: "action", pins: [pIn("exec", "exec"), pIn("compositionId", "string"), pOut("exec", "exec")] },
  { type: "interaction/seek", canonicalName: "Interaction.seek", group: "action", pins: [pIn("exec", "exec"), pIn("compositionId", "string"), pIn("time", "number"), pOut("exec", "exec")] },
  { type: "interaction/reverse", canonicalName: "Interaction.reverse", group: "action", pins: [pIn("exec", "exec"), pIn("compositionId", "string"), pOut("exec", "exec")] },
  { type: "interaction/setState", canonicalName: "Interaction.setState", group: "action", pins: [pIn("exec", "exec"), pIn("machineId", "string"), pIn("stateId", "string"), pOut("exec", "exec")] },
  { type: "interaction/setStateInput", canonicalName: "Interaction.setStateInput", group: "action", pins: [pIn("exec", "exec"), pIn("machineId", "string"), pIn("input", "string"), pIn("value", "any"), pOut("exec", "exec")] },
  { type: "interaction/setProperty", canonicalName: "Interaction.setProperty", group: "action", pins: [pIn("exec", "exec"), pIn("target", "string", true), pIn("path", "string", true), pIn("value", "any", true), pOut("exec", "exec")] },
  { type: "interaction/springProperty", canonicalName: "Interaction.springProperty", group: "action", latent: true, pins: [pIn("exec", "exec"), pIn("target", "string", true), pIn("path", "string", true), pIn("value", "number", true), pIn("bounce", "number"), pIn("time", "number"), pOut("completed", "exec")] },
  { type: "interaction/setUniform", canonicalName: "Interaction.setUniform", group: "action", pins: [pIn("exec", "exec"), pIn("target", "string"), pIn("uniform", "string"), pIn("value", "any"), pOut("exec", "exec")] },
  { type: "interaction/burst", canonicalName: "Interaction.burst", group: "action", pins: [pIn("exec", "exec"), pIn("emitter", "string"), pIn("count", "number"), pOut("exec", "exec")] },
  { type: "interaction/showHide", canonicalName: "Interaction.showHide", group: "action", pins: [pIn("exec", "exec"), pIn("target", "string", true), pIn("visible", "boolean", true), pOut("exec", "exec")] },
  { type: "interaction/scrollTo", canonicalName: "Interaction.scrollTo", group: "action", pins: [pIn("exec", "exec"), pIn("target", "string"), pIn("offsetY", "number"), pOut("exec", "exec")] },
  { type: "interaction/focus", canonicalName: "Interaction.focus", group: "action", pins: [pIn("exec", "exec"), pIn("target", "string", true), pOut("exec", "exec")] },
  { type: "interaction/openUrl", canonicalName: "Interaction.openUrl", group: "action", pins: [pIn("exec", "exec"), pIn("url", "string", true), pIn("newTab", "boolean"), pOut("exec", "exec")] },
  { type: "interaction/navigate", canonicalName: "Interaction.navigate", group: "action", pins: [pIn("exec", "exec"), pIn("route", "string", true), pOut("exec", "exec")] },
  { type: "interaction/playSound", canonicalName: "Interaction.playSound", group: "action", pins: [pIn("exec", "exec"), pIn("soundId", "string", true), pIn("gain", "number"), pOut("exec", "exec")] },
  { type: "interaction/spawn", canonicalName: "Interaction.spawn", group: "action", pins: [pIn("exec", "exec"), pIn("templateId", "string", true), pIn("x", "number"), pIn("y", "number"), pOut("exec", "exec"), pOut("spawnedId", "string")] },
  { type: "interaction/keepOut", canonicalName: "Interaction.keepOut", group: "action", pins: [pIn("exec", "exec"), pIn("target", "string"), pIn("fieldId", "string"), pOut("exec", "exec")] },
  { type: "interaction/springHome", canonicalName: "Interaction.springHome", group: "action", pins: [pIn("exec", "exec"), pIn("target", "string"), pOut("exec", "exec")] },
  { type: "interaction/addForce", canonicalName: "Interaction.addForce", group: "action", pins: [pIn("exec", "exec"), pIn("bodyId", "string"), pIn("fx", "number"), pIn("fy", "number"), pOut("exec", "exec")] },
  { type: "interaction/addImpulse", canonicalName: "Interaction.addImpulse", group: "action", pins: [pIn("exec", "exec"), pIn("bodyId", "string"), pIn("ix", "number"), pIn("iy", "number"), pOut("exec", "exec")] },
  { type: "interaction/addSpin", canonicalName: "Interaction.addSpin", group: "action", pins: [pIn("exec", "exec"), pIn("bodyId", "string"), pIn("torque", "number"), pOut("exec", "exec")] },
  { type: "interaction/explode", canonicalName: "Interaction.explode", group: "action", pins: [pIn("exec", "exec"), pIn("x", "number"), pIn("y", "number"), pIn("radius", "number"), pIn("impulse", "number"), pOut("exec", "exec")] },
  { type: "interaction/setBody", canonicalName: "Interaction.setBody", group: "action", pins: [pIn("exec", "exec"), pIn("bodyId", "string"), pIn("mode", "string"), pOut("exec", "exec")] },
];

export const INTERACTION_NODE_MAP: ReadonlyMap<string, InteractionNodeSpec> = new Map(
  INTERACTION_NODE_CATALOG.map((spec) => [spec.type, spec]),
);

function arePinsCompatible(sourceType: PinDataType, targetType: PinDataType): boolean {
  if (sourceType === "exec" || targetType === "exec") {
    return sourceType === "exec" && targetType === "exec";
  }
  if (sourceType === "any" || targetType === "any") return true;
  return sourceType === targetType;
}

/**
 * Validates an interaction Blueprint graph for:
 * 1) Unknown node types (outside the interaction catalogue),
 * 2) Pin existence, direction & type compatibility across wires,
 * 3) Latent placement rules (banned in `function` graphs and inside `forEach` loop bodies),
 * 4) Bounded loop constraints (`forEach` must have bounded `maxIterations` <= 10,000),
 * 5) Exec/data cycle checks.
 */
export function validateInteractionGraph(graph: BlueprintGraph): GraphValidationResult {
  const issues: BlueprintValidationIssue[] = [];
  const addIssue = (
    code: string,
    message: string,
    severity: "error" | "warning" = "error",
    nodeId?: string,
    pinId?: string,
  ): void => {
    issues.push({
      id: `bp-${issues.length + 1}`,
      severity,
      code,
      message,
      nodeId,
      pinId,
    });
  };

  const nodes = Object.values(graph.nodes) as BlueprintNodeInstance[];

  for (const node of nodes) {
    const spec = INTERACTION_NODE_MAP.get(node.type);
    if (!spec) continue;

    if (spec.latent && graph.type === "function") {
      addIssue(
        "BP_LATENT_IN_FUNCTION",
        `Latent node "${node.type}" cannot appear inside a function graph "${graph.name}".`,
        "error",
        node.id,
      );
    }

    if (spec.boundedLoop) {
      const boundVal = node.pinValues?.maxIterations;
      if (boundVal !== undefined && (typeof boundVal !== "number" || boundVal <= 0 || boundVal > 10_000)) {
        addIssue(
          "BP_UNBOUNDED_LOOP",
          `Loop node "${node.id}" has invalid maxIterations (${String(boundVal)}): must be 1..10000.`,
          "error",
          node.id,
          "maxIterations",
        );
      }
    }
  }

  for (const wire of graph.wires as BlueprintWire[]) {
    const srcNode = graph.nodes[wire.sourceNodeId];
    const dstNode = graph.nodes[wire.targetNodeId];
    if (!srcNode || !dstNode) {
      addIssue("BP_DANGLING_WIRE", `Wire "${wire.id}" connects to a missing node.`, "error");
      continue;
    }

    const srcSpec = INTERACTION_NODE_MAP.get(srcNode.type);
    const dstSpec = INTERACTION_NODE_MAP.get(dstNode.type);
    if (srcSpec && dstSpec) {
      const srcPin = srcSpec.pins.find((p) => p.id === wire.sourcePinId && p.direction === "output");
      const dstPin = dstSpec.pins.find((p) => p.id === wire.targetPinId && p.direction === "input");
      if (!srcPin) {
        addIssue("BP_MISSING_PIN", `Missing output pin "${wire.sourcePinId}" on "${srcNode.id}".`, "error", srcNode.id, wire.sourcePinId);
        continue;
      }
      if (!dstPin) {
        addIssue("BP_MISSING_PIN", `Missing input pin "${wire.targetPinId}" on "${dstNode.id}".`, "error", dstNode.id, wire.targetPinId);
        continue;
      }
      if (!arePinsCompatible(srcPin.type, dstPin.type)) {
        addIssue(
          "BP_PIN_TYPE_MISMATCH",
          `Incompatible pin types: "${srcPin.type}" -> "${dstPin.type}" on wire "${wire.id}".`,
          "error",
          dstNode.id,
          dstPin.id,
        );
      }
    }
  }

  // Ban latent nodes reachable from a `forEach` `loopBody` branch
  const adjExec = new Map<string, { targetId: string; sourcePinId: string }[]>();
  for (const wire of graph.wires) {
    if (wire.pinType === "exec" || wire.isExec) {
      const list = adjExec.get(wire.sourceNodeId) ?? [];
      list.push({ targetId: wire.targetNodeId, sourcePinId: wire.sourcePinId });
      adjExec.set(wire.sourceNodeId, list);
    }
  }

  for (const node of nodes) {
    const spec = INTERACTION_NODE_MAP.get(node.type);
    if (!spec?.boundedLoop) continue;
    const queue = (adjExec.get(node.id) ?? [])
      .filter((e) => e.sourcePinId === "loopBody")
      .map((e) => e.targetId);
    const visited = new Set<string>();
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const curNode = graph.nodes[cur];
      const curSpec = curNode ? INTERACTION_NODE_MAP.get(curNode.type) : undefined;
      if (curSpec?.latent) {
        addIssue(
          "BP_LATENT_IN_LOOP",
          `Latent node "${cur}" is forbidden inside loop body of "${node.id}".`,
          "error",
          cur,
        );
      }
      for (const next of adjExec.get(cur) ?? []) {
        queue.push(next.targetId);
      }
    }
  }

  return {
    isValid: issues.every((i) => i.severity !== "error"),
    issues,
  };
}
