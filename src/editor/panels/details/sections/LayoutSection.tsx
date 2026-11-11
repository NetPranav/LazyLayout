"use client";

import React, { useEffect, useState } from "react";
import {
  Move,
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
import { addAutoLayout, addGridLayout, isAutoLayout, isGrid, removeAutoLayout, removeGridLayout, setChildSizing, setGridCell, setStack } from "@/core/editing/layoutOps";
import { useDocument } from "@/core/store/useDocumentStore";
import { transaction } from "@/core/editing/editOps";

/** The size a layer is really drawn at, for a W or H the document does not hold (Fill and Hug work it out when drawn). */
function useDrawnSize(id: string | null | undefined, active: boolean) {
  const [size, setSize] = useState<{ id: string; w: number; h: number } | null>(null);
  useEffect(() => {
    if (!id || !active) return;
    const node = document.querySelector(`[data-testid="stage-page"] [data-element-id="${CSS.escape(id)}"]`);
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0];
      setSize({ id, w: Math.round(box?.inlineSize ?? entry.contentRect.width), h: Math.round(box?.blockSize ?? entry.contentRect.height) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, active]);
  return size && size.id === id ? size : null;
}

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
  selectedId,
  selectedIds,
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
  const isWidthSizingMixed = getValue?.("sizing.horizontal") === null;
  const isHeightSizingMixed = getValue?.("sizing.vertical") === null;
  const sizingH = (getValue?.("sizing.horizontal") as string) || "fixed";
  const sizingV = (getValue?.("sizing.vertical") as string) || "fixed";
  const isClipped = (getValue?.("layout.overflowX") as string) === "hidden";
  const ids = selectedIds && selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
  const singleId = ids.length === 1 ? ids[0] : null;
  const widthIsDrawn = sizingH !== "fixed" || typeof rawW !== "number";
  const heightIsDrawn = sizingV !== "fixed" || typeof rawH !== "number";
  const drawnSize = useDrawnSize(singleId, widthIsDrawn || heightIsDrawn);
  const shownWidth = widthIsDrawn && drawnSize ? drawnSize.w : widthVal;
  const shownHeight = heightIsDrawn && drawnSize ? drawnSize.h : heightVal;

  // Frame layout mode: free, stack, grid
  const layoutMode: "free" | "stack" | "grid" = isGrid(layer) ? "grid" : isAutoLayout(layer) ? "stack" : "free";

  // What lays this layer out: its parent frame's stack or grid decides which child controls apply.
  const parentKind = useDocument((d) => {
    const parent = layer?.parentId ? d.layers[layer.parentId] : undefined;
    return isGrid(parent) ? "grid" : isAutoLayout(parent) ? "stack" : null;
  });
  const inFlow = parentKind !== null && (getValue?.("positioning") as string) !== "absolute";

  // Flex Direction & Distribution (frame only)
  const flexDir = (getValue?.("layout.flexDirection") as string) || "column";
  const isVertical = flexDir.startsWith("column");
  const flexWrap = (getValue?.("layout.flexWrap") as string) || "nowrap";
  const isWrapped = flexWrap === "wrap";
  const justifyContent = (getValue?.("layout.justifyContent") as string) || "flex-start";
  const alignItems = (getValue?.("layout.alignItems") as string) || "flex-start";
  const isSpaceBetween = justifyContent === "space-between";

  // The 3x3 grid is read as the screen: across is left to right, down is top to bottom. In a column the main axis (justify) runs down.
  const matrixIndex = isVertical ? getAlignmentMatrixIndex(alignItems, justifyContent) : getAlignmentMatrixIndex(justifyContent, alignItems);
  const alignSelf = (getValue?.("layout.alignSelf") as string) || "auto";
  const flexGrow = (getValue?.("layout.flexGrow") as number) ?? 0;
  const flexShrink = (getValue?.("layout.flexShrink") as number) ?? 1;
  const colSpan = (getValue?.("layout.gridColumnSpan") as number) ?? 1;
  const rowSpan = (getValue?.("layout.gridRowSpan") as number) ?? 1;

  // Spacing values (frame only)
  const gap = (getValue?.("layout.gap") as number) ?? 24;
  const paddingX = (getValue?.("layout.paddingLeft") as number) ?? (getValue?.("layout.paddingX") as number) ?? 0;
  const paddingY = (getValue?.("layout.paddingTop") as number) ?? (getValue?.("layout.paddingY") as number) ?? 0;

  // Grid rows & cols (frame only)
  const gridCols = (getValue?.("layout.gridColumns") as number) ?? 2;
  const gridRows = (getValue?.("layout.gridRows") as number) ?? 2;
  const colGap = (getValue?.("layout.columnGap") as number) ?? 16;
  const rowGap = (getValue?.("layout.rowGap") as number) ?? 16;

  // The real auto layout: a stack or grid places its children; going back to Free leaves each child where it is.
  const direction: "free" | "row" | "column" | "grid" = layoutMode === "stack" ? (isVertical ? "column" : "row") : layoutMode;
  const handleDirectionChange = (next: "free" | "row" | "column" | "grid") => {
    if (direction === next) return;
    transaction("Change layout", () => {
      const toMode = next === "row" || next === "column" ? "stack" : next;
      if (layoutMode !== toMode) {
        if (layoutMode === "stack") removeAutoLayout(ids);
        if (layoutMode === "grid") removeGridLayout(ids);
        if (toMode === "stack") addAutoLayout(ids);
        if (toMode === "grid") addGridLayout(ids);
      }
      if (next === "row" || next === "column") setStack(ids, { direction: next });
    });
  };

  const handleMatrixChange = (
    _idx: AlignmentMatrixIndex,
    justify: "flex-start" | "center" | "flex-end",
    align: "flex-start" | "center" | "flex-end"
  ) => {
    onUpdateProps?.(
      isVertical && layoutMode === "stack"
        ? { "layout.justifyContent": align, "layout.alignItems": justify }
        : { "layout.justifyContent": justify, "layout.alignItems": align }
    );
  };

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* If frame: Free / Row / Column / Grid */}
      {isFrame && (
        <SegmentedControl
          size="sm"
          className="ll:w-full ll:*:flex-1"
          ariaLabel="Layout direction"
          value={direction}
          onChange={handleDirectionChange}
          options={[
            {
              value: "free",
              label: "Free",
              icon: <Icon icon={Move} size={13} />,
              ariaLabel: "Free layout",
              title: "Free layout (absolute placement)",
            },
            {
              value: "row",
              label: "Row",
              icon: <Icon icon={ArrowRight} size={13} />,
              ariaLabel: "Auto layout row",
              title: "Auto layout, children side by side",
            },
            {
              value: "column",
              label: "Column",
              icon: <Icon icon={ArrowDown} size={13} />,
              ariaLabel: "Auto layout column",
              title: "Auto layout, children one under another",
            },
            {
              value: "grid",
              label: "Grid",
              icon: <Icon icon={LayoutGrid} size={13} />,
              ariaLabel: "Grid layout",
              title: "CSS Grid layout",
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
          value={shownWidth}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => {
            if (sizingH !== "fixed") onUpdateProp?.("sizing.horizontal", "fixed"); // a typed size is a fixed size
            onUpdateProp?.("frame.width", v);
            onUpdateProp?.("width", v);
          }}
        />
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="H"
          value={shownHeight}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => {
            if (sizingV !== "fixed") onUpdateProp?.("sizing.vertical", "fixed"); // a typed size is a fixed size
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
          value={isWidthSizingMixed ? undefined : sizingH}
          placeholder={isWidthSizingMixed ? "Mixed" : undefined}
          options={WIDTH_SIZING_OPTIONS}
          mixed={isWidthSizingMixed}
          onChange={(val) => setChildSizing(ids, { horizontal: val as "fixed" | "hug" | "fill" })}
        />
        <Select
          size="sm"
          aria-label="Height sizing"
          title="Fixed keeps the number you type, Hug shrinks to fit the content, Fill stretches to the parent (inside an auto-layout frame)."
          value={isHeightSizingMixed ? undefined : sizingV}
          placeholder={isHeightSizingMixed ? "Mixed" : undefined}
          options={HEIGHT_SIZING_OPTIONS}
          mixed={isHeightSizingMixed}
          onChange={(val) => setChildSizing(ids, { vertical: val as "fixed" | "hug" | "fill" })}
        />
        <button
          type="button"
          aria-pressed={isClipped}
          aria-label="Clip content"
          title="Clip content: anything that sticks out of this layer's box is cut off (the same as Overflow: Hidden under More)."
          onClick={() => {
            const v = isClipped ? "visible" : "hidden";
            onUpdateProps?.({ "layout.overflowX": v, "layout.overflowY": v });
          }}
          className={`ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:border ll:border-border ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ${
            isClipped
              ? "ll:bg-control-secondary-bg ll:text-primary ll:border-border-active"
              : "ll:bg-surface-bar ll:text-muted ll:hover:text-primary"
          }`}
        >
          <Icon icon={Crop} size={14} />
        </button>
      </div>

      {/* A child of a stack: how it fills the line. A child of a grid: how many cells it covers. */}
      {inFlow && parentKind === "stack" && (
        <div className="ll:grid ll:grid-cols-3 ll:gap-2 ll:w-full ll:items-center">
          <NumberField
            size="sm"
            className="ll:*:!text-micro ll:!gap-2"
            label="Grow"
            aria-label="Grow"
            title="Share of the free room in the stack this layer takes (0 keeps its size)."
            value={flexGrow}
            min={0}
            step={1}
            onChange={(v) => onUpdateProp?.("layout.flexGrow", v)}
          />
          <NumberField
            size="sm"
            className="ll:*:!text-micro ll:!gap-2"
            label="Shrink"
            aria-label="Shrink"
            title="How much this layer gives up when the stack is too small (0 keeps its size)."
            value={flexShrink}
            min={0}
            step={1}
            onChange={(v) => onUpdateProp?.("layout.flexShrink", v)}
          />
          <Select
            size="sm"
            aria-label="Align self"
            title="Where this layer sits across the stack, whatever the frame's alignment says."
            value={alignSelf}
            options={ALIGN_SELF_OPTIONS}
            onChange={(v) => onUpdateProp?.("layout.alignSelf", v)}
          />
        </div>
      )}
      {inFlow && parentKind === "grid" && (
        <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
          <NumberField
            size="sm"
            className="ll:*:!text-micro ll:!gap-2"
            label="Col span"
            aria-label="Column span"
            value={colSpan}
            min={1}
            step={1}
            onChange={(v) => setGridCell(ids, { columnSpan: v })}
          />
          <NumberField
            size="sm"
            className="ll:*:!text-micro ll:!gap-2"
            label="Row span"
            aria-label="Row span"
            value={rowSpan}
            min={1}
            step={1}
            onChange={(v) => setGridCell(ids, { rowSpan: v })}
          />
        </div>
      )}

      {/* Frame Stack Controls */}
      {isFrame && layoutMode === "stack" && (
        <div className="ll:flex ll:flex-col ll:gap-2 ll:pt-1">
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
                onChange={(v) => onUpdateProps?.({ "layout.paddingLeft": v, "layout.paddingRight": v })}
              />
              <NumberField
                size="sm"
                className="ll:*:!text-micro ll:!gap-2"
                label={<Icon icon={MoveVertical} size={14} />}
                aria-label="Padding vertical"
                value={paddingY}
                step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                onChange={(v) => onUpdateProps?.({ "layout.paddingTop": v, "layout.paddingBottom": v })}
              />
            </div>
          </div>

          <div className="ll:flex ll:items-center ll:gap-2">
            <div className="ll:flex-1 ll:min-w-0">
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
            <button
              type="button"
              aria-pressed={isWrapped}
              aria-label="Wrap"
              title="Wrap"
              onClick={() =>
                onUpdateProp?.("layout.flexWrap", isWrapped ? "nowrap" : "wrap")
              }
              className={`ll:w-7 ll:h-7 ll:shrink-0 ll:grid ll:place-items-center ll:rounded-sm ll:border ll:border-border ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ${
                isWrapped
                  ? "ll:bg-control-secondary-bg ll:text-primary ll:border-border-active"
                  : "ll:bg-surface-bar ll:text-muted ll:hover:text-primary"
              }`}
            >
              <Icon icon={WrapText} size={14} />
            </button>
          </div>
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
    <div className="ll:flex ll:flex-col ll:w-full">
      {/* Group 1: Min/Max Width and Height */}
      <div className="ll-dmg">
        <div className="ll-dtrow">
          <span className="ll-dlbl">Width</span>
          <div className="ll-dtc">
            <NumberField
              size="sm"
              label="Min"
              aria-label="Min width"
              value={minW}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.minWidth", v)}
            />
            <NumberField
              size="sm"
              label="Max"
              aria-label="Max width"
              value={maxW || null}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.maxWidth", v)}
            />
          </div>
        </div>

        <div className="ll-dtrow">
          <span className="ll-dlbl">Height</span>
          <div className="ll-dtc">
            <NumberField
              size="sm"
              label="Min"
              aria-label="Min height"
              value={minH}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.minHeight", v)}
            />
            <NumberField
              size="sm"
              label="Max"
              aria-label="Max height"
              value={maxH || null}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.maxHeight", v)}
            />
          </div>
        </div>
      </div>

      {/* Group 2: Padding & Margin */}
      <div className="ll-dmg">
        <div className="ll-dgl">
          <span className="ll-dlbl" title="Space between a frame's edge and what is inside it. It shows on frames and text; a plain shape has no inside.">Padding</span>
          <div className="ll:grid ll:grid-cols-4 ll:gap-1.5">
            <NumberField
              size="sm"
              label="T"
              aria-label="Padding Top"
              value={padTop}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.paddingTop", v)}
            />
            <NumberField
              size="sm"
              label="R"
              aria-label="Padding Right"
              value={padRight}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.paddingRight", v)}
            />
            <NumberField
              size="sm"
              label="B"
              aria-label="Padding Bottom"
              value={padBottom}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.paddingBottom", v)}
            />
            <NumberField
              size="sm"
              label="L"
              aria-label="Padding Left"
              value={padLeft}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.paddingLeft", v)}
            />
          </div>
        </div>

        <div className="ll-dgl">
          <span className="ll-dlbl" title="Space around a layer. It moves a layer only inside an auto-layout frame; a layer placed by X and Y ignores it.">Margin</span>
          <div className="ll:grid ll:grid-cols-4 ll:gap-1.5">
            <NumberField
              size="sm"
              label="T"
              aria-label="Margin Top"
              value={marginTop}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.marginTop", v)}
            />
            <NumberField
              size="sm"
              label="R"
              aria-label="Margin Right"
              value={marginRight}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.marginRight", v)}
            />
            <NumberField
              size="sm"
              label="B"
              aria-label="Margin Bottom"
              value={marginBottom}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.marginBottom", v)}
            />
            <NumberField
              size="sm"
              label="L"
              aria-label="Margin Left"
              value={marginLeft}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(v) => onUpdateProp?.("layout.marginLeft", v)}
            />
          </div>
        </div>
      </div>

      {/* Group 3: Overflow, Unit, Box Sizing */}
      <div className="ll-dmg">
        <div className="ll-dtrow">
          <span className="ll-dlbl">Overflow X</span>
          <div className="ll-dtc">
            <Select
              size="sm"
              aria-label="Overflow X"
              title="What happens to content wider than this box: Visible shows it, Hidden clips it, Scroll and Auto add a scrollbar."
              value={overflowX}
              options={OVERFLOW_OPTIONS}
              onChange={(v) => onUpdateProp?.("layout.overflowX", v)}
            />
          </div>
        </div>

        <div className="ll-dtrow">
          <span className="ll-dlbl">Overflow Y</span>
          <div className="ll-dtc">
            <Select
              size="sm"
              aria-label="Overflow Y"
              title="What happens to content taller than this box: Visible shows it, Hidden clips it, Scroll and Auto add a scrollbar."
              value={overflowY}
              options={OVERFLOW_OPTIONS}
              onChange={(v) => onUpdateProp?.("layout.overflowY", v)}
            />
          </div>
        </div>

        <div className="ll-dtrow">
          <span className="ll-dlbl">Unit</span>
          <div className="ll-dtc">
            <Select
              size="sm"
              aria-label="Unit"
              value={unit}
              options={UNIT_OPTIONS}
              onChange={(v) => onUpdateProp?.("layout.unit", v)}
            />
          </div>
        </div>

        <div className="ll-dtrow">
          <span className="ll-dlbl">Box</span>
          <div className="ll-dtc">
            <Select
              size="sm"
              aria-label="Box sizing"
              value={boxSizing}
              options={BOX_SIZING_OPTIONS}
              onChange={(v) => onUpdateProp?.("layout.boxSizing", v)}
            />
          </div>
        </div>
      </div>

      {/* Group 4: Frame vs Non-frame controls */}
      <div className="ll-dmg">
        {isFrame ? (
          <div className="ll-dtrow">
            <span className="ll-dlbl">Reverse</span>
            <div className="ll-dtc">
              <Checkbox
                label=""
                checked={(getValue?.("layout.reverse") as boolean) || false}
                onChange={(chk) => onUpdateProp?.("layout.reverse", chk)}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="ll-dtrow">
              <span className="ll-dlbl">Self</span>
              <div className="ll-dtc">
                <Select
                  size="sm"
                  aria-label="Align self"
                  value={alignSelf}
                  options={ALIGN_SELF_OPTIONS}
                  onChange={(v) => onUpdateProp?.("layout.alignSelf", v)}
                />
              </div>
            </div>

            <div className="ll-dtrow">
              <span className="ll-dlbl">Grow</span>
              <div className="ll-dtc">
                <NumberField
                  size="sm"
                  label=""
                  aria-label="Grow"
                  value={flexGrow}
                  step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                  onChange={(v) => onUpdateProp?.("layout.flexGrow", v)}
                />
              </div>
            </div>

            <div className="ll-dtrow">
              <span className="ll-dlbl">Shrink</span>
              <div className="ll-dtc">
                <NumberField
                  size="sm"
                  label=""
                  aria-label="Shrink"
                  value={flexShrink}
                  step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                  onChange={(v) => onUpdateProp?.("layout.flexShrink", v)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
