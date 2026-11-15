import type { Binding, Signal } from "../document/signals";

export interface KeyTriggerRule {
  readonly id: string;
  readonly keyCode: string;
  readonly ownerLayerId: string;
  readonly action: "stepState" | "triggerComposition" | "setState";
  readonly states?: readonly string[];
  readonly targetState?: string;
  readonly compositionId?: string;
}

export interface KeyTriggerState {
  readonly activeStateIndex: number;
  readonly activeState: string | undefined;
  readonly triggeredCompositions: readonly string[];
}

/**
 * Pure key-trigger dispatcher for state stepping ("when the user presses
 * ArrowRight, slide to the next card") and composition triggering.
 */
export function applyKeyTrigger(
  rule: KeyTriggerRule,
  pressedCode: string,
  prev: KeyTriggerState
): KeyTriggerState {
  if (pressedCode !== rule.keyCode) return prev;
  if (rule.action === "stepState" && rule.states && rule.states.length > 0) {
    const nextIdx = (prev.activeStateIndex + 1) % rule.states.length;
    return {
      activeStateIndex: nextIdx,
      activeState: rule.states[nextIdx],
      triggeredCompositions: prev.triggeredCompositions,
    };
  }
  if (rule.action === "setState" && rule.targetState) {
    return {
      activeStateIndex: Math.max(0, rule.states?.indexOf(rule.targetState) ?? 0),
      activeState: rule.targetState,
      triggeredCompositions: prev.triggeredCompositions,
    };
  }
  if (rule.action === "triggerComposition" && rule.compositionId) {
    return {
      activeStateIndex: prev.activeStateIndex,
      activeState: prev.activeState,
      triggeredCompositions: [...prev.triggeredCompositions, rule.compositionId],
    };
  }
  return prev;
}

export interface RovingFocusGroup {
  readonly activeId: string | null;
  tabIndexOf(id: string): 0 | -1;
  onKeyDown(keyCode: string): string | null;
  focus(id: string): string | null;
}

/** Roving focus controller for groups (grammar keyboard navigation). */
export function createRovingFocusGroup(
  itemIds: readonly string[],
  options: { readonly orientation?: "horizontal" | "vertical" | "both"; readonly loop?: boolean; readonly initialId?: string } = {}
): RovingFocusGroup {
  const orientation = options.orientation ?? "horizontal";
  const loop = options.loop ?? true;
  let idx = options.initialId ? Math.max(0, itemIds.indexOf(options.initialId)) : 0;

  const move = (delta: number) => {
    if (itemIds.length === 0) return null;
    if (loop) {
      idx = (idx + delta + itemIds.length) % itemIds.length;
    } else {
      idx = Math.max(0, Math.min(itemIds.length - 1, idx + delta));
    }
    return itemIds[idx] ?? null;
  };

  return {
    get activeId() {
      return itemIds[idx] ?? null;
    },
    tabIndexOf(id) {
      return itemIds[idx] === id ? 0 : -1;
    },
    focus(id) {
      const next = itemIds.indexOf(id);
      if (next >= 0) idx = next;
      return itemIds[idx] ?? null;
    },
    onKeyDown(keyCode) {
      if (itemIds.length === 0) return null;
      if (keyCode === "Home") {
        idx = 0;
        return itemIds[0] ?? null;
      }
      if (keyCode === "End") {
        idx = itemIds.length - 1;
        return itemIds[idx] ?? null;
      }
      const nextKeys =
        orientation === "horizontal"
          ? ["ArrowRight"]
          : orientation === "vertical"
            ? ["ArrowDown"]
            : ["ArrowRight", "ArrowDown"];
      const prevKeys =
        orientation === "horizontal"
          ? ["ArrowLeft"]
          : orientation === "vertical"
            ? ["ArrowUp"]
            : ["ArrowLeft", "ArrowUp"];
      if (nextKeys.includes(keyCode)) return move(1);
      if (prevKeys.includes(keyCode)) return move(-1);
      return itemIds[idx] ?? null;
    },
  };
}

export interface KeyboardParityViolation {
  readonly code: "A11Y_KEY_PARITY";
  readonly layerId: string;
  readonly bindingId: string;
  readonly message: string;
}

function isPointerReactionSignal(signal: Signal): boolean {
  if (signal.kind === "pointer" || signal.kind === "pointerIn" || signal.kind === "pointerInside" || signal.kind === "proximity") {
    return true;
  }
  return signal.kind === "layerState" && (signal.channel === "hover" || signal.channel === "press");
}

function isKeyboardOrFocusSignal(signal: Signal): boolean {
  if (signal.kind === "keyDown" || signal.kind === "keyHeld" || signal.kind === "keyAxis" || signal.kind === "keyLastPressed" || signal.kind === "focusVisible") {
    return true;
  }
  return signal.kind === "layerState" && signal.channel === "focus";
}

/**
 * Grammar 6.11 Keyboard Parity Rule: any informative pointer reaction on a
 * layer must have a keyboard or focus equivalent on that layer.
 */
export function checkKeyboardFocusParity(input: {
  readonly bindings: readonly Binding[];
  readonly keyRules?: readonly KeyTriggerRule[];
  readonly rovingFocusLayerIds?: ReadonlySet<string>;
}): KeyboardParityViolation[] {
  const layersWithKeyOrFocus = new Set<string>(input.rovingFocusLayerIds ?? []);
  for (const r of input.keyRules ?? []) {
    layersWithKeyOrFocus.add(r.ownerLayerId);
  }
  for (const b of input.bindings) {
    if (!b.enabled) continue;
    if (isKeyboardOrFocusSignal(b.expr.signal)) {
      layersWithKeyOrFocus.add(b.ownerLayerId);
    }
  }

  const violations: KeyboardParityViolation[] = [];
  for (const b of input.bindings) {
    if (!b.enabled) continue;
    if (!isPointerReactionSignal(b.expr.signal)) continue;
    if (layersWithKeyOrFocus.has(b.ownerLayerId)) continue;
    violations.push({
      code: "A11Y_KEY_PARITY",
      layerId: b.ownerLayerId,
      bindingId: b.id,
      message: `[A11Y_KEY_PARITY] Pointer reaction "${b.id}" on layer "${b.ownerLayerId}" has no keyboard or focus equivalent (grammar 6.11).`,
    });
  }
  return violations;
}

/** Scoped export keyboard gate predicate (ignores typing fields / external focus). */
export function shouldHandleScopedExportKeyEvent(event: {
  readonly tagName?: string;
  readonly isContentEditable?: boolean;
  readonly insideRoot: boolean;
}): boolean {
  if (!event.insideRoot) return false;
  if (event.isContentEditable) return false;
  const tag = (event.tagName ?? "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
  return true;
}

/** Generates standalone scoped keyboard listener code for exported pages. */
export function buildScopedKeyboardExportSource(rootAttr = "data-ll-root"): string {
  return `// Scoped LazyLayout keyboard handler (never intercepts inputs or outside page shortcuts)
export function attachScopedKeyboardHandlers(rootEl, onKey) {
  const onKeyDown = (e) => {
    const t = e.target;
    if (!t || !rootEl.contains(t)) return;
    const tag = t.tagName ? t.tagName.toUpperCase() : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
    onKey(e);
  };
  rootEl.setAttribute("${rootAttr}", "1");
  rootEl.addEventListener("keydown", onKeyDown);
  return () => rootEl.removeEventListener("keydown", onKeyDown);
}
`;
}
