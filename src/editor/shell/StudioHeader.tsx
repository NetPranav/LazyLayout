"use client";

/**
 * ============================================================================
 * REDESIGNED STUDIO HEADER (CONTEXTUAL TOP BAR)
 * ============================================================================
 * Screen / Scope: Screen 01: Master IDE Studio Shell (`/editor`)
 * Direction: Contextual Toolbar
 * Layout Architecture:
 *   - Left (fixed): Logo button opening unified menu (File, Edit, View, Window, Help)
 *                   + project filename tag with save dot & copyable project ID.
 *   - Center (adaptive): Changes with context.
 *                        - Nothing selected: Undo/Redo + Desktop/Tablet/Mobile switcher.
 *                        - Layer selected: Align, Spacing, Tidy, and Arrange actions.
 *   - Right (fixed): Command palette search entry + collaborators avatar stack +
 *                    help button + settings button.
 *   - Showcase Demo: Moved from outer bar into the unified logo menu.
 * Styling:
 *   - `@/editor/styles/menus.css`
 *   - `@/editor/styles/top-bar.css`
 * ============================================================================
 */

import React, { useState, useRef } from "react";
import "@/editor/styles/menus.css";
import "@/editor/styles/top-bar.css";
import {
  Settings,
  HelpCircle,
  Search,
  Hash,
  Copy,
  Check,
  X,
  ChevronDown,
} from "lucide-react";
import { LazyLayoutLogo } from "@/editor/panels/launcher/LazyLayoutLogo";
import { CollaboratorAvatarStack } from "@/editor/shell/CollaboratorAvatarStack";
import { StudioCenterToolbar } from "@/editor/shell/StudioCenterToolbar";
import { UnifiedLogoMenu } from "@/editor/menus/UnifiedLogoMenu";
import { useProjectStore } from "@/core/store/useProjectStore";
import { useLayers } from "@/core/store/useDocumentStore";
import { invokeCommand } from "@/core/commands";

export interface StudioHeaderProps {
  projectId?: string;
  projectName?: string;
  isDirty?: boolean;
  branchName?: string;
  deviceMode?: "desktop" | "tablet" | "mobile";
  onSelectDeviceMode?: (mode: "desktop" | "tablet" | "mobile") => void;
  leftOpen?: boolean;
  rightOpen?: boolean;
  bottomOpen?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
  onToggleBottom?: () => void;
  onSelectWorkspace?: (preset: string) => void;
  activeWorkspace?: string;
  canUndo?: boolean;
  canRedo?: boolean;
  onResetLayout?: () => void;
  onOpenPanel?: (zone: "left" | "right" | "bottom" | "center", tabId: string) => void;
  onOpenSettings?: () => void;
  onCloseSettings?: () => void;
  onToggleSettings?: () => void;
  isSettingsOpen?: boolean;
  onStartDragAI?: () => void;
  onToggleAI?: () => void;
  isAIOpen?: boolean;
  onOpenCommandPalette?: () => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  projectId,
  projectName = "MyProject.uweb",
  isDirty = false,
  deviceMode = "desktop",
  onSelectDeviceMode,
  leftOpen = true,
  rightOpen = true,
  bottomOpen = true,
  onToggleLeft,
  onToggleRight,
  onToggleBottom,
  onSelectWorkspace,
  activeWorkspace = "design",
  canUndo = true,
  canRedo = true,
  onResetLayout,
  onOpenPanel,
  onOpenSettings,
  onCloseSettings,
  onToggleSettings,
  isSettingsOpen = false,
  onStartDragAI,
  onToggleAI,
  isAIOpen = false,
  onOpenCommandPalette,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  const elements = useLayers();
  const mountDemoProject = useProjectStore((s) => s.mountDemoProject);
  const clearToBlankCanvas = useProjectStore((s) => s.clearToBlankCanvas);
  const isDemoMounted = Boolean(elements["el_hero_heading"] && elements["el_buy_button"]);

  const handleCopyProjectLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== "undefined" && projectId) {
      const url = new URL(window.location.href);
      url.searchParams.set("projectId", projectId);
      navigator.clipboard.writeText(url.toString()).catch(() => {});
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleOpenSearch = () => {
    if (onOpenCommandPalette) {
      onOpenCommandPalette();
    } else {
      window.dispatchEvent(new CustomEvent("antigravity:open_command_palette"));
    }
  };

  const handleOpenHelp = () => {
    invokeCommand("view.commandPalette");
  };

  return (
    <header className="studio-header" ref={headerRef} role="banner">
      {/* Left: Brand Logo Menu + Project Tag */}
      <div className="studio-header__left">
        {/* Brand Logo Button */}
        <button
          type="button"
          className={`studio-header__brand studio-header__brand-btn ${isMenuOpen ? "studio-header__brand-btn--open" : ""}`}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          title="LazyLayout Studio Menu (File, Edit, View, Window, Help)"
          aria-label="Application Menu"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
        >
          <LazyLayoutLogo size={18} />
          <span className="studio-header__title">LazyLayout</span>
          <ChevronDown size={11} strokeWidth={1.75} className="studio-header__brand-chevron" />
        </button>

        {/* Unified Application Menu Dropdown */}
        <UnifiedLogoMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          isDemoMounted={isDemoMounted}
          onMountDemo={mountDemoProject}
          onClearDemo={clearToBlankCanvas}
          canUndo={canUndo}
          canRedo={canRedo}
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

        {/* Project Tag: Name, Save Dot, Copyable ID */}
        <div className="studio-header__project" title="Active Project File">
          <span
            className={`studio-header__project-dot ${isDirty ? "studio-header__project-dot--dirty" : ""}`}
            title={isDirty ? "Unsaved changes" : "All changes saved"}
          />
          <span className="studio-header__project-name">{projectName}</span>
          {projectId && (
            <button
              type="button"
              className="studio-header__project-id-chip"
              onClick={handleCopyProjectLink}
              title={`Project ID: ${projectId} (Click to copy project link)`}
              aria-label="Copy project link"
            >
              <Hash size={10} strokeWidth={1.75} />
              <span>{projectId}</span>
              {copiedId ? <Check size={10} strokeWidth={1.75} /> : <Copy size={10} strokeWidth={1.75} />}
            </button>
          )}
        </div>
      </div>

      {/* Center: Adaptive Contextual Toolbar */}
      <div className="studio-header__center">
        <StudioCenterToolbar
          deviceMode={deviceMode}
          onSelectDeviceMode={onSelectDeviceMode}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </div>

      {/* Right: Search, Collaborators, Help, Settings */}
      <div className="studio-header__right">
        {/* Search / Command Palette Entry */}
        <button
          type="button"
          className="studio-header__search-btn"
          onClick={handleOpenSearch}
          title="Search actions and commands (Ctrl+K / Ctrl+P)"
          aria-label="Search actions and commands"
        >
          <Search size={13} strokeWidth={1.75} />
          <span className="studio-header__search-label">Search commands...</span>
          <kbd className="studio-header__kbd">Ctrl+K</kbd>
        </button>

        {/* Live Collaborators Avatar Stack */}
        <div className="studio-header__collab-wrap">
          <CollaboratorAvatarStack />
        </div>

        {/* Help Documentation Button */}
        <button
          type="button"
          className="studio-header__icon-btn studio-header__icon-btn--help"
          title="Help & Keyboard Shortcuts (F1)"
          aria-label="Help & Keyboard Shortcuts"
          onClick={handleOpenHelp}
        >
          <HelpCircle size={15} strokeWidth={1.75} />
        </button>

        {/* Settings Toggle Button */}
        {isSettingsOpen ? (
          <button
            type="button"
            className="studio-header__icon-btn studio-header__icon-btn--close-settings"
            title="Close Settings & Return to Viewport (Esc)"
            aria-label="Close Settings"
            onClick={onCloseSettings || onToggleSettings || onOpenSettings}
            id="studio-header-close-settings-btn"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        ) : (
          <button
            type="button"
            className="studio-header__icon-btn"
            title="Project Settings & Preferences (Ctrl+,)"
            aria-label="Settings"
            onClick={onToggleSettings || onOpenSettings}
            id="studio-header-settings-btn"
          >
            <Settings size={15} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </header>
  );
};
