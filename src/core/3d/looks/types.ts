/**
 * ============================================================================
 * 3D LOOKS SYSTEM TYPES (Phase 3D-023)
 * ============================================================================
 * Pure data types for the 3D looks system.
 * A look is a named set of property values with optional sizing rules
 * scaled to an object's dimensions or scene size.
 * ============================================================================
 */

export type LookSection =
  | "material"
  | "light"
  | "physics"
  | "modifier"
  | "animation"
  | "interaction";

export interface LookSizingRule {
  property: string;
  mode: "smallest_side" | "scene_size";
  factor: number;
}

export interface Look3d {
  id: string;
  name: string;
  section: LookSection;
  values: Record<string, unknown>;
  sizing?: LookSizingRule[];
}

export interface BuiltinLook extends Look3d {
  /** Short summary of look visual characteristics */
  description?: string;
  /** Primary preview color for fallback rendering */
  previewColor?: string;
}

export interface ObjectBounds {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  smallestSide: number;
}
