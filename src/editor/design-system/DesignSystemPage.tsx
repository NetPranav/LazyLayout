"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Swatch, type SwatchProps } from "../components/Swatch";
import { WorkspaceFrame } from "../components/WorkspaceFrame";
import { Button } from "../components/Button";
import { SegmentedControl, type SegmentedControlOption } from "../components/SegmentedControl";
import { Tooltip } from "../components/Tooltip";
import { TopBar, type DeviceMode } from "../components/TopBar";
import { ThemeToggle } from "../components/ThemeToggle";

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
} from "lucide-react";

type NavSectionId =
  | "colors"
  | "type"
  | "spacing"
  | "radii"
  | "shadows"
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

interface SemanticRoleSpec {
  role: string;
  token: string;
  darkHex: string;
  lightHex: string;
  swatchClass: string;
  description: string;
}

const SEMANTIC_ROLES: readonly SemanticRoleSpec[] = [
  {
    role: "Backdrop",
    token: "--ll-surface-backdrop",
    darkHex: "#141414",
    lightHex: "#8F8F8F",
    swatchClass: "ll:bg-surface-backdrop ll:text-primary",
    description: "Outside the app container frame",
  },
  {
    role: "Canvas",
    token: "--ll-surface-canvas",
    darkHex: "#1E1E1E",
    lightHex: "#DFDFDF",
    swatchClass: "ll:bg-surface-canvas ll:text-primary",
    description: "Main workspace and editing surface background",
  },
  {
    role: "Panels and side rails",
    token: "--ll-surface-panel",
    darkHex: "#2C2C2C",
    lightHex: "#C4C4C4",
    swatchClass: "ll:bg-surface-panel ll:text-primary",
    description: "Navigation sidebar, inspector panel, tool rails",
  },
  {
    role: "Top bar & toolbar",
    token: "--ll-surface-bar",
    darkHex: "#383838",
    lightHex: "#F1F1F1",
    swatchClass: "ll:bg-surface-bar ll:text-primary",
    description: "Top bar, dock headers, selected and hover rows",
  },
  {
    role: "Raised surfaces",
    token: "--ll-surface-raised",
    darkHex: "#383838",
    lightHex: "#FFFFFF",
    swatchClass: "ll:bg-surface-raised ll:text-primary",
    description: "Cards, menus, popovers, secondary buttons, inputs",
  },
  {
    role: "Hairline border",
    token: "--ll-border-color",
    darkHex: "#444444",
    lightHex: "rgba(143, 143, 143, 0.5)",
    swatchClass: "ll:bg-surface-canvas ll:text-primary",
    description: "1px structural separators between layered panels",
  },
  {
    role: "Primary text",
    token: "--ll-text-primary",
    darkHex: "#FFFFFF",
    lightHex: "#000000",
    swatchClass: "ll:bg-surface-panel ll:text-primary",
    description: "Headings, titles, active labels, body text",
  },
  {
    role: "Secondary text",
    token: "--ll-text-secondary",
    darkHex: "#BFBFBF",
    lightHex: "#464646",
    swatchClass: "ll:bg-surface-panel ll:text-secondary",
    description: "Subheadings, descriptions, quiet buttons, metadata",
  },
  {
    role: "Muted icons",
    token: "--ll-text-muted",
    darkHex: "#A1A1A1",
    lightHex: "#464646",
    swatchClass: "ll:bg-surface-panel ll:text-muted",
    description: "Inactive icon buttons, subtle tool glyphs",
  },
  {
    role: "Primary control background",
    token: "--ll-control-primary-bg",
    darkHex: "#FFFFFF",
    lightHex: "#000000",
    swatchClass: "ll:bg-control-primary ll:text-control-primary-fg",
    description: "Inverts with theme: white in dark, black in light",
  },
  {
    role: "Primary control text",
    token: "--ll-control-primary-fg",
    darkHex: "#1E1E1E",
    lightHex: "#FFFFFF",
    swatchClass: "ll:bg-control-primary ll:text-control-primary-fg",
    description: "Near-black in dark, crisp white in light",
  },
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
  const [radius, setRadius] = useState(24);
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
        {/* Mobile & Tablet Nav Header / Desktop Right Panel (fixed 320px) */}
        <aside className="ll:w-full ll:xl:w-80 ll:xl:h-full ll:bg-surface-panel ll:xl:order-last ll:border-b ll:xl:border-b-0 ll:xl:border-l ll:border-border ll:flex ll:flex-col ll:shrink-0 ll:overflow-y-auto">
          {/* Header with ThemeToggle */}
          <div className="ll:p-4 ll:border-b ll:border-border ll:flex ll:items-center ll:justify-between ll:gap-2">
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
                    Dark Theme First (Primary) &amp; Light Theme (Secondary) Dual-Column Roles
                  </span>
                </div>

                {/* Real workspace layer stack in current theme */}
                <div className="ll:flex ll:flex-col ll:gap-2">
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                    Workspace Preview (Current Active Theme)
                  </span>
                  <WorkspaceFrame />
                </div>

                {/* Dual-Theme Comparison Table / Cards */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Semantic Tokens &amp; Dual-Theme Comparison
                  </div>

                  <div className="ll:flex ll:flex-col ll:gap-4">
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

                        {/* Dual Column Swatches */}
                        <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:gap-4 ll:pt-2">
                          {/* Dark Theme Column */}
                          <div
                            data-theme="dark"
                            className={`ll:rounded-md ll:border ll:border-border ll:p-3 ll:flex ll:flex-col ll:gap-2 ${spec.swatchClass}`}
                          >
                            <div className="ll:flex ll:items-center ll:justify-between">
                              <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider">
                                Dark (Default)
                              </span>
                              <span className="ll:font-mono ll:text-micro ll:opacity-90">
                                {spec.darkHex}
                              </span>
                            </div>
                            <span className="ll:text-small ll:font-medium">
                              Sample text preview
                            </span>
                          </div>

                          {/* Light Theme Column */}
                          <div
                            data-theme="light"
                            className={`ll:rounded-md ll:border ll:border-border ll:p-3 ll:flex ll:flex-col ll:gap-2 ${spec.swatchClass}`}
                          >
                            <div className="ll:flex ll:items-center ll:justify-between">
                              <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider">
                                Light
                              </span>
                              <span className="ll:font-mono ll:text-micro ll:opacity-90">
                                {spec.lightHex}
                              </span>
                            </div>
                            <span className="ll:text-small ll:font-medium">
                              Sample text preview
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Surface Contrast Ratios Section (WCAG AA >= 4.5:1) */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary"
                  >
                    Figma-Derived Surface Text &amp; Contrast Ratios
                  </div>

                  <div className="ll:grid ll:grid-cols-1 ll:gap-6">
                    {/* Surface 1: Canvas */}
                    <div className="ll:rounded-md ll:border ll:border-border ll:overflow-hidden ll:bg-surface-bar ll:p-4 ll:flex ll:flex-col ll:gap-3">
                      <div className="ll:flex ll:items-center ll:justify-between">
                        <span className="ll:text-body ll:font-semibold ll:text-primary">
                          Surface Canvas (--ll-surface-canvas)
                        </span>
                        <span className="ll:text-micro ll:font-semibold ll:text-secondary ll:uppercase">
                          WCAG AAA Compliant
                        </span>
                      </div>
                      <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:gap-4">
                        {/* Dark Canvas */}
                        <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-[#1E1E1E] ll:flex ll:flex-col ll:gap-2">
                          <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-[#BFBFBF]">
                            Dark Canvas (#1E1E1E)
                          </span>
                          <span className="ll:text-body ll:font-semibold ll:text-[#FFFFFF]">
                            Primary Text (#FFFFFF)
                          </span>
                          <span className="ll:text-small ll:text-[#BFBFBF]">
                            Secondary Text (#BFBFBF)
                          </span>
                          <div className="ll:h-px ll:w-full ll:bg-[#444444] ll:my-1" />
                          <span className="ll:font-mono ll:text-micro ll:text-[#BFBFBF]">
                            Primary: 16.1:1 ratio · Secondary: 9.0:1 ratio
                          </span>
                        </div>
                        {/* Light Canvas */}
                        <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-[#DFDFDF] ll:flex ll:flex-col ll:gap-2">
                          <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-[#464646]">
                            Light Canvas (#DFDFDF)
                          </span>
                          <span className="ll:text-body ll:font-semibold ll:text-[#000000]">
                            Primary Text (#000000)
                          </span>
                          <span className="ll:text-small ll:text-[#464646]">
                            Secondary Text (#464646)
                          </span>
                          <div className="ll:h-px ll:w-full ll:bg-[#8F8F8F] ll:opacity-50 ll:my-1" />
                          <span className="ll:font-mono ll:text-micro ll:text-[#464646]">
                            Primary: 15.3:1 ratio · Secondary: 6.1:1 ratio
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Surface 2: Panels */}
                    <div className="ll:rounded-md ll:border ll:border-border ll:overflow-hidden ll:bg-surface-bar ll:p-4 ll:flex ll:flex-col ll:gap-3">
                      <div className="ll:flex ll:items-center ll:justify-between">
                        <span className="ll:text-body ll:font-semibold ll:text-primary">
                          Surface Panels &amp; Rails (--ll-surface-panel)
                        </span>
                        <span className="ll:text-micro ll:font-semibold ll:text-secondary ll:uppercase">
                          WCAG AA/AAA Compliant
                        </span>
                      </div>
                      <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:gap-4">
                        {/* Dark Panel */}
                        <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-[#2C2C2C] ll:flex ll:flex-col ll:gap-2">
                          <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-[#BFBFBF]">
                            Dark Panel (#2C2C2C)
                          </span>
                          <span className="ll:text-body ll:font-semibold ll:text-[#FFFFFF]">
                            Primary Text (#FFFFFF)
                          </span>
                          <span className="ll:text-small ll:text-[#BFBFBF]">
                            Secondary Text (#BFBFBF)
                          </span>
                          <div className="ll:h-px ll:w-full ll:bg-[#444444] ll:my-1" />
                          <span className="ll:font-mono ll:text-micro ll:text-[#BFBFBF]">
                            Primary: 13.0:1 ratio · Secondary: 7.3:1 ratio
                          </span>
                        </div>
                        {/* Light Panel */}
                        <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-[#C4C4C4] ll:flex ll:flex-col ll:gap-2">
                          <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-[#464646]">
                            Light Panel (#C4C4C4)
                          </span>
                          <span className="ll:text-body ll:font-semibold ll:text-[#000000]">
                            Primary Text (#000000)
                          </span>
                          <span className="ll:text-small ll:text-[#464646]">
                            Secondary Text (#464646)
                          </span>
                          <div className="ll:h-px ll:w-full ll:bg-[#8F8F8F] ll:opacity-50 ll:my-1" />
                          <span className="ll:font-mono ll:text-micro ll:text-[#464646]">
                            Primary: 11.9:1 ratio · Secondary: 4.7:1 ratio
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Surface 3: Bars & Raised */}
                    <div className="ll:rounded-md ll:border ll:border-border ll:overflow-hidden ll:bg-surface-bar ll:p-4 ll:flex ll:flex-col ll:gap-3">
                      <div className="ll:flex ll:items-center ll:justify-between">
                        <span className="ll:text-body ll:font-semibold ll:text-primary">
                          Surface Bars &amp; Raised (--ll-surface-bar / --ll-surface-raised)
                        </span>
                        <span className="ll:text-micro ll:font-semibold ll:text-secondary ll:uppercase">
                          WCAG AAA Compliant
                        </span>
                      </div>
                      <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:gap-4">
                        {/* Dark Bar & Raised */}
                        <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-[#383838] ll:flex ll:flex-col ll:gap-2">
                          <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-[#BFBFBF]">
                            Dark Bar/Raised (#383838)
                          </span>
                          <span className="ll:text-body ll:font-semibold ll:text-[#FFFFFF]">
                            Primary Text (#FFFFFF)
                          </span>
                          <span className="ll:text-small ll:text-[#BFBFBF]">
                            Secondary Text (#BFBFBF)
                          </span>
                          <div className="ll:h-px ll:w-full ll:bg-[#444444] ll:my-1" />
                          <span className="ll:font-mono ll:text-micro ll:text-[#BFBFBF]">
                            Primary: 10.7:1 ratio · Secondary: 6.0:1 ratio
                          </span>
                        </div>
                        {/* Light Bar / Raised */}
                        <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-[#FFFFFF] ll:flex ll:flex-col ll:gap-2">
                          <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-[#464646]">
                            Light Raised (#FFFFFF)
                          </span>
                          <span className="ll:text-body ll:font-semibold ll:text-[#000000]">
                            Primary Text (#000000)
                          </span>
                          <span className="ll:text-small ll:text-[#464646]">
                            Secondary Text (#464646)
                          </span>
                          <div className="ll:h-px ll:w-full ll:bg-[#8F8F8F] ll:opacity-50 ll:my-1" />
                          <span className="ll:font-mono ll:text-micro ll:text-[#464646]">
                            Bar: 18.2:1 / 7.2:1 · Raised: 21.0:1 / 8.3:1
                          </span>
                        </div>
                      </div>
                    </div>
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
                </div>

                <div className="ll:flex ll:flex-col">
                  <div className="ll:border-b ll:border-border ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Display — 28px / Bold / Tracking -0.025em
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-secondary">
                        --ll-text-display
                      </span>
                    </div>
                    <div className="ll:text-display ll:font-bold ll:text-primary">
                      Motion Design Studio
                    </div>
                  </div>

                  <div className="ll:border-b ll:border-border ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Title — 18px / Semibold / Tracking -0.015em
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-secondary">
                        --ll-text-title
                      </span>
                    </div>
                    <div className="ll:text-title ll:font-semibold ll:text-primary">
                      Apple-level craft and motion choreography
                    </div>
                  </div>

                  <div className="ll:border-b ll:border-border ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                        Body — 14px / Regular / Tracking -0.005em
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
                        Small — 12px / Regular
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
                        Micro Label — 10px / Semibold / Uppercase / Tracking 0.06em
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-secondary">
                        --ll-text-micro
                      </span>
                    </div>
                    <div className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-primary">
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
                      const canvas = &quot;--ll-surface-canvas&quot;; // #1E1E1E (dark) / #DFDFDF (light)
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
                </div>
                <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-3 ll:gap-6">
                  <div className="ll:h-28 ll:rounded-sm ll:bg-surface-panel ll:border ll:border-border ll:p-4 ll:flex ll:flex-col ll:justify-between">
                    <span className="ll:text-body ll:font-medium ll:text-primary">Small (4px)</span>
                    <span className="ll:font-mono ll:text-small ll:text-secondary">--ll-radius-sm</span>
                  </div>
                  <div className="ll:h-28 ll:rounded-md ll:bg-surface-panel ll:border ll:border-border ll:p-4 ll:flex ll:flex-col ll:justify-between">
                    <span className="ll:text-body ll:font-medium ll:text-primary">Medium (6px)</span>
                    <span className="ll:font-mono ll:text-small ll:text-secondary">--ll-radius-md</span>
                  </div>
                  <div className="ll:h-28 ll:rounded-lg ll:bg-surface-panel ll:border ll:border-border ll:p-4 ll:flex ll:flex-col ll:justify-between">
                    <span className="ll:text-body ll:font-medium ll:text-primary">Large (8px)</span>
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
                </div>
                <div className="ll:py-4">
                  <div className="ll:p-8 ll:rounded-lg ll:bg-surface-raised ll:border ll:border-border ll:shadow-soft">
                    <div className="ll:text-body ll:font-semibold ll:text-primary">
                      Soft Shadow (Adaptive Theme Alpha)
                    </div>
                    <div className="ll:font-mono ll:text-small ll:text-secondary">
                      --ll-shadow-soft
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                    <div className="ll:w-[1440px]">
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
                    <div className="ll:w-[1024px]">
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
                  <div className="ll:w-[390px] ll:max-w-full ll:rounded-md ll:border ll:border-border ll:shadow-soft ll:overflow-hidden">
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
                      hex="#1E1E1E (dark) / #DFDFDF (light)"
                      bgClass="ll:bg-surface-canvas"
                    />
                    <Swatch
                      role="Text Sample Variant"
                      token="--ll-text-secondary"
                      hex="#BFBFBF (dark) / #464646 (light)"
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
                      hex="#444444 (dark) / 50% #8F8F8F (light)"
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
