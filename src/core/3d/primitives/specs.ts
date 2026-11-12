/**
 * ============================================================================
 * PARAMETRIC 3D PRIMITIVE SPECIFICATIONS (Phase 3D-025)
 * ============================================================================
 * Canonical specifications for each of the 10 procedural primitive kinds:
 *   - cube, cylinder, cone, uvSphere, icoSphere, torus, plane, circle,
 *     capsule, roundedBox.
 *
 * Each spec provides:
 *   1. `kind`: Identifier for the primitive kind.
 *   2. `params`: Zod validation schema with ranges and sensible defaults.
 *   3. `generate`: Pure procedural generator returning vertex positions and indices.
 *   4. `handles`: Array of interactive manipulation handles (id, label, position, axis, param, apply).
 * ============================================================================
 */

import { z } from "zod";
import { vec3 } from "../math";
import type { PrimitiveSpec } from "./types";
import {
  cube,
  cylinder,
  cone,
  uvSphere,
  icosphere,
  torus,
  plane,
  circle,
  capsule,
  roundedBox,
} from "./generators";

// ---------------------------------------------------------------------------
// 1. CUBE
// ---------------------------------------------------------------------------

export const CubeParamsSchema = z.object({
  width: z.number().positive().default(1),
  height: z.number().positive().default(1),
  depth: z.number().positive().default(1),
  size: z.number().positive().optional(),
});
export type CubeParams = z.infer<typeof CubeParamsSchema>;

export const cubeSpec: PrimitiveSpec<CubeParams> = {
  kind: "cube",
  params: CubeParamsSchema,
  generate: (p) => {
    const w = p.width ?? p.size ?? 1;
    const h = p.height ?? p.size ?? 1;
    const d = p.depth ?? p.size ?? 1;
    return cube({ width: w, height: h, depth: d });
  },
  handles: (p) => {
    const w = p.width ?? p.size ?? 1;
    const h = p.height ?? p.size ?? 1;
    const d = p.depth ?? p.size ?? 1;
    return [
      {
        id: "cube-width",
        label: "Width",
        position: vec3(w * 0.5, 0, 0),
        axis: vec3(1, 0, 0),
        param: "width",
        apply: (params, delta) => ({
          ...params,
          width: Math.max(0.01, (params.width ?? params.size ?? 1) + delta),
        }),
      },
      {
        id: "cube-height",
        label: "Height",
        position: vec3(0, h * 0.5, 0),
        axis: vec3(0, 1, 0),
        param: "height",
        apply: (params, delta) => ({
          ...params,
          height: Math.max(0.01, (params.height ?? params.size ?? 1) + delta),
        }),
      },
      {
        id: "cube-depth",
        label: "Depth",
        position: vec3(0, 0, d * 0.5),
        axis: vec3(0, 0, 1),
        param: "depth",
        apply: (params, delta) => ({
          ...params,
          depth: Math.max(0.01, (params.depth ?? params.size ?? 1) + delta),
        }),
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// 2. CYLINDER
// ---------------------------------------------------------------------------

export const CylinderParamsSchema = z.object({
  radius: z.number().positive().default(1),
  depth: z.number().positive().default(2),
  vertices: z.number().int().min(3).max(256).default(32),
  sides: z.number().int().min(3).max(256).optional(),
});
export type CylinderParams = z.infer<typeof CylinderParamsSchema>;

export const cylinderSpec: PrimitiveSpec<CylinderParams> = {
  kind: "cylinder",
  params: CylinderParamsSchema,
  generate: (p) =>
    cylinder({
      radius: p.radius,
      depth: p.depth,
      vertices: p.sides ?? p.vertices ?? 32,
    }),
  handles: (p) => [
    {
      id: "cylinder-depth",
      label: "Depth",
      position: vec3(0, p.depth * 0.5, 0),
      axis: vec3(0, 1, 0),
      param: "depth",
      apply: (params, delta) => ({
        ...params,
        depth: Math.max(0.01, params.depth + delta),
      }),
    },
    {
      id: "cylinder-radius",
      label: "Radius",
      position: vec3(p.radius, 0, 0),
      axis: vec3(1, 0, 0),
      param: "radius",
      apply: (params, delta) => ({
        ...params,
        radius: Math.max(0.01, params.radius + delta),
      }),
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. CONE
// ---------------------------------------------------------------------------

export const ConeParamsSchema = z.object({
  radius: z.number().positive().default(1),
  depth: z.number().positive().default(2),
  vertices: z.number().int().min(3).max(256).default(32),
  sides: z.number().int().min(3).max(256).optional(),
});
export type ConeParams = z.infer<typeof ConeParamsSchema>;

export const coneSpec: PrimitiveSpec<ConeParams> = {
  kind: "cone",
  params: ConeParamsSchema,
  generate: (p) =>
    cone({
      radius: p.radius,
      depth: p.depth,
      vertices: p.sides ?? p.vertices ?? 32,
    }),
  handles: (p) => [
    {
      id: "cone-depth",
      label: "Depth",
      position: vec3(0, p.depth * 0.5, 0),
      axis: vec3(0, 1, 0),
      param: "depth",
      apply: (params, delta) => ({
        ...params,
        depth: Math.max(0.01, params.depth + delta),
      }),
    },
    {
      id: "cone-radius",
      label: "Radius",
      position: vec3(p.radius, -p.depth * 0.5, 0),
      axis: vec3(1, 0, 0),
      param: "radius",
      apply: (params, delta) => ({
        ...params,
        radius: Math.max(0.01, params.radius + delta),
      }),
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. UV SPHERE
// ---------------------------------------------------------------------------

export const UvSphereParamsSchema = z.object({
  radius: z.number().positive().default(1),
  segments: z.number().int().min(3).max(512).default(32),
  sides: z.number().int().min(3).max(512).optional(),
  rings: z.number().int().min(2).max(512).default(16),
});
export type UvSphereParams = z.infer<typeof UvSphereParamsSchema>;

export const uvSphereSpec: PrimitiveSpec<UvSphereParams> = {
  kind: "uvSphere",
  params: UvSphereParamsSchema,
  generate: (p) =>
    uvSphere({
      radius: p.radius,
      segments: p.sides ?? p.segments ?? 32,
      rings: p.rings,
    }),
  handles: (p) => [
    {
      id: "uvSphere-radius",
      label: "Radius",
      position: vec3(p.radius, 0, 0),
      axis: vec3(1, 0, 0),
      param: "radius",
      apply: (params, delta) => ({
        ...params,
        radius: Math.max(0.01, params.radius + delta),
      }),
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. ICO SPHERE
// ---------------------------------------------------------------------------

export const IcoSphereParamsSchema = z.object({
  radius: z.number().positive().default(1),
  subdivisions: z.number().int().min(0).max(8).default(2),
});
export type IcoSphereParams = z.infer<typeof IcoSphereParamsSchema>;

export const icoSphereSpec: PrimitiveSpec<IcoSphereParams> = {
  kind: "icoSphere",
  params: IcoSphereParamsSchema,
  generate: (p) =>
    icosphere({
      radius: p.radius,
      subdivisions: p.subdivisions,
    }),
  handles: (p) => [
    {
      id: "icoSphere-radius",
      label: "Radius",
      position: vec3(p.radius, 0, 0),
      axis: vec3(1, 0, 0),
      param: "radius",
      apply: (params, delta) => ({
        ...params,
        radius: Math.max(0.01, params.radius + delta),
      }),
    },
  ],
};

// ---------------------------------------------------------------------------
// 6. TORUS
// ---------------------------------------------------------------------------

export const TorusParamsSchema = z.object({
  radius: z.number().positive().default(1),
  tube: z.number().positive().default(0.25),
  majorRadius: z.number().positive().optional(),
  minorRadius: z.number().positive().optional(),
  radialSegments: z.number().int().min(3).max(256).default(16),
  tubularSegments: z.number().int().min(3).max(256).default(32),
});
export type TorusParams = z.infer<typeof TorusParamsSchema>;

export const torusSpec: PrimitiveSpec<TorusParams> = {
  kind: "torus",
  params: TorusParamsSchema,
  generate: (p) => {
    const maj = p.majorRadius ?? p.radius ?? 1;
    const min = p.minorRadius ?? p.tube ?? 0.25;
    return torus({
      radius: maj,
      tube: min,
      radialSegments: p.radialSegments,
      tubularSegments: p.tubularSegments,
    });
  },
  handles: (p) => {
    const maj = p.majorRadius ?? p.radius ?? 1;
    const min = p.minorRadius ?? p.tube ?? 0.25;
    return [
      {
        id: "torus-major-radius",
        label: "Major Radius",
        position: vec3(maj, 0, 0),
        axis: vec3(1, 0, 0),
        param: "radius",
        apply: (params, delta) => ({
          ...params,
          radius: Math.max(0.01, (params.majorRadius ?? params.radius ?? 1) + delta),
        }),
      },
      {
        id: "torus-minor-radius",
        label: "Minor Radius",
        position: vec3(maj + min, 0, 0),
        axis: vec3(1, 0, 0),
        param: "tube",
        apply: (params, delta) => ({
          ...params,
          tube: Math.max(0.001, (params.minorRadius ?? params.tube ?? 0.25) + delta),
        }),
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// 7. PLANE
// ---------------------------------------------------------------------------

export const PlaneParamsSchema = z.object({
  width: z.number().positive().default(2),
  height: z.number().positive().default(2),
  size: z.number().positive().optional(),
});
export type PlaneParams = z.infer<typeof PlaneParamsSchema>;

export const planeSpec: PrimitiveSpec<PlaneParams> = {
  kind: "plane",
  params: PlaneParamsSchema,
  generate: (p) => {
    const w = p.width ?? p.size ?? 2;
    const h = p.height ?? p.size ?? 2;
    return plane({ width: w, height: h });
  },
  handles: (p) => {
    const w = p.width ?? p.size ?? 2;
    const h = p.height ?? p.size ?? 2;
    return [
      {
        id: "plane-width",
        label: "Width",
        position: vec3(w * 0.5, 0, 0),
        axis: vec3(1, 0, 0),
        param: "width",
        apply: (params, delta) => ({
          ...params,
          width: Math.max(0.01, (params.width ?? params.size ?? 2) + delta),
        }),
      },
      {
        id: "plane-height",
        label: "Height",
        position: vec3(0, 0, h * 0.5),
        axis: vec3(0, 0, 1),
        param: "height",
        apply: (params, delta) => ({
          ...params,
          height: Math.max(0.01, (params.height ?? params.size ?? 2) + delta),
        }),
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// 8. CIRCLE
// ---------------------------------------------------------------------------

export const CircleParamsSchema = z.object({
  radius: z.number().positive().default(1),
  vertices: z.number().int().min(3).max(256).default(32),
  sides: z.number().int().min(3).max(256).optional(),
});
export type CircleParams = z.infer<typeof CircleParamsSchema>;

export const circleSpec: PrimitiveSpec<CircleParams> = {
  kind: "circle",
  params: CircleParamsSchema,
  generate: (p) =>
    circle({
      radius: p.radius,
      vertices: p.sides ?? p.vertices ?? 32,
    }),
  handles: (p) => [
    {
      id: "circle-radius",
      label: "Radius",
      position: vec3(p.radius, 0, 0),
      axis: vec3(1, 0, 0),
      param: "radius",
      apply: (params, delta) => ({
        ...params,
        radius: Math.max(0.01, params.radius + delta),
      }),
    },
  ],
};

// ---------------------------------------------------------------------------
// 9. CAPSULE
// ---------------------------------------------------------------------------

export const CapsuleParamsSchema = z.object({
  radius: z.number().positive().default(0.5),
  depth: z.number().positive().default(1),
  radialSegments: z.number().int().min(3).max(256).default(16),
  sides: z.number().int().min(3).max(256).optional(),
  rings: z.number().int().min(1).max(128).default(8),
});
export type CapsuleParams = z.infer<typeof CapsuleParamsSchema>;

export const capsuleSpec: PrimitiveSpec<CapsuleParams> = {
  kind: "capsule",
  params: CapsuleParamsSchema,
  generate: (p) =>
    capsule({
      radius: p.radius,
      depth: p.depth,
      radialSegments: p.sides ?? p.radialSegments ?? 16,
      rings: p.rings,
    }),
  handles: (p) => [
    {
      id: "capsule-depth",
      label: "Depth",
      position: vec3(0, p.depth * 0.5 + p.radius, 0),
      axis: vec3(0, 1, 0),
      param: "depth",
      apply: (params, delta) => ({
        ...params,
        depth: Math.max(0.01, params.depth + delta),
      }),
    },
    {
      id: "capsule-radius",
      label: "Radius",
      position: vec3(p.radius, 0, 0),
      axis: vec3(1, 0, 0),
      param: "radius",
      apply: (params, delta) => ({
        ...params,
        radius: Math.max(0.01, params.radius + delta),
      }),
    },
  ],
};

// ---------------------------------------------------------------------------
// 10. ROUNDED BOX
// ---------------------------------------------------------------------------

export const RoundedBoxParamsSchema = z.object({
  width: z.number().positive().default(1),
  height: z.number().positive().default(1),
  depth: z.number().positive().default(1),
  bevel: z.number().nonnegative().default(0.1),
  segments: z.number().int().min(1).max(32).default(4),
  size: z.number().positive().optional(),
});
export type RoundedBoxParams = z.infer<typeof RoundedBoxParamsSchema>;

export const roundedBoxSpec: PrimitiveSpec<RoundedBoxParams> = {
  kind: "roundedBox",
  params: RoundedBoxParamsSchema,
  generate: (p) => {
    const w = p.width ?? p.size ?? 1;
    const h = p.height ?? p.size ?? 1;
    const d = p.depth ?? p.size ?? 1;
    return roundedBox({
      width: w,
      height: h,
      depth: d,
      bevel: p.bevel,
      segments: p.segments,
    });
  },
  handles: (p) => {
    const w = p.width ?? p.size ?? 1;
    const h = p.height ?? p.size ?? 1;
    const d = p.depth ?? p.size ?? 1;
    return [
      {
        id: "roundedBox-width",
        label: "Width",
        position: vec3(w * 0.5, 0, 0),
        axis: vec3(1, 0, 0),
        param: "width",
        apply: (params, delta) => ({
          ...params,
          width: Math.max(0.01, (params.width ?? params.size ?? 1) + delta),
        }),
      },
      {
        id: "roundedBox-height",
        label: "Height",
        position: vec3(0, h * 0.5, 0),
        axis: vec3(0, 1, 0),
        param: "height",
        apply: (params, delta) => ({
          ...params,
          height: Math.max(0.01, (params.height ?? params.size ?? 1) + delta),
        }),
      },
      {
        id: "roundedBox-depth",
        label: "Depth",
        position: vec3(0, 0, d * 0.5),
        axis: vec3(0, 0, 1),
        param: "depth",
        apply: (params, delta) => ({
          ...params,
          depth: Math.max(0.01, (params.depth ?? params.size ?? 1) + delta),
        }),
      },
      {
        id: "roundedBox-bevel",
        label: "Bevel",
        position: vec3(w * 0.5, h * 0.5, d * 0.5),
        axis: vec3(0, 1, 0),
        param: "bevel",
        apply: (params, delta) => {
          const maxBevel = Math.min(
            (params.width ?? params.size ?? 1) * 0.5,
            (params.height ?? params.size ?? 1) * 0.5,
            (params.depth ?? params.size ?? 1) * 0.5
          );
          return {
            ...params,
            bevel: Math.max(0, Math.min(maxBevel, params.bevel + delta)),
          };
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// Spec Registry & Lookup
// ---------------------------------------------------------------------------

// Generic spec type for heterogeneous map
export type AnyPrimitiveSpec = PrimitiveSpec<Record<string, unknown>>;

export const PRIMITIVE_SPECS: Record<string, AnyPrimitiveSpec> = {
  cube: cubeSpec as unknown as AnyPrimitiveSpec,
  cylinder: cylinderSpec as unknown as AnyPrimitiveSpec,
  cone: coneSpec as unknown as AnyPrimitiveSpec,
  uvSphere: uvSphereSpec as unknown as AnyPrimitiveSpec,
  icoSphere: icoSphereSpec as unknown as AnyPrimitiveSpec,
  torus: torusSpec as unknown as AnyPrimitiveSpec,
  plane: planeSpec as unknown as AnyPrimitiveSpec,
  circle: circleSpec as unknown as AnyPrimitiveSpec,
  capsule: capsuleSpec as unknown as AnyPrimitiveSpec,
  roundedBox: roundedBoxSpec as unknown as AnyPrimitiveSpec,
};

/**
 * Normalizes kind string and returns matching PrimitiveSpec, or undefined.
 */
export function getPrimitiveSpec(kind: string): AnyPrimitiveSpec | undefined {
  if (PRIMITIVE_SPECS[kind]) return PRIMITIVE_SPECS[kind];

  const normalized = kind.toLowerCase().replace(/[-_]/g, "");
  switch (normalized) {
    case "cube":
    case "box":
      return cubeSpec as unknown as AnyPrimitiveSpec;
    case "cylinder":
      return cylinderSpec as unknown as AnyPrimitiveSpec;
    case "cone":
      return coneSpec as unknown as AnyPrimitiveSpec;
    case "uvsphere":
    case "sphere":
      return uvSphereSpec as unknown as AnyPrimitiveSpec;
    case "icosphere":
      return icoSphereSpec as unknown as AnyPrimitiveSpec;
    case "torus":
      return torusSpec as unknown as AnyPrimitiveSpec;
    case "plane":
      return planeSpec as unknown as AnyPrimitiveSpec;
    case "circle":
    case "disc":
    case "disk":
      return circleSpec as unknown as AnyPrimitiveSpec;
    case "capsule":
      return capsuleSpec as unknown as AnyPrimitiveSpec;
    case "roundedbox":
    case "roundbox":
      return roundedBoxSpec as unknown as AnyPrimitiveSpec;
    default:
      return undefined;
  }
}
