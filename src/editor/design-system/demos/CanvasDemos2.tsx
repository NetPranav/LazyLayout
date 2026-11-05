"use client";

import React, { useState, useRef } from "react";
import { Toolbar } from "@/editor/shell/canvas-chrome/Toolbar";
import { InsertBox } from "@/editor/shell/canvas-chrome/InsertBox";
import { AiBox } from "@/editor/shell/canvas-chrome/AiBox";
import { ViewOptionsPopover } from "@/editor/shell/canvas-chrome/ViewOptionsPopover";
import { CanvasContextMenu } from "@/editor/shell/canvas-chrome/CanvasContextMenu";
import { Rulers } from "@/editor/shell/canvas-chrome/Rulers";
import { Artboard } from "@/editor/stage/Artboard";
import { TransformOverlay } from "@/editor/stage/TransformOverlay";
import { Button } from "@/editor/components/Button";
import type { CanvasTool, ShapeTool, GridStyle, MotionFeel, AiState } from "@/editor/shell/canvas-chrome/types";
import type { StageElement, StagePreset } from "@/editor/stage/types";

/* =========================================================================
   1. TOOLBAR & ZOOM BAR DEMO (Design & Motion modes)
   ========================================================================= */
export function ToolbarDesignModeDemo() {
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [activeShape, setActiveShape] = useState<ShapeTool>("box");
  const [zoom, setZoom] = useState(1);
  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [isAiBoxOpen, setIsAiBoxOpen] = useState(false);
  const [panelsCollapsed, setPanelsCollapsed] = useState(false);
  const [canUndo, setCanUndo] = useState(true);
  const [canRedo, setCanRedo] = useState(false);

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h3 className="ll:text-lead ll:font-semibold ll:text-primary ll:font-sans">Toolbar &mdash; Design Mode</h3>
        <p className="ll:text-small ll:text-secondary">
          Geometry: Tool bar 443&times;50px, Zoom bar 186&times;50px, 40px buttons, 16px above bottom edge.
        </p>
      </div>
      <div className="ll:relative ll:h-36 ll:w-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
        <Toolbar
          mode="design"
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          activeShape={activeShape}
          onSelectShape={setActiveShape}
          isInsertOpen={isInsertOpen}
          onToggleInsert={() => setIsInsertOpen((prev) => !prev)}
          isAiBoxOpen={isAiBoxOpen}
          onToggleAiBox={() => setIsAiBoxOpen((prev) => !prev)}
          zoom={zoom}
          onZoomIn={() => setZoom((z) => Math.min(4, +(z * 1.25).toFixed(2)))}
          onZoomOut={() => setZoom((z) => Math.max(0.1, +(z * 0.8).toFixed(2)))}
          onZoom100={() => setZoom(1)}
          onZoomFit={() => setZoom(0.59)}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => {
            setCanUndo(false);
            setCanRedo(true);
          }}
          onRedo={() => {
            setCanUndo(true);
            setCanRedo(false);
          }}
          panelsCollapsed={panelsCollapsed}
          onTogglePanels={() => setPanelsCollapsed((p) => !p)}
        />
      </div>
    </div>
  );
}

export function ToolbarMotionModeDemo() {
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [isPlaying, setIsPlaying] = useState(false);
  const [keyframeCount, setKeyframeCount] = useState(0);

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h3 className="ll:text-lead ll:font-semibold ll:text-primary ll:font-sans">Toolbar &mdash; Motion Mode (.mtools)</h3>
        <p className="ll:text-small ll:text-secondary">
          Motion mode tool group: Select, Hand | Add keyframe (K), Play preview (Space).
        </p>
      </div>
      <div className="ll:relative ll:h-36 ll:w-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
        <Toolbar
          mode="motion"
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onAddKeyframe={() => setKeyframeCount((c) => c + 1)}
          zoom={0.59}
        />
      </div>
      <div className="ll:text-micro ll:font-mono ll:text-secondary">
        Status: {isPlaying ? "Playing" : "Paused"} &middot; Added keyframes: {keyframeCount}
      </div>
    </div>
  );
}

/* =========================================================================
   2. INSERT BOX DEMO
   ========================================================================= */
export function InsertBoxDemo() {
  const [open, setOpen] = useState(true);
  const [insertedItem, setInsertedItem] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div className="ll:flex ll:items-center ll:justify-between">
        <div>
          <h3 className="ll:text-lead ll:font-semibold ll:text-primary ll:font-sans">Insert Box (520&times;400px)</h3>
          <p className="ll:text-small ll:text-secondary">
            Search, category sidebar (Basics, Sections, Components, Assets, Fonts, Recent), 97&times;72 thumbnail cards.
          </p>
        </div>
        <Button
          ref={triggerRef}
          variant="secondary"
          size="sm"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "Close Insert Box" : "Open Insert Box"}
        </Button>
      </div>

      <div className="ll:relative ll:h-128 ll:w-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
        <InsertBox
          open={open}
          onClose={() => setOpen(false)}
          onInsertItem={(name) => setInsertedItem(name)}
          triggerRef={triggerRef}
        />
      </div>
      {insertedItem && (
        <div className="ll:text-micro ll:font-mono ll:text-primary">
          Inserted element: {insertedItem}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   3. AI PROMPT BOX DEMO (Idle, Work, Done states)
   ========================================================================= */
export function AiBoxDemo() {
  const [open, setOpen] = useState(true);
  const [state, setState] = useState<AiState>("idle");
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div className="ll:flex ll:items-center ll:justify-between">
        <div>
          <h3 className="ll:text-lead ll:font-semibold ll:text-primary ll:font-sans">AI Prompt Box (443px width)</h3>
          <p className="ll:text-small ll:text-secondary">
            Context chip, auto-expanding prompt, suggestion chips, 2.4s trace loader, Done state with Undo/Keep.
          </p>
        </div>
        <div className="ll:flex ll:items-center ll:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setState("idle")}
          >
            Idle State
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setState("work")}
          >
            Work (Trace)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setState("done")}
          >
            Done State
          </Button>
          <Button
            ref={triggerRef}
            variant="secondary"
            size="sm"
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? "Close" : "Open"}
          </Button>
        </div>
      </div>

      <div className="ll:relative ll:h-72 ll:w-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
        <AiBox
          open={open}
          onClose={() => setOpen(false)}
          state={state}
          context={{ name: "Headline", type: "text" }}
          triggerRef={triggerRef}
          onUndo={() => setState("idle")}
          onKeep={() => setState("idle")}
          onStop={() => setState("idle")}
        />
      </div>
    </div>
  );
}

/* =========================================================================
   4. VIEW OPTIONS POPOVER DEMO (All 8 Themes, Motions, Controls)
   ========================================================================= */
export function ViewOptionsPopoverDemo() {
  const [open, setOpen] = useState(true);
  const [theme, setTheme] = useState("paper");
  const [gridStyle, setGridStyle] = useState<GridStyle>("dots");
  const [gridSize, setGridSize] = useState(24);
  const [snapObjects, setSnapObjects] = useState(true);
  const [snapGuides, setSnapGuides] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [pixelGrid, setPixelGrid] = useState(false);
  const [checkerboard, setCheckerboard] = useState(false);
  const [motionFeel, setMotionFeel] = useState<MotionFeel>("bouncy");
  const [dropdownBulge, setDropdownBulge] = useState(50);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div className="ll:flex ll:items-center ll:justify-between">
        <div>
          <h3 className="ll:text-lead ll:font-semibold ll:text-primary ll:font-sans">View Options Popover</h3>
          <p className="ll:text-small ll:text-secondary">
            All 8 themes (Paper, White, Warm, Lilac, Noir, Dark, Graphite, Darkroom), Motion feel, Dropdown bulge, Canvas toggles.
          </p>
        </div>
        <Button
          ref={triggerRef}
          variant="secondary"
          size="sm"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "Close Popover" : "Open Popover"}
        </Button>
      </div>

      <div className="ll:relative ll:h-144 ll:w-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
        <ViewOptionsPopover
          open={open}
          onClose={() => setOpen(false)}
          triggerRef={triggerRef}
          theme={theme}
          onThemeChange={setTheme}
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
          motionFeel={motionFeel}
          onMotionFeelChange={setMotionFeel}
          dropdownBulge={dropdownBulge}
          onDropdownBulgeChange={setDropdownBulge}
        />
      </div>
    </div>
  );
}

/* =========================================================================
   5. CONTEXT MENUS DEMO (Canvas & Element menus)
   ========================================================================= */
export function ContextMenusDemo() {
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>({ x: 200, y: 80 });

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div className="ll:flex ll:items-center ll:justify-between">
        <div>
          <h3 className="ll:text-lead ll:font-semibold ll:text-primary ll:font-sans">Context Menus</h3>
          <p className="ll:text-small ll:text-secondary">
            Canvas and Element context menus matching MENUS.canvas / elem / zoom / view with submenus on hover or click.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setContextPos({ x: 220, y: 100 })}
        >
          Re-open Canvas Context Menu
        </Button>
      </div>

      <div
        className="ll:relative ll:h-96 ll:w-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden"
        onContextMenu={(e) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          setContextPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      >
        <span className="ll:absolute ll:left-4 ll:top-4 ll:text-nano ll:font-mono ll:text-muted">
          Right-click anywhere in this box to reposition the context menu.
        </span>

        <CanvasContextMenu
          open={contextPos !== null}
          onClose={() => setContextPos(null)}
          position={contextPos}
          canUndo={true}
          canRedo={false}
        />
      </div>
    </div>
  );
}

/* =========================================================================
   6. STAGE & ARTBOARD DEMO (Rulers, Presets, Handles, Guides)
   ========================================================================= */
export function StageAndArtboardDemo() {
  const [preset, setPreset] = useState<StagePreset>("1440");
  const [zoom, setZoom] = useState(0.59);
  const [selectedIds, setSelectedIds] = useState<string[]>(["headline"]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const sampleElements: Record<string, StageElement> = {
    headline: {
      id: "headline",
      name: "Headline",
      type: "text",
      x: 36,
      y: 70,
      width: 340,
      height: 82,
      rotation: 0,
      title: "Ship interfaces at the speed of thought",
    },
    button: {
      id: "button",
      name: "Get started",
      type: "button",
      x: 36,
      y: 226,
      width: 112,
      height: 34,
      rotation: 0,
      label: "Get started",
    },
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h3 className="ll:text-lead ll:font-semibold ll:text-primary ll:font-sans">Stage &mdash; Artboard &amp; Rulers</h3>
        <p className="ll:text-small ll:text-secondary">
          Artboard (600&times;380px), Desktop 1440 / Tablet 768 / Mobile 375 menu, 8 selection handles with dimension badge, top and left rulers.
        </p>
      </div>

      <div className="ll:relative ll:h-128 ll:w-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
        <Rulers showRulers={true} zoom={zoom} />

        <div className="ll:absolute ll:left-ruler ll:top-ruler ll:right-0 ll:bottom-0 ll:overflow-hidden">
          <Artboard
            preset={preset}
            onPresetChange={setPreset}
            zoom={zoom}
            elements={sampleElements}
            selectedIds={selectedIds}
            hoveredId={hoveredId}
            onSelect={(id) => setSelectedIds(id ? [id] : [])}
            onHover={setHoveredId}
            snapGuides={true}
          />
        </div>
      </div>
    </div>
  );
}
