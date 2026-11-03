"use client";

import React, { useState, Suspense } from "react";
import { CanvasChrome } from "@/editor/shell/canvas-chrome";
import { Stage } from "./Stage";
import { STAGE_CONSTANTS, STAGE_PRESETS } from "./constants";
import type { StagePreset } from "./types";
import type { CanvasTool, GridStyle } from "@/editor/shell/canvas-chrome/types";
import { Button } from "@/editor/components/Button";
import { Icon } from "@/editor/components/Icon";
import { Sun, Moon, Frame, Sparkles, Layers } from "lucide-react";

export function StageLabInner() {
  const [theme, setTheme] = useState<string>("paper");
  const [zoom, setZoom] = useState<number>(STAGE_CONSTANTS.defaultZoom);
  const [selectedIds, setSelectedIds] = useState<string[]>(["headline"]);
  const [empty, setEmpty] = useState<boolean>(false);
  const [preset, setPreset] = useState<StagePreset>("1440");
  const [showRulers, setShowRulers] = useState<boolean>(false);
  const [pixelGrid, setPixelGrid] = useState<boolean>(false);
  const [snapObjects, setSnapObjects] = useState<boolean>(true);
  const [snapGuides, setSnapGuides] = useState<boolean>(false);
  const [gridStyle, setGridStyle] = useState<GridStyle>("dots");
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [mode, setMode] = useState<"design" | "motion" | "code">("design");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "paper" ? "dark" : "paper"));
  };

  return (
    <div
      data-theme={theme}
      className="editor-root ll:flex ll:flex-col ll:items-center ll:justify-start ll:min-h-screen ll:bg-surface-backdrop ll:p-6 ll:font-sans ll:select-none"
    >
      {/* 1. Lab Controls Toolbar */}
      <div
        className="ll:flex ll:items-center ll:justify-between ll:mb-4 ll:px-4 ll:py-2.5 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-soft"
        style={{ width: "var(--ll-size-viewport-desktop)" }}
      >
        <div className="ll:flex ll:items-center ll:gap-4">
          <div className="ll:flex ll:items-center ll:gap-2">
            <Icon icon={Layers} size={STAGE_CONSTANTS.iconSizeMd} className="ll:text-primary" />
            <span className="ll:text-small ll:font-semibold ll:text-primary">
              Stage & Artboard Lab
            </span>
          </div>

          <div className="ll:flex ll:items-center ll:gap-1 ll:border-l ll:border-border ll:pl-3">
            <span className="ll:text-micro ll:text-secondary ll:mr-1">Select:</span>
            <Button
              size="sm"
              variant={selectedIds.includes("headline") ? "primary" : "secondary"}
              onClick={() => setSelectedIds(["headline"])}
            >
              Headline
            </Button>
            <Button
              size="sm"
              variant={selectedIds.includes("button") ? "primary" : "secondary"}
              onClick={() => setSelectedIds(["button"])}
            >
              Button
            </Button>
            <Button
              size="sm"
              variant={selectedIds.includes("image") ? "primary" : "secondary"}
              onClick={() => setSelectedIds(["image"])}
            >
              Image
            </Button>
            <Button
              size="sm"
              variant={selectedIds.length === 0 ? "primary" : "secondary"}
              onClick={() => setSelectedIds([])}
            >
              None
            </Button>
          </div>

          <div className="ll:flex ll:items-center ll:gap-1 ll:border-l ll:border-border ll:pl-3">
            <span className="ll:text-micro ll:text-secondary ll:mr-1">Size:</span>
            {STAGE_PRESETS.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={preset === p.id ? "primary" : "secondary"}
                onClick={() => setPreset(p.id)}
              >
                {p.label} ({p.id})
              </Button>
            ))}
          </div>
        </div>

        <div className="ll:flex ll:items-center ll:gap-2">
          <Button
            size="sm"
            variant={empty ? "primary" : "secondary"}
            onClick={() => setEmpty((prev) => !prev)}
          >
            {empty ? "Populated" : "Empty State"}
          </Button>

          <Button
            size="sm"
            variant={showRulers ? "primary" : "secondary"}
            onClick={() => setShowRulers((prev) => !prev)}
          >
            Rulers: {showRulers ? "ON" : "OFF"}
          </Button>

          <Button
            size="sm"
            variant={snapGuides ? "primary" : "secondary"}
            onClick={() => setSnapGuides((prev) => !prev)}
          >
            Guides: {snapGuides ? "ON" : "OFF"}
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={toggleTheme}
            leftIcon={
              <Icon
                icon={theme === "paper" ? Moon : Sun}
                size={STAGE_CONSTANTS.iconSizeSm}
              />
            }
          >
            {theme === "paper" ? "Dark" : "Paper"}
          </Button>
        </div>
      </div>

      {/* 2. Standard 1440x900 Canvas Chrome Frame with Stage */}
      <div
        className="ll:relative ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:overflow-hidden ll:bg-surface-canvas"
        style={{
          width: "var(--ll-size-viewport-desktop)",
          height: "var(--ll-size-viewport-desktop-h)",
        }}
      >
        <CanvasChrome
          zoom={zoom}
          onZoomChange={setZoom}
          showRulers={showRulers}
          onToggleRulers={setShowRulers}
          pixelGrid={pixelGrid}
          onTogglePixelGrid={setPixelGrid}
          snapObjects={snapObjects}
          onToggleSnapObjects={setSnapObjects}
          snapGuides={snapGuides}
          onToggleSnapGuides={setSnapGuides}
          gridStyle={gridStyle}
          onGridStyleChange={setGridStyle}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          theme={theme}
          onThemeChange={setTheme}
        >
          <Stage
            zoom={zoom}
            selectedIds={selectedIds}
            onSelect={(id, multi) => {
              if (!id) {
                setSelectedIds([]);
              } else if (multi) {
                setSelectedIds((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                );
              } else {
                setSelectedIds([id]);
              }
            }}
            preset={preset}
            onPresetChange={setPreset}
            empty={empty}
            snapObjects={snapObjects}
            snapGuides={snapGuides}
            mode={mode}
            activeTool={activeTool}
            onAddFrame={() => setEmpty(false)}
            onInsert={() => setEmpty(false)}
            onAskAi={() => setEmpty(false)}
          />
        </CanvasChrome>
      </div>
    </div>
  );
}

export function StageLab() {
  return (
    <Suspense fallback={<div className="ll:p-8 ll:text-muted">Loading stage lab...</div>}>
      <StageLabInner />
    </Suspense>
  );
}
