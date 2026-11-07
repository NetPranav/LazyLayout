"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  MousePointer2,
  Hand,
  Frame,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Hexagon,
  Star,
  Type,
  PenTool,
  Image as ImageIcon,
  Plus,
  Play,
  Pause,
  Undo2,
  Redo2,
  Columns3,
  ChevronDown,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { useStore } from "zustand";
import { transportStore, transport } from "@/core/time/transport";
import { getCommand, isCommandAvailable, tryRunCommand } from "@/core/commands";
import { useMotionModel, motionActions } from "@/editor/motion-model";
import { Icon } from "@/editor/components/Icon";
import { LogoMark } from "@/editor/components/LogoMark";
import { IconButton } from "@/editor/components/IconButton";
import { Button } from "@/editor/components/Button";
import { Menu, MenuItem } from "@/editor/components/Menu";
import { CANVAS_CHROME_SIZES } from "./constants";
import type { CanvasTool, ShapeTool } from "./types";

export interface ToolbarProps {
  mode?: "design" | "motion" | "code";
  activeTool?: CanvasTool;
  onSelectTool?: (tool: CanvasTool) => void;
  activeShape?: ShapeTool;
  onSelectShape?: (shape: ShapeTool) => void;

  isInsertOpen?: boolean;
  onToggleInsert?: () => void;
  insertButtonRef?: React.RefObject<HTMLButtonElement | null>;

  isAiBoxOpen?: boolean;
  onToggleAiBox?: () => void;
  aiButtonRef?: React.RefObject<HTMLButtonElement | null>;

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
  id: ShapeTool;
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shapeButtonRef = useRef<HTMLButtonElement | null>(null);
  const zoomButtonRef = useRef<HTMLButtonElement | null>(null);

  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Playback state and keyframe command wiring
  const storePlaying = useStore(transportStore, (s) => s.playing);
  const motionModelPlaying = useMotionModel((s) => s.playing);
  const playingState = isPlaying !== undefined ? isPlaying : (motionModelPlaying || storePlaying);

  const handleTogglePlay = useCallback(() => {
    if (onTogglePlay) {
      onTogglePlay();
    } else {
      const current = useMotionModel.getState().playing;
      motionActions.setPlaying(!current);
      transport.togglePlay();
    }
  }, [onTogglePlay]);

  const kfCommand = getCommand("timeline.addKeyframe") || getCommand("keyframe.add");
  const hasKeyframeCommand = true;

  const handleAddKeyframe = useCallback(() => {
    if (onAddKeyframe) {
      onAddKeyframe();
    } else {
      const s = useMotionModel.getState();
      const firstLayer = s.comp.layers[0];
      if (firstLayer) {
        motionActions.addKey(firstLayer.id, "opacity", s.playhead, 1);
      } else if (kfCommand && isCommandAvailable(kfCommand)) {
        tryRunCommand(kfCommand.id);
      }
    }
  }, [onAddKeyframe, kfCommand]);

  // WAI-ARIA Toolbar roving arrow-key navigation covering both center and right tool clusters
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

  const shapeIcon = (SHAPES.find((sh) => sh.id === activeShape) ?? SHAPES[0]).icon;
  const zoomPercentage = `${Math.round(zoom * 100)}%`;

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="ll:contents"
    >
      {/* Center Floating Toolbar - 16px above bottom edge */}
      <div
        id="tools"
        role="toolbar"
        aria-label="Canvas tools"
        data-toolbar="main"
        className="ll-fbar ll-ftool ll:absolute ll:bottom-4 ll:left-1/2 ll:-translate-x-1/2 ll:z-20 ll:flex ll:items-center ll:gap-0.5 ll:p-1 ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:select-none"
      >
        {mode === "motion" ? (
          <div className="mtools ll-mtools ll:flex ll:items-center ll:gap-0.5">
            {/* Select (V) */}
            <IconButton
              size="lg"
              data-tool="select"
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

            {/* Add keyframe (K) */}
            <IconButton
              size="lg"
              data-mact="kf"
              aria-label="Add keyframe (K)"
              tooltip="Add keyframe (K)"
              tabIndex={focusedIndex === 2 ? 0 : -1}
              onFocus={() => setFocusedIndex(2)}
              onClick={handleAddKeyframe}
              icon={<Icon icon={KeyframeAddSvg} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Play preview (Space) */}
            <IconButton
              size="lg"
              data-mact="play"
              aria-label={playingState ? "Pause preview (Space)" : "Play preview (Space)"}
              tooltip={playingState ? "Pause preview (Space)" : "Play preview (Space)"}
              pressed={playingState}
              tabIndex={focusedIndex === 3 ? 0 : -1}
              onFocus={() => setFocusedIndex(3)}
              onClick={handleTogglePlay}
              icon={<Icon icon={playingState ? Pause : Play} size={CANVAS_CHROME_SIZES.iconLg} />}
            />
          </div>
        ) : (
          <div className="dtools ll-dtools ll:flex ll:items-center ll:gap-0.5">
            {/* Select (V) */}
            <IconButton
              size="lg"
              data-tool="select"
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

            {/* Frame (F) */}
            <IconButton
              size="lg"
              data-tool="frame"
              aria-label="Frame (F)"
              tooltip="Frame (F)"
              pressed={activeTool === "frame"}
              tabIndex={focusedIndex === 2 ? 0 : -1}
              onFocus={() => setFocusedIndex(2)}
              onClick={() => onSelectTool?.("frame")}
              icon={<Icon icon={Frame} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Shape Picker */}
            <IconButton
              ref={shapeButtonRef}
              size="lg"
              aria-label="Shape"
              tooltip="Shape"
              pressed={activeTool === "shape"}
              aria-haspopup="menu"
              aria-expanded={isShapeMenuOpen}
              tabIndex={focusedIndex === 3 ? 0 : -1}
              onFocus={() => setFocusedIndex(3)}
              onClick={() => {
                onSelectTool?.("shape");
                setIsShapeMenuOpen((prev) => !prev);
              }}
              icon={<Icon icon={shapeIcon} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

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

            {/* Pen / Vector (P) */}
            <IconButton
              size="lg"
              data-tool="pen"
              aria-label="Pen (P) / Pencil (Shift+P)"
              tooltip="Pen (P) / Pencil (Shift+P)"
              pressed={activeTool === "pen" || activeTool === "pencil"}
              tabIndex={focusedIndex === 5 ? 0 : -1}
              onFocus={() => setFocusedIndex(5)}
              onClick={() => onSelectTool?.("pen")}
              icon={<Icon icon={PenTool} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Image */}
            <IconButton
              size="lg"
              data-tool="image"
              aria-label="Image"
              tooltip="Image"
              pressed={activeTool === "image"}
              tabIndex={focusedIndex === 6 ? 0 : -1}
              onFocus={() => setFocusedIndex(6)}
              onClick={() => onSelectTool?.("image")}
              icon={<Icon icon={ImageIcon} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Separator */}
            <span
              className="ll-gsep gsep ll:w-px ll:h-5 ll:mx-2 ll:bg-border ll:shrink-0"
              aria-hidden="true"
            />

            {/* Insert (+) - Disclosure button (keep aria-expanded, drop pressed) */}
            <IconButton
              ref={insertButtonRef}
              size="lg"
              id="plusbtn"
              aria-label="Insert"
              tooltip="Insert (I)"
              aria-haspopup="dialog"
              aria-expanded={isInsertOpen}
              tabIndex={focusedIndex === 6 ? 0 : -1}
              onFocus={() => setFocusedIndex(6)}
              onClick={onToggleInsert}
              icon={<Icon icon={Plus} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Ask AI (/) - Disclosure button (keep aria-expanded, drop pressed) */}
            <IconButton
              ref={aiButtonRef}
              size="lg"
              id="aibtn"
              aria-label="Ask AI (/)"
              tooltip="Ask AI (/)"
              aria-haspopup="dialog"
              pressed={isAiBoxOpen}
              aria-expanded={isAiBoxOpen}
              tabIndex={focusedIndex === 7 ? 0 : -1}
              onFocus={() => setFocusedIndex(7)}
              onClick={onToggleAiBox}
              icon={<span className="ll-logo"><LogoMark size={CANVAS_CHROME_SIZES.iconAi} /></span>}
            />

            {/* Separator */}
            <span
              className="ll-gsep gsep ll:w-px ll:h-5 ll:mx-2 ll:bg-border ll:shrink-0"
              aria-hidden="true"
            />

            {/* Preview */}
            <IconButton
              size="lg"
              aria-label="Preview"
              tooltip="Preview"
              tabIndex={focusedIndex === 8 ? 0 : -1}
              onFocus={() => setFocusedIndex(8)}
              onClick={onPreview}
              icon={<Icon icon={Play} size={CANVAS_CHROME_SIZES.iconLg} />}
            />
          </div>
        )}
      </div>

      {/* Right Floating Zoom & History Controls */}
      <div
        role="toolbar"
        aria-label="Zoom and Viewport actions"
        data-toolbar="zoom"
        className="ll-fbar ll-fzoom ll:absolute ll:bottom-4 ll:right-4 ll:z-20 ll:flex ll:items-center ll:gap-0.5 ll:p-1 ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:select-none"
      >
        {/* Toggle Panels - State button (pressed={panelsCollapsed} stays pressed) */}
        <IconButton
          size="tall"
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

        {/* Zoom Trigger Button using design system Button */}
        <Button
          ref={zoomButtonRef}
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
          <span className="ll-mono ll:font-mono">{zoomPercentage}</span>
        </Button>
      </div>

      {/* Shape Picker Menu */}
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
            onClick={() => {
              onSelectShape?.(sh.id);
              onSelectTool?.("shape");
              setIsShapeMenuOpen(false);
            }}
          >
            {sh.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Zoom menu: same five items as the prototype's ZOOM_HTML */}
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
