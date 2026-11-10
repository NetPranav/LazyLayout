"use client";

import React, { useState } from "react";
import { CornerUpLeft, CornerUpRight, CornerDownRight, CornerDownLeft } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { OptionGroup, OptionRow, OptionGrid4, OptionGridLabel } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

export interface AppearanceOptionsProps extends InspectorSectionProps {
  radiusTopLeft?: number;
  radiusTopRight?: number;
  radiusBottomRight?: number;
  radiusBottomLeft?: number;
  blend?: string;
  cursor?: "auto" | "pointer" | "text" | "move" | "not-allowed";
  pointerEvents?: "auto" | "none";
  onChangeCornerRadius?: (corner: "tl" | "tr" | "br" | "bl", val: number) => void;
  onChangeBlend?: (bl: string) => void;
  onChangeCursor?: (cur: "auto" | "pointer" | "text" | "move" | "not-allowed") => void;
  onChangePointerEvents?: (pe: "auto" | "none") => void;
}

const BLEND_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
] as const;

const CURSOR_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "pointer", label: "Pointer" },
  { value: "text", label: "Text" },
  { value: "move", label: "Move" },
  { value: "not-allowed", label: "Not allowed" },
] as const;

const POINTER_EVENTS_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "none", label: "None" },
] as const;

export const AppearanceOptions: React.FC<AppearanceOptionsProps> = ({
  radiusTopLeft: propTl = 0,
  radiusTopRight: propTr = 0,
  radiusBottomRight: propBr = 0,
  radiusBottomLeft: propBl = 0,
  blend: propBlend = "normal",
  cursor: propCursor = "auto",
  pointerEvents: propPe = "auto",
  onChangeCornerRadius,
  onChangeBlend,
  onChangeCursor,
  onChangePointerEvents,
}) => {
  const [tl, setTl] = useState(propTl);
  const [tr, setTr] = useState(propTr);
  const [br, setBr] = useState(propBr);
  const [bl, setBl] = useState(propBl);
  const [blend, setBlend] = useState(propBlend);
  const [cursor, setCursor] = useState(propCursor);
  const [pointerEvents, setPointerEvents] = useState(propPe);

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      {/* Group 1: Individual Corners */}
      <OptionGroup>
        <OptionGridLabel label="Corners">
          <OptionGrid4>
            <NumberField
              size="sm"
              aria-label="Top left radius"
              label={<Icon icon={CornerUpLeft} size={11} className="ll:text-muted" />}
              value={tl}
              min={0}
              onChange={(v) => {
                setTl(v);
                onChangeCornerRadius?.("tl", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Top right radius"
              label={<Icon icon={CornerUpRight} size={11} className="ll:text-muted" />}
              value={tr}
              min={0}
              onChange={(v) => {
                setTr(v);
                onChangeCornerRadius?.("tr", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Bottom right radius"
              label={<Icon icon={CornerDownRight} size={11} className="ll:text-muted" />}
              value={br}
              min={0}
              onChange={(v) => {
                setBr(v);
                onChangeCornerRadius?.("br", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Bottom left radius"
              label={<Icon icon={CornerDownLeft} size={11} className="ll:text-muted" />}
              value={bl}
              min={0}
              onChange={(v) => {
                setBl(v);
                onChangeCornerRadius?.("bl", v);
              }}
            />
          </OptionGrid4>
        </OptionGridLabel>
      </OptionGroup>

      {/* Group 2: Blend mode, Cursor, Pointer events */}
      <OptionGroup>
        <OptionRow label="Blend">
          <Select
            size="sm"
            aria-label="Blend mode"
            value={blend}
            options={BLEND_OPTIONS}
            onChange={(b) => {
              setBlend(b);
              onChangeBlend?.(b);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Cursor">
          <Select
            size="sm"
            aria-label="Cursor"
            value={cursor}
            options={CURSOR_OPTIONS}
            onChange={(c) => {
              const next = c as typeof cursor;
              setCursor(next);
              onChangeCursor?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Events">
          <Select
            size="sm"
            aria-label="Pointer events"
            value={pointerEvents}
            options={POINTER_EVENTS_OPTIONS}
            onChange={(pe) => {
              const next = pe as typeof pointerEvents;
              setPointerEvents(next);
              onChangePointerEvents?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};
