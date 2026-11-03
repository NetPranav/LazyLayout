"use client";

import React, { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";
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
  const [showMore, setShowMore] = useState(false);

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

  // 4 corners
  const radTL = (getValue?.("appearance.radiusTopLeft") as number) ?? (radiusVal || 0);
  const radTR = (getValue?.("appearance.radiusTopRight") as number) ?? (radiusVal || 0);
  const radBR = (getValue?.("appearance.radiusBottomRight") as number) ?? (radiusVal || 0);
  const radBL = (getValue?.("appearance.radiusBottomLeft") as number) ?? (radiusVal || 0);

  // Blend mode, cursor, pointer events
  const blendMode = (getValue?.("appearance.blendMode") as string) || "normal";
  const cursor = (getValue?.("appearance.cursor") as string) || "auto";
  const pointerEvents = (getValue?.("appearance.pointerEvents") as string) || "auto";

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2.5 ll:w-full ${className}`}>
      {/* 2-column Grid: Opacity & Corner Radius */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
        <NumberField
          size="sm"
          label="O"
          aria-label="Opacity"
          suffix="%"
          min={INSPECTOR_CONSTANTS.MIN_OPACITY}
          max={INSPECTOR_CONSTANTS.MAX_OPACITY}
          value={opacityVal}
          step={INSPECTOR_CONSTANTS.STEP_OPACITY}
          onChange={(v) => {
            // Write percentage or 0..1
            onUpdateProp?.("appearance.opacity", v / 100);
            onUpdateProp?.("opacity", v / 100);
          }}
        />

        <NumberField
          size="sm"
          label="R"
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

      {/* Advanced Toggle Button */}
      <div className="ll:flex ll:items-center ll:justify-between ll:pt-0.5">
        <span className="ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted">
          Corners &amp; Compositing
        </span>
        <IconButton
          size="sm"
          aria-label={showMore ? "Collapse advanced options" : "Expand advanced options"}
          tooltip="More appearance options"
          pressed={showMore}
          onClick={() => setShowMore((prev) => !prev)}
          icon={<Icon icon={MoreHorizontal} size={14} />}
        />
      </div>

      {/* Advanced Expandable Properties */}
      {showMore && (
        <div className="dmore ll:flex ll:flex-col ll:gap-2 ll:pt-1.5 ll:border-t ll:border-border">
          {/* Individual Corner Radii 4-grid */}
          <div className="ll:flex ll:flex-col ll:gap-1">
            <span className="ll:text-nano ll:font-mono ll:uppercase ll:text-muted">
              Corners (TL, TR, BR, BL)
            </span>
            <div className="ll:grid ll:grid-cols-4 ll:gap-1">
              <NumberField
                size="sm"
                label="TL"
                min={0}
                value={radTL}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("appearance.radiusTopLeft", v)}
              />
              <NumberField
                size="sm"
                label="TR"
                min={0}
                value={radTR}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("appearance.radiusTopRight", v)}
              />
              <NumberField
                size="sm"
                label="BR"
                min={0}
                value={radBR}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("appearance.radiusBottomRight", v)}
              />
              <NumberField
                size="sm"
                label="BL"
                min={0}
                value={radBL}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("appearance.radiusBottomLeft", v)}
              />
            </div>
          </div>

          {/* Blend Mode */}
          <Select
            size="sm"
            label="Blend"
            aria-label="Blend mode"
            value={blendMode}
            options={BLEND_MODE_OPTIONS}
            onChange={(val) => onUpdateProp?.("appearance.blendMode", val)}
          />

          {/* Cursor & Pointer Events */}
          <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
            <Select
              size="sm"
              label="Cursor"
              aria-label="Cursor"
              value={cursor}
              options={CURSOR_OPTIONS}
              onChange={(val) => onUpdateProp?.("appearance.cursor", val)}
            />
            <Select
              size="sm"
              label="Events"
              aria-label="Pointer events"
              value={pointerEvents}
              options={POINTER_EVENTS_OPTIONS}
              onChange={(val) => onUpdateProp?.("appearance.pointerEvents", val)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
