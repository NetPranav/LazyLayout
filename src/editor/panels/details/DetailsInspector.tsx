"use client";

import React, { useState } from "react";
import { useSelectionInspector } from "./hooks/useSelectionInspector";
import { PositionSection } from "./sections/PositionSection";
import { LayoutSection } from "./sections/LayoutSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { TypographySection } from "./sections/TypographySection";
import { FillSection } from "./sections/FillSection";
import { StrokeSection } from "./sections/StrokeSection";
import { EffectsSection } from "./sections/EffectsSection";
import { AnimationSection } from "./sections/AnimationSection";
import { DataSection } from "./sections/DataSection";
import { LogicSection } from "./sections/LogicSection";
import { AccessibilitySection } from "./sections/AccessibilitySection";
import { PageSection } from "./sections/PageSection";
import type { DetailsInspectorProps } from "./types";
import type { DesignSectionConfig } from "@/editor/shell/right-panel/types";
import { PanelSection } from "@/editor/components/PanelSection";

/**
 * Returns the array of DesignSectionConfig populated with real inspector field children.
 * Useful when RightPanelFrame needs the 11 section configurations with their bodies.
 */
export function getInspectorDesignSections(
  inspector: ReturnType<typeof useSelectionInspector>,
  onOpenBlueprint?: () => void
): DesignSectionConfig[] {
  const sectionProps = {
    selectedId: inspector.selectedId,
    selectedIds: inspector.selectedIds,
    layer: inspector.primaryLayer,
    isMulti: inspector.isMulti,
    getValue: inspector.getValue,
    onUpdateProp: inspector.onUpdateProp,
    onUpdateProps: inspector.onUpdateProps,
  };

  const hasTypography =
    !inspector.primaryLayer ||
    ["text", "button", "input", "counter", "svgText"].includes(
      inspector.primaryLayer.archetype
    ) ||
    inspector.isMulti;

  return [
    {
      id: "position",
      title: "Position",
      children: (
        <PositionSection
          {...sectionProps}
          onAlign={inspector.onAlign}
          onDistribute={inspector.onDistribute}
          onTidy={inspector.onTidy}
        />
      ),
    },
    {
      id: "layout",
      title: "Layout",
      children: <LayoutSection {...sectionProps} />,
    },
    {
      id: "appearance",
      title: "Appearance",
      children: <AppearanceSection {...sectionProps} />,
    },
    ...(hasTypography
      ? [
          {
            id: "typography",
            title: "Typography",
            children: <TypographySection {...sectionProps} />,
          },
        ]
      : []),
    {
      id: "fill",
      title: "Fill",
      children: <FillSection {...sectionProps} />,
    },
    {
      id: "stroke",
      title: "Stroke",
      children: <StrokeSection {...sectionProps} />,
    },
    {
      id: "effects",
      title: "Effects",
      children: <EffectsSection {...sectionProps} />,
    },
    {
      id: "animation",
      title: "Animation",
      children: <AnimationSection {...sectionProps} />,
    },
    {
      id: "data",
      title: "Data",
      children: <DataSection {...sectionProps} />,
    },
    {
      id: "logic",
      title: "Logic",
      children: (
        <LogicSection
          {...sectionProps}
          onOpenBlueprint={onOpenBlueprint}
        />
      ),
    },
    {
      id: "accessibility",
      title: "Accessibility",
      children: <AccessibilitySection {...sectionProps} />,
    },
  ];
}

/**
 * DetailsInspector
 * Complete inspector field bodies wired to the live selection and document store.
 */
export const DetailsInspector: React.FC<DetailsInspectorProps> = ({
  selectedElementId,
  selectedElementName,
  onOpenBlueprint,
  onDeselect: _onDeselect,
  className = "",
}) => {
  const inspector = useSelectionInspector({ selectedElementId });
  const { hasSelection } = inspector;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    position: true,
    layout: true,
    appearance: true,
    typography: true,
    fill: true,
    stroke: true,
    effects: true,
    animation: true,
    data: false,
    logic: false,
    accessibility: false,
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // When no layers are selected, show the canvas page inspector
  if (!hasSelection) {
    return (
      <div className={`ll:flex ll:flex-col ll:p-4 ll:w-full ${className}`}>
        <PanelSection title="Page Settings" defaultOpen={true}>
          <PageSection pageName={selectedElementName || "Page 1"} />
        </PanelSection>
      </div>
    );
  }

  const sections = getInspectorDesignSections(inspector, onOpenBlueprint);

  return (
    <div className={`ll:flex ll:flex-col ll:w-full ll:divide-y ll:divide-border ${className}`}>
      {sections.map((sec) => (
        <PanelSection
          key={sec.id}
          title={sec.title}
          defaultOpen={openSections[sec.id] ?? sec.defaultOpen ?? true}
        >
          {sec.children}
        </PanelSection>
      ))}
    </div>
  );
};
