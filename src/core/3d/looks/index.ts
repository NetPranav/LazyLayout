/**
 * ============================================================================
 * 3D LOOKS SYSTEM (Phase 3D-023)
 * ============================================================================
 * Public barrel export for the 3D looks system:
 *   - Preset looks library (materials, light rigs, modifiers)
 *   - Sizing calculations and proportional rule scaling
 *   - Pure immutable applyLook reducer
 *   - Typed command registrations (3d.look.apply, 3d.look.save, 3d.look.delete)
 * ============================================================================
 */

export * from "./types";
export * from "./builtins";
export * from "./sizing";
export * from "./applyLook";
export * from "./commands";
