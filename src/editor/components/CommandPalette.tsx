"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { Icon } from "./Icon";
import { surf, type Surf } from "../motion/surface";
import { useMounted } from "./useMounted";

export interface CommandItem {
  id: string;
  label: string;
  category?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: readonly CommandItem[];
  placeholder?: string;
  enableGlobalShortcut?: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  commands,
  placeholder = "Type a command or search...",
  enableGlobalShortcut = true,
}) => {
  const mounted = useMounted();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevOpen, setPrevOpen] = useState(open);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<Surf | null>(null);
  const prevActiveElement = useRef<HTMLElement | null>(null);

  // Sync state when open changes during render
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }

  // Filter commands based on query
  const filteredCommands = commands.filter((cmd) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.category?.toLowerCase().includes(q) ||
      cmd.shortcut?.toLowerCase().includes(q)
    );
  });

  // Attach Surf and wheel endBump
  useEffect(() => {
    if (!mounted || !open || !dialogRef.current) return;
    const dialogEl = dialogRef.current;
    const s = surf(dialogEl);
    surfRef.current = s;
    dialogEl.classList.add("open");

    return () => {
      s.reset();
      dialogEl.classList.remove("open");
    };
  }, [mounted, open]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    if (!enableGlobalShortcut) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [enableGlobalShortcut, open, onClose]);

  // Focus input on open and restore previous active element on close
  useEffect(() => {
    if (open) {
      prevActiveElement.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    } else {
      if (prevActiveElement.current && document.contains(prevActiveElement.current)) {
        prevActiveElement.current.focus();
      }
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        setSelectedIndex((prev) =>
          prev <= 0 ? filteredCommands.length - 1 : prev - 1
        );
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = filteredCommands[selectedIndex];
      if (current) {
        current.onSelect();
        onClose();
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>("[data-cmd-item]");
    const active = items[selectedIndex];
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="presentation"
      className="ll:fixed ll:inset-0 ll:z-70 ll:bg-surface-backdrop/50 ll:flex ll:items-start ll:justify-center ll:pt-dialog-pt ll:p-4 ll:font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
        className="ins ll:relative ll:w-full ll:max-w-xl ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:overflow-hidden ll:flex ll:flex-col ll:outline-none ll:font-sans"
      >
        <div className="ll-lay ll:flex ll:flex-col ll:flex-1">
          {/* Search Input Bar */}
          <div className="ll:flex ll:items-center ll:gap-3 ll:h-12 ll:px-4 ll:border-b ll:border-border ll:shrink-0">
            <Icon icon={Search} size={16} className="ll:text-muted ll:shrink-0" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="cmd-list"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder={placeholder}
              className="ll:w-full ll:h-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:text-body ll:text-primary ll:placeholder:text-muted ll:font-sans"
            />
            <kbd className="ll:font-mono ll:text-micro ll:text-muted ll:px-1.5 ll:py-0.5 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm">
              ESC
            </kbd>
          </div>

                        {/* Results List */}
                        <div
                          ref={listRef}
                          id="cmd-list"
                          role="listbox"
                          className="ll:max-h-80 ll:overflow-y-auto ll:p-1.5 ll:flex ll:flex-col ll:gap-0.5"
                        >
                          {filteredCommands.length === 0 ? (
                            <div className="ll:py-8 ll:text-center ll:text-small ll:text-muted ll:select-none ll:font-sans">
                              No commands found
                            </div>
                          ) : (
                            filteredCommands.map((cmd, idx) => {
                              const isSelected = idx === selectedIndex;
                              return (
                                <button
                                  key={cmd.id}
                                  data-cmd-item
                                  role="option"
                                  aria-selected={isSelected}
                                  type="button"
                                  onClick={() => {
                                    cmd.onSelect();
                                    onClose();
                                  }}
                                  onMouseEnter={() => setSelectedIndex(idx)}
                                  className={`ll:flex ll:items-center ll:gap-2.5 ll:w-full ll:h-9 ll:px-3 ll:rounded-sm ll:bg-transparent ll:border-0 ll:m-0 ll:py-0 ll:text-left ll:box-border ll:cursor-pointer ll:select-none ll:outline-none ll:transition-colors ll:duration-75 ll:font-sans ${isSelected
                                      ? "ll:bg-surface-hover ll:text-primary"
                                      : "ll:text-secondary ll:hover:text-primary"
                                    }`}
                                >
                                  {cmd.icon && (
                                    <span className="ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:shrink-0 ll:text-secondary">
                                      {cmd.icon}
                                    </span>
                                  )}
                                  <span className="ll:flex-1 ll:truncate ll:text-body ll:font-normal">
                                    {cmd.label}
                                  </span>
                          {cmd.category && (
                            <span className="ll:text-micro ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted">
                              {cmd.category}
                            </span>
                          )}
                          {cmd.shortcut && (
                            <kbd className="ll:font-mono ll:text-micro ll:text-muted ll:px-1.5 ll:py-0.5 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm">
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                        );
              })
            )}
                      </div>
        </div>
      </div>
        </div>,
        document.body
        );
};
