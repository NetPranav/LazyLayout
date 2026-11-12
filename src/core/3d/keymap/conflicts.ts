/**
 * ============================================================================
 * KEYMAP CONFLICT DETECTION & RESOLUTION (Phase 3D-020)
 * ============================================================================
 * Pure algorithms to detect keybinding collisions across overlapping contexts
 * and to resolve runtime key events into canonical command IDs.
 * ============================================================================
 */

import type { KeyBinding, Keymap, KeymapContext } from "./types";

export interface KeyEventLike {
  key: string;
  code?: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  button?: number;
}

/**
 * Standardizes a key identifier for comparison:
 * handles casing, whitespace, and numpad variants.
 */
export function normalizeKey(key: string): string {
  const k = key.trim().toLowerCase();
  if (k === "numpad." || k === "numpaddecimal") return "numpad.";
  if (k === "numpad1" || k === "numpad 1") return "numpad1";
  if (k === "numpad2" || k === "numpad 2") return "numpad2";
  if (k === "numpad3" || k === "numpad 3") return "numpad3";
  if (k === "numpad4" || k === "numpad 4") return "numpad4";
  if (k === "numpad5" || k === "numpad 5") return "numpad5";
  if (k === "numpad6" || k === "numpad 6") return "numpad6";
  if (k === "numpad7" || k === "numpad 7") return "numpad7";
  if (k === "numpad8" || k === "numpad 8") return "numpad8";
  if (k === "numpad9" || k === "numpad 9") return "numpad9";
  if (k === "numpad0" || k === "numpad 0") return "numpad0";
  return k;
}

/**
 * True if two contexts overlap: a `global` binding overlaps every context,
 * and identical non-global contexts overlap each other.
 */
export function contextsOverlap(c1: KeymapContext, c2: KeymapContext): boolean {
  return c1 === "global" || c2 === "global" || c1 === c2;
}

/**
 * Checks if two bindings have identical keys and modifier flags.
 */
export function bindingsMatchKeyAndModifiers(b1: KeyBinding, b2: KeyBinding): boolean {
  if (normalizeKey(b1.key) !== normalizeKey(b2.key)) return false;
  if (Boolean(b1.ctrl) !== Boolean(b2.ctrl)) return false;
  if (Boolean(b1.shift) !== Boolean(b2.shift)) return false;
  if (Boolean(b1.alt) !== Boolean(b2.alt)) return false;
  if (Boolean(b1.meta) !== Boolean(b2.meta)) return false;
  return true;
}

/**
 * Finds all pairs of conflicting keybindings within a keymap:
 * bindings that have the same key and modifiers in overlapping contexts.
 */
export function findConflicts(keymap: Keymap): Array<[KeyBinding, KeyBinding]> {
  const conflicts: Array<[KeyBinding, KeyBinding]> = [];
  const bindings = keymap.bindings;

  for (let i = 0; i < bindings.length; i++) {
    for (let j = i + 1; j < bindings.length; j++) {
      const b1 = bindings[i];
      const b2 = bindings[j];

      if (contextsOverlap(b1.context, b2.context) && bindingsMatchKeyAndModifiers(b1, b2)) {
        conflicts.push([b1, b2]);
      }
    }
  }

  return conflicts;
}

function eventMatchesModifiers(b: KeyBinding, event: KeyEventLike): boolean {
  const eventCtrl = Boolean(event.ctrl ?? event.ctrlKey);
  const eventShift = Boolean(event.shift ?? event.shiftKey);
  const eventAlt = Boolean(event.alt ?? event.altKey);
  const eventMeta = Boolean(event.meta ?? event.metaKey);

  return (
    Boolean(b.ctrl) === eventCtrl &&
    Boolean(b.shift) === eventShift &&
    Boolean(b.alt) === eventAlt &&
    Boolean(b.meta) === eventMeta
  );
}

function eventMatchesKey(b: KeyBinding, event: KeyEventLike): boolean {
  const bKey = normalizeKey(b.key);

  // Check mouse2 (right-click)
  if (bKey === "mouse2") {
    if (event.button === 2) return true;
    if (event.key && event.key.toLowerCase() === "mouse2") return true;
    return false;
  }

  const eKey = normalizeKey(event.key);
  if (bKey === eKey) return true;

  // Check event.code if available (e.g. physical Numpad1 vs key "1")
  if (event.code) {
    const eCode = normalizeKey(event.code);
    if (bKey === eCode) return true;
  }

  // Cross-match numpad keys: NumpadDecimal vs "."
  if (bKey === "numpad." && (eKey === "." || event.code === "NumpadDecimal")) return true;
  if (bKey === "." && (eKey === "numpad." || event.code === "NumpadDecimal")) return true;

  // Cross-match numpad numbers if code is NumpadDigit
  if (bKey.startsWith("numpad") && event.code && event.code.toLowerCase() === bKey) return true;

  return false;
}

/**
 * Resolves a key event into a command ID based on the keymap and active context.
 * Prioritizes context-specific bindings over `global` bindings.
 * Returns `null` if no matching binding is found.
 */
export function resolve(
  keymap: Keymap,
  event: KeyEventLike,
  context: KeymapContext
): string | null {
  let globalMatch: KeyBinding | null = null;

  for (const b of keymap.bindings) {
    if (!eventMatchesModifiers(b, event)) continue;
    if (!eventMatchesKey(b, event)) continue;

    if (b.context === context) {
      // Direct context match takes immediate priority
      return b.command;
    }

    if (b.context === "global" && !globalMatch) {
      globalMatch = b;
    }
  }

  return globalMatch ? globalMatch.command : null;
}
