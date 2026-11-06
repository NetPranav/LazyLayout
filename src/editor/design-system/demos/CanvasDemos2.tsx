"use client";

import React, { useState, useRef } from "react";
import { Toolbar } from "@/editor/shell/canvas-chrome/Toolbar";
import { InsertBox } from "@/editor/shell/canvas-chrome/InsertBox";
import { AiBox } from "@/editor/shell/canvas-chrome/AiBox";
import { ViewOptionsPopover } from "@/editor/shell/canvas-chrome/ViewOptionsPopover";
import { CanvasContextMenu } from "@/editor/shell/canvas-chrome/CanvasContextMenu";
import { Rulers } from "@/editor/shell/canvas-chrome/Rulers";
import { Artboard } from "@/editor/stage/Artboard";
import { MotionPathOverlay } from "@/editor/stage/MotionPathOverlay";
import { Button } from "@/editor/components/Button";
import type { CanvasTool, ShapeTool, GridStyle, MotionFeel, AiState } from "@/editor/shell/canvas-chrome/types";
import type { StageElement, StagePreset } from "@/editor/stage/types";
import type { Clip, Layer } from "@/core/document/schema";

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
  const [zoom] = useState(0.59);
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

/* =========================================================================
   7. MOTION PATH OVERLAY DEMO (Phase 69 Milestones 4 & 5)
   ========================================================================= */
export function MotionPathOverlayDemo() {
  const [currentTime, setCurrentTime] = useState(0.85);
  const [showTicks, setShowTicks] = useState(true);
  const [showTangents, setShowTangents] = useState(true);
  const [showPlayhead, setShowPlayhead] = useState(true);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>("k1");
  const [zoom, setZoom] = useState(1);

  const demoLayer: Layer = {
    id: "demo-box",
    name: "Hero Element",
    archetype: "rectangle",
    parentId: null,
    children: [],
    properties: {
      "frame.x": 60,
      "frame.y": 60,
      "frame.width": 80,
      "frame.height": 50,
      "transform.x": 0,
      "transform.y": 0,
    },
  };

  const initialClip: Clip = {
    id: "clip-demo",
    layerId: "demo-box",
    name: "CanvasArcMotion",
    type: "entrance",
    trigger: "mount",
    duration: 2,
    easing: "linear",
    enabled: true,
    tracks: [
      {
        id: "tx",
        property: "transform.x",
        keyframes: [
          { id: "k0", time: 0, value: 0 },
          { id: "k1", time: 1, value: 220 },
          { id: "k2", time: 2, value: 440 },
        ],
      },
      {
        id: "ty",
        property: "transform.y",
        keyframes: [
          { id: "ky0", time: 0, value: 0 },
          { id: "ky1", time: 1, value: 160 },
          { id: "ky2", time: 2, value: 20 },
        ],
      },
    ],
    spatialTrajectories: {
      transform: {
        id: "st-demo",
        propertyGroup: "transform",
        enabled: true,
        waypoints: [
          { id: "k0", time: 0, mode: "bezier", spatialOut: { x: 80, y: 100 } },
          { id: "k1", time: 1, mode: "continuous", handleStyle: "aligned", spatialIn: { x: -60, y: 40 }, spatialOut: { x: 60, y: -40 } },
          { id: "k2", time: 2, mode: "linear" },
        ],
      },
    },
  };

  const [clip, setClip] = useState<Clip>(initialClip);

  const elements: Record<string, StageElement> = {
    "demo-box": { id: "demo-box", x: 60, y: 60, width: 80, height: 50 },
  };

  const handleWaypointChange = (clipId: string, waypointId: string, pos: { x: number; y: number }) => {
    setClip((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as Clip;
      const trackX = next.tracks.find((t) => t.property === "transform.x");
      const trackY = next.tracks.find((t) => t.property === "transform.y");
      const kfX = trackX?.keyframes.find((k) => k.id === waypointId);
      const kfY = trackY?.keyframes.find((k) => k.id === waypointId || (kfX && Math.abs(k.time - kfX.time) < 1e-4));
      if (kfX) kfX.value = pos.x;
      if (kfY) kfY.value = pos.y;
      return next;
    });
  };

  const handleTangentChange = (
    clipId: string,
    waypointId: string,
    patch: { spatialIn?: { x: number; y: number }; spatialOut?: { x: number; y: number } }
  ) => {
    setClip((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as Clip;
      const wp = next.spatialTrajectories?.transform?.waypoints.find((w) => w.id === waypointId);
      if (wp) {
        if (patch.spatialIn !== undefined) wp.spatialIn = patch.spatialIn;
        if (patch.spatialOut !== undefined) wp.spatialOut = patch.spatialOut;
      }
      return next;
    });
  };

  const handleModeChange = (mode: "linear" | "bezier" | "continuous") => {
    if (!selectedWaypointId) return;
    setClip((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as Clip;
      const wp = next.spatialTrajectories?.transform?.waypoints.find((w) => w.id === selectedWaypointId);
      if (wp) {
        wp.mode = mode;
        if (mode === "linear") {
          delete wp.spatialIn;
          delete wp.spatialOut;
        } else if (!wp.spatialOut && !wp.spatialIn) {
          wp.spatialOut = { x: 50, y: 0 };
          if (mode === "continuous") wp.spatialIn = { x: -50, y: 0 };
        }
      }
      return next;
    });
  };

  const handleReset = () => {
    setClip(initialClip);
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h3 className="ll:text-lead ll:font-semibold ll:text-primary ll:font-sans">
          Canvas &mdash; Motion Path Overlay (Phase 69 Interactive)
        </h3>
        <p className="ll:text-small ll:text-secondary">
          Interactive motion paths on the canvas: click and drag keyframe waypoint handles to reshape the trajectory, grab tangent arms to manipulate curvature in real-time, and scrub playback along canonical geometry.
        </p>
      </div>

      {/* Interactive Controls Bar */}
      <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-4 ll:p-3 ll:bg-surface-bar ll:border ll:border-border ll:rounded-md">
        <div className="ll:flex ll:items-center ll:gap-2">
          <span className="ll:text-micro ll:font-mono ll:text-secondary">Scrub: {currentTime.toFixed(2)}s</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={currentTime}
            onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
            className="ll:w-32 ll:accent-primary"
            aria-label="Scrub playhead time"
          />
        </div>

        <div className="ll:flex ll:items-center ll:gap-2">
          <span className="ll:text-micro ll:font-mono ll:text-secondary">Zoom: {zoom}x</span>
          <Button size="sm" variant={zoom === 0.75 ? "primary" : "secondary"} onClick={() => setZoom(0.75)}>0.75x</Button>
          <Button size="sm" variant={zoom === 1 ? "primary" : "secondary"} onClick={() => setZoom(1)}>1x</Button>
          <Button size="sm" variant={zoom === 1.5 ? "primary" : "secondary"} onClick={() => setZoom(1.5)}>1.5x</Button>
        </div>

        <div className="ll:flex ll:items-center ll:gap-2">
          <Button size="sm" variant={showTicks ? "primary" : "secondary"} onClick={() => setShowTicks((v) => !v)}>
            Ticks {showTicks ? "On" : "Off"}
          </Button>
          <Button size="sm" variant={showTangents ? "primary" : "secondary"} onClick={() => setShowTangents((v) => !v)}>
            Tangents {showTangents ? "On" : "Off"}
          </Button>
          <Button size="sm" variant={showPlayhead ? "primary" : "secondary"} onClick={() => setShowPlayhead((v) => !v)}>
            Playhead {showPlayhead ? "On" : "Off"}
          </Button>
        </div>

        {selectedWaypointId && (
          <div className="ll:flex ll:items-center ll:gap-2 ll:pl-2 ll:border-l ll:border-border">
            <span className="ll:text-micro ll:font-mono ll:text-secondary">Waypoint [{selectedWaypointId}]:</span>
            <Button size="sm" variant="secondary" onClick={() => handleModeChange("linear")}>Linear</Button>
            <Button size="sm" variant="secondary" onClick={() => handleModeChange("bezier")}>Bezier</Button>
            <Button size="sm" variant="secondary" onClick={() => handleModeChange("continuous")}>Continuous</Button>
          </div>
        )}

        <Button size="sm" variant="secondary" onClick={handleReset}>Reset Trajectory</Button>
      </div>

      {/* Canvas Viewport */}
      <div className="ll:relative ll:h-80 ll:w-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
        <div
          className="ll:absolute ll:inset-0 ll:transition-transform"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          {/* Base Element Box */}
          <div
            className="ll:absolute ll:border ll:border-primary ll:rounded-sm ll:bg-surface-panel ll:flex ll:items-center ll:justify-center ll:text-micro ll:font-mono ll:text-secondary"
            style={{
              left: elements["demo-box"].x,
              top: elements["demo-box"].y,
              width: elements["demo-box"].width,
              height: elements["demo-box"].height,
            }}
          >
            Origin Box
          </div>

          {/* Motion Path Overlay */}
          <MotionPathOverlay
            selectedIds={["demo-box"]}
            elements={elements}
            layers={{ "demo-box": demoLayer }}
            clips={{ [clip.id]: clip }}
            currentTime={currentTime}
            zoom={zoom}
            fps={30}
            showTicks={showTicks}
            showTangents={showTangents}
            showPlayhead={showPlayhead}
            interactive={true}
            selectedWaypointId={selectedWaypointId}
            onSelectWaypoint={setSelectedWaypointId}
            onWaypointChange={handleWaypointChange}
            onTangentChange={handleTangentChange}
          />
        </div>
      </div>
    </div>
  );
}
