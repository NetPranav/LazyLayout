"use client";

import React, { useState } from "react";
import { ArrowUp, ArrowRight, ArrowDown, ArrowLeft } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { OptionGroup, OptionRow, OptionTwo, OptionGrid4, OptionGridLabel } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";
import { useDocument } from "@/core/store/useDocumentStore";
import { isAutoLayout } from "@/core/editing/layoutOps";

export interface LayoutOptionsProps extends InspectorSectionProps {
  isFrame?: boolean;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  overflowX?: "visible" | "hidden" | "scroll" | "auto";
  overflowY?: "visible" | "hidden" | "scroll" | "auto";
  unit?: "px" | "%" | "vw" | "vh";
  boxSizing?: "border-box" | "content-box";
  alignSelf?: "auto" | "start" | "center" | "end" | "stretch";
  grow?: number;
  shrink?: number;
  reverse?: boolean;
  gridTemplate?: string;
  onChangeMinWidth?: (w: number) => void;
  onChangeMaxWidth?: (w: number) => void;
  onChangeMinHeight?: (h: number) => void;
  onChangeMaxHeight?: (h: number) => void;
  onChangePadding?: (side: "top" | "right" | "bottom" | "left", val: number) => void;
  onChangeMargin?: (side: "top" | "right" | "bottom" | "left", val: number) => void;
  onChangeOverflowX?: (ox: "visible" | "hidden" | "scroll" | "auto") => void;
  onChangeOverflowY?: (oy: "visible" | "hidden" | "scroll" | "auto") => void;
  onChangeUnit?: (u: "px" | "%" | "vw" | "vh") => void;
  onChangeBoxSizing?: (bs: "border-box" | "content-box") => void;
  onChangeAlignSelf?: (as: "auto" | "start" | "center" | "end" | "stretch") => void;
  onChangeGrow?: (g: number) => void;
  onChangeShrink?: (s: number) => void;
  onChangeReverse?: (rev: boolean) => void;
  onChangeGridTemplate?: (gt: string) => void;
}

const OVERFLOW_OPTIONS = [
  { value: "visible", label: "Visible", hint: "Children that stick out are drawn" },
  { value: "hidden", label: "Hidden", hint: "Children that stick out are cut off (this is Clip content)" },
  { value: "scroll", label: "Scroll", hint: "Always shows a scrollbar; children that stick out can be scrolled to" },
  { value: "auto", label: "Auto", hint: "A scrollbar only when something sticks out" },
] as const;

const UNIT_OPTIONS = [
  { value: "px", label: "px" },
  { value: "%", label: "%" },
  { value: "vw", label: "vw" },
  { value: "vh", label: "vh" },
] as const;

const BOX_SIZING_OPTIONS = [
  { value: "border-box", label: "Border box" },
  { value: "content-box", label: "Content box" },
] as const;

const ALIGN_SELF_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "end", label: "End" },
  { value: "stretch", label: "Stretch" },
] as const;

export const LayoutOptions: React.FC<LayoutOptionsProps> = ({
  layer,
  getValue,
  onUpdateProp,
  isFrame = false,
  minWidth: propMinWidth = 0,
  maxWidth: propMaxWidth = 0,
  minHeight: propMinHeight = 0,
  maxHeight: propMaxHeight = 0,
  paddingTop: propPadTop = 0,
  paddingRight: propPadRight = 0,
  paddingBottom: propPadBottom = 0,
  paddingLeft: propPadLeft = 0,
  marginTop: propMarTop = 0,
  marginRight: propMarRight = 0,
  marginBottom: propMarBottom = 0,
  marginLeft: propMarLeft = 0,
  overflowX: propOx = "visible",
  overflowY: propOy = "visible",
  unit: propUnit = "px",
  boxSizing: propBs = "border-box",
  alignSelf: propAs = "auto",
  grow: propGrow = 0,
  shrink: propShrink = 1,
  reverse: propRev = false,
  gridTemplate: propGt = "1fr 1fr",
  onChangeMinWidth,
  onChangeMaxWidth,
  onChangeMinHeight,
  onChangeMaxHeight,
  onChangePadding,
  onChangeMargin,
  onChangeOverflowX,
  onChangeOverflowY,
  onChangeUnit,
  onChangeBoxSizing,
  onChangeAlignSelf,
  onChangeGrow,
  onChangeShrink,
  onChangeReverse,
  onChangeGridTemplate,
}) => {
  // A child of a stack has Grow, Shrink and Self in the Layout section itself.
  const inStack = useDocument((d) => isAutoLayout(layer?.parentId ? d.layers[layer.parentId] : undefined));
  const currentMinWidth = typeof getValue?.("layout.minWidth") === "number" ? (getValue?.("layout.minWidth") as number) : propMinWidth;
  const currentMaxWidth = typeof getValue?.("layout.maxWidth") === "number" ? (getValue?.("layout.maxWidth") as number) : propMaxWidth;
  const currentMinHeight = typeof getValue?.("layout.minHeight") === "number" ? (getValue?.("layout.minHeight") as number) : propMinHeight;
  const currentMaxHeight = typeof getValue?.("layout.maxHeight") === "number" ? (getValue?.("layout.maxHeight") as number) : propMaxHeight;
  const currentPadTop = typeof getValue?.("layout.paddingTop") === "number" ? (getValue?.("layout.paddingTop") as number) : propPadTop;
  const currentPadRight = typeof getValue?.("layout.paddingRight") === "number" ? (getValue?.("layout.paddingRight") as number) : propPadRight;
  const currentPadBottom = typeof getValue?.("layout.paddingBottom") === "number" ? (getValue?.("layout.paddingBottom") as number) : propPadBottom;
  const currentPadLeft = typeof getValue?.("layout.paddingLeft") === "number" ? (getValue?.("layout.paddingLeft") as number) : propPadLeft;
  const currentMarTop = typeof getValue?.("layout.marginTop") === "number" ? (getValue?.("layout.marginTop") as number) : propMarTop;
  const currentMarRight = typeof getValue?.("layout.marginRight") === "number" ? (getValue?.("layout.marginRight") as number) : propMarRight;
  const currentMarBottom = typeof getValue?.("layout.marginBottom") === "number" ? (getValue?.("layout.marginBottom") as number) : propMarBottom;
  const currentMarLeft = typeof getValue?.("layout.marginLeft") === "number" ? (getValue?.("layout.marginLeft") as number) : propMarLeft;
  const currentOx = (getValue?.("layout.overflowX") as typeof propOx) ?? propOx;
  const currentOy = (getValue?.("layout.overflowY") as typeof propOy) ?? propOy;
  const currentUnit = (getValue?.("frame.widthUnit") as typeof propUnit) ?? propUnit;
  const currentBs = (getValue?.("layout.boxSizing") as typeof propBs) ?? propBs;
  const currentAs = (getValue?.("layout.alignSelf") as typeof propAs) ?? propAs;
  const currentGrow = typeof getValue?.("layout.flexGrow") === "number" ? (getValue?.("layout.flexGrow") as number) : propGrow;
  const currentShrink = typeof getValue?.("layout.flexShrink") === "number" ? (getValue?.("layout.flexShrink") as number) : propShrink;
  const currentRev = typeof getValue?.("layout.reverseZ") === "boolean" ? (getValue?.("layout.reverseZ") as boolean) : propRev;
  const currentGt = (getValue?.("layout.gridTemplateColumns") as string) || propGt;

  const minWidth = currentMinWidth;
  const maxWidth = currentMaxWidth;
  const minHeight = currentMinHeight;
  const maxHeight = currentMaxHeight;
  const padTop = currentPadTop;
  const padRight = currentPadRight;
  const padBottom = currentPadBottom;
  const padLeft = currentPadLeft;
  const marTop = currentMarTop;
  const marRight = currentMarRight;
  const marBottom = currentMarBottom;
  const marLeft = currentMarLeft;
  const overflowX = currentOx;
  const overflowY = currentOy;
  const unit = currentUnit;
  const boxSizing = currentBs;
  const alignSelf = currentAs;
  const grow = currentGrow;
  const shrink = currentShrink;
  const reverse = currentRev;
  const [typingGridTemplate, setTypingGridTemplate] = useState<string | null>(null);
  const gridTemplate = typingGridTemplate ?? currentGt;

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      {/* Group 1: Min/Max Width & Height */}
      <OptionGroup>
        <OptionRow label="Width">
          <OptionTwo>
            <NumberField
              size="sm"
              label="Min"
              value={minWidth}
              min={0}
              onChange={(w) => {
                onUpdateProp?.("layout.minWidth", w);
                onChangeMinWidth?.(w);
              }}
              aria-label="Min width"
            />
            <NumberField
              size="sm"
              label="Max"
              value={maxWidth}
              min={0}
              placeholder="none"
              onChange={(w) => {
                onUpdateProp?.("layout.maxWidth", w);
                onChangeMaxWidth?.(w);
              }}
              aria-label="Max width"
            />
          </OptionTwo>
        </OptionRow>

        <OptionRow label="Height">
          <OptionTwo>
            <NumberField
              size="sm"
              label="Min"
              value={minHeight}
              min={0}
              onChange={(h) => {
                onUpdateProp?.("layout.minHeight", h);
                onChangeMinHeight?.(h);
              }}
              aria-label="Min height"
            />
            <NumberField
              size="sm"
              label="Max"
              value={maxHeight}
              min={0}
              placeholder="none"
              onChange={(h) => {
                onUpdateProp?.("layout.maxHeight", h);
                onChangeMaxHeight?.(h);
              }}
              aria-label="Max height"
            />
          </OptionTwo>
        </OptionRow>
      </OptionGroup>

      {/* Group 2: Padding & Margin */}
      <OptionGroup>
        <OptionGridLabel label="Padding">
          <OptionGrid4>
            <NumberField
              size="sm"
              aria-label="Padding top"
              label={<Icon icon={ArrowUp} size={11} className="ll:text-muted" />}
              value={padTop}
              min={0}
              onChange={(v) => {
                onUpdateProp?.("layout.paddingTop", v);
                onChangePadding?.("top", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Padding right"
              label={<Icon icon={ArrowRight} size={11} className="ll:text-muted" />}
              value={padRight}
              min={0}
              onChange={(v) => {
                onUpdateProp?.("layout.paddingRight", v);
                onChangePadding?.("right", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Padding bottom"
              label={<Icon icon={ArrowDown} size={11} className="ll:text-muted" />}
              value={padBottom}
              min={0}
              onChange={(v) => {
                onUpdateProp?.("layout.paddingBottom", v);
                onChangePadding?.("bottom", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Padding left"
              label={<Icon icon={ArrowLeft} size={11} className="ll:text-muted" />}
              value={padLeft}
              min={0}
              onChange={(v) => {
                onUpdateProp?.("layout.paddingLeft", v);
                onChangePadding?.("left", v);
              }}
            />
          </OptionGrid4>
        </OptionGridLabel>

        <OptionGridLabel label="Margin">
          <OptionGrid4>
            <NumberField
              size="sm"
              aria-label="Margin top"
              label={<Icon icon={ArrowUp} size={11} className="ll:text-muted" />}
              value={marTop}
              onChange={(v) => {
                onUpdateProp?.("layout.marginTop", v);
                onChangeMargin?.("top", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Margin right"
              label={<Icon icon={ArrowRight} size={11} className="ll:text-muted" />}
              value={marRight}
              onChange={(v) => {
                onUpdateProp?.("layout.marginRight", v);
                onChangeMargin?.("right", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Margin bottom"
              label={<Icon icon={ArrowDown} size={11} className="ll:text-muted" />}
              value={marBottom}
              onChange={(v) => {
                onUpdateProp?.("layout.marginBottom", v);
                onChangeMargin?.("bottom", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Margin left"
              label={<Icon icon={ArrowLeft} size={11} className="ll:text-muted" />}
              value={marLeft}
              onChange={(v) => {
                onUpdateProp?.("layout.marginLeft", v);
                onChangeMargin?.("left", v);
              }}
            />
          </OptionGrid4>
        </OptionGridLabel>
      </OptionGroup>

      {/* Group 3: Overflow, Unit, Box Sizing */}
      <OptionGroup>
        <OptionRow label="Overflow X">
          <Select
            size="sm"
            aria-label="Overflow X"
            value={overflowX}
            options={OVERFLOW_OPTIONS}
            onChange={(ox) => {
              const next = ox as typeof overflowX;
              onUpdateProp?.("layout.overflowX", next);
              onChangeOverflowX?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Overflow Y">
          <Select
            size="sm"
            aria-label="Overflow Y"
            value={overflowY}
            options={OVERFLOW_OPTIONS}
            onChange={(oy) => {
              const next = oy as typeof overflowY;
              onUpdateProp?.("layout.overflowY", next);
              onChangeOverflowY?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Unit">
          <Select
            size="sm"
            aria-label="Unit"
            value={unit}
            options={UNIT_OPTIONS}
            onChange={(u) => {
              const next = u as typeof unit;
              onUpdateProp?.("frame.widthUnit", next);
              onUpdateProp?.("frame.heightUnit", next);
              onChangeUnit?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Box">
          <Select
            size="sm"
            aria-label="Box"
            value={boxSizing}
            options={BOX_SIZING_OPTIONS}
            onChange={(bs) => {
              const next = bs as typeof boxSizing;
              onUpdateProp?.("layout.boxSizing", next);
              onChangeBoxSizing?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      {/* Group 4: Flex Child or Frame Grid */}
      <OptionGroup>
        {isFrame ? (
          <>
            <OptionRow label="Reverse">
              <label className="ll:flex ll:items-center ll:gap-2 ll:cursor-pointer">
                <input
                  type="checkbox"
                  checked={reverse}
                  aria-label="Reverse direction"
                  onChange={(e) => {
                    onUpdateProp?.("layout.reverseZ", e.target.checked);
                    onChangeReverse?.(e.target.checked);
                  }}
                  className="ll:rounded-xs ll:border-border ll:text-primary ll:focus:ring-primary"
                />
                <span className="ll:text-small ll:text-muted">Reverse order</span>
              </label>
            </OptionRow>

            <OptionRow label="Grid">
              <div className="dfield ll-dfield field ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:w-full">
                <input
                  type="text"
                  value={gridTemplate}
                  aria-label="Grid template"
                  onChange={(e) => {
                    setTypingGridTemplate(e.target.value);
                    onUpdateProp?.("layout.gridTemplateColumns", e.target.value);
                    onChangeGridTemplate?.(e.target.value);
                  }}
                  onBlur={() => setTypingGridTemplate(null)}
                  className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
                />
              </div>
            </OptionRow>
          </>
        ) : inStack ? null : (
          <>
            <OptionRow label="Self">
              <Select
                size="sm"
                aria-label="Self"
                value={alignSelf}
                options={ALIGN_SELF_OPTIONS}
                onChange={(as) => {
                  const next = as as typeof alignSelf;
                  onUpdateProp?.("layout.alignSelf", next);
                  onChangeAlignSelf?.(next);
                }}
                className="ll:w-full"
              />
            </OptionRow>

            <OptionRow label="Grow">
              <NumberField
                size="sm"
                aria-label="Grow"
                value={grow}
                min={0}
                step={1}
                onChange={(g) => {
                  onUpdateProp?.("layout.flexGrow", g);
                  onChangeGrow?.(g);
                }}
                className="ll:w-full"
              />
            </OptionRow>

            <OptionRow label="Shrink">
              <NumberField
                size="sm"
                aria-label="Shrink"
                value={shrink}
                min={0}
                step={1}
                onChange={(s) => {
                  onUpdateProp?.("layout.flexShrink", s);
                  onChangeShrink?.(s);
                }}
                className="ll:w-full"
              />
            </OptionRow>
          </>
        )}
      </OptionGroup>
    </div>
  );
};
