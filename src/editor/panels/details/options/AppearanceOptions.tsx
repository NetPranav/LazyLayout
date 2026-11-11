"use client";

import React from "react";
import { CornerUpLeft, CornerUpRight, CornerDownRight, CornerDownLeft } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { OptionGroup, OptionRow, OptionGrid4, OptionGridLabel } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { isPropertyLegalFor } from "@/core/document/properties";
import type { InspectorSectionProps } from "../types";

const ONE_RADIUS = "This layer takes one radius for all corners; per-corner radius is for rectangles";

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
  layer,
  getValue,
  onUpdateProp,
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
  // only a rectangle has four corner radii; every other layer has the one `appearance.radius`
  const perCorner = !layer || isPropertyLegalFor("shape.cornerRadius.topLeft", layer.archetype);
  const currentTl = perCorner && typeof getValue?.("shape.cornerRadius.topLeft") === "number"
    ? (getValue?.("shape.cornerRadius.topLeft") as number)
    : typeof getValue?.("appearance.radius") === "number"
    ? (getValue?.("appearance.radius") as number)
    : propTl;
  const currentTr = perCorner && typeof getValue?.("shape.cornerRadius.topRight") === "number"
    ? (getValue?.("shape.cornerRadius.topRight") as number)
    : typeof getValue?.("appearance.radius") === "number"
    ? (getValue?.("appearance.radius") as number)
    : propTr;
  const currentBr = perCorner && typeof getValue?.("shape.cornerRadius.bottomRight") === "number"
    ? (getValue?.("shape.cornerRadius.bottomRight") as number)
    : typeof getValue?.("appearance.radius") === "number"
    ? (getValue?.("appearance.radius") as number)
    : propBr;
  const currentBl = perCorner && typeof getValue?.("shape.cornerRadius.bottomLeft") === "number"
    ? (getValue?.("shape.cornerRadius.bottomLeft") as number)
    : typeof getValue?.("appearance.radius") === "number"
    ? (getValue?.("appearance.radius") as number)
    : propBl;
  const currentBlend = (getValue?.("appearance.blendMode") as string) || propBlend;
  const currentCursor = (getValue?.("appearance.cursor") as typeof propCursor) ?? propCursor;
  const currentPe = (getValue?.("appearance.pointerEvents") as typeof propPe) ?? propPe;

  const tl = currentTl;
  const tr = currentTr;
  const br = currentBr;
  const bl = currentBl;
  const blend = currentBlend;
  const cursor = currentCursor;
  const pointerEvents = currentPe;

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
                onUpdateProp?.(perCorner ? "shape.cornerRadius.topLeft" : "appearance.radius", v);
                onChangeCornerRadius?.("tl", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Top right radius"
              label={<Icon icon={CornerUpRight} size={11} className="ll:text-muted" />}
              value={tr}
              min={0}
              disabled={!perCorner}
              title={perCorner ? undefined : ONE_RADIUS}
              onChange={(v) => {
                onUpdateProp?.(perCorner ? "shape.cornerRadius.topRight" : "appearance.radius", v);
                onChangeCornerRadius?.("tr", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Bottom right radius"
              label={<Icon icon={CornerDownRight} size={11} className="ll:text-muted" />}
              value={br}
              min={0}
              disabled={!perCorner}
              title={perCorner ? undefined : ONE_RADIUS}
              onChange={(v) => {
                onUpdateProp?.(perCorner ? "shape.cornerRadius.bottomRight" : "appearance.radius", v);
                onChangeCornerRadius?.("br", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Bottom left radius"
              label={<Icon icon={CornerDownLeft} size={11} className="ll:text-muted" />}
              value={bl}
              min={0}
              disabled={!perCorner}
              title={perCorner ? undefined : ONE_RADIUS}
              onChange={(v) => {
                onUpdateProp?.(perCorner ? "shape.cornerRadius.bottomLeft" : "appearance.radius", v);
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
              onUpdateProp?.("appearance.blendMode", b);
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
              onUpdateProp?.("appearance.cursor", next);
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
              onUpdateProp?.("appearance.pointerEvents", next);
              onChangePointerEvents?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};
