"use client";

/**
 * ============================================================================
 * LEGACY STUDIO HEADER COMPONENT
 * ============================================================================
 * Restores the classic top navigation & application menu bar from origin/main
 * for /editor/legacy. Required for e2e specs targeting the legacy editor.
 * Hosts:
 *   - Brand Logo & Title ("LazyLayout Studio")
 *   - Project filename tag ("MyProject.uweb") with dirty state
 *   - Desktop Menu Bar (File, Edit, View, Window, Help)
 *   - Device preview switcher (Desktop, Tablet, Mobile)
 *   - Showcase demo toggle button ("Mount Showcase Demo" / "Clear showcase demo")
 *   - Help & Settings triggers
 * ============================================================================
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import "@/legacy-editor/styles/menus.css";
import {
  Settings,
  HelpCircle,
  Monitor,
  Tablet,
  Smartphone,
  Sparkles,
  Hash,
  Copy,
  Check,
  X,
} from "lucide-react";
import { MenuDropdown } from "@/legacy-editor/menus/MenuDropdown";
import { WindowMenu } from "@/legacy-editor/menus/WindowMenu";
import { LazyLayoutLogo } from "@/legacy-editor/panels/launcher/LazyLayoutLogo";
import { useProjectStore } from "@/core/store/useProjectStore";
import { useLayers } from "@/core/store/useDocumentStore";
import { useProjectMetaStore } from "@/core/store/useProjectMetaStore";
import { useSaveStatus } from "@/core/storage/ProjectSession";
import { useHistoryStore } from "@/core/store/useHistoryStore";
import { useWorkspace } from "@/legacy-editor/shell/hooks/useWorkspace";
import { invokeCommand } from "@/core/commands";

type OpenMenuId = "file" | "edit" | "view" | "window" | "help" | null;

export const LegacyStudioHeader: React.FC = () => {
  const [openMenu, setOpenMenu] = useState<OpenMenuId>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const headerRef = useRef<HTMLElement>(null);

  const ws = useWorkspace();
  const projectId = useProjectMetaStore((s) => s.projectId) ?? "";
  const projectName = "MyProject.uweb";

  const saveState = useSaveStatus((s) => s.state);
  const isDirty = saveState === "pending" || saveState === "saving" || saveState === "error";
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);

  const elements = useLayers();
  const mountDemoProject = useProjectStore((s) => s.mountDemoProject);
  const clearToBlankCanvas = useProjectStore((s) => s.clearToBlankCanvas);
  const isDemoMounted = Boolean(elements["el_hero_heading"] && elements["el_buy_button"]);

  const isSettingsOpen = ws.centerActiveTab === "settings";

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleMenuTriggerClick = (menuId: OpenMenuId) => {
    setOpenMenu((current) => (current === menuId ? null : menuId));
  };

  const handleMenuTriggerMouseEnter = (menuId: OpenMenuId) => {
    if (openMenu !== null && openMenu !== menuId) {
      setOpenMenu(menuId);
    }
  };

  const handleSelectDeviceMode = useCallback((mode: "desktop" | "tablet" | "mobile") => {
    setDeviceMode(mode);
    invokeCommand("frame.focusPreset", { preset: mode });
  }, []);

  const handleSelectWorkspace = useCallback(
    (preset: string) => {
      ws.selectPreset(preset);
    },
    [ws],
  );

  const handleOpenPanel = useCallback(
    (zone: "left" | "right" | "bottom" | "center", tabId: string) => {
      if (zone === "left") {
        ws.setLeftCollapsed(false);
        ws.setLeftActiveTab(tabId);
      } else if (zone === "right") {
        ws.setRightCollapsed(false);
        ws.setRightActiveTab(tabId);
      } else if (zone === "bottom") {
        ws.setBottomCollapsed(false);
        ws.setBottomActiveTab(tabId);
      } else {
        ws.setCenterActiveTab(tabId === "settings" ? "settings" : "viewport");
      }
    },
    [ws],
  );

  const handleToggleSettings = useCallback(() => {
    ws.setCenterActiveTab((tab) => (tab === "settings" ? "viewport" : "settings"));
  }, [ws]);

  return (
    <header className="studio-header" ref={headerRef} role="banner">
      {/* Left: Brand Logo + Project File Tag + Menu Bar */}
      <div className="studio-header__left">
        <div className="studio-header__brand" title="LazyLayout Studio">
          <LazyLayoutLogo size={18} />
          <span className="studio-header__title">LazyLayout</span>
          <span className="studio-header__studio-tag">Studio</span>
        </div>

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

        {/* Desktop Application Menus */}
        <nav className="menu-bar" aria-label="Engine Menus">
          {/* File Menu */}
          <div className="menu-bar__item-wrapper">
            <button
              type="button"
              className={`menu-bar__trigger ${openMenu === "file" ? "menu-bar__trigger--open" : ""}`}
              onClick={() => handleMenuTriggerClick("file")}
              onMouseEnter={() => handleMenuTriggerMouseEnter("file")}
              aria-expanded={openMenu === "file"}
            >
              File
            </button>
            <MenuDropdown menu="file" isOpen={openMenu === "file"} onClose={() => setOpenMenu(null)} />
          </div>

          {/* Edit Menu */}
          <div className="menu-bar__item-wrapper">
            <button
              type="button"
              className={`menu-bar__trigger ${openMenu === "edit" ? "menu-bar__trigger--open" : ""}`}
              onClick={() => handleMenuTriggerClick("edit")}
              onMouseEnter={() => handleMenuTriggerMouseEnter("edit")}
              aria-expanded={openMenu === "edit"}
            >
              Edit
            </button>
            <MenuDropdown
              menu="edit"
              isOpen={openMenu === "edit"}
              onClose={() => setOpenMenu(null)}
              disabledCommands={[...(canUndo ? [] : ["edit.undo"]), ...(canRedo ? [] : ["edit.redo"])]}
            />
          </div>

          {/* View Menu */}
          <div className="menu-bar__item-wrapper">
            <button
              type="button"
              className={`menu-bar__trigger ${openMenu === "view" ? "menu-bar__trigger--open" : ""}`}
              onClick={() => handleMenuTriggerClick("view")}
              onMouseEnter={() => handleMenuTriggerMouseEnter("view")}
              aria-expanded={openMenu === "view"}
            >
              View
            </button>
            <MenuDropdown menu="view" isOpen={openMenu === "view"} onClose={() => setOpenMenu(null)} />
          </div>

          {/* Window Menu */}
          <div className="menu-bar__item-wrapper">
            <button
              type="button"
              className={`menu-bar__trigger ${openMenu === "window" ? "menu-bar__trigger--open" : ""}`}
              onClick={() => handleMenuTriggerClick("window")}
              onMouseEnter={() => handleMenuTriggerMouseEnter("window")}
              aria-expanded={openMenu === "window"}
            >
              Window
            </button>
            <WindowMenu
              isOpen={openMenu === "window"}
              onClose={() => setOpenMenu(null)}
              leftOpen={!ws.leftCollapsed}
              rightOpen={!ws.rightCollapsed}
              bottomOpen={!ws.bottomCollapsed}
              onToggleLeft={() => ws.setLeftCollapsed((c) => !c)}
              onToggleRight={() => ws.setRightCollapsed((c) => !c)}
              onToggleBottom={() => ws.setBottomCollapsed((c) => !c)}
              onSelectWorkspace={handleSelectWorkspace}
              activeWorkspace={ws.activeWorkspace}
              onResetLayout={() => ws.resetLayout()}
              onOpenPanel={handleOpenPanel}
            />
          </div>

          {/* Help Menu */}
          <div className="menu-bar__item-wrapper">
            <button
              type="button"
              className={`menu-bar__trigger ${openMenu === "help" ? "menu-bar__trigger--open" : ""}`}
              onClick={() => handleMenuTriggerClick("help")}
              onMouseEnter={() => handleMenuTriggerMouseEnter("help")}
              aria-expanded={openMenu === "help"}
            >
              Help
            </button>
            <MenuDropdown menu="help" isOpen={openMenu === "help"} onClose={() => setOpenMenu(null)} />
          </div>
        </nav>
      </div>

      {/* Center: Device Mode Segmented Control */}
      <div className="studio-header__center">
        <div className="toolbar-segmented" role="radiogroup" aria-label="Device Preview Target">
          <button
            type="button"
            className={`toolbar-segmented__btn ${deviceMode === "desktop" ? "toolbar-segmented__btn--active" : ""}`}
            onClick={() => handleSelectDeviceMode("desktop")}
            title="Desktop Canvas (1440px)"
          >
            <Monitor size={12} />
            <span className="toolbar-segmented__label">Desktop</span>
          </button>
          <button
            type="button"
            className={`toolbar-segmented__btn ${deviceMode === "tablet" ? "toolbar-segmented__btn--active" : ""}`}
            onClick={() => handleSelectDeviceMode("tablet")}
            title="Tablet Canvas (768px)"
          >
            <Tablet size={12} />
            <span className="toolbar-segmented__label">Tablet</span>
          </button>
          <button
            type="button"
            className={`toolbar-segmented__btn ${deviceMode === "mobile" ? "toolbar-segmented__btn--active" : ""}`}
            onClick={() => handleSelectDeviceMode("mobile")}
            title="Mobile Canvas (375px)"
          >
            <Smartphone size={12} />
            <span className="toolbar-segmented__label">Mobile</span>
          </button>
        </div>
      </div>

      {/* Right: Demo Stash Switcher, Help, Settings */}
      <div className="studio-header__right">
        <button
          type="button"
          className={`studio-header__demo-btn ${isDemoMounted ? "studio-header__demo-btn--active" : ""}`}
          id="header-toggle-demo-btn"
          aria-label={isDemoMounted ? "Clear showcase demo" : "Mount Showcase Demo"}
          title={isDemoMounted ? "Clear the showcase demo and return to a blank canvas" : "Load the showcase demo project"}
          onClick={() => {
            if (isDemoMounted) {
              clearToBlankCanvas();
            } else {
              mountDemoProject();
            }
          }}
        >
          <Sparkles size={12} />
          <span className="studio-header__demo-label">{isDemoMounted ? "Clear Showcase" : "Showcase Demo"}</span>
        </button>

        <span className="studio-header__divider" aria-hidden="true" />

        <button
          type="button"
          className="studio-header__icon-btn studio-header__icon-btn--help"
          title="Engine Documentation (F1)"
          onClick={() => handleMenuTriggerClick("help")}
        >
          <HelpCircle size={14} />
        </button>

        {isSettingsOpen ? (
          <button
            type="button"
            className="studio-header__icon-btn studio-header__icon-btn--close-settings"
            title="Close Settings & Return to Viewport (Esc)"
            onClick={handleToggleSettings}
            id="studio-header-close-settings-btn"
          >
            <X size={14} />
          </button>
        ) : (
          <button
            type="button"
            className="studio-header__icon-btn"
            title="Project Settings & Preferences (Ctrl+,)"
            onClick={handleToggleSettings}
            id="studio-header-settings-btn"
          >
            <Settings size={14} />
          </button>
        )}
      </div>
    </header>
  );
};
