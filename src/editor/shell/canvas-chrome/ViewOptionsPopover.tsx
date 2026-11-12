"use client";

import React, { useRef, useEffect, useState } from "react";
import { Focus, Globe } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Slider } from "@/editor/components/Slider";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { NumberField } from "@/editor/components/NumberField";
import { surf, hlMove, hlHide, type Surf } from "@/editor/motion/surface";
import { MENU_FALLBACKS, MOT } from "@/editor/motion/presets";
import { getActivePreset, prefersReducedMotion } from "@/editor/motion/feel";
import { springAnim } from "@/editor/motion/ease";
import { useViewportStore, type KeymapId } from "@/core/render/scene3d/viewportStore";
import type { GridStyle, MotionFeel } from "./types";

export interface ViewOptionsPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  position?: { x: number; y: number } | null;
  inline?: boolean;

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
  keymapId?: KeymapId;
  onKeymapIdChange?: (id: KeymapId) => void;

  // Canvas
  inspectMode?: boolean;
  onToggleInspectMode?: (inspect: boolean) => void;
  canvasPan?: boolean;
  onToggleCanvasPan?: (pan: boolean) => void;
  panMethod?: "space" | "middle" | "blank";
  onPanMethodChange?: (method: "space" | "middle" | "blank") => void;
  canvasZoom?: boolean;
  onToggleCanvasZoom?: (zoom: boolean) => void;
  zoomSpeed?: "normal" | "fast";
  onZoomSpeedChange?: (speed: "normal" | "fast") => void;
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

interface ViRowProps {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  dataOpt?: string;
}

/**
 * Custom prototype .vi toggle button row:
 * - Full width 32px row with 16px padding
 * - Label on the left
 * - 28x16 rectangular track on the right with sliding 10x10 knob
 * - Real spring physics on toggle
 */
const ViRow: React.FC<ViRowProps> = ({ label, checked, onChange, dataOpt }) => {
  const knobRef = useRef<HTMLSpanElement>(null);

  const handleClick = () => {
    const next = !checked;
    onChange?.(next);
    if (!prefersReducedMotion() && knobRef.current) {
      const p = getActivePreset();
      springAnim(knobRef.current, [{ scale: "0.7" }, { scale: "1" }], p.pop[0], p.pop[1]);
    }
  };

  return (
    <button
      type="button"
      className="vi ll:flex ll:items-center ll:gap-2 ll:w-full ll:h-8 ll:px-4 ll:text-secondary ll:hover:text-primary ll:text-left ll:cursor-pointer ll:bg-transparent ll:border-0 ll:font-sans ll:transition-colors ll:duration-100 ll:outline-none ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
      aria-pressed={checked}
      data-opt={dataOpt}
      onClick={handleClick}
    >
      <span className="ll:flex-1 ll:min-w-0 ll:text-body">{label}</span>
      <i
        aria-hidden="true"
        className={`ll:relative ll:w-7 ll:h-4 ll:shrink-0 ll:border ll:rounded-sm ll:transition-colors ll:duration-120 ${
          checked
            ? "ll:bg-control-primary ll:border-control-primary"
            : "ll:bg-surface-canvas ll:border-border"
        }`}
      >
        <span
          ref={knobRef}
          className={`ll:absolute ll:top-0.5 ll:w-2.5 ll:h-2.5 ll:rounded-xs ll:transition-transform ll:duration-150 ${
            checked
              ? "ll:translate-x-3.5 ll:bg-control-primary-fg"
              : "ll:translate-x-0.5 ll:bg-muted"
          }`}
        />
      </i>
    </button>
  );
};

export const ViewOptionsPopover: React.FC<ViewOptionsPopoverProps> = ({
  open,
  onClose,
  triggerRef,
  position,
  inline = false,
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
  keymapId: propKeymapId,
  onKeymapIdChange,
  inspectMode = false,
  onToggleInspectMode,
  canvasPan = true,
  onToggleCanvasPan,
  panMethod = "space",
  onPanMethodChange,
  canvasZoom = true,
  onToggleCanvasZoom,
  zoomSpeed = "normal",
  onZoomSpeedChange,
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
  const storeKeymapId = useViewportStore((s) => s.keymapId);
  const activeKeymapId = propKeymapId ?? storeKeymapId;

  const handleKeymapChange = (id: KeymapId) => {
    useViewportStore.getState().setKeymapId(id);
    onKeymapIdChange?.(id);
  };

  const [isRendered, setIsRendered] = useState<boolean>(open);
  const [prevOpen, setPrevOpen] = useState<boolean>(open);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const popRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<Surf | null>(null);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsRendered(true);
      setIsAnimating(true);
    }
  }

  // Calculate coordinates: from explicit position (e.g. context menu click), trigger anchor, or centered in canvas
  useEffect(() => {
    if (!open || inline) return;
    const width = 320;
    const padding = 8;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    let targetX: number;
    let targetY: number;

    if (position && position.x !== undefined && position.y !== undefined) {
      targetX = position.x;
      targetY = position.y;
    } else if (
      triggerRef?.current &&
      triggerRef.current.offsetParent !== null &&
      !triggerRef.current.hasAttribute("data-top-anchor")
    ) {
      const rect = triggerRef.current.getBoundingClientRect();
      targetX = rect.left;
      targetY = rect.bottom + 4;
    } else {
      // Center comfortably within the center canvas zone
      const canvasEl = document.querySelector("#center") || document.querySelector("main");
      if (canvasEl) {
        const rect = canvasEl.getBoundingClientRect();
        targetX = rect.left + Math.max(16, (rect.width - width) / 2);
        targetY = rect.top + Math.max(16, Math.min(60, (rect.height - 520) / 2));
      } else {
        targetX = (vpW - width) / 2;
        targetY = 60;
      }
    }

    // Clamp inside viewport
    const clampedX = Math.max(padding, Math.min(targetX, vpW - width - padding));
    const popH = popRef.current?.offsetHeight || 620;
    const clampedY = Math.max(padding, Math.min(targetY, vpH - popH - padding));

    setCoords({ x: Math.round(clampedX), y: Math.round(clampedY) });
  }, [open, position, triggerRef, inline]);

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
      popEl.scrollTop = 0;

      const triggerEl = triggerRef?.current;
      let seed = { ...MENU_FALLBACKS.surfaceSeedDefault };
      if (
        triggerEl &&
        triggerEl.offsetParent !== null &&
        !triggerEl.hasAttribute("data-top-anchor")
      ) {
        const r = triggerEl.getBoundingClientRect();
        seed = {
          w: Math.max(24, Math.round(r.width)),
          h: Math.max(24, Math.round(r.height)),
          r:
            parseFloat(getComputedStyle(triggerEl).borderRadius) ||
            MENU_FALLBACKS.menuRadius,
        };
      } else if (position) {
        seed = { w: 40, h: 24, r: 6 };
      }

      s.open({
        from: seed,
        up: false,
      });

      const animTimer = setTimeout(() => {
        setIsAnimating(false);
        s.end();
        if (popRef.current) {
          popRef.current.removeAttribute("data-mv");
          popRef.current.style.height = "";
        }
      }, 260);

      return () => clearTimeout(animTimer);
    } else {
      s.leave();
      const exitDuration = prefersReducedMotion()
        ? MENU_FALLBACKS.reducedMotionDuration
        : MOT.exitMs;
      const t = setTimeout(() => {
        setIsRendered(false);
        setIsAnimating(false);
      }, exitDuration);
      return () => clearTimeout(t);
    }
  }, [open, isRendered, triggerRef, position]);

  // Outside click & Escape handler
  useEffect(() => {
    if (!open || !isRendered || inline) return;

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
  }, [open, isRendered, inline, onClose, triggerRef]);

  if (!isRendered) return null;

  const validTheme = (OFFICIAL_THEMES as readonly string[]).includes(theme) ? theme : "paper";

  return (
    <div
      ref={popRef}
      id="vpop"
      role="dialog"
      aria-label="View options"
      tabIndex={-1}
      style={{
        position: inline ? "relative" : "fixed",
        width: "320px",
        left: inline ? undefined : `${coords.x}px`,
        top: inline ? undefined : `${coords.y}px`,
        maxHeight: inline ? "100%" : "calc(100vh - 120px)",
        overflowY: isAnimating ? "hidden" : "auto",
        zIndex: inline ? undefined : 60,
      }}
      onMouseMove={(e) => {
        const row = (e.target as HTMLElement).closest<HTMLElement>(".vi, .vact");
        if (row && popRef.current) hlMove(popRef.current, row);
        else if (popRef.current) hlHide(popRef.current);
      }}
      onMouseLeave={() => {
        if (popRef.current) hlHide(popRef.current);
      }}
      className={`vpop ll-vpop ll:flex ll:flex-col ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:py-1 ll:overscroll-contain ll:outline-none ${
        inline ? "ll:relative" : "ll:fixed"
      }`}
    >
      <div className="ll-lay ll:flex ll:flex-col ll:w-full">
        <i aria-hidden="true" className="ll-hl" />
        {/* Quick Actions matching prototype lines 1843-1844 */}
        <button
          type="button"
          id="vfocus"
          className="vact ll:flex ll:items-center ll:gap-2 ll:w-full ll:h-8 ll:px-4 ll:text-secondary ll:hover:text-primary ll:text-left ll:cursor-pointer ll:bg-transparent ll:border-0 ll:text-body ll:font-sans ll:transition-colors ll:duration-100 ll:outline-none ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
          onClick={() => {
            onFocusSelection?.();
            onClose();
          }}
        >
          <Icon icon={Focus} size={16} className="ll:shrink-0" />
          <span>Focus selection</span>
        </button>

        <button
          type="button"
          id="worldbtn"
          className="vact ll:flex ll:items-center ll:gap-2 ll:w-full ll:h-8 ll:px-4 ll:text-secondary ll:hover:text-primary ll:text-left ll:cursor-pointer ll:bg-transparent ll:border-0 ll:text-body ll:font-sans ll:transition-colors ll:duration-100 ll:outline-none ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
          onClick={() => {
            onOpenWorldEnvironment?.();
            onClose();
          }}
        >
          <Icon icon={Globe} size={16} className="ll:shrink-0" />
          <span>World environment</span>
        </button>

        {/* Group 1: Grid (lines 1846-1851) */}
        <div className="hl ll:h-px ll:bg-border ll:mt-2 ll:mb-0 ll:shrink-0" aria-hidden="true" />
        <div className="vgrp micro ll:pt-3 ll:pb-1 ll:px-4 ll:select-none">
          Grid
        </div>

        <div className="vsub ll:px-4 ll:pb-2">
          <div className="seg fill ll:w-full" id="gridseg">
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
        </div>

        <div className="vsub gsz ll:px-4 ll:pb-2 ll:flex ll:flex-col ll:gap-2">
          <div className="gsrow ll:flex ll:items-center ll:justify-between">
            <span className="micro ll:uppercase ll:tracking-wider">Grid size</span>
            <span className="mono ll:text-primary" id="gsval">
              {gridSize}px
            </span>
          </div>
          <Slider
            min={8}
            max={48}
            step={1}
            value={gridSize}
            onChange={(val) => onGridSizeChange?.(val)}
            unit="px"
            ariaLabel="Grid size"
          />
        </div>

        <ViRow
          label="Pixel grid"
          checked={pixelGrid}
          onChange={(c) => onTogglePixelGrid?.(c)}
          dataOpt="px"
        />
        <ViRow
          label="Checkerboard"
          checked={checkerboard}
          onChange={(c) => onToggleCheckerboard?.(c)}
          dataOpt="checker"
        />
        <ViRow
          label="Rulers"
          checked={showRulers}
          onChange={(c) => onToggleRulers?.(c)}
          dataOpt="rulers"
        />

        {/* Group 2: Snapping (lines 1853-1858) */}
        <div className="hl ll:h-px ll:bg-border ll:mt-2 ll:mb-0 ll:shrink-0" aria-hidden="true" />
        <div className="vgrp micro ll:pt-3 ll:pb-1 ll:px-4 ll:select-none">
          Snapping
        </div>

        <ViRow
          label="Snap objects"
          checked={snapObjects}
          onChange={(c) => onToggleSnapObjects?.(c)}
          dataOpt="snapo"
        />
        <ViRow
          label="Snap guides"
          checked={snapGuides}
          onChange={(c) => onToggleSnapGuides?.(c)}
          dataOpt="snapg"
        />
        <ViRow
          label="Snap to grid"
          checked={snapToGrid}
          onChange={(c) => onToggleSnapToGrid?.(c)}
          dataOpt="snapgrid"
        />
        <ViRow
          label="Smart guides"
          checked={smartGuides}
          onChange={(c) => onToggleSmartGuides?.(c)}
          dataOpt="smart"
        />

        <div className="vrow">
          <span
            role="presentation"
            data-scrub
            title="Drag horizontally to scrub snap threshold (Shift: x10)"
            className="ll:flex-1 ll:min-w-0 ll:text-body ll:cursor-ew-resize ll:select-none ll:hover:text-primary"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              const startX = e.clientX;
              const startVal = snapThreshold;
              const onPointerMove = (ev: PointerEvent) => {
                const delta = ev.clientX - startX;
                const mult = ev.shiftKey ? 10 : 1;
                const next = Math.max(1, Math.min(64, Math.round(startVal + delta * mult)));
                onSnapThresholdChange?.(next);
              };
              const onPointerUp = () => {
                window.removeEventListener("pointermove", onPointerMove);
                window.removeEventListener("pointerup", onPointerUp);
              };
              window.addEventListener("pointermove", onPointerMove);
              window.addEventListener("pointerup", onPointerUp);
            }}
          >
            Snap threshold
          </span>
          <div className="vfield">
            <NumberField
              size="sm"
              value={snapThreshold}
              onChange={(val) => onSnapThresholdChange?.(val)}
              unit="PX"
              min={1}
              max={64}
              step={1}
              aria-label="Snap threshold in pixels"
            />
          </div>
        </div>

        {/* Group 3: Canvas (lines 1860-1866) */}
        <div className="hl ll:h-px ll:bg-border ll:mt-2 ll:mb-0 ll:shrink-0" aria-hidden="true" />
        <div className="vgrp micro ll:pt-3 ll:pb-1 ll:px-4 ll:select-none">
          Canvas
        </div>

        <ViRow
          label="Canvas pan"
          checked={canvasPan}
          onChange={(c) => onToggleCanvasPan?.(c)}
          dataOpt="pan"
        />
        <div className="vsub ll:px-4 ll:pb-2">
          <SegmentedControl
            size="sm"
            value={panMethod}
            onChange={(v) => onPanMethodChange?.(v as "space" | "middle" | "blank")}
            ariaLabel="Pan with"
            options={[
              { value: "space", label: "Space + drag" },
              { value: "middle", label: "Middle mouse" },
              { value: "blank", label: "Any blank" },
            ]}
          />
        </div>

        <ViRow
          label="Canvas zoom"
          checked={canvasZoom}
          onChange={(c) => onToggleCanvasZoom?.(c)}
          dataOpt="czoom"
        />
        <div className="vsub ll:px-4 ll:pb-2">
          <SegmentedControl
            size="sm"
            value={zoomSpeed}
            onChange={(v) => onZoomSpeedChange?.(v as "normal" | "fast")}
            ariaLabel="Zoom speed"
            options={[
              { value: "normal", label: "Normal" },
              { value: "fast", label: "Fast (2x)" },
            ]}
          />
        </div>

        <ViRow
          label="World axes"
          checked={worldAxes}
          onChange={(c) => onToggleWorldAxes?.(c)}
          dataOpt="axes"
        />
        <ViRow
          label="Inspect mode"
          checked={inspectMode}
          onChange={(c) => onToggleInspectMode?.(c)}
          dataOpt="inspect"
        />

        {/* Group 4: Behaviour (lines 1868-1872) */}
        <div className="hl ll:h-px ll:bg-border ll:mt-2 ll:mb-0 ll:shrink-0" aria-hidden="true" />
        <div className="vgrp micro ll:pt-3 ll:pb-1 ll:px-4 ll:select-none">
          Behaviour
        </div>

        <ViRow
          label="Dragging"
          checked={elementDragging}
          onChange={(c) => onToggleElementDragging?.(c)}
          dataOpt="drag"
        />
        <ViRow
          label="Reparenting"
          checked={reparenting}
          onChange={(c) => onToggleReparenting?.(c)}
          dataOpt="reparent"
        />

        <div className="vrow">
          <span className="ll:flex-1 ll:min-w-0 ll:text-body">Collision</span>
          <div className="ll:shrink-0">
            <SegmentedControl
              size="sm"
              value={collisionMode}
              onChange={(v) => onCollisionModeChange?.(v as "pass" | "push")}
              ariaLabel="Collision"
              options={[
                { value: "pass", label: "Pass through" },
                { value: "push", label: "Push" },
              ]}
            />
          </div>
        </div>

        <div className="vrow">
          <span className="ll:flex-1 ll:min-w-0 ll:text-body">Marquee</span>
          <div className="ll:shrink-0">
            <SegmentedControl
              size="sm"
              value={marqueeMode}
              onChange={(v) => onMarqueeModeChange?.(v as "intersects" | "encloses")}
              ariaLabel="Marquee"
              options={[
                { value: "intersects", label: "Intersects" },
                { value: "encloses", label: "Encloses" },
              ]}
            />
          </div>
        </div>

        {/* Group 5: Appearance (lines 1874-1877) */}
        <div className="hl ll:h-px ll:bg-border ll:mt-2 ll:mb-0 ll:shrink-0" aria-hidden="true" />
        <div className="vgrp micro ll:pt-3 ll:pb-1 ll:px-4 ll:select-none">
          Appearance
        </div>

        <div className="thgrp ll:px-4 ll:pb-2 ll:flex ll:flex-col ll:gap-1.5" id="themeseg">
          <div className="vgrp micro ll:pt-1 ll:pb-0 ll:select-none">
            Light
          </div>
          <div
            role="group"
            aria-label="Light themes"
            id="themeseg-l"
            className="seg fill ll:grid ll:grid-cols-4 ll:w-full ll:p-0.5 ll:border ll:border-border ll:rounded-md ll:bg-transparent ll:gap-0.5"
          >
            {LIGHT_THEMES.map((th) => {
              const isSelected = validTheme === th;
              return (
                <button
                  key={th}
                  type="button"
                  data-th={th}
                  aria-pressed={isSelected}
                  onClick={() => onThemeChange?.(th)}
                  className={`ll:h-7 ll:px-1 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-micro ll:font-sans ll:font-medium ll:transition-colors ll:duration-100 ll:cursor-pointer ll:border-0 ll:outline-none ll:capitalize ll:whitespace-nowrap ${
                    isSelected
                      ? "ll:bg-control-active ll:text-primary"
                      : "ll:bg-transparent ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar"
                  }`}
                >
                  {th}
                </button>
              );
            })}
          </div>

          <div className="vgrp micro ll:pt-1.5 ll:pb-0 ll:select-none">
            Dark
          </div>
          <div
            role="group"
            aria-label="Dark themes"
            id="themeseg-d"
            className="seg fill ll:grid ll:grid-cols-4 ll:w-full ll:p-0.5 ll:border ll:border-border ll:rounded-md ll:bg-transparent ll:gap-0.5"
          >
            {DARK_THEMES.map((th) => {
              const isSelected = validTheme === th;
              return (
                <button
                  key={th}
                  type="button"
                  data-th={th}
                  aria-pressed={isSelected}
                  onClick={() => onThemeChange?.(th)}
                  className={`ll:h-7 ll:px-1 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:text-micro ll:font-sans ll:font-medium ll:transition-colors ll:duration-100 ll:cursor-pointer ll:border-0 ll:outline-none ll:capitalize ll:whitespace-nowrap ${
                    isSelected
                      ? "ll:bg-control-active ll:text-primary"
                      : "ll:bg-transparent ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar"
                  }`}
                >
                  {th}
                </button>
              );
            })}
          </div>
        </div>

        <div className="vrow vrow-c">
          <span className="ll:text-body">Motion feel</span>
        </div>
        <div className="vsub ll:px-4 ll:pb-2">
          <SegmentedControl
            size="sm"
            value={motionFeel}
            onChange={(v) => onMotionFeelChange?.(v as MotionFeel)}
            ariaLabel="Motion feel"
            options={[
              { value: "smooth", label: "Smooth" },
              { value: "lively", label: "Lively" },
              { value: "bouncy", label: "Bouncy" },
            ]}
          />
        </div>

        <div className="vrow vrow-c">
          <span className="ll:text-body">3D keymap</span>
        </div>
        <div className="vsub ll:px-4 ll:pb-2">
          <SegmentedControl
            size="sm"
            value={activeKeymapId}
            onChange={(v) => handleKeymapChange(v as KeymapId)}
            ariaLabel="3D keymap"
            options={[
              { value: "blender", label: "Blender" },
              { value: "beginner", label: "Beginner" },
            ]}
          />
        </div>

        <div className="vsub gsz vbul ll:px-4 ll:pb-2 ll:flex ll:flex-col ll:gap-2">
          <div className="gsrow ll:flex ll:items-center ll:justify-between">
            <span className="ll:text-secondary ll:text-body">List edge blur</span>
            <span className="mono ll:text-primary" id="bgval">
              {dropdownBulge}%
            </span>
          </div>
          <Slider
            min={0}
            max={100}
            step={5}
            value={dropdownBulge}
            onChange={(val) => onDropdownBulgeChange?.(val)}
            unit="%"
            ariaLabel="List edge blur strength"
          />
        </div>
      </div>
    </div>
  );
};
