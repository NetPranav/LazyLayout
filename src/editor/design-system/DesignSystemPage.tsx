"use client";

import React, { useEffect, useState, useRef, useCallback, useSyncExternalStore } from "react";
import { Swatch } from "../components/Swatch";
import { WorkspaceFrame } from "../components/WorkspaceFrame";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { ThemeToggle, type Theme, useTheme } from "../components/ThemeToggle";
import { MotionDemo } from "./MotionDemo";

// Kept imported components
import {
  Cursor,
  CursorContainer,
  CursorFollow,
  CursorProvider,
} from "../components/imported/cursor";
import { ScrollFade as ImportedScrollFade } from "../components/imported/scroll-fade";

// Core components demos
import {
  ButtonDemo,
  IconButtonDemo,
  SegmentedControlDemo,
  ToggleDemo,
  CheckboxDemo,
  TooltipDemo,
  TextFieldDemo,
  NumberFieldDemo,
  SelectDemo,
  ColorSwatchFieldDemo,
  MenuDemo,
  ContextMenuDemo,
  PopoverDemo,
  CommandPaletteDemo,
  PanelSectionDemo,
  PropertyRowDemo,
  ListRowDemo,
  TreeRowDemo,
  TabsDemo,
  AvatarDemo,
  EmptyStateDemo,
  TopBarDemo,
} from "./demos/ComponentDemos";

// Shell demos
import {
  LogoMarkDemo,
  ModeTabsDemo,
  PageSwitcherDemo,
  ShipPopoverDemo,
  AvatarStackDemo,
  LeftPanelHeaderDemo,
  LeftPanelRowsDemo,
  LayerContextMenuDemo,
  LeftPanelEmptyDemo,
  RightPanelHeaderDemo,
  RightPanelAccordionRowDemo,
  RightPanelAiChatDemo,
  RightPanelEmptyDemo,
  PersistenceBannersDemo,
} from "./demos/ShellDemos";

// Canvas chrome demos
import {
  ToolbarDemo,
  InsertBoxDemo,
  AiBoxDemo,
  ViewOptionsPopoverDemo,
  RulersDemo,
  StageSelectionDemo,
} from "./demos/CanvasDemos";

// Panel & inspector demos
import {
  InspectorControlsDemo,
  TimelineDemo,
  CodeViewDemo,
} from "./demos/PanelDemos";

import { Menu as MenuIcon } from "lucide-react";

type NavSectionId =
  // Foundations
  | "colors"
  | "type"
  | "spacing"
  | "radii"
  | "shadows"
  | "sizes"
  | "motion"
  // Components
  | "button"
  | "icon-button"
  | "segmented-control"
  | "toggle"
  | "checkbox"
  | "tooltip"
  | "text-field"
  | "number-field"
  | "select"
  | "color-swatch-field"
  | "menu"
  | "context-menu"
  | "popover"
  | "command-palette"
  | "tabs"
  | "avatar"
  | "empty-state"
  | "theme-toggle"
  | "swatch"
  | "workspace-frame"
  | "imported-cursor"
  | "imported-scroll-fade"
  // Shell
  | "top-bar"
  | "logo-mark"
  | "mode-tabs"
  | "page-switcher"
  | "ship-popover"
  | "avatar-stack"
  | "left-panel-header"
  | "left-panel-rows"
  | "layer-context-menu"
  | "left-panel-empty"
  | "right-panel-header"
  | "right-panel-accordion"
  | "right-panel-ai-chat"
  | "right-panel-empty"
  | "persistence-banners"
  // Canvas
  | "toolbar"
  | "insert-box"
  | "ai-box"
  | "view-options"
  | "rulers"
  | "stage-selection"
  // Panels
  | "panel-section"
  | "property-row"
  | "list-row"
  | "tree-row"
  | "inspector-controls"
  | "timeline"
  | "code-view";

interface NavItem {
  id: NavSectionId;
  label: string;
}

const FOUNDATIONS_NAV: readonly NavItem[] = [
  { id: "colors", label: "Colors" },
  { id: "type", label: "Type Scale" },
  { id: "spacing", label: "Spacing" },
  { id: "radii", label: "Radii" },
  { id: "shadows", label: "Shadows" },
  { id: "sizes", label: "Layout Sizes" },
  { id: "motion", label: "Motion" },
];

const COMPONENTS_NAV: readonly NavItem[] = [
  { id: "button", label: "Button" },
  { id: "icon-button", label: "IconButton" },
  { id: "segmented-control", label: "SegmentedControl" },
  { id: "toggle", label: "Toggle" },
  { id: "checkbox", label: "Checkbox" },
  { id: "tooltip", label: "Tooltip" },
  { id: "text-field", label: "TextField" },
  { id: "number-field", label: "NumberField" },
  { id: "select", label: "Select" },
  { id: "color-swatch-field", label: "ColorSwatchField" },
  { id: "menu", label: "Menu" },
  { id: "context-menu", label: "ContextMenu" },
  { id: "popover", label: "Popover" },
  { id: "command-palette", label: "CommandPalette" },
  { id: "tabs", label: "Tabs" },
  { id: "avatar", label: "Avatar & Ship" },
  { id: "empty-state", label: "EmptyState" },
  { id: "theme-toggle", label: "ThemeToggle" },
  { id: "swatch", label: "Swatch" },
  { id: "workspace-frame", label: "WorkspaceFrame" },
  { id: "imported-cursor", label: "Cursor" },
  { id: "imported-scroll-fade", label: "Scroll Fade" },
];

const SHELL_NAV: readonly NavItem[] = [
  { id: "top-bar", label: "TopBar" },
  { id: "logo-mark", label: "LogoMark" },
  { id: "mode-tabs", label: "ModeTabs" },
  { id: "page-switcher", label: "PageSwitcher" },
  { id: "ship-popover", label: "ShipPopover" },
  { id: "avatar-stack", label: "AvatarStack" },
  { id: "left-panel-header", label: "LeftPanelHeader" },
  { id: "left-panel-rows", label: "Left Panel Rows" },
  { id: "layer-context-menu", label: "LayerContextMenu" },
  { id: "left-panel-empty", label: "LeftPanelEmpty" },
  { id: "right-panel-header", label: "RightPanelHeader" },
  { id: "right-panel-accordion", label: "RightPanelAccordionRow" },
  { id: "right-panel-ai-chat", label: "RightPanelAiChat" },
  { id: "right-panel-empty", label: "RightPanelEmptyPlaceholder" },
  { id: "persistence-banners", label: "Persistence Banners" },
];

const CANVAS_NAV: readonly NavItem[] = [
  { id: "toolbar", label: "Toolbar & Zoom" },
  { id: "insert-box", label: "InsertBox" },
  { id: "ai-box", label: "AiBox" },
  { id: "view-options", label: "ViewOptionsPopover" },
  { id: "rulers", label: "Rulers" },
  { id: "stage-selection", label: "Stage & Selection Handles" },
];

const PANELS_NAV: readonly NavItem[] = [
  { id: "panel-section", label: "PanelSection" },
  { id: "property-row", label: "PropertyRow" },
  { id: "list-row", label: "ListRow" },
  { id: "tree-row", label: "TreeRow" },
  { id: "inspector-controls", label: "Inspector Controls" },
  { id: "timeline", label: "Timeline" },
  { id: "code-view", label: "Code View & Console" },
];

const NAV_GROUPS: readonly { title: string; items: readonly NavItem[] }[] = [
  { title: "Foundations", items: FOUNDATIONS_NAV },
  { title: "Components", items: COMPONENTS_NAV },
  { title: "Shell", items: SHELL_NAV },
  { title: "Canvas", items: CANVAS_NAV },
  { title: "Panels", items: PANELS_NAV },
];

const ALL_NAV = [
  ...FOUNDATIONS_NAV,
  ...COMPONENTS_NAV,
  ...SHELL_NAV,
  ...CANVAS_NAV,
  ...PANELS_NAV,
];

interface SemanticRole {
  role: string;
  token: string;
  bgClass: string;
  description: string;
}

const SEMANTIC_ROLES: readonly SemanticRole[] = [
  {
    role: "Backdrop (outside app)",
    token: "--ll-surface-backdrop",
    bgClass: "ll:bg-surface-backdrop",
    description: "Outside the app container frame",
  },
  {
    role: "Canvas",
    token: "--ll-surface-canvas",
    bgClass: "ll:bg-surface-canvas",
    description: "Main workspace and editing surface background",
  },
  {
    role: "Panels and top bar",
    token: "--ll-surface-panel",
    bgClass: "ll:bg-surface-panel",
    description: "Side navigation, inspector panels, and top header bar",
  },
  {
    role: "Input fields & bars",
    token: "--ll-surface-bar",
    bgClass: "ll:bg-surface-bar",
    description: "Input fields, dock headers, selected and hover rows",
  },
  {
    role: "Floating surfaces",
    token: "--ll-surface-raised",
    bgClass: "ll:bg-surface-raised",
    description: "Cards, floating toolbar, menus, popovers, secondary buttons",
  },
  {
    role: "Hover on rows & menus",
    token: "--ll-surface-hover",
    bgClass: "ll:bg-surface-hover",
    description: "Hover state for table rows, menu items, and list items",
  },
  {
    role: "Hairline border",
    token: "--ll-border-color",
    bgClass: "ll:bg-border",
    description: "1px structural separators between layered panels",
  },
  {
    role: "Primary text",
    token: "--ll-text-primary",
    bgClass: "ll:bg-primary",
    description: "Headings, titles, active labels, body text",
  },
  {
    role: "Secondary text",
    token: "--ll-text-secondary",
    bgClass: "ll:bg-secondary",
    description: "Subheadings, descriptions, quiet buttons, metadata",
  },
  {
    role: "Muted text & icons",
    token: "--ll-text-muted",
    bgClass: "ll:bg-muted",
    description: "Inactive icon buttons, subtle tool glyphs, hints",
  },
  {
    role: "Primary control background",
    token: "--ll-control-primary-bg",
    bgClass: "ll:bg-control-primary",
    description: "Inverts with theme: strongest neutral control background",
  },
  {
    role: "Primary control text",
    token: "--ll-control-primary-fg",
    bgClass: "ll:bg-control-primary-fg",
    description: "Contrast text on primary control background",
  },
  {
    role: "Active option / switch",
    token: "--ll-control-active",
    bgClass: "ll:bg-control-active",
    description: "Active toggle in switches, icon button hover",
  },
  {
    role: "Selected row & active tool",
    token: "--ll-select-bg",
    bgClass: "ll:bg-select-bg",
    description: "Selected row and active tool indicator",
  },
  {
    role: "Text on selected",
    token: "--ll-select-fg",
    bgClass: "ll:bg-select-fg",
    description: "Text on selected row / active tool",
  },
  {
    role: "Ship button (not ready)",
    token: "--ll-ship-bg",
    bgClass: "ll:bg-ship-bg",
    description: "Ship button quiet state until checklist is satisfied",
  },
  {
    role: "Text on Ship",
    token: "--ll-ship-fg",
    bgClass: "ll:bg-ship-fg",
    description: "Text on Ship button",
  },
  {
    role: "Avatar background",
    token: "--ll-avatar-bg",
    bgClass: "ll:bg-avatar-bg",
    description: "User avatar circle background",
  },
  {
    role: "Avatar text",
    token: "--ll-avatar-fg",
    bgClass: "ll:bg-avatar-fg",
    description: "User initials / text on avatar",
  },
  {
    role: "Artboard background",
    token: "--ll-board-bg",
    bgClass: "ll:bg-board-bg",
    description: "Inner artboard canvas background",
  },
  {
    role: "Artboard border",
    token: "--ll-board-line",
    bgClass: "ll:bg-board-line",
    description: "1px border framing the artboard",
  },
  {
    role: "Image placeholder",
    token: "--ll-placeholder",
    bgClass: "ll:bg-placeholder",
    description: "Placeholder rectangle for images and assets",
  },
  {
    role: "Color swatch border",
    token: "--ll-swatch-line",
    bgClass: "ll:bg-swatch-line",
    description: "Hairline border around color swatches",
  },
  {
    role: "Insert card thumbnail",
    token: "--ll-thumb-bg",
    bgClass: "ll:bg-thumb-bg",
    description: "Thumbnail background in insert panel",
  },
  {
    role: "Insert card wireframe",
    token: "--ll-thumb-line",
    bgClass: "ll:bg-thumb-line",
    description: "Wireframe stroke in insert panel thumbnails",
  },
  {
    role: "Accent (Lilac only)",
    token: "--ll-accent",
    bgClass: "ll:bg-accent",
    description: "Only Lilac has an accent (#CEB4F5). No other theme has one.",
  },
];

const THEME_LIST: readonly { id: Theme; label: string }[] = [
  { id: "paper", label: "Paper (Default)" },
  { id: "dark", label: "Dark" },
  { id: "white", label: "White" },
  { id: "warm", label: "Warm" },
  { id: "lilac", label: "Lilac" },
];

function rgbToHex(rgbStr: string): string {
  const match = rgbStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return rgbStr.startsWith("#") ? rgbStr.toUpperCase() : rgbStr;
  const r = parseInt(match[1], 10).toString(16).padStart(2, "0");
  const g = parseInt(match[2], 10).toString(16).padStart(2, "0");
  const b = parseInt(match[3], 10).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`.toUpperCase();
}

const EMPTY_LIVE_TOKENS: Record<Theme, Record<string, string>> = {
  paper: {},
  dark: {},
  white: {},
  warm: {},
  lilac: {},
};

let cachedLiveTokens: Record<Theme, Record<string, string>> = EMPTY_LIVE_TOKENS;
const liveTokensListeners = new Set<() => void>();

function subscribeLiveTokens(cb: () => void) {
  liveTokensListeners.add(cb);
  return () => {
    liveTokensListeners.delete(cb);
  };
}

function getLiveTokensSnapshot() {
  return cachedLiveTokens;
}

function getServerLiveTokensSnapshot() {
  return EMPTY_LIVE_TOKENS;
}

function computeLiveTokensClient(): Record<Theme, Record<string, string>> {
  if (typeof document === "undefined") {
    return EMPTY_LIVE_TOKENS;
  }
  const result: Record<Theme, Record<string, string>> = {
    paper: {},
    dark: {},
    white: {},
    warm: {},
    lilac: {},
  };

  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.pointerEvents = "none";
  probe.style.opacity = "0";
  probe.style.zIndex = "-9999";
  document.body.appendChild(probe);

  for (const t of THEME_LIST) {
    probe.setAttribute("data-theme", t.id);
    const style = getComputedStyle(probe);
    const themeMap: Record<string, string> = {};
    for (const spec of SEMANTIC_ROLES) {
      const val = style.getPropertyValue(spec.token).trim();
      themeMap[spec.token] = rgbToHex(val);
    }
    result[t.id] = themeMap;
  }

  document.body.removeChild(probe);
  return result;
}

const LAYOUT_SIZES = [
  { role: "Toolbar button (size lg)", token: "--ll-size-toolbar-btn", value: "40px", description: "Canvas floating tool button (40x40px)" },
  { role: "Tall button (size tall)", token: "--ll-size-tall-btn-w", value: "32x40px", description: "Panels toggle button (32x40px)" },
  { role: "Tool bar height", token: "--ll-size-toolbar-h", value: "50px", description: "Center floating tool bar height (443x50px)" },
  { role: "Tool bar width", token: "--ll-size-toolbar-w", value: "443px", description: "Center floating tool bar fixed width" },
  { role: "Zoom bar height", token: "--ll-size-zoombar-h", value: "50px", description: "Right floating zoom bar height (186x50px)" },
  { role: "Zoom bar width", token: "--ll-size-zoombar-w", value: "186px", description: "Right floating zoom bar fixed width" },
  { role: "Top bar height", token: "--ll-size-topbar-h", value: "52px", description: "Fixed height of top bar" },
  { role: "Left panel width", token: "--ll-size-panel-left-w", value: "248px", description: "Standard left tool/layer rail width" },
  { role: "Right panel width", token: "--ll-size-panel-right-w", value: "320px", description: "Standard right inspector panel width" },
  { role: "Right panel (compact)", token: "--ll-size-panel-right-w-compact", value: "296px", description: "Right inspector on medium viewports (<1200px)" },
  { role: "Bottom motion panel height", token: "--ll-size-bottom-motion-h", value: "260px", description: "Motion mode timeline panel height" },
  { role: "Bottom code panel height", token: "--ll-size-bottom-code-h", value: "200px", description: "Code mode bottom preview panel height" },
  { role: "Canvas ruler", token: "--ll-size-ruler", value: "18px", description: "Top and left canvas measurement rulers" },
  { role: "Standard row height", token: "--ll-size-row-h", value: "32px", description: "Default row height in panels and menus" },
  { role: "Large row height", token: "--ll-size-row-lg-h", value: "36px", description: "Asset and section header row height" },
  { role: "Panel zone head", token: "--ll-size-header-h", value: "44px", description: "Header bar height for panels" },
  { role: "Button standard", token: "--ll-size-btn-h", value: "32px", description: "Standard action button height" },
  { role: "Button mini", token: "--ll-size-btn-sm-h", value: "24px", description: "Compact inline tag and action button height" },
  { role: "Icon button (md)", token: "--ll-size-icon-btn", value: "28px", description: "Standard square icon button size (28x28px)" },
  { role: "Icon button (sm)", token: "--ll-size-icon-btn-sm", value: "24px", description: "Compact inline square icon button size (24x24px)" },
  { role: "Avatar size", token: "--ll-size-avatar", value: "28px", description: "User avatar dimension" },
  { role: "Mode tab width", token: "--ll-size-mode-tab-w", value: "76px", description: "Top bar mode segment width" },
  { role: "Mode tab height", token: "--ll-size-mode-tab-h", value: "26px", description: "Top bar mode segment height" },
  { role: "Logo mark size", token: "--ll-size-logo", value: "32px", description: "Top bar logo container dimension" },
  { role: "Ship popover width", token: "--ll-size-ship-popover-w", value: "280px", description: "Pre-flight checklist popover width" },
  { role: "Menu width", token: "--ll-size-menu-w", value: "200px", description: "Default floating menu width" },
  { role: "Menu wide", token: "--ll-size-menu-wide-w", value: "320px", description: "Wide dropdown/insert panel width" },
  { role: "Context menu", token: "--ll-size-menu-ctx-w", value: "248px", description: "Right-click context menu width" },
  { role: "Users menu", token: "--ll-size-menu-users-w", value: "240px", description: "People and collaboration dropdown width" },
];

const SPACING_STEPS = [
  { token: "--ll-spacing-1", px: 4, widthClass: "ll:w-1" },
  { token: "--ll-spacing-2", px: 8, widthClass: "ll:w-2" },
  { token: "--ll-spacing-3", px: 12, widthClass: "ll:w-3" },
  { token: "--ll-spacing-4", px: 16, widthClass: "ll:w-4" },
  { token: "--ll-spacing-5", px: 20, widthClass: "ll:w-5" },
  { token: "--ll-spacing-6", px: 24, widthClass: "ll:w-6" },
  { token: "--ll-spacing-8", px: 32, widthClass: "ll:w-8" },
  { token: "--ll-spacing-12", px: 48, widthClass: "ll:w-12" },
  { token: "--ll-spacing-16", px: 64, widthClass: "ll:w-16" },
];

function CursorDemo() {
  return (
    <div className="ll:relative ll:h-72 ll:w-full ll:border ll:border-dashed ll:border-border ll:flex ll:items-center ll:justify-center">
      <CursorProvider>
        <CursorContainer>
          <Cursor>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 0 L16 6 L9 9 L6 16 Z" />
            </svg>
          </Cursor>
          <CursorFollow side="bottom" align="end">
            <span className="ll:text-micro ll:bg-control-primary ll:text-control-primary-fg ll:px-2 ll:py-0.5 ll:rounded-sm">
              Designer
            </span>
          </CursorFollow>
          <span className="ll:text-small ll:text-secondary">Move cursor within this area</span>
        </CursorContainer>
      </CursorProvider>
    </div>
  );
}

function ScrollFadeDemo() {
  return (
    <div className="ll:relative ll:h-64 ll:w-full ll:border ll:border-border ll:rounded-md ll:bg-surface-bar ll:overflow-hidden">
      <ImportedScrollFade className="ll:h-full ll:p-4">
        <div className="ll:flex ll:flex-col ll:gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="ll:p-3 ll:rounded-md ll:bg-surface-panel ll:border ll:border-border ll:text-small ll:text-secondary"
            >
              Scroll Fade Row Item #{i + 1}
            </div>
          ))}
        </div>
      </ImportedScrollFade>
    </div>
  );
}

export function DesignSystemPage() {
  const [activeSection, setActiveSection] = useState<NavSectionId>("colors");
  const [activeTheme] = useTheme();
  const liveTokens = useSyncExternalStore(subscribeLiveTokens, getLiveTokensSnapshot, getServerLiveTokensSnapshot);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    cachedLiveTokens = computeLiveTokensClient();
    liveTokensListeners.forEach((fn) => fn());
  }, []);

  // Hash-based routing for bookmarking and direct links
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "") as NavSectionId;
      if (ALL_NAV.some((item) => item.id === hash)) {
        setActiveSection(hash);
        if (mainRef.current) mainRef.current.scrollTop = 0;
        window.scrollTo(0, 0);
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const handleSelect = useCallback((id: NavSectionId) => {
    setActiveSection(id);
    window.location.hash = id;
    setMobileNavOpen(false);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [activeSection]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = (index + 1) % ALL_NAV.length;
        navButtonRefs.current[nextIndex]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = (index - 1 + ALL_NAV.length) % ALL_NAV.length;
        navButtonRefs.current[prevIndex]?.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect(ALL_NAV[index].id);
      }
    },
    [handleSelect]
  );

  return (
    <div className="design-system-root ll:h-screen ll:w-full ll:bg-surface-canvas ll:text-primary ll:font-sans ll:flex ll:justify-center ll:overflow-hidden">
      <div className="ll:w-full ll:h-full ll:bg-surface-backdrop ll:flex ll:flex-col ll:xl:flex-row ll:border-x ll:border-border ll:relative ll:overflow-hidden">
        {/* Mobile Header Bar */}
        <div className="ll:xl:hidden ll:flex ll:items-center ll:justify-between ll:p-4 ll:border-b ll:border-border ll:bg-surface-panel ll:sticky ll:top-0 ll:z-50 ll:shrink-0">
          <div className="ll:flex ll:items-center ll:gap-2">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
            >
              <Icon icon={MenuIcon} size={16} />
            </Button>
            <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
              {ALL_NAV.find((n) => n.id === activeSection)?.label ?? "Design System"}
            </span>
          </div>
          <ThemeToggle size="sm" />
        </div>

        {/* Navigation Sidebar */}
        <aside
          className={`${
            mobileNavOpen ? "ll:flex" : "ll:hidden"
          } ll:xl:flex ll:w-full ll:xl:w-80 ll:h-full ll:bg-surface-panel ll:border-b ll:xl:border-b-0 ll:xl:border-r ll:border-border ll:flex-col ll:shrink-0 ll:overflow-y-auto ll:max-h-80 ll:xl:max-h-full`}
        >
          <div className="ll:hidden ll:xl:flex ll:p-4 ll:border-b ll:border-border ll:items-center ll:justify-between ll:gap-2">
            <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
              Design System
            </span>
            <ThemeToggle size="sm" />
          </div>

          <nav aria-label="Design system navigation" className="ll:p-3 ll:flex ll:flex-col ll:gap-4">
            {NAV_GROUPS.map((group, groupIdx) => {
              // Calculate global offset for keyboard navigation
              let offset = 0;
              for (let i = 0; i < groupIdx; i++) {
                offset += NAV_GROUPS[i].items.length;
              }

              return (
                <div key={group.title} className="ll:flex ll:flex-col ll:gap-1">
                  {groupIdx > 0 && <div className="ll:h-px ll:w-full ll:bg-border ll:mb-2" />}
                  <div className="ll:px-3 ll:py-1 ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    {group.title}
                  </div>
                  <ul role="list" className="ll:flex ll:flex-col ll:gap-1">
                    {group.items.map((item, itemIdx) => {
                      const globalIdx = offset + itemIdx;
                      const isSelected = activeSection === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            ref={(el) => {
                              navButtonRefs.current[globalIdx] = el;
                            }}
                            type="button"
                            aria-current={isSelected ? "page" : undefined}
                            onClick={() => handleSelect(item.id)}
                            onKeyDown={(e) => handleKeyDown(e, globalIdx)}
                            className={`ll:w-full ll:h-8 ll:min-h-8 ll:px-3 ll:rounded-md ll:flex ll:items-center ll:justify-start ll:text-left ll:text-small ll:font-medium ll:focus-visible:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary ${
                              isSelected
                                ? "ll:bg-control-primary ll:text-control-primary-fg"
                                : "ll:text-primary ll:bg-transparent ll:hover:bg-surface-bar"
                            }`}
                          >
                            {item.label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main ref={mainRef} className="ll:flex-1 ll:min-w-0 ll:h-full ll:p-6 ll:sm:p-12 ll:overflow-y-auto">
          <div className="ll:max-w-3xl ll:mx-auto">
            {/* 1. Foundations */}
            {activeSection === "colors" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Colors</h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Semantic Color Tokens across 5 Official Themes
                  </span>
                </div>
                <div className="ll:rounded-md ll:border ll:border-border ll:overflow-hidden">
                  <table className="ll:w-full ll:text-left ll:border-collapse ll:text-small">
                    <thead>
                      <tr className="ll:border-b ll:border-border ll:bg-surface-bar">
                        <th className="ll:p-3 ll:font-medium ll:text-secondary">Role</th>
                        <th className="ll:p-3 ll:font-medium ll:text-secondary">Token</th>
                        <th className="ll:p-3 ll:font-medium ll:text-secondary">Sample</th>
                        {THEME_LIST.map((theme) => (
                          <th
                            key={theme.id}
                            className={`ll:p-3 ll:font-medium ${theme.id === activeTheme ? "ll:text-primary" : "ll:text-secondary"}`}
                          >
                            {theme.id.charAt(0).toUpperCase() + theme.id.slice(1)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="ll:divide-y ll:divide-border ll:bg-surface-panel">
                      {SEMANTIC_ROLES.map((spec) => (
                        <tr key={spec.token} className="ll:hover:bg-surface-hover">
                          <td className="ll:p-3 ll:font-medium ll:text-primary">{spec.role}</td>
                          <td className="ll:p-3 ll:font-mono ll:text-micro ll:text-secondary">{spec.token}</td>
                          <td className="ll:p-3">
                            <span
                              className={`ll:inline-block ll:w-6 ll:h-6 ll:rounded-sm ll:border ll:border-border ${spec.bgClass}`}
                            />
                          </td>
                          {THEME_LIST.map((theme) => (
                            <td
                              key={theme.id}
                              className={`ll:p-3 ll:font-mono ll:text-micro ${theme.id === activeTheme ? "ll:text-primary" : "ll:text-secondary"}`}
                            >
                              {liveTokens[theme.id]?.[spec.token] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSection === "type" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Type Scale</h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Geist Sans &amp; Geist Mono Typography Hierarchy
                  </span>
                </div>
                <div className="ll:flex ll:flex-col ll:gap-6 ll:p-6 ll:border ll:border-border ll:rounded-md ll:bg-surface-panel">
                  <div className="ll:flex ll:flex-col ll:gap-1">
                    <span className="ll:text-micro ll:text-secondary ll:uppercase">Display (30px / 1.05 / -0.03em / 600)</span>
                    <div className="ll:text-display ll:text-primary">The Quick Brown Fox</div>
                  </div>
                  <div className="ll:flex ll:flex-col ll:gap-1">
                    <span className="ll:text-micro ll:text-secondary ll:uppercase">Lead (16px / 1.4 / -0.01em / 500)</span>
                    <div className="ll:text-lead ll:text-primary">Build responsive layouts at production scale.</div>
                  </div>
                  <div className="ll:flex ll:flex-col ll:gap-1">
                    <span className="ll:text-micro ll:text-secondary ll:uppercase">Title (14px / 1.4 / -0.01em / 500)</span>
                    <div className="ll:text-title ll:text-primary">Inspector Section Properties</div>
                  </div>
                  <div className="ll:flex ll:flex-col ll:gap-1">
                    <span className="ll:text-micro ll:text-secondary ll:uppercase">Body (13px / 1.4 / 0em / 400)</span>
                    <div className="ll:text-body ll:text-primary">Default text style for application controls, rows, and toolbars.</div>
                  </div>
                  <div className="ll:flex ll:flex-col ll:gap-1">
                    <span className="ll:text-micro ll:text-secondary ll:uppercase">Small (12px / 1.3 / 0em / 400)</span>
                    <div className="ll:text-small ll:text-secondary">Secondary labels, property row hints, and metadata.</div>
                  </div>
                  <div className="ll:flex ll:flex-col ll:gap-1">
                    <span className="ll:text-micro ll:text-secondary ll:uppercase">Micro (11px / 1.2 / 0.08em / 500 Mono)</span>
                    <div className="ll:text-micro ll:text-secondary">ZONE HEADERS, SHORTCUTS, METRICS</div>
                  </div>
                  <div className="ll:flex ll:flex-col ll:gap-1">
                    <span className="ll:text-micro ll:text-secondary ll:uppercase">Nano (10px / 1.2 / 0.08em / 500 Mono)</span>
                    <div className="ll:text-nano ll:text-muted">TINY DIMENSIONS &amp; STATUS PILLS</div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "spacing" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Spacing</h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    4px Baseline Grid Scale
                  </span>
                </div>
                <div className="ll:rounded-md ll:border ll:border-border ll:overflow-hidden">
                  <table className="ll:w-full ll:text-left ll:border-collapse ll:text-small">
                    <thead>
                      <tr className="ll:border-b ll:border-border ll:bg-surface-bar">
                        <th className="ll:p-3 ll:font-medium ll:text-secondary">Token</th>
                        <th className="ll:p-3 ll:font-medium ll:text-secondary">Pixels</th>
                        <th className="ll:p-3 ll:font-medium ll:text-secondary">Visual</th>
                      </tr>
                    </thead>
                    <tbody className="ll:divide-y ll:divide-border ll:bg-surface-panel">
                      {SPACING_STEPS.map((s) => (
                        <tr key={s.token} className="ll:hover:bg-surface-hover">
                          <td className="ll:p-3 ll:font-mono ll:text-micro ll:text-secondary">{s.token}</td>
                          <td className="ll:p-3 ll:font-mono ll:text-micro ll:font-bold ll:text-primary">{s.px}px</td>
                          <td className="ll:p-3">
                            <div className={`ll:h-4 ll:bg-primary ll:rounded-xs ${s.widthClass}`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSection === "radii" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Radii</h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Apple-Level Modest Geometry (No Pills, No Capsules)
                  </span>
                </div>
                <div className="ll:grid ll:grid-cols-2 ll:sm:grid-cols-4 ll:gap-4">
                  <div className="ll:flex ll:flex-col ll:items-center ll:gap-2 ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-xs">
                    <span className="ll:text-micro ll:font-mono ll:text-secondary">xs: 2px</span>
                    <span className="ll:text-small ll:text-muted">Knobs, badges</span>
                  </div>
                  <div className="ll:flex ll:flex-col ll:items-center ll:gap-2 ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm">
                    <span className="ll:text-micro ll:font-mono ll:text-secondary">sm: 4px</span>
                    <span className="ll:text-small ll:text-muted">Buttons, inputs</span>
                  </div>
                  <div className="ll:flex ll:flex-col ll:items-center ll:gap-2 ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
                    <span className="ll:text-micro ll:font-mono ll:text-secondary">md: 6px</span>
                    <span className="ll:text-small ll:text-muted">Containers, menus</span>
                  </div>
                  <div className="ll:flex ll:flex-col ll:items-center ll:gap-2 ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-lg">
                    <span className="ll:text-micro ll:font-mono ll:text-secondary">lg: 8px</span>
                    <span className="ll:text-small ll:text-muted">Floating chrome, modals</span>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "shadows" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Shadows</h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Theme-Calibrated Soft Shadows for Floating Chrome
                  </span>
                </div>
                <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:gap-6">
                  <div className="ll:p-8 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:flex ll:flex-col ll:gap-2">
                    <span className="ll:text-body ll:font-medium ll:text-primary">Soft Floating Shadow</span>
                    <code className="ll:text-micro ll:font-mono ll:text-secondary">--ll-shadow-soft</code>
                    <span className="ll:text-small ll:text-muted">Calibrated per theme to preserve contrast without glare.</span>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "sizes" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Layout Sizes</h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Fixed Editor Shell, Panels, Header &amp; Row Height Dimensions
                  </span>
                </div>
                <div className="ll:rounded-md ll:border ll:border-border ll:overflow-hidden">
                  <table className="ll:w-full ll:text-left ll:border-collapse ll:text-small">
                    <thead>
                      <tr className="ll:border-b ll:border-border ll:bg-surface-bar">
                        <th className="ll:p-3 ll:font-medium ll:text-secondary">Role</th>
                        <th className="ll:p-3 ll:font-medium ll:text-secondary">Token</th>
                        <th className="ll:p-3 ll:font-medium ll:text-secondary">Value</th>
                        <th className="ll:p-3 ll:font-medium ll:text-secondary">Description</th>
                      </tr>
                    </thead>
                    <tbody className="ll:divide-y ll:divide-border ll:bg-surface-panel">
                      {LAYOUT_SIZES.map((s) => (
                        <tr key={s.token} className="ll:hover:bg-surface-hover">
                          <td className="ll:p-3 ll:font-medium ll:text-primary">{s.role}</td>
                          <td className="ll:p-3 ll:font-mono ll:text-micro ll:text-secondary">{s.token}</td>
                          <td className="ll:p-3 ll:font-mono ll:text-micro ll:font-bold ll:text-primary">{s.value}</td>
                          <td className="ll:p-3 ll:text-secondary">{s.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSection === "motion" && <MotionDemo />}

            {/* 2. Core Rebuilt Components */}
            {activeSection === "button" && <ButtonDemo />}
            {activeSection === "icon-button" && <IconButtonDemo />}
            {activeSection === "segmented-control" && <SegmentedControlDemo />}
            {activeSection === "toggle" && <ToggleDemo />}
            {activeSection === "checkbox" && <CheckboxDemo />}
            {activeSection === "tooltip" && <TooltipDemo />}
            {activeSection === "text-field" && <TextFieldDemo />}
            {activeSection === "number-field" && <NumberFieldDemo />}
            {activeSection === "select" && <SelectDemo />}
            {activeSection === "color-swatch-field" && <ColorSwatchFieldDemo />}
            {activeSection === "menu" && <MenuDemo />}
            {activeSection === "context-menu" && <ContextMenuDemo />}
            {activeSection === "popover" && <PopoverDemo />}
            {activeSection === "command-palette" && <CommandPaletteDemo />}
            {activeSection === "tabs" && <TabsDemo />}
            {activeSection === "avatar" && <AvatarDemo />}
            {activeSection === "empty-state" && <EmptyStateDemo />}
            {activeSection === "theme-toggle" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">ThemeToggle</h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Rebuilt on Menu Component with Radio Semantics &amp; Arrow Navigation
                  </span>
                </div>
                <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:items-center ll:gap-4">
                  <ThemeToggle size="md" />
                  <span className="ll:text-small ll:text-secondary">Click palette icon to select from 5 themes</span>
                </div>
              </div>
            )}
            {activeSection === "swatch" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Swatch</h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Token Inspection Swatch
                  </span>
                </div>
                <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-3 ll:gap-4">
                  <Swatch role="Surface Canvas" token="--ll-surface-canvas" hex={liveTokens[activeTheme]?.["--ll-surface-canvas"] || "—"} bgClass="ll:bg-surface-canvas" />
                  <Swatch role="Surface Panel" token="--ll-surface-panel" hex={liveTokens[activeTheme]?.["--ll-surface-panel"] || "—"} bgClass="ll:bg-surface-panel" />
                  <Swatch role="Primary Control" token="--ll-control-primary-bg" hex={liveTokens[activeTheme]?.["--ll-control-primary-bg"] || "—"} bgClass="ll:bg-control-primary" />
                </div>
              </div>
            )}
            {activeSection === "workspace-frame" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">WorkspaceFrame</h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Real Layer Studio Workspace Preview
                  </span>
                </div>
                <WorkspaceFrame />
              </div>
            )}
            {activeSection === "imported-cursor" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Cursor</h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported Collaborative Cursor Component (Token-Styled)
                  </span>
                </div>
                <CursorDemo />
              </div>
            )}
            {activeSection === "imported-scroll-fade" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Scroll Fade</h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported Scroll Fade Component (Token-Styled)
                  </span>
                </div>
                <ScrollFadeDemo />
              </div>
            )}

            {/* 3. Shell Parts */}
            {activeSection === "top-bar" && <TopBarDemo />}
            {activeSection === "logo-mark" && <LogoMarkDemo />}
            {activeSection === "mode-tabs" && <ModeTabsDemo />}
            {activeSection === "page-switcher" && <PageSwitcherDemo />}
            {activeSection === "ship-popover" && <ShipPopoverDemo />}
            {activeSection === "avatar-stack" && <AvatarStackDemo />}
            {activeSection === "left-panel-header" && <LeftPanelHeaderDemo />}
            {activeSection === "left-panel-rows" && <LeftPanelRowsDemo />}
            {activeSection === "layer-context-menu" && <LayerContextMenuDemo />}
            {activeSection === "left-panel-empty" && <LeftPanelEmptyDemo />}
            {activeSection === "right-panel-header" && <RightPanelHeaderDemo />}
            {activeSection === "right-panel-accordion" && <RightPanelAccordionRowDemo />}
            {activeSection === "right-panel-ai-chat" && <RightPanelAiChatDemo />}
            {activeSection === "right-panel-empty" && <RightPanelEmptyDemo />}
            {activeSection === "persistence-banners" && <PersistenceBannersDemo />}

            {/* 4. Canvas Chrome */}
            {activeSection === "toolbar" && <ToolbarDemo />}
            {activeSection === "insert-box" && <InsertBoxDemo />}
            {activeSection === "ai-box" && <AiBoxDemo />}
            {activeSection === "view-options" && <ViewOptionsPopoverDemo />}
            {activeSection === "rulers" && <RulersDemo />}
            {activeSection === "stage-selection" && <StageSelectionDemo />}

            {/* 5. Panels & Details */}
            {activeSection === "panel-section" && <PanelSectionDemo />}
            {activeSection === "property-row" && <PropertyRowDemo />}
            {activeSection === "list-row" && <ListRowDemo />}
            {activeSection === "tree-row" && <TreeRowDemo />}
            {activeSection === "inspector-controls" && <InspectorControlsDemo />}
            {activeSection === "timeline" && <TimelineDemo />}
            {activeSection === "code-view" && <CodeViewDemo />}
          </div>
        </main>
      </div>
    </div>
  );
}
