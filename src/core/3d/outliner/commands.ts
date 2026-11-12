/**
 * ============================================================================
 * 3D OUTLINER COMMANDS (ROADMAP_3D Phase 3D-021)
 * ============================================================================
 * Typed commands for the 3D outliner registered under category "3D".
 * Each command executes as an Immer mutation through `documentCommands.mutate`,
 * creating exactly one undo step.
 * ============================================================================
 */

import { z } from "zod";
import { defineTypedCommand } from "../../commands";
import { documentCommands, getDocument } from "../../store/useDocumentStore";
import {
  createCollection,
  deleteNode,
  moveToCollection,
  renameNode,
  reparent,
  setFlag,
} from "./ops";

export const OutlinerSetFlagSchema = z.object({
  id: z.string().min(1),
  flag: z.enum(["visible", "selectable", "renderVisible"]),
  value: z.boolean(),
});
export type OutlinerSetFlagArgs = z.infer<typeof OutlinerSetFlagSchema>;

export const OutlinerReparentSchema = z.object({
  objectId: z.string().min(1),
  newParentId: z.string().nullable(),
  beforeId: z.string().optional(),
});
export type OutlinerReparentArgs = z.infer<typeof OutlinerReparentSchema>;

export const OutlinerMoveToCollectionSchema = z.object({
  objectId: z.string().min(1),
  collectionId: z.string().nullable(),
});
export type OutlinerMoveToCollectionArgs = z.infer<typeof OutlinerMoveToCollectionSchema>;

export const OutlinerCreateCollectionSchema = z.object({
  sceneId: z.string().min(1),
  name: z.string().optional(),
  parent: z.string().nullable().optional(),
});
export type OutlinerCreateCollectionArgs = z.infer<typeof OutlinerCreateCollectionSchema>;

export const OutlinerRenameSchema = z.object({
  id: z.string().min(1),
  newName: z.string().min(1),
});
export type OutlinerRenameArgs = z.infer<typeof OutlinerRenameSchema>;

export const OutlinerDeleteSchema = z.object({
  id: z.string().min(1),
});
export type OutlinerDeleteArgs = z.infer<typeof OutlinerDeleteSchema>;

/**
 * Registers all 3D outliner commands on the command bus.
 * Returns an unregister cleanup function.
 */
export function register3dOutlinerCommands(): () => void {
  const category = "3D";
  const unregisters: (() => void)[] = [];

  unregisters.push(
    defineTypedCommand({
      id: "3d.outliner.set_flag",
      title: "Set 3D Visibility Flag",
      category,
      args: OutlinerSetFlagSchema,
      run: (args) => {
        const doc = getDocument();
        const next = setFlag(doc, args.id, args.flag, args.value);
        documentCommands.mutate("Set 3D Visibility Flag", (draft) => {
          draft.scenes = next.scenes;
          draft.objects = next.objects;
        });
        return { ok: true };
      },
    })
  );

  unregisters.push(
    defineTypedCommand({
      id: "3d.outliner.delete",
      title: "Delete 3D Entity",
      category,
      args: OutlinerDeleteSchema,
      run: (args) => {
        const doc = getDocument();
        const next = deleteNode(doc, args.id);
        documentCommands.mutate("Delete 3D Entity", (draft) => {
          draft.scenes = next.scenes;
          draft.objects = next.objects;
        });
        return { ok: true };
      },
    })
  );

  unregisters.push(
    defineTypedCommand({
      id: "3d.outliner.reparent",
      title: "Reparent 3D Object",
      category,
      args: OutlinerReparentSchema,
      run: (args) => {
        const doc = getDocument();
        const next = reparent(doc, args.objectId, args.newParentId, {
          beforeId: args.beforeId,
        });
        documentCommands.mutate("Reparent 3D Object", (draft) => {
          draft.scenes = next.scenes;
          draft.objects = next.objects;
        });
        return { ok: true, selection: [args.objectId] };
      },
    })
  );

  unregisters.push(
    defineTypedCommand({
      id: "3d.outliner.move_to_collection",
      title: "Move to 3D Collection",
      category,
      args: OutlinerMoveToCollectionSchema,
      run: (args) => {
        const doc = getDocument();
        const next = moveToCollection(doc, args.objectId, args.collectionId);
        documentCommands.mutate("Move to 3D Collection", (draft) => {
          draft.objects = next.objects;
        });
        return { ok: true, selection: [args.objectId] };
      },
    })
  );

  unregisters.push(
    defineTypedCommand({
      id: "3d.outliner.create_collection",
      title: "New 3D Collection",
      category,
      args: OutlinerCreateCollectionSchema,
      run: (args) => {
        const doc = getDocument();
        const next = createCollection(doc, args.sceneId, {
          name: args.name,
          parent: args.parent,
        });
        documentCommands.mutate("New 3D Collection", (draft) => {
          draft.scenes = next.scenes;
        });
        return { ok: true };
      },
    })
  );

  unregisters.push(
    defineTypedCommand({
      id: "3d.outliner.rename",
      title: "Rename 3D Entity",
      category,
      args: OutlinerRenameSchema,
      run: (args) => {
        const doc = getDocument();
        const next = renameNode(doc, args.id, args.newName);
        documentCommands.mutate("Rename 3D Entity", (draft) => {
          draft.scenes = next.scenes;
          draft.objects = next.objects;
          draft.materials = next.materials;
          draft.meshes = next.meshes;
          draft.lights = next.lights;
          draft.cameras = next.cameras;
          draft.armatures = next.armatures;
          draft.actions = next.actions;
        });
        return { ok: true };
      },
    })
  );

  unregisters.push(
    defineTypedCommand({
      id: "3d.outliner.delete",
      title: "Delete 3D Entity",
      category,
      args: OutlinerDeleteSchema,
      run: (args) => {
        const doc = getDocument();
        const next = deleteNode(doc, args.id);
        documentCommands.mutate("Delete 3D Entity", (draft) => {
          draft.scenes = next.scenes;
          draft.objects = next.objects;
        });
        return { ok: true };
      },
    })
  );

  return () => {
    for (const unreg of unregisters) {
      unreg();
    }
  };
}
