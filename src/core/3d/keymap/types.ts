/**
 * ============================================================================
 * 3D KEYMAP TYPES (Phase 3D-020)
 * ============================================================================
 * Pure data types for 3D viewport keymaps (Blender and Beginner presets).
 * No DOM references; deterministic resolution and conflict detection.
 * ============================================================================
 */

export type KeymapContext = "global" | "object" | "edit" | "modal";
export type KeymapId = "blender" | "beginner";

export interface KeyBinding {
  command: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  context: KeymapContext;
}

export interface Keymap {
  id: KeymapId;
  bindings: KeyBinding[];
  toolbarOnly?: string[];
}

/**
 * All 60 canonical 3D command IDs from `DOCS/3D/tasks/B2-ids.md`.
 */
export const CANONICAL_3D_COMMAND_IDS = [
  // Adding
  "3d.add.cube",
  "3d.add.sphere",
  "3d.add.cylinder",
  "3d.add.cone",
  "3d.add.plane",
  "3d.add.torus",
  "3d.add.icosphere",
  "3d.add.light.point",
  "3d.add.light.sun",
  "3d.add.light.spot",
  "3d.add.camera",
  "3d.add.empty",
  // Object
  "3d.object.delete",
  "3d.object.duplicate",
  "3d.object.rename",
  "3d.object.parent",
  "3d.object.unparent",
  "3d.object.hide",
  "3d.object.unhide_all",
  "3d.object.apply_transform",
  "3d.object.set_origin",
  "3d.object.set_location",
  "3d.object.set_rotation",
  "3d.object.set_scale",
  "3d.object.join",
  // Materials
  "3d.material.add",
  "3d.material.assign",
  "3d.material.make_single_user",
  "3d.material.set",
  // Selection
  "3d.select.all",
  "3d.select.none",
  "3d.select.invert",
  "3d.select.linked",
  "3d.select.similar",
  "3d.select.box",
  // Transform (modal)
  "3d.transform.translate",
  "3d.transform.rotate",
  "3d.transform.scale",
  // View
  "3d.view.front",
  "3d.view.back",
  "3d.view.left",
  "3d.view.right",
  "3d.view.top",
  "3d.view.bottom",
  "3d.view.toggle_ortho",
  "3d.view.frame_selected",
  "3d.view.frame_all",
  "3d.view.camera",
  // Mode/shading/overlay
  "3d.mode.toggle_edit",
  "3d.shading.wireframe",
  "3d.shading.solid",
  "3d.shading.material",
  "3d.shading.rendered",
  "3d.shading.toggle_xray",
  "3d.overlay.toggle_grid",
  "3d.overlay.toggle_stats",
  "3d.cursor.place",
  "3d.cursor.reset",
  "3d.snap.toggle",
  // Menu
  "3d.menu.add",
] as const;

export type Canonical3DCommandId = (typeof CANONICAL_3D_COMMAND_IDS)[number];

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_3D_COMMAND_IDS);

export function isCanonical3DCommand(id: string): id is Canonical3DCommandId {
  return CANONICAL_SET.has(id);
}
