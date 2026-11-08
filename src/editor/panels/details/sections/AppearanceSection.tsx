"use client";

import React from "react";
import { Droplet, SquareRoundCorner } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import {
  INSPECTOR_CONSTANTS,
  BLEND_MODE_OPTIONS,
  CURSOR_OPTIONS,
  POINTER_EVENTS_OPTIONS,
} from "../constants";
import type { InspectorSectionProps } from "../types";

export const AppearanceSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  // Opacity: stored either 0..1 or 0..100
  const rawOp = getValue?.("appearance.opacity") ?? getValue?.("opacity");
  const opacityVal =
    typeof rawOp === "number"
      ? rawOp <= 1 && rawOp > 0
        ? Math.round(rawOp * 100)
        : rawOp
      : rawOp === null
      ? null
      : INSPECTOR_CONSTANTS.DEFAULT_OPACITY;

  // Corner radius
  const rawRad = getValue?.("appearance.radius") ?? getValue?.("borderRadius");
  const radiusVal = typeof rawRad === "number" ? rawRad : rawRad === null ? null : INSPECTOR_CONSTANTS.DEFAULT_CORNER_RADIUS;

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* 2-column Grid: Opacity & Corner Radius */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label={<Icon icon={Droplet} size={14} />}
          aria-label="Opacity"
          suffix="%"
          min={INSPECTOR_CONSTANTS.MIN_OPACITY}
          max={INSPECTOR_CONSTANTS.MAX_OPACITY}
          value={opacityVal}
          step={INSPECTOR_CONSTANTS.STEP_OPACITY}
          onChange={(v) => {
            onUpdateProp?.("appearance.opacity", v / 100);
            onUpdateProp?.("opacity", v / 100);
          }}
        />

        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label={<Icon icon={SquareRoundCorner} size={14} />}
          aria-label="Corner radius"
          min={INSPECTOR_CONSTANTS.MIN_RADIUS}
          max={INSPECTOR_CONSTANTS.MAX_RADIUS}
          value={radiusVal}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => {
            onUpdateProp?.("appearance.radius", v);
            onUpdateProp?.("borderRadius", v);
          }}
        />
      </div>
    </div>
  );
};

export const AppearanceMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  // Corner radius
  const rawRad = getValue?.("appearance.radius") ?? getValue?.("borderRadius");
  const radiusVal = typeof rawRad === "number" ? rawRad : 0;

  // 4 corners
  const radTL = (getValue?.("appearance.radiusTopLeft") as number) ?? radiusVal;
  const radTR = (getValue?.("appearance.radiusTopRight") as number) ?? radiusVal;
  const radBR = (getValue?.("appearance.radiusBottomRight") as number) ?? radiusVal;
  const radBL = (getValue?.("appearance.radiusBottomLeft") as number) ?? radiusVal;

  // Blend mode, cursor, pointer events
  const blendMode = (getValue?.("appearance.blendMode") as string) || "normal";
  const cursor = (getValue?.("appearance.cursor") as string) || "auto";
  const pointerEvents = (getValue?.("appearance.pointerEvents") as string) || "auto";

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      {/* Group 1: 4 Corners Grid */}
      <div className="ll-dmg">
        <div className="ll-dgl">
          <span className="ll-dlbl">Corners</span>
          <div className="ll:grid ll:grid-cols-4 ll:gap-1.5">
            <NumberField
              size="sm"
              label="TL"
              aria-label="Top left radius"
              value={radTL}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("appearance.radiusTopLeft", v)}
            />
            <NumberField
              size="sm"
              label="TR"
              aria-label="Top right radius"
              value={radTR}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("appearance.radiusTopRight", v)}
            />
            <NumberField
              size="sm"
              label="BR"
              aria-label="Bottom right radius"
              value={radBR}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("appearance.radiusBottomRight", v)}
            />
            <NumberField
              size="sm"
              label="BL"
              aria-label="Bottom left radius"
              value={radBL}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("appearance.radiusBottomLeft", v)}
            />
          </div>
        </div>
      </div>

      {/* Group 2: Blend Mode, Cursor & Pointer Events */}
      <div className="ll-dmg">
        <div className="ll-dtrow">
          <span className="ll-dlbl">Blend</span>
          <div className="ll-dtc">
            <Select
              size="sm"
              aria-label="Blend mode"
              value={blendMode}
              mixed={getValue?.("appearance.blendMode") === null}
              options={BLEND_MODE_OPTIONS}
              onChange={(v) => onUpdateProp?.("appearance.blendMode", v)}
            />
          </div>
        </div>

        <div className="ll-dtrow">
          <span className="ll-dlbl">Cursor</span>
          <div className="ll-dtc">
            <Select
              size="sm"
              aria-label="Cursor"
              value={cursor}
              mixed={getValue?.("appearance.cursor") === null}
              options={CURSOR_OPTIONS}
              onChange={(v) => onUpdateProp?.("appearance.cursor", v)}
            />
          </div>
        </div>

        <div className="ll-dtrow">
          <span className="ll-dlbl">Events</span>
          <div className="ll-dtc">
            <Select
              size="sm"
              aria-label="Pointer events"
              value={pointerEvents}
              mixed={getValue?.("appearance.pointerEvents") === null}
              options={POINTER_EVENTS_OPTIONS}
              onChange={(v) => onUpdateProp?.("appearance.pointerEvents", v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
