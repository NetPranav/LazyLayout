/**
 * ============================================================================
 * 3D DATA BLOCKS COMMANDS (ROADMAP_3D Phase 3D-024)
 * ============================================================================
 * Typed commands for 3D shared data blocks:
 *   - `3d.blocks.copy_attributes`
 *   - `3d.blocks.make_single_user`
 *
 * Registered under category "3D", creating one undo step each.
 * ============================================================================
 */

import { z } from "zod";
import { defineTypedCommand } from "../../commands";
import { documentCommands, getDocument } from "../../store/useDocumentStore";
import { makeSingleUser } from "../../document/dataBlocks";
import { copyAttributes } from "./copyAttributes";

export const BlocksCopyAttributesSchema = z.object({
  fromObjectId: z.string().min(1),
  toObjectIds: z.array(z.string().min(1)),
  parts: z.array(z.enum(["material", "modifiers", "transform", "visibility"])),
});
export type BlocksCopyAttributesArgs = z.infer<typeof BlocksCopyAttributesSchema>;

export const BlocksMakeSingleUserSchema = z.object({
  objectId: z.string().min(1),
  target: z.enum(["material", "mesh", "action"]).optional(),
  slot: z.number().int().nonnegative().optional(),
});
export type BlocksMakeSingleUserArgs = z.infer<typeof BlocksMakeSingleUserSchema>;

/**
 * Registers 3D blocks commands on the command bus.
 * Returns an unregister cleanup function.
 */
export function register3dBlocksCommands(): () => void {
  const category = "3D";
  const unregisters: (() => void)[] = [];

  unregisters.push(
    defineTypedCommand({
      id: "3d.blocks.copy_attributes",
      title: "Copy 3D Attributes",
      category,
      args: BlocksCopyAttributesSchema,
      run: (args) => {
        const doc = getDocument();
        const next = copyAttributes(
          doc,
          args.fromObjectId,
          args.toObjectIds,
          args.parts
        );
        documentCommands.mutate("Copy 3D Attributes", (draft) => {
          draft.objects = next.objects;
        });
        return { ok: true, selection: args.toObjectIds };
      },
    })
  );

  unregisters.push(
    defineTypedCommand({
      id: "3d.blocks.make_single_user",
      title: "Make Single User",
      category,
      args: BlocksMakeSingleUserSchema,
      run: (args) => {
        const doc = getDocument();
        const targetKind = args.target ?? (args.slot !== undefined ? "material" : "material");
        const next = makeSingleUser(
          doc,
          args.objectId,
          targetKind === "material" ? { kind: "material", slot: args.slot } : targetKind,
          args.slot
        );
        documentCommands.mutate("Make Single User", (draft) => {
          draft.objects = next.objects;
          draft.materials = next.materials;
          draft.meshes = next.meshes;
          draft.actions = next.actions;
        });
        return { ok: true, selection: [args.objectId] };
      },
    })
  );

  return () => {
    for (const unreg of unregisters) {
      unreg();
    }
  };
}
