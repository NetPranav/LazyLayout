/**
 * ============================================================================
 * 3D ENGINE CORE MODULE (Phases 3D-008, 3D-016, 3D-017)
 * ============================================================================
 * Pure TypeScript linear algebra, scene hierarchy, transforms, gizmos & snapping.
 * ============================================================================
 */

export * from "./math";
export * from "./hierarchy";
export * from "./apply";
export * from "./units";
export * from "./axes";
export * from "./gltfMap";
export * from "./commands";
export * from "./transform";
export * from "./snap";
export * from "./path";
export * from "./sdf";
export * from "./outliner";
export * from "./blocks";
export * from "./modifiers";
export * from "./primitives";
export * from "./make3d";
export * from "./text";
// names that two folders both export: keep the established ones
export type { MeshData } from "./modifiers";
export type { PlaneOptions } from "./commands";
