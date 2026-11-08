"use client";

import React, { useState, useRef } from "react";
import { ColorPicker } from "@/editor/components/ColorPicker";
import { FontPicker } from "@/editor/components/FontPicker";
import { FramePresetsPanel } from "@/editor/components/FramePresetsPanel";
import { OptionsPopover } from "@/editor/components/OptionsPopover";
import { Button } from "@/editor/components/Button";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";
import { MoreHorizontal, Sliders, Type, Frame } from "@/editor/components/ColorPickerIcons";
import type { FramePresetItem } from "@/editor/components/FramePresetsData";

export function B1Demos() {
  // ColorPicker demo state
  const [colorOpen, setColorOpen] = useState(false);
  const [currentColor, setCurrentColor] = useState("#CEB4F5");
  const [currentOpacity, setCurrentOpacity] = useState(100);
  const colorAnchorRef = useRef<HTMLButtonElement>(null);

  // FontPicker demo state
  const [fontOpen, setFontOpen] = useState(false);
  const [currentFont, setCurrentFont] = useState("Inter");
  const [previewFont, setPreviewFont] = useState<string | null>(null);
  const fontAnchorRef = useRef<HTMLButtonElement>(null);

  // FramePresetsPanel demo state
  const [frameOpen, setFrameOpen] = useState(false);
  const [chosenFrame, setChosenFrame] = useState<FramePresetItem>({
    name: "Desktop",
    width: 1440,
    height: 900,
  });
  const frameAnchorRef = useRef<HTMLButtonElement>(null);

  // OptionsPopover demo state
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsAnchorRef = useRef<HTMLButtonElement>(null);
  const [layoutAlign, setLayoutAlign] = useState("start");
  const [clipContent, setClipContent] = useState(true);

  return (
    <div className="ll:flex ll:flex-col ll:gap-10 ll:p-6 ll:max-w-4xl ll:mx-auto">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary">
          B1 Pickers &amp; Popovers
        </h1>
        <p className="ll:text-body ll:text-muted ll:mt-1">
          ColorPicker, FontPicker, FramePresetsPanel, and OptionsPopover with full
          spring animations, dark/light theme support, and responsive layouts.
        </p>
      </div>

      <div className="ll:grid ll:grid-cols-1 ll:md:grid-cols-2 ll:gap-6">
        {/* 1. ColorPicker Demo */}
        <div className="ll:flex ll:flex-col ll:gap-4 ll:p-4 ll:rounded-lg ll:border ll:border-border ll:bg-surface-panel">
          <div className="ll:flex ll:items-center ll:justify-between">
            <div>
              <h2 className="ll:text-body ll:font-medium ll:text-primary">ColorPicker</h2>
              <span className="ll:text-micro ll:text-muted">
                Solid, Linear, Radial, Conic, Image, Tokens &amp; Eyedropper
              </span>
            </div>
            <span className="ll:font-mono ll:text-micro ll:text-muted">274px</span>
          </div>

          <div className="ll:flex ll:items-center ll:gap-3 ll:pt-2">
            <button
              ref={colorAnchorRef}
              type="button"
              onClick={() => setColorOpen((prev) => !prev)}
              aria-label="Open color picker"
              style={{ backgroundColor: currentColor }}
              className="ll:w-8 ll:h-8 ll:rounded-sm ll:border ll:border-swatch-line ll:shadow-sm ll:hover:scale-105 ll:transition-transform ll:shrink-0"
            />
            <div className="ll:flex ll:flex-col">
              <span className="ll:font-mono ll:text-small ll:text-primary">
                {currentColor}
              </span>
              <span className="ll:text-micro ll:text-muted">
                Opacity: {currentOpacity}%
              </span>
            </div>
            <span className="ll:flex-1" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setColorOpen((prev) => !prev)}
            >
              {colorOpen ? "Close Picker" : "Open Picker"}
            </Button>
          </div>

          <ColorPicker
            open={colorOpen}
            value={currentColor}
            onChange={(hex) => setCurrentColor(hex)}
            opacity={currentOpacity}
            onChangeOpacity={(op) => setCurrentOpacity(op)}
            onClose={() => setColorOpen(false)}
            anchorRef={colorAnchorRef}
          />
        </div>

        {/* 2. FontPicker Demo */}
        <div className="ll:flex ll:flex-col ll:gap-4 ll:p-4 ll:rounded-lg ll:border ll:border-border ll:bg-surface-panel">
          <div className="ll:flex ll:items-center ll:justify-between">
            <div>
              <h2 className="ll:text-body ll:font-medium ll:text-primary">FontPicker</h2>
              <span className="ll:text-micro ll:text-muted">
                Categorized, search, live preview &amp; upload font
              </span>
            </div>
            <span className="ll:font-mono ll:text-micro ll:text-muted">304px</span>
          </div>

          <div className="ll:flex ll:items-center ll:gap-3 ll:pt-2">
            <button
              ref={fontAnchorRef}
              type="button"
              onClick={() => setFontOpen((prev) => !prev)}
              className="ll:flex ll:items-center ll:gap-2 ll:h-8 ll:px-3 ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:text-body ll:text-primary ll:hover:bg-surface-seg ll:transition-colors"
            >
              <Icon icon={Type} size={14} className="ll:text-muted" />
              <span>{currentFont}</span>
            </button>
            <span className="ll:flex-1" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFontOpen((prev) => !prev)}
            >
              {fontOpen ? "Close Picker" : "Open Picker"}
            </Button>
          </div>

          {/* Live Preview Sample Box */}
          <div
            style={{ fontFamily: previewFont || currentFont }}
            className="ll:p-3 ll:rounded-sm ll:border ll:border-border ll:bg-surface-canvas ll:text-body ll:text-primary ll:truncate ll:transition-all"
          >
            The quick brown fox jumps over the lazy dog ({previewFont || currentFont})
          </div>

          <FontPicker
            open={fontOpen}
            value={currentFont}
            onChange={(f) => setCurrentFont(f)}
            onPreview={(f) => setPreviewFont(f)}
            onClose={() => setFontOpen(false)}
            anchorRef={fontAnchorRef}
          />
        </div>

        {/* 3. FramePresetsPanel Demo */}
        <div className="ll:flex ll:flex-col ll:gap-4 ll:p-4 ll:rounded-lg ll:border ll:border-border ll:bg-surface-panel">
          <div className="ll:flex ll:items-center ll:justify-between">
            <div>
              <h2 className="ll:text-body ll:font-medium ll:text-primary">
                FramePresetsPanel
              </h2>
              <span className="ll:text-micro ll:text-muted">
                Orientation toggle, ratio lock &amp; proportional glyphs
              </span>
            </div>
            <span className="ll:font-mono ll:text-micro ll:text-muted">340x480</span>
          </div>

          <div className="ll:flex ll:items-center ll:gap-3 ll:pt-2">
            <button
              ref={frameAnchorRef}
              type="button"
              onClick={() => setFrameOpen((prev) => !prev)}
              className="ll:flex ll:items-center ll:gap-2 ll:h-8 ll:px-3 ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:text-body ll:text-primary ll:hover:bg-surface-seg ll:transition-colors"
            >
              <Icon icon={Frame} size={14} className="ll:text-muted" />
              <span>
                {chosenFrame.name} ({chosenFrame.width} × {chosenFrame.height})
              </span>
            </button>
            <span className="ll:flex-1" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFrameOpen((prev) => !prev)}
            >
              {frameOpen ? "Close Panel" : "Open Panel"}
            </Button>
          </div>

          <FramePresetsPanel
            open={frameOpen}
            onPick={(p) => setChosenFrame(p)}
            onClose={() => setFrameOpen(false)}
            anchorRef={frameAnchorRef}
          />
        </div>

        {/* 4. OptionsPopover Demo */}
        <div className="ll:flex ll:flex-col ll:gap-4 ll:p-4 ll:rounded-lg ll:border ll:border-border ll:bg-surface-panel">
          <div className="ll:flex ll:items-center ll:justify-between">
            <div>
              <h2 className="ll:text-body ll:font-medium ll:text-primary">
                OptionsPopover
              </h2>
              <span className="ll:text-micro ll:text-muted">
                Side popover, morph animation &amp; cascading rows
              </span>
            </div>
            <span className="ll:font-mono ll:text-micro ll:text-muted">280px</span>
          </div>

          <div className="ll:flex ll:items-center ll:gap-3 ll:pt-2">
            <span className="ll:text-body ll:font-medium ll:text-primary">
              Section Options Trigger
            </span>
            <span className="ll:flex-1" />
            <IconButton
              ref={optionsAnchorRef}
              variant="secondary"
              size="sm"
              aria-label="Section options"
              onClick={() => setOptionsOpen((prev) => !prev)}
              icon={<Icon icon={MoreHorizontal} size={14} />}
            />
          </div>

          <OptionsPopover
            open={optionsOpen}
            title="Layout"
            anchorRef={optionsAnchorRef}
            onClose={() => setOptionsOpen(false)}
          >
            {/* Popover Row 1: Alignment */}
            <div className="ll:flex ll:flex-col ll:gap-1">
              <span className="ll:text-micro ll:font-medium ll:text-muted">
                Alignment
              </span>
              <div className="ll:flex ll:items-center ll:gap-1">
                {["start", "center", "end"].map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setLayoutAlign(a)}
                    className={`ll:flex-1 ll:h-7 ll:rounded-sm ll:text-micro ll:font-medium ll:transition-colors ${
                      layoutAlign === a
                        ? "ll:bg-surface-seg ll:text-primary"
                        : "ll:bg-surface-bar ll:text-muted ll:hover:text-primary"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Popover Row 2: Overflow clipping */}
            <div className="ll:flex ll:items-center ll:justify-between ll:py-1">
              <span className="ll:text-small ll:text-secondary">Clip content</span>
              <input
                type="checkbox"
                checked={clipContent}
                onChange={(e) => setClipContent(e.target.checked)}
                className="ll:rounded-xs ll:border-border ll:text-primary"
              />
            </div>
          </OptionsPopover>
        </div>
      </div>
    </div>
  );
}
