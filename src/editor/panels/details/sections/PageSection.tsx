"use client";

import React, { useState } from "react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { ColorSwatchField } from "@/editor/components/ColorSwatchField";
import { TextField } from "@/editor/components/TextField";
import {
  FONT_FAMILY_OPTIONS,
  INSPECTOR_CONSTANTS,
} from "../constants";

export interface PageSectionProps {
  pageName?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  onChangePageName?: (name: string) => void;
  onChangeDimensions?: (w: number, h: number) => void;
  onChangeBackground?: (hex: string) => void;
  className?: string;
}

export const PageSection: React.FC<PageSectionProps> = ({
  pageName: propPageName = "Page 1",
  width: propWidth = 1440,
  height: propHeight = 900,
  backgroundColor: propBg = "1E1E1E",
  onChangePageName,
  onChangeDimensions,
  onChangeBackground,
  className = "",
}) => {
  const [pageName, setPageName] = useState(propPageName);
  const [width, setWidth] = useState(propWidth);
  const [height, setHeight] = useState(propHeight);
  const [bgHex, setBgHex] = useState(propBg.replace(/^#/, "").toUpperCase());

  // Tokens
  const [themeFont, setThemeFont] = useState("Geist");
  const [typeScale, setTypeScale] = useState("1.25");
  const [themeShadow, setThemeShadow] = useState("Soft");
  const [defaultRadius, setDefaultRadius] = useState(8);
  const [feedback, setFeedback] = useState("Subtle");

  return (
    <div className={`ll:flex ll:flex-col ll:gap-3 ll:w-full ${className}`}>
      {/* Page Info */}
      <div className="ll:flex ll:flex-col ll:gap-2">
        <TextField
          size="sm"
          label="Page Name"
          value={pageName}
          onChange={(e) => {
            setPageName(e.target.value);
            onChangePageName?.(e.target.value);
          }}
        />

        <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
          <NumberField
            size="sm"
            label="W"
            aria-label="Page width"
            value={width}
            step={INSPECTOR_CONSTANTS.STEP_INTEGER}
            onChange={(w) => {
              setWidth(w);
              onChangeDimensions?.(w, height);
            }}
          />
          <NumberField
            size="sm"
            label="H"
            aria-label="Page height"
            value={height}
            step={INSPECTOR_CONSTANTS.STEP_INTEGER}
            onChange={(h) => {
              setHeight(h);
              onChangeDimensions?.(width, h);
            }}
          />
        </div>
      </div>

      {/* Page Background */}
      <div className="ll:flex ll:flex-col ll:gap-1.5 ll:pt-2 ll:border-t ll:border-border">
        <span className="ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted">
          Canvas Background
        </span>
        <ColorSwatchField
          size="sm"
          hex={bgHex}
          onChangeHex={(hex) => {
            setBgHex(hex);
            onChangeBackground?.(hex);
          }}
        />
      </div>

      {/* Theme & Tokens */}
      <div className="ll:flex ll:flex-col ll:gap-2 ll:pt-2 ll:border-t ll:border-border">
        <span className="ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted">
          Theme &amp; Tokens
        </span>

        <NumberField
          size="sm"
          label="Radius"
          value={defaultRadius}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={setDefaultRadius}
        />

        <Select
          size="sm"
          label="Font"
          aria-label="Theme font"
          value={themeFont}
          options={FONT_FAMILY_OPTIONS}
          onChange={setThemeFont}
        />

        <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
          <Select
            size="sm"
            label="Scale"
            aria-label="Type scale"
            value={typeScale}
            options={[
              { value: "1.125", label: "1.125" },
              { value: "1.2", label: "1.200" },
              { value: "1.25", label: "1.250" },
              { value: "1.333", label: "1.333" },
            ]}
            onChange={setTypeScale}
          />
          <Select
            size="sm"
            label="Shadow"
            aria-label="Theme shadow"
            value={themeShadow}
            options={[
              { value: "None", label: "None" },
              { value: "Soft", label: "Soft" },
              { value: "Medium", label: "Medium" },
              { value: "Strong", label: "Strong" },
            ]}
            onChange={setThemeShadow}
          />
        </div>

        <Select
          size="sm"
          label="Feedback"
          aria-label="Interactive feedback"
          value={feedback}
          options={[
            { value: "None", label: "None" },
            { value: "Subtle", label: "Subtle" },
            { value: "Strong", label: "Strong" },
          ]}
          onChange={setFeedback}
        />
      </div>
    </div>
  );
};
