"use client";

import React, { useState } from "react";
import { ArrowUp, ArrowRight, ArrowDown, ArrowLeft } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { OptionGroup, OptionRow, OptionTwo, OptionGrid4, OptionGridLabel } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

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
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "scroll", label: "Scroll" },
  { value: "auto", label: "Auto" },
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
  const [minWidth, setMinWidth] = useState(propMinWidth);
  const [maxWidth, setMaxWidth] = useState(propMaxWidth);
  const [minHeight, setMinHeight] = useState(propMinHeight);
  const [maxHeight, setMaxHeight] = useState(propMaxHeight);
  const [padTop, setPadTop] = useState(propPadTop);
  const [padRight, setPadRight] = useState(propPadRight);
  const [padBottom, setPadBottom] = useState(propPadBottom);
  const [padLeft, setPadLeft] = useState(propPadLeft);
  const [marTop, setMarTop] = useState(propMarTop);
  const [marRight, setMarRight] = useState(propMarRight);
  const [marBottom, setMarBottom] = useState(propMarBottom);
  const [marLeft, setMarLeft] = useState(propMarLeft);
  const [overflowX, setOverflowX] = useState(propOx);
  const [overflowY, setOverflowY] = useState(propOy);
  const [unit, setUnit] = useState(propUnit);
  const [boxSizing, setBoxSizing] = useState(propBs);
  const [alignSelf, setAlignSelf] = useState(propAs);
  const [grow, setGrow] = useState(propGrow);
  const [shrink, setShrink] = useState(propShrink);
  const [reverse, setReverse] = useState(propRev);
  const [gridTemplate, setGridTemplate] = useState(propGt);

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
                setMinWidth(w);
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
                setMaxWidth(w);
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
                setMinHeight(h);
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
                setMaxHeight(h);
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
                setPadTop(v);
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
                setPadRight(v);
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
                setPadBottom(v);
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
                setPadLeft(v);
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
                setMarTop(v);
                onChangeMargin?.("top", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Margin right"
              label={<Icon icon={ArrowRight} size={11} className="ll:text-muted" />}
              value={marRight}
              onChange={(v) => {
                setMarRight(v);
                onChangeMargin?.("right", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Margin bottom"
              label={<Icon icon={ArrowDown} size={11} className="ll:text-muted" />}
              value={marBottom}
              onChange={(v) => {
                setMarBottom(v);
                onChangeMargin?.("bottom", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Margin left"
              label={<Icon icon={ArrowLeft} size={11} className="ll:text-muted" />}
              value={marLeft}
              onChange={(v) => {
                setMarLeft(v);
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
              setOverflowX(next);
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
              setOverflowY(next);
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
              setUnit(next);
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
              setBoxSizing(next);
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
                    setReverse(e.target.checked);
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
                    setGridTemplate(e.target.value);
                    onChangeGridTemplate?.(e.target.value);
                  }}
                  className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
                />
              </div>
            </OptionRow>
          </>
        ) : (
          <>
            <OptionRow label="Self">
              <Select
                size="sm"
                aria-label="Self"
                value={alignSelf}
                options={ALIGN_SELF_OPTIONS}
                onChange={(as) => {
                  const next = as as typeof alignSelf;
                  setAlignSelf(next);
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
                  setGrow(g);
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
                  setShrink(s);
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
