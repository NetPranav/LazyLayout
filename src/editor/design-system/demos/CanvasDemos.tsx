"use client";

import React, { useState, useRef } from "react";

import { Toolbar } from "@/editor/shell/canvas-chrome/Toolbar";
import { InsertBox } from "@/editor/shell/canvas-chrome/InsertBox";
import { AiBox } from "@/editor/shell/canvas-chrome/AiBox";
import { ViewOptionsPopover } from "@/editor/shell/canvas-chrome/ViewOptionsPopover";
import { Rulers } from "@/editor/shell/canvas-chrome/Rulers";
import { TransformOverlay } from "@/editor/stage/TransformOverlay";
import { Button } from "@/editor/components/Button";
import type { CanvasTool, ShapeTool } from "@/editor/shell/canvas-chrome/types";
import type { StageElement } from "@/editor/stage/types";

/* =========================================================================
   1. TOOLBAR & ZOOM DEMO
   ========================================================================= */
export function ToolbarDemo() {
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [activeShape, setActiveShape] = useState<ShapeTool>("box");
  const [zoom, setZoom] = useState(1);
  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [isAiBoxOpen, setIsAiBoxOpen] = useState(false);
  const [panelsCollapsed, setPanelsCollapsed] = useState(false);
  const [canUndo, setCanUndo] = useState(true);
  const [canRedo, setCanRedo] = useState(false);
  const insertBtnRef = useRef<HTMLButtonElement | null>(null);
  const aiBtnRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Toolbar &amp; Zoom Bar</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Floating Canvas Chrome (Tool Bar 443x50, Zoom Bar 186x50, 40px Buttons &amp; 32x40 Tall Toggle)
        </span>
      </div>

      {/* 1. Exact Dimensions Specification Card */}
      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Layout Geometry &amp; Fixed Sizes
        </div>
        <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:gap-4">
          <div className="ll:p-4 ll:bg-surface-bar ll:border ll:border-border ll:rounded-md ll:flex ll:flex-col ll:gap-1.5">
            <span className="ll:text-small ll:font-semibold ll:text-primary">Center Tool Bar: 443x50px</span>
            <span className="ll:text-micro ll:text-secondary">
              Contains 9 action items with 40px buttons (IconButton size <code className="ll:font-mono">lg</code>), 4px padding, 8px radius (<code className="ll:font-mono">--ll-radius-lg</code>) and soft shadow.
            </span>
          </div>

          <div className="ll:p-4 ll:bg-surface-bar ll:border ll:border-border ll:rounded-md ll:flex ll:flex-col ll:gap-1.5">
            <span className="ll:text-small ll:font-semibold ll:text-primary">Right Zoom Bar: 186x50px</span>
            <span className="ll:text-micro ll:text-secondary">
              Contains the Panels toggle (IconButton size <code className="ll:font-mono">tall</code>, 32x40px), Undo/Redo buttons (28px) and Zoom Percentage trigger.
            </span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Canvas Floating Toolbar Stage */}
      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Interactive Canvas Floating Toolbar (Try Tools, Shapes, Panels Toggle &amp; Zoom)
        </div>
        <div className="ll:relative ll:h-48 ll:rounded-md ll:border ll:border-border ll:bg-surface-canvas ll:p-6 ll:flex ll:items-end ll:justify-center">
          <Toolbar
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            activeShape={activeShape}
            onSelectShape={setActiveShape}
            isInsertOpen={isInsertOpen}
            onToggleInsert={() => setIsInsertOpen((prev) => !prev)}
            insertButtonRef={insertBtnRef}
            isAiBoxOpen={isAiBoxOpen}
            onToggleAiBox={() => setIsAiBoxOpen((prev) => !prev)}
            aiButtonRef={aiBtnRef}
            zoom={zoom}
            onZoomIn={() => setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
            onZoomOut={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.25) * 100) / 100))}
            onZoom100={() => setZoom(1)}
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

        {/* Live Status and Interactive Controls */}
        <div className="ll:flex ll:flex-wrap ll:items-center ll:justify-between ll:gap-4 ll:p-4 ll:bg-surface-bar ll:border ll:border-border ll:rounded-md">
          <div className="ll:flex ll:items-center ll:gap-3 ll:text-small ll:text-secondary">
            <span>Active Tool: <strong className="ll:text-primary ll:uppercase">{activeTool}</strong></span>
            <span>·</span>
            <span>Zoom: <strong className="ll:text-primary">{Math.round(zoom * 100)}%</strong></span>
            <span>·</span>
            <span>Panels: <strong className="ll:text-primary">{panelsCollapsed ? "Hidden (Collapsed)" : "Visible (Open)"}</strong></span>
          </div>

          <div className="ll:flex ll:items-center ll:gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCanUndo(!canUndo);
                setCanRedo(!canRedo);
              }}
            >
              Toggle Undo/Redo Availability
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPanelsCollapsed(!panelsCollapsed)}
            >
              Toggle Panels State
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   2. INSERT BOX DEMO
   ========================================================================= */
export function InsertBoxDemo() {
  const [open, setOpen] = useState(true);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">InsertBox</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Floating Component Insert Modal (Categories, Search &amp; Wireframe Previews)
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div className="ll:flex ll:items-center ll:gap-4">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? "Hide InsertBox" : "Show InsertBox"}
          </Button>
        </div>

        {open && (
          <div className="ll:relative ll:h-108 ll:rounded-md ll:border ll:border-border ll:bg-surface-canvas ll:flex ll:items-center ll:justify-center ll:overflow-hidden">
            <InsertBox
              open={open}
              onClose={() => setOpen(false)}
              onInsertItem={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   3. AI BOX DEMO
   ========================================================================= */
export function AiBoxDemo() {
  const [demoState, setDemoState] = useState<"idle" | "working" | "done">("idle");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">AiBox</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Floating AI Prompt Input (Idle, Working with 2.4s Trace Loader, Done)
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div className="ll:flex ll:items-center ll:gap-3">
          <Button
            variant={demoState === "idle" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setDemoState("idle")}
          >
            Idle State
          </Button>
          <Button
            variant={demoState === "working" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setDemoState("working")}
          >
            Working (Trace Loader)
          </Button>
          <Button
            variant={demoState === "done" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setDemoState("done")}
          >
            Done State
          </Button>
        </div>

        <div className="ll:relative ll:h-72 ll:rounded-md ll:border ll:border-border ll:bg-surface-canvas ll:flex ll:items-center ll:justify-center">
          <AiBox
            open={true}
            onClose={() => {}}
            state={demoState === "working" ? "work" : demoState}
            aiLoading={demoState === "working"}
            context={{ name: "Hero Section", type: "frame" }}
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   4. VIEW OPTIONS POPOVER DEMO
   ========================================================================= */
export function ViewOptionsPopoverDemo() {
  const [gridStyle, setGridStyle] = useState<"none" | "dots" | "lines">("dots");
  const [showRulers, setShowRulers] = useState(true);
  const [snapObjects, setSnapObjects] = useState(true);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">ViewOptionsPopover</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Canvas View Toggles, Grid Options &amp; Appearance Settings
        </span>
      </div>

      <div className="ll:relative ll:h-128 ll:rounded-md ll:border ll:border-border ll:bg-surface-canvas ll:flex ll:items-center ll:justify-center">
        <ViewOptionsPopover
          open={true}
          onClose={() => {}}
          gridStyle={gridStyle}
          onGridStyleChange={setGridStyle}
          showRulers={showRulers}
          onToggleRulers={setShowRulers}
          snapObjects={snapObjects}
          onToggleSnapObjects={setSnapObjects}
        />
      </div>
    </div>
  );
}

/* =========================================================================
   5. RULERS DEMO
   ========================================================================= */
export function RulersDemo() {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Rulers</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Canvas Rulers with Adaptive Zoom Ticks and Origin Corner (.rc0)
        </span>
      </div>

      <div className="ll:flex ll:items-center ll:gap-4">
        <Button variant="secondary" size="sm" onClick={() => setZoom(0.5)}>Zoom 50%</Button>
        <Button variant="secondary" size="sm" onClick={() => setZoom(1)}>Zoom 100%</Button>
        <Button variant="secondary" size="sm" onClick={() => setZoom(1.5)}>Zoom 150%</Button>
        <span className="ll:text-small ll:text-secondary">Current Zoom: <strong className="ll:text-primary">{Math.round(zoom * 100)}%</strong></span>
      </div>

      <div className="ll:relative ll:h-64 ll:rounded-md ll:border ll:border-border ll:bg-surface-canvas ll:overflow-hidden">
        <Rulers showRulers={true} zoom={zoom} />
        <div className="ll:absolute ll:inset-8 ll:flex ll:items-center ll:justify-center ll:text-small ll:text-muted">
          Canvas measurement ticks scale with zoom level
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   6. STAGE & SELECTION HANDLES DEMO
   ========================================================================= */
const SAMPLE_ELEMENTS: Record<string, StageElement> = {
  headline: {
    id: "headline",
    name: "Headline",
    type: "text",
    x: 40,
    y: 40,
    width: 280,
    height: 72,
  },
  button: {
    id: "button",
    name: "Primary CTA",
    type: "button",
    x: 40,
    y: 136,
    width: 140,
    height: 36,
  },
  card: {
    id: "card",
    name: "Media Card",
    type: "image",
    x: 360,
    y: 40,
    width: 200,
    height: 132,
  },
};

export function StageSelectionDemo() {
  const [selectedIds, setSelectedIds] = useState<string[]>(["headline"]);
  const [hoveredId, setHoveredId] = useState<string | null>("card");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Stage &amp; Selection Handles</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Selection Outline, 8 Corner/Edge Resize Handles, Hover Outline &amp; Size Badge (.dim)
        </span>
      </div>

      <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSelectedIds(["headline"])}
        >
          Select Headline
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSelectedIds(["headline", "button"])}
        >
          Multi-Select (Headline + CTA)
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setHoveredId(hoveredId === "card" ? null : "card")}
        >
          Toggle Hover Outline on Card
        </Button>
      </div>

      <div className="ll:relative ll:h-80 ll:w-full ll:rounded-md ll:border ll:border-border ll:bg-surface-canvas ll:overflow-hidden">
        {/* Render elements */}
        {Object.values(SAMPLE_ELEMENTS).map((el) => (
          <div
            key={el.id}
            onClick={() => setSelectedIds([el.id])}
            onMouseEnter={() => setHoveredId(el.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              left: el.x,
              top: el.y,
              width: el.width,
              height: el.height,
            }}
            className="ll:absolute ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:p-3 ll:cursor-pointer ll:select-none ll:flex ll:flex-col ll:justify-between"
          >
            <span className="ll:text-small ll:font-semibold ll:text-primary">{el.name}</span>
            <span className="ll:text-micro ll:font-mono ll:text-muted">{el.width} × {el.height}</span>
          </div>
        ))}

        {/* Transform overlay */}
        <TransformOverlay
          selectedIds={selectedIds}
          hoveredId={hoveredId}
          elements={SAMPLE_ELEMENTS}
          onStartMove={() => {}}
          onStartResize={() => {}}
        />
      </div>
    </div>
  );
}
