/**
 * ============================================================================
 * ADJUST LAST OPERATION MODEL (Phase 3D-011)
 * ============================================================================
 * Blender-style "Adjust last operation" parameter tweaking.
 *
 * Invariants:
 *   - After a command runs: `recordLastOperation({ id, args, docBefore, title })`.
 *   - `adjustLastOperation(newArgs)` reverts to `docBefore`, re-executes the op
 *     with merged arguments, and REPLACES the undo step (still exactly one step).
 *   - `describeArgs(id)` introspects the Zod schema for UI controls.
 *   - Any other edit or undo clears the recorded last operation.
 * ============================================================================
 */

import type { MotionDocument } from "../../document/schema";
import { diffPatches } from "../../document/diff";
import { setDocument } from "../../store/documentState";
import { subscribeToDocumentChanges } from "../../store/useDocumentStore";
import { useHistoryStore } from "../../store/useHistoryStore";
import { COMMAND_SCHEMAS, COMMAND_TITLES, run3dOp } from "./ops";

export interface LastOperation {
  id: string;
  title: string;
  args: Record<string, unknown>;
  docBefore: MotionDocument;
}

export type ArgType =
  | "number"
  | "string"
  | "boolean"
  | "enum"
  | "vector3"
  | "quaternion"
  | "array"
  | "unknown";

export interface ArgDescriptor {
  name: string;
  type: ArgType;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  description?: string;
}

let currentLastOp: LastOperation | null = null;
const listeners = new Set<() => void>();
let isInternalUpdate = false;

function notifyListeners(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Ignore listener error
    }
  }
}

/**
 * Returns the currently active last operation, or null if none.
 */
export function getLastOperation(): LastOperation | null {
  return currentLastOp;
}

/**
 * Clears the active last operation.
 */
export function clearLastOperation(): void {
  if (currentLastOp === null) return;
  currentLastOp = null;
  notifyListeners();
}

/**
 * Subscribes to changes to the last operation (e.g. when an op runs, is adjusted, or cleared).
 */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Records a freshly executed 3D operation.
 */
export function recordLastOperation(op: {
  id: string;
  args: Record<string, unknown>;
  docBefore: MotionDocument;
  title?: string;
}): void {
  currentLastOp = {
    id: op.id,
    title: op.title ?? COMMAND_TITLES[op.id] ?? op.id,
    args: { ...op.args },
    docBefore: op.docBefore,
  };
  notifyListeners();
}

/**
 * Re-executes the last operation with modified arguments, updating the document
 * and replacing the undo history transaction in place (maintaining 1 undo step).
 */
export function adjustLastOperation(newArgs: Record<string, unknown>): boolean {
  if (!currentLastOp) return false;

  const mergedArgs = { ...currentLastOp.args, ...newArgs };
  const result = run3dOp(currentLastOp.id, currentLastOp.docBefore, mergedArgs);

  isInternalUpdate = true;
  try {
    setDocument(result.doc);

    // Replace the undo step in useHistoryStore
    const history = useHistoryStore.getState();
    const lastEntry = history.past[history.past.length - 1];

    if (lastEntry && lastEntry.change.kind === "document") {
      const patches = diffPatches(currentLastOp.docBefore, result.doc);
      const inversePatches = diffPatches(result.doc, currentLastOp.docBefore);

      history.replaceLast({
        ...lastEntry,
        timestamp: Date.now(),
        change: {
          kind: "document",
          patches,
          inversePatches,
        },
      });
    }

    currentLastOp = {
      ...currentLastOp,
      args: mergedArgs,
    };
  } finally {
    isInternalUpdate = false;
  }

  notifyListeners();
  return true;
}

// ---------------------------------------------------------------------------
// Schema Introspection
// ---------------------------------------------------------------------------

function unwrapZodType(schema: unknown): {
  type: ArgType;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  description?: string;
} {
  // zod 4: every schema has a public `def` with a `type` ("number", "default", "optional", ...); number schemas expose
  // minValue / maxValue / isInt, enums expose options
  type Z = {
    def?: { type?: string; defaultValue?: unknown; innerType?: unknown; in?: unknown; items?: unknown[] };
    description?: string;
    minValue?: number | null;
    maxValue?: number | null;
    isInt?: boolean;
    options?: string[];
  };
  let cur = schema as Z;
  let defaultValue: unknown;
  const description = cur.description;

  // unwrap the wrappers that do not change what the control is
  while (cur && cur.def) {
    const t = cur.def.type;
    if (t === "default" || t === "prefault") {
      const dv = cur.def.defaultValue;
      defaultValue = typeof dv === "function" ? (dv as () => unknown)() : dv;
      cur = cur.def.innerType as Z;
    } else if (t === "optional" || t === "nullable" || t === "readonly") {
      cur = cur.def.innerType as Z;
    } else if (t === "pipe") {
      cur = cur.def.in as Z;
    } else {
      break;
    }
  }

  const t = cur?.def?.type;
  if (t === "number") {
    const min = typeof cur.minValue === "number" && Number.isFinite(cur.minValue) ? cur.minValue : undefined;
    const max = typeof cur.maxValue === "number" && Number.isFinite(cur.maxValue) ? cur.maxValue : undefined;
    return { type: "number", default: defaultValue, min, max, step: cur.isInt ? 1 : undefined, description };
  }
  if (t === "string") return { type: "string", default: defaultValue, description };
  if (t === "boolean") return { type: "boolean", default: defaultValue, description };
  if (t === "enum") return { type: "enum", default: defaultValue, options: [...(cur.options ?? [])], description };
  if (t === "tuple") {
    const n = cur.def?.items?.length ?? 0;
    return { type: n === 3 ? "vector3" : n === 4 ? "quaternion" : "array", default: defaultValue, description };
  }
  if (t === "array") return { type: "array", default: defaultValue, description };
  // a number or a vector (scale) offers the number field
  if (t === "union") return { type: "number", default: defaultValue, description };
  return { type: "unknown", default: defaultValue, description };
}

/**
 * Returns field descriptors (name, type, default, min, max, options) for the
 * given command id's Zod schema.
 */
export function describeArgs(id: string): ArgDescriptor[] {
  const schema = COMMAND_SCHEMAS[id];
  if (!schema) return [];

  const def = (schema as unknown as { _def?: { shape?: () => Record<string, unknown> } })._def;
  const shape = typeof def?.shape === "function" ? def.shape() : (schema as unknown as { shape?: Record<string, unknown> }).shape;
  if (!shape) return [];

  const descriptors: ArgDescriptor[] = [];
  for (const [key, fieldSchema] of Object.entries(shape)) {
    const info = unwrapZodType(fieldSchema);
    descriptors.push({
      name: key,
      ...info,
    });
  }

  return descriptors;
}

// ---------------------------------------------------------------------------
// External Invalidation Subscriptions
// ---------------------------------------------------------------------------

// Any external document change clears the last operation
subscribeToDocumentChanges(() => {
  if (!isInternalUpdate && currentLastOp !== null) {
    clearLastOperation();
  }
});

// Any undo/redo clears the last operation
useHistoryStore.subscribe((state, prev) => {
  if (isInternalUpdate) return;
  if (state.past.length !== prev.past.length || state.future.length !== prev.future.length) {
    if (currentLastOp !== null) {
      clearLastOperation();
    }
  }
});
