"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  ChevronDown,
  Frame,
  Grid,
  Magnet,
  Ruler,
  Plus,
  Sliders,
  Film,
  Download,
  Maximize,
  Keyboard,
  Code,
  Palette,
  Terminal,
  AlignLeft,
} from "lucide-react";
import { Icon } from "./Icon";
import { Menu, MenuItem, SubMenu, MenuSeparator } from "./Menu";
import { useSlidingIndicator } from "./useSlidingIndicator";

export type EditorMode = "design" | "motion" | "code";

export interface ModeTabsProps {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
  disabled?: boolean;
  className?: string;
  dataState?: "hover" | "focus";
}

interface ModeItem {
  id: EditorMode;
  label: string;
}

const MODES: readonly ModeItem[] = [
  { id: "design", label: "Design" },
  { id: "motion", label: "Motion" },
  { id: "code", label: "Code" },
];

export const ModeTabs: React.FC<ModeTabsProps> = ({
  mode,
  onChange,
  disabled = false,
  className = "",
  dataState,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const curIdx = MODES.findIndex((m) => m.id === mode);

  useSlidingIndicator({
    containerRef,
    indicatorRef: highlightRef,
    itemRefs: tabRefs,
    selectedIndex: curIdx >= 0 ? curIdx : 0,
  });

  const handleTabClick = (item: ModeItem) => {
    if (disabled) return;
    if (mode === item.id) {
      setMenuOpen((prev) => !prev);
    } else {
      setMenuOpen(false);
      onChange(item.id);
    }
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      let nextIdx = -1;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextIdx = (curIdx + 1) % MODES.length;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nextIdx = (curIdx - 1 + MODES.length) % MODES.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIdx = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIdx = MODES.length - 1;
      }

      if (nextIdx >= 0) {
        const next = MODES[nextIdx];
        if (next) {
          onChange(next.id);
          tabRefs.current[nextIdx]?.focus();
        }
      }
    },
    [curIdx, onChange, disabled]
  );

  const activeAnchorRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className="ll:relative ll:inline-flex">
      <div
        ref={containerRef}
        role="tablist"
        aria-label="Mode"
        data-state={dataState}
        onKeyDown={handleKeyDown}
        className={`modes ll-modes ll:relative ll:flex ll:items-center ll:gap-0.5 ll:h-8 ll:p-0.5 ll:border ll:border-border ll:rounded-md ll:self-center ll:box-border ${
          disabled ? "ll:opacity-40 ll:pointer-events-none" : ""
        } ${className}`}
      >
        {/* Sliding spring highlight (.mhl) */}
        <div
          ref={highlightRef}
          aria-hidden="true"
          className="mhl ll-mhl ll:absolute ll:top-0.5 ll:left-0 ll:h-mode-tab ll:w-mode-tab ll:bg-control-active ll:rounded-sm ll:pointer-events-none ll:will-change-transform ll:hidden"
        />

        {MODES.map((item, index) => {
          const isSelected = mode === item.id;
          const isForcedHover = dataState === "hover" && !isSelected && index === 1;
          const isForcedFocus = dataState === "focus" && isSelected;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[index] = el;
                if (isSelected) {
                  activeAnchorRef.current = el;
                }
              }}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-haspopup="menu"
              aria-expanded={isSelected ? menuOpen : undefined}
              data-mode={item.id}
              disabled={disabled}
              tabIndex={isSelected && !disabled ? 0 : -1}
              onClick={() => handleTabClick(item)}
              className={`mode ll-mode ll:relative ll:z-10 ll:w-mode-tab ll:h-mode-tab ll:rounded-sm ll:flex ll:items-center ll:justify-center ll:gap-0.5 ll:text-body ll:font-medium ll:whitespace-nowrap ll:select-none ll:cursor-pointer ll:outline-none ll:border-0 ll:transition-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${
                isForcedFocus ? "ll:ring-1 ll:ring-primary " : ""
              }${
                isSelected
                  ? "ll:bg-transparent ll:text-primary"
                  : isForcedHover
                  ? "ll:bg-surface-bar ll:text-primary"
                  : "ll:bg-transparent ll:text-muted ll:hover:bg-surface-bar ll:hover:text-primary"
              }`}
            >
              <span>{item.label}</span>
              {isSelected && (
                <Icon
                  icon={ChevronDown}
                  size={10}
                  className="mcv ll-mcv ll:text-muted ll:shrink-0 ll:ml-0.5"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Mode menu: opens when clicking the active tab */}
      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={activeAnchorRef}
        width={220}
        aria-label={`${MODES[curIdx]?.label ?? "Mode"} menu`}
      >
        {mode === "design" && (
          <>
            <SubMenu id="m_frames" label="Frame presets" icon={<Icon icon={Frame} size={14} />}>
              <MenuItem onClick={() => setMenuOpen(false)}>Desktop 1440</MenuItem>
              <MenuItem onClick={() => setMenuOpen(false)}>Tablet 768</MenuItem>
              <MenuItem onClick={() => setMenuOpen(false)}>Mobile 375</MenuItem>
            </SubMenu>
            <MenuItem icon={<Icon icon={Grid} size={14} />} onClick={() => setMenuOpen(false)}>
              Layout grids
            </MenuItem>
            <MenuSeparator />
            <SubMenu id="m_snap" label="Snapping" icon={<Icon icon={Magnet} size={14} />}>
              <MenuItem checked onClick={() => setMenuOpen(false)}>Snap objects</MenuItem>
              <MenuItem checked onClick={() => setMenuOpen(false)}>Snap guides</MenuItem>
              <MenuItem onClick={() => setMenuOpen(false)}>Pixel grid</MenuItem>
            </SubMenu>
            <MenuItem
              icon={<Icon icon={Ruler} size={14} />}
              shortcut="⇧R"
              onClick={() => setMenuOpen(false)}
            >
              Rulers
            </MenuItem>
          </>
        )}

        {mode === "motion" && (
          <>
            <MenuItem icon={<Icon icon={Plus} size={14} />} onClick={() => setMenuOpen(false)}>
              New animation
            </MenuItem>
            <MenuItem icon={<Icon icon={Sliders} size={14} />} onClick={() => setMenuOpen(false)}>
              Presets library
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Icon icon={Film} size={14} />} onClick={() => setMenuOpen(false)}>
              Composition settings
            </MenuItem>
            <MenuItem icon={<Icon icon={Download} size={14} />} onClick={() => setMenuOpen(false)}>
              Export animation
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Icon icon={Maximize} size={14} />}
              shortcut="⇧T"
              onClick={() => setMenuOpen(false)}
            >
              Full-width timeline
            </MenuItem>
            <MenuItem icon={<Icon icon={Keyboard} size={14} />} onClick={() => setMenuOpen(false)}>
              Keyboard shortcuts
            </MenuItem>
          </>
        )}

        {mode === "code" && (
          <>
            <SubMenu id="m_fw" label="Framework" icon={<Icon icon={Code} size={14} />}>
              <MenuItem checked onClick={() => setMenuOpen(false)}>React</MenuItem>
              <MenuItem onClick={() => setMenuOpen(false)}>Vue</MenuItem>
              <MenuItem onClick={() => setMenuOpen(false)}>Svelte</MenuItem>
              <MenuItem onClick={() => setMenuOpen(false)}>HTML</MenuItem>
            </SubMenu>
            <SubMenu id="m_sty" label="Styling" icon={<Icon icon={Palette} size={14} />}>
              <MenuItem checked onClick={() => setMenuOpen(false)}>Tailwind</MenuItem>
              <MenuItem onClick={() => setMenuOpen(false)}>CSS Modules</MenuItem>
              <MenuItem onClick={() => setMenuOpen(false)}>Inline styles</MenuItem>
            </SubMenu>
            <MenuSeparator />
            <MenuItem icon={<Icon icon={Download} size={14} />} onClick={() => setMenuOpen(false)}>
              Export repo
            </MenuItem>
            <MenuItem icon={<Icon icon={Terminal} size={14} />} onClick={() => setMenuOpen(false)}>
              Console
            </MenuItem>
            <MenuItem icon={<Icon icon={AlignLeft} size={14} />} onClick={() => setMenuOpen(false)}>
              Format code
            </MenuItem>
          </>
        )}
      </Menu>
    </div>
  );
};
