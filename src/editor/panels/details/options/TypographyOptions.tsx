"use client";

import React, { useState } from "react";
import { Italic, Underline, Strikethrough, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
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
  const [textCase, setTextCase] = useState(propCase);
  const [italic, setItalic] = useState(propItalic);
  const [decoration, setDecoration] = useState(propDeco);
  const [wordSpacing, setWordSpacing] = useState(propWs);
  const [textOverflow, setTextOverflow] = useState(propTo);
  const [whiteSpace, setWhiteSpace] = useState(propWh);
  const [fontLoading, setFontLoading] = useState(propFl);
  const [weightAxis, setWeightAxis] = useState(propWa);

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
                  setTextCase(c);
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
                setItalic(next);
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
              setDecoration(d);
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
              setWordSpacing(ws);
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
              setTextOverflow(next);
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
              setWhiteSpace(next);
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
              setFontLoading(next);
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
            <input
              type="range"
              min={100}
              max={900}
              step={10}
              value={weightAxis}
              aria-label="Weight axis"
              onChange={(e) => {
                const w = Number(e.target.value);
                setWeightAxis(w);
                onChangeWeightAxis?.(w);
              }}
              className="ll:w-full ll:accent-primary ll:cursor-pointer"
            />
          </div>
        </div>
      </OptionGroup>
    </div>
  );
};
