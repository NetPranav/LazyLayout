"use client";

import React from "react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import type { InspectorSectionProps } from "../types";

export const SHAPE_TYPE_OPTIONS = [
  { value: "Polygon", label: "Polygon" },
  { value: "Star", label: "Star" },
  { value: "Arrow", label: "Arrow" },
  { value: "Line", label: "Line" },
] as const;

export const ARROW_CAP_OPTIONS = [
  { value: "Butt", label: "Butt" },
  { value: "Round", label: "Round" },
  { value: "Arrow", label: "Arrow" },
] as const;

export const ShapeSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const shapeType = (getValue?.("shape.type") as string) || "Star";
  const sides = (getValue?.("shape.sides") as number) ?? 5;
  const points = (getValue?.("shape.points") as number) ?? 5;
  const innerRadius = (getValue?.("shape.innerRadius") as number) ?? 50;

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      <Select
        size="sm"
        aria-label="Shape type"
        value={shapeType}
        options={SHAPE_TYPE_OPTIONS}
        onChange={(v) => onUpdateProp?.("shape.type", v)}
      />

      <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
        <NumberField
          size="sm"
          label="Sides"
          aria-label="Sides"
          value={sides}
          step={1}
          onChange={(v) => onUpdateProp?.("shape.sides", v)}
        />
        <NumberField
          size="sm"
          label="Points"
          aria-label="Points"
          value={points}
          step={1}
          onChange={(v) => onUpdateProp?.("shape.points", v)}
        />
      </div>

      <div className="ll:w-full">
        <NumberField
          size="sm"
          label="Inner"
          aria-label="Inner radius"
          suffix="%"
          value={innerRadius}
          step={1}
          onChange={(v) => onUpdateProp?.("shape.innerRadius", v)}
        />
      </div>
    </div>
  );
};

export const ShapeMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  const vertexRadius = (getValue?.("shape.vertexRadius") as number) ?? 0;
  const startCap = (getValue?.("shape.startCap") as string) || "Butt";
  const endCap = (getValue?.("shape.endCap") as string) || "Butt";
  const headLength = (getValue?.("shape.headLength") as number) ?? 12;
  const headWidth = (getValue?.("shape.headWidth") as number) ?? 12;
  const shaftWidth = (getValue?.("shape.shaftWidth") as number) ?? 4;

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      <NumberField
        size="sm"
        label="Vertex"
        aria-label="Vertex radius"
        value={vertexRadius}
        step={1}
        onChange={(v) => onUpdateProp?.("shape.vertexRadius", v)}
      />

      <div className="ll:pt-2 ll:border-t ll:border-border ll:grid ll:grid-cols-2 ll:gap-2">
        <Select
          size="sm"
          label="Start"
          aria-label="Start cap"
          value={startCap}
          options={ARROW_CAP_OPTIONS}
          onChange={(v) => onUpdateProp?.("shape.startCap", v)}
        />
        <Select
          size="sm"
          label="End"
          aria-label="End cap"
          value={endCap}
          options={ARROW_CAP_OPTIONS}
          onChange={(v) => onUpdateProp?.("shape.endCap", v)}
        />
      </div>

      <div className="ll:pt-2 ll:border-t ll:border-border ll:flex ll:flex-col ll:gap-2">
        <div className="ll:grid ll:grid-cols-2 ll:gap-2">
          <NumberField
            size="sm"
            label="Head L"
            aria-label="Head length"
            value={headLength}
            step={1}
            onChange={(v) => onUpdateProp?.("shape.headLength", v)}
          />
          <NumberField
            size="sm"
            label="Head W"
            aria-label="Head width"
            value={headWidth}
            step={1}
            onChange={(v) => onUpdateProp?.("shape.headWidth", v)}
          />
        </div>
        <NumberField
          size="sm"
          label="Shaft"
          aria-label="Shaft width"
          value={shaftWidth}
          step={1}
          onChange={(v) => onUpdateProp?.("shape.shaftWidth", v)}
        />
      </div>
    </div>
  );
};
