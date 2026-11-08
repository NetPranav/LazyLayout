"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  MousePointer2,
  Hand,
  Frame as FrameIcon,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Hexagon,
  Star,
  PenTool,
  Type,
  Plus,
  Play,
  Scissors,
  Spline,
  Download,
  Undo2,
  Redo2,
  Columns3,
  ChevronDown,
  Check,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { LogoMark } from "@/editor/components/LogoMark";
import { IconButton } from "@/editor/components/IconButton";
import { Button } from "@/editor/components/Button";
import { Menu, MenuItem } from "@/editor/components/Menu";
import {
  CANVAS_CHROME_SIZES,
  EASING_OPTIONS,
  EXPORT_OPTIONS,
  type EasingOption,
  type ExportOption,
} from "./constants";
import type { CanvasTool, ShapeTool } from "./types";

export interface ToolbarProps {
  mode?: "design" | "motion" | "code";
  activeTool?: CanvasTool | string;
  onSelectTool?: (tool: CanvasTool) => void;
  activeShape?: ShapeTool | string;
  onSelectShape?: (shape: ShapeTool) => void;

  isInsertOpen?: boolean;
  onToggleInsert?: () => void;
  insertButtonRef?: React.RefObject<HTMLButtonElement | null>;

  isAiBoxOpen?: boolean;
  onToggleAiBox?: () => void;
  aiButtonRef?: React.RefObject<HTMLButtonElement | null>;

  isFramePresetsOpen?: boolean;
  onToggleFramePresets?: () => void;
  frameButtonRef?: React.RefObject<HTMLButtonElement | null> | React.RefObject<HTMLElement | null>;

  isSpotlightOpen?: boolean;

  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoom100?: () => void;
  onZoomFit?: () => void;
  onZoomSelection?: () => void;

  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;

  panelsCollapsed?: boolean;
  onTogglePanels?: () => void;

  onPreview?: () => void;

  // Motion-mode toolbar controls
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onAddKeyframe?: () => void;
  activeEasing?: string;
  onSelectEasing?: (easing: EasingOption) => void;
  onSplitClip?: () => void;

  // Code-mode toolbar controls
  onRunCode?: () => void;
  onExportOption?: (option: ExportOption) => void;
}

const KeyframeAddSvg: LucideIcon = Object.assign(
  React.forwardRef<SVGSVGElement, LucideProps>(function KeyframeAddSvg(
    { size = 20, strokeWidth = 1.5, className = "", ...props },
    ref
  ) {
    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`ll:shrink-0 ${className}`}
        {...props}
      >
        <path d="M12 3l9 9-9 9-9-9Z" />
        <path d="M12 9v6M9 12h6" />
      </svg>
    );
  }),
  { displayName: "KeyframeAddSvg" }
);

const SHAPES: ReadonlyArray<{
  id: ShapeTool | "pen";
  label: string;
  icon: LucideIcon;
  shortcut: string;
}> = [
  { id: "box", label: "Rectangle", icon: Square, shortcut: "R" },
  { id: "circle", label: "Ellipse", icon: Circle, shortcut: "O" },
  { id: "line", label: "Line", icon: Minus, shortcut: "L" },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight, shortcut: "Shift+L" },
  { id: "poly", label: "Polygon", icon: Hexagon, shortcut: "Y" },
  { id: "star", label: "Star", icon: Star, shortcut: "Shift+Y" },
  { id: "pen", label: "Pen", icon: PenTool, shortcut: "P" },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  mode = "design",
  activeTool = "select",
  onSelectTool,
  activeShape = "box",
  onSelectShape,
  isInsertOpen = false,
  onToggleInsert,
  insertButtonRef,
  isAiBoxOpen = false,
  onToggleAiBox,
  aiButtonRef,
  isFramePresetsOpen = false,
  onToggleFramePresets,
  frameButtonRef,
  isSpotlightOpen = false,
  zoom = 0.59,
  onZoomIn,
  onZoomOut,
  onZoom100,
  onZoomFit,
  onZoomSelection,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  panelsCollapsed = false,
  onTogglePanels,
  onPreview,
  isPlaying,
  onTogglePlay,
  onAddKeyframe,
  activeEasing = "Ease out",
  onSelectEasing,
  onSplitClip,
  onRunCode,
  onExportOption,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const zoomBarRef = useRef<HTMLDivElement>(null);

  const shapeButtonRef = useRef<HTMLButtonElement | null>(null);
  const easingButtonRef = useRef<HTMLButtonElement | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement | null>(null);
  const zoomButtonRef = useRef<HTMLButtonElement | null>(null);

  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const [isEasingMenuOpen, setIsEasingMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const [isNarrowLifted, setIsNarrowLifted] = useState(false);
  const [isRunningCode, setIsRunningCode] = useState(false);

  // Narrow canvas detection (prototype lift() lines 10582-10589)
  useEffect(() => {
    const checkLift = () => {
      const parent = toolbarRef.current?.parentElement;
      if (!parent || !toolbarRef.current || !zoomBarRef.current) return;
      const cw = parent.clientWidth;
      const bw = toolbarRef.current.offsetWidth;
      const zw = zoomBarRef.current.offsetWidth;
      // If (canvasWidth + toolbarWidth)/2 > canvasWidth - zoomWidth - 32, toolbar rides above zoom bar
      const shouldLift = (cw + bw) / 2 > cw - zw - 32;
      setIsNarrowLifted(shouldLift);
    };

    checkLift();
    window.addEventListener("resize", checkLift);
    return () => window.removeEventListener("resize", checkLift);
  }, [mode, isSpotlightOpen]);

  // WAI-ARIA Toolbar roving arrow-key navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const buttons = Array.from(
        containerRef.current.querySelectorAll<HTMLButtonElement>(
          "button:not([disabled])"
        )
      );
      const currentIndex = buttons.indexOf(
        document.activeElement as HTMLButtonElement
      );
      if (currentIndex === -1) return;

      let targetIndex = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        targetIndex = (currentIndex + 1) % buttons.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        targetIndex = (currentIndex - 1 + buttons.length) % buttons.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        targetIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        targetIndex = buttons.length - 1;
      }

      if (targetIndex !== -1 && buttons[targetIndex]) {
        setFocusedIndex(targetIndex);
        buttons[targetIndex].focus();
      }
    },
    []
  );

  const handleRunCodeClick = () => {
    if (isRunningCode) return;
    setIsRunningCode(true);
    onRunCode?.();
    setTimeout(() => {
      setIsRunningCode(false);
    }, 1200);
  };

  const shapeIcon = (SHAPES.find((sh) => sh.id === activeShape) ?? SHAPES[0]).icon;
  const zoomPercentage = `${Math.round(zoom * 100)}%`;

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="ll:contents"
    >
      {/* Center Floating Toolbar - 16px above bottom edge, or lifted to 72px when narrow */}
      <div
        ref={toolbarRef}
        id="tools"
        role="toolbar"
        aria-label="Canvas tools"
        data-toolbar="main"
        className={`ll-fbar ll-ftool ll:absolute ll:left-1/2 ll:-translate-x-1/2 ll:z-20 ll:flex ll:items-center ll:gap-0.5 ll:p-1 ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:select-none ll:transition-all ll:duration-200 ${
          isNarrowLifted ? "ll-tb-hi ll:bottom-toolbar-lift" : "ll:bottom-4"
        } ${isSpotlightOpen ? "ll:opacity-0 ll:pointer-events-none" : ""}`}
      >
        {/* DESIGN MODE TOOLBAR: Select, Hand, Frame, Shape ▾ (Pen inside), Text, Insert, AI */}
        {mode === "design" && (
          <div className="dtools ll-dtools ll:flex ll:items-center ll:gap-0.5">
            {/* Select (V) */}
            <IconButton
              size="lg"
              data-tool="select"
              data-tb="vsel"
              aria-label="Select (V)"
              tooltip="Select (V)"
              pressed={activeTool === "select"}
              tabIndex={focusedIndex === 0 ? 0 : -1}
              onFocus={() => setFocusedIndex(0)}
              onClick={() => onSelectTool?.("select")}
              icon={<Icon icon={MousePointer2} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Hand (H) */}
            <IconButton
              size="lg"
              data-tool="hand"
              data-tb="vhand"
              aria-label="Hand (H)"
              tooltip="Hand (H)"
              pressed={activeTool === "hand"}
              tabIndex={focusedIndex === 1 ? 0 : -1}
              onFocus={() => setFocusedIndex(1)}
              onClick={() => onSelectTool?.("hand")}
              icon={<Icon icon={Hand} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Frame (F) - opens FramePresetsPanel */}
            <IconButton
              ref={frameButtonRef as React.Ref<HTMLButtonElement>}
              size="lg"
              data-tool="frame"
              aria-label="Frame (F)"
              tooltip="Frame (F)"
              aria-haspopup="dialog"
              aria-expanded={isFramePresetsOpen}
              pressed={activeTool === "frame" || isFramePresetsOpen}
              tabIndex={focusedIndex === 2 ? 0 : -1}
              onFocus={() => setFocusedIndex(2)}
              onClick={() => {
                onSelectTool?.("frame");
                onToggleFramePresets?.();
              }}
              icon={<Icon icon={FrameIcon} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Shape ▾ (with Pen inside, caret right of icon) */}
            <Button
              ref={shapeButtonRef}
              variant={activeTool === "shape" ? "secondary" : "ghost"}
              size="md"
              id="shapebtn"
              data-tool="shape"
              aria-label="Shape"
              title="Shape"
              aria-haspopup="menu"
              aria-expanded={isShapeMenuOpen}
              tabIndex={focusedIndex === 3 ? 0 : -1}
              onFocus={() => setFocusedIndex(3)}
              onClick={() => {
                onSelectTool?.("shape");
                setIsShapeMenuOpen((prev) => !prev);
              }}
              className="ll:h-10 ll:px-2 ll:flex ll:items-center ll:gap-1"
            >
              <Icon icon={shapeIcon} size={CANVAS_CHROME_SIZES.iconLg} />
              <Icon
                icon={ChevronDown}
                size={CANVAS_CHROME_SIZES.iconXs}
                className="ll:text-muted ll:transition-transform ll:duration-150"
                style={{ transform: isShapeMenuOpen ? "rotate(180deg)" : "none" }}
              />
            </Button>

            {/* Text (T) */}
            <IconButton
              size="lg"
              data-tool="text"
              aria-label="Text (T)"
              tooltip="Text (T)"
              pressed={activeTool === "text"}
              tabIndex={focusedIndex === 4 ? 0 : -1}
              onFocus={() => setFocusedIndex(4)}
              onClick={() => onSelectTool?.("text")}
              icon={<Icon icon={Type} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Separator */}
            <span
              className="ll-gsep gsep ll:w-px ll:h-5 ll:mx-2 ll:bg-border ll:shrink-0"
              aria-hidden="true"
            />

            {/* Insert (+) */}
            <IconButton
              ref={insertButtonRef}
              size="lg"
              id="plusbtn"
              aria-label="Add"
              tooltip="Insert (I)"
              aria-haspopup="dialog"
              aria-expanded={isInsertOpen}
              pressed={isInsertOpen}
              tabIndex={focusedIndex === 5 ? 0 : -1}
              onFocus={() => setFocusedIndex(5)}
              onClick={onToggleInsert}
              icon={<Icon icon={Plus} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Ask AI (/) */}
            <IconButton
              ref={aiButtonRef}
              size="lg"
              id="aibtn"
              aria-label="Ask AI (/)"
              tooltip="Ask AI (/)"
              aria-haspopup="dialog"
              aria-expanded={isAiBoxOpen}
              pressed={isAiBoxOpen}
              tabIndex={focusedIndex === 6 ? 0 : -1}
              onFocus={() => setFocusedIndex(6)}
              onClick={onToggleAiBox}
              icon={<span className="ll-logo"><LogoMark size={CANVAS_CHROME_SIZES.iconAi} /></span>}
            />
          </div>
        )}

        {/* MOTION MODE TOOLBAR: Select, Hand, [gsep], Add keyframe (disabled), Split, Easing ▾ */}
        {mode === "motion" && (
          <div className="mtools ll-mtools ll:flex ll:items-center ll:gap-0.5">
            {/* Select (V) */}
            <IconButton
              size="lg"
              data-tool="select"
              data-tb="vsel"
              aria-label="Select (V)"
              tooltip="Select (V)"
              pressed={activeTool === "select"}
              tabIndex={focusedIndex === 0 ? 0 : -1}
              onFocus={() => setFocusedIndex(0)}
              onClick={() => onSelectTool?.("select")}
              icon={<Icon icon={MousePointer2} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Hand (H) */}
            <IconButton
              size="lg"
              data-tool="hand"
              data-tb="vhand"
              aria-label="Hand (H)"
              tooltip="Hand (H)"
              pressed={activeTool === "hand"}
              tabIndex={focusedIndex === 1 ? 0 : -1}
              onFocus={() => setFocusedIndex(1)}
              onClick={() => onSelectTool?.("hand")}
              icon={<Icon icon={Hand} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Separator */}
            <span
              className="ll-gsep gsep ll:w-px ll:h-5 ll:mx-2 ll:bg-border ll:shrink-0"
              aria-hidden="true"
            />

            {/* Add keyframe (K) - disabled with reason */}
            <IconButton
              size="lg"
              data-mact="kf"
              aria-label="Add keyframe (K)"
              tooltip="Add keyframe (K) - Disabled: no engine command for add keyframe"
              disabled={true}
              tabIndex={-1}
              icon={<Icon icon={KeyframeAddSvg} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Split clip (C) */}
            <IconButton
              size="lg"
              data-tb="split"
              data-mtool="split"
              aria-label="Split clip (C)"
              tooltip="Split clip (C)"
              pressed={activeTool === "split"}
              tabIndex={focusedIndex === 2 ? 0 : -1}
              onFocus={() => setFocusedIndex(2)}
              onClick={() => {
                onSplitClip?.();
              }}
              icon={<Icon icon={Scissors} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Easing ▾ (caret right of icon) */}
            <Button
              ref={easingButtonRef}
              variant="ghost"
              size="md"
              data-tb="ease"
              aria-label="Easing"
              title="Easing"
              aria-haspopup="menu"
              aria-expanded={isEasingMenuOpen}
              tabIndex={focusedIndex === 3 ? 0 : -1}
              onFocus={() => setFocusedIndex(3)}
              onClick={() => setIsEasingMenuOpen((prev) => !prev)}
              className="ll:h-10 ll:px-2 ll:flex ll:items-center ll:gap-1"
            >
              <Icon icon={Spline} size={CANVAS_CHROME_SIZES.iconLg} />
              <Icon
                icon={ChevronDown}
                size={CANVAS_CHROME_SIZES.iconXs}
                className="ll:text-muted ll:transition-transform ll:duration-150"
                style={{ transform: isEasingMenuOpen ? "rotate(180deg)" : "none" }}
              />
            </Button>
          </div>
        )}

        {/* CODE MODE TOOLBAR: Inspect, Hand, [gsep], Run, Export ▾ */}
        {mode === "code" && (
          <div className="ctools ll-ctools ll:flex ll:items-center ll:gap-0.5">
            {/* Inspect (V) */}
            <IconButton
              size="lg"
              data-tool="select"
              data-tb="vsel"
              aria-label="Inspect (V)"
              tooltip="Inspect (V)"
              pressed={activeTool === "select"}
              tabIndex={focusedIndex === 0 ? 0 : -1}
              onFocus={() => setFocusedIndex(0)}
              onClick={() => onSelectTool?.("select")}
              icon={<Icon icon={MousePointer2} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Hand (H) */}
            <IconButton
              size="lg"
              data-tool="hand"
              data-tb="vhand"
              aria-label="Hand (H)"
              tooltip="Hand (H)"
              pressed={activeTool === "hand"}
              tabIndex={focusedIndex === 1 ? 0 : -1}
              onFocus={() => setFocusedIndex(1)}
              onClick={() => onSelectTool?.("hand")}
              icon={<Icon icon={Hand} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Separator */}
            <span
              className="ll-gsep gsep ll:w-px ll:h-5 ll:mx-2 ll:bg-border ll:shrink-0"
              aria-hidden="true"
            />

            {/* Run */}
            <IconButton
              size="lg"
              data-tb="run"
              aria-label="Run"
              tooltip="Run"
              aria-busy={isRunningCode}
              tabIndex={focusedIndex === 2 ? 0 : -1}
              onFocus={() => setFocusedIndex(2)}
              onClick={handleRunCodeClick}
              icon={<Icon icon={Play} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Export ▾ (caret right of icon) */}
            <Button
              ref={exportButtonRef}
              variant="ghost"
              size="md"
              data-tb="exp"
              aria-label="Export"
              title="Export"
              aria-haspopup="menu"
              aria-expanded={isExportMenuOpen}
              tabIndex={focusedIndex === 3 ? 0 : -1}
              onFocus={() => setFocusedIndex(3)}
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className="ll:h-10 ll:px-2 ll:flex ll:items-center ll:gap-1"
            >
              <Icon icon={Download} size={CANVAS_CHROME_SIZES.iconLg} />
              <Icon
                icon={ChevronDown}
                size={CANVAS_CHROME_SIZES.iconXs}
                className="ll:text-muted ll:transition-transform ll:duration-150"
                style={{ transform: isExportMenuOpen ? "rotate(180deg)" : "none" }}
              />
            </Button>
          </div>
        )}
      </div>

      {/* Right Floating Zoom & History Controls - slides aside when Spotlight is open */}
      <div
        ref={zoomBarRef}
        role="toolbar"
        aria-label="Zoom and Viewport actions"
        data-toolbar="zoom"
        className={`ll-fbar ll-fzoom ll:absolute ll:bottom-4 ll:right-4 ll:z-20 ll:flex ll:items-center ll:gap-0.5 ll:p-1 ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:select-none ll:transition-all ll:duration-200 ${
          isSpotlightOpen ? "ll:translate-x-60 ll:opacity-0 ll:pointer-events-none" : ""
        }`}
      >
        {/* Toggle Panels */}
        <IconButton
          size="tall"
          id="panelbtn"
          aria-label="Show or hide panels (Ctrl+\)"
          tooltip="Show or hide panels (Ctrl+\)"
          pressed={panelsCollapsed}
          tabIndex={focusedIndex === 9 ? 0 : -1}
          onFocus={() => setFocusedIndex(9)}
          onClick={onTogglePanels}
          icon={<Icon icon={Columns3} size={CANVAS_CHROME_SIZES.iconLg} />}
        />

        {/* Undo */}
        <IconButton
          size="md"
          id="undobtn"
          aria-label="Undo (Ctrl+Z)"
          tooltip="Undo (Ctrl+Z)"
          disabled={!canUndo}
          tabIndex={focusedIndex === 10 ? 0 : -1}
          onFocus={() => setFocusedIndex(10)}
          onClick={onUndo}
          icon={<Icon icon={Undo2} size={CANVAS_CHROME_SIZES.iconLg} />}
        />

        {/* Redo */}
        <IconButton
          size="md"
          id="redobtn"
          aria-label="Redo (Ctrl+Shift+Z)"
          tooltip="Redo (Ctrl+Shift+Z)"
          disabled={!canRedo}
          tabIndex={focusedIndex === 11 ? 0 : -1}
          onFocus={() => setFocusedIndex(11)}
          onClick={onRedo}
          icon={<Icon icon={Redo2} size={CANVAS_CHROME_SIZES.iconLg} />}
        />

        {/* Separator */}
        <span
          className="ll-gsep ll:w-px ll:h-5 ll:mx-2 ll:bg-border ll:shrink-0"
          aria-hidden="true"
        />

        {/* Zoom Trigger Button */}
        <Button
          ref={zoomButtonRef}
          id="zoombtn"
          variant="ghost"
          size="sm"
          title="Zoom"
          aria-haspopup="menu"
          aria-expanded={isZoomMenuOpen}
          tabIndex={focusedIndex === 12 ? 0 : -1}
          onFocus={() => setFocusedIndex(12)}
          onClick={() => setIsZoomMenuOpen((prev) => !prev)}
          rightIcon={<Icon icon={ChevronDown} size={CANVAS_CHROME_SIZES.iconSm} className="ll:text-muted" />}
          className="ll-zb ll:h-10 ll:px-2 ll:font-mono ll:text-body ll:font-medium ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
        >
          <span className="ll-mono ll:font-mono" id="pct">{zoomPercentage}</span>
        </Button>
      </div>

      {/* Shape Picker Menu (Design mode) */}
      <Menu
        open={isShapeMenuOpen}
        onClose={() => setIsShapeMenuOpen(false)}
        anchorRef={shapeButtonRef}
        aria-label="Shape options"
        width={CANVAS_CHROME_SIZES.shapeMenuWidth}
      >
        {SHAPES.map((sh) => (
          <MenuItem
            key={sh.id}
            icon={<Icon icon={sh.icon} size={CANVAS_CHROME_SIZES.iconMd} />}
            shortcut={sh.shortcut}
            checked={activeShape === sh.id}
            onClick={() => {
              if (sh.id !== "pen") {
                onSelectShape?.(sh.id);
              }
              onSelectTool?.("shape");
              setIsShapeMenuOpen(false);
            }}
          >
            {sh.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Easing Menu (Motion mode) */}
      <Menu
        open={isEasingMenuOpen}
        onClose={() => setIsEasingMenuOpen(false)}
        anchorRef={easingButtonRef}
        aria-label="Easing options"
        width={CANVAS_CHROME_SIZES.easingMenuWidth}
      >
        {EASING_OPTIONS.map((opt) => (
          <MenuItem
            key={opt}
            checked={activeEasing === opt}
            onClick={() => {
              onSelectEasing?.(opt);
              setIsEasingMenuOpen(false);
            }}
          >
            {opt}
          </MenuItem>
        ))}
      </Menu>

      {/* Export Menu (Code mode) */}
      <Menu
        open={isExportMenuOpen}
        onClose={() => setIsExportMenuOpen(false)}
        anchorRef={exportButtonRef}
        aria-label="Export options"
        width={CANVAS_CHROME_SIZES.exportMenuWidth}
      >
        {EXPORT_OPTIONS.map((opt) => (
          <MenuItem
            key={opt}
            onClick={() => {
              onExportOption?.(opt);
              setIsExportMenuOpen(false);
            }}
          >
            {opt}
          </MenuItem>
        ))}
      </Menu>

      {/* Zoom menu */}
      <Menu
        open={isZoomMenuOpen}
        onClose={() => setIsZoomMenuOpen(false)}
        anchorRef={zoomButtonRef}
        aria-label="Zoom actions"
        width={CANVAS_CHROME_SIZES.zoomMenuWidth}
      >
        <MenuItem
          shortcut="Ctrl++"
          onClick={() => {
            onZoomIn?.();
            setIsZoomMenuOpen(false);
          }}
        >
          Zoom in
        </MenuItem>
        <MenuItem
          shortcut="Ctrl+-"
          onClick={() => {
            onZoomOut?.();
            setIsZoomMenuOpen(false);
          }}
        >
          Zoom out
        </MenuItem>
        <MenuItem
          shortcut="Ctrl+0"
          onClick={() => {
            onZoom100?.();
            setIsZoomMenuOpen(false);
          }}
        >
          <span className="ll-mono">100%</span>
        </MenuItem>
        <MenuItem
          shortcut="Shift+1"
          onClick={() => {
            onZoomFit?.();
            setIsZoomMenuOpen(false);
          }}
        >
          Fit to screen
        </MenuItem>
        <MenuItem
          shortcut="Shift+2"
          onClick={() => {
            onZoomSelection?.();
            setIsZoomMenuOpen(false);
          }}
        >
          Zoom to selection
        </MenuItem>
      </Menu>
    </div>
  );
};
