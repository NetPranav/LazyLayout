"use client";

import React from "react";
import {
  AlignHorizontalDistributeCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalDistributeCenter,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Box,
  BoxSelect,
  ClipboardPaste,
  Code,
  Copy,
  CopyPlus,
  Eye,
  Film,
  Frame,
  Grid3x3,
  LayoutPanelLeft,
  ListTree,
  Lock,
  Palette,
  Plus,
  RotateCcw,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { LogoMark } from "@/editor/components/LogoMark";
import { MenuItem, MenuSeparator, SubMenu } from "@/editor/components/Menu";
import { MENU_ICON_SIZE } from "@/editor/components/topbar-constants";
import type { LayerMenuAction } from "./types";

export interface LayerContextMenuContentProps {
  /** Number of layers in the current selection. The Align submenu shows for two or more. */
  selectionCount: number;
  onAction: (action: LayerMenuAction) => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
}

interface Entry {
  action: LayerMenuAction;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
}

const CLIPBOARD: Entry[] = [
  { action: "copy", label: "Copy", icon: Copy, shortcut: "Ctrl+C" },
  { action: "paste", label: "Paste", icon: ClipboardPaste, shortcut: "Ctrl+V", disabled: true },
  {
    action: "paste-in-place",
    label: "Paste in Place",
    icon: ClipboardPaste,
    shortcut: "Ctrl+Shift+V",
    disabled: true,
  },
  { action: "duplicate", label: "Duplicate", icon: CopyPlus, shortcut: "Ctrl+D" },
  { action: "delete", label: "Delete", icon: Trash2, shortcut: "Del" },
];

const ALIGN: Entry[] = [
  { action: "align-left", label: "Align left", icon: AlignHorizontalJustifyStart },
  { action: "align-center", label: "Align center", icon: AlignHorizontalJustifyCenter },
  { action: "align-right", label: "Align right", icon: AlignHorizontalJustifyEnd },
  { action: "align-top", label: "Align top", icon: AlignVerticalJustifyStart },
  { action: "align-middle", label: "Align middle", icon: AlignVerticalJustifyCenter },
  { action: "align-bottom", label: "Align bottom", icon: AlignVerticalJustifyEnd },
];

const DISTRIBUTE: Entry[] = [
  {
    action: "distribute-horizontally",
    label: "Distribute horizontally",
    icon: AlignHorizontalDistributeCenter,
  },
  {
    action: "distribute-vertically",
    label: "Distribute vertically",
    icon: AlignVerticalDistributeCenter,
  },
];

const ARRANGE: Entry[] = [
  { action: "bring-forward", label: "Bring forward", icon: ArrowUp, shortcut: "Ctrl+]" },
  { action: "send-backward", label: "Send backward", icon: ArrowDown, shortcut: "Ctrl+[" },
  { action: "bring-to-front", label: "Bring to front", icon: ArrowUpToLine, shortcut: "Ctrl+Alt+]" },
  { action: "send-to-back", label: "Send to back", icon: ArrowDownToLine, shortcut: "Ctrl+Alt+[" },
];

/**
 * The prototype's MENUS.elem menu, used by the layer rows. Item lists, order, labels, icons and
 * shortcuts follow the prototype. Hide and Lock use the toggle callbacks, the rest report an action.
 */
export const LayerContextMenuContent: React.FC<LayerContextMenuContentProps> = ({
  selectionCount,
  onAction,
  onToggleHidden,
  onToggleLocked,
}) => {
  const renderEntry = (e: Entry) => (
    <MenuItem
      key={e.action}
      icon={<Icon icon={e.icon} size={MENU_ICON_SIZE} />}
      shortcut={e.shortcut}
      disabled={e.disabled}
      onClick={() => onAction(e.action)}
    >
      {e.label}
    </MenuItem>
  );

  return (
    <>
      <MenuItem
        icon={
          <span className="ll-logo ll:text-secondary">
            <LogoMark size={MENU_ICON_SIZE} />
          </span>
        }
        onClick={() => onAction("ask-ai")}
      >
        Ask AI…
      </MenuItem>

      <MenuSeparator />

      {CLIPBOARD.map(renderEntry)}

      <MenuSeparator />

      <SubMenu
        id="layer-arrange"
        label="Arrange"
        icon={<Icon icon={LayoutPanelLeft} size={MENU_ICON_SIZE} />}
      >
        {ARRANGE.map(renderEntry)}
      </SubMenu>
      {selectionCount > 1 && (
        <SubMenu
          id="layer-align"
          label="Align"
          icon={<Icon icon={AlignHorizontalJustifyStart} size={MENU_ICON_SIZE} />}
        >
          {ALIGN.map(renderEntry)}
          <MenuSeparator />
          {DISTRIBUTE.map(renderEntry)}
        </SubMenu>
      )}
      <MenuItem
        icon={<Icon icon={Box} size={MENU_ICON_SIZE} />}
        shortcut="Ctrl+G"
        onClick={() => onAction("group")}
      >
        Group
      </MenuItem>
      <MenuItem
        icon={<Icon icon={Frame} size={MENU_ICON_SIZE} />}
        shortcut="Ctrl+Alt+G"
        onClick={() => onAction("frame-selection")}
      >
        Frame selection
      </MenuItem>
      <MenuItem
        icon={<Icon icon={Grid3x3} size={MENU_ICON_SIZE} />}
        shortcut="Ctrl+Alt+T"
        onClick={() => onAction("tidy-up")}
      >
        Tidy up
      </MenuItem>

      <MenuSeparator />

      <SubMenu
        id="layer-layer"
        label="Layer"
        icon={<Icon icon={ListTree} size={MENU_ICON_SIZE} />}
      >
        <MenuItem
          icon={<Icon icon={Frame} size={MENU_ICON_SIZE} />}
          shortcut="Ctrl+Shift+G"
          onClick={() => onAction("ungroup")}
        >
          Ungroup
        </MenuItem>
        <MenuItem
          icon={<Icon icon={Type} size={MENU_ICON_SIZE} />}
          onClick={() => onAction("split-letters")}
        >
          Split into letters
        </MenuItem>
        <MenuItem
          icon={<Icon icon={Type} size={MENU_ICON_SIZE} />}
          shortcut="F2"
          onClick={() => onAction("rename")}
        >
          Rename
        </MenuItem>
        <MenuItem
          icon={<Icon icon={Eye} size={MENU_ICON_SIZE} />}
          shortcut="Ctrl+Shift+H"
          onClick={onToggleHidden}
        >
          Hide
        </MenuItem>
        <MenuItem
          icon={<Icon icon={Lock} size={MENU_ICON_SIZE} />}
          shortcut="Ctrl+Shift+L"
          onClick={onToggleLocked}
        >
          Lock
        </MenuItem>
        <MenuSeparator />
        <SubMenu
          id="layer-label-colour"
          label="Label colour"
          icon={<Icon icon={Palette} size={MENU_ICON_SIZE} />}
        >
          <MenuItem
            icon={<span className="lsw ll-lsw ll:block ll:w-3 ll:h-3 ll:rounded-xs" style={{ backgroundColor: "var(--ll-label-1)" }} />}
            onClick={() => onAction("set-label-1")}
          >
            Slate
          </MenuItem>
          <MenuItem
            icon={<span className="lsw ll-lsw ll:block ll:w-3 ll:h-3 ll:rounded-xs" style={{ backgroundColor: "var(--ll-label-2)" }} />}
            onClick={() => onAction("set-label-2")}
          >
            Sage
          </MenuItem>
          <MenuItem
            icon={<span className="lsw ll-lsw ll:block ll:w-3 ll:h-3 ll:rounded-xs" style={{ backgroundColor: "var(--ll-label-3)" }} />}
            onClick={() => onAction("set-label-3")}
          >
            Sand
          </MenuItem>
          <MenuItem
            icon={<span className="lsw ll-lsw ll:block ll:w-3 ll:h-3 ll:rounded-xs" style={{ backgroundColor: "var(--ll-label-4)" }} />}
            onClick={() => onAction("set-label-4")}
          >
            Clay
          </MenuItem>
          <MenuItem
            icon={<span className="lsw ll-lsw ll:block ll:w-3 ll:h-3 ll:rounded-xs" style={{ backgroundColor: "var(--ll-label-5)" }} />}
            onClick={() => onAction("set-label-5")}
          >
            Rose
          </MenuItem>
          <MenuItem
            icon={<span className="lsw ll-lsw ll:block ll:w-3 ll:h-3 ll:rounded-xs" style={{ backgroundColor: "var(--ll-label-6)" }} />}
            onClick={() => onAction("set-label-6")}
          >
            Lavender
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={<Icon icon={RotateCcw} size={MENU_ICON_SIZE} />}
            onClick={() => onAction("set-label-default")}
          >
            Type default
          </MenuItem>
        </SubMenu>
        <MenuSeparator />
        <MenuItem
          icon={<Icon icon={BoxSelect} size={MENU_ICON_SIZE} />}
          shortcut="Ctrl+A"
          onClick={() => onAction("select-all")}
        >
          Select all
        </MenuItem>
        <MenuItem
          icon={<Icon icon={Eye} size={MENU_ICON_SIZE} />}
          onClick={() => onAction("show-all")}
        >
          Show all
        </MenuItem>
        <MenuItem
          icon={<Icon icon={Lock} size={MENU_ICON_SIZE} />}
          onClick={() => onAction("unlock-all")}
        >
          Unlock all
        </MenuItem>
      </SubMenu>
      <SubMenu id="layer-more" label="More" icon={<Icon icon={Plus} size={MENU_ICON_SIZE} />}>
        <MenuItem
          icon={<Icon icon={Code} size={MENU_ICON_SIZE} />}
          onClick={() => onAction("copy-as-code")}
        >
          Copy as code
        </MenuItem>
        <MenuItem
          icon={<Icon icon={Film} size={MENU_ICON_SIZE} />}
          onClick={() => onAction("add-animation")}
        >
          Add animation
        </MenuItem>
      </SubMenu>
    </>
  );
};
