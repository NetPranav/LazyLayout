import type { CollabUser } from "@/editor/components/AvatarStack";

export type CanvasTool = "select" | "hand" | "frame" | "shape" | "text" | "image" | "pen" | "pencil";

export type ShapeTool = "box" | "circle" | "line" | "arrow" | "poly" | "star";

export type ExtendedCanvasTool = CanvasTool | "split" | "pen";
export type ExtendedShapeTool = ShapeTool | "pen";

export type GridStyle = "dots" | "lines" | "none";

export type MotionFeel = "smooth" | "lively" | "bouncy";

export type AiState = "idle" | "work" | "done";

export interface CanvasChromeProps {
  /** Active editor mode (design, motion, code). Controls motion-mode toolbar tools (.mtools). */
  mode?: "design" | "motion" | "code";

  /** Canvas content slot (artboard, stage elements). Phase 2 mounts inside this slot. */
  children?: React.ReactNode;

  /** Whether top and left rulers are visible. Default: false */
  showRulers?: boolean;
  onToggleRulers?: (show: boolean) => void;

  /** Currently selected canvas tool. Default: "select" */
  activeTool?: CanvasTool;
  onSelectTool?: (tool: CanvasTool) => void;

  /** Active shape variant when shape tool is selected. Default: "box" */
  activeShape?: ShapeTool;
  onSelectShape?: (shape: ShapeTool) => void;

  /** Canvas zoom factor (e.g. 0.59 for 59%, 1.0 for 100%). Default: 0.59 */
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoom100?: () => void;
  onZoomFit?: () => void;
  onZoomSelection?: () => void;

  /** Insert box overlay state */
  isInsertOpen?: boolean;
  onToggleInsert?: (open?: boolean) => void;
  onInsertItem?: (itemName: string) => void;

  /** Spotlight command panel state */
  isSpotlightOpen?: boolean;
  onToggleSpotlight?: (open?: boolean) => void;

  /** Frame presets panel state (Wave B1) */
  isFramePresetsOpen?: boolean;
  onToggleFramePresets?: (open?: boolean) => void;

  /** AI prompt box overlay state */
  isAiBoxOpen?: boolean;
  onToggleAiBox?: (open?: boolean) => void;
  onAiSubmit?: (prompt: string) => void;
  /** Expand AI: open the AI chat view in the right panel. */
  onAiExpand?: (prompt: string) => void;
  onAiStop?: () => void;
  onAiUndo?: () => void;
  onAiKeep?: () => void;
  aiState?: AiState;
  aiLoading?: boolean;
  aiContext?: { name: string; type: string };

  /** View options popover state */
  isViewOptionsOpen?: boolean;
  onToggleViewOptions?: (open?: boolean) => void;

  /** View options toggles & settings */
  gridStyle?: GridStyle;
  onGridStyleChange?: (style: GridStyle) => void;
  gridSize?: number;
  onGridSizeChange?: (size: number) => void;
  snapObjects?: boolean;
  onToggleSnapObjects?: (snap: boolean) => void;
  snapGuides?: boolean;
  onToggleSnapGuides?: (snap: boolean) => void;
  pixelGrid?: boolean;
  onTogglePixelGrid?: (pixelGrid: boolean) => void;
  checkerboard?: boolean;
  onToggleCheckerboard?: (checkerboard: boolean) => void;
  theme?: string;
  onThemeChange?: (theme: string) => void;
  motionFeel?: MotionFeel;
  onMotionFeelChange?: (feel: MotionFeel) => void;
  dropdownBulge?: number;
  onDropdownBulgeChange?: (bulge: number) => void;
  inspectMode?: boolean;
  onToggleInspectMode?: (inspect: boolean) => void;
  canvasPan?: boolean;
  onToggleCanvasPan?: (pan: boolean) => void;
  panMethod?: "space" | "middle" | "blank";
  onPanMethodChange?: (method: "space" | "middle" | "blank") => void;
  canvasZoom?: boolean;
  onToggleCanvasZoom?: (zoom: boolean) => void;
  zoomSpeed?: "normal" | "fast";
  onZoomSpeedChange?: (speed: "normal" | "fast") => void;
  worldAxes?: boolean;
  onToggleWorldAxes?: (axes: boolean) => void;
  elementDragging?: boolean;
  onToggleElementDragging?: (drag: boolean) => void;
  reparenting?: boolean;
  onToggleReparenting?: (reparent: boolean) => void;
  collisionMode?: "pass" | "push";
  onCollisionModeChange?: (mode: "pass" | "push") => void;
  marqueeMode?: "intersects" | "encloses";
  onMarqueeModeChange?: (mode: "intersects" | "encloses") => void;
  snapToGrid?: boolean;
  onToggleSnapToGrid?: (snap: boolean) => void;
  smartGuides?: boolean;
  onToggleSmartGuides?: (smart: boolean) => void;
  snapThreshold?: number;
  onSnapThresholdChange?: (threshold: number) => void;
  onFocusSelection?: () => void;
  onOpenWorldEnvironment?: () => void;

  /** History and panel controls */
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  panelsCollapsed?: boolean;
  onTogglePanels?: () => void;
  onPreview?: () => void;

  /** Run generated code (Code mode toolbar action) */
  onRunCode?: () => void;

  /** Collaborator avatars stack (.fbar.fpeople) shown when entries exist */
  users?: readonly CollabUser[];
}
