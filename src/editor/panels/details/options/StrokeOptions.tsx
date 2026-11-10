"use client";

import React, { useState } from "react";
import { OptionGroup, OptionRow } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

export interface StrokeOptionsProps extends InspectorSectionProps {
  position?: "inside" | "center" | "outside";
  width?: number;
  style?: "solid" | "dashed" | "dotted";
  sides?: "all" | "top" | "right" | "bottom" | "left";
  cap?: "butt" | "round" | "square";
  join?: "miter" | "round" | "bevel";
  miter?: number;
  dash?: string;
  onChangePosition?: (pos: "inside" | "center" | "outside") => void;
  onChangeWidth?: (w: number) => void;
  onChangeStyle?: (s: "solid" | "dashed" | "dotted") => void;
  onChangeSides?: (sides: "all" | "top" | "right" | "bottom" | "left") => void;
  onChangeCap?: (cap: "butt" | "round" | "square") => void;
  onChangeJoin?: (join: "miter" | "round" | "bevel") => void;
  onChangeMiter?: (miter: number) => void;
  onChangeDash?: (dash: string) => void;
}

const POSITION_OPTIONS = [
  { value: "inside", label: "Inside" },
  { value: "center", label: "Center" },
  { value: "outside", label: "Outside" },
] as const;

const STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
] as const;

/** Which sides of the box carry the stroke: the whole outline, or one edge drawn on a faint box. */
function SideGlyph({ side }: { side: "all" | "top" | "right" | "bottom" | "left" }) {
  const edge = { top: "M4 4h16", right: "M20 4v16", bottom: "M4 20h16", left: "M4 4v16" }[side as "top"];
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="1" opacity={side === "all" ? 1 : 0.35} />
      {side !== "all" && <path d={edge} />}
    </svg>
  );
}

const SIDES_OPTIONS = (["all", "top", "right", "bottom", "left"] as const).map((value) => ({
  value,
  icon: <SideGlyph side={value} />,
  ariaLabel: value === "all" ? "All sides" : `${value[0].toUpperCase()}${value.slice(1)} side`,
  title: value === "all" ? "All sides" : `${value[0].toUpperCase()}${value.slice(1)} side`,
}));

const CAP_OPTIONS = [
  { value: "butt", label: "Butt" },
  { value: "round", label: "Round" },
  { value: "square", label: "Square" },
] as const;

const JOIN_OPTIONS = [
  { value: "miter", label: "Miter" },
  { value: "round", label: "Round" },
  { value: "bevel", label: "Bevel" },
] as const;

export const StrokeOptions: React.FC<StrokeOptionsProps> = ({
  getValue,
  onUpdateProp,
  position: propPosition = "inside",
  width: propWidth = 1,
  style: propStyle = "solid",
  sides: propSides = "all",
  cap: propCap = "round",
  join: propJoin = "round",
  miter: propMiter = 4,
  dash: propDash = "",
  onChangePosition,
  onChangeWidth,
  onChangeStyle,
  onChangeSides,
  onChangeCap,
  onChangeJoin,
  onChangeMiter,
  onChangeDash,
}) => {
  const currentPos = (getValue?.("stroke.align") as typeof propPosition) ?? propPosition;
  const currentWidth = typeof getValue?.("appearance.border.width") === "number"
    ? (getValue?.("appearance.border.width") as number)
    : typeof getValue?.("svg.strokeWidth") === "number"
    ? (getValue?.("svg.strokeWidth") as number)
    : propWidth;
  const currentStyle = (getValue?.("appearance.border.style") as typeof propStyle) ?? propStyle;
  const currentCap = (getValue?.("svg.strokeLinecap") as typeof propCap) ?? propCap;
  const currentJoin = (getValue?.("svg.strokeLinejoin") as typeof propJoin) ?? propJoin;
  const currentDash = (getValue?.("svg.strokeDasharray") as string) || propDash;

  const position = currentPos;
  const width = currentWidth;
  const style = currentStyle;
  const [sides, setSides] = useState(propSides);
  const cap = currentCap;
  const join = currentJoin;
  const [miter, setMiter] = useState(propMiter);
  const [typingDash, setTypingDash] = useState<string | null>(null);
  const dash = typingDash ?? currentDash;

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      {/* Group 1: Position & Width */}
      <OptionGroup>
        <OptionRow label="Position">
          <Select
            size="sm"
            aria-label="Stroke position"
            value={position}
            options={POSITION_OPTIONS}
            onChange={(val) => {
              const next = val as "inside" | "center" | "outside";
              onUpdateProp?.("stroke.align", next);
              onChangePosition?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Width">
          <NumberField
            size="sm"
            aria-label="Stroke width"
            value={width}
            min={0}
            step={1}
            onChange={(w) => {
              onUpdateProp?.("appearance.border.width", w);
              onUpdateProp?.("svg.strokeWidth", w);
              onChangeWidth?.(w);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      {/* Group 2: Style & Sides */}
      <OptionGroup>
        <OptionRow label="Style">
          <SegmentedControl
            size="compact"
            ariaLabel="Stroke style"
            options={STYLE_OPTIONS}
            value={style}
            onChange={(s) => {
              onUpdateProp?.("appearance.border.style", s);
              onChangeStyle?.(s);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Sides">
          <SegmentedControl
            size="compact"
            ariaLabel="Stroke sides"
            options={SIDES_OPTIONS}
            value={sides}
            onChange={(sd) => {
              setSides(sd);
              onChangeSides?.(sd);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      {/* Group 3: Cap, Join, Miter & Dash */}
      <OptionGroup>
        <OptionRow label="Cap">
          <Select
            size="sm"
            aria-label="Line cap"
            value={cap}
            options={CAP_OPTIONS}
            onChange={(c) => {
              const next = c as "butt" | "round" | "square";
              onUpdateProp?.("svg.strokeLinecap", next);
              onChangeCap?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Join">
          <Select
            size="sm"
            aria-label="Line join"
            value={join}
            options={JOIN_OPTIONS}
            onChange={(j) => {
              const next = j as "miter" | "round" | "bevel";
              onUpdateProp?.("svg.strokeLinejoin", next);
              onChangeJoin?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Miter">
          <NumberField
            size="sm"
            aria-label="Miter limit"
            value={miter}
            min={1}
            max={20}
            step={1}
            onChange={(m) => {
              setMiter(m);
              onChangeMiter?.(m);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Dash">
          <div className="dfield ll-dfield field ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm ll:w-full">
            <input
              type="text"
              aria-label="Dash array"
              placeholder="e.g. 4 2"
              value={dash}
              onChange={(e) => {
                setTypingDash(e.target.value);
                onUpdateProp?.("svg.strokeDasharray", e.target.value);
                onChangeDash?.(e.target.value);
              }}
              onBlur={() => setTypingDash(null)}
              className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
            />
          </div>
        </OptionRow>
      </OptionGroup>
    </div>
  );
};
