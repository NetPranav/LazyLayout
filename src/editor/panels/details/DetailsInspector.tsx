"use client";

import React from "react";
import { useSelectionInspector } from "./hooks/useSelectionInspector";
import { PositionSection, PositionMore } from "./sections/PositionSection";
import { LayoutSection, LayoutMore } from "./sections/LayoutSection";
import { AppearanceSection, AppearanceMore } from "./sections/AppearanceSection";
import { TypographySection, TypographyMore } from "./sections/TypographySection";
import { StatesSection, StatesMore } from "./sections/StatesSection";
import { ImageSection, ImageMore } from "./sections/ImageSection";
import { FillSection } from "./sections/FillSection";
import { StrokeSection } from "./sections/StrokeSection";
import { EffectsSection } from "./sections/EffectsSection";
import { AnimationSection } from "./sections/AnimationSection";
import { DataSection } from "./sections/DataSection";
import { LogicSection } from "./sections/LogicSection";
import { AccessibilitySection } from "./sections/AccessibilitySection";
import {
  PageSectionBody,
  PageBackgroundBody,
  ThemeTokensBody,
  ThemeTokensMore,
} from "./sections/PageSection";
import type { DetailsInspectorProps } from "./types";
import type { DesignSectionConfig } from "@/editor/shell/right-panel/types";
import { RightPanelSection } from "@/editor/shell/right-panel/RightPanelSection";

/**
 * Returns the array of DesignSectionConfig populated with real inspector field children.
 * Useful when RightPanelFrame needs the prototype-compliant section configurations with their bodies.
 */
/** Stable add-handler holders: the section header "+" reaches the mounted repeatable section through these. */
type AddRef = { current?: () => void };
const fillAddRef: AddRef = {};
const strokeAddRef: AddRef = {};
const effectsAddRef: AddRef = {};
const animAddRef: AddRef = {};
const dataAddRef: AddRef = {};
const logicAddRef: AddRef = {};
const a11yAddRef: AddRef = {};

export function getInspectorDesignSections(
  inspector: ReturnType<typeof useSelectionInspector>,
  onOpenBlueprint?: () => void
): DesignSectionConfig[] {
  // Empty state: when no element is selected, show the Page inspector sections (prototype parity)
  if (!inspector.hasSelection) {
    return [
      {
        id: "page",
        title: "Page",
        children: <PageSectionBody pageName={inspector.selectionName || "Landing page"} />,
      },
      {
        id: "background",
        title: "Background",
        children: <PageBackgroundBody />,
      },
      {
        id: "theme-tokens",
        title: "Theme & Tokens",
        children: <ThemeTokensBody />,
        moreContent: <ThemeTokensMore />,
      },
    ];
  }

  const sectionProps = {
    selectedId: inspector.selectedId,
    selectedIds: inspector.selectedIds,
    layer: inspector.primaryLayer,
    isMulti: inspector.isMulti,
    getValue: inspector.getValue,
    onUpdateProp: inspector.onUpdateProp,
    onUpdateProps: inspector.onUpdateProps,
  };

  const isFrame = inspector.isFrame;
  const archetype = inspector.primaryLayer?.archetype;

  const hasTypography =
    !inspector.primaryLayer ||
    ["text", "button", "input", "counter", "svgText"].includes(archetype || "") ||
    inspector.isMulti;

  const allowsFill =
    !inspector.primaryLayer ||
    !["input", "toggle", "divider", "icon", "object3d", "counter"].includes(
      archetype || ""
    );

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
      moreContent: <PositionMore {...sectionProps} />,
    },
    {
      id: "layout",
      title: "Layout",
      children: <LayoutSection {...sectionProps} isFrame={isFrame} />,
      moreContent: <LayoutMore {...sectionProps} isFrame={isFrame} />,
    },
    {
      id: "appearance",
      title: "Appearance",
      children: <AppearanceSection {...sectionProps} />,
      moreContent: <AppearanceMore {...sectionProps} />,
    },
    ...(hasTypography
      ? [
          {
            id: "typography",
            title: "Typography",
            children: <TypographySection {...sectionProps} />,
            moreContent: <TypographyMore {...sectionProps} />,
          },
        ]
      : []),
    ...(archetype === "button"
      ? [
          {
            id: "states",
            title: "States",
            children: <StatesSection {...sectionProps} />,
            moreContent: <StatesMore {...sectionProps} />,
          },
        ]
      : []),
    ...(archetype === "image"
      ? [
          {
            id: "image",
            title: "Image",
            children: <ImageSection {...sectionProps} />,
            moreContent: <ImageMore {...sectionProps} />,
          },
        ]
      : []),
    ...(allowsFill
      ? [
          {
            id: "fill",
            title: "Fill",
            onAdd: () => fillAddRef.current?.(),
            children: <FillSection {...sectionProps} onAddFillRef={fillAddRef} />,
          },
        ]
      : []),
    {
      id: "stroke",
      title: "Stroke",
      onAdd: () => strokeAddRef.current?.(),
      children: <StrokeSection {...sectionProps} onAddStrokeRef={strokeAddRef} />,
    },
    {
      id: "effects",
      title: "Effects",
      onAdd: () => effectsAddRef.current?.(),
      children: <EffectsSection {...sectionProps} onAddEffectRef={effectsAddRef} />,
    },
    {
      id: "animation",
      title: "Animation",
      onAdd: () => animAddRef.current?.(),
      children: <AnimationSection {...sectionProps} onAddAnimationRef={animAddRef} />,
    },
    {
      id: "data",
      title: "Data",
      onAdd: () => dataAddRef.current?.(),
      children: <DataSection {...sectionProps} onAddDataRef={dataAddRef} />,
    },
    {
      id: "logic",
      title: "Logic",
      onAdd: () => logicAddRef.current?.(),
      children: (
        <LogicSection
          {...sectionProps}
          onOpenBlueprint={onOpenBlueprint}
          onAddLogicRef={logicAddRef}
        />
      ),
    },
    {
      id: "accessibility",
      title: "Accessibility",
      onAdd: () => a11yAddRef.current?.(),
      children: (
        <AccessibilitySection {...sectionProps} onAddA11yRef={a11yAddRef} />
      ),
    },
  ];
}

/**
 * DetailsInspector
 * Complete inspector field bodies wired to the live selection and document store.
 */
export const DetailsInspector: React.FC<DetailsInspectorProps> = ({
  selectedElementId,
  onOpenBlueprint,
  onDeselect: _onDeselect,
  className = "",
}) => {
  const inspector = useSelectionInspector({ selectedElementId });
  const sections = getInspectorDesignSections(inspector, onOpenBlueprint);

  return (
    <div className={`ll:flex ll:flex-col ll:w-full ${className}`}>
      {sections.map((sec) => (
        <RightPanelSection
          key={sec.id}
          id={sec.id}
          title={sec.title}
          onAdd={sec.onAdd}
          moreContent={sec.moreContent}
          headerAction={sec.headerAction}
        >
          {sec.children}
        </RightPanelSection>
      ))}
    </div>
  );
};
