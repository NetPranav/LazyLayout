"use client";

import React from "react";
import {
  Undo2,
  Redo2,
  ClipboardPaste,
  Move,
  Frame,
  Type,
  Plus,
  Minus,
  Scan,
  Grid3x3,
  Palette,
  Ruler,
  Magnet,
  LayoutPanelTop,
  PanelLeft,
  PanelRight,
  Square,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import {
  Menu,
  MenuItem,
  SubMenu,
  MenuSeparator,
  MenuHeading,
  ThemeSwatch,
} from "@/editor/components/Menu";
import { MENU_ICON_SIZE } from "@/editor/components/topbar-constants";
import { Tooltip } from "@/editor/components/Tooltip";
import { invokeCommand } from "@/core/commands";
import { addFrame } from "@/core/frames/frameCommands";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { getDocument } from "@/core/store/documentState";

const LIGHT_THEMES = ["paper", "white", "warm", "lilac"] as const;
const DARK_THEMES = ["dark"] as const;

export interface CanvasContextMenuContentProps {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onPaste?: () => void;
  onSelectAll?: () => void;
  onAddFrame?: () => void;
  onAddText?: () => void;
  onInsert?: () => void;

  // Zoom actions
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoom100?: () => void;
  onZoomFit?: () => void;

  // View actions
  showRulers?: boolean;
  onToggleRulers?: () => void;
  pixelGrid?: boolean;
  onTogglePixelGrid?: () => void;
  snapObjects?: boolean;
  onToggleSnapObjects?: () => void;
  snapGuides?: boolean;
  onToggleSnapGuides?: () => void;
  checkerboard?: boolean;
  onToggleCheckerboard?: () => void;
  panelsCollapsed?: boolean;
  onTogglePanels?: () => void;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;

  // Theme
  theme?: string;
  onThemeChange?: (theme: string) => void;

  // Canvas settings
  onOpenCanvasSettings?: () => void;
}

export interface CanvasContextMenuProps extends CanvasContextMenuContentProps {
  open: boolean;
  onClose: () => void;
  position?: { x: number; y: number } | null;
  width?: number | string;
}

/**
 * The prototype's MENUS.canvas context menu opened on right-click of empty canvas.
 * Preserves items, icons, order, separators, shortcuts, and submenu structure exactly from prototype.
 */
export const CanvasContextMenuContent: React.FC<CanvasContextMenuContentProps> = ({
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onPaste,
  onSelectAll,
  onAddFrame,
  onAddText,
  onInsert,
  onZoomIn,
  onZoomOut,
  onZoom100,
  onZoomFit,
  showRulers = false,
  onToggleRulers,
  pixelGrid = false,
  onTogglePixelGrid,
  snapObjects = true,
  onToggleSnapObjects,
  snapGuides = false,
  onToggleSnapGuides,
  checkerboard = false,
  onToggleCheckerboard,
  onTogglePanels,
  onToggleLeftPanel,
  onToggleRightPanel,
  theme = "paper",
  onThemeChange,
  onOpenCanvasSettings,
}) => {
  const handleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll();
      return;
    }
    try {
      const doc = getDocument();
      const ids = Object.keys(doc.layers || {});
      useSelectionStore.getState().selectMultiple(ids, "element");
    } catch {
      invokeCommand("edit.selectAll");
    }
  };

  const handleAddFrame = () => {
    if (onAddFrame) {
      onAddFrame();
      return;
    }
    try {
      addFrame();
    } catch {
      invokeCommand("frame.add");
    }
  };

  const handleAddText = () => {
    if (onAddText) {
      onAddText();
      return;
    }
    try {
      invokeCommand("tool.text");
    } catch {}
  };

  const themeItem = (id: string) => (
    <MenuItem
      key={id}
      icon={<ThemeSwatch theme={id} />}
      checked={theme === id}
      onClick={() => onThemeChange?.(id)}
    >
      {id.charAt(0).toUpperCase() + id.slice(1)}
    </MenuItem>
  );

  return (
    <>
      {/* 1. History & Clipboard group */}
      <MenuItem
        icon={<Icon icon={Undo2} size={MENU_ICON_SIZE} />}
        shortcut="Ctrl+Z"
        disabled={!canUndo}
        onClick={() => {
          onUndo?.();
          try {
            invokeCommand("edit.undo");
          } catch {}
        }}
      >
        Undo
      </MenuItem>
      <MenuItem
        icon={<Icon icon={Redo2} size={MENU_ICON_SIZE} />}
        shortcut="Ctrl+Shift+Z"
        disabled={!canRedo}
        onClick={() => {
          onRedo?.();
          try {
            invokeCommand("edit.redo");
          } catch {}
        }}
      >
        Redo
      </MenuItem>
      <Tooltip content="Clipboard is empty" side="right">
        <div className="ll:w-full">
          <MenuItem
            icon={<Icon icon={ClipboardPaste} size={MENU_ICON_SIZE} />}
            shortcut="Ctrl+V"
            disabled={true}
            onClick={() => {
              onPaste?.();
              try {
                invokeCommand("edit.paste");
              } catch {}
            }}
          >
            Paste here
          </MenuItem>
        </div>
      </Tooltip>

      <MenuSeparator />

      {/* 2. Selection group */}
      <MenuItem
        icon={<Icon icon={Move} size={MENU_ICON_SIZE} />}
        shortcut="Ctrl+A"
        onClick={handleSelectAll}
      >
        Select all
      </MenuItem>

      <MenuSeparator />

      {/* 3. Creation group */}
      <MenuItem
        icon={<Icon icon={Frame} size={MENU_ICON_SIZE} />}
        shortcut="F"
        onClick={handleAddFrame}
      >
        Add frame
      </MenuItem>
      <MenuItem
        icon={<Icon icon={Type} size={MENU_ICON_SIZE} />}
        shortcut="T"
        onClick={handleAddText}
      >
        Add text
      </MenuItem>
      <MenuItem
        icon={<Icon icon={Plus} size={MENU_ICON_SIZE} />}
        onClick={onInsert}
      >
        Insert…
      </MenuItem>

      <MenuSeparator />

      {/* 4. Submenus: Zoom & View */}
      <SubMenu
        id="canvas-zoom"
        label="Zoom"
        icon={<Icon icon={Scan} size={MENU_ICON_SIZE} />}
      >
        <MenuItem
          icon={<Icon icon={Plus} size={MENU_ICON_SIZE} />}
          shortcut="Ctrl++"
          onClick={onZoomIn}
        >
          Zoom in
        </MenuItem>
        <MenuItem
          icon={<Icon icon={Minus} size={MENU_ICON_SIZE} />}
          shortcut="Ctrl+-"
          onClick={onZoomOut}
        >
          Zoom out
        </MenuItem>
        <MenuItem
          icon={<Icon icon={Square} size={MENU_ICON_SIZE} />}
          shortcut="Ctrl+0"
          onClick={onZoom100}
        >
          Zoom to 100%
        </MenuItem>
        <MenuItem
          icon={<Icon icon={Scan} size={MENU_ICON_SIZE} />}
          shortcut="Shift+1"
          onClick={onZoomFit}
        >
          Fit to screen
        </MenuItem>
      </SubMenu>

      <SubMenu
        id="canvas-view"
        label="View"
        icon={<Icon icon={Grid3x3} size={MENU_ICON_SIZE} />}
      >
        <MenuItem
          icon={<Icon icon={Ruler} size={MENU_ICON_SIZE} />}
          shortcut="Shift+R"
          checked={showRulers}
          onClick={onToggleRulers}
        >
          Rulers
        </MenuItem>
        <MenuItem
          icon={<Icon icon={Grid3x3} size={MENU_ICON_SIZE} />}
          checked={pixelGrid}
          onClick={onTogglePixelGrid}
        >
          Pixel grid
        </MenuItem>
        <MenuItem
          icon={<Icon icon={Magnet} size={MENU_ICON_SIZE} />}
          checked={snapObjects}
          onClick={onToggleSnapObjects}
        >
          Snap objects
        </MenuItem>
        <MenuItem
          icon={<Icon icon={Minus} size={MENU_ICON_SIZE} />}
          checked={snapGuides}
          onClick={onToggleSnapGuides}
        >
          Snap guides
        </MenuItem>
        <MenuItem
          icon={<Icon icon={LayoutPanelTop} size={MENU_ICON_SIZE} />}
          checked={checkerboard}
          onClick={onToggleCheckerboard}
        >
          Checkerboard
        </MenuItem>
        <MenuItem
          icon={<Icon icon={PanelLeft} size={MENU_ICON_SIZE} />}
          onClick={onToggleLeftPanel || onTogglePanels}
        >
          Left panel
        </MenuItem>
        <MenuItem
          icon={<Icon icon={PanelRight} size={MENU_ICON_SIZE} />}
          onClick={onToggleRightPanel || onTogglePanels}
        >
          Right panel
        </MenuItem>

        <MenuSeparator />

        {/* Five official themes only (PALETTE.md), grouped Light and Dark like the prototype */}
        <MenuHeading>Light</MenuHeading>
        {LIGHT_THEMES.map(themeItem)}
        <MenuHeading>Dark</MenuHeading>
        {DARK_THEMES.map(themeItem)}
      </SubMenu>

      <MenuSeparator />

      {/* 5. Canvas Settings */}
      <MenuItem
        icon={<Icon icon={Palette} size={MENU_ICON_SIZE} />}
        onClick={onOpenCanvasSettings}
      >
        Canvas settings…
      </MenuItem>
    </>
  );
};

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  open,
  onClose,
  position,
  width,
  ...contentProps
}) => {
  return (
    <Menu
      open={open}
      onClose={onClose}
      position={position}
      variant="context"
      width={width}
      aria-label="Canvas actions"
    >
      <CanvasContextMenuContent {...contentProps} />
    </Menu>
  );
};
