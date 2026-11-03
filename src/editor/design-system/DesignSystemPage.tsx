"use client";

import React, { useEffect, useState, useRef, useCallback, useSyncExternalStore } from "react";
import { Swatch } from "../components/Swatch";
import { WorkspaceFrame } from "../components/WorkspaceFrame";
import { Button } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { Tooltip } from "../components/Tooltip";
import { TopBar, type DeviceMode } from "../components/TopBar";
import { ThemeToggle, THEMES, type Theme, useTheme } from "../components/ThemeToggle";
import { MotionDemo } from "./MotionDemo";

// Imported (as-is) components
import SquishSwitch from "../components/imported/squish-switch/SquishSwitch";
import ScrubField from "../components/imported/scrub-field/ScrubField";
import ElasticSlider from "../components/imported/elastic-slider/ElasticSlider";
import {
  Cursor,
  CursorContainer,
  CursorFollow,
  CursorProvider,
} from "../components/imported/cursor";
import {
  AvatarGroup,
  AvatarGroupTooltip,
  AvatarGroupTooltipArrow,
} from "../components/imported/avatar-group";
import {
  Tooltip as ImportedTooltip,
  TooltipArrow as ImportedTooltipArrow,
  TooltipContent as ImportedTooltipContent,
  TooltipProvider as ImportedTooltipProvider,
  TooltipTrigger as ImportedTooltipTrigger,
} from "../components/imported/tooltip";
import { Select as ImportedSelect } from "../components/imported/select";
import {
  Menubar as ImportedMenubar,
  Menu as ImportedMenubarMenu,
} from "../components/imported/menubar";
import { Menu as ImportedDropdownMenu } from "../components/imported/dropdown-menu";
import { ContextMenu as ImportedContextMenu } from "../components/imported/context-menu";
import { ScrollFade as ImportedScrollFade } from "../components/imported/scroll-fade";
import {
  FileTree as ImportedFileTree,
  type FileTreeElement,
} from "../components/imported/unlumen-ui/file-tree";
import {
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Search,
  Settings,
  Sparkles,
  Download,
  Share2,
  Sun,
  Moon,
  Check,
  Menu as MenuIcon,
} from "lucide-react";

type NavSectionId =
  | "colors"
  | "type"
  | "spacing"
  | "radii"
  | "shadows"
  | "sizes"
  | "motion"
  | "button"
  | "segmented-control"
  | "tooltip"
  | "top-bar"
  | "theme-toggle"
  | "swatch"
  | "workspace-frame"
  | "imported-squish-switch"
  | "imported-scrub-field"
  | "imported-elastic-slider"
  | "imported-cursor"
  | "imported-avatar-group"
  | "imported-tooltip"
  | "imported-select"
  | "imported-menubar"
  | "imported-dropdown-menu"
  | "imported-context-menu"
  | "imported-scroll-fade"
  | "imported-file-tree";

interface NavItem {
  id: NavSectionId;
  label: string;
}

const FOUNDATIONS_NAV: readonly NavItem[] = [
  { id: "colors", label: "Colors" },
  { id: "type", label: "Type" },
  { id: "spacing", label: "Spacing" },
  { id: "radii", label: "Radii" },
  { id: "shadows", label: "Shadows" },
  { id: "sizes", label: "Layout Sizes" },
  { id: "motion", label: "Motion" },
];

const COMPONENTS_NAV: readonly NavItem[] = [
  { id: "button", label: "Button" },
  { id: "segmented-control", label: "SegmentedControl" },
  { id: "tooltip", label: "Tooltip" },
  { id: "top-bar", label: "TopBar" },
  { id: "theme-toggle", label: "ThemeToggle" },
  { id: "swatch", label: "Swatch" },
  { id: "workspace-frame", label: "WorkspaceFrame" },
];

const IMPORTED_NAV: readonly NavItem[] = [
  { id: "imported-squish-switch", label: "SquishSwitch" },
  { id: "imported-scrub-field", label: "ScrubField" },
  { id: "imported-elastic-slider", label: "ElasticSlider" },
  { id: "imported-cursor", label: "Cursor" },
  { id: "imported-avatar-group", label: "Avatar Group" },
  { id: "imported-tooltip", label: "Tooltip (imported)" },
  { id: "imported-select", label: "Select" },
  { id: "imported-menubar", label: "Menubar" },
  { id: "imported-dropdown-menu", label: "Dropdown Menu" },
  { id: "imported-context-menu", label: "Context Menu" },
  { id: "imported-scroll-fade", label: "Scroll Fade" },
  { id: "imported-file-tree", label: "File Tree" },
];

const ALL_NAV = [...FOUNDATIONS_NAV, ...COMPONENTS_NAV, ...IMPORTED_NAV];

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
  { id: "paper", label: "Paper (Def)" },
  { id: "dark", label: "Dark" },
  { id: "white", label: "White" },
  { id: "warm", label: "Warm" },
  { id: "lilac", label: "Lilac" },
];

function rgbToHex(color: string): string {
  const c = color.trim().toLowerCase();
  if (c.startsWith("#")) return c.toUpperCase();
  if (c === "transparent" || c === "rgba(0, 0, 0, 0)" || c === "none") return "None";
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const r = parseInt(m[1], 10).toString(16).padStart(2, "0");
    const g = parseInt(m[2], 10).toString(16).padStart(2, "0");
    const b = parseInt(m[3], 10).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`.toUpperCase();
  }
  return color;
}

function parseColor(color: string): [number, number, number] | null {
  const c = color.trim().toLowerCase();
  if (c.startsWith("#")) {
    let hex = c.slice(1);
    if (hex.length === 3) {
      hex = hex.split("").map((x) => x + x).join("");
    }
    if (hex.length === 6) {
      const num = parseInt(hex, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
  }
  const rgbMatch = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
  }
  return null;
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(fg: string, bg: string): { formatted: string; grade: string } {
  const c1 = parseColor(fg);
  const c2 = parseColor(bg);
  if (!c1 || !c2) return { formatted: "—", grade: "—" };
  const l1 = getLuminance(c1[0], c1[1], c1[2]);
  const l2 = getLuminance(c2[0], c2[1], c2[2]);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (brighter + 0.05) / (darker + 0.05);
  return {
    formatted: `${ratio.toFixed(1)}:1`,
    grade: ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : "Fail",
  };
}

const SERVER_LIVE_TOKENS: Record<Theme, Record<string, string>> = {
  paper: Object.fromEntries(SEMANTIC_ROLES.map((s) => [s.token, "—"])),
  dark: Object.fromEntries(SEMANTIC_ROLES.map((s) => [s.token, "—"])),
  white: Object.fromEntries(SEMANTIC_ROLES.map((s) => [s.token, "—"])),
  warm: Object.fromEntries(SEMANTIC_ROLES.map((s) => [s.token, "—"])),
  lilac: Object.fromEntries(SEMANTIC_ROLES.map((s) => [s.token, "—"])),
};

let liveTokensCache: Record<Theme, Record<string, string>> = SERVER_LIVE_TOKENS;
const tokenSubscribers = new Set<() => void>();

function subscribeLiveTokens(callback: () => void): () => void {
  tokenSubscribers.add(callback);

  if (typeof window !== "undefined" && liveTokensCache === SERVER_LIVE_TOKENS) {
    queueMicrotask(() => {
      liveTokensCache = readLiveThemeTokens();
      tokenSubscribers.forEach((fn) => fn());
    });
  }

  return () => {
    tokenSubscribers.delete(callback);
  };
}

function getLiveTokensSnapshot(): Record<Theme, Record<string, string>> {
  return liveTokensCache;
}

function getServerLiveTokensSnapshot(): Record<Theme, Record<string, string>> {
  return SERVER_LIVE_TOKENS;
}

function readLiveThemeTokens(): Record<Theme, Record<string, string>> {
  if (typeof document === "undefined") {
    return SERVER_LIVE_TOKENS;
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
  { role: "Top bar height", token: "--ll-size-topbar-h", value: "52px", description: "Fixed height of top bar" },
  { role: "Left panel width", token: "--ll-size-panel-left-w", value: "248px", description: "Standard left tool/layer rail width" },
  { role: "Right panel width", token: "--ll-size-panel-right-w", value: "320px", description: "Standard right inspector panel width" },
  { role: "Right panel (compact)", token: "--ll-size-panel-right-w-compact", value: "296px", description: "Right inspector on medium viewports (<1200px)" },
  { role: "Canvas ruler", token: "--ll-size-ruler", value: "18px", description: "Top and left canvas measurement rulers" },
  { role: "Standard row height", token: "--ll-size-row-h", value: "32px", description: "Default row height in panels and menus" },
  { role: "Large row height", token: "--ll-size-row-lg-h", value: "36px", description: "Asset and section header row height" },
  { role: "Panel zone head", token: "--ll-size-header-h", value: "44px", description: "Header bar height for panels" },
  { role: "Button standard", token: "--ll-size-btn-h", value: "32px", description: "Standard action button height" },
  { role: "Button mini", token: "--ll-size-btn-sm-h", value: "24px", description: "Compact inline tag and action button height" },
  { role: "Icon button", token: "--ll-size-icon-btn", value: "28px", description: "Toolbar square icon button size" },
  { role: "Avatar size", token: "--ll-size-avatar", value: "28px", description: "User avatar dimension" },
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

// Demo components for Imported (as-is)
function SquishSwitchDemo() {
  const [airplane, setAirplane] = useState(false);
  return (
    <SquishSwitch
      checked={airplane}
      onChange={setAirplane}
      label="Airplane mode"
      trackColor="#27272a"
      trackOnColor="#f5f5f5"
      width={76}
      height={38}
      radius={19}
      speed={50}
      stretch={36}
      hoverScale={1.035}
      colorDuration={320}
    />
  );
}

function ScrubFieldDemo() {
  const [_radius, setRadius] = useState(24);
  return (
    <ScrubField
      label="Radius"
      suffix="px"
      defaultValue={24}
      min={0}
      max={100}
      step={1}
      size="md"
      sensitivity={2}
      rubberReach={8}
      returnDuration={300}
      coarseMultiplier={10}
      fineMultiplier={0.1}
      showDelta
      showDirty={false}
      showFill
      accent="#f5f5f5"
      chipColor="#27272a"
      onChange={(value) => setRadius(value)}
      onCommit={(value) => setRadius(value)}
    />
  );
}

function ElasticSliderDemo() {
  return (
    <ElasticSlider
      defaultValue={50}
      startingValue={0}
      maxValue={100}
      isStepped
      stepSize={1}
    />
  );
}

function CursorDemo() {
  return (
    <div className="relative h-72 w-full border border-dashed border-border flex items-center justify-center">
      <CursorProvider>
        <CursorContainer>
          <Cursor>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 0 L16 6 L9 9 L6 16 Z" />
            </svg>
          </Cursor>
          <CursorFollow side="bottom" align="end">
            <span className="text-xs bg-control-primary text-control-primary-fg px-2 py-0.5 rounded">
              Designer
            </span>
          </CursorFollow>
          <span className="text-small text-secondary">Move cursor within this area</span>
        </CursorContainer>
      </CursorProvider>
    </div>
  );
}

const AVATAR_PEOPLE = [
  { name: "Skyleen", src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" },
  { name: "Alex", src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" },
  { name: "Elena", src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" },
];

function AvatarGroupDemo() {
  return (
    <div className="flex flex-col gap-6">
      <AvatarGroup className="h-12 -space-x-3 flex items-center" invertOverlap>
        {AVATAR_PEOPLE.map((person) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={person.name}
            src={person.src}
            alt={person.name}
            className="size-12 rounded-full border-2 border-background object-cover"
          />
        ))}
      </AvatarGroup>
      <div className="flex items-center gap-2">
        <div className="relative size-12 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-semibold">
          SK
          <AvatarGroupTooltip className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background">
            <AvatarGroupTooltipArrow className="size-2.5 fill-foreground" />
            <p>Skyleen</p>
          </AvatarGroupTooltip>
        </div>
      </div>
    </div>
  );
}

function ImportedTooltipDemo() {
  return (
    <ImportedTooltipProvider>
      <div className="flex items-center gap-4">
        <ImportedTooltip>
          <ImportedTooltipTrigger asChild>
            <button type="button" aria-label="Bold" className="px-3 py-1.5 border border-border rounded font-bold">B</button>
          </ImportedTooltipTrigger>
          <ImportedTooltipContent className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background">
            <ImportedTooltipArrow className="size-2.5 fill-foreground" />
            <p>Bold</p>
          </ImportedTooltipContent>
        </ImportedTooltip>

        <ImportedTooltip side="bottom">
          <ImportedTooltipTrigger asChild>
            <button type="button" aria-label="Italic" className="px-3 py-1.5 border border-border rounded italic font-serif">I</button>
          </ImportedTooltipTrigger>
          <ImportedTooltipContent className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background">
            <ImportedTooltipArrow className="size-2.5 fill-foreground" />
            <p>Italic</p>
          </ImportedTooltipContent>
        </ImportedTooltip>
      </div>
    </ImportedTooltipProvider>
  );
}

const SELECT_FRAMEWORKS = [
  { label: "React", value: "react" },
  { label: "Vue", value: "vue" },
  { label: "Svelte", value: "svelte" },
  { label: "Solid", value: "solid" },
];

function SelectDemo() {
  const [val, setVal] = useState("react");
  return (
    <div className="ll:w-64">
      <ImportedSelect.Root
        items={SELECT_FRAMEWORKS}
        value={val}
        onValueChange={(next) => {
          if (next) setVal(next);
        }}
      >
        <ImportedSelect.Trigger aria-label="Framework">
          <ImportedSelect.Value placeholder="Select framework..." />
          <ImportedSelect.Icon />
        </ImportedSelect.Trigger>
        <ImportedSelect.Portal>
          <ImportedSelect.Positioner alignItemWithTrigger={false} sideOffset={4}>
            <ImportedSelect.Popup>
              <ImportedSelect.List>
                {SELECT_FRAMEWORKS.map((framework) => (
                  <ImportedSelect.Item key={framework.value} value={framework.value}>
                    <ImportedSelect.ItemText>{framework.label}</ImportedSelect.ItemText>
                    <ImportedSelect.ItemIndicator>✓</ImportedSelect.ItemIndicator>
                  </ImportedSelect.Item>
                ))}
              </ImportedSelect.List>
            </ImportedSelect.Popup>
          </ImportedSelect.Positioner>
        </ImportedSelect.Portal>
      </ImportedSelect.Root>
    </div>
  );
}

function MenubarDemo() {
  return (
    <ImportedMenubar className="ll:w-full ll:max-w-md ll:border ll:border-border ll:rounded-md ll:px-2 ll:py-1 ll:flex ll:items-center ll:gap-4">
      <ImportedMenubarMenu.Root>
        <ImportedMenubarMenu.Trigger>File</ImportedMenubarMenu.Trigger>
        <ImportedMenubarMenu.Portal>
          <ImportedMenubarMenu.Positioner sideOffset={8}>
            <ImportedMenubarMenu.Popup>
              <ImportedMenubarMenu.Item>New file</ImportedMenubarMenu.Item>
              <ImportedMenubarMenu.Item>Save</ImportedMenubarMenu.Item>
            </ImportedMenubarMenu.Popup>
          </ImportedMenubarMenu.Positioner>
        </ImportedMenubarMenu.Portal>
      </ImportedMenubarMenu.Root>
      <ImportedMenubarMenu.Root>
        <ImportedMenubarMenu.Trigger>Edit</ImportedMenubarMenu.Trigger>
        <ImportedMenubarMenu.Portal>
          <ImportedMenubarMenu.Positioner sideOffset={8}>
            <ImportedMenubarMenu.Popup>
              <ImportedMenubarMenu.Item>Undo</ImportedMenubarMenu.Item>
              <ImportedMenubarMenu.Item>Redo</ImportedMenubarMenu.Item>
            </ImportedMenubarMenu.Popup>
          </ImportedMenubarMenu.Positioner>
        </ImportedMenubarMenu.Portal>
      </ImportedMenubarMenu.Root>
      <ImportedMenubarMenu.Root>
        <ImportedMenubarMenu.Trigger>View</ImportedMenubarMenu.Trigger>
        <ImportedMenubarMenu.Portal>
          <ImportedMenubarMenu.Positioner sideOffset={8}>
            <ImportedMenubarMenu.Popup>
              <ImportedMenubarMenu.Item>Zoom In</ImportedMenubarMenu.Item>
              <ImportedMenubarMenu.Item>Zoom Out</ImportedMenubarMenu.Item>
            </ImportedMenubarMenu.Popup>
          </ImportedMenubarMenu.Positioner>
        </ImportedMenubarMenu.Portal>
      </ImportedMenubarMenu.Root>
    </ImportedMenubar>
  );
}

function DropdownMenuDemo() {
  return (
    <div className="ll:flex ll:items-center ll:justify-center">
      <ImportedDropdownMenu.Root>
        <ImportedDropdownMenu.Trigger>
          Open Menu
        </ImportedDropdownMenu.Trigger>
        <ImportedDropdownMenu.Portal>
          <ImportedDropdownMenu.Positioner sideOffset={4}>
            <ImportedDropdownMenu.Popup>
              <ImportedDropdownMenu.Item>Profile</ImportedDropdownMenu.Item>
              <ImportedDropdownMenu.Item>Billing</ImportedDropdownMenu.Item>
              <ImportedDropdownMenu.Separator />
              <ImportedDropdownMenu.Item>Log out</ImportedDropdownMenu.Item>
            </ImportedDropdownMenu.Popup>
          </ImportedDropdownMenu.Positioner>
        </ImportedDropdownMenu.Portal>
      </ImportedDropdownMenu.Root>
    </div>
  );
}

function ContextMenuDemo() {
  return (
    <ImportedContextMenu.Root>
      <ImportedContextMenu.Trigger className="ll:h-40 ll:w-full ll:max-w-md ll:border ll:border-dashed ll:border-border ll:rounded-md ll:flex ll:items-center ll:justify-center ll:text-small ll:text-secondary">
        Right-click in this box
      </ImportedContextMenu.Trigger>
      <ImportedContextMenu.Portal>
        <ImportedContextMenu.Positioner>
          <ImportedContextMenu.Popup>
            <ImportedContextMenu.Item>Undo</ImportedContextMenu.Item>
            <ImportedContextMenu.Item>Duplicate</ImportedContextMenu.Item>
            <ImportedContextMenu.Separator />
            <ImportedContextMenu.Item>Delete</ImportedContextMenu.Item>
          </ImportedContextMenu.Popup>
        </ImportedContextMenu.Positioner>
      </ImportedContextMenu.Portal>
    </ImportedContextMenu.Root>
  );
}

function ScrollFadeDemo() {
  return (
    <div className="ll:h-48 ll:w-full ll:max-w-sm ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:relative">
      <ImportedScrollFade className="ll:h-full ll:p-4 ll:overflow-y-auto ll:flex ll:flex-col ll:gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="ll:p-2 ll:border ll:border-border ll:rounded ll:text-small">
            Scrollable timeline track {i + 1}
          </div>
        ))}
      </ImportedScrollFade>
    </div>
  );
}

const FILE_TREE_DATA: FileTreeElement[] = [
  {
    id: "1",
    name: "src",
    type: "folder",
    defaultOpen: true,
    children: [
      {
        id: "2",
        name: "components",
        type: "folder",
        defaultOpen: true,
        children: [
          { id: "3", name: "Button.tsx", type: "file" },
          { id: "4", name: "TopBar.tsx", type: "file" },
          { id: "5", name: "ThemeToggle.tsx", type: "file" },
        ],
      },
      { id: "6", name: "index.ts", type: "file" },
    ],
  },
];

function FileTreeDemo() {
  return (
    <div className="ll:w-full ll:max-w-xs ll:border ll:border-border ll:rounded-md ll:p-2">
      <ImportedFileTree elements={FILE_TREE_DATA} defaultOpenIds={["1", "2"]} />
    </div>
  );
}

export function DesignSystemPage() {
  const [activeSection, setActiveSection] = useState<NavSectionId>("colors");
  const [activeTheme, setActiveTheme] = useTheme();
  const liveTokens = useSyncExternalStore(subscribeLiveTokens, getLiveTokensSnapshot, getServerLiveTokensSnapshot);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Demo state for SegmentedControl and TopBar
  const [demoDevice, setDemoDevice] = useState<DeviceMode>("desktop");
  const [topBarDevice, setTopBarDevice] = useState<DeviceMode>("desktop");

  // Hash-based routing for bookmarking and direct links
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "") as NavSectionId;
      if (ALL_NAV.some((item) => item.id === hash)) {
        setActiveSection(hash);
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
  }, []);

  // Keyboard navigation for nav list (arrow keys & Enter/Space)
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
    <div className="design-system-root ll:h-screen ll:w-screen ll:overflow-hidden ll:bg-surface-backdrop ll:p-4 ll:box-border ll:font-sans ll:text-primary">
      {/* App frame: 16px inset on surface-backdrop, modest 8px radius, hairline border, soft shadow */}
      <div className="ll:w-full ll:h-full ll:rounded-lg ll:border ll:border-border ll:shadow-soft ll:overflow-hidden ll:isolate ll:flex ll:flex-col ll:xl:flex-row ll:bg-surface-canvas">
        {/* Mobile & Tablet Top Bar (< xl) */}
        <div className="ll:p-3 ll:border-b ll:border-border ll:flex ll:items-center ll:justify-between ll:gap-2 ll:bg-surface-panel ll:xl:hidden">
          <div className="ll:flex ll:items-center ll:gap-2">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
            >
              <MenuIcon size={16} />
            </Button>
            <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
              {ALL_NAV.find((n) => n.id === activeSection)?.label ?? "Design System"}
            </span>
          </div>
          <ThemeToggle size="sm" />
        </div>

        {/* Navigation Panel: Drawer on mobile/tablet, right sidebar on desktop (fixed 320px) */}
        <aside
          className={`${
            mobileNavOpen ? "ll:flex" : "ll:hidden"
          } ll:xl:flex ll:w-full ll:xl:w-80 ll:xl:h-full ll:bg-surface-panel ll:xl:order-last ll:border-b ll:xl:border-b-0 ll:xl:border-l ll:border-border ll:flex-col ll:shrink-0 ll:overflow-y-auto ll:max-h-80 ll:xl:max-h-full`}
        >
          {/* Header with ThemeToggle (desktop only) */}
          <div className="ll:hidden ll:xl:flex ll:p-4 ll:border-b ll:border-border ll:items-center ll:justify-between ll:gap-2">
            <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
              Design System
            </span>
            <ThemeToggle size="sm" />
          </div>

          {/* Navigation groups */}
          <nav aria-label="Design system navigation" className="ll:p-3 ll:flex ll:flex-col ll:gap-4">
            {/* Foundations group */}
            <div className="ll:flex ll:flex-col ll:gap-1">
              <div className="ll:px-3 ll:py-1 ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                Foundations
              </div>
              <ul role="list" className="ll:flex ll:flex-col ll:gap-1">
                {FOUNDATIONS_NAV.map((item, index) => {
                  const isSelected = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        ref={(el) => {
                          navButtonRefs.current[index] = el;
                        }}
                        type="button"
                        aria-current={isSelected ? "page" : undefined}
                        onClick={() => handleSelect(item.id)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        className={`ll:w-full ll:h-11 ll:min-h-11 ll:px-3 ll:rounded-md ll:flex ll:items-center ll:justify-start ll:text-left ll:text-body ll:font-medium ll:focus-visible:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary ${
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

            {/* Hairline divider */}
            <div className="ll:h-px ll:w-full ll:bg-border" />

            {/* Components group */}
            <div className="ll:flex ll:flex-col ll:gap-1">
              <div className="ll:px-3 ll:py-1 ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                Components
              </div>
              <ul role="list" className="ll:flex ll:flex-col ll:gap-1">
                {COMPONENTS_NAV.map((item, index) => {
                  const globalIndex = FOUNDATIONS_NAV.length + index;
                  const isSelected = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        ref={(el) => {
                          navButtonRefs.current[globalIndex] = el;
                        }}
                        type="button"
                        aria-current={isSelected ? "page" : undefined}
                        onClick={() => handleSelect(item.id)}
                        onKeyDown={(e) => handleKeyDown(e, globalIndex)}
                        className={`ll:w-full ll:h-11 ll:min-h-11 ll:px-3 ll:rounded-md ll:flex ll:items-center ll:justify-start ll:text-left ll:text-body ll:font-medium ll:focus-visible:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary ${
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

            {/* Hairline divider */}
            <div className="ll:h-px ll:w-full ll:bg-border" />

            {/* Imported (as-is) group */}
            <div className="ll:flex ll:flex-col ll:gap-1">
              <div className="ll:px-3 ll:py-1 ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                Imported (as-is)
              </div>
              <ul role="list" className="ll:flex ll:flex-col ll:gap-1">
                {IMPORTED_NAV.map((item, index) => {
                  const globalIndex = FOUNDATIONS_NAV.length + COMPONENTS_NAV.length + index;
                  const isSelected = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        ref={(el) => {
                          navButtonRefs.current[globalIndex] = el;
                        }}
                        type="button"
                        aria-current={isSelected ? "page" : undefined}
                        onClick={() => handleSelect(item.id)}
                        onKeyDown={(e) => handleKeyDown(e, globalIndex)}
                        className={`ll:w-full ll:h-11 ll:min-h-11 ll:px-3 ll:rounded-md ll:flex ll:items-center ll:justify-start ll:text-left ll:text-body ll:font-medium ll:focus-visible:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary ${
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
          </nav>
        </aside>

        {/* Canvas (left, takes remaining width, content strictly centered) */}
        <main className="ll:flex-1 ll:h-full ll:overflow-y-auto ll:p-6 ll:sm:p-8 ll:md:p-12 ll:flex ll:flex-col ll:items-center">
          <div key={activeSection} className="ll:w-full ll:max-w-canvas">
            {activeSection === "colors" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Colors &amp; Semantic Palette
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Five Official Themes from PALETTE.md · Paper is Default
                  </span>
                </div>

                {/* Theme Switcher Bar for Design System Canvas */}
                <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:flex ll:flex-col ll:sm:flex-row ll:sm:items-center ll:justify-between ll:gap-3">
                  <div className="ll:flex ll:flex-col ll:gap-0.5">
                    <span className="ll:text-body ll:font-semibold ll:text-primary">
                      Active Theme Switcher
                    </span>
                    <span className="ll:text-small ll:text-secondary">
                      Select any of the 5 official themes to update the entire interface and tokens.
                    </span>
                  </div>
                  <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-1.5">
                    {THEMES.map((t) => {
                      const isSelected = activeTheme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            setActiveTheme(t.id);
                          }}
                          className={`ll:flex ll:items-center ll:gap-2 ll:h-8 ll:px-3 ll:rounded-md ll:border ll:text-body ll:transition-none ${
                            isSelected
                              ? "ll:bg-control-active ll:border-primary ll:text-primary ll:font-medium"
                              : "ll:bg-surface-raised ll:border-border ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
                          }`}
                        >
                          <span
                            data-theme={t.id}
                            className="ll:w-3 ll:h-3 ll:rounded-sm ll:border ll:border-swatch-line ll:bg-surface-panel ll:shrink-0"
                            aria-hidden="true"
                          />
                          <span>{t.label}</span>
                          {isSelected && (
                            <Check size={13} strokeWidth={2} className="ll:text-primary ll:shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Real workspace layer stack in current theme */}
                <div className="ll:flex ll:flex-col ll:gap-2">
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Workspace Preview (Current Active Theme)
                  </span>
                  <WorkspaceFrame />
                </div>

                {/* All Semantic Tokens Table across 5 Themes */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    All Semantic Tokens (Five Official Themes)
                  </div>

                  <div className="ll:flex ll:flex-col ll:gap-3">
                    {SEMANTIC_ROLES.map((spec) => (
                      <div
                        key={spec.token}
                        className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-3"
                      >
                        <div className="ll:flex ll:flex-col ll:sm:flex-row ll:sm:items-center ll:justify-between ll:gap-1">
                          <span className="ll:text-body ll:font-semibold ll:text-primary">
                            {spec.role}
                          </span>
                          <span className="ll:font-mono ll:text-small ll:text-secondary">
                            {spec.token}
                          </span>
                        </div>
                        <span className="ll:text-small ll:text-secondary">
                          {spec.description}
                        </span>

                        {/* Five-Theme Grid */}
                        <div className="ll:grid ll:grid-cols-2 ll:sm:grid-cols-5 ll:gap-2.5 ll:pt-1">
                          {THEME_LIST.map((themeOption) => {
                            const hex = liveTokens[themeOption.id]?.[spec.token] || "";
                            return (
                              <div
                                key={themeOption.id}
                                data-theme={themeOption.id}
                                className="ll:p-2.5 ll:rounded-sm ll:border ll:border-border ll:bg-surface-panel ll:flex ll:flex-col ll:gap-1.5"
                              >
                                <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                                  {themeOption.label}
                                </span>
                                <div className="ll:flex ll:items-center ll:gap-2">
                                  <span
                                    className={`ll:w-4 ll:h-4 ll:rounded-sm ll:border ll:border-border ll:shrink-0 ${spec.bgClass}`}
                                    aria-hidden="true"
                                  />
                                  <span className="ll:font-mono ll:text-small ll:text-primary ll:truncate">
                                    {hex || "—"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Text Role Contrast Ratios Section across 5 Themes (WCAG AA >= 4.5:1) */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Text Role Contrast Ratios (WCAG AA &ge; 4.5:1 / AAA &ge; 7:1)
                  </div>

                  <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:lg:grid-cols-3 ll:gap-4">
                    {THEME_LIST.map((item) => {
                      const themeMap = liveTokens[item.id] || {};
                      const panelBg = themeMap["--ll-surface-panel"] || "";
                      const primaryHex = themeMap["--ll-text-primary"] || "";
                      const secondaryHex = themeMap["--ll-text-secondary"] || "";
                      const mutedHex = themeMap["--ll-text-muted"] || "";

                      const primaryContrast = getContrastRatio(primaryHex, panelBg);
                      const secondaryContrast = getContrastRatio(secondaryHex, panelBg);
                      const mutedContrast = getContrastRatio(mutedHex, panelBg);

                      return (
                        <div
                          key={item.id}
                          data-theme={item.id}
                          className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:flex ll:flex-col ll:gap-3"
                        >
                          <div className="ll:flex ll:items-center ll:justify-between">
                            <span className="ll:text-body ll:font-semibold ll:text-primary">
                              {item.label}
                            </span>
                            <span className="ll:font-mono ll:text-micro ll:text-secondary">
                              Panel: {panelBg || "—"}
                            </span>
                          </div>

                          <div className="ll:flex ll:flex-col ll:gap-2">
                            <div className="ll:flex ll:items-center ll:justify-between ll:p-2 ll:rounded-sm ll:bg-surface-bar">
                              <span className="ll:text-small ll:font-medium ll:text-primary">
                                Primary ({primaryHex || "—"})
                              </span>
                              <span className="ll:inline-flex ll:items-center ll:gap-1.5 ll:font-mono ll:text-micro ll:font-semibold ll:text-primary">
                                {primaryContrast.formatted} · {primaryContrast.grade}
                              </span>
                            </div>

                            <div className="ll:flex ll:items-center ll:justify-between ll:p-2 ll:rounded-sm ll:bg-surface-bar">
                              <span className="ll:text-small ll:text-secondary">
                                Secondary ({secondaryHex || "—"})
                              </span>
                              <span className="ll:inline-flex ll:items-center ll:gap-1.5 ll:font-mono ll:text-micro ll:font-semibold ll:text-secondary">
                                {secondaryContrast.formatted} · {secondaryContrast.grade}
                              </span>
                            </div>

                            <div className="ll:flex ll:items-center ll:justify-between ll:p-2 ll:rounded-sm ll:bg-surface-bar">
                              <span className="ll:text-small ll:text-muted">
                                Muted ({mutedHex || "—"})
                              </span>
                              <span className="ll:inline-flex ll:items-center ll:gap-1.5 ll:font-mono ll:text-micro ll:font-semibold ll:text-muted">
                                {mutedContrast.formatted} · {mutedContrast.grade}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeSection === "type" && (
              <div className="ll:flex ll:flex-col ll:gap-6">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Type Scale
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Geist Sans &amp; Geist Mono · Calibrated Hierarchy
                  </span>
                </div>

                <div className="ll:flex ll:flex-col">
                  <div className="ll:border-b ll:border-border ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Display — 30px / Semibold (600) / Line Height 1.05 / Tracking -0.03em
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-secondary">
                        --ll-text-display
                      </span>
                    </div>
                    <div className="ll:text-display ll:font-semibold ll:text-primary">
                      Motion Design Studio
                    </div>
                  </div>

                  <div className="ll:border-b ll:border-border ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Title — 14px / Medium (500) / Line Height 1.4 / Tracking -0.01em
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-secondary">
                        --ll-text-title
                      </span>
                    </div>
                    <div className="ll:text-title ll:font-medium ll:text-primary">
                      Apple-level craft and motion choreography
                    </div>
                  </div>

                  <div className="ll:border-b ll:border-border ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Body — 13px / Regular (400) &amp; Medium (500) / Line Height 1.4
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-secondary">
                        --ll-text-body
                      </span>
                    </div>
                    <div className="ll:text-body ll:font-normal ll:text-primary">
                      Visually author interactive motion, effects, and components with GSAP and CSS, compiled to production-grade code.
                    </div>
                  </div>

                  <div className="ll:border-b ll:border-border ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Small — 12px / Regular (400) / Line Height 1.3
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-secondary">
                        --ll-text-small
                      </span>
                    </div>
                    <div className="ll:text-small ll:font-normal ll:text-primary">
                      Inspect keyframes, ease curves, transform vectors, and runtime nodes.
                    </div>
                  </div>

                  <div className="ll:border-b ll:border-border ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Micro Label &amp; Shortcuts — 11px / Medium (500) / Mono Uppercase / Tracking 0.08em
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-secondary">
                        --ll-text-micro
                      </span>
                    </div>
                    <div className="ll:text-micro ll:font-medium ll:uppercase ll:tracking-wider ll:text-primary">
                      FOUNDATIONS &amp; MOTION ARCHITECTURE
                    </div>
                  </div>

                  <div className="ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Code &amp; Numbers — Geist Mono
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-secondary">
                        --ll-font-mono
                      </span>
                    </div>
                    <div className="ll:font-mono ll:text-small ll:text-primary">
                      const surface = &quot;--ll-surface-panel&quot;;
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "spacing" && (
              <div className="ll:flex ll:flex-col ll:gap-6">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Spacing (4px Grid)
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Single Geometric Scale · Zero One-Off Gaps
                  </span>
                </div>
                <div className="ll:flex ll:flex-col">
                  {SPACING_STEPS.map((step) => (
                    <div
                      key={step.px}
                      className="ll:flex ll:items-center ll:gap-6 ll:py-4 ll:border-b ll:border-border"
                    >
                      <span className="ll:font-mono ll:text-small ll:w-16 ll:text-secondary ll:shrink-0">
                        {step.px}px
                      </span>
                      <span className="ll:font-mono ll:text-small ll:w-36 ll:text-secondary ll:shrink-0">
                        {step.token}
                      </span>
                      <div className="ll:flex-1 ll:flex ll:items-center">
                        <div
                          className={`ll:h-4 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ${step.widthClass}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === "radii" && (
              <div className="ll:flex ll:flex-col ll:gap-6">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Radii (Modest, No Pills)
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Concentric Where Nested · Strict Rectangular Neutrals
                  </span>
                </div>
                <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-3 ll:gap-6">
                  <div className="ll:h-28 ll:rounded-sm ll:bg-surface-panel ll:border ll:border-border ll:p-4 ll:flex ll:flex-col ll:justify-between">
                    <div>
                      <span className="ll:text-body ll:font-medium ll:text-primary">Small (4px)</span>
                      <p className="ll:text-small ll:text-secondary">Buttons, inputs, tags, thumbnails</p>
                    </div>
                    <span className="ll:font-mono ll:text-small ll:text-secondary">--ll-radius-sm</span>
                  </div>
                  <div className="ll:h-28 ll:rounded-md ll:bg-surface-panel ll:border ll:border-border ll:p-4 ll:flex ll:flex-col ll:justify-between">
                    <div>
                      <span className="ll:text-body ll:font-medium ll:text-primary">Medium (6px)</span>
                      <p className="ll:text-small ll:text-secondary">Menus, popovers, grouped containers</p>
                    </div>
                    <span className="ll:font-mono ll:text-small ll:text-secondary">--ll-radius-md</span>
                  </div>
                  <div className="ll:h-28 ll:rounded-lg ll:bg-surface-panel ll:border ll:border-border ll:p-4 ll:flex ll:flex-col ll:justify-between">
                    <div>
                      <span className="ll:text-body ll:font-medium ll:text-primary">Large (8px)</span>
                      <p className="ll:text-small ll:text-secondary">Context menus, modal frames, cards</p>
                    </div>
                    <span className="ll:font-mono ll:text-small ll:text-secondary">--ll-radius-lg</span>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "shadows" && (
              <div className="ll:flex ll:flex-col ll:gap-6">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Shadows
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Soft, Low-Elevation Shadows per Theme from PALETTE.md
                  </span>
                </div>
                <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:gap-6 ll:py-4">
                  <div className="ll:p-8 ll:rounded-lg ll:bg-surface-raised ll:border ll:border-border ll:shadow-soft ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:text-body ll:font-semibold ll:text-primary">
                      Soft Shadow (Active Theme)
                    </div>
                    <div className="ll:text-small ll:text-secondary">
                      Adapts automatically to current theme background.
                    </div>
                    <div className="ll:font-mono ll:text-small ll:text-secondary ll:mt-2">
                      --ll-shadow-soft
                    </div>
                  </div>

                  <div className="ll:p-6 ll:rounded-lg ll:bg-surface-panel ll:border ll:border-border ll:flex ll:flex-col ll:gap-2.5">
                    <div className="ll:text-body ll:font-semibold ll:text-primary">
                      Token Values per Theme
                    </div>
                    <ul className="ll:text-small ll:font-mono ll:text-secondary ll:flex ll:flex-col ll:gap-1">
                      <li>Paper: 0 4px 16px rgba(34,35,30,.1)</li>
                      <li>Dark: 0 4px 16px rgba(0,0,0,.5)</li>
                      <li>White: 0 4px 16px rgba(0,0,0,.12)</li>
                      <li>Warm: 0 4px 16px rgba(16,16,16,.08)</li>
                      <li>Lilac: 0 4px 16px rgba(34,35,30,.1)</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "sizes" && (
              <div className="ll:flex ll:flex-col ll:gap-6">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Layout Sizes
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Prototype Structural Metrics · Single System Grid
                  </span>
                </div>

                <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:gap-3">
                  {LAYOUT_SIZES.map((item) => (
                    <div
                      key={item.token}
                      className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-1.5"
                    >
                      <div className="ll:flex ll:items-center ll:justify-between">
                        <span className="ll:text-body ll:font-semibold ll:text-primary">
                          {item.role}
                        </span>
                        <span className="ll:font-mono ll:text-small ll:font-bold ll:text-primary">
                          {item.value}
                        </span>
                      </div>
                      <span className="ll:text-small ll:text-secondary">
                        {item.description}
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-muted ll:pt-1">
                        {item.token}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === "motion" && <MotionDemo />}

            {/* BUTTON COMPONENT */}
            {activeSection === "button" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Button
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Variants, Sizes, Icon-Only Shapes &amp; All States
                  </span>
                </div>

                {/* Group 1: Variants & Sizes */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Variants &amp; Sizes
                  </div>
                  <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-6">
                    {/* Primary variant */}
                    <div className="ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-small ll:font-semibold ll:text-primary">
                        Primary (Inverting Control: White in Dark, Black in Light)
                      </span>
                      <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-3">
                        <Button variant="primary" size="md">
                          Primary Medium (32px)
                        </Button>
                        <Button variant="primary" size="sm">
                          Primary Small (28px)
                        </Button>
                        <Button
                          variant="primary"
                          size="md"
                          leftIcon={<Sparkles size={14} />}
                        >
                          With Icon
                        </Button>
                      </div>
                    </div>

                    <div className="ll:h-px ll:w-full ll:bg-border" />

                    {/* Secondary variant */}
                    <div className="ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-small ll:font-semibold ll:text-primary">
                        Secondary (Raised Surface, Hairline Border)
                      </span>
                      <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-3">
                        <Button variant="secondary" size="md">
                          Secondary Medium (32px)
                        </Button>
                        <Button variant="secondary" size="sm">
                          Secondary Small (28px)
                        </Button>
                        <Button
                          variant="secondary"
                          size="md"
                          leftIcon={<Download size={14} />}
                        >
                          With Icon
                        </Button>
                      </div>
                    </div>

                    <div className="ll:h-px ll:w-full ll:bg-border" />

                    {/* Ghost variant */}
                    <div className="ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-small ll:font-semibold ll:text-primary">
                        Ghost (Transparent Surface, Instant Hover on surface-panel)
                      </span>
                      <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-3">
                        <Button variant="ghost" size="md">
                          Ghost Medium (32px)
                        </Button>
                        <Button variant="ghost" size="sm">
                          Ghost Small (28px)
                        </Button>
                        <Button
                          variant="ghost"
                          size="md"
                          leftIcon={<Share2 size={14} />}
                        >
                          With Icon
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group 2: Icon-Only Buttons */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Icon-Only Shape (Square, 6px Radius)
                  </div>
                  <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-wrap ll:items-center ll:gap-4">
                    <div className="ll:flex ll:flex-col ll:items-center ll:gap-1">
                      <Button variant="secondary" size="md" iconOnly aria-label="Undo">
                        <Undo2 size={16} strokeWidth={1.5} />
                      </Button>
                      <span className="ll:text-micro ll:text-secondary">Secondary 32px</span>
                    </div>

                    <div className="ll:flex ll:flex-col ll:items-center ll:gap-1">
                      <Button variant="secondary" size="sm" iconOnly aria-label="Undo">
                        <Undo2 size={14} strokeWidth={1.5} />
                      </Button>
                      <span className="ll:text-micro ll:text-secondary">Secondary 28px</span>
                    </div>

                    <div className="ll:flex ll:flex-col ll:items-center ll:gap-1">
                      <Button variant="primary" size="md" iconOnly aria-label="Search">
                        <Search size={16} strokeWidth={1.5} />
                      </Button>
                      <span className="ll:text-micro ll:text-secondary">Primary 32px</span>
                    </div>

                    <div className="ll:flex ll:flex-col ll:items-center ll:gap-1">
                      <Button variant="ghost" size="md" iconOnly aria-label="Settings">
                        <Settings size={16} strokeWidth={1.5} />
                      </Button>
                      <span className="ll:text-micro ll:text-secondary">Ghost 32px</span>
                    </div>
                  </div>
                </div>

                {/* Group 3: States Showcase */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    All States
                  </div>
                  <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:md:grid-cols-3 ll:gap-4">
                    {/* Default */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Default
                      </span>
                      <Button variant="secondary" size="md">
                        Default Action
                      </Button>
                    </div>

                    {/* Hover */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Hover (Instant on surface-panel)
                      </span>
                      <button
                        type="button"
                        className="ll:h-8 ll:px-3 ll:rounded-md ll:font-sans ll:font-medium ll:text-small ll:bg-surface-panel ll:border ll:border-border ll:text-primary ll:flex ll:items-center ll:justify-center"
                      >
                        Hovered State
                      </button>
                    </div>

                    {/* Focus-Visible */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Focus-Visible (2px Ring, 2px Offset)
                      </span>
                      <button
                        type="button"
                        className="ll:h-8 ll:px-3 ll:rounded-md ll:font-sans ll:font-medium ll:text-small ll:bg-surface-raised ll:border ll:border-border ll:text-primary ll:ring-2 ll:ring-primary ll:ring-offset-2 ll:flex ll:items-center ll:justify-center"
                      >
                        Focused Control
                      </button>
                    </div>

                    {/* Active */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Active (Pressed on surface-canvas)
                      </span>
                      <button
                        type="button"
                        className="ll:h-8 ll:px-3 ll:rounded-md ll:font-sans ll:font-medium ll:text-small ll:bg-surface-canvas ll:border ll:border-border ll:text-primary ll:flex ll:items-center ll:justify-center"
                      >
                        Active Pressed
                      </button>
                    </div>

                    {/* Disabled */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Disabled (Opacity 40%)
                      </span>
                      <Button variant="secondary" size="md" disabled>
                        Disabled Action
                      </Button>
                    </div>

                    {/* Loading */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Loading (1.5px Stroke Spinner)
                      </span>
                      <Button variant="secondary" size="md" loading>
                        Saving Project...
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SEGMENTED CONTROL COMPONENT */}
            {activeSection === "segmented-control" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    SegmentedControl
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Concentric Radii (6px Outer, 4px Inner), Radiogroup, Keyboard Nav
                  </span>
                </div>

                {/* Interactive live control */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Interactive Demonstration
                  </div>
                  <div className="ll:p-6 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-4">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-small ll:font-medium ll:text-secondary">
                        Selected Target: <strong className="ll:text-primary">{demoDevice}</strong>
                      </span>
                      <span className="ll:text-micro ll:text-secondary">Use arrow keys or click</span>
                    </div>

                    <div className="ll:flex ll:items-center ll:gap-4">
                      <SegmentedControl<DeviceMode>
                        value={demoDevice}
                        onChange={setDemoDevice}
                        size="md"
                        ariaLabel="Interactive Device Preview"
                        options={[
                          {
                            value: "desktop",
                            icon: <Monitor size={16} strokeWidth={1.5} />,
                            label: "Desktop",
                          },
                          {
                            value: "tablet",
                            icon: <Tablet size={16} strokeWidth={1.5} />,
                            label: "Tablet",
                          },
                          {
                            value: "mobile",
                            icon: <Smartphone size={16} strokeWidth={1.5} />,
                            label: "Mobile",
                          },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* Sizes and Variants */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Sizes &amp; Concentric Geometry
                  </div>
                  <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:gap-6">
                    {/* Medium (32px) */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-3">
                      <span className="ll:text-small ll:font-semibold ll:text-primary">
                        Medium Size (32px Container, 28px Inner)
                      </span>
                      <SegmentedControl<DeviceMode>
                        value="desktop"
                        onChange={() => {}}
                        size="md"
                        options={[
                          { value: "desktop", label: "Desktop" },
                          { value: "tablet", label: "Tablet" },
                          { value: "mobile", label: "Mobile" },
                        ]}
                      />
                    </div>

                    {/* Small (28px) */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-3">
                      <span className="ll:text-small ll:font-semibold ll:text-primary">
                        Small Size (28px Container, 24px Inner)
                      </span>
                      <SegmentedControl<DeviceMode>
                        value="desktop"
                        onChange={() => {}}
                        size="sm"
                        options={[
                          { value: "desktop", label: "Desktop" },
                          { value: "tablet", label: "Tablet" },
                          { value: "mobile", label: "Mobile" },
                        ]}
                      />
                    </div>

                    {/* Icon-Only */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-3">
                      <span className="ll:text-small ll:font-semibold ll:text-primary">
                        Icon-Only Mode (Below sm Viewport)
                      </span>
                      <SegmentedControl<DeviceMode>
                        value="desktop"
                        onChange={() => {}}
                        size="md"
                        options={[
                          { value: "desktop", icon: <Monitor size={16} strokeWidth={1.5} />, ariaLabel: "Desktop" },
                          { value: "tablet", icon: <Tablet size={16} strokeWidth={1.5} />, ariaLabel: "Tablet" },
                          { value: "mobile", icon: <Smartphone size={16} strokeWidth={1.5} />, ariaLabel: "Mobile" },
                        ]}
                      />
                    </div>

                    {/* Disabled State */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-3">
                      <span className="ll:text-small ll:font-semibold ll:text-primary">
                        Disabled State
                      </span>
                      <SegmentedControl<DeviceMode>
                        value="desktop"
                        onChange={() => {}}
                        size="md"
                        disabled
                        options={[
                          { value: "desktop", label: "Desktop" },
                          { value: "tablet", label: "Tablet" },
                          { value: "mobile", label: "Mobile" },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TOOLTIP COMPONENT */}
            {activeSection === "tooltip" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Tooltip
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Solid Inverted Rectangle, Micro Text, 4px Radius, 300ms Delay
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Interactive Hover &amp; Keyboard Focus
                  </div>
                  <div className="ll:p-8 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-wrap ll:items-center ll:gap-8">
                    <Tooltip content="Undo last change (Ctrl+Z)">
                      <Button variant="secondary" size="md" iconOnly aria-label="Undo action">
                        <Undo2 size={16} strokeWidth={1.5} />
                      </Button>
                    </Tooltip>

                    <Tooltip content="Redo action (Ctrl+Shift+Z)">
                      <Button variant="secondary" size="md" iconOnly aria-label="Redo action">
                        <Redo2 size={16} strokeWidth={1.5} />
                      </Button>
                    </Tooltip>

                    <Tooltip content="Search commands &amp; actions (Ctrl+K)">
                      <Button variant="secondary" size="md" iconOnly aria-label="Search actions">
                        <Search size={16} strokeWidth={1.5} />
                      </Button>
                    </Tooltip>

                    <Tooltip content="Configure project settings">
                      <Button variant="secondary" size="md" iconOnly aria-label="Settings">
                        <Settings size={16} strokeWidth={1.5} />
                      </Button>
                    </Tooltip>

                    <Tooltip content="Primary inverting action button">
                      <Button variant="primary" size="md">
                        Hover Me
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Static Visual Geometry
                  </div>
                  <div className="ll:p-8 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:items-center ll:justify-center">
                    <div className="ll:flex ll:flex-col ll:items-center ll:gap-2">
                      {/* Visible Tooltip Specimen */}
                      <div className="ll:px-2 ll:py-1 ll:bg-control-primary ll:text-control-primary-fg ll:rounded-sm ll:border ll:border-border ll:text-micro ll:font-medium ll:whitespace-nowrap ll:shadow-soft">
                        Tooltip: 4px radius, micro text, hairline border
                      </div>
                      <div className="ll:h-8 ll:px-3 ll:rounded-md ll:bg-surface-raised ll:border ll:border-border ll:text-small ll:font-medium ll:text-primary ll:flex ll:items-center ll:justify-center">
                        Target Control
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TOP BAR COMPONENT */}
            {activeSection === "top-bar" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    TopBar
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Master Shell Top Bar Specification &amp; Three Width Previews
                  </span>
                </div>

                {/* Desktop Preview (1440px) */}
                <div className="ll:flex ll:flex-col ll:gap-2">
                  <div className="ll:flex ll:items-center ll:justify-between">
                    <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                      Desktop Viewport Preview (1440px)
                    </span>
                    <span className="ll:font-mono ll:text-micro ll:text-secondary">1440 &times; 48</span>
                  </div>
                  <div className="ll:w-full ll:overflow-x-auto ll:rounded-md ll:border ll:border-border ll:shadow-soft">
                    <div className="ll:w-viewport-desktop">
                      <TopBar
                        projectName="Visual Web App"
                        deviceMode={topBarDevice}
                        onSelectDeviceMode={setTopBarDevice}
                        canUndo={true}
                        canRedo={false}
                      />
                    </div>
                  </div>
                </div>

                {/* Tablet Preview (1024px) */}
                <div className="ll:flex ll:flex-col ll:gap-2">
                  <div className="ll:flex ll:items-center ll:justify-between">
                    <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                      Tablet Viewport Preview (1024px)
                    </span>
                    <span className="ll:font-mono ll:text-micro ll:text-secondary">1024 &times; 48</span>
                  </div>
                  <div className="ll:w-full ll:overflow-x-auto ll:rounded-md ll:border ll:border-border ll:shadow-soft">
                    <div className="ll:w-viewport-tablet">
                      <TopBar
                        projectName="Visual Web App"
                        deviceMode={topBarDevice}
                        onSelectDeviceMode={setTopBarDevice}
                        canUndo={true}
                        canRedo={false}
                      />
                    </div>
                  </div>
                </div>

                {/* Mobile Preview (390px) */}
                <div className="ll:flex ll:flex-col ll:gap-2">
                  <div className="ll:flex ll:items-center ll:justify-between">
                    <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                      Mobile Viewport Preview (390px — Compact, No Overflow)
                    </span>
                    <span className="ll:font-mono ll:text-micro ll:text-secondary">390 &times; 48</span>
                  </div>
                  <div className="ll:w-viewport-mobile ll:max-w-full ll:rounded-md ll:border ll:border-border ll:shadow-soft ll:overflow-hidden">
                    <TopBar
                      compact={true}
                      projectName="Visual Web App"
                      deviceMode={topBarDevice}
                      onSelectDeviceMode={setTopBarDevice}
                      canUndo={true}
                      canRedo={false}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* THEME TOGGLE COMPONENT */}
            {activeSection === "theme-toggle" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    ThemeToggle
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Ghost Icon Button, Sun / Moon (Lucide), 16px Icon, Switch theme Tooltip
                  </span>
                </div>

                {/* Interactive demo */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Interactive Demonstration
                  </div>
                  <div className="ll:p-6 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:items-center ll:justify-between">
                    <div className="ll:flex ll:flex-col ll:gap-1">
                      <span className="ll:text-body ll:font-medium ll:text-primary">
                        Toggle Studio Theme
                      </span>
                      <span className="ll:text-small ll:text-secondary">
                        Stores choice in localStorage and updates data-theme attribute with zero flash
                      </span>
                    </div>
                    <div className="ll:flex ll:items-center ll:gap-4">
                      <ThemeToggle size="md" />
                      <ThemeToggle size="sm" />
                    </div>
                  </div>
                </div>

                {/* States showcase */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    States
                  </div>
                  <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-3 ll:gap-4">
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Default
                      </span>
                      <div className="ll:flex ll:items-center ll:gap-2">
                        <ThemeToggle size="md" />
                        <span className="ll:text-small ll:text-secondary">Click to switch</span>
                      </div>
                    </div>

                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Hover State
                      </span>
                      <button
                        type="button"
                        className="ll:h-8 ll:w-8 ll:rounded-md ll:bg-surface-panel ll:border-0 ll:text-primary ll:flex ll:items-center ll:justify-center"
                      >
                        <Sun size={16} strokeWidth={1.5} />
                      </button>
                    </div>

                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Focus-Visible State
                      </span>
                      <button
                        type="button"
                        className="ll:h-8 ll:w-8 ll:rounded-md ll:bg-transparent ll:border-0 ll:text-primary ll:ring-2 ll:ring-primary ll:ring-offset-2 ll:flex ll:items-center ll:justify-center"
                      >
                        <Moon size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "swatch" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Swatch
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Component Specification &amp; Variants
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Component Variants
                  </div>
                  <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-3 ll:gap-6">
                    <Swatch
                      role="Surface Swatch"
                      token="--ll-surface-canvas"
                      hex={liveTokens[activeTheme]?.["--ll-surface-canvas"] || "—"}
                      bgClass="ll:bg-surface-canvas"
                    />
                    <Swatch
                      role="Text Sample Variant"
                      token="--ll-text-secondary"
                      hex={liveTokens[activeTheme]?.["--ll-text-secondary"] || "—"}
                      sample={
                        <div className="ll:w-full ll:h-full ll:bg-surface-panel ll:p-4 ll:flex ll:items-center ll:justify-center">
                          <span className="ll:text-small ll:font-medium ll:text-secondary">
                            Sample on surface-panel
                          </span>
                        </div>
                      }
                    />
                    <Swatch
                      role="Line Sample Variant"
                      token="--ll-border-color"
                      hex={liveTokens[activeTheme]?.["--ll-border-color"] || "—"}
                      sample={
                        <div className="ll:w-full ll:h-full ll:bg-surface-canvas ll:p-4 ll:flex ll:flex-col ll:items-center ll:justify-center ll:gap-2">
                          <div className="ll:w-full ll:h-px ll:bg-border" />
                          <span className="ll:text-micro ll:text-secondary">
                            1px Hairline Divider
                          </span>
                          <div className="ll:w-full ll:h-px ll:bg-border" />
                        </div>
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "imported-squish-switch" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    SquishSwitch
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported as-is from React Bits
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Usage Example
                  </div>
                  <div className="ll:p-6 ll:rounded-lg ll:border ll:border-border ll:bg-surface-raised ll:flex ll:items-center ll:justify-center">
                    <SquishSwitchDemo />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "imported-scrub-field" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    ScrubField
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported as-is from React Bits
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Usage Example
                  </div>
                  <div className="ll:p-6 ll:rounded-lg ll:border ll:border-border ll:bg-surface-raised ll:flex ll:items-center ll:justify-center">
                    <ScrubFieldDemo />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "imported-elastic-slider" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    ElasticSlider
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported as-is from React Bits
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Usage Example
                  </div>
                  <div className="ll:p-6 ll:rounded-lg ll:border ll:border-border ll:bg-surface-raised ll:flex ll:items-center ll:justify-center">
                    <ElasticSliderDemo />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "imported-cursor" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Cursor
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported as-is from Animate UI
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Usage Example
                  </div>
                  <div className="ll:p-6 ll:rounded-lg ll:border ll:border-border ll:bg-surface-raised ll:flex ll:items-center ll:justify-center">
                    <CursorDemo />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "imported-avatar-group" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Avatar Group
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported as-is from Animate UI
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Usage Example
                  </div>
                  <div className="ll:p-6 ll:rounded-lg ll:border ll:border-border ll:bg-surface-raised ll:flex ll:items-center ll:justify-center">
                    <AvatarGroupDemo />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "imported-tooltip" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Tooltip (Imported)
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported as-is from Animate UI
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Usage Example
                  </div>
                  <div className="ll:p-6 ll:rounded-lg ll:border ll:border-border ll:bg-surface-raised ll:flex ll:items-center ll:justify-center">
                    <ImportedTooltipDemo />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "imported-select" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Select
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported as-is from Origin UI
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Usage Example
                  </div>
                  <div className="ll:p-6 ll:rounded-lg ll:border ll:border-border ll:bg-surface-raised ll:flex ll:items-center ll:justify-center">
                    <SelectDemo />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "imported-menubar" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Menubar
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported as-is from Radix UI
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Usage Example
                  </div>
                  <div className="ll:p-6 ll:rounded-lg ll:border ll:border-border ll:bg-surface-raised ll:flex ll:items-center ll:justify-center">
                    <MenubarDemo />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "imported-dropdown-menu" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Dropdown Menu
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported as-is from Radix UI
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Usage Example
                  </div>
                  <div className="ll:p-6 ll:rounded-lg ll:border ll:border-border ll:bg-surface-raised ll:flex ll:items-center ll:justify-center">
                    <DropdownMenuDemo />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "imported-context-menu" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Context Menu
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported as-is from Radix UI
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Usage Example
                  </div>
                  <div className="ll:p-6 ll:rounded-lg ll:border ll:border-border ll:bg-surface-raised ll:flex ll:items-center ll:justify-center">
                    <ContextMenuDemo />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "imported-scroll-fade" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    Scroll Fade
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported as-is from Fancy Components
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Usage Example
                  </div>
                  <div className="ll:p-6 ll:rounded-lg ll:border ll:border-border ll:bg-surface-raised ll:flex ll:items-center ll:justify-center">
                    <ScrollFadeDemo />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "imported-file-tree" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    File Tree
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Imported as-is from Unlumen UI
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Usage Example
                  </div>
                  <div className="ll:p-6 ll:rounded-lg ll:border ll:border-border ll:bg-surface-raised ll:flex ll:items-center ll:justify-center">
                    <FileTreeDemo />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "workspace-frame" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
                    WorkspaceFrame
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Component Specification &amp; Real Layers
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Interactive Studio Workspace Frame
                  </div>
                  <WorkspaceFrame />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
