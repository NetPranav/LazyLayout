/**
 * ============================================================================
 * 3D SELECTION REDUCER & GEOMETRIC PICKING (Phase 3D-015)
 * ============================================================================
 * Pure immutable selection state and operations:
 *   - Selection3d: { active: string | null, selected: string[] }
 *   - click: Blender-style active/selected click toggling with Shift and Ctrl
 *   - selectAll, selectNone, invert
 *   - boxSelect: 2D rectangular screen/NDC projection of bounding box centers
 *   - lassoSelect: 2D polygonal raycast containment of projected origins
 *   - selectLinked: finds all objects within the same parent hierarchy tree
 *   - selectSimilar: selects by type, material, or shared dataId
 *   - selectLinkedFaces: topology flood-fill of triangle faces sharing edges
 * ============================================================================
 */

import type { MotionDocument } from "../../document/schema";
import type { BoundingBox3d } from "../camera/viewCamera";
import { type Mat4, type Vec3, transformPoint } from "../math";

// ---------------------------------------------------------------------------
// Selection Model & Construction
// ---------------------------------------------------------------------------

export interface Selection3d {
  readonly active: string | null;
  readonly selected: readonly string[];
}

export type SelectionMode = "replace" | "add" | "subtract";

/** Canonical 3D selection command IDs (Phase 3D-015, DOCS/3D/tasks/B2-ids.md) */
export const SELECTION_COMMANDS = {
  all: "3d.select.all",
  none: "3d.select.none",
  invert: "3d.select.invert",
  linked: "3d.select.linked",
  similar: "3d.select.similar",
  box: "3d.select.box",
} as const;

export const EMPTY_SELECTION: Selection3d = Object.freeze({
  active: null,
  selected: Object.freeze([]),
});

export function createSelection3d(initial?: Partial<Selection3d>): Selection3d {
  const selected = initial?.selected ? Array.from(new Set(initial.selected)) : [];
  let active = initial?.active ?? null;

  if (active !== null && !selected.includes(active)) {
    active = selected[0] ?? null;
  }

  return Object.freeze({
    active,
    selected: Object.freeze(selected),
  });
}

// ---------------------------------------------------------------------------
// Click Selection Reducer
// ---------------------------------------------------------------------------

export interface ClickModifiers {
  readonly shift?: boolean;
  readonly ctrl?: boolean;
}

/**
 * Updates selection based on a clicked object ID (or null when clicking empty space),
 * obeying Blender selection conventions:
 *   - Regular click: Selects only hitId (clears on background click).
 *   - Shift + click: Toggles hitId in selection. If already selected but not active, makes it active.
 *   - Ctrl + click: Removes hitId from selection.
 */
export function click(
  sel: Selection3d,
  hitId: string | null,
  modifiers?: ClickModifiers
): Selection3d {
  const shift = !!modifiers?.shift;
  const ctrl = !!modifiers?.ctrl;

  // Background click
  if (hitId === null) {
    if (shift) {
      // Shift-clicking empty space maintains current selection
      return sel;
    }
    return EMPTY_SELECTION;
  }

  // Ctrl-click: deselect hitId
  if (ctrl) {
    if (!sel.selected.includes(hitId)) {
      return sel;
    }
    const newSelected = sel.selected.filter((id) => id !== hitId);
    const newActive =
      sel.active === hitId ? (newSelected[newSelected.length - 1] ?? null) : sel.active;

    return Object.freeze({
      active: newActive,
      selected: Object.freeze(newSelected),
    });
  }

  // Shift-click: toggle or activate
  if (shift) {
    if (!sel.selected.includes(hitId)) {
      // Add to selection and become active
      const newSelected = [...sel.selected, hitId];
      return Object.freeze({
        active: hitId,
        selected: Object.freeze(newSelected),
      });
    } else {
      // Already selected
      if (sel.active === hitId) {
        // Deselect when clicking the already-active item
        const newSelected = sel.selected.filter((id) => id !== hitId);
        const newActive = newSelected[newSelected.length - 1] ?? null;
        return Object.freeze({
          active: newActive,
          selected: Object.freeze(newSelected),
        });
      } else {
        // Shift-clicking an already selected item makes it active
        return Object.freeze({
          ...sel,
          active: hitId,
        });
      }
    }
  }

  // Normal click without modifiers
  return Object.freeze({
    active: hitId,
    selected: Object.freeze([hitId]),
  });
}

/**
 * Selects all provided IDs.
 */
export function selectAll(
  sel: Selection3d,
  allIds: readonly string[]
): Selection3d {
  const unique = Array.from(new Set(allIds));
  const active =
    sel.active && unique.includes(sel.active) ? sel.active : (unique[0] ?? null);

  return Object.freeze({
    active,
    selected: Object.freeze(unique),
  });
}

/**
 * Clears selection.
 */
export function selectNone(_sel?: Selection3d): Selection3d {
  return EMPTY_SELECTION;
}

/**
 * Inverts the selection relative to the given universe of all IDs.
 */
export function invert(
  sel: Selection3d,
  allIds: readonly string[]
): Selection3d {
  const currentSet = new Set(sel.selected);
  const newSelected = allIds.filter((id) => !currentSet.has(id));
  const newActive = newSelected[0] ?? null;

  return Object.freeze({
    active: newActive,
    selected: Object.freeze(newSelected),
  });
}

// ---------------------------------------------------------------------------
// Box & Lasso Selection
// ---------------------------------------------------------------------------

export interface ScreenRect {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Selects objects whose projected bounding box center lies within the given 2D rectangle.
 * Supports screen coordinates (with optional viewport dimensions) or NDC coordinates.
 */
export function boxSelect(
  objects: readonly { readonly id: string; readonly bounds: BoundingBox3d }[],
  rect: ScreenRect,
  viewProj: Mat4,
  mode: SelectionMode = "replace",
  viewport?: ViewportSize,
  sel: Selection3d = EMPTY_SELECTION
): Selection3d {
  const minX = Math.min(rect.x1, rect.x2);
  const maxX = Math.max(rect.x1, rect.x2);
  const minY = Math.min(rect.y1, rect.y2);
  const maxY = Math.max(rect.y1, rect.y2);

  const hitIds: string[] = [];

  for (const obj of objects) {
    const b = obj.bounds;
    const cx = (b.min[0] + b.max[0]) * 0.5;
    const cy = (b.min[1] + b.max[1]) * 0.5;
    const cz = (b.min[2] + b.max[2]) * 0.5;

    // Project center to NDC
    const ndc = transformPoint(viewProj, [cx, cy, cz]);

    // Check if behind near plane
    if (ndc[2] < -1.0 || ndc[2] > 1.0) continue;

    let testX = ndc[0];
    let testY = ndc[1];

    if (viewport && viewport.width > 0 && viewport.height > 0) {
      // Convert NDC to screen pixels
      testX = (ndc[0] + 1.0) * 0.5 * viewport.width;
      testY = (1.0 - ndc[1]) * 0.5 * viewport.height;
    }

    if (testX >= minX && testX <= maxX && testY >= minY && testY <= maxY) {
      hitIds.push(obj.id);
    }
  }

  return applySelectionMode(sel, hitIds, mode);
}

/**
 * Standard 2D point-in-polygon test (ray casting algorithm).
 */
export function isPointInPolygon(
  px: number,
  py: number,
  polygon: readonly { readonly x: number; readonly y: number }[]
): boolean {
  let inside = false;
  const n = polygon.length;
  if (n < 3) return false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Selects objects whose projected origin lies within a 2D lasso polygon.
 */
export function lassoSelect(
  objects: readonly { readonly id: string; readonly origin: Vec3 | ArrayLike<number> }[],
  polygon: readonly { readonly x: number; readonly y: number }[],
  viewProj: Mat4,
  mode: SelectionMode = "replace",
  viewport?: ViewportSize,
  sel: Selection3d = EMPTY_SELECTION
): Selection3d {
  if (polygon.length < 3) return sel;

  const hitIds: string[] = [];

  for (const obj of objects) {
    const ndc = transformPoint(viewProj, obj.origin);

    // Behind camera check
    if (ndc[2] < -1.0 || ndc[2] > 1.0) continue;

    let testX = ndc[0];
    let testY = ndc[1];

    if (viewport && viewport.width > 0 && viewport.height > 0) {
      testX = (ndc[0] + 1.0) * 0.5 * viewport.width;
      testY = (1.0 - ndc[1]) * 0.5 * viewport.height;
    }

    if (isPointInPolygon(testX, testY, polygon)) {
      hitIds.push(obj.id);
    }
  }

  return applySelectionMode(sel, hitIds, mode);
}

function applySelectionMode(
  sel: Selection3d,
  hitIds: readonly string[],
  mode: SelectionMode
): Selection3d {
  if (mode === "replace") {
    const unique = Array.from(new Set(hitIds));
    const active =
      sel.active && unique.includes(sel.active) ? sel.active : (unique[0] ?? null);
    return Object.freeze({
      active,
      selected: Object.freeze(unique),
    });
  }

  if (mode === "add") {
    const combined = Array.from(new Set([...sel.selected, ...hitIds]));
    const active = sel.active ?? (hitIds[0] ?? null);
    return Object.freeze({
      active,
      selected: Object.freeze(combined),
    });
  }

  if (mode === "subtract") {
    const removeSet = new Set(hitIds);
    const remaining = sel.selected.filter((id) => !removeSet.has(id));
    const active =
      sel.active && !removeSet.has(sel.active)
        ? sel.active
        : (remaining[remaining.length - 1] ?? null);
    return Object.freeze({
      active,
      selected: Object.freeze(remaining),
    });
  }

  return sel;
}

// ---------------------------------------------------------------------------
// Select Linked & Similar
// ---------------------------------------------------------------------------

/**
 * Selects all objects sharing the same parent tree / root hierarchy with current selection.
 */
export function selectLinked(
  sel: Selection3d,
  doc: MotionDocument
): Selection3d {
  if (sel.selected.length === 0 || !doc.objects) {
    return sel;
  }

  const objects = doc.objects;

  // Find root ancestor for an object ID
  function findRoot(id: string): string {
    let curr = id;
    const visited = new Set<string>();
    while (objects[curr]?.parentId) {
      if (visited.has(curr)) break;
      visited.add(curr);
      const parent = objects[curr].parentId;
      if (!parent || !objects[parent]) break;
      curr = parent;
    }
    return curr;
  }

  // Collect roots of all currently selected objects
  const selectedRoots = new Set<string>();
  for (const id of sel.selected) {
    if (objects[id]) {
      selectedRoots.add(findRoot(id));
    }
  }

  // Find all objects whose root is in selectedRoots
  const linked = new Set<string>();
  for (const id of Object.keys(objects)) {
    const root = findRoot(id);
    if (selectedRoots.has(root)) {
      linked.add(id);
    }
  }

  const newSelected = Array.from(linked);
  const newActive =
    sel.active && linked.has(sel.active) ? sel.active : (newSelected[0] ?? null);

  return Object.freeze({
    active: newActive,
    selected: Object.freeze(newSelected),
  });
}

/**
 * Selects objects sharing properties with the active object:
 *   - "type":     same ObjectType3d ("mesh", "light", "camera", etc.)
 *   - "material": shares any assigned material ID
 *   - "data":     shares the same dataId (mesh data block, light block, etc.)
 */
export function selectSimilar(
  sel: Selection3d,
  doc: MotionDocument,
  by: "type" | "material" | "data"
): Selection3d {
  if (!sel.active || !doc.objects) return sel;

  const activeObj = doc.objects[sel.active];
  if (!activeObj) return sel;

  const matched = new Set<string>();

  for (const [id, obj] of Object.entries(doc.objects)) {
    if (by === "type") {
      if (obj.type === activeObj.type) {
        matched.add(id);
      }
    } else if (by === "data") {
      if (obj.dataId && activeObj.dataId && obj.dataId === activeObj.dataId) {
        matched.add(id);
      }
    } else if (by === "material") {
      const activeMats = new Set(activeObj.materialSlots ?? []);
      if (activeMats.size > 0 && obj.materialSlots) {
        for (const mat of obj.materialSlots) {
          if (activeMats.has(mat)) {
            matched.add(id);
            break;
          }
        }
      }
    }
  }

  const newSelected = Array.from(matched);
  return Object.freeze({
    active: sel.active,
    selected: Object.freeze(newSelected),
  });
}

// ---------------------------------------------------------------------------
// Face-Level Topology Flood-Fill
// ---------------------------------------------------------------------------

/**
 * Returns all triangle face indices connected to `seedFace` across shared mesh edges.
 */
export function selectLinkedFaces(
  mesh: {
    readonly indices: ArrayLike<number>;
    readonly positions?: ArrayLike<number>;
  },
  seedFace: number
): number[] {
  const indices = mesh.indices;
  const numFaces = Math.floor(indices.length / 3);

  if (seedFace < 0 || seedFace >= numFaces) {
    return [];
  }

  // Edge to faces adjacency map
  // Key: "minIdx:maxIdx" -> array of face indices
  const edgeToFaces = new Map<string, number[]>();

  function makeEdgeKey(v0: number, v1: number): string {
    return v0 < v1 ? `${v0}:${v1}` : `${v1}:${v0}`;
  }

  for (let f = 0; f < numFaces; f++) {
    const v0 = indices[f * 3];
    const v1 = indices[f * 3 + 1];
    const v2 = indices[f * 3 + 2];

    const e0 = makeEdgeKey(v0, v1);
    const e1 = makeEdgeKey(v1, v2);
    const e2 = makeEdgeKey(v2, v0);

    let list0 = edgeToFaces.get(e0);
    if (!list0) {
      list0 = [];
      edgeToFaces.set(e0, list0);
    }
    list0.push(f);

    let list1 = edgeToFaces.get(e1);
    if (!list1) {
      list1 = [];
      edgeToFaces.set(e1, list1);
    }
    list1.push(f);

    let list2 = edgeToFaces.get(e2);
    if (!list2) {
      list2 = [];
      edgeToFaces.set(e2, list2);
    }
    list2.push(f);
  }

  // BFS flood-fill from seedFace
  const visited = new Set<number>();
  const queue: number[] = [seedFace];
  visited.add(seedFace);

  while (queue.length > 0) {
    const currFace = queue.shift()!;
    const v0 = indices[currFace * 3];
    const v1 = indices[currFace * 3 + 1];
    const v2 = indices[currFace * 3 + 2];

    const edges = [makeEdgeKey(v0, v1), makeEdgeKey(v1, v2), makeEdgeKey(v2, v0)];

    for (const e of edges) {
      const neighbors = edgeToFaces.get(e);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
  }

  return Array.from(visited).sort((a, b) => a - b);
}
