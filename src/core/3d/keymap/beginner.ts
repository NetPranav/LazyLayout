/**
 * ============================================================================
 * BEGINNER KEYMAP PRESET (Phase 3D-020)
 * ============================================================================
 * Editor-native shortcuts tailored for beginners:
 * - V, R, S: translate (move), rotate, scale in object context (never colliding
 *   with 2D canvas tools or global commands).
 * - Delete, Backspace: delete selected object
 * - Ctrl+D: duplicate
 * - Ctrl+A: select all
 * - Escape: deselect all
 * - Tab: toggle edit mode
 * - F: frame selected
 * - Home: frame all
 * - Z: wireframe toggle
 * - Shift+Z: x-ray toggle
 *
 * All other canonical 3D commands are designated `toolbarOnly: true` so that
 * beginners can access full functionality purely through viewport UI buttons.
 * ============================================================================
 */

import { CANONICAL_3D_COMMAND_IDS } from "./types";
import type { KeyBinding, Keymap } from "./types";

export interface ToolbarCommandItem {
  command: string;
  toolbarOnly: true;
}

export const BEGINNER_KEYMAP_BINDINGS: KeyBinding[] = [
  // Simple unshifted transforms (in object context to prevent 2D tool collisions)
  { command: "3d.transform.translate", key: "v", context: "object" },
  { command: "3d.transform.rotate", key: "r", context: "object" },
  { command: "3d.transform.scale", key: "s", context: "object" },

  // Deletion
  { command: "3d.object.delete", key: "Delete", context: "object" },
  { command: "3d.object.delete", key: "Backspace", context: "object" },

  // Duplication & Selection
  { command: "3d.object.duplicate", key: "d", ctrl: true, context: "object" },
  { command: "3d.select.all", key: "a", ctrl: true, context: "object" },
  { command: "3d.select.none", key: "Escape", context: "object" },

  // Mode
  { command: "3d.mode.toggle_edit", key: "Tab", context: "object" },

  // View framing
  { command: "3d.view.frame_selected", key: "f", context: "object" },
  { command: "3d.view.frame_all", key: "Home", context: "object" },

  // Shading
  { command: "3d.shading.wireframe", key: "z", context: "object" },
  { command: "3d.shading.toggle_xray", key: "z", shift: true, context: "object" },
];

const BOUND_COMMAND_SET = new Set(BEGINNER_KEYMAP_BINDINGS.map((b) => b.command));

/**
 * Commands accessible via toolbar buttons rather than keyboard shortcuts.
 * Ensures every canonical 3D command is reachable without memorizing keys.
 */
export const BEGINNER_TOOLBAR_ONLY: readonly string[] = CANONICAL_3D_COMMAND_IDS.filter(
  (id) => !BOUND_COMMAND_SET.has(id)
);

export const BEGINNER_TOOLBAR_COMMANDS: ToolbarCommandItem[] = BEGINNER_TOOLBAR_ONLY.map(
  (command) => ({ command, toolbarOnly: true as const })
);

export const beginnerKeymap: Keymap = {
  id: "beginner",
  bindings: BEGINNER_KEYMAP_BINDINGS,
  toolbarOnly: [...BEGINNER_TOOLBAR_ONLY],
};
