/**
 * @file stateMachineRuntime.ts
 * @module core/signals/stateMachineRuntime
 * @description Phase 151: Rive-style interactive state machine runtime with typed inputs
 * (boolean, number, trigger), conditional transitions, smooth cross-state blends, and
 * 1D blend states driven by numeric inputs (e.g. hover intensity by pointer proximity).
 */

export type StateInputDef =
  | { readonly name: string; readonly kind: "boolean"; readonly initial: boolean }
  | { readonly name: string; readonly kind: "number"; readonly initial: number; readonly min?: number; readonly max?: number }
  | { readonly name: string; readonly kind: "trigger" };

export type ConditionOperator = "==" | "!=" | ">" | "<" | ">=" | "<=" | "fired";

export interface TransitionCondition {
  readonly input: string;
  readonly op: ConditionOperator;
  readonly value?: number | boolean;
}

export interface Blend1DStop {
  readonly value: number;
  readonly properties: Readonly<Record<string, number>>;
}

export type StateNodeSpec =
  | {
      readonly id: string;
      readonly label: string;
      readonly kind: "pose";
      readonly properties: Readonly<Record<string, number>>;
      readonly x?: number;
      readonly y?: number;
    }
  | {
      readonly id: string;
      readonly label: string;
      readonly kind: "blend1d";
      readonly inputName: string;
      readonly stops: readonly Blend1DStop[];
      readonly x?: number;
      readonly y?: number;
    };

export interface StateTransitionSpec {
  readonly id: string;
  /** Source state id or `"*"` for any-state transitions. */
  readonly from: string;
  readonly to: string;
  readonly durationSec?: number;
  readonly priority?: number;
  readonly conditions: readonly TransitionCondition[];
}

export interface StateMachineSpec {
  readonly id: string;
  readonly name: string;
  readonly initialStateId: string;
  readonly inputs: readonly StateInputDef[];
  readonly states: readonly StateNodeSpec[];
  readonly transitions: readonly StateTransitionSpec[];
}

export interface ActiveTransitionState {
  readonly transitionId: string;
  readonly fromStateId: string;
  readonly toStateId: string;
  readonly elapsedSec: number;
  readonly durationSec: number;
  readonly progress: number;
  /**
   * Set when this transition interrupted another: the blended pose at the moment of interruption, used as the
   * starting pose instead of `fromStateId`'s own (so an interrupted hover-in reverses smoothly from where it was).
   */
  readonly fromProperties?: Readonly<Record<string, number>>;
}

export interface StateMachineSnapshot {
  readonly currentStateId: string;
  readonly activeTransition: ActiveTransitionState | null;
  readonly inputs: Readonly<Record<string, number | boolean>>;
  readonly pendingTriggers: readonly string[];
  readonly properties: Readonly<Record<string, number>>;
  readonly transitionHistory: readonly string[];
}

export interface StateMachineRuntime {
  setBoolean(name: string, value: boolean): StateMachineSnapshot;
  setNumber(name: string, value: number): StateMachineSnapshot;
  fireTrigger(name: string): StateMachineSnapshot;
  step(dtSec: number): StateMachineSnapshot;
  snapshot(): StateMachineSnapshot;
  reset(): StateMachineSnapshot;
}

/** Evaluates a 1D blend state from sorted `{ value, properties }` keyframes. */
export function evaluateBlend1D(
  stops: readonly Blend1DStop[],
  inputValue: number,
): Record<string, number> {
  if (stops.length === 0) return {};
  const sorted = [...stops].sort((a, b) => a.value - b.value);
  const safeVal = Number.isFinite(inputValue) ? inputValue : sorted[0]!.value;

  if (safeVal <= sorted[0]!.value) {
    return { ...sorted[0]!.properties };
  }
  const last = sorted[sorted.length - 1]!;
  if (safeVal >= last.value) {
    return { ...last.properties };
  }

  let lower = sorted[0]!;
  let upper = last;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (safeVal >= a.value && safeVal <= b.value) {
      lower = a;
      upper = b;
      break;
    }
  }

  const span = upper.value - lower.value;
  const t = span <= 1e-9 ? 0 : Math.min(1, Math.max(0, (safeVal - lower.value) / span));

  const keys = new Set([
    ...Object.keys(lower.properties),
    ...Object.keys(upper.properties),
  ]);
  const result: Record<string, number> = {};
  for (const key of keys) {
    const aVal = lower.properties[key] ?? upper.properties[key] ?? 0;
    const bVal = upper.properties[key] ?? lower.properties[key] ?? 0;
    result[key] = aVal + (bVal - aVal) * t;
  }
  return result;
}

/** Evaluates whether every condition on a candidate transition is satisfied. */
export function evaluateConditions(
  conditions: readonly TransitionCondition[],
  values: Readonly<Record<string, number | boolean>>,
  firedTriggers: ReadonlySet<string>,
): boolean {
  if (conditions.length === 0) return false;
  for (const cond of conditions) {
    if (cond.op === "fired") {
      if (!firedTriggers.has(cond.input)) return false;
      continue;
    }
    const current = values[cond.input];
    if (current === undefined) return false;
    const expected = cond.value;
    if (expected === undefined) return false;

    if (typeof current === "boolean" || typeof expected === "boolean") {
      if (cond.op === "==" && current !== expected) return false;
      if (cond.op === "!=" && current === expected) return false;
      if (cond.op !== "==" && cond.op !== "!=") return false;
      continue;
    }

    switch (cond.op) {
      case "==":
        if (current !== expected) return false;
        break;
      case "!=":
        if (current === expected) return false;
        break;
      case ">":
        if (!(current > expected)) return false;
        break;
      case "<":
        if (!(current < expected)) return false;
        break;
      case ">=":
        if (!(current >= expected)) return false;
        break;
      case "<=":
        if (!(current <= expected)) return false;
        break;
    }
  }
  return true;
}

/** Creates an interactive Rive-style state machine runtime instance. */
export function createStateMachineRuntime(spec: StateMachineSpec): StateMachineRuntime {
  const statesById = new Map<string, StateNodeSpec>(spec.states.map((s) => [s.id, s]));
  const inputDefsByName = new Map<string, StateInputDef>(spec.inputs.map((i) => [i.name, i]));

  let currentStateId = spec.initialStateId;
  let activeTransition: ActiveTransitionState | null = null;
  let inputValues: Record<string, number | boolean> = {};
  let firedTriggers = new Set<string>();
  let transitionHistory: string[] = [spec.initialStateId];

  const initInputs = (): void => {
    inputValues = {};
    firedTriggers = new Set<string>();
    for (const def of spec.inputs) {
      if (def.kind === "boolean") {
        inputValues[def.name] = def.initial;
      } else if (def.kind === "number") {
        inputValues[def.name] = def.initial;
      } else {
        inputValues[def.name] = false;
      }
    }
  };

  initInputs();

  const evaluateStateProperties = (stateId: string): Record<string, number> => {
    const node = statesById.get(stateId);
    if (!node) return {};
    if (node.kind === "pose") {
      return { ...node.properties };
    }
    const raw = inputValues[node.inputName];
    const numeric = typeof raw === "number" ? raw : raw ? 1 : 0;
    return evaluateBlend1D(node.stops, numeric);
  };

  const evaluateOutputProperties = (): Record<string, number> => {
    if (!activeTransition) {
      return evaluateStateProperties(currentStateId);
    }
    const fromProps = activeTransition.fromProperties ?? evaluateStateProperties(activeTransition.fromStateId);
    const toProps = evaluateStateProperties(activeTransition.toStateId);
    const t = activeTransition.progress;
    const keys = new Set([...Object.keys(fromProps), ...Object.keys(toProps)]);
    const blended: Record<string, number> = {};
    for (const key of keys) {
      const a = fromProps[key] ?? toProps[key] ?? 0;
      const b = toProps[key] ?? fromProps[key] ?? 0;
      blended[key] = a + (b - a) * t;
    }
    return blended;
  };

  /** Keep the history short: it is for the debugger, and it used to grow (and be copied) on every transition. */
  const MAX_HISTORY = 64;
  const pushHistory = (stateId: string): void => {
    transitionHistory = [...transitionHistory.slice(-(MAX_HISTORY - 1)), stateId];
  };

  /**
   * Picks a transition out of `fromId`. While a transition is running, `fromId` is the state it is heading to, and a
   * new transition interrupts it, starting from the pose blended so far.
   */
  const trySelectTransition = (): void => {
    const fromId = activeTransition ? activeTransition.toStateId : currentStateId;
    const candidates = spec.transitions
      .filter((tr) => (tr.from === fromId || tr.from === "*") && tr.to !== fromId)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    for (const tr of candidates) {
      if (!statesById.has(tr.to)) continue;
      if (evaluateConditions(tr.conditions, inputValues, firedTriggers)) {
        for (const cond of tr.conditions) {
          if (cond.op === "fired") {
            firedTriggers.delete(cond.input);
            inputValues[cond.input] = false;
          }
        }
        const dur = Math.max(0, tr.durationSec ?? 0);
        const interruptedPose = activeTransition ? evaluateOutputProperties() : undefined;
        if (dur <= 1e-6) {
          currentStateId = tr.to;
          activeTransition = null;
          pushHistory(tr.to);
        } else {
          if (activeTransition) currentStateId = activeTransition.toStateId;
          activeTransition = {
            transitionId: tr.id,
            fromStateId: currentStateId,
            toStateId: tr.to,
            elapsedSec: 0,
            durationSec: dur,
            progress: 0,
            ...(interruptedPose ? { fromProperties: interruptedPose } : {}),
          };
        }
        break;
      }
    }
  };

  const buildSnapshot = (): StateMachineSnapshot => ({
    currentStateId,
    activeTransition: activeTransition ? { ...activeTransition } : null,
    inputs: { ...inputValues },
    pendingTriggers: [...firedTriggers],
    properties: evaluateOutputProperties(),
    transitionHistory: [...transitionHistory],
  });

  return {
    setBoolean(name: string, value: boolean): StateMachineSnapshot {
      const def = inputDefsByName.get(name);
      if (def?.kind === "boolean") {
        inputValues[name] = value;
      }
      return buildSnapshot();
    },

    setNumber(name: string, value: number): StateMachineSnapshot {
      const def = inputDefsByName.get(name);
      if (def?.kind === "number" && Number.isFinite(value)) {
        let clamped = value;
        if (def.min !== undefined) clamped = Math.max(def.min, clamped);
        if (def.max !== undefined) clamped = Math.min(def.max, clamped);
        inputValues[name] = clamped;
      }
      return buildSnapshot();
    },

    fireTrigger(name: string): StateMachineSnapshot {
      const def = inputDefsByName.get(name);
      if (def?.kind === "trigger") {
        firedTriggers.add(name);
        inputValues[name] = true;
      }
      return buildSnapshot();
    },

    step(dtSec: number): StateMachineSnapshot {
      const dt = Math.max(0, Math.min(0.25, Number.isFinite(dtSec) ? dtSec : 0));

      if (activeTransition) {
        const nextElapsed = activeTransition.elapsedSec + dt;
        if (nextElapsed >= activeTransition.durationSec) {
          currentStateId = activeTransition.toStateId;
          pushHistory(currentStateId);
          activeTransition = null;
        } else {
          activeTransition = {
            ...activeTransition,
            elapsedSec: nextElapsed,
            progress: Math.min(1, Math.max(0, nextElapsed / activeTransition.durationSec)),
          };
        }
      }

      trySelectTransition();

      // A trigger lasts one step: one nothing used is dropped, not kept to fire a transition later.
      const snap = buildSnapshot();
      for (const name of firedTriggers) inputValues[name] = false;
      firedTriggers.clear();
      return snap;
    },

    snapshot: buildSnapshot,

    reset(): StateMachineSnapshot {
      currentStateId = spec.initialStateId;
      activeTransition = null;
      transitionHistory = [spec.initialStateId];
      initInputs();
      return buildSnapshot();
    },
  };
}
