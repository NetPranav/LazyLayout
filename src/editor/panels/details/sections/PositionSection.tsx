"use client";

import React from "react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { AlignBar } from "../controls/AlignBar";
import {
  INSPECTOR_CONSTANTS,
  POSITION_TYPE_OPTIONS,
  TRANSFORM_ORIGIN_OPTIONS,
} from "../constants";
import type { InspectorSectionProps } from "../types";
import type { AlignMode, SpreadAxis } from "@/core/geometry/align";

export interface PositionSectionProps extends InspectorSectionProps {
  onAlign?: (mode: AlignMode) => void;
  onDistribute?: (axis: SpreadAxis) => void;
  onTidy?: () => void;
}

export const PositionSection: React.FC<PositionSectionProps> = ({
  isMulti = false,
  getValue,
  onUpdateProp,
  onAlign,
  onDistribute,
  onTidy,
  className = "",
}) => {
  // Read coordinates
  const rawX = getValue?.("frame.x") ?? getValue?.("x");
  const rawY = getValue?.("frame.y") ?? getValue?.("y");
  const rawRot = getValue?.("frame.rotation") ?? getValue?.("rotation");

  const xVal = typeof rawX === "number" ? rawX : rawX === null ? null : INSPECTOR_CONSTANTS.DEFAULT_POS_X;
  const yVal = typeof rawY === "number" ? rawY : rawY === null ? null : INSPECTOR_CONSTANTS.DEFAULT_POS_Y;
  const rotVal = typeof rawRot === "number" ? rawRot : rawRot === null ? null : INSPECTOR_CONSTANTS.DEFAULT_ROTATION;

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* Alignment Bar */}
      <AlignBar
        isMulti={isMulti}
        onAlign={onAlign}
        onDistribute={onDistribute}
        onTidy={onTidy}
      />

      {/* Main Coordinate Grid: X, Y, Rotation */}
      <div className="ll:grid ll:grid-cols-3 ll:gap-2 ll:w-full">
        <NumberField
          size="sm"
          label="X"
          value={xVal}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => {
            onUpdateProp?.("frame.x", v);
            onUpdateProp?.("x", v);
          }}
        />

        <NumberField
          size="sm"
          label="Y"
          value={yVal}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => {
            onUpdateProp?.("frame.y", v);
            onUpdateProp?.("y", v);
          }}
        />

        <NumberField
          size="sm"
          label="R"
          value={rotVal}
          suffix="°"
          step={INSPECTOR_CONSTANTS.STEP_ROTATION}
          onChange={(v) => {
            onUpdateProp?.("frame.rotation", v);
            onUpdateProp?.("rotation", v);
          }}
        />
      </div>
    </div>
  );
};

export const PositionMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  // Read advanced transform properties
  const posType = (getValue?.("layout.position") as string) || "static";
  const zIndex = (getValue?.("layout.zIndex") as number) ?? 0;
  const scaleX = (getValue?.("transform.scaleX") as number) ?? 1;
  const scaleY = (getValue?.("transform.scaleY") as number) ?? 1;
  const skewX = (getValue?.("transform.skewX") as number) ?? 0;
  const skewY = (getValue?.("transform.skewY") as number) ?? 0;
  const rotX = (getValue?.("transform.rotateX") as number) ?? 0;
  const rotY = (getValue?.("transform.rotateY") as number) ?? 0;
  const origin = (getValue?.("transform.origin") as string) || "center";

  // Offset values when position is relative/absolute/fixed/sticky
  const offTop = (getValue?.("layout.top") as number) ?? 0;
  const offRight = (getValue?.("layout.right") as number) ?? 0;
  const offBottom = (getValue?.("layout.bottom") as number) ?? 0;
  const offLeft = (getValue?.("layout.left") as number) ?? 0;

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      {/* Position Type & Z-Index */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <Select
          size="sm"
          label="Position"
          aria-label="Position type"
          value={posType}
          options={POSITION_TYPE_OPTIONS}
          onChange={(val) => onUpdateProp?.("layout.position", val)}
        />
        <NumberField
          size="sm"
          label="Z"
          value={zIndex}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(val) => onUpdateProp?.("layout.zIndex", val)}
        />
      </div>

      {/* Offset 4-grid (shown when position type !== 'static') */}
      {posType !== "static" && (
        <div className="ll:flex ll:flex-col ll:gap-1">
          <span className="ll:text-nano ll:font-mono ll:uppercase ll:text-muted">
            Offset
          </span>
          <div className="ll:grid ll:grid-cols-4 ll:gap-1.5">
            <NumberField
              size="sm"
              label="T"
              aria-label="Offset Top"
              value={offTop}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(val) => onUpdateProp?.("layout.top", val)}
            />
            <NumberField
              size="sm"
              label="R"
              aria-label="Offset Right"
              value={offRight}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(val) => onUpdateProp?.("layout.right", val)}
            />
            <NumberField
              size="sm"
              label="B"
              aria-label="Offset Bottom"
              value={offBottom}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(val) => onUpdateProp?.("layout.bottom", val)}
            />
            <NumberField
              size="sm"
              label="L"
              aria-label="Offset Left"
              value={offLeft}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(val) => onUpdateProp?.("layout.left", val)}
            />
          </div>
        </div>
      )}

      {/* Scale X & Y */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          label="Scale X"
          value={scaleX}
          step={INSPECTOR_CONSTANTS.STEP_FINE}
          precision={2}
          onChange={(val) => onUpdateProp?.("transform.scaleX", val)}
        />
        <NumberField
          size="sm"
          label="Scale Y"
          value={scaleY}
          step={INSPECTOR_CONSTANTS.STEP_FINE}
          precision={2}
          onChange={(val) => onUpdateProp?.("transform.scaleY", val)}
        />
      </div>

      {/* Skew X & Y */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          label="Skew X"
          suffix="°"
          value={skewX}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(val) => onUpdateProp?.("transform.skewX", val)}
        />
        <NumberField
          size="sm"
          label="Skew Y"
          suffix="°"
          value={skewY}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(val) => onUpdateProp?.("transform.skewY", val)}
        />
      </div>

      {/* 3D Rotate X & Y */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          label="Rot X"
          suffix="°"
          value={rotX}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(val) => onUpdateProp?.("transform.rotateX", val)}
        />
        <NumberField
          size="sm"
          label="Rot Y"
          suffix="°"
          value={rotY}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(val) => onUpdateProp?.("transform.rotateY", val)}
        />
      </div>

      {/* Transform Origin */}
      <Select
        size="sm"
        label="Origin"
        aria-label="Transform origin"
        value={origin}
        options={TRANSFORM_ORIGIN_OPTIONS}
        onChange={(val) => onUpdateProp?.("transform.origin", val)}
      />
    </div>
  );
};
