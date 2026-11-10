"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getAllCommands, invokeCommand, isCommandAvailable, formatKeybinding } from "@/core/commands";
import { CommandPalette, type CommandItem } from "@/editor/components/CommandPalette";

/**
 * Ctrl+K and the search button open the palette (they send "antigravity:open_command_palette"); it lists every command
 * the editor has registered that can run now, and runs the one you pick.
 */
export const ConnectedCommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("antigravity:open_command_palette", show);
    return () => window.removeEventListener("antigravity:open_command_palette", show);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const commands = useMemo<CommandItem[]>(() => {
    if (!open) return [];
    return getAllCommands()
      .filter((c) => c.title && isCommandAvailable(c))
      .map((c) => {
        const key = Array.isArray(c.keybinding) ? c.keybinding[0] : c.keybinding;
        return {
          id: c.id,
          label: c.title as string,
          category: c.category,
          shortcut: key ? formatKeybinding(key) : undefined,
          onSelect: () => {
            setOpen(false);
            // let the palette close and give focus back before the command runs
            window.setTimeout(() => invokeCommand(c.id), 0);
          },
        };
      })
      .sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.label.localeCompare(b.label));
  }, [open]);

  return <CommandPalette open={open} onClose={close} commands={commands} enableGlobalShortcut={false} />;
};
