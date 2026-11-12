/**
 * ============================================================================
 * BLENDER KEYMAP PRESET (Phase 3D-020)
 * ============================================================================
 * Canonical shortcuts matching Blender defaults:
 * - G, R, S: modal translate, rotate, scale
 * - Tab: toggle edit mode
 * - Numpad 1, 3, 7: front, right, top (Ctrl: back, left, bottom)
 * - Numpad 5: toggle ortho / perspective
 * - Numpad .: frame selected
 * - Home: frame all
 * - Numpad 0: camera view
 * - Shift+A: add menu
 * - X, Delete: delete
 * - H: hide, Alt+H: unhide all
 * - A: select all, Alt+A: select none
 * - Ctrl+I: invert selection
 * - L: select linked (in edit mode)
 * - Shift+G: select similar
 * - B: box select
 * - Shift+D: duplicate
 * - Ctrl+P: parent, Alt+P: unparent
 * - Shift+Z: toggle wireframe (numpad-free shading)
 * - Alt+Z: toggle x-ray
 * - Shift+C: reset 3D cursor
 * - Shift+right-click (mouse2): place 3D cursor
 * ============================================================================
 */

import type { KeyBinding, Keymap } from "./types";

export const BLENDER_KEYMAP_BINDINGS: KeyBinding[] = [
  // Modal transforms
  { command: "3d.transform.translate", key: "g", context: "object" },
  { command: "3d.transform.rotate", key: "r", context: "object" },
  { command: "3d.transform.scale", key: "s", context: "object" },

  // Mode toggling
  { command: "3d.mode.toggle_edit", key: "Tab", context: "global" },

  // Numpad view navigation
  { command: "3d.view.front", key: "Numpad1", context: "global" },
  { command: "3d.view.back", key: "Numpad1", ctrl: true, context: "global" },
  { command: "3d.view.right", key: "Numpad3", context: "global" },
  { command: "3d.view.left", key: "Numpad3", ctrl: true, context: "global" },
  { command: "3d.view.top", key: "Numpad7", context: "global" },
  { command: "3d.view.bottom", key: "Numpad7", ctrl: true, context: "global" },
  { command: "3d.view.toggle_ortho", key: "Numpad5", context: "global" },
  { command: "3d.view.frame_selected", key: "Numpad.", context: "global" },
  { command: "3d.view.frame_all", key: "Home", context: "global" },
  { command: "3d.view.camera", key: "Numpad0", context: "global" },

  // Add menu
  { command: "3d.menu.add", key: "a", shift: true, context: "object" },

  // Deletion
  { command: "3d.object.delete", key: "x", context: "object" },
  { command: "3d.object.delete", key: "Delete", context: "object" },

  // Visibility
  { command: "3d.object.hide", key: "h", context: "object" },
  { command: "3d.object.unhide_all", key: "h", alt: true, context: "object" },

  // Selection
  { command: "3d.select.all", key: "a", context: "object" },
  { command: "3d.select.none", key: "a", alt: true, context: "object" },
  { command: "3d.select.invert", key: "i", ctrl: true, context: "object" },
  { command: "3d.select.linked", key: "l", context: "edit" },
  { command: "3d.select.similar", key: "g", shift: true, context: "object" },
  { command: "3d.select.box", key: "b", context: "object" },

  // Hierarchy & duplication
  { command: "3d.object.duplicate", key: "d", shift: true, context: "object" },
  { command: "3d.object.parent", key: "p", ctrl: true, context: "object" },
  { command: "3d.object.unparent", key: "p", alt: true, context: "object" },

  // Shading & overlays
  { command: "3d.shading.wireframe", key: "z", shift: true, context: "global" },
  { command: "3d.shading.toggle_xray", key: "z", alt: true, context: "global" },

  // 3D Cursor
  { command: "3d.cursor.reset", key: "c", shift: true, context: "global" },
  { command: "3d.cursor.place", key: "mouse2", shift: true, context: "global" },
];

export const blenderKeymap: Keymap = {
  id: "blender",
  bindings: BLENDER_KEYMAP_BINDINGS,
};
