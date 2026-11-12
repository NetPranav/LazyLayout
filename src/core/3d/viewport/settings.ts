/**
 * ============================================================================
 * VIEWPORT SETTINGS & REDUCER (Phases 3D-018 & 3D-019)
 * ============================================================================
 * Pure data structures, zod validation, serialization, and deterministic
 * state transitions for 3D viewport shading, overlays, and gizmo controls.
 * ============================================================================
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Types & Schemas
// ---------------------------------------------------------------------------

export const ShadingModeSchema = z.enum(["wireframe", "solid", "material", "rendered"]);
export type ShadingMode = z.infer<typeof ShadingModeSchema>;

export const ViewportOverlaysSchema = z
  .object({
    grid: z.boolean(),
    axes: z.boolean(),
    origins: z.boolean(),
    faceOrientation: z.boolean(),
    normals: z.boolean(),
    wireOnShaded: z.boolean(),
    stats: z.boolean(),
  })
  .strict();
export type ViewportOverlays = z.infer<typeof ViewportOverlaysSchema>;

export const SolidOptionsSchema = z
  .object({
    cavity: z.boolean(),
    studioLight: z.union([z.boolean(), z.string()]),
  })
  .strict();
export type SolidOptions = z.infer<typeof SolidOptionsSchema>;

export const ViewportSettingsSchema = z
  .object({
    shading: ShadingModeSchema,
    xray: z.boolean(),
    overlays: ViewportOverlaysSchema,
    solidOptions: SolidOptionsSchema,
    gizmoVisible: z.boolean(),
  })
  .strict();
export type ViewportSettings = z.infer<typeof ViewportSettingsSchema>;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_VIEWPORT_OVERLAYS: ViewportOverlays = {
  grid: true,
  axes: true,
  origins: true,
  faceOrientation: false,
  normals: false,
  wireOnShaded: false,
  stats: false,
};

export const DEFAULT_SOLID_OPTIONS: SolidOptions = {
  cavity: true,
  studioLight: "studio",
};

export const DEFAULT_VIEWPORT_SETTINGS: ViewportSettings = {
  shading: "solid",
  xray: false,
  overlays: DEFAULT_VIEWPORT_OVERLAYS,
  solidOptions: DEFAULT_SOLID_OPTIONS,
  gizmoVisible: true,
};

// ---------------------------------------------------------------------------
// Actions & Reducer
// ---------------------------------------------------------------------------

export type ViewportAction =
  | { type: "3d.shading.wireframe" }
  | { type: "3d.shading.solid" }
  | { type: "3d.shading.material" }
  | { type: "3d.shading.rendered" }
  | { type: "3d.shading.toggle_xray" }
  | { type: "3d.overlay.toggle_grid" }
  | { type: "3d.overlay.toggle_stats" }
  | { type: "SET_SHADING"; shading: ShadingMode }
  | { type: "TOGGLE_OVERLAY"; overlay: keyof ViewportOverlays }
  | { type: "SET_OVERLAYS"; overlays: Partial<ViewportOverlays> }
  | { type: "TOGGLE_CAVITY" }
  | { type: "TOGGLE_GIZMO" }
  | { type: "RESET_SETTINGS" };

export type ViewportActionInput = ViewportAction | string;

/**
 * Pure reducer handling shading changes, xray toggles, overlay toggles, and gizmo visibility.
 * Accepts either structured action objects or canonical 3D command ID strings directly.
 */
export function viewportReducer(
  state: ViewportSettings = DEFAULT_VIEWPORT_SETTINGS,
  action: ViewportActionInput
): ViewportSettings {
  const type = typeof action === "string" ? action : action.type;

  switch (type) {
    case "3d.shading.wireframe":
      return {
        ...state,
        shading: state.shading === "wireframe" ? "solid" : "wireframe",
      };

    case "3d.shading.solid":
      return { ...state, shading: "solid" };

    case "3d.shading.material":
      return { ...state, shading: "material" };

    case "3d.shading.rendered":
      return { ...state, shading: "rendered" };

    case "3d.shading.toggle_xray":
      return { ...state, xray: !state.xray };

    case "3d.overlay.toggle_grid":
      return {
        ...state,
        overlays: {
          ...state.overlays,
          grid: !state.overlays.grid,
        },
      };

    case "3d.overlay.toggle_stats":
      return {
        ...state,
        overlays: {
          ...state.overlays,
          stats: !state.overlays.stats,
        },
      };

    case "SET_SHADING":
      return {
        ...state,
        shading: (action as { type: "SET_SHADING"; shading: ShadingMode }).shading,
      };

    case "TOGGLE_OVERLAY": {
      const overlayKey = (action as { type: "TOGGLE_OVERLAY"; overlay: keyof ViewportOverlays }).overlay;
      return {
        ...state,
        overlays: {
          ...state.overlays,
          [overlayKey]: !state.overlays[overlayKey],
        },
      };
    }

    case "SET_OVERLAYS": {
      const newOverlays = (action as { type: "SET_OVERLAYS"; overlays: Partial<ViewportOverlays> }).overlays;
      return {
        ...state,
        overlays: {
          ...state.overlays,
          ...newOverlays,
        },
      };
    }

    case "TOGGLE_CAVITY":
      return {
        ...state,
        solidOptions: {
          ...state.solidOptions,
          cavity: !state.solidOptions.cavity,
        },
      };

    case "TOGGLE_GIZMO":
      return {
        ...state,
        gizmoVisible: !state.gizmoVisible,
      };

    case "RESET_SETTINGS":
      return { ...DEFAULT_VIEWPORT_SETTINGS };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Serialization & Deserialization
// ---------------------------------------------------------------------------

/**
 * Serializes viewport settings into a formatted JSON string.
 */
export function serializeViewportSettings(settings: ViewportSettings): string {
  ViewportSettingsSchema.parse(settings);
  return JSON.stringify(settings);
}

/**
 * Deserializes JSON string into validated ViewportSettings.
 * Throws ZodError on schema violation.
 */
export function deserializeViewportSettings(json: string): ViewportSettings {
  const parsed = JSON.parse(json);
  return ViewportSettingsSchema.parse(parsed);
}
