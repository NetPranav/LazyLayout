/**
 * ============================================================================
 * 3D TRANSFORM PIVOTS (Phase 3D-017)
 * ============================================================================
 * Computes transformation pivot points for selections:
 * - "median": arithmetic center of selection
 * - "individual": separate pivot per object origin
 * - "cursor": 3D cursor position
 * - "active": active object's origin
 * ============================================================================
 */

import { type Mat4, type Vec3, mat4From, vec3, vec3From } from "../math";

export type PivotKind = "median" | "individual" | "cursor" | "active";

export interface PivotSelectionItem {
  id?: string;
  worldMatrix?: Mat4 | ArrayLike<number>;
  location?: Vec3 | ArrayLike<number>;
  position?: Vec3 | ArrayLike<number>;
  isActive?: boolean;
}

export type CursorInput =
  | Vec3
  | ArrayLike<number>
  | { position: Vec3 | ArrayLike<number> };

export interface IndividualPivot {
  id?: string;
  point: Vec3;
}

/**
 * Extracts world position from a selection item.
 */
function extractPosition(item: PivotSelectionItem): Vec3 {
  if (item.position) {
    return vec3From(item.position);
  }
  if (item.location) {
    return vec3From(item.location);
  }
  if (item.worldMatrix) {
    const m = mat4From(item.worldMatrix);
    return vec3(m[12], m[13], m[14]);
  }
  return vec3(0, 0, 0);
}

/**
 * Extracts 3D coordinates from cursor input.
 */
function extractCursor(cursor?: CursorInput): Vec3 {
  if (!cursor) return vec3(0, 0, 0);
  if ("position" in cursor && cursor.position) {
    return vec3From(cursor.position);
  }
  return vec3From(cursor as Vec3 | ArrayLike<number>);
}

/**
 * Computes pivot point(s) for a selection.
 */
export function pivotPoint(
  kind: "individual",
  selection: PivotSelectionItem[],
  cursor?: CursorInput
): IndividualPivot[];
export function pivotPoint(
  kind: "median" | "cursor" | "active",
  selection: PivotSelectionItem[],
  cursor?: CursorInput
): Vec3;
export function pivotPoint(
  kind: PivotKind,
  selection: PivotSelectionItem[],
  cursor?: CursorInput
): Vec3 | IndividualPivot[];
export function pivotPoint(
  kind: PivotKind,
  selection: PivotSelectionItem[],
  cursor?: CursorInput
): Vec3 | IndividualPivot[] {
  const cPoint = extractCursor(cursor);

  if (kind === "cursor") {
    return cPoint;
  }

  if (kind === "individual") {
    if (selection.length === 0) {
      return [{ point: cPoint }];
    }
    return selection.map((item) => ({
      id: item.id,
      point: extractPosition(item),
    }));
  }

  if (kind === "active") {
    if (selection.length === 0) {
      return cPoint;
    }
    // Active item is item with isActive: true, or the last item selected
    const activeItem = selection.find((item) => item.isActive) ?? selection[selection.length - 1];
    return extractPosition(activeItem);
  }

  // kind === "median"
  if (selection.length === 0) {
    return cPoint;
  }

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (const item of selection) {
    const pos = extractPosition(item);
    sumX += pos[0];
    sumY += pos[1];
    sumZ += pos[2];
  }

  const count = selection.length;
  return vec3(sumX / count, sumY / count, sumZ / count);
}
