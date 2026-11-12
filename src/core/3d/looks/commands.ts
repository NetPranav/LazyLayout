/**
 * ============================================================================
 * 3D LOOKS COMMANDS (Phase 3D-023)
 * ============================================================================
 * Typed commands registered under category "3D":
 *   - 3d.look.apply: Applies a preset or saved look to target objects.
 *   - 3d.look.save: Persists a user look in the document looks table.
 *   - 3d.look.delete: Removes a user look from the document.
 * Each command executes as exactly 1 atomic undo step via `documentCommands.mutate`.
 * ============================================================================
 */

import { z } from "zod";
import { defineTypedCommand } from "@/core/commands";
import { documentCommands, getDocument } from "@/core/store/useDocumentStore";
import { Look3dSchema } from "@/core/document/schema";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { applyLook } from "./applyLook";

export const LookApplySchema = z.object({
  lookId: z.string().min(1),
  targetIds: z.array(z.string()).optional(),
});
export type LookApplyArgs = z.infer<typeof LookApplySchema>;

export const LookSaveSchema = z.object({
  look: Look3dSchema,
});
export type LookSaveArgs = z.infer<typeof LookSaveSchema>;

export const LookDeleteSchema = z.object({
  lookId: z.string().min(1),
});
export type LookDeleteArgs = z.infer<typeof LookDeleteSchema>;

/**
 * Registers all 3D Look commands on the central command bus.
 * Returns an unregister cleanup function.
 */
export function register3dLookCommands(): () => void {
  const category = "3D";
  const unregisters: (() => void)[] = [];

  // 1. 3d.look.apply
  unregisters.push(
    defineTypedCommand({
      id: "3d.look.apply",
      title: "Apply 3D Look",
      category,
      args: LookApplySchema,
      run: (args) => {
        let targets = args.targetIds;
        if (!targets || targets.length === 0) {
          const sel = useViewportStore.getState().selection;
          targets = sel.selected.length > 0 ? [...sel.selected] : sel.active ? [sel.active] : [];
        }
        if (targets.length === 0) return { ok: false, error: "No target objects selected" };

        const doc = getDocument();
        const next = applyLook(doc, targets, args.lookId);

        documentCommands.mutate("Apply 3D Look", (draft) => {
          draft.objects = next.objects;
          draft.materials = next.materials;
          draft.lights = next.lights;
          draft.looks = next.looks;
        });

        return { ok: true, targets, lookId: args.lookId };
      },
    })
  );

  // 2. 3d.look.save
  unregisters.push(
    defineTypedCommand({
      id: "3d.look.save",
      title: "Save 3D Look",
      category,
      args: LookSaveSchema,
      run: (args) => {
        documentCommands.mutate("Save 3D Look", (draft) => {
          if (!draft.looks) draft.looks = {};
          draft.looks[args.look.id] = args.look;
        });

        return { ok: true, lookId: args.look.id };
      },
    })
  );

  // 3. 3d.look.delete
  unregisters.push(
    defineTypedCommand({
      id: "3d.look.delete",
      title: "Delete 3D Look",
      category,
      args: LookDeleteSchema,
      run: (args) => {
        documentCommands.mutate("Delete 3D Look", (draft) => {
          if (draft.looks) {
            delete draft.looks[args.lookId];
          }
        });

        return { ok: true, lookId: args.lookId };
      },
    })
  );

  return () => {
    unregisters.forEach((off) => off());
  };
}
