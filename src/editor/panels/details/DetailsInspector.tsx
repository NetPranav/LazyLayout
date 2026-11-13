"use client";

import React from "react";
import { useSelectionInspector } from "./hooks/useSelectionInspector";
import { PositionSection } from "./sections/PositionSection";
import { LayoutSection } from "./sections/LayoutSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { TypographySection } from "./sections/TypographySection";
import { StatesSection } from "./sections/StatesSection";
import { ImageSection } from "./sections/ImageSection";
import { InputSection, InputMore } from "./sections/InputSection";
import { ToggleSection } from "./sections/ToggleSection";
import { DividerSection } from "./sections/DividerSection";
import { BackgroundSection } from "./sections/BackgroundSection";
import { IconSection } from "./sections/IconSection";
import { ShapeSection } from "./sections/ShapeSection";
import { VectorSection, VectorHeaderAction, VectorOptions } from "./sections/VectorSection";
import { CounterSection } from "./sections/CounterSection";
import { Object3DSection } from "./sections/Object3DSection";
import { FillSection } from "./sections/FillSection";
import { StrokeSection } from "./sections/StrokeSection";
import { EffectsSection } from "./sections/EffectsSection";
import { AnimationSection } from "./sections/AnimationSection";
import { DataSection } from "./sections/DataSection";
import { LogicSection } from "./sections/LogicSection";
import { AccessibilitySection } from "./sections/AccessibilitySection";
import { StyleCodeSection } from "./sections/StyleCodeSection";
import { DrivenBySection } from "./sections/DrivenBySection";
import {
  PageSectionBody,
  PageBackgroundBody,
  ConnectedPageSection,
  ConnectedPageBackground,
  ThemeTokensBody,
} from "./sections/PageSection";
import {
  PositionOptions,
  LayoutOptions,
  AppearanceOptions,
  TypographyOptions,
  ThemeTokensOptions,
  ImageOptions,
  StatesOptions,
  DividerOptions,
  BackgroundOptions,
  IconOptions,
  ShapeOptions,
  CounterOptions,
  Object3DOptions,
} from "./options";
import type { DetailsInspectorProps } from "./types";
import type { DesignSectionConfig } from "@/editor/shell/right-panel/types";
import { RightPanelSection } from "@/editor/shell/right-panel/RightPanelSection";
import { isLettersGroup } from "@/core/editing/splitText";
import { getDocument } from "@/core/store/documentState";

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
        children: <ConnectedPageSection pageName={inspector.selectionName || "Landing page"} />,
      },
      {
        id: "background",
        title: "Background",
        children: <ConnectedPageBackground />,
      },
      {
        id: "theme-tokens",
        title: "Theme & Tokens",
        children: <ThemeTokensBody />,
        moreContent: <ThemeTokensOptions />,
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

  const isInput = archetype === "input";
  const isToggle = archetype === "toggle";
  const isDivider = archetype === "divider" || (archetype as string) === "line";
  const isBackground = archetype === "background";
  const isIcon = archetype === "icon";
  const isShape = ["shape", "star", "polygon", "circle", "arrow"].includes(archetype || "");
  const isPath = archetype === "svgPath";
  const isCounter = (archetype as string) === "counter";
  const isObject3D = archetype === "object3D" || (archetype as string) === "object3d";

  const isLetters = inspector.primaryLayer
    ? isLettersGroup(inspector.primaryLayer, getDocument().layers)
    : false;

  const hasTypography =
    !inspector.primaryLayer ||
    ["text", "button", "input", "counter", "svgText"].includes(archetype || "") ||
    inspector.isMulti ||
    isLetters;

  const allowsFill =
    !inspector.primaryLayer ||
    !["input", "toggle", "divider", "line", "icon", "object3d", "object3D", "counter"].includes(
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
      moreContent: <PositionOptions {...sectionProps} />,
    },
    {
      id: "layout",
      title: "Layout",
      children: <LayoutSection {...sectionProps} isFrame={isFrame} />,
      moreContent: <LayoutOptions {...sectionProps} isFrame={isFrame} />,
    },
    {
      id: "appearance",
      title: "Appearance",
      children: <AppearanceSection {...sectionProps} />,
      moreContent: <AppearanceOptions {...sectionProps} />,
    },
    ...(isInput
      ? [
          {
            id: "input",
            title: "Input",
            children: <InputSection {...sectionProps} />,
            moreContent: <InputMore {...sectionProps} />,
          },
        ]
      : []),
    ...(isToggle
      ? [
          {
            id: "toggle",
            title: "Toggle",
            children: <ToggleSection {...sectionProps} />,
          },
        ]
      : []),
    ...(isDivider
      ? [
          {
            id: "divider",
            title: "Divider",
            children: <DividerSection {...sectionProps} />,
            moreContent: <DividerOptions {...sectionProps} />,
          },
        ]
      : []),
    ...(isBackground
      ? [
          {
            id: "background",
            title: "Background",
            children: <BackgroundSection {...sectionProps} />,
            moreContent: <BackgroundOptions {...sectionProps} />,
          },
        ]
      : []),
    ...(isIcon
      ? [
          {
            id: "icon",
            title: "Icon",
            children: <IconSection {...sectionProps} />,
            moreContent: <IconOptions {...sectionProps} />,
          },
        ]
      : []),
    ...(isShape
      ? [
          {
            id: "shape",
            title: "Shape",
            children: <ShapeSection {...sectionProps} />,
            moreContent: <ShapeOptions {...sectionProps} />,
          },
        ]
      : []),
    ...(isPath
      ? [
          {
            id: "vector",
            title: "Vector",
            headerAction: <VectorHeaderAction {...sectionProps} />,
            children: <VectorSection {...sectionProps} />,
            moreContent: <VectorOptions {...sectionProps} />,
          },
        ]
      : []),
    ...(isCounter
      ? [
          {
            id: "counter",
            title: "Counter",
            children: <CounterSection {...sectionProps} />,
            moreContent: <CounterOptions {...sectionProps} />,
          },
        ]
      : []),
    ...(isObject3D
      ? [
          {
            id: "object3d",
            title: "3D",
            children: <Object3DSection {...sectionProps} />,
            moreContent: <Object3DOptions {...sectionProps} />,
          },
        ]
      : []),
    ...(hasTypography
      ? [
          {
            id: "typography",
            title: "Typography",
            children: <TypographySection {...sectionProps} />,
            moreContent: <TypographyOptions {...sectionProps} />,
          },
        ]
      : []),
    ...(archetype === "button"
      ? [
          {
            id: "states",
            title: "States",
            children: <StatesSection {...sectionProps} />,
            moreContent: <StatesOptions {...sectionProps} />,
          },
        ]
      : []),
    ...(archetype === "image"
      ? [
          {
            id: "image",
            title: "Image",
            children: <ImageSection {...sectionProps} />,
            moreContent: <ImageOptions {...sectionProps} />,
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
    ...(!isObject3D
      ? [
          {
            id: "stroke",
            title: "Stroke",
            onAdd: () => strokeAddRef.current?.(),
            children: <StrokeSection {...sectionProps} onAddStrokeRef={strokeAddRef} />,
          },
        ]
      : []),
    {
      id: "effects",
      title: "Effects",
      onAdd: () => effectsAddRef.current?.(),
      children: <EffectsSection {...sectionProps} onAddEffectRef={effectsAddRef} />,
    },
    {
      id: "driven-by",
      title: "Driven by",
      children: <DrivenBySection {...sectionProps} />,
    },
    {
      id: "style-code",
      title: "Style code",
      children: <StyleCodeSection {...sectionProps} />,
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
 * The sections that are not about how a layer looks: Animation belongs with Motion, Data and Logic with Code. They are
 * the same sections (same fields, same document), shown in those modes instead of in Design.
 */
export function getInspectorExtraSections(
  inspector: ReturnType<typeof useSelectionInspector>,
  kind: "animation" | "data-logic",
  onOpenBlueprint?: () => void
): DesignSectionConfig[] {
  if (!inspector.hasSelection) return [];
  const sectionProps = {
    selectedId: inspector.selectedId,
    selectedIds: inspector.selectedIds,
    layer: inspector.primaryLayer,
    isMulti: inspector.isMulti,
    getValue: inspector.getValue,
    onUpdateProp: inspector.onUpdateProp,
    onUpdateProps: inspector.onUpdateProps,
  };
  if (kind === "animation") {
    return [
      {
        id: "animation",
        title: "Animation",
        onAdd: () => animAddRef.current?.(),
        children: <AnimationSection {...sectionProps} onAddAnimationRef={animAddRef} />,
      },
    ];
  }
  return [
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
      children: <LogicSection {...sectionProps} onOpenBlueprint={onOpenBlueprint} onAddLogicRef={logicAddRef} />,
    },
  ];
}

/** Those sections as a block under a Motion or Code inspector. */
export const InspectorExtras: React.FC<{ kind: "animation" | "data-logic" }> = ({ kind }) => {
  const inspector = useSelectionInspector();
  const sections = getInspectorExtraSections(inspector, kind);
  if (sections.length === 0) return null;
  return (
    <div className="ll:flex ll:flex-col ll:w-full ll:border-t ll:border-border" data-testid={`inspector-extras-${kind}`}>
      {sections.map((sec) => (
        <RightPanelSection key={sec.id} id={sec.id} title={sec.title} onAdd={sec.onAdd}>
          {sec.children}
        </RightPanelSection>
      ))}
    </div>
  );
};

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
