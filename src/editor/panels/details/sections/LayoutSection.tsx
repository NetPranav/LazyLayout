"use client";

import React, { useState } from "react";
import {
  Move,
  Rows,
  LayoutGrid,
  ArrowDown,
  ArrowRight,
  Scissors,
  MoreHorizontal,
  WrapText,
} from "lucide-react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";
import { Checkbox } from "@/editor/components/Checkbox";
import {
  AlignmentGrid,
  getAlignmentMatrixIndex,
  type AlignmentMatrixIndex,
} from "../controls/AlignmentGrid";
import {
  INSPECTOR_CONSTANTS,
  SIZING_OPTIONS,
  OVERFLOW_OPTIONS,
  UNIT_OPTIONS,
  BOX_SIZING_OPTIONS,
  ALIGN_SELF_OPTIONS,
} from "../constants";
import type { InspectorSectionProps } from "../types";

export const LayoutSection: React.FC<InspectorSectionProps> = ({
  layer,
  getValue,
  onUpdateProp,
  onUpdateProps,
  className = "",
}) => {
  const [showMore, setShowMore] = useState(false);

  // Layout mode: free (absolute/none), stack (flex), grid
  const rawDisplay = (getValue?.("layout.display") as string) || "flex";
  const rawMode = (getValue?.("layout.mode") as string) || (rawDisplay === "grid" ? "grid" : "stack");
  const layoutMode: "free" | "stack" | "grid" =
    rawMode === "grid" ? "grid" : rawMode === "stack" ? "stack" : "free";

  // Dimensions
  const rawW = getValue?.("frame.width") ?? getValue?.("width");
  const rawH = getValue?.("frame.height") ?? getValue?.("height");
  const widthVal = typeof rawW === "number" ? rawW : rawW === null ? null : INSPECTOR_CONSTANTS.DEFAULT_WIDTH;
  const heightVal = typeof rawH === "number" ? rawH : rawH === null ? null : INSPECTOR_CONSTANTS.DEFAULT_HEIGHT;

  // Sizing constraints & clip
  const sizingH = (getValue?.("sizing.horizontal") as string) || "fixed";
  const sizingV = (getValue?.("sizing.vertical") as string) || "fixed";
  const isClipped = (getValue?.("layout.overflowX") as string) === "hidden";

  // Flex Direction & Distribution
  const flexDir = (getValue?.("layout.flexDirection") as string) || "column";
  const isVertical = flexDir.startsWith("column");
  const flexWrap = (getValue?.("layout.flexWrap") as string) || "nowrap";
  const isWrapped = flexWrap === "wrap";
  const justifyContent = (getValue?.("layout.justifyContent") as string) || "flex-start";
  const alignItems = (getValue?.("layout.alignItems") as string) || "center";
  const isSpaceBetween = justifyContent === "space-between";

  // Matrix index
  const matrixIndex = getAlignmentMatrixIndex(justifyContent, alignItems);

  // Spacing values
  const gap = (getValue?.("layout.gap") as number) ?? 0;
  const paddingX = (getValue?.("layout.paddingX") as number) ?? 0;
  const paddingY = (getValue?.("layout.paddingY") as number) ?? 0;

  // Grid rows & cols
  const gridCols = (getValue?.("layout.gridColumns") as number) ?? 2;
  const gridRows = (getValue?.("layout.gridRows") as number) ?? 2;
  const colGap = (getValue?.("layout.columnGap") as number) ?? 16;
  const rowGap = (getValue?.("layout.rowGap") as number) ?? 16;

  // Advanced layout props
  const minW = (getValue?.("layout.minWidth") as number) ?? 0;
  const maxW = (getValue?.("layout.maxWidth") as number) ?? 0;
  const minH = (getValue?.("layout.minHeight") as number) ?? 0;
  const maxH = (getValue?.("layout.maxHeight") as number) ?? 0;
  const padTop = (getValue?.("layout.paddingTop") as number) ?? 0;
  const padRight = (getValue?.("layout.paddingRight") as number) ?? 0;
  const padBottom = (getValue?.("layout.paddingBottom") as number) ?? 0;
  const padLeft = (getValue?.("layout.paddingLeft") as number) ?? 0;
  const marginTop = (getValue?.("layout.marginTop") as number) ?? 0;
  const marginRight = (getValue?.("layout.marginRight") as number) ?? 0;
  const marginBottom = (getValue?.("layout.marginBottom") as number) ?? 0;
  const marginLeft = (getValue?.("layout.marginLeft") as number) ?? 0;
  const overflowX = (getValue?.("layout.overflowX") as string) || "visible";
  const overflowY = (getValue?.("layout.overflowY") as string) || "visible";
  const unit = (getValue?.("layout.unit") as string) || "px";
  const boxSizing = (getValue?.("layout.boxSizing") as string) || "border-box";
  const alignSelf = (getValue?.("layout.alignSelf") as string) || "auto";
  const flexGrow = (getValue?.("layout.flexGrow") as number) ?? 0;
  const flexShrink = (getValue?.("layout.flexShrink") as number) ?? 1;

  const handleLayoutModeChange = (mode: "free" | "stack" | "grid") => {
    if (mode === "grid") {
      onUpdateProps?.({
        "layout.mode": "grid",
        "layout.display": "grid",
      });
    } else if (mode === "stack") {
      onUpdateProps?.({
        "layout.mode": "stack",
        "layout.display": "flex",
      });
    } else {
      onUpdateProps?.({
        "layout.mode": "free",
        "layout.display": "block",
      });
    }
  };

  const handleMatrixChange = (
    _idx: AlignmentMatrixIndex,
    justify: "flex-start" | "center" | "flex-end",
    align: "flex-start" | "center" | "flex-end"
  ) => {
    onUpdateProps?.({
      "layout.justifyContent": justify,
      "layout.alignItems": align,
    });
  };

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2.5 ll:w-full ${className}`}>
      {/* Layout Mode Segmented Control: Free / Stack / Grid */}
      <SegmentedControl
        size="sm"
        ariaLabel="Layout mode"
        value={layoutMode}
        onChange={handleLayoutModeChange}
        options={[
          {
            value: "free",
            label: "Free",
            icon: <Icon icon={Move} size={14} />,
            ariaLabel: "Free layout",
          },
          {
            value: "stack",
            label: "Stack",
            icon: <Icon icon={Rows} size={14} />,
            ariaLabel: "Stack layout",
          },
          {
            value: "grid",
            label: "Grid",
            icon: <Icon icon={LayoutGrid} size={14} />,
            ariaLabel: "Grid layout",
          },
        ]}
      />

      {/* Width and Height 2-grid */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
        <NumberField
          size="sm"
          label="W"
          value={widthVal}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => {
            onUpdateProp?.("frame.width", v);
            onUpdateProp?.("width", v);
          }}
        />
        <NumberField
          size="sm"
          label="H"
          value={heightVal}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => {
            onUpdateProp?.("frame.height", v);
            onUpdateProp?.("height", v);
          }}
        />
      </div>

      {/* Sizing & Clip Row: Width sizing, Height sizing, Clip toggle */}
      <div className="ll:flex ll:items-center ll:gap-1.5 ll:w-full">
        <div className="ll:flex-1 ll:min-w-0">
          <Select
            size="sm"
            label="W"
            aria-label="Width sizing"
            value={sizingH}
            options={SIZING_OPTIONS}
            onChange={(val) => onUpdateProp?.("sizing.horizontal", val)}
          />
        </div>
        <div className="ll:flex-1 ll:min-w-0">
          <Select
            size="sm"
            label="H"
            aria-label="Height sizing"
            value={sizingV}
            options={SIZING_OPTIONS}
            onChange={(val) => onUpdateProp?.("sizing.vertical", val)}
          />
        </div>
        <IconButton
          size="sm"
          aria-label={isClipped ? "Unclip content" : "Clip content"}
          tooltip="Clip content"
          pressed={isClipped}
          onClick={() => {
            const next = isClipped ? "visible" : "hidden";
            onUpdateProps?.({
              "layout.overflowX": next,
              "layout.overflowY": next,
            });
          }}
          icon={<Icon icon={Scissors} size={14} />}
        />
      </div>

      {/* Stack layout details */}
      {layoutMode === "stack" && (
        <div className="ll:flex ll:flex-col ll:gap-2.5 ll:pt-1">
          {/* Direction & Wrap Row */}
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <div className="ll:flex-1 ll:min-w-0">
              <SegmentedControl
                size="sm"
                ariaLabel="Stack direction"
                value={isVertical ? "vertical" : "horizontal"}
                onChange={(val) =>
                  onUpdateProp?.("layout.flexDirection", val === "vertical" ? "column" : "row")
                }
                options={[
                  {
                    value: "vertical",
                    label: "Vertical",
                    icon: <Icon icon={ArrowDown} size={14} />,
                    ariaLabel: "Vertical stack",
                  },
                  {
                    value: "horizontal",
                    label: "Horizontal",
                    icon: <Icon icon={ArrowRight} size={14} />,
                    ariaLabel: "Horizontal stack",
                  },
                ]}
              />
            </div>
            <IconButton
              size="sm"
              aria-label={isWrapped ? "Disable wrap" : "Wrap children"}
              tooltip="Wrap content"
              pressed={isWrapped}
              onClick={() =>
                onUpdateProp?.("layout.flexWrap", isWrapped ? "nowrap" : "wrap")
              }
              icon={<Icon icon={WrapText} size={14} />}
            />
          </div>

          {/* 3x3 Matrix & Spacing column */}
          <div className="dlay ll:grid ll:grid-cols-[100px_minmax(0,1fr)] ll:gap-2 ll:items-start">
            <AlignmentGrid
              selectedIndex={matrixIndex}
              onChange={handleMatrixChange}
            />
            <div className="dcol ll:flex ll:flex-col ll:gap-1.5 ll:min-w-0">
              <NumberField
                size="sm"
                label="Gap"
                value={gap}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.gap", v)}
              />
              <NumberField
                size="sm"
                label="Pad X"
                value={paddingX}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.paddingX", v)}
              />
              <NumberField
                size="sm"
                label="Pad Y"
                value={paddingY}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.paddingY", v)}
              />
            </div>
          </div>

          {/* Distribution Row: Packed vs Space Between */}
          <SegmentedControl
            size="sm"
            ariaLabel="Item distribution"
            value={isSpaceBetween ? "space-between" : "packed"}
            onChange={(val) =>
              onUpdateProp?.("layout.justifyContent", val === "space-between" ? "space-between" : "flex-start")
            }
            options={[
              { value: "packed", label: "Packed" },
              { value: "space-between", label: "Space between" },
            ]}
          />
        </div>
      )}

      {/* Grid layout details */}
      {layoutMode === "grid" && (
        <div className="ll:flex ll:flex-col ll:gap-2.5 ll:pt-1">
          {/* Columns & Rows */}
          <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
            <NumberField
              size="sm"
              label="Cols"
              value={gridCols}
              min={1}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.gridColumns", v)}
            />
            <NumberField
              size="sm"
              label="Rows"
              value={gridRows}
              min={1}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.gridRows", v)}
            />
          </div>

          {/* 3x3 Matrix & Grid gaps */}
          <div className="dlay ll:grid ll:grid-cols-[100px_minmax(0,1fr)] ll:gap-2 ll:items-start">
            <AlignmentGrid
              selectedIndex={matrixIndex}
              onChange={handleMatrixChange}
            />
            <div className="dcol ll:flex ll:flex-col ll:gap-1.5 ll:min-w-0">
              <NumberField
                size="sm"
                label="Col Gap"
                value={colGap}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.columnGap", v)}
              />
              <NumberField
                size="sm"
                label="Row Gap"
                value={rowGap}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.rowGap", v)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Advanced Toggle Button */}
      <div className="ll:flex ll:items-center ll:justify-between ll:pt-0.5">
        <span className="ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted">
          Constraints &amp; Spacing
        </span>
        <IconButton
          size="sm"
          aria-label={showMore ? "Collapse advanced options" : "Expand advanced options"}
          tooltip="More layout options"
          pressed={showMore}
          onClick={() => setShowMore((prev) => !prev)}
          icon={<Icon icon={MoreHorizontal} size={14} />}
        />
      </div>

      {/* Advanced Expandable Properties */}
      {showMore && (
        <div className="dmore ll:flex ll:flex-col ll:gap-2 ll:pt-1.5 ll:border-t ll:border-border">
          {/* Min & Max Width */}
          <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
            <NumberField
              size="sm"
              label="Min W"
              value={minW}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.minWidth", v)}
            />
            <NumberField
              size="sm"
              label="Max W"
              value={maxW}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.maxWidth", v)}
            />
          </div>

          {/* Min & Max Height */}
          <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
            <NumberField
              size="sm"
              label="Min H"
              value={minH}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.minHeight", v)}
            />
            <NumberField
              size="sm"
              label="Max H"
              value={maxH}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.maxHeight", v)}
            />
          </div>

          {/* Padding 4-grid */}
          <div className="ll:flex ll:flex-col ll:gap-1">
            <span className="ll:text-nano ll:font-mono ll:uppercase ll:text-muted">
              Padding (T, R, B, L)
            </span>
            <div className="ll:grid ll:grid-cols-4 ll:gap-1">
              <NumberField
                size="sm"
                label="T"
                value={padTop}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.paddingTop", v)}
              />
              <NumberField
                size="sm"
                label="R"
                value={padRight}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.paddingRight", v)}
              />
              <NumberField
                size="sm"
                label="B"
                value={padBottom}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.paddingBottom", v)}
              />
              <NumberField
                size="sm"
                label="L"
                value={padLeft}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.paddingLeft", v)}
              />
            </div>
          </div>

          {/* Margin 4-grid */}
          <div className="ll:flex ll:flex-col ll:gap-1">
            <span className="ll:text-nano ll:font-mono ll:uppercase ll:text-muted">
              Margin (T, R, B, L)
            </span>
            <div className="ll:grid ll:grid-cols-4 ll:gap-1">
              <NumberField
                size="sm"
                label="T"
                value={marginTop}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.marginTop", v)}
              />
              <NumberField
                size="sm"
                label="R"
                value={marginRight}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.marginRight", v)}
              />
              <NumberField
                size="sm"
                label="B"
                value={marginBottom}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.marginBottom", v)}
              />
              <NumberField
                size="sm"
                label="L"
                value={marginLeft}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.marginLeft", v)}
              />
            </div>
          </div>

          {/* Overflow & Box Sizing */}
          <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
            <Select
              size="sm"
              label="Over X"
              aria-label="Overflow X"
              value={overflowX}
              options={OVERFLOW_OPTIONS}
              onChange={(val) => onUpdateProp?.("layout.overflowX", val)}
            />
            <Select
              size="sm"
              label="Over Y"
              aria-label="Overflow Y"
              value={overflowY}
              options={OVERFLOW_OPTIONS}
              onChange={(val) => onUpdateProp?.("layout.overflowY", val)}
            />
          </div>

          <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
            <Select
              size="sm"
              label="Unit"
              aria-label="Unit"
              value={unit}
              options={UNIT_OPTIONS}
              onChange={(val) => onUpdateProp?.("layout.unit", val)}
            />
            <Select
              size="sm"
              label="Box"
              aria-label="Box sizing"
              value={boxSizing}
              options={BOX_SIZING_OPTIONS}
              onChange={(val) => onUpdateProp?.("layout.boxSizing", val)}
            />
          </div>

          {/* Align Self & Flex factors */}
          <Select
            size="sm"
            label="Self"
            aria-label="Align self"
            value={alignSelf}
            options={ALIGN_SELF_OPTIONS}
            onChange={(val) => onUpdateProp?.("layout.alignSelf", val)}
          />

          <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
            <NumberField
              size="sm"
              label="Grow"
              value={flexGrow}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.flexGrow", v)}
            />
            <NumberField
              size="sm"
              label="Shrink"
              value={flexShrink}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.flexShrink", v)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
