"use client";

import React, { useState, useRef, useCallback, useId } from "react";
import {
  ChevronLeft,
  Search,
  Plus,
  Folder,
  Save,
  Code,
  Link as LinkIcon,
  FolderInput,
  FolderOutput,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Clipboard,
  ClipboardPaste,
  CheckSquare,
  CopyPlus,
  Trash2,
  Box,
  Frame,
  ZoomIn,
  ZoomOut,
  Maximize,
  Ruler,
  EyeOff,
  Expand,
  Focus,
  Monitor,
  PanelLeft,
  PanelRight,
  Image as ImageIcon,
  Terminal,
  Activity,
  History,
  GitBranch,
  Settings,
  Keyboard,
  BookOpen,
  Info,
  Sun,
  Moon,
  Palette,
} from "lucide-react";
import { LogoMark } from "./LogoMark";
import { ModeTabs, type EditorMode } from "./ModeTabs";
import { ShipPopover, type ShipIssue } from "./ShipPopover";
import { AvatarStack, type CollabUser } from "./AvatarStack";
import { Menu, MenuItem, SubMenu, MenuSeparator } from "./Menu";
import { useTheme, THEMES, type Theme } from "./ThemeToggle";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";
import { invokeCommand } from "@/core/commands";
import {
  LOGO_ICON_SIZE,
  MENU_DEFAULT_WIDTH,
  MENU_ICON_SIZE,
  ACTION_ICON_SIZE,
} from "./topbar-constants";

export interface TopBarProps {
  projectName?: string;
  saving?: boolean;
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
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  projectName = "Visual Web App",
  saving = false,
  mode: propMode,
  onSelectMode,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onSearch,
  onTogglePanel,
  isLeftCollapsed = false,
  isRightCollapsed = false,
  issues,
  onFixIssue,
  onPublish,
  users = [],
  className = "",
}) => {
  const menuBtnId = useId();
  const themeBtnId = useId();

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
  const isDark = theme === "dark";

  const handleThemeToggle = useCallback(() => {
    selectTheme(isDark ? "paper" : "dark");
  }, [isDark, selectTheme]);

  const handleOpenSearch = useCallback(() => {
    if (onSearch) {
      onSearch();
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("antigravity:open_command_palette"));
    }
  }, [onSearch]);

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
      className={`ll-top ll:grid ll:grid-cols-topbar ll:items-center ll:h-topbar ll:bg-surface-panel ll:border-b ll:border-border ll:px-0 ll:relative ll:z-20 ll:select-none ll:font-sans ${className}`}
    >
      {/* =====================================================================
          1. LEFT COLUMN: Logo, 1px divider, Project Name
          ===================================================================== */}
      <div className="ll-tl ll:flex ll:items-center ll:gap-2 ll:min-w-0 ll:justify-self-start ll:pl-2.5">
        <button
          ref={logoBtnRef}
          type="button"
          id={menuBtnId}
          data-saving={saving ? "true" : undefined}
          aria-label="Application menu"
          title="Application menu"
          aria-haspopup="menu"
          aria-expanded={logoMenuOpen}
          onClick={() => setLogoMenuOpen((prev) => !prev)}
          className="ll-logo ll:w-logo ll:h-logo ll:grid ll:place-items-center ll:text-primary ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ll:rounded-sm ll:focus-visible:ring-2 ll:focus-visible:ring-primary"
        >
          <LogoMark saving={saving} size={LOGO_ICON_SIZE} />
          <span className="ll:sr-only" role="status">
            {saving ? "Saving" : "Saved"}
          </span>
        </button>

        {/* 1px hairline divider (height 20px, margin 0 4px, visible in Noir) */}
        <i
          aria-hidden="true"
          className="ll-tdiv ll:block ll:w-px ll:h-divider ll:mx-1 ll:bg-border ll:self-center ll:shrink-0"
        />

        {/* Project Name (14px, 500 font-weight, truncate) */}
        <div className="ll-pinfo ll:flex ll:items-center ll:min-w-0 ll:text-secondary">
          <span
            className="ll-pname ll:text-title ll:font-medium ll:text-primary ll:truncate ll:whitespace-nowrap"
            title={projectName}
          >
            {projectName}
          </span>
        </div>

        {/* Logo Application Menu */}
        <Menu
          open={logoMenuOpen}
          onClose={() => setLogoMenuOpen(false)}
          anchorRef={logoBtnRef}
          width={MENU_DEFAULT_WIDTH}
          aria-label="Application menu"
        >
          <MenuItem
            icon={<Icon icon={ChevronLeft} size={MENU_ICON_SIZE} />}
            onClick={() => setLogoMenuOpen(false)}
          >
            Back to projects
          </MenuItem>

          <MenuItem
            icon={<Icon icon={Search} size={MENU_ICON_SIZE} />}
            shortcut="Ctrl+K"
            onClick={handleOpenSearch}
          >
            Search
          </MenuItem>

          <MenuSeparator />

          {/* Submenu: File */}
          <SubMenu
            id="sub-file"
            label="File"
            icon={<Icon icon={Folder} size={MENU_ICON_SIZE} />}
          >
            <MenuItem
              icon={<Icon icon={Plus} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+N"
            >
              New project
            </MenuItem>
            <MenuItem
              icon={<Icon icon={Folder} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+O"
            >
              Open project…
            </MenuItem>
            <MenuItem
              icon={<Icon icon={Save} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+S"
            >
              Save project
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Icon icon={Code} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+Shift+E"
            >
              Export code
            </MenuItem>
            <MenuItem
              icon={<Icon icon={LinkIcon} size={MENU_ICON_SIZE} />}
            >
              Share link
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Icon icon={FolderInput} size={MENU_ICON_SIZE} />}
            >
              Import…
            </MenuItem>
            <MenuItem
              icon={<Icon icon={FolderOutput} size={MENU_ICON_SIZE} />}
            >
              Export…
            </MenuItem>
          </SubMenu>

          {/* Submenu: Edit */}
          <SubMenu
            id="sub-edit"
            label="Edit"
            icon={<Icon icon={Undo2} size={MENU_ICON_SIZE} />}
          >
            <MenuItem
              icon={<Icon icon={Undo2} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+Z"
              disabled={!canUndo}
              onClick={handleUndo}
            >
              Undo
            </MenuItem>
            <MenuItem
              icon={<Icon icon={Redo2} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+Shift+Z"
              disabled={!canRedo}
              onClick={handleRedo}
            >
              Redo
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Icon icon={Scissors} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+X"
            >
              Cut
            </MenuItem>
            <MenuItem
              icon={<Icon icon={Copy} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+C"
            >
              Copy
            </MenuItem>
            <MenuItem
              icon={<Icon icon={Clipboard} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+V"
            >
              Paste
            </MenuItem>
            <MenuItem
              icon={<Icon icon={ClipboardPaste} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+Shift+V"
            >
              Paste in place
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Icon icon={CheckSquare} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+A"
            >
              Select all
            </MenuItem>
            <MenuItem
              icon={<Icon icon={CopyPlus} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+D"
            >
              Duplicate
            </MenuItem>
            <MenuItem
              icon={<Icon icon={Trash2} size={MENU_ICON_SIZE} />}
              shortcut="Del"
            >
              Delete
            </MenuItem>
          </SubMenu>

          {/* Submenu: View */}
          <SubMenu
            id="sub-view"
            label="View"
            icon={<Icon icon={Box} size={MENU_ICON_SIZE} />}
          >
            <MenuItem
              icon={<Icon icon={Frame} size={MENU_ICON_SIZE} />}
            >
              Layers
            </MenuItem>
            <MenuItem
              icon={<Icon icon={ImageIcon} size={MENU_ICON_SIZE} />}
            >
              Assets
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Icon icon={ZoomIn} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl++"
            >
              Zoom in
            </MenuItem>
            <MenuItem
              icon={<Icon icon={ZoomOut} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+-"
            >
              Zoom out
            </MenuItem>
            <MenuItem
              icon={<Icon icon={Maximize} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+0"
            >
              Zoom to 100%
            </MenuItem>
            <MenuItem
              icon={<Icon icon={Expand} size={MENU_ICON_SIZE} />}
              shortcut="Shift+1"
            >
              Zoom to fit
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Icon icon={Ruler} size={MENU_ICON_SIZE} />}
              shortcut="Shift+R"
            >
              Rulers
            </MenuItem>
            <MenuItem
              icon={<Icon icon={EyeOff} size={MENU_ICON_SIZE} />}
              shortcut="Shift+W"
            >
              Wireframe mode
            </MenuItem>
            <MenuItem
              icon={<Icon icon={Monitor} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+\\"
            >
              Toggle UI
            </MenuItem>
            <MenuItem
              icon={<Icon icon={Focus} size={MENU_ICON_SIZE} />}
              shortcut="F"
            >
              Focus mode
            </MenuItem>
          </SubMenu>

          {/* Submenu: Window */}
          <SubMenu
            id="sub-window"
            label="Window"
            icon={<Icon icon={PanelLeft} size={MENU_ICON_SIZE} />}
          >
            <MenuItem
              icon={<Icon icon={PanelLeft} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+B"
              onClick={() => onTogglePanel?.("lc")}
            >
              {isLeftCollapsed ? "Show Left Panel" : "Hide Left Panel"}
            </MenuItem>
            <MenuItem
              icon={<Icon icon={PanelRight} size={MENU_ICON_SIZE} />}
              shortcut="Ctrl+Shift+B"
              onClick={() => onTogglePanel?.("rc")}
            >
              {isRightCollapsed ? "Show Right Panel" : "Hide Right Panel"}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Icon icon={ImageIcon} size={MENU_ICON_SIZE} />}
            >
              Assets
            </MenuItem>
            <MenuItem
              icon={<Icon icon={Terminal} size={MENU_ICON_SIZE} />}
            >
              Terminal
            </MenuItem>
            <MenuItem
              icon={<Icon icon={Activity} size={MENU_ICON_SIZE} />}
            >
              Performance
            </MenuItem>
            <MenuItem
              icon={<Icon icon={History} size={MENU_ICON_SIZE} />}
            >
              History
            </MenuItem>
            <MenuItem
              icon={<Icon icon={GitBranch} size={MENU_ICON_SIZE} />}
            >
              Branches
            </MenuItem>
          </SubMenu>

          {/* Submenu: Theme */}
          <SubMenu
            id="sub-theme"
            label="Theme"
            icon={<Icon icon={Palette} size={MENU_ICON_SIZE} />}
          >
            {THEMES.map((t) => (
              <MenuItem
                key={t.id}
                onClick={() => selectTheme(t.id)}
              >
                {t.label}
              </MenuItem>
            ))}
          </SubMenu>

          <MenuSeparator />

          <MenuItem
            icon={<Icon icon={Settings} size={MENU_ICON_SIZE} />}
            shortcut="Ctrl+,"
            onClick={() => setLogoMenuOpen(false)}
          >
            Settings
          </MenuItem>

          {/* Submenu: Help */}
          <SubMenu
            id="sub-help"
            label="Help"
            icon={<Icon icon={BookOpen} size={MENU_ICON_SIZE} />}
          >
            <MenuItem
              icon={<Icon icon={Keyboard} size={MENU_ICON_SIZE} />}
              shortcut="F1"
            >
              Keyboard shortcuts
            </MenuItem>
            <MenuItem icon={<Icon icon={BookOpen} size={MENU_ICON_SIZE} />}>
              Documentation
            </MenuItem>
            <MenuItem icon={<Icon icon={Info} size={MENU_ICON_SIZE} />}>
              About
            </MenuItem>
          </SubMenu>
        </Menu>
      </div>

      {/* =====================================================================
          2. CENTER COLUMN: Mode Tabs (Design, Motion, Code)
          ===================================================================== */}
      <div className="ll:flex ll:items-center ll:justify-center">
        <ModeTabs mode={activeMode} onChange={handleModeChange} />
      </div>

      {/* =====================================================================
          3. RIGHT COLUMN: Theme Toggle Button, Ship Button & Popover, Avatars
          ===================================================================== */}
      <div className="ll-tr ll:flex ll:items-center ll:gap-2 ll:min-w-0 ll:justify-self-end ll:h-full ll:pr-4">
        {/* Theme button (32x32, toggles Paper and Noir) */}
        <Tooltip content={isDark ? "Switch to Paper" : "Switch to Noir"}>
          <button
            type="button"
            id={themeBtnId}
            onClick={handleThemeToggle}
            aria-label={isDark ? "Switch to Paper" : "Switch to Noir"}
            title={isDark ? "Switch to Paper" : "Switch to Noir"}
            className="ll-themebtn ll:w-8 ll:h-8 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-active ll:hover:text-primary ll:outline-none ll:border-0 ll:bg-transparent ll:cursor-pointer ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
          >
            <Icon icon={isDark ? Sun : Moon} size={ACTION_ICON_SIZE} />
          </button>
        </Tooltip>

        {/* Ship Button & Popover */}
        <ShipPopover
          issues={issues}
          onFixIssue={onFixIssue}
          onPublish={onPublish}
        />

        {/* Avatar Stack */}
        <AvatarStack users={users} />
      </div>
    </header>
  );
};
