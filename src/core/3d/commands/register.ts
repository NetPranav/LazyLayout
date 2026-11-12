/**
 * ============================================================================
 * 3D COMMANDS REGISTRATION (Phase 3D-011)
 * ============================================================================
 * Registers all canonical 3D commands with `defineTypedCommand` under category "3D".
 * Every command runs as an Immer mutation through `documentCommands.mutate`,
 * creating exactly one undo step and recording the last operation for interactive tweaking.
 * ============================================================================
 */

import { defineTypedCommand } from "../../commands";
import { documentCommands, getDocument } from "../../store/useDocumentStore";
import { COMMAND_SCHEMAS, COMMAND_TITLES, run3dOp } from "./ops";
import { recordLastOperation } from "./lastOperation";

/**
 * Registers all 3D commands on the command bus.
 * Returns an unregister cleanup function.
 */
export function register3dCommands(): () => void {
  const category = "3D";
  const unregisters: (() => void)[] = [];

  for (const [id, schema] of Object.entries(COMMAND_SCHEMAS)) {
    const title = COMMAND_TITLES[id] ?? id;

    const unregister = defineTypedCommand({
      id,
      title,
      category,
      args: schema,
      run: (args) => {
        const docBefore = getDocument();
        const result = run3dOp(id, docBefore, args);

        documentCommands.mutate(title, (draft) => {
          draft.scenes = result.doc.scenes;
          draft.objects = result.doc.objects;
          draft.meshes = result.doc.meshes;
          draft.materials = result.doc.materials;
          draft.lights = result.doc.lights;
          draft.cameras = result.doc.cameras;
          draft.armatures = result.doc.armatures;
          draft.actions = result.doc.actions;
          draft.worlds = result.doc.worlds;
          draft.images3d = result.doc.images3d;
        });

        recordLastOperation({
          id,
          args: (args as Record<string, unknown>) ?? {},
          docBefore,
          title,
        });

        return {
          ok: true,
          selection: result.selection,
          created: result.created,
        };
      },
    });

    unregisters.push(unregister);
  }

  return () => {
    unregisters.forEach((off) => off());
  };
}
