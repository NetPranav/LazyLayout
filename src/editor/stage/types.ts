import type { CanvasTool, GridStyle } from "@/editor/shell/canvas-chrome/types";
import type { ResizeHandleName } from "./constants";
import type { SnapLine, SpacingMark } from "@/core/geometry/snap";

export type StagePreset = "1440" | "768" | "375" | string;

export interface StageElement {
  id: string;
  name?: string;
  type?: "text" | "button" | "image" | "container" | string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  title?: string;
  subtitle?: string;
  label?: string;
  hidden?: boolean;
  locked?: boolean;
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
  snapGuides?: boolean;
  empty?: boolean;
  onAddFrame?: () => void;
  onInsert?: () => void;
  onAskAi?: () => void;
  onElementChange?: (id: string, patch: Partial<StageElement>) => void;
  mode?: "design" | "motion" | "code";
  snapLines?: SnapLine[];
  spacingMarks?: SpacingMark[];
  onStartMove?: (elementId: string, e: React.PointerEvent) => void;
  onStartResize?: (handle: ResizeHandleName, e: React.PointerEvent) => void;
}
