/**
 * ============================================================================
 * 3D MODIFIER COMMANDS (Phase 3D-030)
 * ============================================================================
 * Typed commands registered under category "3D":
 *   - 3d.modifier.add
 *   - 3d.modifier.remove
 *   - 3d.modifier.reorder
 *   - 3d.modifier.set_param
 *   - 3d.modifier.set_visibility
 *   - 3d.modifier.apply
 *   - 3d.modifier.apply_all
 * Each command executes as a single atomic undo step via `documentCommands.mutate`.
 * ============================================================================
 */

import { z } from "zod";
import { defineTypedCommand } from "../../commands";
import { documentCommands, getDocument } from "../../store/useDocumentStore";
import { createId } from "../../ids";
import type { Modifier3d } from "../../document/schema";
import {
  addModifier,
  removeModifier,
  reorderModifier,
  setModifierParam,
  setModifierVisibility,
  applyModifier,
  applyAll,
} from "./stack";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ModifierAddArgsSchema = z.object({
  objectId: z.string(),
  type: z.string(),
  name: z.string().optional(),
  id: z.string().optional(),
  enabled: z.boolean().optional(),
  renderEnabled: z.boolean().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  index: z.number().int().optional(),
});
export type ModifierAddArgs = z.infer<typeof ModifierAddArgsSchema>;

export const ModifierRemoveArgsSchema = z.object({
  objectId: z.string(),
  modifierId: z.string(),
});
export type ModifierRemoveArgs = z.infer<typeof ModifierRemoveArgsSchema>;

export const ModifierReorderArgsSchema = z.object({
  objectId: z.string(),
  modifierId: z.string(),
  newIndex: z.number().int(),
});
export type ModifierReorderArgs = z.infer<typeof ModifierReorderArgsSchema>;

export const ModifierSetParamArgsSchema = z.object({
  objectId: z.string(),
  modifierId: z.string(),
  param: z.string(),
  value: z.unknown(),
});
export type ModifierSetParamArgs = z.infer<typeof ModifierSetParamArgsSchema>;

export const ModifierSetVisibilityArgsSchema = z.object({
  objectId: z.string(),
  modifierId: z.string(),
  enabled: z.boolean().optional(),
  renderEnabled: z.boolean().optional(),
});
export type ModifierSetVisibilityArgs = z.infer<typeof ModifierSetVisibilityArgsSchema>;

export const ModifierApplyArgsSchema = z.object({
  objectId: z.string(),
  modifierId: z.string(),
});
export type ModifierApplyArgs = z.infer<typeof ModifierApplyArgsSchema>;

export const ModifierApplyAllArgsSchema = z.object({
  objectId: z.string(),
});
export type ModifierApplyAllArgs = z.infer<typeof ModifierApplyAllArgsSchema>;

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function register3dModifierCommands(): () => void {
  const category = "3D";
  const unregisters: (() => void)[] = [];

  // 1. 3d.modifier.add
  unregisters.push(
    defineTypedCommand({
      id: "3d.modifier.add",
      title: "Add Modifier",
      category,
      args: ModifierAddArgsSchema,
      run: (args) => {
        const mod: Modifier3d = {
          id: args.id ?? createId("mod"),
          type: args.type,
          name: args.name ?? args.type,
          enabled: args.enabled ?? true,
          renderEnabled: args.renderEnabled ?? true,
          params: args.params ?? {},
        };

        const docBefore = getDocument();
        const updated = addModifier(docBefore, args.objectId, mod, args.index);

        documentCommands.mutate("Add Modifier", (draft) => {
          draft.objects = updated.objects;
        });

        return { ok: true, modifierId: mod.id };
      },
    })
  );

  // 2. 3d.modifier.remove
  unregisters.push(
    defineTypedCommand({
      id: "3d.modifier.remove",
      title: "Remove Modifier",
      category,
      args: ModifierRemoveArgsSchema,
      run: (args) => {
        const docBefore = getDocument();
        const updated = removeModifier(docBefore, args.objectId, args.modifierId);

        documentCommands.mutate("Remove Modifier", (draft) => {
          draft.objects = updated.objects;
        });

        return { ok: true };
      },
    })
  );

  // 3. 3d.modifier.reorder
  unregisters.push(
    defineTypedCommand({
      id: "3d.modifier.reorder",
      title: "Reorder Modifier",
      category,
      args: ModifierReorderArgsSchema,
      run: (args) => {
        const docBefore = getDocument();
        const updated = reorderModifier(docBefore, args.objectId, args.modifierId, args.newIndex);

        documentCommands.mutate("Reorder Modifier", (draft) => {
          draft.objects = updated.objects;
        });

        return { ok: true };
      },
    })
  );

  // 4. 3d.modifier.set_param
  unregisters.push(
    defineTypedCommand({
      id: "3d.modifier.set_param",
      title: "Set Modifier Parameter",
      category,
      args: ModifierSetParamArgsSchema,
      run: (args) => {
        const docBefore = getDocument();
        const updated = setModifierParam(docBefore, args.objectId, args.modifierId, args.param, args.value);

        documentCommands.mutate("Set Modifier Parameter", (draft) => {
          draft.objects = updated.objects;
        });

        return { ok: true };
      },
    })
  );

  // 5. 3d.modifier.set_visibility
  unregisters.push(
    defineTypedCommand({
      id: "3d.modifier.set_visibility",
      title: "Set Modifier Visibility",
      category,
      args: ModifierSetVisibilityArgsSchema,
      run: (args) => {
        const docBefore = getDocument();
        const updated = setModifierVisibility(docBefore, args.objectId, args.modifierId, {
          enabled: args.enabled,
          renderEnabled: args.renderEnabled,
        });

        documentCommands.mutate("Set Modifier Visibility", (draft) => {
          draft.objects = updated.objects;
        });

        return { ok: true };
      },
    })
  );

  // 6. 3d.modifier.apply
  unregisters.push(
    defineTypedCommand({
      id: "3d.modifier.apply",
      title: "Apply Modifier",
      category,
      args: ModifierApplyArgsSchema,
      run: (args) => {
        const docBefore = getDocument();
        const updated = applyModifier(docBefore, args.objectId, args.modifierId);

        documentCommands.mutate("Apply Modifier", (draft) => {
          draft.objects = updated.objects;
          draft.meshes = updated.meshes;
        });

        return { ok: true };
      },
    })
  );

  // 7. 3d.modifier.apply_all
  unregisters.push(
    defineTypedCommand({
      id: "3d.modifier.apply_all",
      title: "Apply All Modifiers",
      category,
      args: ModifierApplyAllArgsSchema,
      run: (args) => {
        const docBefore = getDocument();
        const updated = applyAll(docBefore, args.objectId);

        documentCommands.mutate("Apply All Modifiers", (draft) => {
          draft.objects = updated.objects;
          draft.meshes = updated.meshes;
        });

        return { ok: true };
      },
    })
  );

  return () => {
    unregisters.forEach((off) => off());
  };
}
