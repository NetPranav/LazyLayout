/**
 * ============================================================================
 * ADD AT 3D CURSOR WRAPPER (ROADMAP Phase 3D-017 / 3D-019)
 * ============================================================================
 * Additive wrapper for canonical `3d.add.*` commands:
 * When adding objects without an explicit location argument, the object is
 * placed at the active 3D cursor position (`viewportStore.cursor.position`)
 * and targeted at the currently active editing scene (`editingSceneId`).
 * Does not mutate or rename existing schema files in `src/core/3d/commands/`.
 * ============================================================================
 */

import { getCommand, defineCommand, runCommand } from "@/core/commands";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";

export const ADD_PRIMITIVE_COMMAND_IDS = [
  "3d.add.cube",
  "3d.add.sphere",
  "3d.add.cylinder",
  "3d.add.cone",
  "3d.add.plane",
  "3d.add.torus",
  "3d.add.icosphere",
  "3d.add.circle",
  "3d.add.capsule",
  "3d.add.rounded_box",
  "3d.add.text",
  "3d.add.light.point",
  "3d.add.light.sun",
  "3d.add.light.spot",
  "3d.add.camera",
  "3d.add.empty",
] as const;

export type AddPrimitiveCommandId = (typeof ADD_PRIMITIVE_COMMAND_IDS)[number];

export interface AddAtCursorArgs {
  location?: [number, number, number];
  sceneId?: string;
  [key: string]: unknown;
}

/**
 * Resolves location with cursor default if not explicitly specified.
 */
export function resolveAddArgsWithCursor(rawArgs?: AddAtCursorArgs): AddAtCursorArgs {
  const store = useViewportStore.getState();
  const cursorPos = store.cursor.position;
  const editingScene = store.editingSceneId;

  const args: AddAtCursorArgs = { ...(rawArgs ?? {}) };

  // If location was not explicitly provided by caller, default to 3D cursor
  if (!rawArgs || rawArgs.location === undefined) {
    args.location = [cursorPos[0], cursorPos[1], cursorPos[2]];
  }

  // If sceneId was not explicitly provided, default to current editing scene
  if (!rawArgs || rawArgs.sceneId === undefined) {
    if (editingScene) {
      args.sceneId = editingScene;
    }
  }

  return args;
}

/**
 * Wraps all registered `3d.add.*` commands so calls without explicit location
 * receive the cursor position from `useViewportStore`.
 * Returns an unregister cleanup function.
 */
export function installAddAtCursorWrapper(): () => void {
  const cleanups: (() => void)[] = [];

  for (const cmdId of ADD_PRIMITIVE_COMMAND_IDS) {
    const existing = getCommand(cmdId);
    if (!existing) continue;

    const originalRun = existing.run;

    const wrappedRun = (args?: unknown) => {
      const resolved = resolveAddArgsWithCursor(args as AddAtCursorArgs | undefined);
      return (originalRun as (args?: unknown) => unknown)(resolved);
    };

    const unreg = defineCommand({
      ...existing,
      run: wrappedRun,
    });
    cleanups.push(unreg);
  }

  return () => {
    for (const c of cleanups) {
      c();
    }
  };
}

/**
 * Directly invokes an add primitive command, injecting cursor location if omitted.
 */
export function addPrimitiveAtCursor(
  commandId: AddPrimitiveCommandId,
  args?: AddAtCursorArgs
): unknown {
  const resolved = resolveAddArgsWithCursor(args);
  return runCommand(commandId, resolved);
}
