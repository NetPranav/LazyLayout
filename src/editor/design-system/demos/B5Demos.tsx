"use client";

import React, { useState, useRef } from "react";
import { Toolbar } from "@/editor/shell/canvas-chrome/Toolbar";
import { Spotlight } from "@/editor/shell/canvas-chrome/Spotlight";
import { Button } from "@/editor/components/Button";
import { ModeTabs, type EditorMode } from "@/editor/components/ModeTabs";
import type { CanvasTool, ShapeTool } from "@/editor/shell/canvas-chrome/types";
import type { EasingOption, ExportOption } from "@/editor/shell/canvas-chrome/constants";

export function B5Demos() {
  const [mode, setMode] = useState<EditorMode>("design");
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [activeShape, setActiveShape] = useState<ShapeTool>("box");
  const [activeEasing, setActiveEasing] = useState<EasingOption>("Ease out");
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [zoom, setZoom] = useState(0.9);
  const [panelsCollapsed, setPanelsCollapsed] = useState(false);
  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [isAiBoxOpen, setIsAiBoxOpen] = useState(false);
  const [isFramePresetsOpen, setIsFramePresetsOpen] = useState(false);

  const interactiveContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="ll:flex ll:flex-col ll:gap-10">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          B5: Canvas Chrome (Per-Mode Toolbars & Spotlight)
        </h2>
        <p className="ll:text-small ll:text-muted ll:mt-1">
          Lean per-mode floating toolbars with carets right of icons, mode-switch morphing,
          narrow-canvas lift, and the Spotlight command panel bound to real commands.
        </p>
      </div>

      {/* SECTION 1: Interactive Canvas Chrome Preview with Mode Switcher */}
      <div className="ll:flex ll:flex-col ll:gap-3">
        <div className="ll:flex ll:items-center ll:justify-between">
          <span className="ll:text-small ll:font-medium ll:text-secondary">
            1. Interactive Floating Toolbar with Per-Mode Morphing & Spotlight
          </span>
          <div className="ll:flex ll:items-center ll:gap-3">
            <ModeTabs mode={mode} onChange={setMode} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsSpotlightOpen(true)}
            >
              Open Spotlight (Ctrl+K or /)
            </Button>
          </div>
        </div>

        <div
          ref={interactiveContainerRef}
          className="ll:relative ll:h-72 ll:w-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:flex ll:items-center ll:justify-center"
        >
          <span className="ll:text-micro ll:font-mono ll:text-muted ll:select-none">
            Canvas area (Active mode: {mode}) — Press Ctrl+K or / for Spotlight
          </span>

          <Toolbar
            mode={mode}
            activeTool={activeTool}
            onSelectTool={(t) => setActiveTool(t)}
            activeShape={activeShape}
            onSelectShape={(s) => setActiveShape(s)}
            isInsertOpen={isInsertOpen}
            onToggleInsert={() => setIsInsertOpen((p) => !p)}
            isAiBoxOpen={isAiBoxOpen}
            onToggleAiBox={() => setIsAiBoxOpen((p) => !p)}
            isFramePresetsOpen={isFramePresetsOpen}
            onToggleFramePresets={() => setIsFramePresetsOpen((p) => !p)}
            isSpotlightOpen={isSpotlightOpen}
            zoom={zoom}
            onZoomIn={() => setZoom((z) => Math.min(4, z * 1.25))}
            onZoomOut={() => setZoom((z) => Math.max(0.1, z / 1.25))}
            onZoom100={() => setZoom(1.0)}
            onZoomFit={() => setZoom(0.9)}
            panelsCollapsed={panelsCollapsed}
            onTogglePanels={() => setPanelsCollapsed((p) => !p)}
            activeEasing={activeEasing}
            onSelectEasing={setActiveEasing}
            onSplitClip={() => {}}
            onRunCode={() => {}}
            onExportOption={(_opt: ExportOption) => {}}
          />

          <Spotlight
            open={isSpotlightOpen}
            onClose={() => setIsSpotlightOpen(false)}
            containerRef={interactiveContainerRef}
            onSelectTool={(t) => setActiveTool(t as CanvasTool)}
            onSelectMode={(m) => setMode(m as EditorMode)}
          />
        </div>
      </div>

      {/* SECTION 2: Per-Mode Static Previews Side-by-Side */}
      <div className="ll:flex ll:flex-col ll:gap-6">
        <span className="ll:text-small ll:font-medium ll:text-secondary">
          2. Toolbars By Mode
        </span>

        {/* Design Mode */}
        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-caption ll:text-muted">
            Design Mode: Select, Hand, Frame, Shape ▾ (Pen inside), Text, Insert, AI
          </span>
          <div className="ll:relative ll:h-20 ll:w-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:flex ll:items-center ll:justify-center">
            <Toolbar mode="design" activeTool="select" activeShape="box" />
          </div>
        </div>

        {/* Motion Mode */}
        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-caption ll:text-muted">
            Motion Mode: Select, Hand, Add keyframe (disabled with reason), Split, Easing ▾
          </span>
          <div className="ll:relative ll:h-20 ll:w-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:flex ll:items-center ll:justify-center">
            <Toolbar
              mode="motion"
              activeTool="select"
              activeEasing={activeEasing}
              onSelectEasing={setActiveEasing}
            />
          </div>
        </div>

        {/* Code Mode */}
        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-caption ll:text-muted">
            Code Mode: Inspect, Hand, Run, Export ▾
          </span>
          <div className="ll:relative ll:h-20 ll:w-full ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:flex ll:items-center ll:justify-center">
            <Toolbar mode="code" activeTool="select" />
          </div>
        </div>
      </div>

      {/* SECTION 3: Narrow Canvas Lift Preview */}
      <div className="ll:flex ll:flex-col ll:gap-3">
        <span className="ll:text-small ll:font-medium ll:text-secondary">
          3. Narrow Canvas Layout: Toolbar Rides Above Zoom Bar (bottom: 72px)
        </span>
        <div className="ll:relative ll:h-36 ll:w-96 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
          <div className="ll:p-2 ll:text-micro ll:font-mono ll:text-muted">
            Narrow container (384px wide)
          </div>
          <div className="ll-fbar ll-ftool ll:absolute ll:bottom-toolbar-lift ll:left-1/2 ll:-translate-x-1/2 ll:z-20 ll:flex ll:items-center ll:gap-0.5 ll:p-1 ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft">
            <Toolbar mode="design" activeTool="select" />
          </div>
        </div>
      </div>
    </div>
  );
}
