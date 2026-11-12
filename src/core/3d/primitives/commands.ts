/**
 * ============================================================================
 * PARAMETRIC 3D PRIMITIVE COMMANDS (Phase 3D-025)
 * ============================================================================
 * Registers typed commands under category "3D":
 *   - `3d.primitive.set_param`: Updates a parameter on an object's procedural mesh.
 *   - `3d.add.circle`: Adds a fan disc on XZ plane with procedural source.
 *   - `3d.add.capsule`: Adds a cylinder + hemispheres capsule with procedural source.
 *   - `3d.add.rounded_box`: Adds a beveled box with procedural source.
 *
 * Also wraps canonical add commands (`3d.add.cube`, `3d.add.cylinder`, etc.)
 * so the meshes they create also record `source: { kind, params }`.
 *
 * Invariants:
 *   - Every command executes as exactly 1 undo step.
 *   - Registered through `defineTypedCommand` under category "3D".
 *   - Pure TypeScript, zero DOM/Three.js dependencies.
 * ============================================================================
 */

import { z } from "zod";
import { defineCommand, defineTypedCommand, getCommand } from "../../commands";
import { documentCommands, getDocument } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { useHistoryStore } from "../../store/useHistoryStore";
import { diffPatches } from "../../document/diff";
import { createId } from "../../ids";
import { quatFromEuler } from "../math";
import { recordLastOperation } from "../commands/lastOperation";
import type {
  Mesh3d,
  MotionDocument,
  Object3d,
  Scene3d,
} from "../../document/schema";
import type { PrimitiveKind } from "./types";
import { circleSpec, capsuleSpec, roundedBoxSpec } from "./specs";
import { setPrimitiveParam } from "./procedural";

// ---------------------------------------------------------------------------
// Common Command Args
// ---------------------------------------------------------------------------

const TransformArgs = {
  location: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).optional(),
  rotationQuat: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  scale: z.tuple([z.number(), z.number(), z.number()]).default([1, 1, 1]),
  sceneId: z.string().optional(),
};

function resolveQuat(
  rotation?: [number, number, number],
  rotationQuat?: [number, number, number, number]
): [number, number, number, number] {
  if (rotationQuat) return rotationQuat;
  if (rotation) {
    const q = quatFromEuler("XYZ", rotation[0], rotation[1], rotation[2]);
    return [q[0], q[1], q[2], q[3]];
  }
  return [0, 0, 0, 1];
}

function resolveTargetScene(
  doc: MotionDocument,
  sceneId?: string
): { doc: MotionDocument; scene: Scene3d } {
  const next: MotionDocument = {
    ...doc,
    scenes: { ...(doc.scenes ?? {}) },
    objects: { ...(doc.objects ?? {}) },
    meshes: { ...(doc.meshes ?? {}) },
  };

  const scenes = next.scenes!;
  let targetId = sceneId;

  if (!targetId || !scenes[targetId]) {
    const existingIds = Object.keys(scenes);
    if (existingIds.length > 0) {
      targetId = existingIds[0];
    } else {
      targetId = createId("scn");
      scenes[targetId] = {
        id: targetId,
        name: "Scene",
        objects: [],
      };
    }
  }

  const scene = { ...scenes[targetId], objects: [...scenes[targetId].objects] };
  scenes[targetId] = scene;
  return { doc: next, scene };
}

// ---------------------------------------------------------------------------
// Command Schemas
// ---------------------------------------------------------------------------

export const PrimitiveSetParamSchema = z.object({
  objectId: z.string(),
  param: z.string(),
  value: z.unknown(),
});

export const AddCircleSchema = z.object({
  radius: z.number().positive().default(1),
  vertices: z.number().int().min(3).max(256).default(32),
  name: z.string().min(1).default("Circle"),
  ...TransformArgs,
});

export const AddCapsuleSchema = z.object({
  radius: z.number().positive().default(0.5),
  depth: z.number().positive().default(1),
  radialSegments: z.number().int().min(3).max(256).default(16),
  rings: z.number().int().min(1).max(128).default(8),
  name: z.string().min(1).default("Capsule"),
  ...TransformArgs,
});

export const AddRoundedBoxSchema = z.object({
  width: z.number().positive().default(1),
  height: z.number().positive().default(1),
  depth: z.number().positive().default(1),
  bevel: z.number().nonnegative().default(0.1),
  segments: z.number().int().min(1).max(32).default(4),
  name: z.string().min(1).default("Rounded Box"),
  ...TransformArgs,
});

// ---------------------------------------------------------------------------
// Helper: Add Procedural Object to Document
// ---------------------------------------------------------------------------

function addProceduralObject(
  doc: MotionDocument,
  name: string,
  kind: PrimitiveKind,
  params: Record<string, unknown>,
  generated: { positions: Float32Array; indices: Uint32Array; uvs?: Float32Array },
  args: {
    location?: [number, number, number];
    rotation?: [number, number, number];
    rotationQuat?: [number, number, number, number];
    scale?: [number, number, number];
    sceneId?: string;
  }
): { doc: MotionDocument; objectId: string; meshId: string } {
  const { doc: next, scene } = resolveTargetScene(doc, args.sceneId);
  const meshId = createId("msh");
  const objId = createId("obj");

  const mesh: Mesh3d = {
    id: meshId,
    name: `${name}Mesh`,
    positions: Array.from(generated.positions),
    indices: Array.from(generated.indices),
    uvs: generated.uvs ? Array.from(generated.uvs) : undefined,
    source: {
      kind,
      params,
    },
  };

  const obj: Object3d = {
    id: objId,
    name,
    type: "mesh",
    dataId: meshId,
    transform: {
      location: args.location ?? [0, 0, 0],
      rotationQuat: resolveQuat(args.rotation, args.rotationQuat),
      scale: args.scale ?? [1, 1, 1],
    },
    visible: true,
  };

  next.meshes![meshId] = mesh;
  next.objects![objId] = obj;
  scene.objects.push(objId);

  return { doc: next, objectId: objId, meshId };
}

// ---------------------------------------------------------------------------
// Canonical Wrapper Definitions
// ---------------------------------------------------------------------------

interface WrappedPrimitiveInfo {
  kind: PrimitiveKind;
  extractParams: (args: Record<string, unknown>) => Record<string, unknown>;
}

const WRAPPED_PRIMITIVES: Record<string, WrappedPrimitiveInfo> = {
  "3d.add.cube": {
    kind: "cube",
    extractParams: (args) => {
      const s = typeof args.size === "number" ? args.size : 1;
      return {
        width: typeof args.width === "number" ? args.width : s,
        height: typeof args.height === "number" ? args.height : s,
        depth: typeof args.depth === "number" ? args.depth : s,
        size: s,
      };
    },
  },
  "3d.add.sphere": {
    kind: "uvSphere",
    extractParams: (args) => ({
      radius: typeof args.radius === "number" ? args.radius : 1,
      segments: typeof args.segments === "number" ? args.segments : 32,
      rings: typeof args.rings === "number" ? args.rings : 16,
    }),
  },
  "3d.add.cylinder": {
    kind: "cylinder",
    extractParams: (args) => ({
      radius: typeof args.radius === "number" ? args.radius : 1,
      depth: typeof args.depth === "number" ? args.depth : 2,
      vertices: typeof args.vertices === "number" ? args.vertices : 32,
    }),
  },
  "3d.add.cone": {
    kind: "cone",
    extractParams: (args) => ({
      radius: typeof args.radius === "number" ? args.radius : 1,
      depth: typeof args.depth === "number" ? args.depth : 2,
      vertices: typeof args.vertices === "number" ? args.vertices : 32,
    }),
  },
  "3d.add.plane": {
    kind: "plane",
    extractParams: (args) => {
      const s = typeof args.size === "number" ? args.size : 2;
      return {
        width: typeof args.width === "number" ? args.width : s,
        height: typeof args.height === "number" ? args.height : s,
        size: s,
      };
    },
  },
  "3d.add.torus": {
    kind: "torus",
    extractParams: (args) => ({
      radius: typeof args.radius === "number" ? args.radius : 1,
      tube: typeof args.tube === "number" ? args.tube : 0.25,
      radialSegments: typeof args.radialSegments === "number" ? args.radialSegments : 16,
      tubularSegments: typeof args.tubularSegments === "number" ? args.tubularSegments : 32,
    }),
  },
  "3d.add.icosphere": {
    kind: "icoSphere",
    extractParams: (args) => ({
      radius: typeof args.radius === "number" ? args.radius : 1,
      subdivisions: typeof args.subdivisions === "number" ? args.subdivisions : 2,
    }),
  },
};

// ---------------------------------------------------------------------------
// Main Registration Function
// ---------------------------------------------------------------------------

/**
 * Registers parametric 3D primitive commands and wraps existing primitive
 * add commands so they record `source: { kind, params }`.
 * Returns an unregister cleanup function.
 */
export function register3dPrimitiveCommands(): () => void {
  const category = "3D";
  const cleanups: (() => void)[] = [];

  // 1. `3d.primitive.set_param`
  cleanups.push(
    defineTypedCommand({
      id: "3d.primitive.set_param",
      title: "Set Primitive Parameter",
      category,
      args: PrimitiveSetParamSchema,
      run: (args) => {
        const docBefore = getDocument();
        const nextDoc = setPrimitiveParam(
          docBefore,
          args.objectId,
          args.param,
          args.value
        );

        if (nextDoc !== docBefore) {
          documentCommands.mutate("Set Primitive Parameter", (draft) => {
            draft.meshes = nextDoc.meshes;
          });
        }

        recordLastOperation({
          id: "3d.primitive.set_param",
          args: args as Record<string, unknown>,
          docBefore,
          title: "Set Primitive Parameter",
        });

        return {
          ok: true,
          objectId: args.objectId,
          param: args.param,
          value: args.value,
        };
      },
    })
  );

  // 2. `3d.add.circle`
  cleanups.push(
    defineTypedCommand({
      id: "3d.add.circle",
      title: "Add Circle",
      category,
      args: AddCircleSchema,
      run: (args) => {
        const docBefore = getDocument();
        const params = { radius: args.radius, vertices: args.vertices };
        const generated = circleSpec.generate(params);

        const { doc: nextDoc, objectId } = addProceduralObject(
          docBefore,
          args.name,
          "circle",
          params,
          generated,
          args
        );

        documentCommands.mutate("Add Circle", (draft) => {
          draft.scenes = nextDoc.scenes;
          draft.objects = nextDoc.objects;
          draft.meshes = nextDoc.meshes;
        });

        recordLastOperation({
          id: "3d.add.circle",
          args: args as Record<string, unknown>,
          docBefore,
          title: "Add Circle",
        });

        return {
          ok: true,
          selection: [objectId],
          created: [objectId],
        };
      },
    })
  );

  // 3. `3d.add.capsule`
  cleanups.push(
    defineTypedCommand({
      id: "3d.add.capsule",
      title: "Add Capsule",
      category,
      args: AddCapsuleSchema,
      run: (args) => {
        const docBefore = getDocument();
        const params = {
          radius: args.radius,
          depth: args.depth,
          radialSegments: args.radialSegments,
          rings: args.rings,
        };
        const generated = capsuleSpec.generate(params);

        const { doc: nextDoc, objectId } = addProceduralObject(
          docBefore,
          args.name,
          "capsule",
          params,
          generated,
          args
        );

        documentCommands.mutate("Add Capsule", (draft) => {
          draft.scenes = nextDoc.scenes;
          draft.objects = nextDoc.objects;
          draft.meshes = nextDoc.meshes;
        });

        recordLastOperation({
          id: "3d.add.capsule",
          args: args as Record<string, unknown>,
          docBefore,
          title: "Add Capsule",
        });

        return {
          ok: true,
          selection: [objectId],
          created: [objectId],
        };
      },
    })
  );

  // 4. `3d.add.rounded_box`
  cleanups.push(
    defineTypedCommand({
      id: "3d.add.rounded_box",
      title: "Add Rounded Box",
      category,
      args: AddRoundedBoxSchema,
      run: (args) => {
        const docBefore = getDocument();
        const params = {
          width: args.width,
          height: args.height,
          depth: args.depth,
          bevel: args.bevel,
          segments: args.segments,
        };
        const generated = roundedBoxSpec.generate(params);

        const { doc: nextDoc, objectId } = addProceduralObject(
          docBefore,
          args.name,
          "roundedBox",
          params,
          generated,
          args
        );

        documentCommands.mutate("Add Rounded Box", (draft) => {
          draft.scenes = nextDoc.scenes;
          draft.objects = nextDoc.objects;
          draft.meshes = nextDoc.meshes;
        });

        recordLastOperation({
          id: "3d.add.rounded_box",
          args: args as Record<string, unknown>,
          docBefore,
          title: "Add Rounded Box",
        });

        return {
          ok: true,
          selection: [objectId],
          created: [objectId],
        };
      },
    })
  );

  // 5. Wrap existing canonical add commands to inject `source`
  for (const [cmdId, info] of Object.entries(WRAPPED_PRIMITIVES)) {
    const existing = getCommand(cmdId);
    if (!existing) continue;

    const originalRun = existing.run;

    const wrappedRun = (args?: unknown) => {
      const docBefore = getDocument();
      const result = (originalRun as (args?: unknown) => unknown)(args) as {
        ok?: boolean;
        created?: string[];
        selection?: string[];
      };

      if (result && Array.isArray(result.created) && result.created.length > 0) {
        const objId = result.created[0];
        const currentDoc = getDocument();
        const obj = currentDoc.objects?.[objId];

        if (obj?.dataId && currentDoc.meshes?.[obj.dataId]) {
          const meshId = obj.dataId;
          const mesh = currentDoc.meshes[meshId];

          if (!mesh.source) {
            const params = info.extractParams(
              (args as Record<string, unknown>) ?? {}
            );
            const nextDoc: MotionDocument = {
              ...currentDoc,
              meshes: {
                ...currentDoc.meshes,
                [meshId]: {
                  ...mesh,
                  source: {
                    kind: info.kind,
                    params,
                  },
                },
              },
            };

            setDocument(nextDoc);

            // Squash history to keep exactly 1 undo step
            const history = useHistoryStore.getState();
            const lastEntry = history.past[history.past.length - 1];
            if (lastEntry && lastEntry.change.kind === "document") {
              const patches = diffPatches(docBefore, nextDoc);
              const inversePatches = diffPatches(nextDoc, docBefore);
              history.replaceLast({
                ...lastEntry,
                change: {
                  kind: "document",
                  patches,
                  inversePatches,
                },
              });
            }
          }
        }
      }

      return result;
    };

    const unreg = defineCommand({
      ...existing,
      run: wrappedRun,
    });

    cleanups.push(() => {
      unreg();
      defineCommand(existing);
    });
  }

  return () => {
    for (const c of cleanups) {
      c();
    }
  };
}
