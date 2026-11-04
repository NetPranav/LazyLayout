"use client";

import React, { useState } from "react";
import { SquareRoundCorner } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { INSPECTOR_CONSTANTS } from "../constants";

const PAGE_FONT_OPTIONS = [
  { value: "Geist", label: "Geist" },
  { value: "Inter", label: "Inter" },
  { value: "Playfair Display", label: "Playfair Display" },
] as const;

const SCALE_OPTIONS = [
  { value: "1.125", label: "1.125" },
  { value: "1.2", label: "1.2" },
  { value: "1.25", label: "1.25" },
  { value: "1.333", label: "1.333" },
] as const;

const SHADOW_OPTIONS = [
  { value: "None", label: "None" },
  { value: "Soft", label: "Soft" },
  { value: "Medium", label: "Medium" },
  { value: "Strong", label: "Strong" },
] as const;

const FIELD_LABEL = "ll:font-mono ll:text-micro ll:tracking-normal ll:text-muted ll:shrink-0";
const HEX_FIELD =
  "ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm";
const HEX_INPUT =
  "ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none";
const SWATCH = "ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0";
const SELECT_ROW =
  "ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:w-full";

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
  pageName: propPageName = "Home",
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
      {/* Name row: label and value share one field, as in the prototype */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
        <span className={FIELD_LABEL}>Name</span>
        <input
          type="text"
          aria-label="Page name"
          value={pageName}
          onChange={(e) => {
            setPageName(e.target.value);
            onChangePageName?.(e.target.value);
          }}
          className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
        />
      </div>

      {/* Dimensions 2-grid */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
        <NumberField
          size="sm"
          className="ll:w-full ll:min-w-0"
          label={<span className={FIELD_LABEL}>Width</span>}
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
          className="ll:w-full ll:min-w-0"
          label={<span className={FIELD_LABEL}>Height</span>}
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
    <div className="ll:flex ll:items-center ll:gap-1 ll:w-full">
      <span className={SWATCH} style={{ backgroundColor: `#${bgHex}` }} />
      <div className={`${HEX_FIELD} ll:w-27`}>
        <span className="ll:font-mono ll:text-micro ll:text-muted ll:mr-2">#</span>
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
          className={HEX_INPUT}
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

  const tokenRows: Array<{ label: string; hex: string; set: (v: string) => void }> = [
    { label: "Primary", hex: primaryHex, set: setPrimaryHex },
    { label: "Surface", hex: surfaceHex, set: setSurfaceHex },
    { label: "Text", hex: textHex, set: setTextHex },
  ];

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      {tokenRows.map((row) => (
        <div key={row.label} className="ll:flex ll:items-center ll:gap-1 ll:w-full">
          <span className={SWATCH} style={{ backgroundColor: `#${row.hex}` }} />
          <div className={`${HEX_FIELD} ll:w-27`}>
            <span className="ll:font-mono ll:text-micro ll:text-muted ll:mr-2">#</span>
            <input
              type="text"
              maxLength={6}
              aria-label={`${row.label} hex`}
              value={row.hex}
              onChange={(e) => row.set(e.target.value.toUpperCase())}
              className={HEX_INPUT}
            />
          </div>
          <span className="ll:flex-1 ll:min-w-0 ll:ml-1 ll:font-sans ll:text-micro ll:tracking-normal ll:text-muted">
            {row.label}
          </span>
        </div>
      ))}

      {/* Default Radius */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:w-35 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
        <Icon icon={SquareRoundCorner} size={12} aria-hidden="true" className="ll:text-muted ll:shrink-0" />
        <input
          type="text"
          inputMode="numeric"
          aria-label="Default radius"
          value={radius}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!Number.isNaN(n)) setRadius(n);
          }}
          className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
        />
      </div>

      {/* Theme Font */}
      <div className={SELECT_ROW}>
        <span className={FIELD_LABEL}>Font</span>
        <Select
          size="sm"
          aria-label="Theme font"
          value={themeFont}
          options={PAGE_FONT_OPTIONS}
          onChange={(v) => setThemeFont(v)}
        />
      </div>

      {/* Type Scale */}
      <div className={SELECT_ROW}>
        <span className={FIELD_LABEL}>Scale</span>
        <Select
          size="sm"
          aria-label="Type scale"
          value={typeScale}
          options={SCALE_OPTIONS}
          onChange={(v) => setTypeScale(v)}
        />
      </div>

      {/* Theme Shadow */}
      <div className={SELECT_ROW}>
        <span className={FIELD_LABEL}>Shadow</span>
        <Select
          size="sm"
          aria-label="Theme shadow"
          value={themeShadow}
          options={SHADOW_OPTIONS}
          onChange={(v) => setThemeShadow(v)}
        />
      </div>
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
