"use client";

/**
 * ============================================================================
 * UNIFIED LOGO APPLICATION MENU
 * ============================================================================
 * Screen / Scope: Screen 01: Master IDE Studio Top Bar (`StudioHeader`)
 * Role: Single entry-point menu opened from the brand logo.
 * Holds:
 *   - Showcase Demo mount/clear toggle (`#header-toggle-demo-btn`)
 *   - Primary categories: File, Edit, View, Window, Help
 *   - Subpanels for each category reusing `MENU_MODEL` and `WindowMenu`
 * Design:
 *   - Solid neutral ramp surfaces (no glass, no blur, no translucency).
 *   - Rectangular shapes with modest radii (no pills).
 *   - Hairline borders, soft shadows.
 *   - Full keyboard accessibility (Arrow keys, Enter, Escape).
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  FileText,
  Edit3,
  Eye,
  Layout,
  HelpCircle,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { invokeCommand } from "@/core/commands";
import { MENU_MODEL, type MenuId } from "./menuModel";
import { WindowMenu } from "./WindowMenu";

export interface UnifiedLogoMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isDemoMounted: boolean;
  onMountDemo: () => void;
  onClearDemo: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  // Window Menu props
  leftOpen?: boolean;
  rightOpen?: boolean;
  bottomOpen?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
  onToggleBottom?: () => void;
  onStartDragAI?: () => void;
  onToggleAI?: () => void;
  isAIOpen?: boolean;
  onOpenPanel?: (zone: "left" | "right" | "bottom" | "center", tabId: string) => void;
  onSelectWorkspace?: (preset: string) => void;
  activeWorkspace?: string;
  onResetLayout?: () => void;
}

type SubmenuId = MenuId | "window";

const CATEGORIES: { id: SubmenuId; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { id: "file", label: "File", icon: FileText },
  { id: "edit", label: "Edit", icon: Edit3 },
  { id: "view", label: "View", icon: Eye },
  { id: "window", label: "Window", icon: Layout },
  { id: "help", label: "Help", icon: HelpCircle },
];

export const UnifiedLogoMenu: React.FC<UnifiedLogoMenuProps> = ({
  isOpen,
  onClose,
  isDemoMounted,
  onMountDemo,
  onClearDemo,
  canUndo = true,
  canRedo = true,
  leftOpen,
  rightOpen,
  bottomOpen,
  onToggleLeft,
  onToggleRight,
  onToggleBottom,
  onStartDragAI,
  onToggleAI,
  isAIOpen,
  onOpenPanel,
  onSelectWorkspace,
  activeWorkspace,
  onResetLayout,
}) => {
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuId | null>(null);
  const [mobileCategory, setMobileCategory] = useState<SubmenuId | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) {
      setActiveSubmenu(null);
      setMobileCategory(null);
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mobileCategory) {
          setMobileCategory(null);
        } else if (activeSubmenu) {
          setActiveSubmenu(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, activeSubmenu, mobileCategory, onClose]);

  if (!isOpen) return null;

  const disabledCommands: string[] = [
    ...(canUndo ? [] : ["edit.undo"]),
    ...(canRedo ? [] : ["edit.redo"]),
  ];

  const handleCategoryHover = (catId: SubmenuId) => {
    setActiveSubmenu(catId);
  };

  const handleCategoryClick = (catId: SubmenuId) => {
    setActiveSubmenu((current) => (current === catId ? null : catId));
    setMobileCategory(catId);
  };

  // Render content of a category submenu
  const renderSubmenuContent = (catId: SubmenuId) => {
    if (catId === "window") {
      return (
        <WindowMenu
          isOpen={true}
          onClose={onClose}
          leftOpen={leftOpen}
          rightOpen={rightOpen}
          bottomOpen={bottomOpen}
          onToggleLeft={onToggleLeft}
          onToggleRight={onToggleRight}
          onToggleBottom={onToggleBottom}
          onStartDragAI={onStartDragAI}
          onToggleAI={onToggleAI}
          isAIOpen={isAIOpen}
          onOpenPanel={onOpenPanel}
          onSelectWorkspace={onSelectWorkspace}
          activeWorkspace={activeWorkspace}
          onResetLayout={onResetLayout}
        />
      );
    }

    const model = MENU_MODEL[catId];
    if (!model) return null;

    return (
      <div role="menu" aria-label={model.label}>
        <span className="unified-menu__header-label">{model.label}</span>
        {model.entries.map((entry, idx) => {
          if (entry.kind === "separator") {
            return <div key={`sep-${idx}`} className="unified-menu__separator" role="separator" />;
          }

          const Icon = entry.icon;
          const disabled = !!entry.pending || (!!entry.command && disabledCommands.includes(entry.command));

          return (
            <button
              key={entry.label}
              type="button"
              role="menuitem"
              className="unified-menu__subitem"
              disabled={disabled}
              title={entry.pending ? `Coming in ${entry.pending}` : undefined}
              data-command={entry.command}
              onClick={() => {
                if (entry.command) invokeCommand(entry.command);
                onClose();
              }}
            >
              <span className="unified-menu__item-left">
                <span className="unified-menu__item-icon">
                  <Icon size={13} />
                </span>
                <span>{entry.label}</span>
              </span>
              {entry.shortcut && <kbd className="unified-menu__shortcut">{entry.shortcut}</kbd>}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={menuRef}
      className="unified-menu menu-bar"
      role="menu"
      aria-label="Application Main Menu"
    >
      {/* Mobile drilldown back button */}
      {mobileCategory && (
        <button
          type="button"
          className="unified-menu__mobile-back"
          onClick={() => setMobileCategory(null)}
          aria-label="Back to main menu"
        >
          <ArrowLeft size={13} strokeWidth={1.75} />
          <span>Back to Menu</span>
        </button>
      )}

      {/* Main Categories & Demo button (hidden if drilled-down on mobile) */}
      {!mobileCategory && (
        <>
          {/* Showcase Demo Toggle (relocated from top-bar into logo menu) */}
          <button
            type="button"
            id="header-toggle-demo-btn"
            className={`unified-menu__demo-item ${isDemoMounted ? "unified-menu__demo-item--active" : ""}`}
            role="menuitem"
            aria-label={isDemoMounted ? "Clear showcase demo" : "Mount Showcase Demo"}
            title={isDemoMounted ? "Clear showcase demo and reset canvas" : "Mount showcase demo project"}
            onClick={() => {
              if (isDemoMounted) {
                onClearDemo();
              } else {
                onMountDemo();
              }
              onClose();
            }}
          >
            <span className="unified-menu__item-left">
              <span className="unified-menu__item-icon" style={{ color: "var(--accent-primary)" }}>
                <Sparkles size={13} strokeWidth={1.75} />
              </span>
              <span>{isDemoMounted ? "Clear Showcase Demo" : "Mount Showcase Demo"}</span>
            </span>
            <span
              className={`unified-menu__demo-badge ${isDemoMounted ? "unified-menu__demo-badge--active" : ""}`}
            >
              {isDemoMounted ? "Loaded" : "Sample"}
            </span>
          </button>

          <div className="unified-menu__separator" role="separator" />

          {/* Primary Top-Level Categories */}
          {CATEGORIES.map(({ id, label, icon: CatIcon }) => {
            const isActive = activeSubmenu === id;
            return (
              <div
                key={id}
                className="unified-menu__category-wrap"
                onMouseEnter={() => handleCategoryHover(id)}
              >
                <button
                  type="button"
                  role="menuitem"
                  className={`unified-menu__category-btn ${isActive ? "unified-menu__category-btn--active" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={isActive}
                  onClick={() => handleCategoryClick(id)}
                >
                  <span className="unified-menu__item-left">
                    <span className="unified-menu__item-icon">
                      <CatIcon size={14} strokeWidth={1.75} />
                    </span>
                    <span>{label}</span>
                  </span>
                  <ChevronRight size={13} strokeWidth={1.75} className="unified-menu__item-chevron" />
                </button>

                {/* Subpanel flyout on Desktop */}
                {isActive && (
                  <div
                    className="unified-menu__subpanel"
                    role="menu"
                    aria-label={`${label} Submenu`}
                    onMouseEnter={() => setActiveSubmenu(id)}
                  >
                    {renderSubmenuContent(id)}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Submenu content when drilled down on Mobile */}
      {mobileCategory && (
        <div className="unified-menu__subpanel" role="menu">
          {renderSubmenuContent(mobileCategory)}
        </div>
      )}
    </div>
  );
};
