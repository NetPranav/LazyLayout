/**
 * ============================================================================
 * 3D KEYMAP BINDING INTEGRATION (Phase 3D-020)
 * ============================================================================
 * Live command registry synchronization for 3D viewport keymaps.
 * Re-registers all canonical 3D commands with their active keybindings
 * and context gates through `defineCommand`.
 * ============================================================================
 */

import { defineCommand, getAllCommands, getCommand } from "../../commands/registry";
import { normalizeShortcut } from "../../commands/normalize";
import type { ContextKeys } from "../../commands/types";
import { CANONICAL_3D_COMMAND_IDS, type KeyBinding, type Keymap, type KeymapId } from "./types";
import { blenderKeymap } from "./blender";
import { beginnerKeymap } from "./beginner";

/**
 * Formats a KeyBinding into a canonical normalized shortcut string (e.g. "Ctrl+Shift+A").
 * Returns an empty string for non-keyboard events (such as "mouse2").
 */
export function formatKeyBindingShortcut(b: KeyBinding): string {
  if (b.key.toLowerCase() === "mouse2") {
    return "";
  }

  const parts: string[] = [];
  if (b.ctrl || b.meta) parts.push("Ctrl");
  if (b.alt) parts.push("Alt");
  if (b.shift) parts.push("Shift");

  const k = b.key.trim();
  const normalizedKey = k.length === 1 ? k.toUpperCase() : k;
  parts.push(normalizedKey);

  return normalizeShortcut(parts.join("+"));
}

/**
 * Returns the Keymap preset object for a given KeymapId.
 */
export function getKeymapById(id: KeymapId): Keymap {
  return id === "beginner" ? beginnerKeymap : blenderKeymap;
}

/**
 * Applies a 3D keymap to the live command registry.
 *
 * For every canonical `3d.*` command:
 *   - If the keymap defines shortcut(s), sets `command.keybinding` and
 *     scopes its `when` clause to active 3D editing (`!textEditing && editingScene3d`).
 *   - If the keymap designates the command as unmapped (toolbar only),
 *     clears `command.keybinding` to prevent accidental collisions.
 *
 * Returns an unbind cleanup function.
 */
export function bindKeymap(keymap: Keymap): () => void {
  // 1. Group shortcuts by canonical command ID
  const shortcutsByCommand = new Map<string, string[]>();

  for (const b of keymap.bindings) {
    const formatted = formatKeyBindingShortcut(b);
    if (!formatted) continue;

    const list = shortcutsByCommand.get(b.command);
    if (list) {
      if (!list.includes(formatted)) list.push(formatted);
    } else {
      shortcutsByCommand.set(b.command, [formatted]);
    }
  }

  // 2. Identify all 3D commands currently registered or canonical
  const allCmds = getAllCommands();
  const commandIds = new Set<string>();

  for (const id of CANONICAL_3D_COMMAND_IDS) {
    commandIds.add(id);
  }
  for (const cmd of allCmds) {
    if (cmd.id.startsWith("3d.")) {
      commandIds.add(cmd.id);
    }
  }

  // Snapshot previous keybindings and when clauses for clean rollback
  const previousSnapshots = new Map<
    string,
    { keybinding?: string | string[]; when?: (ctx: ContextKeys) => boolean }
  >();

  for (const id of commandIds) {
    const cmd = getCommand(id);
    if (!cmd) continue;

    previousSnapshots.set(id, {
      keybinding: cmd.keybinding,
      when: cmd.when,
    });

    const shortcuts = shortcutsByCommand.get(id);
    const hasShortcuts = shortcuts && shortcuts.length > 0;

    const newKeybinding: string | string[] | undefined = hasShortcuts
      ? shortcuts.length === 1
        ? shortcuts[0]
        : shortcuts
      : undefined;

    const newWhen = (ctx: ContextKeys): boolean => {
      if (ctx.textEditing) return false;
      return Boolean(ctx.editingScene3d);
    };

    defineCommand({
      ...cmd,
      keybinding: newKeybinding,
      when: newWhen,
    });
  }

  // Cleanup: restore previous command bindings
  return () => {
    for (const [id, snap] of previousSnapshots.entries()) {
      const cmd = getCommand(id);
      if (cmd) {
        defineCommand({
          ...cmd,
          keybinding: snap.keybinding,
          when: snap.when,
        });
      }
    }
  };
}
