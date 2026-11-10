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
  const [type, setType] = useState(propType);
  const [zIndex, setZIndex] = useState(propZIndex);
  const [offsetTop, setOffsetTop] = useState(propOffsetTop);
  const [offsetRight, setOffsetRight] = useState(propOffsetRight);
  const [offsetBottom, setOffsetBottom] = useState(propOffsetBottom);
  const [offsetLeft, setOffsetLeft] = useState(propOffsetLeft);
  const [scaleX, setScaleX] = useState(propScaleX);
  const [scaleY, setScaleY] = useState(propScaleY);
  const [skewX, setSkewX] = useState(propSkewX);
  const [skewY, setSkewY] = useState(propSkewY);
  const [rotateX, setRotateX] = useState(propRotateX);
  const [rotateY, setRotateY] = useState(propRotateY);
  const [origin, setOrigin] = useState(propOrigin);

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
              setType(next);
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
              setZIndex(z);
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
                setOffsetTop(v);
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
                setOffsetRight(v);
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
                setOffsetBottom(v);
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
                setOffsetLeft(v);
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
                setScaleX(x);
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
                setScaleY(y);
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
                setSkewX(x);
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
                setSkewY(y);
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
                setRotateX(x);
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
                setRotateY(y);
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
              setOrigin(next);
              onChangeOrigin?.(next);
            }}
            className="ll:w-full"
          />
        </OptionRow>
      </OptionGroup>
    </div>
  );
};
