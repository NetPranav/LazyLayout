"use client";

import React, { useState } from "react";
import { CornerDownRight } from "lucide-react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { Icon } from "@/editor/components/Icon";
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

export const PageSectionBody: React.FC<PageSectionProps> = ({
  pageName: propPageName = "Landing page",
  width: propWidth = 1440,
  height: propHeight = 900,
  onChangePageName,
  onChangeDimensions,
  className = "",
}) => {
  const [pageName, setPageName] = useState(propPageName);
  const [width, setWidth] = useState(propWidth);
  const [height, setHeight] = useState(propHeight);

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* Name Input (Full width, matching prototype) */}
      <div className="ll:w-full">
        <input
          type="text"
          aria-label="Page name"
          value={pageName}
          onChange={(e) => {
            setPageName(e.target.value);
            onChangePageName?.(e.target.value);
          }}
          className="ll:w-full ll:box-border ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus:border-border-active ll:focus:ring-1 ll:focus:ring-border-active ll:outline-none ll:rounded-sm ll:font-mono ll:text-small ll:text-primary ll:transition-colors"
        />
      </div>

      {/* Dimensions 2-grid */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
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
  );
};

export const PageBackgroundBody: React.FC<{
  backgroundColor?: string;
  onChangeBackground?: (hex: string) => void;
}> = ({
  backgroundColor = "1E1E1E",
  onChangeBackground,
}) => {
  const [bgHex, setBgHex] = useState(backgroundColor.replace(/^#/, "").toUpperCase());

  return (
    <div className="ll:flex ll:items-center ll:gap-2 ll:w-full">
      <span
        className="ll:w-6 ll:h-6 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
        style={{ backgroundColor: `#${bgHex}` }}
      />
      <div className="ll:flex ll:items-center ll:flex-1 ll:min-w-0 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
        <span className="ll:font-mono ll:text-nano ll:text-muted ll:mr-1">#</span>
        <input
          type="text"
          maxLength={6}
          aria-label="Background hex"
          value={bgHex}
          onChange={(e) => {
            const next = e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
            setBgHex(next);
            onChangeBackground?.(next);
          }}
          className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-small ll:text-primary ll:outline-none"
        />
      </div>
    </div>
  );
};

export const ThemeTokensBody: React.FC = () => {
  const [primaryHex, setPrimaryHex] = useState("6C5CE7");
  const [surfaceHex, setSurfaceHex] = useState("F4F3EF");
  const [textHex, setTextHex] = useState("22231E");
  const [radius, setRadius] = useState(8);
  const [themeFont, setThemeFont] = useState("Geist");
  const [typeScale, setTypeScale] = useState("1.25");
  const [themeShadow, setThemeShadow] = useState("Soft");

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      {/* Primary Hex */}
      <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
        <div className="ll:flex ll:items-center ll:gap-2 ll:flex-1 ll:min-w-0">
          <span
            className="ll:w-6 ll:h-6 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
            style={{ backgroundColor: `#${primaryHex}` }}
          />
          <div className="ll:flex ll:items-center ll:flex-1 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
            <span className="ll:font-mono ll:text-nano ll:text-muted ll:mr-1">#</span>
            <input
              type="text"
              maxLength={6}
              aria-label="Primary hex"
              value={primaryHex}
              onChange={(e) => setPrimaryHex(e.target.value.toUpperCase())}
              className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-small ll:text-primary ll:outline-none"
            />
          </div>
        </div>
        <span className="ll:text-nano ll:text-muted ll:font-sans">Primary</span>
      </div>

      {/* Surface Hex */}
      <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
        <div className="ll:flex ll:items-center ll:gap-2 ll:flex-1 ll:min-w-0">
          <span
            className="ll:w-6 ll:h-6 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
            style={{ backgroundColor: `#${surfaceHex}` }}
          />
          <div className="ll:flex ll:items-center ll:flex-1 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
            <span className="ll:font-mono ll:text-nano ll:text-muted ll:mr-1">#</span>
            <input
              type="text"
              maxLength={6}
              aria-label="Surface hex"
              value={surfaceHex}
              onChange={(e) => setSurfaceHex(e.target.value.toUpperCase())}
              className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-small ll:text-primary ll:outline-none"
            />
          </div>
        </div>
        <span className="ll:text-nano ll:text-muted ll:font-sans">Surface</span>
      </div>

      {/* Text Hex */}
      <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
        <div className="ll:flex ll:items-center ll:gap-2 ll:flex-1 ll:min-w-0">
          <span
            className="ll:w-6 ll:h-6 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
            style={{ backgroundColor: `#${textHex}` }}
          />
          <div className="ll:flex ll:items-center ll:flex-1 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
            <span className="ll:font-mono ll:text-nano ll:text-muted ll:mr-1">#</span>
            <input
              type="text"
              maxLength={6}
              aria-label="Text hex"
              value={textHex}
              onChange={(e) => setTextHex(e.target.value.toUpperCase())}
              className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-small ll:text-primary ll:outline-none"
            />
          </div>
        </div>
        <span className="ll:text-nano ll:text-muted ll:font-sans">Text</span>
      </div>

      {/* Default Radius */}
      <NumberField
        size="sm"
        label="R"
        aria-label="Default radius"
        value={radius}
        step={1}
        onChange={(v) => setRadius(v)}
      />

      {/* Theme Font */}
      <Select
        size="sm"
        label="Font"
        aria-label="Theme font"
        value={themeFont}
        options={FONT_FAMILY_OPTIONS}
        onChange={(v) => setThemeFont(v)}
      />

      {/* Type Scale */}
      <Select
        size="sm"
        label="Scale"
        aria-label="Type scale"
        value={typeScale}
        options={[
          { value: "1.125", label: "1.125" },
          { value: "1.2", label: "1.2" },
          { value: "1.25", label: "1.25" },
          { value: "1.333", label: "1.333" },
        ]}
        onChange={(v) => setTypeScale(v)}
      />

      {/* Theme Shadow */}
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
        onChange={(v) => setThemeShadow(v)}
      />
    </div>
  );
};

export const ThemeTokensMore: React.FC = () => {
  const [feedback, setFeedback] = useState("Subtle");

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
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
        onChange={(v) => setFeedback(v)}
      />
    </div>
  );
};

export const PageSection: React.FC<PageSectionProps> = (props) => {
  return (
    <div className="ll:flex ll:flex-col ll:gap-3 ll:w-full">
      <PageSectionBody {...props} />
      <PageBackgroundBody backgroundColor={props.backgroundColor} onChangeBackground={props.onChangeBackground} />
      <ThemeTokensBody />
    </div>
  );
};
