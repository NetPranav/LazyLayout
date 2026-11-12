"use client";

/**
 * ============================================================================
 * 3D ADD MENU & HEADER BUTTON (Phase 3D-025 / 3D-026, Task B3-W3-addtext)
 * ============================================================================
 * Blender-style Add Menu (Shift+A):
 *   - Mesh: Cube, Plane, Circle, Cylinder, Cone, UV Sphere, Ico Sphere,
 *           Torus, Capsule, Rounded Box
 *   - Text: 3D procedural text object with instant in-place edit request
 *   - Light: Point, Sun, Spot
 *   - Camera
 *   - Empty
 * Navigable via keyboard arrows, search typing filter, Enter to run, Escape to dismiss.
 * Includes an "Add" header button mounted alongside SnapBar in the viewport strip.
 * ============================================================================
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { create } from "zustand";
import {
  Plus,
  Box,
  Circle,
  Cylinder,
  Type,
  Lightbulb,
  Sun,
  Camera,
  Maximize2,
  ChevronRight,
  Search,
  Square,
  Sparkles,
  Disc,
} from "lucide-react";
import { defineCommand, getCommand, tryRunCommand } from "@/core/commands";
import {
  addPrimitiveAtCursor,
  type AddPrimitiveCommandId,
  resolveAddArgsWithCursor,
} from "./addAtCursor";
import { requestTextEdit3d } from "./TextEditOverlay3d";
import { ensureFontLoaded } from "./textFontSeam";

export interface MenuItemDef {
  id: string;
  label: string;
  commandId?: AddPrimitiveCommandId;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  children?: MenuItemDef[];
}

export const ADD_MENU_ITEMS: MenuItemDef[] = [
  {
    id: "mesh",
    label: "Mesh",
    icon: Box,
    children: [
      { id: "plane", label: "Plane", commandId: "3d.add.plane", icon: Square },
      { id: "cube", label: "Cube", commandId: "3d.add.cube", icon: Box },
      { id: "circle", label: "Circle", commandId: "3d.add.circle", icon: Disc },
      { id: "cylinder", label: "Cylinder", commandId: "3d.add.cylinder", icon: Cylinder },
      { id: "cone", label: "Cone", commandId: "3d.add.cone", icon: Sparkles },
      { id: "uvSphere", label: "UV Sphere", commandId: "3d.add.sphere", icon: Circle },
      { id: "icoSphere", label: "Ico Sphere", commandId: "3d.add.icosphere", icon: Circle },
      { id: "torus", label: "Torus", commandId: "3d.add.torus", icon: Disc },
      { id: "capsule", label: "Capsule", commandId: "3d.add.capsule", icon: Cylinder },
      { id: "roundedBox", label: "Rounded Box", commandId: "3d.add.rounded_box", icon: Box },
    ],
  },
  {
    id: "text",
    label: "Text",
    commandId: "3d.add.text",
    icon: Type,
  },
  {
    id: "light",
    label: "Light",
    icon: Lightbulb,
    children: [
      { id: "light-point", label: "Point", commandId: "3d.add.light.point", icon: Lightbulb },
      { id: "light-sun", label: "Sun", commandId: "3d.add.light.sun", icon: Sun },
      { id: "light-spot", label: "Spot", commandId: "3d.add.light.spot", icon: Lightbulb },
    ],
  },
  {
    id: "camera",
    label: "Camera",
    commandId: "3d.add.camera",
    icon: Camera,
  },
  {
    id: "empty",
    label: "Empty",
    commandId: "3d.add.empty",
    icon: Maximize2,
  },
];

interface AddMenuState {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  pointerPos: { x: number; y: number } | null;
  openMenu: (pos?: { x: number; y: number }) => void;
  closeMenu: () => void;
  setPointerPos: (pos: { x: number; y: number }) => void;
}

export const useAddMenuStore = create<AddMenuState>((set, get) => ({
  isOpen: false,
  position: null,
  pointerPos: null,
  openMenu: (pos) => {
    const targetPos = pos ?? get().pointerPos ?? { x: 200, y: 150 };
    set({ isOpen: true, position: targetPos });
  },
  closeMenu: () => set({ isOpen: false, position: null }),
  setPointerPos: (pos) => set({ pointerPos: pos }),
}));

export const openAddMenu = (pos?: { x: number; y: number }): void => {
  useAddMenuStore.getState().openMenu(pos);
};

export const closeAddMenu = (): void => {
  useAddMenuStore.getState().closeMenu();
};

/**
 * Registers `3d.menu.add` on the command bus if missing.
 */
export function registerAddMenuCommand(): () => void {
  const existing = getCommand("3d.menu.add");
  if (existing) {
    return () => {};
  }

  const unreg = defineCommand({
    id: "3d.menu.add",
    title: "Add 3D Object Menu",
    category: "3D",
    keybinding: "Shift+a",
    when: (ctx: { editingScene3d?: boolean }) => Boolean(ctx.editingScene3d),
    run: () => {
      openAddMenu();
      return { ok: true };
    },
  });

  return unreg;
}

/**
 * Executes a chosen add item.
 */
export function executeAddItem(item: MenuItemDef): void {
  if (!item.commandId) return;

  if (item.commandId === "3d.add.text") {
    ensureFontLoaded("Geist");
    const resolved = resolveAddArgsWithCursor();
    const outcome = tryRunCommand("3d.add.text", resolved);
    const made = outcome.ok ? (outcome.result as { objectId?: string } | undefined) : undefined;
    if (made?.objectId) {
      requestTextEdit3d(made.objectId);
    }
  } else {
    addPrimitiveAtCursor(item.commandId);
  }
}

/**
 * AddMenu3d: Main floating menu component.
 */
export const AddMenu3d: React.FC = () => {
  const isOpen = useAddMenuStore((s) => s.isOpen);
  const position = useAddMenuStore((s) => s.position);
  const closeMenu = useAddMenuStore((s) => s.closeMenu);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-register command and track pointer globally for Shift+A menu position
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      useAddMenuStore.getState().setPointerPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const unreg = registerAddMenuCommand();
    return () => {
      window.removeEventListener("pointermove", onMove);
      unreg();
    };
  }, []);

  // Reset state on open
  /* eslint-disable react-hooks/set-state-in-effect -- the menu starts fresh each time it opens */
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setActiveSubmenu(null);
      setSelectedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 20);
    }
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Flattened items for search mode
  const allLeafItems = useMemo<MenuItemDef[]>(() => {
    const leaves: MenuItemDef[] = [];
    const recurse = (items: MenuItemDef[], prefix = "") => {
      for (const item of items) {
        if (item.children) {
          recurse(item.children, `${prefix}${item.label} > `);
        } else {
          leaves.push({
            ...item,
            label: prefix ? `${prefix}${item.label}` : item.label,
          });
        }
      }
    };
    recurse(ADD_MENU_ITEMS);
    return leaves;
  }, []);

  // Filtered list when searching
  const filteredItems = useMemo<MenuItemDef[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allLeafItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [searchQuery, allLeafItems]);

  const displayedItems = searchQuery.trim() ? filteredItems : ADD_MENU_ITEMS;

  const handleSelect = useCallback(
    (item: MenuItemDef) => {
      if (item.children) {
        setActiveSubmenu(activeSubmenu === item.id ? null : item.id);
        return;
      }
      executeAddItem(item);
      closeMenu();
    },
    [activeSubmenu, closeMenu]
  );

  // Global keydown handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        return;
      }

      const count = displayedItems.length;
      if (count === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % count);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + count) % count);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = displayedItems[selectedIndex];
        if (item) {
          handleSelect(item);
        }
      } else if (e.key === "ArrowRight") {
        const item = displayedItems[selectedIndex];
        if (item && item.children) {
          setActiveSubmenu(item.id);
        }
      } else if (e.key === "ArrowLeft") {
        if (activeSubmenu) {
          setActiveSubmenu(null);
        }
      }
    },
    [closeMenu, displayedItems, selectedIndex, handleSelect, activeSubmenu]
  );

  if (!isOpen || !position) return null;

  return (
    <div
      data-testid="add-menu-3d"
      className="ll:fixed ll:inset-0 ll:z-50"
      onPointerDown={(e) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          closeMenu();
        }
        // the menu sits inside the viewport's interaction layer: a press here must not reach it (it would capture the
        // pointer for a drag, and the menu item would never get its click)
        e.stopPropagation();
      }}
    >
      <div
        ref={containerRef}
        role="menu"
        aria-label="Add 3D Object Menu"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="ll:absolute ll:w-56 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-md ll:p-1 ll:font-sans ll:select-none ll:outline-none"
        style={{
          left: Math.max(12, Math.min(window.innerWidth - 240, position.x)),
          top: Math.max(12, Math.min(window.innerHeight - 360, position.y)),
        }}
      >
        {/* Search Input Filter */}
        <div className="ll:flex ll:items-center ll:gap-2 ll:px-2 ll:py-1 ll:mb-1 ll:border-b ll:border-border">
          <Search size={13} className="ll:text-muted ll:shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            data-testid="add-menu-search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search primitives..."
            className="ll:w-full ll:bg-transparent ll:border-0 ll:text-micro ll:text-primary ll:placeholder:text-muted ll:outline-none"
          />
        </div>

        {/* Menu Items List */}
        <div className="ll:flex ll:flex-col ll:gap-0.5 ll:max-h-80 ll:overflow-y-auto">
          {displayedItems.length === 0 ? (
            <div className="ll:px-3 ll:py-2 ll:text-micro ll:text-muted ll:text-center">
              No matching primitives
            </div>
          ) : (
            displayedItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const hasSubmenu = Boolean(item.children);
              const isSubmenuOpen = activeSubmenu === item.id;
              const IconComp = item.icon;

              return (
                <div key={item.id} className="ll:relative">
                  <button
                    type="button"
                    role="menuitem"
                    data-testid={`add-menu-item-${item.id}`}
                    className={`ll:w-full ll:flex ll:items-center ll:justify-between ll:px-2.5 ll:py-1.5 ll:rounded-sm ll:text-micro ll:text-left ll:border-0 ll:transition-colors ${
                      isSelected || isSubmenuOpen
                        ? "ll:bg-neutral-100 ll:text-primary"
                        : "ll:bg-transparent ll:text-secondary ll:hover:bg-neutral-50 ll:hover:text-primary"
                    }`}
                    onMouseEnter={() => {
                      setSelectedIndex(idx);
                      if (hasSubmenu) {
                        setActiveSubmenu(item.id);
                      }
                    }}
                    onClick={() => handleSelect(item)}
                  >
                    <div className="ll:flex ll:items-center ll:gap-2 ll:min-w-0">
                      {IconComp && (
                        <IconComp size={14} className="ll:shrink-0 ll:text-secondary" />
                      )}
                      <span className="ll:truncate">{item.label}</span>
                    </div>
                    {hasSubmenu && (
                      <ChevronRight size={13} className="ll:text-muted ll:shrink-0" />
                    )}
                  </button>

                  {/* Submenu flyout (Blender style) */}
                  {hasSubmenu && isSubmenuOpen && item.children && (
                    <div
                      role="menu"
                      className="ll:absolute ll:left-full ll:top-0 ll:ml-1 ll:w-48 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-md ll:p-1 ll:flex ll:flex-col ll:gap-0.5 ll:z-50"
                    >
                      {item.children.map((subItem) => {
                        const SubIcon = subItem.icon;
                        return (
                          <button
                            key={subItem.id}
                            type="button"
                            role="menuitem"
                            data-testid={`add-menu-item-${subItem.id}`}
                            className="ll:w-full ll:flex ll:items-center ll:gap-2 ll:px-2.5 ll:py-1.5 ll:rounded-sm ll:text-micro ll:text-secondary ll:hover:bg-neutral-100 ll:hover:text-primary ll:text-left ll:border-0 ll:bg-transparent"
                            onClick={() => {
                              executeAddItem(subItem);
                              closeMenu();
                            }}
                          >
                            {SubIcon && (
                              <SubIcon size={14} className="ll:shrink-0 ll:text-secondary" />
                            )}
                            <span className="ll:truncate">{subItem.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export interface AddMenuButtonProps {
  className?: string;
}

/**
 * AddMenuButton: Toolbar button mounted in the header strip beside SnapBar.
 */
export const AddMenuButton: React.FC<AddMenuButtonProps> = ({ className = "" }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openMenu = useAddMenuStore((s) => s.openMenu);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      openMenu({ x: rect.left, y: rect.bottom + 4 });
    } else {
      openMenu();
    }
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      data-testid="add-3d-button"
      onClick={handleClick}
      aria-label="Add 3D Object"
      className={`ll:h-7 ll:px-2 ll:flex ll:items-center ll:gap-1.5 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border ll:text-micro ll:font-medium ll:text-secondary ll:hover:text-primary ll:hover:bg-neutral-50 ll:cursor-pointer ll:shadow-sm ll:transition-colors ${className}`}
    >
      <Plus size={13} className="ll:text-primary ll:shrink-0" />
      <span>Add</span>
    </button>
  );
};

export default AddMenu3d;
