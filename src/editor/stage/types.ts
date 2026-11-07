import type React from "react";
import type { CanvasTool, GridStyle, ShapeTool } from "@/editor/shell/canvas-chrome/types";
import type { Layer } from "@/core/document/schema";
import type { ResizeHandleName } from "./constants";
import type { SnapLine, SpacingMark } from "@/core/geometry/snap";
import type { LayerMenuAction } from "@/editor/shell/left-panel/types";

export type StagePreset = "1440" | "768" | "375" | string;

export interface StageElement {
  id: string;
  name?: string;
  type?: "text" | "button" | "image" | "container" | string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where the layer's parent starts on the page; `x` and `y` are page positions, the document keeps them relative to this. */
  ox?: number;
  oy?: number;
  rotation?: number;
  title?: string;
  subtitle?: string;
  label?: string;
  hidden?: boolean;
  locked?: boolean;
  targetId?: string;
  mirrorId?: string;
}

export interface StageFrameInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TransformGestureState {
  type: "move" | "resize";
  handle?: ResizeHandleName;
  startX: number;
  startY: number;
  initialElements: Record<string, { x: number; y: number; width: number; height: number }>;
  currentElements: Record<string, { x: number; y: number; width: number; height: number }>;
}

/** The box a drag is drawing, in the artboard's own pixels (before it becomes a layer). */
export interface DrawPreview {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** What is being drawn, so the preview has its outline (an ellipse is round, a star pointed). */
  archetype?: string;
}

export interface StageProps {
  /** Canvas content zoom level (e.g. 0.59). Defaults to 0.59 */
  zoom?: number;

  /** Canvas pan offset */
  pan?: { x: number; y: number };

  /** Currently selected element IDs. Controlled or store-backed */
  selectedIds?: string[];

  /** Selection callback */
  onSelect?: (id: string | null, multi?: boolean) => void;

  /** Frames on canvas (override for tests/labs; otherwise reads from store) */
  frames?: StageFrameInfo[];

  /** Elements on artboard (override for tests/labs; otherwise reads from store) */
  elements?: Record<string, StageElement>;

  /** Active canvas tool from canvas chrome */
  activeTool?: CanvasTool;

  /** Which shape the Shape tool draws */
  activeShape?: ShapeTool;

  /** Called when a tool has made its layer, so the tool can go back to Select */
  onToolDone?: () => void;

  /** Snapping options */
  snapObjects?: boolean;
  snapGuides?: boolean;
  smartGuides?: boolean;
  snapThreshold?: number;

  /** Grid and rulers view options */
  showRulers?: boolean;
  pixelGrid?: boolean;
  checkerboard?: boolean;
  gridStyle?: GridStyle;
  gridSize?: number;

  /** Active artboard size preset */
  preset?: StagePreset;
  onPresetChange?: (preset: StagePreset) => void;

  /** Artboard title (default: "LazyLayout") */
  title?: string;

  /** Empty artboard state */
  empty?: boolean;
  onAddFrame?: () => void;
  onInsert?: () => void;
  onAskAi?: () => void;

  /** Mode ("design" | "motion" | "code") */
  mode?: "design" | "motion" | "code";

  className?: string;
}

export interface ArtboardProps {
  /** Filled with the element the engine draws the page into; the page is measured from it. */
  pageRef?: React.RefObject<HTMLDivElement | null>;
  /** The page's top-level layer: the whole tree under it is drawn by the engine. */
  rootId?: string | null;
  /** The page's own background colour (the Background block); absent keeps the board colour. */
  background?: string;
  id?: string;
  title?: string;
  preset?: StagePreset;
  onPresetChange?: (preset: StagePreset) => void;
  width?: number;
  height?: number;
  zoom?: number;
  pan?: { x: number; y: number };
  elements: Record<string, StageElement>;
  selectedIds: string[];
  hoveredId: string | null;
  onSelect: (id: string | null, multi?: boolean) => void;
  onHover: (id: string | null) => void;
  activeTool?: CanvasTool;
  /** The document's layers: a layer the prototype elements don't cover is drawn through the engine's render definition. */
  layers?: Record<string, Layer>;
  /** The box being drawn by a creation tool */
  drawPreview?: DrawPreview | null;
  snapGuides?: boolean;
  empty?: boolean;
  /** Drawn beside the page (the reference pages of a loading page). The page is shown even when it is empty. */
  references?: React.ReactNode;
  onAddFrame?: () => void;
  onInsert?: () => void;
  onAskAi?: () => void;
  onElementChange?: (id: string, patch: Partial<StageElement>) => void;
  onLayerAction?: (action: LayerMenuAction, id: string) => void;
  onToggleHidden?: (id: string) => void;
  onToggleLocked?: (id: string) => void;
  mode?: "design" | "motion" | "code";
  snapLines?: SnapLine[];
  spacingMarks?: SpacingMark[];
  onStartMove?: (elementId: string, e: React.PointerEvent) => void;
  onStartResize?: (handle: ResizeHandleName, e: React.PointerEvent) => void;
}
