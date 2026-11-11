"use client";

import React from "react";
import { Italic, Underline, Strikethrough, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Slider } from "@/editor/components/Slider";
import { IconButton } from "@/editor/components/IconButton";
import { OptionGroup, OptionRow, OptionGridLabel } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

export interface TypographyOptionsProps extends InspectorSectionProps {
  textCase?: "none" | "uppercase" | "lowercase" | "titlecase";
  italic?: boolean;
  decoration?: "none" | "underline" | "line-through";
  wordSpacing?: number;
  textOverflow?: "clip" | "ellipsis";
  whiteSpace?: "normal" | "nowrap" | "pre";
  fontLoading?: "swap" | "block" | "fallback" | "optional";
  weightAxis?: number;
  onChangeTextCase?: (tc: "none" | "uppercase" | "lowercase" | "titlecase") => void;
  onChangeItalic?: (it: boolean) => void;
  onChangeDecoration?: (deco: "none" | "underline" | "line-through") => void;
  onChangeWordSpacing?: (ws: number) => void;
  onChangeTextOverflow?: (to: "clip" | "ellipsis") => void;
  onChangeWhiteSpace?: (ws: "normal" | "nowrap" | "pre") => void;
  onChangeFontLoading?: (fl: "swap" | "block" | "fallback" | "optional") => void;
  onChangeWeightAxis?: (w: number) => void;
}

const CASE_OPTIONS = [
  { value: "none", label: "—" },
  { value: "uppercase", label: "AG" },
  { value: "lowercase", label: "ag" },
  { value: "titlecase", label: "Ag" },
] as const;

const DECORATION_OPTIONS = [
  { value: "none", label: <Icon icon={Minus} size={13} />, ariaLabel: "No decoration" },
  { value: "underline", label: <Icon icon={Underline} size={13} />, ariaLabel: "Underline" },
  { value: "line-through", label: <Icon icon={Strikethrough} size={13} />, ariaLabel: "Strikethrough" },
] as const;

const OVERFLOW_OPTIONS = [
  { value: "clip", label: "Clip" },
  { value: "ellipsis", label: "Ellipsis" },
] as const;

const WHITE_SPACE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "nowrap", label: "No wrap" },
  { value: "pre", label: "Pre" },
] as const;

const FONT_LOADING_OPTIONS = [
  { value: "swap", label: "Swap" },
  { value: "block", label: "Block" },
  { value: "fallback", label: "Fallback" },
  { value: "optional", label: "Optional" },
] as const;

export const TypographyOptions: React.FC<TypographyOptionsProps> = ({
  getValue,
  onUpdateProp,
  textCase: propCase = "none",
  italic: propItalic = false,
  decoration: propDeco = "none",
  wordSpacing: propWs = 0,
  textOverflow: propTo = "clip",
  whiteSpace: propWh = "normal",
  fontLoading: propFl = "swap",
  weightAxis: propWa = 400,
  onChangeTextCase,
  onChangeItalic,
  onChangeDecoration,
  onChangeWordSpacing,
  onChangeTextOverflow,
  onChangeWhiteSpace,
  onChangeFontLoading,
  onChangeWeightAxis,
}) => {
  const rawTransform = (getValue?.("typography.textTransform") as string) || "none";
  const currentCase = (rawTransform === "capitalize" ? "titlecase" : (rawTransform as typeof propCase)) || propCase;
  const currentItalic = getValue?.("typography.fontStyle") === "italic" || Boolean(getValue?.("typography.format.italic")) || propItalic;
  const currentDeco = (getValue?.("typography.textDecoration") as typeof propDeco) ?? propDeco;
  const currentWs = typeof getValue?.("typography.wordSpacing") === "number" ? (getValue?.("typography.wordSpacing") as number) : propWs;
  const currentTo = (getValue?.("typography.textOverflow") as typeof propTo) ?? propTo;
  const currentWh = (getValue?.("typography.whiteSpace") as typeof propWh) ?? propWh;
  const currentFl = (getValue?.("typography.fontLoading") as typeof propFl) ?? propFl;
  const rawWeight = getValue?.("typography.fontWeight");
  const currentWa = typeof rawWeight === "number" ? rawWeight : typeof rawWeight === "string" && !isNaN(Number(rawWeight)) ? Number(rawWeight) : propWa;

  const textCase = currentCase;
  const italic = currentItalic;
  const decoration = currentDeco;
  const wordSpacing = currentWs;
  const textOverflow = currentTo;
  const whiteSpace = currentWh;
  const fontLoading = currentFl;
  const weightAxis = currentWa;

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      {/* Group 1: Case + Italic toggle, and Decoration */}
      <OptionGroup>
        <OptionGridLabel label="Case">
          <div className="ll:flex ll:items-center ll:gap-1.5 ll:w-full">
            <div className="ll:flex-1 ll:min-w-0">
              <SegmentedControl
                size="compact"
                ariaLabel="Text case"
                options={CASE_OPTIONS}
                value={textCase}
                onChange={(c) => {
                  const mapped = c === "titlecase" ? "capitalize" : c;
                  onUpdateProp?.("typography.textTransform", mapped);
                  onChangeTextCase?.(c);
                }}
                className="ll:w-full"
              />
            </div>
            <IconButton
              size="sm"
              variant="ghost"
              pressed={italic}
              aria-label="Italic"
              tooltip="Italic"
              onClick={() => {
                const next = !italic;
                onUpdateProp?.("typography.fontStyle", next ? "italic" : "normal");
                onUpdateProp?.("typography.format.italic", next);
                onChangeItalic?.(next);
              }}
              icon={<Icon icon={Italic} size={14} />}
              className={italic ? "ll:bg-control-active ll:text-primary" : ""}
            />
          </div>
        </OptionGridLabel>

        <OptionGridLabel label="Decoration">
          <SegmentedControl
            size="compact"
            ariaLabel="Text decoration"
            options={DECORATION_OPTIONS}
            value={decoration}
            onChange={(d) => {
              onUpdateProp?.("typography.textDecoration", d);
              onChangeDecoration?.(d);
            }}
            className="ll:w-full"
          />
        </OptionGridLabel>
      </OptionGroup>

      {/* Group 2: Word spacing, Text overflow, White space */}
      <OptionGroup>
        <OptionRow label="Word">
          <NumberField
            size="sm"
            aria-label="Word spacing"
            value={wordSpacing}
            step={1}
            onChange={(ws) => {
              onUpdateProp?.("typography.wordSpacing", ws);
              onChangeWordSpacing?.(ws);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Overflow">
          <Select
            size="sm"
            aria-label="Text overflow"
            value={textOverflow}
            options={OVERFLOW_OPTIONS}
            onChange={(to) => {
              const next = to as typeof textOverflow;
              onUpdateProp?.("typography.textOverflow", next);
              onChangeTextOverflow?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Wrap">
          <Select
            size="sm"
            aria-label="White space"
            value={whiteSpace}
            options={WHITE_SPACE_OPTIONS}
            onChange={(wh) => {
              const next = wh as typeof whiteSpace;
              onUpdateProp?.("typography.whiteSpace", next);
              onChangeWhiteSpace?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      {/* Group 3: Font loading & Weight axis slider */}
      <OptionGroup>
        <OptionRow label="Loading">
          <Select
            size="sm"
            aria-label="Font loading"
            value={fontLoading}
            options={FONT_LOADING_OPTIONS}
            onChange={(fl) => {
              const next = fl as typeof fontLoading;
              onUpdateProp?.("typography.fontLoading", next);
              onChangeFontLoading?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <div className="gsz ll-gsz ll:flex ll:flex-col ll:gap-1 ll:w-full ll:pt-1">
          <div className="gsrow ll:flex ll:items-center ll:justify-between ll:min-h-5">
            <span className="dsub ll-dsub ll:text-small ll:font-normal ll:text-muted">
              Weight axis
            </span>
            <span className="dsub mono ll-dsub ll:font-mono ll:text-micro ll:text-muted">
              {weightAxis}
            </span>
          </div>
          <div className="ll:flex ll:items-center ll:h-6 ll:w-full">
            <Slider
              min={100}
              max={900}
              step={1}
              value={weightAxis}
              ariaLabel="Weight axis"
              onChange={(w) => {
                onUpdateProp?.("typography.fontWeight", String(w));
                onChangeWeightAxis?.(w);
              }}
            />
          </div>
        </div>
      </OptionGroup>
    </div>
  );
};
