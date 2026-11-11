"use client";

import React, { useState, useRef } from "react";
import {
  CanvasCursor,
  renderCursorSvg,
  GLYPHS,
  type CursorKind,
  TextFormatBar,
  type FormatState,
  Artboard,
  Stage,
  SAMPLE_STAGE_ELEMENTS,
} from "@/editor/stage";
import { Button } from "@/editor/components/Button";
import { useToolStore } from "@/core/store/useToolStore";

const CURSOR_KINDS: { id: CursorKind; label: string; desc: string; angle?: number }[] = [
  { id: "sel", label: "Select (Dart)", desc: "Tail-free arrow in text-2 with 1px panel outline" },
  { id: "move", label: "Move", desc: "4-way arrow for repositioning selected elements" },
  { id: "hand", label: "Hand (Pan)", desc: "Open hand when Pan tool or Space is active" },
  { id: "grabbing", label: "Grabbing", desc: "Closed fist during active pan drag" },
  { id: "x", label: "Crosshair", desc: "Universal creation crosshair" },
  { id: "x-frame", label: "Crosshair + Frame", desc: "Frame creation tool badge" },
  { id: "x-rect", label: "Crosshair + Rect", desc: "Rectangle shape tool badge" },
  { id: "x-ellipse", label: "Crosshair + Ellipse", desc: "Ellipse shape tool badge" },
  { id: "x-line", label: "Crosshair + Line", desc: "Line tool badge" },
  { id: "x-arrow", label: "Crosshair + Arrow", desc: "Arrow tool badge" },
  { id: "x-polygon", label: "Crosshair + Polygon", desc: "Polygon shape tool badge" },
  { id: "x-star", label: "Crosshair + Star", desc: "Star shape tool badge" },
  { id: "x-image", label: "Crosshair + Image", desc: "Image place tool badge" },
  { id: "ibeam", label: "I-Beam", desc: "Text editing and creation" },
  { id: "eye", label: "Eyedropper", desc: "Color sampling tool" },
  { id: "zin", label: "Zoom In", desc: "Z key zoom in mode" },
  { id: "zout", label: "Zoom Out", desc: "Alt + Z key zoom out mode" },
  { id: "copy", label: "Copy Badge", desc: "Alt + drag on selected element" },
  { id: "add", label: "Add Badge", desc: "Shift + hover on element to add selection" },
  { id: "locked", label: "Locked", desc: "Hovering over locked layer" },
  { id: "rs", label: "Resize E/W (0°)", desc: "Rotated resize arrow", angle: 0 },
  { id: "rs", label: "Resize SE/NW (45°)", desc: "Rotated resize arrow", angle: 45 },
  { id: "rs", label: "Resize N/S (90°)", desc: "Rotated resize arrow", angle: 90 },
  { id: "rs", label: "Resize SW/NE (135°)", desc: "Rotated resize arrow", angle: 135 },
  { id: "rot", label: "Rotate (0°)", desc: "Rotation cursor at 0°", angle: 0 },
  { id: "rot", label: "Rotate (90°)", desc: "Rotation cursor at 90°", angle: 90 },
];

export function B4Demos() {
  const [activeTab, setActiveTab] = useState<"cursor" | "formatbar" | "blankpage">("cursor");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8 ll:p-6 ll:max-w-6xl ll:mx-auto">
      <div>
        <h1 className="ll:text-heading ll:font-semibold ll:text-primary">
          B4: Canvas Stage (Cursor, Text Format Bar, Blank Page)
        </h1>
        <p className="ll:text-small ll:text-secondary ll:mt-1">
          Custom canvas-only cursor with spring physics, floating inline text formatting bar, and layer-free blank page artboard.
        </p>
      </div>

      {/* Mode navigation */}
      <div className="ll:flex ll:gap-2 ll:border-b ll:border-border ll:pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("cursor")}
          className={`ll:px-3 ll:py-1.5 ll:rounded-sm ll:text-small ll:font-medium ll:transition-colors ${
            activeTab === "cursor"
              ? "ll:bg-control-active ll:text-primary"
              : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
          }`}
        >
          1. Canvas Cursor Kinds &amp; Stage
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("formatbar")}
          className={`ll:px-3 ll:py-1.5 ll:rounded-sm ll:text-small ll:font-medium ll:transition-colors ${
            activeTab === "formatbar"
              ? "ll:bg-control-active ll:text-primary"
              : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
          }`}
        >
          2. Inline Text Format Bar
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("blankpage")}
          className={`ll:px-3 ll:py-1.5 ll:rounded-sm ll:text-small ll:font-medium ll:transition-colors ${
            activeTab === "blankpage"
              ? "ll:bg-control-active ll:text-primary"
              : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
          }`}
        >
          3. Blank Page vs Loaded Stage
        </button>
      </div>

      {activeTab === "cursor" && <CursorDemoSection />}
      {activeTab === "formatbar" && <FormatBarDemoSection />}
      {activeTab === "blankpage" && <BlankPageDemoSection />}
    </div>
  );
}

function CursorDemoSection() {
  const interactiveAreaRef = useRef<HTMLDivElement | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>("select");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      {/* 1. Interactive Stage Playground */}
      <div className="ll:flex ll:flex-col ll:gap-3">
        <h2 className="ll:text-title ll:font-medium ll:text-primary">
          Interactive Canvas Cursor Stage
        </h2>
        <p className="ll:text-small ll:text-secondary">
          Move your mouse inside the stage below. Features: velocity lean &amp; stretch, hover pop over elements, press scale (0.9), handle rotation, and modifier tracking (Alt = copy, Shift = add).
        </p>

        {/* Tool selector */}
        <div className="ll:flex ll:items-center ll:gap-2 ll:flex-wrap">
          <span className="ll:text-micro ll:font-mono ll:text-muted">ACTIVE TOOL:</span>
          {["select", "pan", "text", "frame", "rectangle", "ellipse"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setSelectedTool(t);
                useToolStore.getState().setActive(t);
              }}
              className={`ll:px-2.5 ll:py-1 ll:rounded-sm ll:text-micro ll:font-mono ll:uppercase ${
                selectedTool === t
                  ? "ll:bg-control-primary ll:text-control-primary-fg"
                  : "ll:bg-surface-panel ll:text-secondary ll:border ll:border-border ll:hover:bg-surface-hover"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Live Stage with CanvasCursor */}
        <div
          ref={interactiveAreaRef}
          data-stage="workspace"
          data-testid="stage-viewport"
          className="ll-stage-viewport ll:relative ll:w-full ll:h-80 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:select-none"
        >
          <CanvasCursor viewportRef={interactiveAreaRef} />

          <div className="ll:absolute ll:left-8 ll:top-8 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:shadow-soft">
            <span className="ll:text-small ll:font-medium ll:text-primary">Normal Panel Area</span>
            <p className="ll:text-micro ll:text-muted ll:mt-0.5">
              System cursor preserved over panels &amp; buttons
            </p>
            <button
              type="button"
              className="ll:mt-2 ll:px-3 ll:py-1 ll:bg-control-primary ll:text-control-primary-fg ll:rounded-sm ll:text-small"
            >
              Button Click
            </button>
          </div>

          <div
            data-element-id="box-1"
            data-testid="stage-element"
            data-selected="true"
            className="ll:absolute ll:left-64 ll:top-16 ll:w-48 ll:h-32 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:p-3"
          >
            <div className="ll:flex ll:items-center ll:justify-between">
              <span className="ll:text-small ll:font-medium ll:text-primary">Selected Element</span>
              <span className="ll:text-nano ll:font-mono ll:text-muted">MOVABLE</span>
            </div>
            <p className="ll:text-micro ll:text-secondary ll:mt-2">
              Hover for move cursor. Hold Alt for copy. Hold Shift for add.
            </p>
            {/* Resize handles */}
            <div
              data-handle="se"
              data-testid="selection-handle"
              className="ll:absolute ll:-bottom-1 ll:-right-1 ll:w-2.5 ll:h-2.5 ll:bg-surface-canvas ll:border ll:border-primary"
            />
            <div
              data-handle="nw"
              data-testid="selection-handle"
              className="ll:absolute ll:-top-1 ll:-left-1 ll:w-2.5 ll:h-2.5 ll:bg-surface-canvas ll:border ll:border-primary"
            />
          </div>

          <div
            data-element-id="box-2"
            data-locked="true"
            data-testid="stage-element"
            className="ll:absolute ll:right-16 ll:top-20 ll:w-40 ll:h-28 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:p-3"
          >
            <span className="ll:text-small ll:font-medium ll:text-muted">Locked Layer</span>
            <p className="ll:text-nano ll:text-muted ll:mt-1">Shows locked cursor kind</p>
          </div>
        </div>
      </div>

      {/* 2. Visual Catalog of All Kinds */}
      <div className="ll:flex ll:flex-col ll:gap-3">
        <h2 className="ll:text-title ll:font-medium ll:text-primary">
          All Canvas Cursor Kinds (26 Variants)
        </h2>
        <div className="ll:grid ll:grid-cols-2 ll:sm:grid-cols-3 ll:md:grid-cols-4 ll:lg:grid-cols-6 ll:gap-3">
          {CURSOR_KINDS.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="ll:flex ll:flex-col ll:items-center ll:gap-2 ll:p-3 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:text-center"
            >
              <div
                className="ll:w-12 ll:h-12 ll:grid ll:place-items-center ll:bg-surface-canvas ll:rounded-sm"
                dangerouslySetInnerHTML={{
                  __html: renderCursorSvg(item.id).replace(
                    "<svg",
                    `<svg style="${item.angle !== undefined ? `transform: rotate(${item.angle}deg);` : ""}"`
                  ),
                }}
              />
              <span className="ll:text-micro ll:font-medium ll:text-primary">
                {item.label}
              </span>
              <span className="ll:text-nano ll:text-muted ll:leading-tight">
                {item.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FormatBarDemoSection() {
  const [demoFormats, setDemoFormats] = useState<FormatState>({
    bold: true,
    italic: false,
    underline: true,
    strike: false,
    link: false,
  });

  const editableContainerRef = useRef<HTMLDivElement | null>(null);

  const toggleFormat = (key: keyof FormatState) => {
    setDemoFormats((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h2 className="ll:text-title ll:font-medium ll:text-primary">
          Inline Text Format Bar (.ftxb)
        </h2>
        <p className="ll:text-small ll:text-secondary ll:mt-1">
          Floating toolbar popping above selected text range with real spring physics. Supports Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U), Strikethrough (Ctrl+Shift+X) and Link.
        </p>
      </div>

      {/* Static Bar States */}
      <div className="ll:flex ll:flex-col ll:gap-4">
        <span className="ll:text-micro ll:font-mono ll:text-muted ll:uppercase">
          Static Display States
        </span>
        <div className="ll:flex ll:flex-wrap ll:gap-6">
          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:text-secondary">Default (None Active)</span>
            <TextFormatBar
              forceVisible
              formats={{ bold: false, italic: false, underline: false, strike: false, link: false }}
            />
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:text-secondary">Bold Active</span>
            <TextFormatBar
              forceVisible
              formats={{ bold: true, italic: false, underline: false, strike: false, link: false }}
            />
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:text-secondary">Bold + Italic + Underline</span>
            <TextFormatBar
              forceVisible
              formats={{ bold: true, italic: true, underline: true, strike: false, link: false }}
            />
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:text-secondary">Link Active</span>
            <TextFormatBar
              forceVisible
              formats={{ bold: false, italic: false, underline: false, strike: false, link: true }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Selection Trigger */}
      <div className="ll:flex ll:flex-col ll:gap-3">
        <span className="ll:text-micro ll:font-mono ll:text-muted ll:uppercase">
          Interactive Selection Playground
        </span>
        <p className="ll:text-small ll:text-secondary">
          Highlight any text inside the box below to see the floating format bar appear dynamically above your cursor selection:
        </p>
        <div
          ref={editableContainerRef}
          contentEditable
          suppressContentEditableWarning
          className="ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:outline-none ll:text-lead ll:leading-relaxed ll:text-primary"
        >
          Select this sentence to test the floating format bar. You can press <kbd className="ll:font-mono ll:text-small">Ctrl+B</kbd> for Bold, <kbd className="ll:font-mono ll:text-small">Ctrl+I</kbd> for Italic, or <kbd className="ll:font-mono ll:text-small">Ctrl+U</kbd> for Underline.
        </div>
        <TextFormatBar containerRef={editableContainerRef} />
      </div>
    </div>
  );
}

function BlankPageDemoSection() {
  const [showBlank, setShowBlank] = useState(true);

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div className="ll:flex ll:items-center ll:justify-between">
        <div>
          <h2 className="ll:text-title ll:font-medium ll:text-primary">
            Blank Page Parity (No Layers = No Placeholder)
          </h2>
          <p className="ll:text-small ll:text-secondary ll:mt-0.5">
            When a page has no layers, nothing is rendered on the artboard (no placeholder prompt, transparent artboard).
          </p>
        </div>
        <div className="ll:flex ll:gap-2">
          <Button
            size="sm"
            variant={showBlank ? "primary" : "secondary"}
            onClick={() => setShowBlank(true)}
          >
            Blank Page State
          </Button>
          <Button
            size="sm"
            variant={!showBlank ? "primary" : "secondary"}
            onClick={() => setShowBlank(false)}
          >
            Populated Stage State
          </Button>
        </div>
      </div>

      <div className="ll:relative ll:w-full ll:h-96 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
        {showBlank ? (
          <Stage empty={true} elements={{}} />
        ) : (
          <Stage empty={false} elements={SAMPLE_STAGE_ELEMENTS} />
        )}
      </div>
    </div>
  );
}
