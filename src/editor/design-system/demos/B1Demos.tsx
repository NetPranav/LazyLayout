"use client";

import React, { useState, useRef } from "react";
import { ColorPicker } from "@/editor/components/ColorPicker";
import { FontPicker } from "@/editor/components/FontPicker";
import { FramePresetsPanel } from "@/editor/components/FramePresetsPanel";
import { OptionsPopover } from "@/editor/components/OptionsPopover";
import { Button } from "@/editor/components/Button";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";
import { MoreHorizontal, Type, Frame } from "@/editor/components/ColorPickerIcons";
import type { FramePresetItem } from "@/editor/components/FramePresetsData";
import {
  StrokeOptions,
  EffectsOptions,
  FillOptions,
  PositionOptions,
  LayoutOptions,
  AppearanceOptions,
  TypographyOptions,
  ThemeTokensOptions,
} from "@/editor/panels/details/options";
import type { PropValue } from "@/core/document/registry";

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
  const [selectedSection, setSelectedSection] = useState<
    "Stroke" | "Effects" | "Fill" | "Position" | "Layout" | "Appearance" | "Typography" | "Theme Tokens"
  >("Stroke");
  const [demoProps, setDemoProps] = useState<Record<string, PropValue | null>>({
    "stroke.position": "inside",
    "stroke.width": 1,
    "stroke.dash": "solid",
    "stroke.cap": "round",
    "stroke.join": "round",
    "stroke.miter": 4,
    "appearance.opacity": 1,
    "appearance.radius": 8,
    "typography.fontFamily": "Inter",
    "typography.fontSize": 14,
    "layout.position": "static",
    "layout.zIndex": 0,
  });
  const optionsAnchorRef = useRef<HTMLButtonElement>(null);

  const getDemoValue = (k: string) => demoProps[k] ?? null;
  const updateDemoProp = (k: string, v: PropValue | null) => {
    setDemoProps((prev) => ({ ...prev, [k]: v }));
  };
  const updateDemoProps = (patch: Record<string, PropValue | null>) => {
    setDemoProps((prev) => ({ ...prev, ...patch }));
  };

  const optionSections: Array<
    "Stroke" | "Effects" | "Fill" | "Position" | "Layout" | "Appearance" | "Typography" | "Theme Tokens"
  > = [
    "Stroke",
    "Effects",
    "Fill",
    "Position",
    "Layout",
    "Appearance",
    "Typography",
    "Theme Tokens",
  ];

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

          <div className="ll:fixed ll:inset-0 ll:z-30 ll:pointer-events-none">
            <FramePresetsPanel
              open={frameOpen}
              onPick={(p) => setChosenFrame(p)}
              onClose={() => setFrameOpen(false)}
              anchorRef={frameAnchorRef}
            />
          </div>
        </div>

        {/* 4. OptionsPopover Demo */}
        <div className="ll:flex ll:flex-col ll:gap-4 ll:p-4 ll:rounded-lg ll:border ll:border-border ll:bg-surface-panel">
          <div className="ll:flex ll:items-center ll:justify-between">
            <div>
              <h2 className="ll:text-body ll:font-medium ll:text-primary">
                OptionsPopover (Section Options)
              </h2>
              <span className="ll:text-micro ll:text-muted">
                280px floating surface, 36px header, 72px label column, hairlines
              </span>
            </div>
            <span className="ll:font-mono ll:text-micro ll:text-muted">280px</span>
          </div>

          {/* Section Selector */}
          <div className="ll:flex ll:flex-wrap ll:gap-1.5 ll:pt-1">
            {optionSections.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setSelectedSection(sec)}
                className={`ll:px-2.5 ll:py-1 ll:text-micro ll:rounded-sm ll:border ll:transition-colors ${
                  selectedSection === sec
                    ? "ll:bg-surface-seg ll:border-border ll:text-primary ll:font-medium"
                    : "ll:bg-surface-bar ll:border-border-subtle ll:text-muted ll:hover:text-primary"
                }`}
              >
                {sec}
              </button>
            ))}
          </div>

          <div className="ll:flex ll:items-center ll:gap-3 ll:pt-2">
            <span className="ll:text-small ll:font-medium ll:text-primary">
              {selectedSection} options
            </span>
            <span className="ll:flex-1" />
            <IconButton
              ref={optionsAnchorRef}
              variant="secondary"
              size="sm"
              aria-label={`${selectedSection} options`}
              onClick={() => setOptionsOpen((prev) => !prev)}
              icon={<Icon icon={MoreHorizontal} size={14} />}
            />
          </div>

          <OptionsPopover
            open={optionsOpen}
            title={selectedSection}
            anchorRef={optionsAnchorRef}
            onClose={() => setOptionsOpen(false)}
          >
            {selectedSection === "Stroke" && (
              <StrokeOptions
                getValue={getDemoValue}
                onUpdateProp={updateDemoProp}
                onUpdateProps={updateDemoProps}
              />
            )}
            {selectedSection === "Effects" && (
              <EffectsOptions
                getValue={getDemoValue}
                onUpdateProp={updateDemoProp}
                onUpdateProps={updateDemoProps}
              />
            )}
            {selectedSection === "Fill" && (
              <FillOptions
                getValue={getDemoValue}
                onUpdateProp={updateDemoProp}
                onUpdateProps={updateDemoProps}
              />
            )}
            {selectedSection === "Position" && (
              <PositionOptions
                getValue={getDemoValue}
                onUpdateProp={updateDemoProp}
                onUpdateProps={updateDemoProps}
              />
            )}
            {selectedSection === "Layout" && (
              <LayoutOptions
                isFrame={true}
                getValue={getDemoValue}
                onUpdateProp={updateDemoProp}
                onUpdateProps={updateDemoProps}
              />
            )}
            {selectedSection === "Appearance" && (
              <AppearanceOptions
                getValue={getDemoValue}
                onUpdateProp={updateDemoProp}
                onUpdateProps={updateDemoProps}
              />
            )}
            {selectedSection === "Typography" && (
              <TypographyOptions
                getValue={getDemoValue}
                onUpdateProp={updateDemoProp}
                onUpdateProps={updateDemoProps}
              />
            )}
            {selectedSection === "Theme Tokens" && <ThemeTokensOptions />}
          </OptionsPopover>
        </div>
      </div>
    </div>
  );
}
