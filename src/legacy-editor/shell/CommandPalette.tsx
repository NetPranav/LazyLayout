"use client";

/**
 * ============================================================================
 * COMMAND PALETTE FLOATING MODAL
 * ============================================================================
 * Fast fuzzy search across all IDE actions, studio commands, tools, and shortcuts.
 * Activated by Ctrl+P / Cmd+P or Ctrl+K / Cmd+K.
 * Architecture Ref: ROADMAP.md §Sub-Phase 7.3 & Detailed Roadmap §Phase 28
 * ============================================================================
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { getAllCommands, getCommand, isCommandAvailable, formatKeybinding, type Command } from "@/core/commands";
import {
  Terminal,
  X,
} from "lucide-react";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand?: (command: Command) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onExecuteCommand,
}) => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | "All">("All");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // The registry is mutable (panels register/unregister their own commands
  // as they mount); snapshot it, and which of those currently apply given
  // live focus/context, each time the palette opens.
  // Phase 14: the palette is loaded the first time it opens, so it may mount already open; snapshot then too.
  const [allCommands, setAllCommands] = useState<Command[]>(() => (isOpen ? getAllCommands().filter((cmd) => isCommandAvailable(cmd)) : []));
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setQuery("");
      setActiveCategory("All");
      setSelectedIndex(0);
      setAllCommands(getAllCommands().filter((cmd) => isCommandAvailable(cmd)));
    }
  }

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const cmd of allCommands) if (cmd.category) seen.add(cmd.category);
    return ["All", ...Array.from(seen).sort()];
  }, [allCommands]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter commands based on query and category
  const filteredCommands = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    return allCommands.filter((cmd) => {
      // Category check
      if (activeCategory !== "All" && cmd.category !== activeCategory) {
        return false;
      }

      if (!trimmed) return true;

      // Fuzzy / Substring matches on title, description, category, and shortcut
      const title = cmd.title.toLowerCase();
      const desc = (cmd.description || "").toLowerCase();
      const cat = (cmd.category || "").toLowerCase();
      const shortcut = (formatKeybinding(cmd.keybinding) || "").toLowerCase();

      return (
        title.includes(trimmed) ||
        desc.includes(trimmed) ||
        cat.includes(trimmed) ||
        shortcut.includes(trimmed)
      );
    });
  }, [allCommands, query, activeCategory]);

  const handleExecute = (cmd: Command) => {
    onClose();
    if (onExecuteCommand) {
      onExecuteCommand(cmd);
    } else {
      // Not `runCommand`: its `when` re-check would see the palette's own
      // search input still focused (`onClose` only schedules the unmount;
      // `textEditing` doesn't flip until the resulting `focusout` fires) and
      // silently no-op every command gated on `!textEditing` — which is
      // most of them, including undo/redo. Availability was already
      // filtered by `isCommandAvailable` when `allCommands` was captured on
      // open, so re-checking `when` here only ever works against the palette
      // itself, never for it.
      getCommand(cmd.id)?.run();
    }
  };

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands.length > 0 && filteredCommands[selectedIndex]) {
        handleExecute(filteredCommands[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--surface-scrim)",

        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "90px",
        zIndex: 99999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          width: "640px",
          maxHeight: "500px",
          background: "var(--surface-panel-solid)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-modal)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "var(--text-primary)",
          fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        }}
      >
        {/* Command Input Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 18px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--surface-panel-solid)",
          }}
        >
          <span style={{ fontSize: 16, color: "var(--text-primary)", fontWeight: 800 }}>&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or press '?' for help..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: 14.5,
              fontWeight: 500,
            }}
          />

          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <X size={15} />
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: 2,
            }}
            title="Close (Esc)"
          >
            <kbd style={{ background: "var(--neutral-100)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>
              ESC
            </kbd>
          </button>
        </div>

        {/* Category Pills Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 18px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--surface-panel)",
            overflowX: "auto",
          }}
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "3px 9px",
                  background: isActive ? "var(--neutral-1000)" : "var(--neutral-100)",
                  color: isActive ? "var(--neutral-0)" : "var(--text-secondary)",
                  border: isActive ? "1px solid var(--neutral-1000)" : "1px solid var(--border-subtle)",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Command List */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            maxHeight: "360px",
          }}
        >
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, index) => {
              const isSelected = selectedIndex === index;
              const shortcut = formatKeybinding(cmd.keybinding);

              return (
                <div
                  key={cmd.id}
                  onClick={() => handleExecute(cmd)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: 6,
                    background: isSelected ? "var(--accent-primary-light)" : "transparent",
                    border: isSelected ? "1px solid var(--border-default)" : "1px solid transparent",
                    cursor: "pointer",
                    gap: 12,
                    transition: "all 0.1s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "var(--neutral-100)",
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                        flexShrink: 0,
                      }}
                    >
                      {cmd.category}
                    </span>

                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {cmd.title}
                      </span>
                      {cmd.description && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cmd.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {shortcut && (
                    <kbd
                      style={{
                        fontSize: 11,
                        fontFamily: "monospace",
                        background: isSelected ? "var(--neutral-200)" : "var(--neutral-100)",
                        border: "1px solid var(--border-subtle)",
                        padding: "3px 7px",
                        borderRadius: 4,
                        color: "var(--text-primary)",
                        flexShrink: 0,
                      }}
                    >
                      {shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 20px",
                color: "var(--text-secondary)",
                gap: 8,
              }}
            >
              <Terminal size={24} style={{ opacity: 0.5 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>No matching commands found</div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            background: "var(--surface-panel-solid)",
            borderTop: "1px solid var(--border-subtle)",
            fontSize: 11,
            color: "var(--text-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>
              <kbd style={{ background: "var(--neutral-100)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", padding: "1px 5px", borderRadius: 3 }}>↑↓</kbd> Select
            </span>
            <span>
              <kbd style={{ background: "var(--neutral-100)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", padding: "1px 5px", borderRadius: 3 }}>↵</kbd> Run Command
            </span>
          </div>
          <div>{filteredCommands.length} Commands Available</div>
        </div>
      </div>
    </div>
  );
};
