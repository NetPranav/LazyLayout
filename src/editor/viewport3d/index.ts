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

export {
  AddMenu3d,
  AddMenuButton,
  openAddMenu,
  closeAddMenu,
  registerAddMenuCommand,
  useAddMenuStore,
  ADD_MENU_ITEMS,
  type MenuItemDef,
} from "./AddMenu3d";

export { PrimitiveHandles } from "./PrimitiveHandles";
export type { PrimitiveHandlesProps } from "./PrimitiveHandles";

export {
  TextEditOverlay3d,
  useTextEditRequest3d,
  requestTextEdit3d,
  endTextEdit3d,
} from "./TextEditOverlay3d";
export type { TextEditOverlay3dProps } from "./TextEditOverlay3d";

export { TextPanel3d } from "./TextPanel3d";
export type { TextPanel3dProps } from "./TextPanel3d";

export {
  fetchFontBuffer,
  installTestFontSeam,
  ensureFontLoaded,
  base64ToArrayBuffer,
} from "./textFontSeam";

