"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  ChevronLeft,
  Search,
  Plus,
  Minus,
  Folder,
  File,
  Save,
  Download,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Clipboard,
  CopyPlus,
  Trash2,
  Box,
  Frame,
  Scan,
  Maximize,
  Square,
  Focus,
  Ruler,
  Eye,
  EyeOff,
  Monitor,
  PanelLeft,
  PanelRight,
  LayoutPanelLeft,
  Image as ImageIcon,
  RotateCcw,
  FileText,
  Spline,
  Globe,
  ListTree,
  Database,
  Settings,
  Keyboard,
  Info,
  Play,
  Star,
  Sun,
  Moon,
  Palette,
  Check,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "./LogoMark";
import { ModeTabs, type EditorMode } from "./ModeTabs";
import { ShipPopover, type ShipIssue } from "./ShipPopover";
import type { CollabUser } from "./AvatarStack";
import { Menu, MenuItem, SubMenu, MenuSeparator, MenuHeading, ThemeSwatch } from "./Menu";
import { useTheme, type Theme } from "./ThemeToggle";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";
import { invokeCommand } from "@/core/commands";
import { useSaveStatus } from "@/core/storage/ProjectSession";
import { useDocument } from "@/core/store/useDocumentStore";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import { useExportUiStore } from "@/core/store/useExportUiStore";
import { LOGO_ICON_SIZE, MENU_ICON_SIZE, ACTION_ICON_SIZE } from "./topbar-constants";

const LIGHT_THEMES: readonly Theme[] = ["paper", "white", "warm", "lilac"];
const DARK_THEMES: readonly Theme[] = ["noir", "dark", "graphite", "darkroom"];

const EntryLabel: React.FC<{ checked: boolean; children: React.ReactNode }> = ({
  checked,
  children,
}) => (
  <span className="ll:flex ll:w-full ll:items-center ll:justify-between ll:gap-2">
    <span className="ll:truncate">{children}</span>
    {checked && <Icon icon={Check} size={MENU_ICON_SIZE} className="ll:text-muted ll:shrink-0" />}
  </span>
);

export interface TopBarProps {
  projectName?: string;
  saving?: boolean;
  saveStatus?: "saved" | "dirty" | "saving" | "error";
  mode?: EditorMode;
  onSelectMode?: (mode: EditorMode) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onSearch?: () => void;
  // Panel collapse toggles:
  onTogglePanel?: (panel: "lc" | "rc", open?: boolean) => void;
  isLeftCollapsed?: boolean;
  isRightCollapsed?: boolean;
  // Ship button issues:
  issues?: readonly ShipIssue[];
  onFixIssue?: (id: string) => void;
  onPublish?: () => void;
  // Collaborators:
  users?: readonly CollabUser[];
  /** Fired with a stable id ("file.new", "view.zoomIn", ...) for application-menu items with no core command yet. */
  onMenuAction?: (id: string) => void;
  className?: string;
  showRulers?: boolean;
  isZen?: boolean;
  onPreview?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  viewportPreset?: "1440" | "768" | "375";
  onSelectPreset?: (preset: "1440" | "768" | "375") => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  projectName = "Visual Web App",
  saving = false,
  saveStatus,
  mode: propMode,
  onSelectMode,
  onUndo,
  onRedo,
  onSearch,
  onTogglePanel,
  isLeftCollapsed = false,
  isRightCollapsed = false,
  issues,
  onFixIssue,
  onPublish,
  users: _users = [],
  onMenuAction,
  className = "",
  showRulers = false,
  isZen = false,
  onPreview,
  onExport,
  onShare,
  viewportPreset: propViewportPreset,
  onSelectPreset,
}) => {
  const canvasViewMode = useCanvasViewStore((s) => s.mode);
  // Save status resolution
  const sessionSaveState = useSaveStatus((s) => s.state);
  const resolvedState: "saved" | "dirty" | "saving" | "error" =
    saveStatus !== undefined
      ? saveStatus
      : saving
      ? "saving"
      : sessionSaveState === "saving"
      ? "saving"
      : sessionSaveState === "error"
      ? "error"
      : sessionSaveState === "pending"
      ? "dirty"
      : "saved";

  const isSaving = resolvedState === "saving";

  // Mode tabs state
  const [internalMode, setInternalMode] = useState<EditorMode>("design");
  const activeMode = propMode !== undefined ? propMode : internalMode;

  const handleModeChange = useCallback(
    (newMode: EditorMode) => {
      if (onSelectMode) {
        onSelectMode(newMode);
      } else {
        setInternalMode(newMode);
      }
    },
    [onSelectMode]
  );

  // Logo application menu state
  const logoBtnRef = useRef<HTMLButtonElement>(null);
  const [logoMenuOpen, setLogoMenuOpen] = useState(false);

  // Theme integration
  const [theme, selectTheme] = useTheme();
  const isDark =
    theme === "dark" ||
    theme === "noir" ||
    theme === "graphite" ||
    theme === "darkroom";

  const themeBtnRef = useRef<HTMLButtonElement>(null);
  const [themePickerOpen, setThemePickerOpen] = useState(false);

  const handleThemeToggle = useCallback(() => {
    selectTheme(isDark ? "paper" : "noir");
  }, [isDark, selectTheme]);

  const handleOpenSearch = useCallback(() => {
    if (onSearch) {
      onSearch();
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("antigravity:open_command_palette"));
    }
  }, [onSearch]);

  const handleCopyLink = useCallback(() => {
    onMenuAction?.("file.copyLink");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => undefined);
    }
  }, [onMenuAction]);

  const handleFullscreen = useCallback(() => {
    onMenuAction?.("view.fullscreen");
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, [onMenuAction]);

  const entry = (
    id: string,
    label: string,
    icon: LucideIcon,
    shortcut?: string,
    run?: () => void,
    checked?: boolean,
    disabled?: boolean,
    tooltipReason?: string
  ) => {
    const item = (
      <MenuItem
        key={id}
        icon={<Icon icon={icon} size={MENU_ICON_SIZE} />}
        shortcut={shortcut}
        disabled={disabled}
        onClick={run ?? (() => onMenuAction?.(id))}
      >
        {checked === undefined ? label : <EntryLabel checked={checked}>{label}</EntryLabel>}
      </MenuItem>
    );

    if (disabled && tooltipReason) {
      return (
        <div key={id} className="ll:block ll:w-full">
          <Tooltip content={tooltipReason} side="right">
            <div className="ll:w-full">{item}</div>
          </Tooltip>
        </div>
      );
    }
    return item;
  };

  const themeEntry = (id: Theme) => (
    <MenuItem
      key={id}
      icon={<ThemeSwatch theme={id} />}
      checked={theme === id}
      onClick={() => selectTheme(id)}
    >
      {id.charAt(0).toUpperCase() + id.slice(1)}
    </MenuItem>
  );

  const handleUndo = useCallback(() => {
    if (onUndo) {
      onUndo();
    } else {
      invokeCommand("edit.undo");
    }
  }, [onUndo]);

  const handleRedo = useCallback(() => {
    if (onRedo) {
      onRedo();
    } else {
      invokeCommand("edit.redo");
    }
  }, [onRedo]);

  return (
    <header
      role="banner"
      data-testid="top-bar"
      className={`top ll-top ll:text-body ll:grid ll:grid-cols-topbar ll:items-center ll:h-topbar ll:bg-surface-panel ll:border-b ll:border-border ll:px-0 ll:relative ll:z-20 ll:select-none ll:font-sans ${className}`}
    >
      {/* =====================================================================
          1. LEFT COLUMN: Logo, 1px divider, Project Name
          ===================================================================== */}
      <div className="tl ll-tl ll:flex ll:items-center ll:gap-2 ll:min-w-0 ll:justify-self-start ll:pl-2.5">
        <button
          ref={logoBtnRef}
          type="button"
          id="menubtn"
          data-testid="save-status"
          data-state={resolvedState}
          data-status={resolvedState}
          data-saving={isSaving ? "true" : undefined}
          aria-label="Application menu"
          title="Application menu"
          aria-haspopup="menu"
          aria-expanded={logoMenuOpen}
          onClick={() => setLogoMenuOpen((prev) => !prev)}
          className={`logo ll-logo ll:w-logo ll:h-logo ll:grid ll:place-items-center ll:text-primary ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ll:hover:[&_svg]:opacity-70 ll:focus-visible:ring-2 ll:focus-visible:ring-primary ${
            isSaving ? "saving-on ll-saving-on" : ""
          }`}
        >
          <LogoMark saving={isSaving} size={LOGO_ICON_SIZE} />
          <span className="sr ll:sr-only" id="saving" role="status">
            {isSaving ? "Saving" : "Saved"}
          </span>
        </button>

        {/* 1px hairline divider (height 20px, margin 0 4px, visible in Noir) */}
        <i
          aria-hidden="true"
          className="tdiv ll-tdiv ll:block ll:w-px ll:h-divider ll:mx-1 ll:bg-border ll:self-center ll:shrink-0"
        />

        {/* Project Name (14px, 500 font-weight, truncate) */}
        <div className="pinfo ll-pinfo ll:flex ll:items-center ll:gap-4 ll:min-w-0 ll:text-secondary">
          <span
            className="pname ll-pname ll:text-title ll:font-medium ll:text-primary ll:truncate ll:whitespace-nowrap"
            title={projectName}
          >
            {projectName}
          </span>
        </div>

        {/* Logo Application Menu (prototype MENUS.app) */}
        <Menu
          open={logoMenuOpen}
          onClose={() => setLogoMenuOpen(false)}
          anchorRef={logoBtnRef}
          variant="context"
          aria-label="Application menu"
        >
          {entry("app.back", "Back to projects", ChevronLeft)}
          {entry("app.search", "Search", Search, "Ctrl+K", handleOpenSearch)}

          <MenuSeparator />

          <SubMenu
            id="sub-file"
            label="File"
            icon={<Icon icon={File} size={MENU_ICON_SIZE} />}
          >
            {entry("file.new", "New project", Plus, "Ctrl+N")}
            {entry("file.open", "Open…", Folder, "Ctrl+O")}
            {entry("file.save", "Save", Save, "Ctrl+S", () => invokeCommand("file.save"))}
            {entry("file.exportCode", "Export code", Download, "Ctrl+E")}
            {entry("file.connectAgent", "Connect an agent", Download)}
            {entry("file.copyLink", "Copy project link", LinkIcon, undefined, handleCopyLink)}
            <MenuSeparator />
            {entry("file.import", "Import project file…", Folder)}
            {entry("file.exportFile", "Export project file", Download)}
          </SubMenu>

          <SubMenu
            id="sub-edit"
            label="Edit"
            icon={<Icon icon={Copy} size={MENU_ICON_SIZE} />}
          >
            {entry("edit.undo", "Undo", Undo2, "Ctrl+Z", handleUndo)}
            {entry("edit.redo", "Redo", Redo2, "Ctrl+Shift+Z", handleRedo)}
            {entry("edit.cut", "Cut", Scissors, "Ctrl+X")}
            {entry("edit.copy", "Copy", Copy, "Ctrl+C")}
            {entry("edit.paste", "Paste", Clipboard, "Ctrl+V")}
            {entry("edit.pasteInPlace", "Paste in Place", Clipboard, "Ctrl+Shift+V")}
            {entry("edit.selectAll", "Select all", Scan, "Ctrl+A")}
            <MenuSeparator />
            {entry("edit.duplicate", "Duplicate", CopyPlus, "Ctrl+D")}
            {entry("edit.delete", "Delete", Trash2, "Del")}
            {entry("edit.group", "Group", Box, "Ctrl+G")}
            {entry("edit.ungroup", "Ungroup", Frame, "Ctrl+Shift+G")}
            <MenuSeparator />
            {entry("align.left", "Align left", AlignStartVertical)}
            {entry("align.center", "Align center", AlignCenterVertical)}
            {entry("align.right", "Align right", AlignEndVertical)}
            {entry("align.top", "Align top", AlignStartHorizontal)}
            {entry("align.middle", "Align middle", AlignCenterHorizontal)}
            {entry("align.bottom", "Align bottom", AlignEndHorizontal)}
            {entry("align.distributeH", "Distribute horizontally", AlignHorizontalDistributeCenter)}
            {entry("align.distributeV", "Distribute vertically", AlignVerticalDistributeCenter)}
          </SubMenu>

          <SubMenu
            id="sub-view"
            label="View"
            icon={<Icon icon={Eye} size={MENU_ICON_SIZE} />}
          >
            {entry("view.zoomIn", "Zoom in", Plus, "Ctrl++")}
            {entry("view.zoomOut", "Zoom out", Minus, "Ctrl+-")}
            {entry("view.fit", "Fit to screen", Maximize, "Shift+1")}
            {entry("view.rulers", "Rulers", Ruler, "Shift+R", () => onMenuAction?.("view.rulers"), showRulers)}
            {entry("view.options", "View options…", Palette, undefined, () => {
              setLogoMenuOpen(false);
              onMenuAction?.("view.options");
            })}
            {entry("view.hideInterface", "Hide interface", EyeOff, "Tab", () => onMenuAction?.("view.hideInterface"), isZen)}
            <MenuSeparator />
            {entry("view.zoom100", "Zoom to 100%", Square, "Ctrl+0")}
            {entry("view.zoomSelection", "Zoom to selection", Focus, "Shift+2")}
            {entry("view.fullscreen", "Fullscreen", Monitor, "F11", handleFullscreen)}
          </SubMenu>

          <SubMenu
            id="sub-window"
            label="Window"
            icon={<Icon icon={LayoutPanelLeft} size={MENU_ICON_SIZE} />}
          >
            {entry("window.leftPanel", "Left panel", PanelLeft, undefined, () => onTogglePanel?.("lc"), !isLeftCollapsed)}
            {entry("window.assets", "Assets", ImageIcon)}
            {entry("window.rightPanel", "Right panel", PanelRight, undefined, () => onTogglePanel?.("rc"), !isRightCollapsed)}
            <SubMenu
              id="sub-layouts"
              label="Layouts"
              icon={<Icon icon={LayoutPanelLeft} size={MENU_ICON_SIZE} />}
            >
              {entry(
                "layouts.design",
                "Design",
                LayoutPanelLeft,
                undefined,
                () => {
                  setLogoMenuOpen(false);
                  handleModeChange("design");
                },
                activeMode === "design"
              )}
              {entry(
                "layouts.animate",
                "Animate",
                LayoutPanelLeft,
                undefined,
                () => {
                  setLogoMenuOpen(false);
                  handleModeChange("motion");
                },
                activeMode === "motion"
              )}
              {entry(
                "layouts.code",
                "Code",
                LayoutPanelLeft,
                undefined,
                () => {
                  setLogoMenuOpen(false);
                  handleModeChange("code");
                },
                activeMode === "code"
              )}
              {entry(
                "layouts.debug",
                "Debug",
                LayoutPanelLeft,
                undefined,
                () => onMenuAction?.("layouts.debug"),
                false,
                true,
                "Debug layout available in developer labs"
              )}
            </SubMenu>
            {entry("window.resetLayout", "Reset layout", RotateCcw)}
            <MenuSeparator />
            {entry("window.outputLog", "Output Log", FileText, undefined, undefined, undefined, true, "Output log viewer coming in Phase 48")}
            {entry("window.executionTrace", "Execution Trace", Spline, undefined, undefined, undefined, true, "Execution trace visualizer coming in Phase 48")}
            {entry("window.undoHistory", "Undo History", Undo2, undefined, undefined, undefined, true, "Undo history panel coming in Phase 48")}
            {entry("window.versionHistory", "Version History", Save, undefined, undefined, undefined, true, "Version history timeline coming in Phase 48")}
            {entry("window.globalSearch", "Global Search", Search, "Ctrl+K", handleOpenSearch)}
            {entry("window.referenceViewer", "Reference Viewer", LinkIcon, undefined, undefined, undefined, true, "Reference viewer coming in Phase 52")}
            {entry("window.plugins", "Plugins", Settings, undefined, undefined, undefined, true, "Plugin manager coming in Phase 55")}
            {entry("window.deployment", "Deployment", Globe, undefined, undefined, undefined, true, "Deployment manager coming in Phase 60")}
            {entry("window.logic", "Logic", ListTree, undefined, undefined, undefined, true, "Logic blueprint coming in Phase 42")}
            {entry("window.data", "Data", Database, undefined, undefined, undefined, true, "Data binding editor coming in Phase 44")}
          </SubMenu>

          <MenuSeparator />

          <SubMenu
            id="sub-theme"
            label="Theme"
            icon={<Icon icon={Palette} size={MENU_ICON_SIZE} />}
          >
            <MenuHeading>Light</MenuHeading>
            {LIGHT_THEMES.map((id) => themeEntry(id))}
            <MenuHeading>Dark</MenuHeading>
            {DARK_THEMES.map((id) => themeEntry(id))}
          </SubMenu>

          {entry("app.settings", "Settings", Settings, "Ctrl+,", undefined, undefined, true, "Settings panel coming in Phase 45")}

          <SubMenu
            id="sub-help"
            label="Help"
            icon={<Icon icon={Info} size={MENU_ICON_SIZE} />}
          >
            {entry("help.shortcuts", "Keyboard shortcuts", Keyboard, "F1")}
            {entry("help.demo", "Showcase demo", Play, undefined, undefined, undefined, true, "Showcase demo available in gallery")}
            {entry("help.docs", "Documentation", FileText)}
            {entry("help.about", "About", Star, undefined, undefined, undefined, true, "Lazy Layout v0.1.0")}
          </SubMenu>
        </Menu>
      </div>

      {/* =====================================================================
          2. CENTER COLUMN: Mode Tabs (Design, Motion, Code)
          ===================================================================== */}
      <div className="ll:flex ll:items-center ll:justify-center ll:gap-2">
        <ModeTabs mode={activeMode} onChange={handleModeChange} />
      </div>

      {/* =====================================================================
          3. RIGHT COLUMN: Theme Toggle Button, Ship Button & Popover, Avatars
          ===================================================================== */}
      <div className="tr ll-tr ll:flex ll:items-center ll:gap-2 ll:min-w-0 ll:justify-self-end ll:h-full ll:pr-4">
        {/* Dedicated Preview Button */}
        <Tooltip content={canvasViewMode === "preview" ? "Exit Preview (Esc)" : "Preview Mode"}>
          <button
            type="button"
            aria-label={canvasViewMode === "preview" ? "Exit Preview (Esc)" : "Preview"}
            aria-pressed={canvasViewMode === "preview"}
            onClick={() => {
              if (onPreview) {
                onPreview();
              } else {
                useCanvasViewStore.getState().setMode(canvasViewMode === "preview" ? "design" : "preview");
              }
            }}
            className={`ll:flex ll:items-center ll:gap-1.5 ll:h-8 ll:px-2.5 ll:rounded-sm ll:text-small ll:font-medium ll:transition-colors ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${
              canvasViewMode === "preview"
                ? "ll:bg-accent ll:text-accent-foreground ll:shadow-sm"
                : "ll:text-muted ll:hover:bg-control-active ll:hover:text-primary"
            }`}
          >
            <Icon icon={canvasViewMode === "preview" ? Square : Play} size={14} />
            <span>{canvasViewMode === "preview" ? "Exit" : "Preview"}</span>
          </button>
        </Tooltip>

        {/* Dedicated Code Export Button */}
        <Tooltip content="Export Code (Next.js, Vite, HTML, React, Vue)">
          <button
            type="button"
            aria-label="Export Code"
            onClick={() => {
              if (onExport) {
                onExport();
              } else {
                useExportUiStore.getState().open();
              }
            }}
            className="ll:flex ll:items-center ll:gap-1.5 ll:h-8 ll:px-2.5 ll:rounded-sm ll:text-small ll:font-medium ll:text-muted ll:hover:bg-control-active ll:hover:text-primary ll:transition-colors ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
          >
            <Icon icon={Download} size={14} />
            <span>Export</span>
          </button>
        </Tooltip>

        {/* Theme button (32x32, toggles Paper and Noir; right-click opens 8-theme picker) */}
        <Tooltip content={isDark ? "Switch to Paper" : "Switch to Noir"}>
          <button
            ref={themeBtnRef}
            type="button"
            id="themebtn"
            onClick={handleThemeToggle}
            onContextMenu={(e) => {
              e.preventDefault();
              setThemePickerOpen((prev) => !prev);
            }}
            aria-label={isDark ? "Switch to Paper" : "Switch to Noir"}
            title={isDark ? "Switch to Paper" : "Switch to Noir"}
            aria-haspopup="menu"
            aria-expanded={themePickerOpen}
            className="themebtn ll-themebtn ll:w-8 ll:h-8 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-active ll:hover:text-primary ll:outline-none ll:border-0 ll:bg-transparent ll:cursor-pointer ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
          >
            <Icon icon={isDark ? Sun : Moon} size={ACTION_ICON_SIZE} />
          </button>
        </Tooltip>

        <Menu
          open={themePickerOpen}
          onClose={() => setThemePickerOpen(false)}
          anchorRef={themeBtnRef}
          width={200}
          aria-label="Theme picker"
        >
          <MenuHeading>Light</MenuHeading>
          {LIGHT_THEMES.map((id) => (
            <MenuItem
              key={id}
              role="menuitemradio"
              checked={theme === id}
              onClick={() => {
                selectTheme(id);
                setThemePickerOpen(false);
              }}
              icon={<ThemeSwatch theme={id} />}
            >
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </MenuItem>
          ))}
          <MenuHeading>Dark</MenuHeading>
          {DARK_THEMES.map((id) => (
            <MenuItem
              key={id}
              role="menuitemradio"
              checked={theme === id}
              onClick={() => {
                selectTheme(id);
                setThemePickerOpen(false);
              }}
              icon={<ThemeSwatch theme={id} />}
            >
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </MenuItem>
          ))}
        </Menu>

        {/* Ship Button & Popover */}
        <ShipPopover
          issues={issues}
          onFixIssue={onFixIssue}
          onPublish={onPublish}
          onPreview={onPreview ?? (() => onMenuAction?.("view.previewMode"))}
          onShare={onShare ?? (() => onMenuAction?.("file.copyLink"))}
        />

        {/* Avatar Stack (hidden per user decision) */}
      </div>
    </header>
  );
};
