"use client";

import React from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUpDown,
  ArrowLeftRight,
  MoveHorizontal,
  MoveVertical,
  Square,
  Italic,
  Underline,
  Strikethrough,
  Minus,
} from "lucide-react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
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
  layer,
  getValue,
  onUpdateProp,
  onUpdateProps,
  className = "",
}) => {
  // Content text
  const textContent =
    (getValue?.("content.text") as string) ||
    (getValue?.("content.label") as string) ||
    "";

  // Typography properties
  const fontFamily = (getValue?.("typography.fontFamily") as string) || "Geist";
  const rawWeight = (getValue?.("typography.fontWeight") as string) || "600";
  const fontWeight = String(rawWeight);

  const rawSize = getValue?.("typography.fontSize") ?? getValue?.("fontSize");
  const fontSize = typeof rawSize === "number" ? rawSize : rawSize === null ? null : INSPECTOR_CONSTANTS.DEFAULT_FONT_SIZE;

  const rawLH = getValue?.("typography.lineHeight") ?? getValue?.("lineHeight");
  const lineHeight = typeof rawLH === "number" ? rawLH : rawLH === null ? null : INSPECTOR_CONSTANTS.DEFAULT_LINE_HEIGHT;

  const rawLS = getValue?.("typography.letterSpacing") ?? getValue?.("letterSpacing");
  const letterSpacing = typeof rawLS === "number" ? rawLS : rawLS === null ? null : INSPECTOR_CONSTANTS.DEFAULT_LETTER_SPACING;

  const textAlign = (getValue?.("typography.textAlign") as string) || "left";
  const textSizing = (getValue?.("text.sizing") as string) || "autoWidth";

  const isTextOrButton =
    !layer ||
    layer.archetype === "text" ||
    layer.archetype === "button" ||
    (layer.archetype as string) === "counter";

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* Content text field: plain clean textarea matching prototype */}
      {isTextOrButton && (
        <div className="ll:w-full">
          <textarea
            rows={2}
            aria-label="Text content"
            value={textContent}
            onChange={(e) => {
              onUpdateProps?.({
                "content.text": e.target.value,
                "content.label": e.target.value,
              });
            }}
            placeholder="Text content"
            className="ll:w-full ll:box-border ll:px-2 ll:py-1.5 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:focus:border-border-active ll:focus:ring-1 ll:focus:ring-border-active ll:outline-none ll:rounded-sm ll:font-mono ll:text-small ll:text-primary ll:resize-none ll:transition-colors"
          />
        </div>
      )}

      {/* Font Family Select */}
      <Select
        size="sm"
        aria-label="Font family"
        value={fontFamily}
        options={FONT_FAMILY_OPTIONS}
        onChange={(val) => onUpdateProp?.("typography.fontFamily", val)}
      />

      {/* Font Weight & Size Row */}
      <div className="ll:grid ll:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] ll:gap-2">
        <Select
          size="sm"
          aria-label="Font weight"
          value={fontWeight}
          options={[
            { value: "100", label: "W 100 Thin" },
            { value: "200", label: "W 200 X-Light" },
            { value: "300", label: "W 300 Light" },
            { value: "400", label: "W 400 Regular" },
            { value: "500", label: "W 500 Medium" },
            { value: "600", label: "W 600 Semi" },
            { value: "700", label: "W 700 Bold" },
            { value: "800", label: "W 800 X-Bold" },
            { value: "900", label: "W 900 Black" },
          ]}
          onChange={(val) => onUpdateProp?.("typography.fontWeight", val)}
        />
        <NumberField
          size="sm"
          label="S"
          aria-label="Size"
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
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          label={<Icon icon={ArrowUpDown} size={14} />}
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
          label={<Icon icon={ArrowLeftRight} size={14} />}
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

      {/* Text Align Segmented Control: Left, Center, Right (prototype parity) */}
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
        ]}
      />

      {/* Text Sizing Segmented Control: Auto width / Auto height / Fixed (prototype parity) */}
      <SegmentedControl
        size="sm"
        ariaLabel="Text box sizing"
        value={textSizing}
        onChange={(val) => onUpdateProp?.("text.sizing", val)}
        options={[
          {
            value: "autoWidth",
            icon: <Icon icon={MoveHorizontal} size={14} />,
            ariaLabel: "Auto width",
          },
          {
            value: "autoHeight",
            icon: <Icon icon={MoveVertical} size={14} />,
            ariaLabel: "Auto height",
          },
          {
            value: "fixed",
            icon: <Icon icon={Square} size={14} />,
            ariaLabel: "Fixed box",
          },
        ]}
      />
    </div>
  );
};

export const TypographyMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  const textTransform = (getValue?.("typography.textTransform") as string) || "none";
  const fontStyle = (getValue?.("typography.fontStyle") as string) || "normal";
  const isItalic = fontStyle === "italic";
  const textDecoration = (getValue?.("typography.textDecoration") as string) || "none";
  const wordSpacing = (getValue?.("typography.wordSpacing") as number) ?? 0;
  const textOverflow = (getValue?.("typography.textOverflow") as string) || "clip";
  const whiteSpace = (getValue?.("typography.whiteSpace") as string) || "normal";
  const fontLoading = (getValue?.("typography.fontLoading") as string) || "swap";

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      {/* Text Case & Italic */}
      <div className="ll:flex ll:items-center ll:gap-2">
        <div className="ll:flex-1">
          <SegmentedControl
            size="sm"
            ariaLabel="Text case"
            value={textTransform}
            onChange={(val) => onUpdateProp?.("typography.textTransform", val)}
            options={[
              { value: "none", label: "—", ariaLabel: "No case change" },
              { value: "uppercase", label: "AG", ariaLabel: "Uppercase" },
              { value: "lowercase", label: "ag", ariaLabel: "Lowercase" },
              { value: "capitalize", label: "Ag", ariaLabel: "Title case" },
            ]}
          />
        </div>
        <button
          type="button"
          aria-pressed={isItalic}
          aria-label="Italic"
          title="Italic"
          onClick={() =>
            onUpdateProp?.(
              "typography.fontStyle",
              isItalic ? "normal" : "italic"
            )
          }
          className={`ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:border ll:border-border ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ${
            isItalic
              ? "ll:bg-control-secondary-bg ll:text-primary ll:border-border-active"
              : "ll:bg-surface-bar ll:text-muted ll:hover:text-primary"
          }`}
        >
          <Icon icon={Italic} size={14} />
        </button>
      </div>

      {/* Text Decoration: None, Underline, Strikethrough */}
      <SegmentedControl
        size="sm"
        ariaLabel="Text decoration"
        value={textDecoration}
        onChange={(val) => onUpdateProp?.("typography.textDecoration", val)}
        options={[
          {
            value: "none",
            icon: <Icon icon={Minus} size={14} />,
            ariaLabel: "No decoration",
          },
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

      {/* Word Spacing */}
      <NumberField
        size="sm"
        label="Word"
        aria-label="Word spacing"
        value={wordSpacing}
        step={INSPECTOR_CONSTANTS.STEP_INTEGER}
        onChange={(v) => onUpdateProp?.("typography.wordSpacing", v)}
      />

      {/* Text Overflow & White Space */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <Select
          size="sm"
          label="Overflow"
          aria-label="Text overflow"
          value={textOverflow}
          options={TEXT_OVERFLOW_OPTIONS}
          onChange={(v) => onUpdateProp?.("typography.textOverflow", v)}
        />
        <Select
          size="sm"
          label="Wrap"
          aria-label="White space"
          value={whiteSpace}
          options={WHITE_SPACE_OPTIONS}
          onChange={(v) => onUpdateProp?.("typography.whiteSpace", v)}
        />
      </div>

      {/* Font Loading */}
      <Select
        size="sm"
        label="Loading"
        aria-label="Font loading"
        value={fontLoading}
        options={FONT_LOADING_OPTIONS}
        onChange={(v) => onUpdateProp?.("typography.fontLoading", v)}
      />
    </div>
  );
};
