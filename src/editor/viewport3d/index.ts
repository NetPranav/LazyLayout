/**
 * ============================================================================
 * 3D VIEWPORT INTERACTION MODULE (ROADMAP Phases 3D-014 – 3D-017)
 * ============================================================================
 * Public barrel export for 3D viewport interaction, navigation, gizmos,
 * modal transformations (G / R / S), snapping bar, view cube, and commands.
 * ============================================================================
 */

export { ViewportInteraction } from "./ViewportInteraction";
export type { ViewportInteractionProps } from "./types";

export { GizmoOverlay } from "./GizmoOverlay";
export type { GizmoOverlayProps } from "./GizmoOverlay";

export { SnapBar } from "./SnapBar";
export type { SnapBarProps } from "./SnapBar";

export { ViewCube } from "./ViewCube";
export type { ViewCubeProps } from "./ViewCube";

export { TransformStatus } from "./TransformStatus";
export type { TransformStatusProps } from "./TransformStatus";

export {
  registerViewport3dCommands,
  registerTransformTrigger,
  triggerModalTransform,
  registerBoxSelectTrigger,
  triggerBoxSelect,
} from "./viewCommands";

export {
  installAddAtCursorWrapper,
  addPrimitiveAtCursor,
  resolveAddArgsWithCursor,
  ADD_PRIMITIVE_COMMAND_IDS,
  type AddPrimitiveCommandId,
  type AddAtCursorArgs,
} from "./addAtCursor";

export type {
  ModalTransformState,
  ViewportInteractionMode,
  DragGizmoState,
  BoxSelectState,
  LassoSelectState,
} from "./types";
