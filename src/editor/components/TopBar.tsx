import React from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Search,
  Settings,
} from "lucide-react";
import { Button } from "./Button";
import { SegmentedControl, type SegmentedControlOption } from "./SegmentedControl";
import { Tooltip } from "./Tooltip";

export type DeviceMode = "desktop" | "tablet" | "mobile";

export interface TopBarProps {
  projectName?: string;
  deviceMode?: DeviceMode;
  onSelectDeviceMode?: (mode: DeviceMode) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onSearch?: () => void;
  className?: string;
  compact?: boolean;
}

export function TopBar({
  projectName = "Visual Web App",
  deviceMode = "desktop",
  onSelectDeviceMode,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onSearch,
  className = "",
  compact = false,
}: TopBarProps) {
  const deviceOptions: readonly SegmentedControlOption<DeviceMode>[] = [
    {
      value: "desktop",
      title: "Desktop Canvas (1440px)",
      ariaLabel: "Desktop view",
      icon: <Monitor size={16} strokeWidth={1.5} />,
      label: (
        <span className={compact ? "ll:hidden" : "ll:hidden ll:sm:inline"}>
          Desktop
        </span>
      ),
    },
    {
      value: "tablet",
      title: "Tablet Canvas (768px)",
      ariaLabel: "Tablet view",
      icon: <Tablet size={16} strokeWidth={1.5} />,
      label: (
        <span className={compact ? "ll:hidden" : "ll:hidden ll:sm:inline"}>
          Tablet
        </span>
      ),
    },
    {
      value: "mobile",
      title: "Mobile Canvas (375px)",
      ariaLabel: "Mobile view",
      icon: <Smartphone size={16} strokeWidth={1.5} />,
      label: (
        <span className={compact ? "ll:hidden" : "ll:hidden ll:sm:inline"}>
          Mobile
        </span>
      ),
    },
  ];

  return (
    <header
      role="banner"
      className={`ll:relative ll:h-12 ll:w-full ll:bg-neutral-50 ll:border-b ll:border-border ll:px-3 ll:flex ll:items-center ll:justify-between ll:gap-2 ll:shrink-0 ll:box-border ll:font-sans ll:select-none ${className}`}
    >
      {/* Left group */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:shrink-0 ll:z-10">
        {/* Small square logo mark (black rounded-rectangle 24px, radius 6px, white "L" in Geist bold) */}
        <div
          aria-label="Lazy Layout Logo"
          className="ll:w-6 ll:h-6 ll:rounded-md ll:bg-neutral-1000 ll:flex ll:items-center ll:justify-center ll:shrink-0"
        >
          <span className="ll:font-sans ll:font-bold ll:text-body ll:leading-none ll:text-neutral-0 ll:select-none">
            L
          </span>
        </div>

        {/* Brand title */}
        <span
          className={`ll:text-title ll:font-semibold ll:text-neutral-1000 ll:leading-none ${
            compact ? "ll:hidden" : "ll:hidden ll:sm:inline"
          }`}
        >
          Lazy Layout
        </span>

        {/* Hairline vertical divider */}
        <div
          className={`ll:h-4 ll:w-px ll:bg-border ${
            compact ? "ll:hidden" : "ll:hidden ll:sm:block"
          }`}
        />

        {/* Project name as a quiet text button */}
        <button
          type="button"
          title={`Project: ${projectName}`}
          className={`ll:text-small ll:font-medium ll:text-neutral-800 ll:hover:text-neutral-1000 ll:hover:bg-neutral-100 ll:px-2 ll:py-1 ll:rounded-sm ll:transition-none ll:focus-visible:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-neutral-1000 ll:truncate ll:max-w-48 ${
            compact ? "ll:hidden" : "ll:hidden ll:sm:inline-flex"
          }`}
        >
          {projectName}
        </button>
      </div>

      {/* Center group: truly centered on the bar */}
      <div className="ll:absolute ll:left-1/2 ll:-translate-x-1/2 ll:flex ll:items-center ll:justify-center ll:z-10">
        <SegmentedControl<DeviceMode>
          options={deviceOptions}
          value={deviceMode}
          onChange={(mode) => onSelectDeviceMode?.(mode)}
          size="md"
          ariaLabel="Device Preview Target"
        />
      </div>

      {/* Right group */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:shrink-0 ll:z-10">
        {/* Undo icon button */}
        <div className={compact ? "ll:hidden" : "ll:hidden ll:sm:inline-flex"}>
          <Tooltip content="Undo (Ctrl+Z)">
            <Button
              variant="secondary"
              size="md"
              iconOnly
              disabled={!canUndo}
              onClick={onUndo}
              aria-label="Undo"
            >
              <Undo2 size={16} strokeWidth={1.5} />
            </Button>
          </Tooltip>
        </div>

        {/* Redo icon button */}
        <div className={compact ? "ll:hidden" : "ll:hidden ll:sm:inline-flex"}>
          <Tooltip content="Redo (Ctrl+Shift+Z)">
            <Button
              variant="secondary"
              size="md"
              iconOnly
              disabled={!canRedo}
              onClick={onRedo}
              aria-label="Redo"
            >
              <Redo2 size={16} strokeWidth={1.5} />
            </Button>
          </Tooltip>
        </div>

        {/* Search icon button */}
        <div className={compact ? "ll:hidden" : "ll:hidden ll:sm:inline-flex"}>
          <Tooltip content="Search commands (Ctrl+K)">
            <Button
              variant="secondary"
              size="md"
              iconOnly
              onClick={onSearch}
              aria-label="Search commands"
            >
              <Search size={16} strokeWidth={1.5} />
            </Button>
          </Tooltip>
        </div>

        {/* Hairline vertical divider */}
        <div
          className={`ll:h-4 ll:w-px ll:bg-border ${
            compact ? "ll:hidden" : "ll:hidden ll:sm:block"
          }`}
        />

        {/* Share primary button */}
        <Button
          variant="primary"
          size="md"
          aria-label="Share project"
        >
          Share
        </Button>

        {/* Settings icon button */}
        <Tooltip content="Project settings">
          <Button
            variant="secondary"
            size="md"
            iconOnly
            aria-label="Settings"
          >
            <Settings size={16} strokeWidth={1.5} />
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}
