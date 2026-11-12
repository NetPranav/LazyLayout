/**
 * ============================================================================
 * 3D VIEWPORT INTERACTION TYPES (ROADMAP Phases 3D-014 – 3D-017)
 * ============================================================================
 * Type contracts for viewport pointer navigation, gizmo dragging, modal
 * transformations (G / R / S), box / lasso selection, and snapping controls.
 * ============================================================================
 */

import type { TransformMode, TransformAxis } from "@/core/3d/transform/typed";
import type { TransformSession, CommittedTransform } from "@/core/3d/transform/session";
import type { GizmoHandle } from "@/core/3d/transform/gizmo";
import type { Vec3 } from "@/core/3d/math";

export interface ModalTransformState {
  mode: TransformMode;
  session: TransformSession;
  startClientX: number;
  startClientY: number;
  axis: TransformAxis | null;
  planeLocked: boolean;
  numericString: string;
  hasNumericInput: boolean;
  committedTransforms: CommittedTransform[];
  statusText: string;
}

export type ViewportInteractionMode =
  | "idle"
  | "navigating" // Orbit / Pan / Dolly via pointer capture
  | "gizmo_drag" // Dragging a translation/rotation/scale gizmo handle
  | "modal_transform" // Modal G / R / S keyboard + mouse session
  | "box_select" // Dragging selection rectangle
  | "lasso_select"; // Freeform polygonal selection lasso

export interface DragGizmoState {
  handle: GizmoHandle;
  startPointer: { x: number; y: number };
  startOrigin: Vec3;
  objectId: string;
}

export interface BoxSelectState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface LassoSelectState {
  points: Array<{ x: number; y: number }>;
}

export interface ViewportInteractionProps {
  sceneId: string;
  width: number;
  height: number;
  className?: string;
}
