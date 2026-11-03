"use client";

import React, { useState } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Italic,
  Underline,
  Strikethrough,
  MoreHorizontal,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";
import {
  INSPECTOR_CONSTANTS,
  FONT_FAMILY_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  TEXT_OVERFLOW_OPTIONS,
  WHITE_SPACE_OPTIONS,
  FONT_LOADING_OPTIONS,
} from "../constants";
import type { InspectorSectionProps } from "../types";

export const TypographySection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  onUpdateProps,
  className = "",
}) => {
  const [showMore, setShowMore] = useState(false);

  // Content text
  const textContent =
    (getValue?.("content.text") as string) ||
    (getValue?.("content.label") as string) ||
    "";

  // Typography properties
  const fontFamily = (getValue?.("typography.fontFamily") as string) || "Geist";
  const rawWeight = (getValue?.("typography.fontWeight") as string) || "400";
  const fontWeight = String(rawWeight);

  const rawSize = getValue?.("typography.fontSize") ?? getValue?.("fontSize");
  const fontSize = typeof rawSize === "number" ? rawSize : rawSize === null ? null : INSPECTOR_CONSTANTS.DEFAULT_FONT_SIZE;

  const rawLH = getValue?.("typography.lineHeight") ?? getValue?.("lineHeight");
  const lineHeight = typeof rawLH === "number" ? rawLH : rawLH === null ? null : INSPECTOR_CONSTANTS.DEFAULT_LINE_HEIGHT;

  const rawLS = getValue?.("typography.letterSpacing") ?? getValue?.("letterSpacing");
  const letterSpacing = typeof rawLS === "number" ? rawLS : rawLS === null ? null : INSPECTOR_CONSTANTS.DEFAULT_LETTER_SPACING;

  const textAlign = (getValue?.("typography.textAlign") as string) || "left";
  const textSizing = (getValue?.("text.sizing") as string) || "fixed";

  // Advanced properties
  const textTransform = (getValue?.("typography.textTransform") as string) || "none";
  const fontStyle = (getValue?.("typography.fontStyle") as string) || "normal";
  const isItalic = fontStyle === "italic";
  const textDecoration = (getValue?.("typography.textDecoration") as string) || "none";
  const wordSpacing = (getValue?.("typography.wordSpacing") as number) ?? 0;
  const textOverflow = (getValue?.("typography.textOverflow") as string) || "clip";
  const whiteSpace = (getValue?.("typography.whiteSpace") as string) || "normal";
  const fontLoading = (getValue?.("typography.fontLoading") as string) || "swap";

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2.5 ll:w-full ${className}`}>
      {/* Content text field */}
      <div className="ll:flex ll:flex-col ll:gap-1">
        <label
          htmlFor="details-typography-text"
          className="ll:text-nano ll:font-mono ll:uppercase ll:text-muted"
        >
          Text Content
        </label>
        <textarea
          id="details-typography-text"
          rows={2}
          aria-label="Text content"
          value={textContent}
          onChange={(e) => {
            onUpdateProps?.({
              "content.text": e.target.value,
              "content.label": e.target.value,
            });
          }}
          placeholder="Enter text..."
          className="ll:w-full ll:box-border ll:px-2 ll:py-1.5 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:focus-within:border-primary ll:outline-none ll:rounded-sm ll:font-mono ll:text-small ll:text-primary ll:resize-none ll:transition-colors"
        />
      </div>

      {/* Font Family Select */}
      <Select
        size="sm"
        aria-label="Font family"
        value={fontFamily}
        options={FONT_FAMILY_OPTIONS}
        onChange={(val) => onUpdateProp?.("typography.fontFamily", val)}
      />

      {/* Font Weight & Size Row */}
      <div className="ll:grid ll:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] ll:gap-1.5">
        <Select
          size="sm"
          aria-label="Font weight"
          value={fontWeight}
          options={FONT_WEIGHT_OPTIONS}
          onChange={(val) => onUpdateProp?.("typography.fontWeight", val)}
        />
        <NumberField
          size="sm"
          label="S"
          aria-label="Font size"
          min={INSPECTOR_CONSTANTS.MIN_FONT_SIZE}
          max={INSPECTOR_CONSTANTS.MAX_FONT_SIZE}
          value={fontSize}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => {
            onUpdateProp?.("typography.fontSize", v);
            onUpdateProp?.("fontSize", v);
          }}
        />
      </div>

      {/* Line Height & Letter Spacing Row */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
        <NumberField
          size="sm"
          label="LH"
          aria-label="Line height"
          value={lineHeight}
          step={INSPECTOR_CONSTANTS.STEP_DECIMAL}
          precision={2}
          onChange={(v) => {
            onUpdateProp?.("typography.lineHeight", v);
            onUpdateProp?.("lineHeight", v);
          }}
        />
        <NumberField
          size="sm"
          label="LS"
          aria-label="Tracking"
          value={letterSpacing}
          step={INSPECTOR_CONSTANTS.STEP_DECIMAL}
          precision={2}
          onChange={(v) => {
            onUpdateProp?.("typography.letterSpacing", v);
            onUpdateProp?.("letterSpacing", v);
          }}
        />
      </div>

      {/* Text Align Segmented Control */}
      <SegmentedControl
        size="sm"
        ariaLabel="Text alignment"
        value={textAlign}
        onChange={(val) => onUpdateProp?.("typography.textAlign", val)}
        options={[
          {
            value: "left",
            icon: <Icon icon={AlignLeft} size={14} />,
            ariaLabel: "Align left",
          },
          {
            value: "center",
            icon: <Icon icon={AlignCenter} size={14} />,
            ariaLabel: "Align center",
          },
          {
            value: "right",
            icon: <Icon icon={AlignRight} size={14} />,
            ariaLabel: "Align right",
          },
          {
            value: "justify",
            icon: <Icon icon={AlignJustify} size={14} />,
            ariaLabel: "Align justify",
          },
        ]}
      />

      {/* Text Sizing Segmented Control: Auto width / Auto height / Fixed */}
      <SegmentedControl
        size="sm"
        ariaLabel="Text box sizing"
        value={textSizing}
        onChange={(val) => onUpdateProp?.("text.sizing", val)}
        options={[
          { value: "autoWidth", label: "Auto width", ariaLabel: "Auto width" },
          { value: "autoHeight", label: "Auto height", ariaLabel: "Auto height" },
          { value: "fixed", label: "Fixed", ariaLabel: "Fixed box" },
        ]}
      />

      {/* Advanced Toggle Button */}
      <div className="ll:flex ll:items-center ll:justify-between ll:pt-0.5">
        <span className="ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted">
          Case, Decoration &amp; Flow
        </span>
        <IconButton
          size="sm"
          aria-label={showMore ? "Collapse advanced options" : "Expand advanced options"}
          tooltip="More typography options"
          pressed={showMore}
          onClick={() => setShowMore((prev) => !prev)}
          icon={<Icon icon={MoreHorizontal} size={14} />}
        />
      </div>

      {/* Advanced Expandable Properties */}
      {showMore && (
        <div className="dmore ll:flex ll:flex-col ll:gap-2 ll:pt-1.5 ll:border-t ll:border-border">
          {/* Case & Italic Row */}
          <div className="ll:flex ll:items-center ll:gap-2">
            <div className="ll:flex-1 ll:min-w-0">
              <SegmentedControl
                size="sm"
                ariaLabel="Text transform case"
                value={textTransform}
                onChange={(val) => onUpdateProp?.("typography.textTransform", val)}
                options={[
                  { value: "none", label: "—", ariaLabel: "No case change" },
                  { value: "uppercase", label: "AG", ariaLabel: "Uppercase" },
                  { value: "lowercase", label: "ag", ariaLabel: "Lowercase" },
                  { value: "capitalize", label: "Ag", ariaLabel: "Titlecase" },
                ]}
              />
            </div>
            <IconButton
              size="sm"
              aria-label={isItalic ? "Disable italic" : "Enable italic"}
              tooltip="Italic"
              pressed={isItalic}
              onClick={() =>
                onUpdateProp?.("typography.fontStyle", isItalic ? "normal" : "italic")
              }
              icon={<Icon icon={Italic} size={14} />}
            />
          </div>

          {/* Decoration Row: None / Underline / Strike */}
          <SegmentedControl
            size="sm"
            ariaLabel="Text decoration"
            value={textDecoration}
            onChange={(val) => onUpdateProp?.("typography.textDecoration", val)}
            options={[
              { value: "none", label: "None", ariaLabel: "No decoration" },
              {
                value: "underline",
                icon: <Icon icon={Underline} size={14} />,
                ariaLabel: "Underline",
              },
              {
                value: "line-through",
                icon: <Icon icon={Strikethrough} size={14} />,
                ariaLabel: "Strikethrough",
              },
            ]}
          />

          {/* Word spacing & Text overflow */}
          <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
            <NumberField
              size="sm"
              label="Word"
              value={wordSpacing}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("typography.wordSpacing", v)}
            />
            <Select
              size="sm"
              label="Overflow"
              aria-label="Text overflow"
              value={textOverflow}
              options={TEXT_OVERFLOW_OPTIONS}
              onChange={(val) => onUpdateProp?.("typography.textOverflow", val)}
            />
          </div>

          {/* White space & Font loading */}
          <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
            <Select
              size="sm"
              label="Wrap"
              aria-label="White space wrap"
              value={whiteSpace}
              options={WHITE_SPACE_OPTIONS}
              onChange={(val) => onUpdateProp?.("typography.whiteSpace", val)}
            />
            <Select
              size="sm"
              label="Load"
              aria-label="Font loading"
              value={fontLoading}
              options={FONT_LOADING_OPTIONS}
              onChange={(val) => onUpdateProp?.("typography.fontLoading", val)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
