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
  Image as ImageIcon,
  Plus,
  Play,
  Undo2,
  Redo2,
  Columns3,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { LogoMark } from "@/editor/components/LogoMark";
import { IconButton } from "@/editor/components/IconButton";
import { Button } from "@/editor/components/Button";
import { Menu, MenuItem } from "@/editor/components/Menu";
import { CANVAS_CHROME_SIZES } from "./constants";
import type { CanvasTool, ShapeTool } from "./types";

export interface ToolbarProps {
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
}

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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shapeButtonRef = useRef<HTMLButtonElement | null>(null);
  const zoomButtonRef = useRef<HTMLButtonElement | null>(null);

  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

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
        role="toolbar"
        aria-label="Canvas tools"
        data-toolbar="main"
        className="ll-fbar ll-ftool ll:absolute ll:bottom-4 ll:left-1/2 ll:-translate-x-1/2 ll:z-20 ll:flex ll:items-center ll:gap-0.5 ll:p-1 ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:select-none"
      >
        {/* Select (V) */}
        <IconButton
          size="md"
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
          size="md"
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
          className="ll-gsep ll:w-px ll:h-5 ll:mx-1 ll:bg-border ll:shrink-0"
          aria-hidden="true"
        />

        {/* Frame (F) */}
        <IconButton
          size="md"
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
          size="md"
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
          size="md"
          aria-label="Text (T)"
          tooltip="Text (T)"
          pressed={activeTool === "text"}
          tabIndex={focusedIndex === 4 ? 0 : -1}
          onFocus={() => setFocusedIndex(4)}
          onClick={() => onSelectTool?.("text")}
          icon={<Icon icon={Type} size={CANVAS_CHROME_SIZES.iconLg} />}
        />

        {/* Image */}
        <IconButton
          size="md"
          aria-label="Image"
          tooltip="Image"
          pressed={activeTool === "image"}
          tabIndex={focusedIndex === 5 ? 0 : -1}
          onFocus={() => setFocusedIndex(5)}
          onClick={() => onSelectTool?.("image")}
          icon={<Icon icon={ImageIcon} size={CANVAS_CHROME_SIZES.iconLg} />}
        />

        {/* Separator */}
        <span
          className="ll-gsep ll:w-px ll:h-5 ll:mx-1 ll:bg-border ll:shrink-0"
          aria-hidden="true"
        />

        {/* Insert (+) - Disclosure button (keep aria-expanded, drop pressed) */}
        <IconButton
          ref={insertButtonRef}
          size="md"
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
          size="md"
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
          className="ll-gsep ll:w-px ll:h-5 ll:mx-1 ll:bg-border ll:shrink-0"
          aria-hidden="true"
        />

        {/* Preview */}
        <IconButton
          size="md"
          aria-label="Preview"
          tooltip="Preview"
          tabIndex={focusedIndex === 8 ? 0 : -1}
          onFocus={() => setFocusedIndex(8)}
          onClick={onPreview}
          icon={<Icon icon={Play} size={CANVAS_CHROME_SIZES.iconLg} />}
        />
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
          size="md"
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
          className="ll-gsep ll:w-px ll:h-5 ll:mx-1 ll:bg-border ll:shrink-0"
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
          className="ll-zb ll:h-7 ll:px-2 ll:font-mono ll:text-nano ll:font-medium ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
        >
          <span className="ll-mono">{zoomPercentage}</span>
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
          onClick={() => {
            onZoomIn?.();
            setIsZoomMenuOpen(false);
          }}
        >
          Zoom in
        </MenuItem>
        <MenuItem
          onClick={() => {
            onZoomOut?.();
            setIsZoomMenuOpen(false);
          }}
        >
          Zoom out
        </MenuItem>
        <MenuItem
          onClick={() => {
            onZoom100?.();
            setIsZoomMenuOpen(false);
          }}
        >
          <span className="ll-mono">100%</span>
        </MenuItem>
        <MenuItem
          onClick={() => {
            onZoomFit?.();
            setIsZoomMenuOpen(false);
          }}
        >
          Fit to screen
        </MenuItem>
        <MenuItem
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
