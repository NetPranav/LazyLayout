/**
 * ============================================================================
 * 3D PROPERTY PATH SCHEME & VALIDATION (Phase 3D-010)
 * ============================================================================
 * Canonical property path scheme for 3D data blocks in the evaluation kernel.
 * Format:
 *   `3d:<table>/<id>/<rest>`
 *
 * Examples:
 *   - `3d:objects/<id>/transform.location.x`
 *   - `3d:objects/<id>/transform.rotationEuler.x`
 *   - `3d:objects/<id>/transform.rotationQuat`
 *   - `3d:materials/<id>/roughness`
 *   - `3d:lights/<id>/intensity`
 *   - `3d:cameras/<id>/fov`
 *   - `3d:meshes/<id>/shapeKeys/<name>`
 *   - `3d:objects/<id>/modifiers/<id>/<param>`
 * ============================================================================
 */

import type { InterpolationMethod } from "../document/properties";
import type { PropValue } from "../document/registry";

export const VALID_3D_TABLES = [
  "scenes",
  "objects",
  "meshes",
  "materials",
  "lights",
  "cameras",
  "armatures",
  "actions",
  "worlds",
  "images3d",
  "texts",
] as const;

export type Valid3DTable = (typeof VALID_3D_TABLES)[number];

const TABLE_ALIASES: Record<string, Valid3DTable> = {
  scenes: "scenes",
  scene: "scenes",
  objects: "objects",
  object: "objects",
  meshes: "meshes",
  mesh: "meshes",
  materials: "materials",
  material: "materials",
  lights: "lights",
  light: "lights",
  cameras: "cameras",
  camera: "cameras",
  armatures: "armatures",
  armature: "armatures",
  actions: "actions",
  action: "actions",
  worlds: "worlds",
  world: "worlds",
  images3d: "images3d",
  image3d: "images3d",
  texts: "texts",
  text: "texts",
};

export interface Parsed3DPath {
  table: Valid3DTable;
  id: string;
  rest: string;
}

export type Parse3DPathResult =
  | ({ ok: true } & Parsed3DPath)
  | { ok: false; error: string };

/**
 * Returns true if a string conforms to the 3D property path prefix.
 */
export function is3DPath(path: string): boolean {
  return typeof path === "string" && path.startsWith("3d:");
}

/**
 * Parses and validates a 3D property path into table, id, and rest.
 * Returns `{ ok: true, table, id, rest }` or `{ ok: false, error }`.
 */
export function parse3DPath(path: string): Parse3DPathResult {
  if (typeof path !== "string" || !path.startsWith("3d:")) {
    return { ok: false, error: '3D property path must start with "3d:".' };
  }

  const raw = path.slice(3);
  const slashIdx1 = raw.indexOf("/");
  if (slashIdx1 <= 0) {
    return {
      ok: false,
      error: `Invalid 3D path "${path}": missing table or slash delimiter. Expected 3d:<table>/<id>/<rest>`,
    };
  }

  const rawTable = raw.slice(0, slashIdx1);
  const table = TABLE_ALIASES[rawTable.toLowerCase()];
  if (!table) {
    return {
      ok: false,
      error: `Unknown 3D table "${rawTable}" in path "${path}". Expected one of: ${VALID_3D_TABLES.join(", ")}`,
    };
  }

  const remainder = raw.slice(slashIdx1 + 1);
  const slashIdx2 = remainder.indexOf("/");
  if (slashIdx2 === -1) {
    return {
      ok: false,
      error: `Invalid 3D path "${path}": missing property delimiter. Expected 3d:<table>/<id>/<rest>`,
    };
  }

  const id = remainder.slice(0, slashIdx2).trim();
  if (!id) {
    return { ok: false, error: `Entity id cannot be empty in 3D path "${path}".` };
  }

  const rest = remainder.slice(slashIdx2 + 1).trim();
  if (!rest) {
    return { ok: false, error: `Property path cannot be empty in 3D path "${path}".` };
  }

  return { ok: true, table, id, rest };
}

/**
 * Formats a canonical 3D property path string.
 */
export function format3DPath(table: Valid3DTable, id: string, rest: string): string {
  return `3d:${table}/${id}/${rest}`;
}

/**
 * Determines the default interpolation method for a 3D property path and/or keyframe values.
 */
export function get3DInterpolationMethod(
  path: string,
  val0?: PropValue,
  val1?: PropValue
): InterpolationMethod {
  const leaf = path.split(/[/.]/).pop() ?? "";
  const leafLower = leaf.toLowerCase();

  // 1. Quaternions explicitly use SLERP
  if (
    leaf === "rotationQuat" ||
    leaf === "quat" ||
    (Array.isArray(val0) && val0.length === 4 && Array.isArray(val1) && val1.length === 4)
  ) {
    return "slerp";
  }

  // 2. Colors
  if (
    leafLower.endsWith("color") ||
    leaf === "baseColor" ||
    leaf === "emissive" ||
    (typeof val0 === "string" && typeof val1 === "string" && (val0.startsWith("#") || val0.startsWith("rgb")))
  ) {
    return "color";
  }

  // 3. 3D Vectors (location, scale, size)
  if (
    Array.isArray(val0) &&
    val0.length === 3 &&
    Array.isArray(val1) &&
    val1.length === 3 &&
    typeof val0[0] === "number" &&
    typeof val1[0] === "number"
  ) {
    return "vector";
  }

  // 4. Numeric scalars (location.x, rotationEuler.x, roughness, metallic, intensity, fov, etc.)
  const NUMERIC_LEAVES = new Set([
    "x",
    "y",
    "z",
    "w",
    "roughness",
    "metallic",
    "intensity",
    "fov",
    "near",
    "far",
    "opacity",
    "unitScale",
    "orthoScale",
    "focalLength",
    "distance",
    "decay",
    "spotAngle",
    "spotBlend",
    "shadowBias",
    "ambientIntensity",
    "environmentIntensity",
    "environmentRotation",
    "emissiveIntensity",
  ]);

  if (
    typeof val0 === "number" ||
    typeof val1 === "number" ||
    NUMERIC_LEAVES.has(leaf)
  ) {
    return "numeric";
  }

  return "discrete";
}

/**
 * Sets a value at a sub-path within a 3D data block object.
 * Pure in intent; modifies the passed target object.
 */
export function apply3DProperty(target: Record<string, unknown>, rest: string, value: unknown): void {
  if (!target || typeof target !== "object") return;

  // Handle transform coordinates: transform.location.x / y / z
  const locMatch = /^transform\.location\.(x|y|z)$/.exec(rest);
  if (locMatch) {
    const t = (target.transform = (target.transform as Record<string, unknown>) || {});
    const loc = (t.location = Array.isArray(t.location) ? t.location : [0, 0, 0]) as number[];
    const idx = locMatch[1] === "x" ? 0 : locMatch[1] === "y" ? 1 : 2;
    loc[idx] = Number(value);
    return;
  }

  // Handle transform scale coordinates: transform.scale.x / y / z
  const scaleMatch = /^transform\.scale\.(x|y|z)$/.exec(rest);
  if (scaleMatch) {
    const t = (target.transform = (target.transform as Record<string, unknown>) || {});
    const scl = (t.scale = Array.isArray(t.scale) ? t.scale : [1, 1, 1]) as number[];
    const idx = scaleMatch[1] === "x" ? 0 : scaleMatch[1] === "y" ? 1 : 2;
    scl[idx] = Number(value);
    return;
  }

  // Handle direct transform.location vector
  if (rest === "transform.location" && Array.isArray(value)) {
    const t = (target.transform = (target.transform as Record<string, unknown>) || {});
    t.location = [Number(value[0] ?? 0), Number(value[1] ?? 0), Number(value[2] ?? 0)];
    return;
  }

  // Handle direct transform.scale vector
  if (rest === "transform.scale" && Array.isArray(value)) {
    const t = (target.transform = (target.transform as Record<string, unknown>) || {});
    t.scale = [Number(value[0] ?? 1), Number(value[1] ?? 1), Number(value[2] ?? 1)];
    return;
  }

  // Handle direct quaternion
  if (rest === "transform.rotationQuat" && Array.isArray(value)) {
    const t = (target.transform = (target.transform as Record<string, unknown>) || {});
    t.rotationQuat = [
      Number(value[0] ?? 0),
      Number(value[1] ?? 0),
      Number(value[2] ?? 0),
      Number(value[3] ?? 1),
    ];
    return;
  }

  // Handle shape keys: shapeKeys/<name> or shapeKeys.<name>
  const shapeMatch = /^shapeKeys[/.](\w[\w.-]*)$/.exec(rest);
  if (shapeMatch) {
    const keyName = shapeMatch[1];
    const sk = (target.shapeKeys = (target.shapeKeys as Record<string, unknown>) || {});
    sk[keyName] = value;
    return;
  }

  // Handle modifiers: modifiers/<id>/<param> or modifiers.<id>.<param>
  const modMatch = /^modifiers[/.](\w[\w.-]*)[/.]([\w.-]+)$/.exec(rest);
  if (modMatch) {
    const [, modId, param] = modMatch;
    if (Array.isArray(target.modifiers)) {
      const mod = target.modifiers.find((m: unknown) => (m as { id?: string })?.id === modId) as Record<string, unknown> | undefined;
      if (mod) {
        if (param === "enabled" || param === "renderEnabled" || param === "name") {
          mod[param] = value;
        } else {
          const params = (mod.params = (mod.params as Record<string, unknown>) || {});
          params[param] = value;
        }
        return;
      }
    }
    const mods = (target.modifiers = (target.modifiers as Record<string, unknown>) || {});
    const mod = (mods[modId] = (mods[modId] as Record<string, unknown>) || {});
    mod[param] = value;
    return;
  }

  // General dotted / slashed property assignment
  const parts = rest.split(/[./]/).filter(Boolean);
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") {
      cur[p] = {};
    }
    cur = cur[p] as Record<string, unknown>;
  }
  if (parts.length > 0) {
    cur[parts[parts.length - 1]] = value;
  }
}

/**
 * Retrieves a value from a sub-path within a 3D data block object.
 */
export function get3DProperty(target: Record<string, unknown>, rest: string): unknown {
  if (!target || typeof target !== "object") return undefined;

  const locMatch = /^transform\.location\.(x|y|z)$/.exec(rest);
  if (locMatch) {
    const loc = (target.transform as Record<string, unknown>)?.location as number[] | undefined;
    const idx = locMatch[1] === "x" ? 0 : locMatch[1] === "y" ? 1 : 2;
    return loc ? loc[idx] : undefined;
  }

  const scaleMatch = /^transform\.scale\.(x|y|z)$/.exec(rest);
  if (scaleMatch) {
    const scl = (target.transform as Record<string, unknown>)?.scale as number[] | undefined;
    const idx = scaleMatch[1] === "x" ? 0 : scaleMatch[1] === "y" ? 1 : 2;
    return scl ? scl[idx] : undefined;
  }

  const shapeMatch = /^shapeKeys[/.](\w[\w.-]*)$/.exec(rest);
  if (shapeMatch) {
    const sk = target.shapeKeys as Record<string, unknown> | undefined;
    return sk ? sk[shapeMatch[1]] : undefined;
  }

  const modMatch = /^modifiers[/.](\w[\w.-]*)[/.]([\w.-]+)$/.exec(rest);
  if (modMatch) {
    const [, modId, param] = modMatch;
    if (Array.isArray(target.modifiers)) {
      const mod = target.modifiers.find((m: unknown) => (m as { id?: string })?.id === modId) as Record<string, unknown> | undefined;
      if (mod) {
        if (param === "enabled" || param === "renderEnabled" || param === "name") {
          return mod[param];
        }
        const params = mod.params as Record<string, unknown> | undefined;
        return params ? params[param] : undefined;
      }
      return undefined;
    }
    const mods = target.modifiers as Record<string, unknown> | undefined;
    const mod = mods ? (mods[modId] as Record<string, unknown> | undefined) : undefined;
    return mod ? mod[param] : undefined;
  }

  const parts = rest.split(/[./]/).filter(Boolean);
  let cur: unknown = target;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}
