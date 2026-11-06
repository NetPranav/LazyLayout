"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Rulers } from "./Rulers";
import { Toolbar } from "./Toolbar";
import { InsertBox } from "./InsertBox";
import { AiBox } from "./AiBox";
import { ViewOptionsPopover } from "./ViewOptionsPopover";
import { CanvasContextMenu } from "./CanvasContextMenu";
import { type CollabUser } from "@/editor/components/AvatarStack";
import { useCollabStore } from "@/core/store/useCollabStore";
import { applyTheme, type Theme } from "@/editor/components/ThemeToggle";
import { applyFeel } from "@/editor/motion/feel";
import { type MotionPresetKey } from "@/editor/motion/presets";
import "./fpeople.css";
import type {
  CanvasChromeProps,
  MotionFeel,
} from "./types";

/**
 * Small helper to handle controlled or uncontrolled state cleanly without duplication.
 */
function useControllable<T>(
  controlledValue: T | undefined,
  onChange: ((val: T) => void) | undefined,
  defaultValue: T
): [T, (next: T | ((prev: T) => T)) => void] {
  const [internalValue, setInternalValue] = useState<T>(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(value) : next;
      if (!isControlled) {
        setInternalValue(resolved);
      }
      onChange?.(resolved);
    },
    [isControlled, value, onChange]
  );

  return [value, setValue];
}

export const CanvasChrome: React.FC<CanvasChromeProps> = ({
  mode = "design",
  children,
  showRulers: controlledShowRulers,
  onToggleRulers: controlledOnToggleRulers,
  activeTool: controlledActiveTool,
  onSelectTool: controlledOnSelectTool,
  activeShape: controlledActiveShape,
  onSelectShape: controlledOnSelectShape,
  zoom: controlledZoom,
  onZoomChange,
  onZoomIn: controlledOnZoomIn,
  onZoomOut: controlledOnZoomOut,
  onZoom100: controlledOnZoom100,
  onZoomFit: controlledOnZoomFit,
  onZoomSelection: controlledOnZoomSelection,
  isInsertOpen: controlledIsInsertOpen,
  onToggleInsert: controlledOnToggleInsert,
  onInsertItem,
  isAiBoxOpen: controlledIsAiBoxOpen,
  onToggleAiBox: controlledOnToggleAiBox,
  onAiSubmit,
  onAiExpand,
  onAiStop,
  onAiUndo,
  onAiKeep,
  aiState: controlledAiState,
  aiLoading = false,
  aiContext,
  isViewOptionsOpen: controlledIsViewOptionsOpen,
  onToggleViewOptions: controlledOnToggleViewOptions,
  gridStyle: controlledGridStyle,
  onGridStyleChange: controlledOnGridStyleChange,
  gridSize: controlledGridSize,
  onGridSizeChange: controlledOnGridSizeChange,
  snapObjects: controlledSnapObjects,
  onToggleSnapObjects: controlledOnToggleSnapObjects,
  snapGuides: controlledSnapGuides,
  onToggleSnapGuides: controlledOnToggleSnapGuides,
  pixelGrid: controlledPixelGrid,
  onTogglePixelGrid: controlledOnTogglePixelGrid,
  checkerboard: controlledCheckerboard,
  onToggleCheckerboard: controlledOnToggleCheckerboard,
  theme: controlledTheme,
  onThemeChange: controlledOnThemeChange,
  motionFeel: controlledMotionFeel,
  onMotionFeelChange: controlledOnMotionFeelChange,
  dropdownBulge: controlledDropdownBulge,
  onDropdownBulgeChange: controlledOnDropdownBulgeChange,
  inspectMode: controlledInspectMode,
  onToggleInspectMode: controlledOnToggleInspectMode,
  canvasPan: controlledCanvasPan,
  onToggleCanvasPan: controlledOnToggleCanvasPan,
  canvasZoom: controlledCanvasZoom,
  onToggleCanvasZoom: controlledOnToggleCanvasZoom,
  worldAxes: controlledWorldAxes,
  onToggleWorldAxes: controlledOnToggleWorldAxes,
  elementDragging: controlledElementDragging,
  onToggleElementDragging: controlledOnToggleElementDragging,
  reparenting: controlledReparenting,
  onToggleReparenting: controlledOnToggleReparenting,
  collisionMode: controlledCollisionMode,
  onCollisionModeChange: controlledOnCollisionModeChange,
  marqueeMode: controlledMarqueeMode,
  onMarqueeModeChange: controlledOnMarqueeModeChange,
  snapToGrid: controlledSnapToGrid,
  onToggleSnapToGrid: controlledOnToggleSnapToGrid,
  smartGuides: controlledSmartGuides,
  onToggleSmartGuides: controlledOnToggleSmartGuides,
  snapThreshold: controlledSnapThreshold,
  onSnapThresholdChange: controlledOnSnapThresholdChange,
  onFocusSelection,
  onOpenWorldEnvironment,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  panelsCollapsed: controlledPanelsCollapsed,
  onTogglePanels: controlledOnTogglePanels,
  onPreview,
  users: _users,
}) => {
  // Controllable state pairs managed by useControllable helper
  const [showRulers, setShowRulers] = useControllable(
    controlledShowRulers,
    controlledOnToggleRulers,
    false
  );
  const [activeTool, setActiveTool] = useControllable(
    controlledActiveTool,
    controlledOnSelectTool,
    "select"
  );
  const [activeShape, setActiveShape] = useControllable(
    controlledActiveShape,
    controlledOnSelectShape,
    "box"
  );
  const [zoom, setZoom] = useControllable(
    controlledZoom,
    onZoomChange,
    0.5
  );
  const [isInsertOpen, setIsInsertOpen] = useControllable(
    controlledIsInsertOpen,
    controlledOnToggleInsert,
    false
  );
  const [isAiBoxOpen, setIsAiBoxOpen] = useControllable(
    controlledIsAiBoxOpen,
    controlledOnToggleAiBox,
    false
  );
  const [isViewOptionsOpen, setIsViewOptionsOpen] = useControllable(
    controlledIsViewOptionsOpen,
    controlledOnToggleViewOptions,
    false
  );

  const [gridStyle, setGridStyle] = useControllable(
    controlledGridStyle,
    controlledOnGridStyleChange,
    "dots"
  );
  const [gridSize, setGridSize] = useControllable(
    controlledGridSize,
    controlledOnGridSizeChange,
    24
  );
  const [snapObjects, setSnapObjects] = useControllable(
    controlledSnapObjects,
    controlledOnToggleSnapObjects,
    true
  );
  const [snapGuides, setSnapGuides] = useControllable(
    controlledSnapGuides,
    controlledOnToggleSnapGuides,
    false
  );
  const [pixelGrid, setPixelGrid] = useControllable(
    controlledPixelGrid,
    controlledOnTogglePixelGrid,
    false
  );
  const [checkerboard, setCheckerboard] = useControllable(
    controlledCheckerboard,
    controlledOnToggleCheckerboard,
    false
  );
  const [theme, setTheme] = useControllable(
    controlledTheme,
    controlledOnThemeChange,
    "paper"
  );
  const [motionFeel, setMotionFeel] = useControllable(
    controlledMotionFeel,
    controlledOnMotionFeelChange,
    "bouncy"
  );

  const handleThemeChange = useCallback(
    (nextTheme: string) => {
      setTheme(nextTheme);
      applyTheme(nextTheme as Theme);
    },
    [setTheme]
  );

  const handleMotionFeelChange = useCallback(
    (nextFeel: MotionFeel) => {
      setMotionFeel(nextFeel);
      applyFeel(nextFeel as MotionPresetKey);
    },
    [setMotionFeel]
  );
  const [dropdownBulge, setDropdownBulge] = useControllable(
    controlledDropdownBulge,
    controlledOnDropdownBulgeChange,
    50
  );
  const [inspectMode, setInspectMode] = useControllable(
    controlledInspectMode,
    controlledOnToggleInspectMode,
    false
  );
  const [canvasPan, setCanvasPan] = useControllable(
    controlledCanvasPan,
    controlledOnToggleCanvasPan,
    true
  );
  const [canvasZoom, setCanvasZoom] = useControllable(
    controlledCanvasZoom,
    controlledOnToggleCanvasZoom,
    true
  );
  const [worldAxes, setWorldAxes] = useControllable(
    controlledWorldAxes,
    controlledOnToggleWorldAxes,
    true
  );
  const [elementDragging, setElementDragging] = useControllable(
    controlledElementDragging,
    controlledOnToggleElementDragging,
    true
  );
  const [reparenting, setReparenting] = useControllable(
    controlledReparenting,
    controlledOnToggleReparenting,
    true
  );
  const [collisionMode, setCollisionMode] = useControllable(
    controlledCollisionMode,
    controlledOnCollisionModeChange,
    "pass"
  );
  const [marqueeMode, setMarqueeMode] = useControllable(
    controlledMarqueeMode,
    controlledOnMarqueeModeChange,
    "intersects"
  );
  const [snapToGrid, setSnapToGrid] = useControllable(
    controlledSnapToGrid,
    controlledOnToggleSnapToGrid,
    true
  );
  const [smartGuides, setSmartGuides] = useControllable(
    controlledSmartGuides,
    controlledOnToggleSmartGuides,
    true
  );
  const [snapThreshold, setSnapThreshold] = useControllable(
    controlledSnapThreshold,
    controlledOnSnapThresholdChange,
    6
  );
  const [panelsCollapsed, setPanelsCollapsed] = useControllable(
    controlledPanelsCollapsed,
    controlledOnTogglePanels,
    false
  );

  // Canvas right-click context menu position state
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  // Collaborator users resolution from prop or real src/core store
  const connectedPeers = useCollabStore((s) => s.connectedPeers);
  const localUser = useCollabStore((s) => s.localUser);

  const _storeUsers: CollabUser[] = React.useMemo(() => {
    const peers = Object.values(connectedPeers || {});
    if (peers.length === 0) return [];
    return [
      {
        id: localUser.id,
        name: localUser.name,
        initials: localUser.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        status: "You",
      },
      ...peers.map((p) => ({
        id: p.id,
        name: p.name,
        initials: p.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        status: p.role || "Viewing",
      })),
    ];
  }, [connectedPeers, localUser]);


  // Trigger button references for morph animations
  const insertButtonRef = useRef<HTMLButtonElement | null>(null);
  const aiButtonRef = useRef<HTMLButtonElement | null>(null);
  const topAnchorRef = useRef<HTMLDivElement | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // If stage worker or another component already handled this context menu
      if (e.defaultPrevented) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Do not open on toolbars, menus, dialogs, buttons, inputs
      if (
        target.closest(
          '[role="toolbar"], [role="menu"], [role="dialog"], .ll-fbar, .ll-ins, .ll-aibox, .ll-vpop, button, input, textarea, select'
        )
      ) {
        return;
      }

      // Do not open on canvas elements (stage handles element right-clicks)
      if (target.closest("[data-element], [data-layer], [data-sel]")) {
        return;
      }

      e.preventDefault();
      // Close other popovers if open
      setIsInsertOpen(false);
      setIsAiBoxOpen(false);
      setIsViewOptionsOpen(false);

      setContextMenuPos({ x: e.clientX, y: e.clientY });
    },
    [setIsInsertOpen, setIsAiBoxOpen, setIsViewOptionsOpen]
  );

  // Toggle handlers ensuring mutual exclusivity across floating popovers
  const handleToggleInsert = useCallback(() => {
    setIsInsertOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsAiBoxOpen(false);
        setIsViewOptionsOpen(false);
      }
      return next;
    });
  }, [setIsInsertOpen, setIsAiBoxOpen, setIsViewOptionsOpen]);

  const handleToggleAiBox = useCallback(() => {
    setIsAiBoxOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsInsertOpen(false);
        setIsViewOptionsOpen(false);
      }
      return next;
    });
  }, [setIsAiBoxOpen, setIsInsertOpen, setIsViewOptionsOpen]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(4, prev * 1.25));
    controlledOnZoomIn?.();
  }, [setZoom, controlledOnZoomIn]);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(0.1, prev / 1.25));
    controlledOnZoomOut?.();
  }, [setZoom, controlledOnZoomOut]);

  const handleZoom100 = useCallback(() => {
    setZoom(1.0);
    controlledOnZoom100?.();
  }, [setZoom, controlledOnZoom100]);

  const handleZoomFit = useCallback(() => {
    setZoom(0.5);
    controlledOnZoomFit?.();
  }, [setZoom, controlledOnZoomFit]);

  const handleZoomSelection = useCallback(() => {
    setZoom(1.2);
    controlledOnZoomSelection?.();
  }, [setZoom, controlledOnZoomSelection]);

  // Global keyboard shortcuts for canvas chrome (standalone only: the editor shell owns them when it controls the chrome)
  useEffect(() => {
    if (controlledShowRulers !== undefined) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement;

      if (e.key === "Escape") {
        if (contextMenuPos) setContextMenuPos(null);
        if (isInsertOpen) setIsInsertOpen(false);
        if (isAiBoxOpen) setIsAiBoxOpen(false);
        if (isViewOptionsOpen) setIsViewOptionsOpen(false);
        return;
      }

      if (isInput) return;

      if (e.key === "i" || e.key === "I") {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          handleToggleInsert();
        }
      } else if (e.key === "/") {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          handleToggleAiBox();
        }
      } else if (e.key === "R" && e.shiftKey) {
        e.preventDefault();
        setShowRulers((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isInsertOpen,
    isAiBoxOpen,
    isViewOptionsOpen,
    handleToggleInsert,
    handleToggleAiBox,
    setIsInsertOpen,
    setIsAiBoxOpen,
    setIsViewOptionsOpen,
    setShowRulers,
    controlledShowRulers,
    contextMenuPos,
  ]);

  // Stage grid style inline calculations using tokens without raw pixel literals
  const stageBackgroundStyle = React.useMemo(() => {
    if (checkerboard) {
      return {
        background:
          "repeating-conic-gradient(var(--ll-surface-canvas) 0 25%, var(--ll-surface-panel) 0 50%) 0 0 / var(--ll-spacing-6) var(--ll-spacing-6)",
      };
    }
    if (gridStyle === "dots") {
      return {
        backgroundImage:
          "radial-gradient(var(--ll-border-color) var(--ll-spacing-px), transparent var(--ll-spacing-px))",
        backgroundSize: `${gridSize}px ${gridSize}px`,
      };
    }
    if (gridStyle === "lines") {
      return {
        backgroundImage:
          "linear-gradient(var(--ll-surface-panel) var(--ll-spacing-px), transparent var(--ll-spacing-px)), linear-gradient(90deg, var(--ll-surface-panel) var(--ll-spacing-px), transparent var(--ll-spacing-px))",
        backgroundSize: `${gridSize}px ${gridSize}px`,
      };
    }
    return {
      backgroundColor: "var(--ll-surface-canvas)",
    };
  }, [checkerboard, gridStyle, gridSize]);

  return (
    <main
      role="main"
      aria-label="Canvas"
      data-center="true"
      data-testid="canvas-chrome"
      onContextMenu={handleContextMenu}
      className={`ll-center ll:relative ll:overflow-hidden ll:w-full ll:h-full ll:bg-surface-canvas ll:select-none ${
        !showRulers ? "ll-noruler" : ""
      }`}
    >
      <div className="ll-cv ll:relative ll:w-full ll:h-full ll:overflow-hidden">
        {/* Rulers */}
        <Rulers showRulers={showRulers} zoom={zoom} />

        {/* Stage wrapper containing stage and artboard slot */}
        <div
          className={`ll-stagewrap ll:absolute ll:overflow-hidden ${
            showRulers
              ? "ll:left-ruler ll:top-ruler ll:right-0 ll:bottom-0"
              : "ll:inset-0"
          }`}
        >
          {/* Background grid canvas */}
          <div
            data-stage="canvas"
            data-inspect={inspectMode ? "true" : undefined}
            className={`ll-stage ll:absolute ll:inset-0 ${inspectMode ? "ll-inspect" : ""}`}
            style={stageBackgroundStyle}
          >
            {/* Pixel Grid Overlay (.ll-pxgrid) */}
            {pixelGrid && (
              <div
                className="ll-pxgrid ll:absolute ll:inset-0 ll:pointer-events-none ll:opacity-25"
                style={{
                  backgroundImage:
                    "linear-gradient(var(--ll-border-color) var(--ll-spacing-px), transparent var(--ll-spacing-px)), linear-gradient(90deg, var(--ll-border-color) var(--ll-spacing-px), transparent var(--ll-spacing-px))",
                  backgroundSize:
                    "var(--ll-spacing-2) var(--ll-spacing-2)",
                }}
              />
            )}

            {/* Content Slot for Artboard and stage handles */}
            {children}
          </div>
        </div>
      </div>

      {/* Floating Toolbar & Zoom Bar */}
      <Toolbar
        mode={mode}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        activeShape={activeShape}
        onSelectShape={setActiveShape}
        isInsertOpen={isInsertOpen}
        onToggleInsert={handleToggleInsert}
        insertButtonRef={insertButtonRef}
        isAiBoxOpen={isAiBoxOpen}
        onToggleAiBox={handleToggleAiBox}
        aiButtonRef={aiButtonRef}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoom100={handleZoom100}
        onZoomFit={handleZoomFit}
        onZoomSelection={handleZoomSelection}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        panelsCollapsed={panelsCollapsed}
        onTogglePanels={() => setPanelsCollapsed((prev) => !prev)}
        onPreview={onPreview}
      />

      {/* Collaborator Avatars at canvas top-right (hidden per user decision) */}

      {/* Insert Box */}
      <InsertBox
        open={isInsertOpen}
        onClose={() => setIsInsertOpen(false)}
        onInsertItem={onInsertItem}
        triggerRef={insertButtonRef}
      />

      {/* AI Prompt Box */}
      <AiBox
        open={isAiBoxOpen}
        onClose={() => setIsAiBoxOpen(false)}
        onSubmit={onAiSubmit}
        onExpand={onAiExpand}
        onStop={onAiStop}
        onUndo={onAiUndo}
        onKeep={onAiKeep}
        triggerRef={aiButtonRef}
        context={aiContext}
        state={controlledAiState}
        aiLoading={aiLoading}
      />

      {/* Top bar anchor for View options popover */}
      <div
        ref={topAnchorRef}
        data-top-anchor="true"
        aria-hidden="true"
        className="ll:absolute ll:top-0 ll:left-4 ll:w-px ll:h-px ll:pointer-events-none"
      />

      {/* View Options Popover */}
      <ViewOptionsPopover
        open={isViewOptionsOpen}
        onClose={() => setIsViewOptionsOpen(false)}
        triggerRef={topAnchorRef}
        gridStyle={gridStyle}
        onGridStyleChange={setGridStyle}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
        snapObjects={snapObjects}
        onToggleSnapObjects={setSnapObjects}
        snapGuides={snapGuides}
        onToggleSnapGuides={setSnapGuides}
        showRulers={showRulers}
        onToggleRulers={setShowRulers}
        pixelGrid={pixelGrid}
        onTogglePixelGrid={setPixelGrid}
        checkerboard={checkerboard}
        onToggleCheckerboard={setCheckerboard}
        theme={theme}
        onThemeChange={handleThemeChange}
        motionFeel={motionFeel}
        onMotionFeelChange={handleMotionFeelChange}
        dropdownBulge={dropdownBulge}
        onDropdownBulgeChange={setDropdownBulge}
        inspectMode={inspectMode}
        onToggleInspectMode={setInspectMode}
        canvasPan={canvasPan}
        onToggleCanvasPan={setCanvasPan}
        canvasZoom={canvasZoom}
        onToggleCanvasZoom={setCanvasZoom}
        worldAxes={worldAxes}
        onToggleWorldAxes={setWorldAxes}
        elementDragging={elementDragging}
        onToggleElementDragging={setElementDragging}
        reparenting={reparenting}
        onToggleReparenting={setReparenting}
        collisionMode={collisionMode}
        onCollisionModeChange={setCollisionMode}
        marqueeMode={marqueeMode}
        onMarqueeModeChange={setMarqueeMode}
        snapToGrid={snapToGrid}
        onToggleSnapToGrid={setSnapToGrid}
        smartGuides={smartGuides}
        onToggleSmartGuides={setSmartGuides}
        snapThreshold={snapThreshold}
        onSnapThresholdChange={setSnapThreshold}
        onFocusSelection={onFocusSelection}
        onOpenWorldEnvironment={onOpenWorldEnvironment}
      />

      {/* Canvas Context Menu */}
      <CanvasContextMenu
        open={contextMenuPos !== null}
        onClose={() => setContextMenuPos(null)}
        position={contextMenuPos}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onInsert={() => {
          setIsInsertOpen(true);
          setContextMenuPos(null);
        }}
        onAddFrame={() => {
          setActiveTool("frame");
          setContextMenuPos(null);
        }}
        onAddText={() => {
          setActiveTool("text");
          setContextMenuPos(null);
        }}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoom100={handleZoom100}
        onZoomFit={handleZoomFit}
        showRulers={showRulers}
        onToggleRulers={() => setShowRulers((prev) => !prev)}
        pixelGrid={pixelGrid}
        onTogglePixelGrid={() => setPixelGrid((prev) => !prev)}
        snapObjects={snapObjects}
        onToggleSnapObjects={() => setSnapObjects((prev) => !prev)}
        snapGuides={snapGuides}
        onToggleSnapGuides={() => setSnapGuides((prev) => !prev)}
        checkerboard={checkerboard}
        onToggleCheckerboard={() => setCheckerboard((prev) => !prev)}
        panelsCollapsed={panelsCollapsed}
        onTogglePanels={() => setPanelsCollapsed((prev) => !prev)}
        theme={theme}
        onThemeChange={handleThemeChange}
        onOpenCanvasSettings={() => {
          setIsViewOptionsOpen(true);
          setContextMenuPos(null);
        }}
      />
    </main>
  );
};