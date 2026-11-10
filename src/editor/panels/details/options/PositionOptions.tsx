"use client";

import React, { useState } from "react";
import { PhosphorMotionIcon } from "@/editor/components/icons/PhosphorIcon";
import { OptionGroup, OptionRow, OptionTwo, OptionGrid4, OptionGridLabel } from "./OptionRow";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

export interface PositionOptionsProps extends InspectorSectionProps {
  type?: "static" | "relative" | "absolute" | "fixed" | "sticky";
  zIndex?: number;
  offsetTop?: number;
  offsetRight?: number;
  offsetBottom?: number;
  offsetLeft?: number;
  scaleX?: number;
  scaleY?: number;
  skewX?: number;
  skewY?: number;
  rotateX?: number;
  rotateY?: number;
  origin?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  onChangeType?: (t: "static" | "relative" | "absolute" | "fixed" | "sticky") => void;
  onChangeZIndex?: (z: number) => void;
  onChangeOffset?: (side: "top" | "right" | "bottom" | "left", val: number) => void;
  onChangeScale?: (axis: "x" | "y", val: number) => void;
  onChangeSkew?: (axis: "x" | "y", val: number) => void;
  onChangeRotate3D?: (axis: "x" | "y", val: number) => void;
  onChangeOrigin?: (origin: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right") => void;
}

const TYPE_OPTIONS = [
  { value: "static", label: "Static" },
  { value: "relative", label: "Relative" },
  { value: "absolute", label: "Absolute" },
  { value: "fixed", label: "Fixed" },
  { value: "sticky", label: "Sticky" },
] as const;

const ORIGIN_OPTIONS = [
  { value: "center", label: "Center" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
] as const;

export const PositionOptions: React.FC<PositionOptionsProps> = ({
  getValue,
  onUpdateProp,
  type: propType = "static",
  zIndex: propZIndex = 0,
  offsetTop: propOffsetTop = 0,
  offsetRight: propOffsetRight = 0,
  offsetBottom: propOffsetBottom = 0,
  offsetLeft: propOffsetLeft = 0,
  scaleX: propScaleX = 1,
  scaleY: propScaleY = 1,
  skewX: propSkewX = 0,
  skewY: propSkewY = 0,
  rotateX: propRotateX = 0,
  rotateY: propRotateY = 0,
  origin: propOrigin = "center",
  onChangeType,
  onChangeZIndex,
  onChangeOffset,
  onChangeScale,
  onChangeSkew,
  onChangeRotate3D,
  onChangeOrigin,
}) => {
  const currentType = (getValue?.("layout.position") as typeof propType) ?? propType;
  const currentZIndex = typeof getValue?.("layout.zIndex") === "number" ? (getValue?.("layout.zIndex") as number) : propZIndex;
  const currentOffsetTop = typeof getValue?.("layout.top") === "number" ? (getValue?.("layout.top") as number) : propOffsetTop;
  const currentOffsetRight = typeof getValue?.("layout.right") === "number" ? (getValue?.("layout.right") as number) : propOffsetRight;
  const currentOffsetBottom = typeof getValue?.("layout.bottom") === "number" ? (getValue?.("layout.bottom") as number) : propOffsetBottom;
  const currentOffsetLeft = typeof getValue?.("layout.left") === "number" ? (getValue?.("layout.left") as number) : propOffsetLeft;
  const currentScaleX = typeof getValue?.("transform.scaleX") === "number" ? (getValue?.("transform.scaleX") as number) : propScaleX;
  const currentScaleY = typeof getValue?.("transform.scaleY") === "number" ? (getValue?.("transform.scaleY") as number) : propScaleY;
  const currentSkewX = typeof getValue?.("transform.skewX") === "number" ? (getValue?.("transform.skewX") as number) : propSkewX;
  const currentSkewY = typeof getValue?.("transform.skewY") === "number" ? (getValue?.("transform.skewY") as number) : propSkewY;
  const currentRotateX = typeof getValue?.("transform.rotateX") === "number" ? (getValue?.("transform.rotateX") as number) : propRotateX;
  const currentRotateY = typeof getValue?.("transform.rotateY") === "number" ? (getValue?.("transform.rotateY") as number) : propRotateY;
  const currentOrigin = (getValue?.("transform.origin") as typeof propOrigin) ?? propOrigin;

  const type = currentType;
  const zIndex = currentZIndex;
  const offsetTop = currentOffsetTop;
  const offsetRight = currentOffsetRight;
  const offsetBottom = currentOffsetBottom;
  const offsetLeft = currentOffsetLeft;
  const scaleX = currentScaleX;
  const scaleY = currentScaleY;
  const skewX = currentSkewX;
  const skewY = currentSkewY;
  const rotateX = currentRotateX;
  const rotateY = currentRotateY;
  const origin = currentOrigin;

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      {/* Group 1: Position Type & Z-index */}
      <OptionGroup>
        <OptionRow label="Position">
          <Select
            size="sm"
            aria-label="Position type"
            value={type}
            options={TYPE_OPTIONS}
            onChange={(v) => {
              const next = v as typeof type;
              onUpdateProp?.("layout.position", next);
              onChangeType?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>

        <OptionRow label="Z-index">
          <NumberField
            size="sm"
            aria-label="Z-index"
            value={zIndex}
            step={1}
            onChange={(z) => {
              onUpdateProp?.("layout.zIndex", z);
              onChangeZIndex?.(z);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>

      {/* Group 2: Offset (Top, Right, Bottom, Left) */}
      <OptionGroup>
        <OptionGridLabel label="Offset">
          <OptionGrid4>
            <NumberField
              size="sm"
              aria-label="Offset top"
              className="ll-pi-host"
              label={<PhosphorMotionIcon name="arrowUp" motion="up" size={12} className="ll:text-muted" />}
              value={offsetTop}
              onChange={(v) => {
                onUpdateProp?.("layout.top", v);
                onChangeOffset?.("top", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Offset right"
              className="ll-pi-host"
              label={<PhosphorMotionIcon name="arrowRight" motion="right" size={12} className="ll:text-muted" />}
              value={offsetRight}
              onChange={(v) => {
                onUpdateProp?.("layout.right", v);
                onChangeOffset?.("right", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Offset bottom"
              className="ll-pi-host"
              label={<PhosphorMotionIcon name="arrowDown" motion="down" size={12} className="ll:text-muted" />}
              value={offsetBottom}
              onChange={(v) => {
                onUpdateProp?.("layout.bottom", v);
                onChangeOffset?.("bottom", v);
              }}
            />
            <NumberField
              size="sm"
              aria-label="Offset left"
              className="ll-pi-host"
              label={<PhosphorMotionIcon name="arrowLeft" motion="left" size={12} className="ll:text-muted" />}
              value={offsetLeft}
              onChange={(v) => {
                onUpdateProp?.("layout.left", v);
                onChangeOffset?.("left", v);
              }}
            />
          </OptionGrid4>
        </OptionGridLabel>
      </OptionGroup>

      {/* Group 3: Scale, Skew, 3D Rotate */}
      <OptionGroup>
        <OptionRow label="Scale">
          <OptionTwo>
            <NumberField
              size="sm"
              label="X"
              value={scaleX}
              step={0.1}
              onChange={(x) => {
                onUpdateProp?.("transform.scaleX", x);
                onChangeScale?.("x", x);
              }}
              aria-label="Scale X"
            />
            <NumberField
              size="sm"
              label="Y"
              value={scaleY}
              step={0.1}
              onChange={(y) => {
                onUpdateProp?.("transform.scaleY", y);
                onChangeScale?.("y", y);
              }}
              aria-label="Scale Y"
            />
          </OptionTwo>
        </OptionRow>

        <OptionRow label="Skew">
          <OptionTwo>
            <NumberField
              size="sm"
              label="X"
              value={skewX}
              unit="°"
              onChange={(x) => {
                onUpdateProp?.("transform.skewX", x);
                onChangeSkew?.("x", x);
              }}
              aria-label="Skew X"
            />
            <NumberField
              size="sm"
              label="Y"
              value={skewY}
              unit="°"
              onChange={(y) => {
                onUpdateProp?.("transform.skewY", y);
                onChangeSkew?.("y", y);
              }}
              aria-label="Skew Y"
            />
          </OptionTwo>
        </OptionRow>

        <OptionRow label="3D rotate">
          <OptionTwo>
            <NumberField
              size="sm"
              label="X"
              value={rotateX}
              unit="°"
              onChange={(x) => {
                onUpdateProp?.("transform.rotateX", x);
                onChangeRotate3D?.("x", x);
              }}
              aria-label="Rotate X"
            />
            <NumberField
              size="sm"
              label="Y"
              value={rotateY}
              unit="°"
              onChange={(y) => {
                onUpdateProp?.("transform.rotateY", y);
                onChangeRotate3D?.("y", y);
              }}
              aria-label="Rotate Y"
            />
          </OptionTwo>
        </OptionRow>
      </OptionGroup>

      {/* Group 4: Transform Origin */}
      <OptionGroup>
        <OptionRow label="Origin">
          <Select
            size="sm"
            aria-label="Transform origin"
            value={origin}
            options={ORIGIN_OPTIONS}
            onChange={(o) => {
              const next = o as typeof origin;
              onUpdateProp?.("transform.origin", next);
              onChangeOrigin?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};
