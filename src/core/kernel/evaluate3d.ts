"use client";

/**
 * ============================================================================
 * 3D EVALUATION KERNEL (Phase 3D-010)
 * ============================================================================
 * `evaluate3D(doc, time, compositionId?, inputs?)` is a pure function:
 * returns the document's 3D tables with every animated property resolved
 * at `time`, plus `worldMatrices` for objects.
 *
 * Reuses the evaluation kernel's easing/interpolator logic and composition
 * timing model. Deterministic: the same inputs at any time produce identical
 * results regardless of scrubbing order.
 * ============================================================================
 */

import type {
  MotionDocument,
  Object3d,
} from "../document/schema";
import { MAIN_COMPOSITION_ID, clipTimeInComposition } from "../document/compositions";
import { sampleTrack, type EvaluateInputs } from "./evaluate";
import { is3DPath, parse3DPath, apply3DProperty } from "../3d/paths";
import { worldMatrix } from "../3d/hierarchy";
import { quatFromEuler, eulerFromQuat, type Mat4 } from "../3d/math";
import type { Evaluated3DState } from "../3d/diff";
import { CLIP_TYPE_TO_CATEGORY } from "../rules/clip-adapter";
import { CATEGORY_PRIORITY_ORDER, type AnimationCategory } from "../types/element-grammar";

export type { Evaluated3DState };

/** Deeply clones an Object3d record to prevent mutations from leaking into doc. */
function cloneObject3d(obj: Object3d): Object3d {
  return {
    ...obj,
    transform: {
      location: [obj.transform.location[0], obj.transform.location[1], obj.transform.location[2]],
      rotationQuat: [
        obj.transform.rotationQuat[0],
        obj.transform.rotationQuat[1],
        obj.transform.rotationQuat[2],
        obj.transform.rotationQuat[3],
      ],
      scale: [obj.transform.scale[0], obj.transform.scale[1], obj.transform.scale[2]],
    },
    ...(obj.delta
      ? {
          delta: {
            ...(obj.delta.location
              ? { location: [obj.delta.location[0], obj.delta.location[1], obj.delta.location[2]] as [number, number, number] }
              : {}),
            ...(obj.delta.rotationQuat
              ? {
                  rotationQuat: [
                    obj.delta.rotationQuat[0],
                    obj.delta.rotationQuat[1],
                    obj.delta.rotationQuat[2],
                    obj.delta.rotationQuat[3],
                  ] as [number, number, number, number],
                }
              : {}),
            ...(obj.delta.scale
              ? { scale: [obj.delta.scale[0], obj.delta.scale[1], obj.delta.scale[2]] as [number, number, number] }
              : {}),
          },
        }
      : {}),
    ...(obj.parentInverse ? { parentInverse: [...obj.parentInverse] } : {}),
    ...(obj.materialSlots ? { materialSlots: [...obj.materialSlots] } : {}),
    ...(obj.materials ? { materials: [...obj.materials] } : {}),
  };
}

/** Deeply clones a generic data-block table */
function cloneTable<T extends { id: string }>(table?: Record<string, T>): Record<string, T> {
  if (!table) return {};
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(table)) {
    out[k] = { ...v };
  }
  return out;
}

interface Ranked3DSample {
  category: AnimationCategory;
  path: string;
  table: string;
  id: string;
  rest: string;
  value: unknown;
}

/**
 * Resolves all 3D tables and calculates worldMatrices for all objects at time `t`.
 */
export function evaluate3D(
  doc: MotionDocument,
  time: number,
  compositionId?: string,
  inputs: EvaluateInputs = {}
): Evaluated3DState {
  // 1. Clone base 3D tables from document
  const scenes = cloneTable(doc.scenes);
  const objects: Record<string, Object3d> = {};
  if (doc.objects) {
    for (const [id, obj] of Object.entries(doc.objects)) {
      objects[id] = cloneObject3d(obj);
    }
  }
  const meshes = cloneTable(doc.meshes);
  const materials = cloneTable(doc.materials);
  const lights = cloneTable(doc.lights);
  const cameras = cloneTable(doc.cameras);
  const armatures = cloneTable(doc.armatures);
  const actions = cloneTable(doc.actions);
  const worlds = cloneTable(doc.worlds);
  const images3d = cloneTable(doc.images3d);

  const tables: Record<string, Record<string, unknown>> = {
    scenes: scenes as Record<string, unknown>,
    objects: objects as Record<string, unknown>,
    meshes: meshes as Record<string, unknown>,
    materials: materials as Record<string, unknown>,
    lights: lights as Record<string, unknown>,
    cameras: cameras as Record<string, unknown>,
    armatures: armatures as Record<string, unknown>,
    actions: actions as Record<string, unknown>,
    worlds: worlds as Record<string, unknown>,
    images3d: images3d as Record<string, unknown>,
  };

  // 2. Resolve active composition
  const compId = compositionId ?? MAIN_COMPOSITION_ID;
  const comp = doc.compositions?.[compId] ?? Object.values(doc.compositions ?? {})[0];

  // 3. Sample tracks targeting 3D properties from enabled clips
  const rawSamples: Ranked3DSample[] = [];

  if (doc.clips) {
    for (const clip of Object.values(doc.clips)) {
      if (!clip.enabled) continue;

      let clipTime: number | null = null;
      const driven = inputs.scrollClipTime?.[clip.id];
      if (driven !== undefined) {
        clipTime = Math.min(clip.duration, Math.max(0, driven));
      } else if (comp) {
        const timing = clipTimeInComposition(comp, clip, time);
        if (!timing) continue;
        clipTime = timing.time;
      } else {
        clipTime = Math.min(clip.duration, Math.max(0, time));
      }

      const category = CLIP_TYPE_TO_CATEGORY[clip.type] ?? "Ambient";

      for (const track of clip.tracks) {
        if (track.muted || !is3DPath(track.property)) continue;

        const parsed = parse3DPath(track.property);
        if (!parsed.ok) continue;

        const sampled = sampleTrack(track, clipTime);
        if (sampled === undefined) continue;

        rawSamples.push({
          category,
          path: track.property,
          table: parsed.table,
          id: parsed.id,
          rest: parsed.rest,
          value: sampled,
        });
      }
    }
  }

  // 4. Sort samples by priority order (lowest priority first, highest priority wins)
  const ranked = [...rawSamples].sort((a, b) => {
    const ia = CATEGORY_PRIORITY_ORDER.indexOf(a.category);
    const ib = CATEGORY_PRIORITY_ORDER.indexOf(b.category);
    return (ib === -1 ? 999 : ib) - (ia === -1 ? 999 : ia);
  });

  // Track Euler and Quaternion updates per object
  const eulerUpdates = new Map<string, { x?: number; y?: number; z?: number }>();
  const quatDirectUpdates = new Set<string>();

  for (const sample of ranked) {
    const tableObj = tables[sample.table];
    if (!tableObj) continue;
    const entity = tableObj[sample.id] as Record<string, unknown> | undefined;
    if (!entity) continue;

    if (sample.table === "objects") {
      const eulerMatch = /^transform\.rotationEuler\.(x|y|z)$/.exec(sample.rest);
      if (eulerMatch) {
        let rec = eulerUpdates.get(sample.id);
        if (!rec) {
          rec = {};
          eulerUpdates.set(sample.id, rec);
        }
        rec[eulerMatch[1] as "x" | "y" | "z"] = Number(sample.value);
        continue;
      }
      if (sample.rest === "transform.rotationQuat") {
        quatDirectUpdates.add(sample.id);
      }
    }

    apply3DProperty(entity, sample.rest, sample.value);
  }

  // 5. Convert animated Euler rotations to Quaternions
  for (const [objId, euler] of eulerUpdates.entries()) {
    // If a direct rotationQuat track won on this object, do not override it with Euler
    if (quatDirectUpdates.has(objId)) continue;

    const obj = objects[objId];
    if (!obj) continue;

    const curQuat = obj.transform.rotationQuat;
    const curEuler = eulerFromQuat("XYZ", curQuat);

    const ex = euler.x !== undefined ? euler.x : curEuler[0];
    const ey = euler.y !== undefined ? euler.y : curEuler[1];
    const ez = euler.z !== undefined ? euler.z : curEuler[2];

    const q = quatFromEuler("XYZ", ex, ey, ez);
    obj.transform.rotationQuat = [q[0], q[1], q[2], q[3]];
  }

  // 6. Compute world matrices for all objects
  const evalDoc: MotionDocument = {
    ...doc,
    objects,
  };

  const worldMatrices: Record<string, Mat4> = {};
  for (const objId of Object.keys(objects)) {
    try {
      worldMatrices[objId] = worldMatrix(evalDoc, objId);
    } catch {
      // In case of non-resolvable hierarchy during intermediate authoring
      worldMatrices[objId] = new Float64Array(16);
    }
  }

  return {
    scenes,
    objects,
    meshes,
    materials,
    lights,
    cameras,
    armatures,
    actions,
    worlds,
    images3d,
    worldMatrices,
  };
}
