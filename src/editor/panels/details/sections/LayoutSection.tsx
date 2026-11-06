"use client";

import React from "react";
import {
  Move,
  Rows,
  LayoutGrid,
  ArrowDown,
  ArrowRight,
  Crop,
  WrapText,
  ArrowUpDown,
  MoveHorizontal,
  MoveVertical,
} from "lucide-react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { Icon } from "@/editor/components/Icon";
import { Checkbox } from "@/editor/components/Checkbox";
import {
  AlignmentGrid,
  getAlignmentMatrixIndex,
  type AlignmentMatrixIndex,
} from "../controls/AlignmentGrid";
import {
  INSPECTOR_CONSTANTS,
  OVERFLOW_OPTIONS,
  UNIT_OPTIONS,
  BOX_SIZING_OPTIONS,
  ALIGN_SELF_OPTIONS,
} from "../constants";
import type { InspectorSectionProps } from "../types";

export interface LayoutSectionProps extends InspectorSectionProps {
  isFrame?: boolean;
}

const WIDTH_SIZING_OPTIONS = [
  { value: "fixed", label: "W Fixed" },
  { value: "hug", label: "W Hug" },
  { value: "fill", label: "W Fill" },
] as const;

const HEIGHT_SIZING_OPTIONS = [
  { value: "fixed", label: "H Fixed" },
  { value: "hug", label: "H Hug" },
  { value: "fill", label: "H Fill" },
] as const;

export const LayoutSection: React.FC<LayoutSectionProps> = ({
  layer,
  isFrame: propIsFrame,
  getValue,
  onUpdateProp,
  onUpdateProps,
  className = "",
}) => {
  const isFrame =
    propIsFrame !== undefined
      ? propIsFrame
      : layer?.archetype === "container" || (layer?.archetype as string) === "frame";

  // Dimensions
  const rawW = getValue?.("frame.width") ?? getValue?.("width");
  const rawH = getValue?.("frame.height") ?? getValue?.("height");
  const widthVal = typeof rawW === "number" ? rawW : rawW === null ? null : INSPECTOR_CONSTANTS.DEFAULT_WIDTH;
  const heightVal = typeof rawH === "number" ? rawH : rawH === null ? null : INSPECTOR_CONSTANTS.DEFAULT_HEIGHT;

  // Sizing constraints & clip
  const sizingH = (getValue?.("sizing.horizontal") as string) || "fixed";
  const sizingV = (getValue?.("sizing.vertical") as string) || "fixed";
  const isClipped = (getValue?.("layout.overflowX") as string) === "hidden";

  // Frame layout mode: free, stack, grid
  const rawDisplay = (getValue?.("layout.display") as string) || "flex";
  const rawMode = (getValue?.("layout.mode") as string) || (rawDisplay === "grid" ? "grid" : "stack");
  const layoutMode: "free" | "stack" | "grid" =
    rawMode === "grid" ? "grid" : rawMode === "stack" ? "stack" : "free";

  // Flex Direction & Distribution (frame only)
  const flexDir = (getValue?.("layout.flexDirection") as string) || "column";
  const isVertical = flexDir.startsWith("column");
  const flexWrap = (getValue?.("layout.flexWrap") as string) || "nowrap";
  const isWrapped = flexWrap === "wrap";
  const justifyContent = (getValue?.("layout.justifyContent") as string) || "flex-start";
  const alignItems = (getValue?.("layout.alignItems") as string) || "center";
  const isSpaceBetween = justifyContent === "space-between";

  const matrixIndex = getAlignmentMatrixIndex(justifyContent, alignItems);

  // Spacing values (frame only)
  const gap = (getValue?.("layout.gap") as number) ?? 24;
  const paddingX = (getValue?.("layout.paddingX") as number) ?? 0;
  const paddingY = (getValue?.("layout.paddingY") as number) ?? 0;

  // Grid rows & cols (frame only)
  const gridCols = (getValue?.("layout.gridColumns") as number) ?? 2;
  const gridRows = (getValue?.("layout.gridRows") as number) ?? 2;
  const colGap = (getValue?.("layout.columnGap") as number) ?? 16;
  const rowGap = (getValue?.("layout.rowGap") as number) ?? 16;

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
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* If frame: Free / Stack / Grid mode segmented switch */}
      {isFrame && (
        <SegmentedControl
          size="sm"
          className="ll:w-full ll:*:flex-1"
          ariaLabel="Layout mode"
          value={layoutMode}
          onChange={handleLayoutModeChange}
          options={[
            {
              value: "free",
              icon: <Icon icon={Move} size={14} />,
              ariaLabel: "Free layout",
            },
            {
              value: "stack",
              icon: <Icon icon={Rows} size={14} />,
              ariaLabel: "Stack layout",
            },
            {
              value: "grid",
              icon: <Icon icon={LayoutGrid} size={14} />,
              ariaLabel: "Grid layout",
            },
          ]}
        />
      )}

      {/* Width and Height 2-grid */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
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
          className="ll:*:!text-micro ll:!gap-2"
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
      <div className="ll:grid ll:grid-cols-layout-dual ll:gap-2 ll:w-full ll:items-center">
        <Select
          size="sm"
          aria-label="Width sizing"
          title="Fixed keeps the number you type, Hug shrinks to fit the content, Fill stretches to the parent (inside an auto-layout frame)."
          value={sizingH}
          options={WIDTH_SIZING_OPTIONS}
          onChange={(val) => onUpdateProp?.("sizing.horizontal", val)}
        />
        <Select
          size="sm"
          aria-label="Height sizing"
          title="Fixed keeps the number you type, Hug shrinks to fit the content, Fill stretches to the parent (inside an auto-layout frame)."
          value={sizingV}
          options={HEIGHT_SIZING_OPTIONS}
          onChange={(val) => onUpdateProp?.("sizing.vertical", val)}
        />
        <button
          type="button"
          aria-pressed={isClipped}
          aria-label="Clip content"
          title="Clip content: anything that sticks out of this layer's box is cut off (the same as Overflow: Hidden under More)."
          onClick={() =>
            onUpdateProp?.("layout.overflowX", isClipped ? "visible" : "hidden")
          }
          className={`ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:border ll:border-border ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ${
            isClipped
              ? "ll:bg-control-secondary-bg ll:text-primary ll:border-border-active"
              : "ll:bg-surface-bar ll:text-muted ll:hover:text-primary"
          }`}
        >
          <Icon icon={Crop} size={14} />
        </button>
      </div>

      {/* Frame Stack Controls */}
      {isFrame && layoutMode === "stack" && (
        <div className="ll:flex ll:flex-col ll:gap-2 ll:pt-1">
          <div className="ll:flex ll:items-center ll:gap-2">
            <div className="ll:flex-1">
              <SegmentedControl
                size="sm"
                className="ll:w-full ll:*:flex-1"
                ariaLabel="Stack direction"
                value={isVertical ? "vertical" : "horizontal"}
                onChange={(v) =>
                  onUpdateProp?.(
                    "layout.flexDirection",
                    v === "vertical" ? "column" : "row"
                  )
                }
                options={[
                  {
                    value: "vertical",
                    icon: <Icon icon={ArrowDown} size={14} />,
                    ariaLabel: "Vertical direction",
                  },
                  {
                    value: "horizontal",
                    icon: <Icon icon={ArrowRight} size={14} />,
                    ariaLabel: "Horizontal direction",
                  },
                ]}
              />
            </div>
            <button
              type="button"
              aria-pressed={isWrapped}
              aria-label="Wrap"
              title="Wrap"
              onClick={() =>
                onUpdateProp?.("layout.flexWrap", isWrapped ? "nowrap" : "wrap")
              }
              className={`ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:border ll:border-border ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ${
                isWrapped
                  ? "ll:bg-control-secondary-bg ll:text-primary ll:border-border-active"
                  : "ll:bg-surface-bar ll:text-muted ll:hover:text-primary"
              }`}
            >
              <Icon icon={WrapText} size={14} />
            </button>
          </div>

          <div className="ll:grid ll:grid-cols-layout-labeled ll:gap-2 ll:items-start">
            <AlignmentGrid
              selectedIndex={matrixIndex}
              onChange={handleMatrixChange}
            />
            <div className="ll:flex ll:flex-col ll:gap-2">
              <NumberField
                size="sm"
                className="ll:*:!text-micro ll:!gap-2"
                label={<Icon icon={ArrowUpDown} size={14} />}
                aria-label="Gap"
                value={gap}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.gap", v)}
              />
              <NumberField
                size="sm"
                className="ll:*:!text-micro ll:!gap-2"
                label={<Icon icon={MoveHorizontal} size={14} />}
                aria-label="Padding horizontal"
                value={paddingX}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.paddingX", v)}
              />
              <NumberField
                size="sm"
                className="ll:*:!text-micro ll:!gap-2"
                label={<Icon icon={MoveVertical} size={14} />}
                aria-label="Padding vertical"
                value={paddingY}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.paddingY", v)}
              />
            </div>
          </div>

          <SegmentedControl
            size="sm"
            ariaLabel="Item distribution"
            value={isSpaceBetween ? "space-between" : "packed"}
            onChange={(v) =>
              onUpdateProp?.(
                "layout.justifyContent",
                v === "space-between" ? "space-between" : "flex-start"
              )
            }
            options={[
              { value: "packed", label: "Packed", ariaLabel: "Packed" },
              {
                value: "space-between",
                label: "Space between",
                ariaLabel: "Space between",
              },
            ]}
          />
        </div>
      )}

      {/* Frame Grid Controls */}
      {isFrame && layoutMode === "grid" && (
        <div className="ll:flex ll:flex-col ll:gap-2 ll:pt-1">
          <div className="ll:grid ll:grid-cols-2 ll:gap-2">
            <NumberField
              size="sm"
              className="ll:*:!text-micro ll:!gap-2"
              label="Cols"
              aria-label="Columns"
              value={gridCols}
              min={1}
              step={1}
              onChange={(v) => onUpdateProp?.("layout.gridColumns", v)}
            />
            <NumberField
              size="sm"
              className="ll:*:!text-micro ll:!gap-2"
              label="Rows"
              aria-label="Rows"
              value={gridRows}
              min={1}
              step={1}
              onChange={(v) => onUpdateProp?.("layout.gridRows", v)}
            />
          </div>

          <div className="ll:grid ll:grid-cols-layout-labeled ll:gap-2 ll:items-start">
            <AlignmentGrid
              selectedIndex={matrixIndex}
              onChange={handleMatrixChange}
            />
            <div className="ll:flex ll:flex-col ll:gap-2">
              <NumberField
                size="sm"
                className="ll:*:!text-micro ll:!gap-2"
                label="Col gap"
                aria-label="Column gap"
                value={colGap}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.columnGap", v)}
              />
              <NumberField
                size="sm"
                className="ll:*:!text-micro ll:!gap-2"
                label="Row gap"
                aria-label="Row gap"
                value={rowGap}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProp?.("layout.rowGap", v)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const LayoutMore: React.FC<LayoutSectionProps> = ({
  layer,
  isFrame: propIsFrame,
  getValue,
  onUpdateProp,
}) => {
  const isFrame =
    propIsFrame !== undefined
      ? propIsFrame
      : layer?.archetype === "container" || (layer?.archetype as string) === "frame";

  // Min / Max bounds
  const minW = (getValue?.("layout.minWidth") as number) ?? 0;
  const maxW = (getValue?.("layout.maxWidth") as number) ?? 0;
  const minH = (getValue?.("layout.minHeight") as number) ?? 0;
  const maxH = (getValue?.("layout.maxHeight") as number) ?? 0;

  // 4-way padding
  const padTop = (getValue?.("layout.paddingTop") as number) ?? 0;
  const padRight = (getValue?.("layout.paddingRight") as number) ?? 0;
  const padBottom = (getValue?.("layout.paddingBottom") as number) ?? 0;
  const padLeft = (getValue?.("layout.paddingLeft") as number) ?? 0;

  // 4-way margin
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

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      {/* Min/Max Width */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="Min W"
          aria-label="Min width"
          value={minW}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => onUpdateProp?.("layout.minWidth", v)}
        />
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="Max W"
          aria-label="Max width"
          value={maxW || null}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => onUpdateProp?.("layout.maxWidth", v)}
        />
      </div>

      {/* Min/Max Height */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="Min H"
          aria-label="Min height"
          value={minH}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => onUpdateProp?.("layout.minHeight", v)}
        />
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="Max H"
          aria-label="Max height"
          value={maxH || null}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => onUpdateProp?.("layout.maxHeight", v)}
        />
      </div>

      {/* Padding 4-grid */}
      <div className="ll:flex ll:flex-col ll:gap-1">
        <span className="ll:text-small ll:font-sans ll:text-muted" title="Space between a frame's edge and what is inside it. It shows on frames and text; a plain shape has no inside.">
          Padding
        </span>
        <div className="ll:grid ll:grid-cols-4 ll:gap-1.5">
          <NumberField
            size="sm"
            className="ll:*:!text-micro ll:!gap-2"
            label="T"
            aria-label="Padding Top"
            value={padTop}
            step={INSPECTOR_CONSTANTS.STEP_INTEGER}
            onChange={(v) => onUpdateProp?.("layout.paddingTop", v)}
          />
          <NumberField
            size="sm"
            className="ll:*:!text-micro ll:!gap-2"
            label="R"
            aria-label="Padding Right"
            value={padRight}
            step={INSPECTOR_CONSTANTS.STEP_INTEGER}
            onChange={(v) => onUpdateProp?.("layout.paddingRight", v)}
          />
          <NumberField
            size="sm"
            className="ll:*:!text-micro ll:!gap-2"
            label="B"
            aria-label="Padding Bottom"
            value={padBottom}
            step={INSPECTOR_CONSTANTS.STEP_INTEGER}
            onChange={(v) => onUpdateProp?.("layout.paddingBottom", v)}
          />
          <NumberField
            size="sm"
            className="ll:*:!text-micro ll:!gap-2"
            label="L"
            aria-label="Padding Left"
            value={padLeft}
            step={INSPECTOR_CONSTANTS.STEP_INTEGER}
            onChange={(v) => onUpdateProp?.("layout.paddingLeft", v)}
          />
        </div>
      </div>

      {/* Margin 4-grid */}
      <div className="ll:flex ll:flex-col ll:gap-1">
        <span className="ll:text-small ll:font-sans ll:text-muted" title="Space around a layer. It moves a layer only inside an auto-layout frame; a layer placed by X and Y ignores it.">
          Margin
        </span>
        <div className="ll:grid ll:grid-cols-4 ll:gap-1.5">
          <NumberField
            size="sm"
            className="ll:*:!text-micro ll:!gap-2"
            label="T"
            aria-label="Margin Top"
            value={marginTop}
            step={INSPECTOR_CONSTANTS.STEP_INTEGER}
            onChange={(v) => onUpdateProp?.("layout.marginTop", v)}
          />
          <NumberField
            size="sm"
            className="ll:*:!text-micro ll:!gap-2"
            label="R"
            aria-label="Margin Right"
            value={marginRight}
            step={INSPECTOR_CONSTANTS.STEP_INTEGER}
            onChange={(v) => onUpdateProp?.("layout.marginRight", v)}
          />
          <NumberField
            size="sm"
            className="ll:*:!text-micro ll:!gap-2"
            label="B"
            aria-label="Margin Bottom"
            value={marginBottom}
            step={INSPECTOR_CONSTANTS.STEP_INTEGER}
            onChange={(v) => onUpdateProp?.("layout.marginBottom", v)}
          />
          <NumberField
            size="sm"
            className="ll:*:!text-micro ll:!gap-2"
            label="L"
            aria-label="Margin Left"
            value={marginLeft}
            step={INSPECTOR_CONSTANTS.STEP_INTEGER}
            onChange={(v) => onUpdateProp?.("layout.marginLeft", v)}
          />
        </div>
      </div>

      {/* Overflow X & Y */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <Select
          size="sm"
          label="Over X"
          aria-label="Overflow X"
          title="What happens to content wider than this box: Visible shows it, Hidden clips it, Scroll and Auto add a scrollbar."
          value={overflowX}
          options={OVERFLOW_OPTIONS}
          onChange={(v) => onUpdateProp?.("layout.overflowX", v)}
        />
        <Select
          size="sm"
          label="Over Y"
          aria-label="Overflow Y"
          title="What happens to content taller than this box: Visible shows it, Hidden clips it, Scroll and Auto add a scrollbar."
          value={overflowY}
          options={OVERFLOW_OPTIONS}
          onChange={(v) => onUpdateProp?.("layout.overflowY", v)}
        />
      </div>

      {/* Unit & Box Sizing */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <Select
          size="sm"
          label="Unit"
          aria-label="Unit"
          value={unit}
          options={UNIT_OPTIONS}
          onChange={(v) => onUpdateProp?.("layout.unit", v)}
        />
        <Select
          size="sm"
          label="Box"
          aria-label="Box sizing"
          value={boxSizing}
          options={BOX_SIZING_OPTIONS}
          onChange={(v) => onUpdateProp?.("layout.boxSizing", v)}
        />
      </div>

      {/* Frame vs non-frame controls */}
      {isFrame ? (
        <Checkbox
          label="Reverse layout"
          checked={(getValue?.("layout.reverse") as boolean) || false}
          onChange={(chk) => onUpdateProp?.("layout.reverse", chk)}
        />
      ) : (
        <div className="ll:flex ll:flex-col ll:gap-2">
          <Select
            size="sm"
            label="Self"
            aria-label="Align self"
            value={alignSelf}
            options={ALIGN_SELF_OPTIONS}
            onChange={(v) => onUpdateProp?.("layout.alignSelf", v)}
          />
          <div className="ll:grid ll:grid-cols-2 ll:gap-2">
            <NumberField
              size="sm"
              className="ll:*:!text-micro ll:!gap-2"
              label="Grow"
              aria-label="Grow"
              value={flexGrow}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.flexGrow", v)}
            />
            <NumberField
              size="sm"
              className="ll:*:!text-micro ll:!gap-2"
              label="Shrink"
              aria-label="Shrink"
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
