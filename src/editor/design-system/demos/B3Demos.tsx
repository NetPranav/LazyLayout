"use client";

import React, { useState } from "react";
import { RightPanelHeader } from "@/editor/shell/right-panel/RightPanelHeader";
import { RightPanelSection } from "@/editor/shell/right-panel/RightPanelSection";
import { RightPanelFrame } from "@/editor/shell/right-panel/RightPanelFrame";
import { MultiLayerIcon } from "@/editor/panels/details/hooks/useSelectionInspector";
import { PositionSection, PositionMore } from "@/editor/panels/details/sections/PositionSection";
import { LayoutSection, LayoutMore } from "@/editor/panels/details/sections/LayoutSection";
import { AppearanceSection, AppearanceMore } from "@/editor/panels/details/sections/AppearanceSection";
import { TypographySection, TypographyMore } from "@/editor/panels/details/sections/TypographySection";
import { FillSection } from "@/editor/panels/details/sections/FillSection";
import { OptionsPopover } from "@/editor/components/OptionsPopover";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import type { PropValue } from "@/core/document/registry";
import type { Layer } from "@/core/document/schema";

/**
 * 1. Single Layer Inspector with Sliders Options Popover & Alt+Click
 * Demonstrates the sliders icon button in section headers opening OptionsPopover,
 * plus Alt+click anywhere on a section's fields opening its options popover.
 */
export function B3InspectorSingleDemo() {
  const [props, setProps] = useState<Record<string, PropValue | null>>({
    "frame.x": 120,
    "frame.y": 64,
    "frame.rotation": 0,
    "frame.width": 320,
    "frame.height": 80,
    "sizing.horizontal": "fixed",
    "sizing.vertical": "hug",
    "appearance.opacity": 1,
    "appearance.radius": 6,
    "typography.fontFamily": "Geist",
    "typography.fontWeight": "500",
    "typography.fontSize": 18,
    "content.text": "Hero Heading",
  });

  const getValue = (key: string) => props[key] ?? null;
  const onUpdateProp = (key: string, val: PropValue | null) => {
    setProps((prev) => ({ ...prev, [key]: val }));
  };
  const onUpdateProps = (patch: Record<string, PropValue | null>) => {
    setProps((prev) => ({ ...prev, ...patch }));
  };

  const mockLayer: Layer = {
    id: "layer-1",
    name: "Hero Heading",
    archetype: "text",
    parentId: null,
    children: [],
    properties: props,
  };

  const sectionProps = {
    selectedId: "layer-1",
    selectedIds: ["layer-1"],
    layer: mockLayer,
    isMulti: false,
    getValue,
    onUpdateProp,
    onUpdateProps,
  };

  return (
    <div className="ll:w-80 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel ll:shadow-soft">
      <RightPanelHeader
        selectionName="Hero Heading"
        isMulti={false}
      />
      <div className="ll:flex ll:flex-col ll:overflow-y-auto ll:max-h-120">
        <RightPanelSection
          id="position"
          title="Position"
          moreContent={<PositionMore {...sectionProps} />}
        >
          <PositionSection {...sectionProps} />
        </RightPanelSection>

        <RightPanelSection
          id="layout"
          title="Layout"
          moreContent={<LayoutMore {...sectionProps} isFrame={false} />}
        >
          <LayoutSection {...sectionProps} isFrame={false} />
        </RightPanelSection>

        <RightPanelSection
          id="appearance"
          title="Appearance"
          moreContent={<AppearanceMore {...sectionProps} />}
        >
          <AppearanceSection {...sectionProps} />
        </RightPanelSection>

        <RightPanelSection
          id="typography"
          title="Typography"
          moreContent={<TypographyMore {...sectionProps} />}
        >
          <TypographySection {...sectionProps} />
        </RightPanelSection>
      </div>
    </div>
  );
}

/**
 * 2. Multi-Layer Inspector with Mixed Values (Shimmer) & Multi Icon
 * Demonstrates 2+ layers selected: "2 layers" header with ONE multi-layer icon,
 * differing values showing "Mixed" with shimmer animation, and typing applying
 * to all selected layers.
 */
export function B3InspectorMultiDemo() {
  const [layer1Props, setLayer1Props] = useState<Record<string, PropValue | null>>({
    "frame.x": 100,
    "frame.y": 50,
    "frame.width": 200,
    "frame.height": 60,
    "sizing.horizontal": "fixed",
    "appearance.opacity": 1,
    "appearance.radius": 4,
  });

  const [layer2Props, setLayer2Props] = useState<Record<string, PropValue | null>>({
    "frame.x": 100,
    "frame.y": 150, // differs: Mixed
    "frame.width": 300, // differs: Mixed
    "frame.height": 60,
    "sizing.horizontal": "hug", // differs: Mixed
    "appearance.opacity": 1,
    "appearance.radius": 8, // differs: Mixed
  });

  const getValue = (key: string): PropValue | null => {
    const v1 = layer1Props[key] ?? null;
    const v2 = layer2Props[key] ?? null;
    return v1 === v2 ? v1 : null; // null triggers Mixed shimmer
  };

  const onUpdateProp = (key: string, val: PropValue | null) => {
    setLayer1Props((prev) => ({ ...prev, [key]: val }));
    setLayer2Props((prev) => ({ ...prev, [key]: val }));
  };

  const onUpdateProps = (patch: Record<string, PropValue | null>) => {
    setLayer1Props((prev) => ({ ...prev, ...patch }));
    setLayer2Props((prev) => ({ ...prev, ...patch }));
  };

  const sectionProps = {
    selectedId: "layer-1",
    selectedIds: ["layer-1", "layer-2"],
    isMulti: true,
    getValue,
    onUpdateProp,
    onUpdateProps,
  };

  return (
    <div className="ll:w-80 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel ll:shadow-soft">
      <RightPanelHeader
        selectionName="2 layers"
        selectionIcon={MultiLayerIcon}
        isMulti={true}
      />
      <div className="ll:flex ll:flex-col ll:overflow-y-auto ll:max-h-120">
        <RightPanelSection
          id="position"
          title="Position"
          moreContent={<PositionMore {...sectionProps} />}
        >
          <PositionSection {...sectionProps} />
        </RightPanelSection>

        <RightPanelSection
          id="layout"
          title="Layout"
          moreContent={<LayoutMore {...sectionProps} isFrame={false} />}
        >
          <LayoutSection {...sectionProps} isFrame={false} />
        </RightPanelSection>

        <RightPanelSection
          id="appearance"
          title="Appearance"
          moreContent={<AppearanceMore {...sectionProps} />}
        >
          <AppearanceSection {...sectionProps} />
        </RightPanelSection>
      </div>
    </div>
  );
}

/**
 * 3. Floating Surfaces Hairline Outline Demo
 * Demonstrates that fields on floating surfaces (.llm-pop, #vpop, etc.)
 * have a hairline outline (border-color: var(--ll-border)).
 */
export function B3FloatingSurfacesHairlineDemo() {
  const [val, setVal] = useState<number | null>(42);
  const [selVal, setSelVal] = useState("center");

  return (
    <div className="llm-pop ll:relative ll:block ll:w-70 ll:bg-surface-float ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:p-4 ll:flex ll:flex-col ll:gap-3">
      <div className="ll:text-micro ll:font-medium ll:text-muted ll:border-b ll:border-border ll:pb-2">
        Position options (Floating Surface)
      </div>
      <div className="ll-dmg">
        <div className="ll-dtrow">
          <span className="ll-dlbl">Z</span>
          <div className="ll-dtc">
            <NumberField
              size="sm"
              label=""
              aria-label="Z-index"
              value={val}
              step={1}
              onChange={(v) => setVal(v)}
            />
          </div>
        </div>
        <div className="ll-dtrow">
          <span className="ll-dlbl">Origin</span>
          <div className="ll-dtc">
            <Select
              size="sm"
              aria-label="Origin"
              value={selVal}
              options={[
                { value: "center", label: "Center" },
                { value: "top-left", label: "Top left" },
                { value: "bottom-right", label: "Bottom right" },
              ]}
              onChange={(v) => setSelVal(v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
