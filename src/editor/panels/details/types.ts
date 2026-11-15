import type { PropValue } from "@/core/document/registry";
import type { Layer } from "@/core/document/schema";
import type { CubicBezierCurve } from "./constants";

export interface DetailsInspectorProps {
  /** Optional override element ID. Defaults to selection from useSelectionStore. */
  selectedElementId?: string | null;
  /** Header display name for selected element. */
  selectedElementName?: string;
  /** Callback to open Blueprint editor for this element. */
  onOpenBlueprint?: () => void;
  /** Callback to clear selection. */
  onDeselect?: () => void;
  /** Optional extra classes. */
  className?: string;
}

export interface InspectorSectionProps {
  /** Currently selected layer ID (primary selection). */
  selectedId?: string | null;
  /** All selected layer IDs. */
  selectedIds?: readonly string[];
  /** Primary layer model, if available. */
  layer?: Layer;
  /** Whether selection contains multiple layers. */
  isMulti?: boolean;
  /** Merged property reader function: returns string/number/boolean value or null for mixed. */
  getValue?: (propKey: string) => PropValue | null;
  /** Property writer function for the selection. */
  onUpdateProp?: (propKey: string, value: PropValue | null) => void;
  /** Batch property writer for the selection. */
  onUpdateProps?: (patch: Record<string, PropValue | null>) => void;
  /** Optional container class. */
  className?: string;
}

/** Gradient color stop */
export interface GradientStop {
  id: string;
  hex: string;
  position: number; // 0 to 100
}

/** Fill item in repeatable list */
export interface FillItem {
  id: string;
  type: "solid" | "linear" | "radial" | "conic" | "image" | "noise" | "pattern" | "mesh" | "live";
  hex: string;
  opacity: number; // 0 to 100
  angle?: number;
  stops?: GradientStop[];
  imageFit?: "fill" | "fit" | "crop";
  imageName?: string;
  hidden?: boolean;
}

/** Stroke item in repeatable list */
export interface StrokeItem {
  id: string;
  hex: string;
  width: number;
  style: "solid" | "dashed" | "dotted";
  sides: "all" | "top" | "right" | "bottom" | "left";
  hidden?: boolean;
  /** This stroke's own position, for layers that keep a list of strokes (Phase 118). */
  align?: "inside" | "center" | "outside";
}

/** Effect item in repeatable list */
export interface EffectItem {
  id: string;
  type: "drop-shadow" | "inner-shadow" | "outer-glow" | "inner-glow" | "layer-blur" | "background-blur" | "grain";
  hex: string;
  x: number;
  y: number;
  blur: number;
  spread: number;
  /** A blur's radius (at its strong end when progressive); a grain's strength in % (Phase 121). */
  amount: number;
  hidden?: boolean;
  /** Phase 121: a blur that ramps from `startAmount` to `amount` towards `direction`. */
  progressive?: boolean;
  startAmount?: number;
  direction?: "up" | "down" | "left" | "right";
  /** Phase 121: a grain's size (px). */
  size?: number;
}

/** Animation item in repeatable list */
export interface AnimationItem {
  id: string;
  preset: string;
  duration: number; // in seconds
  trigger: "load" | "scroll" | "hover" | "click";
  curve: CubicBezierCurve;
  hidden?: boolean;
}

/** Data binding item */
export interface DataItem {
  id: string;
  source: string;
}

/** Logic / Blueprint item */
export interface LogicItem {
  id: string;
  blueprint: string;
  trigger: string;
}
