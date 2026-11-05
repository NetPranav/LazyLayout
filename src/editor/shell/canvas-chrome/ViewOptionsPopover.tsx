"use client";

import React, { useRef, useEffect, useState, useId } from "react";
import { Focus, Globe } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { Toggle } from "@/editor/components/Toggle";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { TextField } from "@/editor/components/TextField";
import { surf, type Surf } from "@/editor/motion/surface";
import { MENU_FALLBACKS, MOT } from "@/editor/motion/presets";
import { prefersReducedMotion } from "@/editor/motion/feel";
import { CANVAS_CHROME_SIZES } from "./constants";
import type { GridStyle, MotionFeel } from "./types";

export interface ViewOptionsPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;

  // Grid
  gridStyle?: GridStyle;
  onGridStyleChange?: (style: GridStyle) => void;
  gridSize?: number;
  onGridSizeChange?: (size: number) => void;

  // View toggles
  snapObjects?: boolean;
  onToggleSnapObjects?: (snap: boolean) => void;
  snapGuides?: boolean;
  onToggleSnapGuides?: (snap: boolean) => void;
  showRulers?: boolean;
  onToggleRulers?: (show: boolean) => void;
  pixelGrid?: boolean;
  onTogglePixelGrid?: (pixelGrid: boolean) => void;
  checkerboard?: boolean;
  onToggleCheckerboard?: (checkerboard: boolean) => void;

  // Appearance & Motion Feel
  theme?: string;
  onThemeChange?: (theme: string) => void;
  motionFeel?: MotionFeel;
  onMotionFeelChange?: (feel: MotionFeel) => void;
  dropdownBulge?: number;
  onDropdownBulgeChange?: (bulge: number) => void;

  // Canvas
  inspectMode?: boolean;
  onToggleInspectMode?: (inspect: boolean) => void;
  canvasPan?: boolean;
  onToggleCanvasPan?: (pan: boolean) => void;
  canvasZoom?: boolean;
  onToggleCanvasZoom?: (zoom: boolean) => void;
  worldAxes?: boolean;
  onToggleWorldAxes?: (axes: boolean) => void;
  elementDragging?: boolean;
  onToggleElementDragging?: (drag: boolean) => void;
  reparenting?: boolean;
  onToggleReparenting?: (reparent: boolean) => void;

  // Collision & Marquee
  collisionMode?: "pass" | "push";
  onCollisionModeChange?: (mode: "pass" | "push") => void;
  marqueeMode?: "intersects" | "encloses";
  onMarqueeModeChange?: (mode: "intersects" | "encloses") => void;

  // Snapping
  snapToGrid?: boolean;
  onToggleSnapToGrid?: (snap: boolean) => void;
  smartGuides?: boolean;
  onToggleSmartGuides?: (smart: boolean) => void;
  snapThreshold?: number;
  onSnapThresholdChange?: (threshold: number) => void;

  // Actions
  onFocusSelection?: () => void;
  onOpenWorldEnvironment?: () => void;
}

const LIGHT_THEMES = ["paper", "white", "warm", "lilac"] as const;
const DARK_THEMES = ["noir", "dark", "graphite", "darkroom"] as const;
const OFFICIAL_THEMES = [...LIGHT_THEMES, ...DARK_THEMES] as const;

export const ViewOptionsPopover: React.FC<ViewOptionsPopoverProps> = ({
  open,
  onClose,
  triggerRef,
  gridStyle = "dots",
  onGridStyleChange,
  gridSize = 24,
  onGridSizeChange,
  snapObjects = true,
  onToggleSnapObjects,
  snapGuides = false,
  onToggleSnapGuides,
  showRulers = false,
  onToggleRulers,
  pixelGrid = false,
  onTogglePixelGrid,
  checkerboard = false,
  onToggleCheckerboard,
  theme = "paper",
  onThemeChange,
  motionFeel = "bouncy",
  onMotionFeelChange,
  dropdownBulge = 50,
  onDropdownBulgeChange,
  inspectMode = false,
  onToggleInspectMode,
  canvasPan = true,
  onToggleCanvasPan,
  canvasZoom = true,
  onToggleCanvasZoom,
  worldAxes = true,
  onToggleWorldAxes,
  elementDragging = true,
  onToggleElementDragging,
  reparenting = true,
  onToggleReparenting,
  collisionMode = "pass",
  onCollisionModeChange,
  marqueeMode = "intersects",
  onMarqueeModeChange,
  snapToGrid = true,
  onToggleSnapToGrid,
  smartGuides = true,
  onToggleSmartGuides,
  snapThreshold = 6,
  onSnapThresholdChange,
  onFocusSelection,
  onOpenWorldEnvironment,
}) => {
  const [isRendered, setIsRendered] = useState<boolean>(open);
  const [prevOpen, setPrevOpen] = useState<boolean>(open);

  const popRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<Surf | null>(null);

  const gridSizeId = useId();
  const dropdownBulgeId = useId();

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsRendered(true);
    }
  }

  // Initialize Surf instance on mount
  useEffect(() => {
    if (!isRendered || !popRef.current) return;
    const s = surf(popRef.current);
    surfRef.current = s;

    return () => {
      s.reset();
    };
  }, [isRendered]);

  // Open and close animations using Surf spring physics
  useEffect(() => {
    if (!isRendered) return;
    const s = surfRef.current;
    const popEl = popRef.current;
    if (!s || !popEl) return;

    if (open) {
      const triggerEl = triggerRef?.current;
      let seed = { ...MENU_FALLBACKS.surfaceSeedDefault };
      if (triggerEl) {
        const r = triggerEl.getBoundingClientRect();
        seed = {
          w: Math.round(r.width),
          h: Math.round(r.height),
          r:
            parseFloat(getComputedStyle(triggerEl).borderRadius) ||
            MENU_FALLBACKS.menuRadius,
        };
      }

      s.open({
        from: seed,
        up: false,
      });
    } else {
      s.leave();
      const exitDuration = prefersReducedMotion()
        ? MENU_FALLBACKS.reducedMotionDuration
        : MOT.exitMs;
      const t = setTimeout(() => {
        setIsRendered(false);
      }, exitDuration);
      return () => clearTimeout(t);
    }
  }, [open, isRendered, triggerRef]);

  // Outside click & Escape handler
  useEffect(() => {
    if (!open || !isRendered) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        if (triggerRef?.current && triggerRef.current.contains(e.target as Node))
          return;
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        triggerRef?.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isRendered, onClose, triggerRef]);

  if (!isRendered) return null;

  const validTheme = (OFFICIAL_THEMES as readonly string[]).includes(theme) ? theme : "paper";

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label="View options"
      tabIndex={-1}
      style={{
        width: "var(--ll-size-vpop-w, 280px)",
        top: "var(--ll-spacing-2)",
        left: "var(--ll-spacing-2)",
        maxHeight: "calc(100% - var(--ll-spacing-6))",
      }}
      className="ll-vpop ll:absolute ll:z-30 ll:flex ll:flex-col ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:py-1 ll:overflow-y-auto ll:overscroll-contain ll:outline-none"
    >
      <div className="ll-lay ll:flex ll:flex-col ll:w-full">
        {/* Quick Actions using design system Button */}
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Icon icon={Focus} size={CANVAS_CHROME_SIZES.iconMd} />}
          onClick={() => {
            onFocusSelection?.();
            onClose();
          }}
          className="ll-vact ll:w-full ll:justify-start ll:h-8 ll:px-3 ll:text-small"
        >
          Focus selection
        </Button>

        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Icon icon={Globe} size={CANVAS_CHROME_SIZES.iconMd} />}
          onClick={() => {
            onOpenWorldEnvironment?.();
            onClose();
          }}
          className="ll-vact ll:w-full ll:justify-start ll:h-8 ll:px-3 ll:text-small"
        >
          World environment
        </Button>

        <div className="ll:h-px ll:bg-border ll:my-1" aria-hidden="true" />

        {/* Grid Style */}
        <div className="ll:px-3 ll:pt-2 ll:pb-1 ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
          Grid style
        </div>
        <div className="ll:px-3 ll:pb-2">
          <SegmentedControl
            size="sm"
            value={gridStyle}
            onChange={(v) => onGridStyleChange?.(v as GridStyle)}
            options={[
              { value: "dots", label: "Dots" },
              { value: "lines", label: "Lines" },
              { value: "none", label: "None" },
            ]}
          />
        </div>

        {/* Grid Size Slider */}
        <div className="ll:px-3 ll:pb-2 ll:flex ll:flex-col ll:gap-1">
          <div className="ll:flex ll:items-center ll:justify-between ll:text-nano ll:font-mono ll:text-muted">
            <label
              htmlFor={gridSizeId}
              className="ll:uppercase ll:tracking-wider ll:cursor-pointer"
            >
              Grid size
            </label>
            <span className="ll:text-primary">{gridSize}px</span>
          </div>
          <input
            type="range"
            id={gridSizeId}
            min={8}
            max={48}
            step={1}
            value={gridSize}
            onChange={(e) => onGridSizeChange?.(Number(e.target.value))}
            aria-label="Grid size"
            style={{ accentColor: "var(--ll-control-primary-bg)" }}
            className="ll:w-full ll:cursor-pointer ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
          />
        </div>

        {/* View Toggles */}
        <div className="ll:flex ll:flex-col ll:gap-0.5 ll:py-1">
          <div className="ll:px-3 ll:py-1">
            <Toggle
              size="sm"
              label="Snap objects"
              checked={snapObjects}
              onChange={(c) => onToggleSnapObjects?.(c)}
            />
          </div>
          <div className="ll:px-3 ll:py-1">
            <Toggle
              size="sm"
              label="Snap guides"
              checked={snapGuides}
              onChange={(c) => onToggleSnapGuides?.(c)}
            />
          </div>
          <div className="ll:px-3 ll:py-1">
            <Toggle
              size="sm"
              label="Rulers"
              checked={showRulers}
              onChange={(c) => onToggleRulers?.(c)}
            />
          </div>
          <div className="ll:px-3 ll:py-1">
            <Toggle
              size="sm"
              label="Pixel grid"
              checked={pixelGrid}
              onChange={(c) => onTogglePixelGrid?.(c)}
            />
          </div>
          <div className="ll:px-3 ll:py-1">
            <Toggle
              size="sm"
              label="Checkerboard"
              checked={checkerboard}
              onChange={(c) => onToggleCheckerboard?.(c)}
            />
          </div>
        </div>

        <div className="ll:h-px ll:bg-border ll:my-1" aria-hidden="true" />

        {/* Appearance (All eight themes from PALETTE.md: Light and Dark) */}
        <div className="thgrp ll:px-3 ll:pt-2 ll:pb-2 ll:flex ll:flex-col ll:gap-1.5" id="themeseg">
          <div className="vgrp micro ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
            Light
          </div>
          <SegmentedControl
            size="sm"
            value={LIGHT_THEMES.includes(validTheme as any) ? validTheme : ""}
            onChange={(v) => onThemeChange?.(v)}
            options={[
              { value: "paper", label: "Paper" },
              { value: "white", label: "White" },
              { value: "warm", label: "Warm" },
              { value: "lilac", label: "Lilac" },
            ]}
          />
          <div className="vgrp micro ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
            Dark
          </div>
          <SegmentedControl
            size="sm"
            value={DARK_THEMES.includes(validTheme as any) ? validTheme : ""}
            onChange={(v) => onThemeChange?.(v)}
            options={[
              { value: "noir", label: "Noir" },
              { value: "dark", label: "Dark" },
              { value: "graphite", label: "Graphite" },
              { value: "darkroom", label: "Darkroom" },
            ]}
          />
        </div>

        {/* Motion Feel */}
        <div className="ll:px-3 ll:pt-2 ll:pb-1 ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
          Motion feel
        </div>
        <div className="ll:px-3 ll:pb-2">
          <SegmentedControl
            size="sm"
            value={motionFeel}
            onChange={(v) => onMotionFeelChange?.(v as MotionFeel)}
            options={[
              { value: "smooth", label: "Smooth" },
              { value: "lively", label: "Lively" },
              { value: "bouncy", label: "Bouncy" },
            ]}
          />
        </div>

        {/* Dropdown Bulge Slider */}
        <div className="ll:px-3 ll:pb-2 ll:flex ll:flex-col ll:gap-1">
          <div className="ll:flex ll:items-center ll:justify-between ll:text-nano ll:font-mono ll:text-muted">
            <label
              htmlFor={dropdownBulgeId}
              className="ll:uppercase ll:tracking-wider ll:cursor-pointer"
            >
              Dropdown bulge
            </label>
            <span className="ll:text-primary">{dropdownBulge}%</span>
          </div>
          <input
            type="range"
            id={dropdownBulgeId}
            min={0}
            max={100}
            step={5}
            value={dropdownBulge}
            onChange={(e) => onDropdownBulgeChange?.(Number(e.target.value))}
            aria-label="Dropdown bulge strength"
            style={{ accentColor: "var(--ll-control-primary-bg)" }}
            className="ll:w-full ll:cursor-pointer ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
          />
        </div>

        <div className="ll:h-px ll:bg-border ll:my-1" aria-hidden="true" />

        {/* Canvas Section */}
        <div className="ll:px-3 ll:pt-2 ll:pb-1 ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
          Canvas
        </div>
        <div className="ll:flex ll:flex-col ll:gap-0.5 ll:py-1">
          <div className="ll:px-3 ll:py-1">
            <Toggle
              size="sm"
              label="Inspect mode"
              checked={inspectMode}
              onChange={(c) => onToggleInspectMode?.(c)}
            />
          </div>
          <div className="ll:px-3 ll:py-1">
            <Toggle
              size="sm"
              label="Canvas pan"
              checked={canvasPan}
              onChange={(c) => onToggleCanvasPan?.(c)}
            />
          </div>
          <div className="ll:px-3 ll:py-1">
            <Toggle
              size="sm"
              label="Canvas zoom"
              checked={canvasZoom}
              onChange={(c) => onToggleCanvasZoom?.(c)}
            />
          </div>
          <div className="ll:px-3 ll:py-1">
            <Toggle
              size="sm"
              label="World axes"
              checked={worldAxes}
              onChange={(c) => onToggleWorldAxes?.(c)}
            />
          </div>
          <div className="ll:px-3 ll:py-1">
            <Toggle
              size="sm"
              label="Dragging"
              checked={elementDragging}
              onChange={(c) => onToggleElementDragging?.(c)}
            />
          </div>
          <div className="ll:px-3 ll:py-1">
            <Toggle
              size="sm"
              label="Reparenting"
              checked={reparenting}
              onChange={(c) => onToggleReparenting?.(c)}
            />
          </div>
        </div>

        {/* Collision */}
        <div className="ll:px-3 ll:pt-2 ll:pb-1 ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
          Collision
        </div>
        <div className="ll:px-3 ll:pb-2">
          <SegmentedControl
            size="sm"
            value={collisionMode}
            onChange={(v) => onCollisionModeChange?.(v as "pass" | "push")}
            options={[
              { value: "pass", label: "Pass Through" },
              { value: "push", label: "Smart Push" },
            ]}
          />
        </div>

        {/* Marquee */}
        <div className="ll:px-3 ll:pt-2 ll:pb-1 ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
          Marquee
        </div>
        <div className="ll:px-3 ll:pb-2">
          <SegmentedControl
            size="sm"
            value={marqueeMode}
            onChange={(v) =>
              onMarqueeModeChange?.(v as "intersects" | "encloses")
            }
            options={[
              { value: "intersects", label: "Intersects" },
              { value: "encloses", label: "Encloses" },
            ]}
          />
        </div>

        {/* Snapping */}
        <div className="ll:px-3 ll:pt-2 ll:pb-1 ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
          Snapping
        </div>
        <div className="ll:flex ll:flex-col ll:gap-0.5 ll:py-1">
          <div className="ll:px-3 ll:py-1">
            <Toggle
              size="sm"
              label="Snap to grid"
              checked={snapToGrid}
              onChange={(c) => onToggleSnapToGrid?.(c)}
            />
          </div>
          <div className="ll:px-3 ll:py-1">
            <Toggle
              size="sm"
              label="Smart guides"
              checked={smartGuides}
              onChange={(c) => onToggleSmartGuides?.(c)}
            />
          </div>
          <div className="ll:px-3 ll:pt-1.5 ll:pb-2">
            <TextField
              size="sm"
              prefixLabel="PX"
              mono
              type="number"
              value={snapThreshold}
              onChange={(e) => onSnapThresholdChange?.(Number(e.target.value))}
              aria-label="Snap threshold"
            />
          </div>
        </div>
      </div>
    </div>
  );
};