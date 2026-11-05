"use client";

import React, { useState } from "react";
import {
  Type,
  Square,
  Layers,
  Box,
  Sliders,
  Image as ImageIcon,
  CheckSquare,
  Minus,
  Shapes,
  Hash,
  BoxSelect,
} from "lucide-react";
import { RightPanelHeader } from "@/editor/shell/right-panel/RightPanelHeader";
import { RightPanelSection } from "@/editor/shell/right-panel/RightPanelSection";
import { RightPanelFrame } from "@/editor/shell/right-panel/RightPanelFrame";
import type { StatusChip, AiChatMessage } from "@/editor/shell/right-panel/types";

import { PositionSection, PositionMore } from "@/editor/panels/details/sections/PositionSection";
import { LayoutSection, LayoutMore } from "@/editor/panels/details/sections/LayoutSection";
import { AppearanceSection, AppearanceMore } from "@/editor/panels/details/sections/AppearanceSection";
import { TypographySection, TypographyMore } from "@/editor/panels/details/sections/TypographySection";
import { StatesSection, StatesMore } from "@/editor/panels/details/sections/StatesSection";
import { ImageSection, ImageMore } from "@/editor/panels/details/sections/ImageSection";
import { InputSection, InputMore } from "@/editor/panels/details/sections/InputSection";
import { ToggleSection } from "@/editor/panels/details/sections/ToggleSection";
import { DividerSection, DividerMore } from "@/editor/panels/details/sections/DividerSection";
import { IconSection, IconMore } from "@/editor/panels/details/sections/IconSection";
import { ShapeSection, ShapeMore } from "@/editor/panels/details/sections/ShapeSection";
import { CounterSection, CounterMore } from "@/editor/panels/details/sections/CounterSection";
import { Object3DSection, Object3DMore } from "@/editor/panels/details/sections/Object3DSection";
import { FillSection } from "@/editor/panels/details/sections/FillSection";
import { StrokeSection } from "@/editor/panels/details/sections/StrokeSection";
import { EffectsSection } from "@/editor/panels/details/sections/EffectsSection";
import { AnimationSection } from "@/editor/panels/details/sections/AnimationSection";
import { DataSection } from "@/editor/panels/details/sections/DataSection";
import { LogicSection } from "@/editor/panels/details/sections/LogicSection";
import { AccessibilitySection } from "@/editor/panels/details/sections/AccessibilitySection";
import {
  PageSectionBody,
  PageBackgroundBody,
  ThemeTokensBody,
  ThemeTokensMore,
} from "@/editor/panels/details/sections/PageSection";
import type { Layer } from "@/core/document/schema";
import type { PropValue } from "@/core/document/registry";

function makeMockLayer(
  id: string,
  name: string,
  archetype: Layer["archetype"],
  properties: Record<string, PropValue>
): Layer {
  return {
    id,
    name,
    archetype,
    parentId: null,
    children: [],
    visible: true,
    locked: false,
    properties,
  };
}

function useMockProps(initial: Record<string, PropValue>) {
  const [props, setProps] = useState<Record<string, PropValue>>(initial);
  const getValue = (key: string): PropValue | null =>
    props[key] !== undefined ? props[key] : null;
  const onUpdateProp = (key: string, val: PropValue | null) =>
    setProps((p) => (val === null ? p : { ...p, [key]: val }));
  const onUpdateProps = (patch: Record<string, PropValue | null>) =>
    setProps((p) => {
      const next = { ...p };
      for (const [k, v] of Object.entries(patch)) {
        if (v !== null) next[k] = v;
      }
      return next;
    });
  return { getValue, onUpdateProp, onUpdateProps };
}

/** Demo container styling: Apple-level restraint, 320px inspector column */
const demoContainerClass =
  "ll:w-panel ll:border ll:border-border ll:rounded-lg ll:bg-surface-panel ll:shadow-sm ll:overflow-hidden ll:flex ll:flex-col";

// 1. Right Panel Header Demo
export function InspectorHeaderDemo() {
  const [isHidden, setIsHidden] = useState(false);
  const chips: StatusChip[] = [
    { id: "anim", label: "Animated", targetSection: "animation" },
    { id: "data", label: "Data bound", targetSection: "data" },
  ];

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Inspector Header
        </h2>
        <p className="ll:text-small ll:text-muted">
          P-matching 44px header with 18px element title, archetype icon, status chips,
          hide/show eye toggle, and 200px dropdown menu.
        </p>
      </div>

      <div className="ll:flex ll:flex-wrap ll:gap-6">
        <div className={demoContainerClass}>
          <RightPanelHeader
            selectionName="Headline Large"
            selectionIcon={Type}
            statusChips={chips}
            isLayerHidden={isHidden}
            onToggleHideLayer={() => setIsHidden(!isHidden)}
            onReset={() => console.log("Reset clicked")}
            onDelete={() => console.log("Delete clicked")}
          />
          <div className="ll:p-4 ll:text-caption ll:text-muted ll:font-mono">
            Element with animated & data chips
          </div>
        </div>

        <div className={demoContainerClass}>
          <RightPanelHeader
            selectionName="Primary Button"
            selectionIcon={Square}
            statusChips={[]}
            isLayerHidden={false}
            onReset={() => {}}
            onDelete={() => {}}
          />
          <div className="ll:p-4 ll:text-caption ll:text-muted ll:font-mono">
            Default element header (no chips)
          </div>
        </div>
      </div>
    </div>
  );
}

// 2. Page Inspector Demo (No Selection)
export function PageInspectorDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Page Inspector (Empty Selection)
        </h2>
        <p className="ll:text-small ll:text-muted">
          Rendered when no layer is selected: Page name, canvas dimensions (1440×900),
          background color swatch, and theme & tokens selector.
        </p>
      </div>

      <div className={demoContainerClass}>
        <RightPanelHeader
          selectionName="Landing page"
          selectionIcon={Layers}
          onReset={() => {}}
          onDelete={() => {}}
        />
        <div className="ll:flex ll:flex-col ll:divide-y ll:divide-border">
          <RightPanelSection id="page" title="Page">
            <PageSectionBody pageName="Landing page" />
          </RightPanelSection>
          <RightPanelSection id="background" title="Background">
            <PageBackgroundBody />
          </RightPanelSection>
          <RightPanelSection
            id="theme-tokens"
            title="Theme & Tokens"
            moreContent={<ThemeTokensMore />}
          >
            <ThemeTokensBody />
          </RightPanelSection>
        </div>
      </div>
    </div>
  );
}

// 3. Text Element Inspector Demo
export function ElementInspectorTextDemo() {
  const initialProps: Record<string, PropValue> = {
    x: 80,
    y: 120,
    width: 480,
    height: 72,
    rotation: 0,
    opacity: 100,
    blendMode: "normal",
    fontFamily: "Inter",
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 1.15,
    letterSpacing: -0.02,
    textAlign: "left",
    color: "var(--ll-text)",
  };
  const mockLayer = makeMockLayer("txt-1", "Headline", "text", initialProps);
  const mockProps = useMockProps(initialProps);
  const sectionProps = {
    selectedId: mockLayer.id,
    selectedIds: [mockLayer.id],
    layer: mockLayer,
    isMulti: false,
    ...mockProps,
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Text Element Inspector
        </h2>
        <p className="ll:text-small ll:text-muted">
          Position, Layout, Appearance, Typography, Fill, Stroke, Effects, Animation, Data,
          Logic, and Accessibility.
        </p>
      </div>

      <div className={demoContainerClass}>
        <RightPanelHeader
          selectionName="Hero Headline"
          selectionIcon={Type}
          onReset={() => {}}
          onDelete={() => {}}
        />
        <div className="ll:flex ll:flex-col ll:divide-y ll:divide-border ll:max-h-inspector-demo ll:overflow-y-auto">
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
          <RightPanelSection id="fill" title="Fill">
            <FillSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection id="stroke" title="Stroke">
            <StrokeSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection id="effects" title="Effects">
            <EffectsSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection id="accessibility" title="Accessibility">
            <AccessibilitySection {...sectionProps} />
          </RightPanelSection>
        </div>
      </div>
    </div>
  );
}

// 4. Button Element Inspector Demo
export function ElementInspectorButtonDemo() {
  const initialProps: Record<string, PropValue> = {
    x: 100,
    y: 240,
    width: 140,
    height: 40,
    rotation: 0,
    opacity: 100,
    blendMode: "normal",
    radius: 6,
    fill: "var(--ll-accent)",
    color: "var(--ll-bg)",
  };
  const mockLayer = makeMockLayer("btn-1", "CTA Button", "button", initialProps);
  const mockProps = useMockProps(initialProps);
  const sectionProps = {
    selectedId: mockLayer.id,
    selectedIds: [mockLayer.id],
    layer: mockLayer,
    isMulti: false,
    ...mockProps,
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Button Element Inspector
        </h2>
        <p className="ll:text-small ll:text-muted">
          Includes States section for interactive pseudo-states (Default, Hover, Pressed, Disabled).
        </p>
      </div>

      <div className={demoContainerClass}>
        <RightPanelHeader
          selectionName="Button Primary"
          selectionIcon={Square}
          onReset={() => {}}
          onDelete={() => {}}
        />
        <div className="ll:flex ll:flex-col ll:divide-y ll:divide-border ll:max-h-inspector-demo-short ll:overflow-y-auto">
          <RightPanelSection
            id="position"
            title="Position"
            moreContent={<PositionMore {...sectionProps} />}
          >
            <PositionSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection
            id="appearance"
            title="Appearance"
            moreContent={<AppearanceMore {...sectionProps} />}
          >
            <AppearanceSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection
            id="states"
            title="States"
            moreContent={<StatesMore {...sectionProps} />}
          >
            <StatesSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection id="fill" title="Fill">
            <FillSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection id="stroke" title="Stroke">
            <StrokeSection {...sectionProps} />
          </RightPanelSection>
        </div>
      </div>
    </div>
  );
}

// 5. Frame Element Inspector Demo
export function ElementInspectorFrameDemo() {
  const initialProps: Record<string, PropValue> = {
    x: 0,
    y: 0,
    width: 1440,
    height: 600,
    rotation: 0,
    opacity: 100,
    layoutMode: "stack",
    direction: "column",
    gap: 24,
    padding: 48,
    clipContent: true,
  };
  const mockLayer = makeMockLayer("frame-1", "Hero Section", "container", initialProps);
  const mockProps = useMockProps(initialProps);
  const sectionProps = {
    selectedId: mockLayer.id,
    selectedIds: [mockLayer.id],
    layer: mockLayer,
    isMulti: false,
    ...mockProps,
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Frame Inspector (Auto-layout)
        </h2>
        <p className="ll:text-small ll:text-muted">
          Stack / Grid / Free layout selector, direction, 9-point alignment grid, gap, and padding.
        </p>
      </div>

      <div className={demoContainerClass}>
        <RightPanelHeader
          selectionName="Hero Frame"
          selectionIcon={BoxSelect}
          onReset={() => {}}
          onDelete={() => {}}
        />
        <div className="ll:flex ll:flex-col ll:divide-y ll:divide-border ll:max-h-inspector-demo-short ll:overflow-y-auto">
          <RightPanelSection
            id="layout"
            title="Layout"
            moreContent={<LayoutMore {...sectionProps} isFrame={true} />}
          >
            <LayoutSection {...sectionProps} isFrame={true} />
          </RightPanelSection>
          <RightPanelSection
            id="appearance"
            title="Appearance"
            moreContent={<AppearanceMore {...sectionProps} />}
          >
            <AppearanceSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection id="fill" title="Fill">
            <FillSection {...sectionProps} />
          </RightPanelSection>
        </div>
      </div>
    </div>
  );
}

// 6. Image Element Inspector Demo
export function ElementInspectorImageDemo() {
  const initialProps: Record<string, PropValue> = {
    x: 520,
    y: 120,
    width: 400,
    height: 300,
    rotation: 0,
    opacity: 100,
    src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
    objectFit: "cover",
    alt: "Abstract 3D architectural rendering",
  };
  const mockLayer = makeMockLayer("img-1", "Hero Image", "image", initialProps);
  const mockProps = useMockProps(initialProps);
  const sectionProps = {
    selectedId: mockLayer.id,
    selectedIds: [mockLayer.id],
    layer: mockLayer,
    isMulti: false,
    ...mockProps,
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Image Inspector
        </h2>
        <p className="ll:text-small ll:text-muted">
          Image URL, object fit (Cover, Contain, Fill, None), and alt text for accessibility.
        </p>
      </div>

      <div className={demoContainerClass}>
        <RightPanelHeader
          selectionName="Hero Visual"
          selectionIcon={ImageIcon}
          onReset={() => {}}
          onDelete={() => {}}
        />
        <div className="ll:flex ll:flex-col ll:divide-y ll:divide-border ll:max-h-inspector-demo-short ll:overflow-y-auto">
          <RightPanelSection
            id="image"
            title="Image"
            moreContent={<ImageMore {...sectionProps} />}
          >
            <ImageSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection
            id="appearance"
            title="Appearance"
            moreContent={<AppearanceMore {...sectionProps} />}
          >
            <AppearanceSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection id="effects" title="Effects">
            <EffectsSection {...sectionProps} />
          </RightPanelSection>
        </div>
      </div>
    </div>
  );
}

// 7. Input and Toggle Inspectors Demo
export function ElementInspectorInputsDemo() {
  const inputProps: Record<string, PropValue> = {
    inputType: "email",
    placeholder: "name@company.com",
    value: "",
    required: true,
    readOnly: false,
    pattern: "^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$",
  };
  const toggleProps: Record<string, PropValue> = {
    checked: true,
    size: "default",
    activeColor: "var(--ll-accent)",
    inactiveColor: "var(--ll-border)",
  };

  const inputLayer = makeMockLayer("inp-1", "Email Field", "input", inputProps);
  const toggleLayer = makeMockLayer("tog-1", "Dark Mode Switch", "toggle", toggleProps);

  const inputMock = useMockProps(inputProps);
  const toggleMock = useMockProps(toggleProps);

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Form Elements (Input & Toggle)
        </h2>
        <p className="ll:text-small ll:text-muted">
          Input types (text, email, password, number), placeholder, pattern, and toggle switch controls.
        </p>
      </div>

      <div className="ll:flex ll:flex-wrap ll:gap-6">
        <div className={demoContainerClass}>
          <RightPanelHeader
            selectionName="Email Input"
            selectionIcon={Sliders}
            onReset={() => {}}
            onDelete={() => {}}
          />
          <RightPanelSection
            id="input"
            title="Input"
            moreContent={<InputMore {...inputMock} layer={inputLayer} />}
          >
            <InputSection {...inputMock} layer={inputLayer} />
          </RightPanelSection>
        </div>

        <div className={demoContainerClass}>
          <RightPanelHeader
            selectionName="Theme Toggle"
            selectionIcon={CheckSquare}
            onReset={() => {}}
            onDelete={() => {}}
          />
          <RightPanelSection id="toggle" title="Toggle">
            <ToggleSection {...toggleMock} layer={toggleLayer} />
          </RightPanelSection>
        </div>
      </div>
    </div>
  );
}

// 8. Shapes, Divider and Icon Inspectors Demo
export function ElementInspectorShapesDemo() {
  const shapeProps: Record<string, PropValue> = {
    shapeType: "star",
    sides: 5,
    points: 5,
    innerRadius: 40,
  };
  const iconProps: Record<string, PropValue> = {
    iconName: "Search",
    iconSize: 20,
    strokeWidth: 1.5,
    strokeColor: "var(--ll-text)",
  };
  const divProps: Record<string, PropValue> = {
    orientation: "horizontal",
    style: "solid",
    thickness: 1,
    length: 100,
    color: "var(--ll-border)",
  };

  const shapeLayer = makeMockLayer("shp-1", "Star Badge", "star", shapeProps);
  const iconLayer = makeMockLayer("ic-1", "Search Icon", "icon", iconProps);
  const divLayer = makeMockLayer("div-1", "Section Divider", "divider", divProps);

  const shapeMock = useMockProps(shapeProps);
  const iconMock = useMockProps(iconProps);
  const divMock = useMockProps(divProps);

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Shapes, Icons & Dividers
        </h2>
        <p className="ll:text-small ll:text-muted">
          Procedural geometric shapes (polygon, star, circle), SVG icons, and rule dividers.
        </p>
      </div>

      <div className="ll:flex ll:flex-wrap ll:gap-6">
        <div className={demoContainerClass}>
          <RightPanelHeader
            selectionName="Star Badge"
            selectionIcon={Shapes}
            onReset={() => {}}
            onDelete={() => {}}
          />
          <RightPanelSection
            id="shape"
            title="Shape"
            moreContent={<ShapeMore {...shapeMock} layer={shapeLayer} />}
          >
            <ShapeSection {...shapeMock} layer={shapeLayer} />
          </RightPanelSection>
        </div>

        <div className={demoContainerClass}>
          <RightPanelHeader
            selectionName="Search Icon"
            selectionIcon={Sliders}
            onReset={() => {}}
            onDelete={() => {}}
          />
          <RightPanelSection
            id="icon"
            title="Icon"
            moreContent={<IconMore {...iconMock} layer={iconLayer} />}
          >
            <IconSection {...iconMock} layer={iconLayer} />
          </RightPanelSection>
        </div>

        <div className={demoContainerClass}>
          <RightPanelHeader
            selectionName="Rule Divider"
            selectionIcon={Minus}
            onReset={() => {}}
            onDelete={() => {}}
          />
          <RightPanelSection
            id="divider"
            title="Divider"
            moreContent={<DividerMore {...divMock} layer={divLayer} />}
          >
            <DividerSection {...divMock} layer={divLayer} />
          </RightPanelSection>
        </div>
      </div>
    </div>
  );
}

// 9. 3D Object & Counter Inspectors Demo
export function ElementInspector3DDemo() {
  const objProps: Record<string, PropValue> = {
    geometry: "torusKnot",
    material: "physical",
    metalness: 0.8,
    roughness: 0.2,
    emissive: "#000000",
    wireframe: false,
  };
  const cntProps: Record<string, PropValue> = {
    value: 99.9,
    prefix: "",
    suffix: "%",
    decimals: 1,
    separator: ",",
  };

  const objLayer = makeMockLayer("obj-1", "Torus Knot 3D", "object3D", objProps);
  const cntLayer = makeMockLayer("cnt-1", "Stat Metric", "generic", cntProps);

  const objMock = useMockProps(objProps);
  const cntMock = useMockProps(cntProps);

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          3D Scene Object & Counter
        </h2>
        <p className="ll:text-small ll:text-muted">
          Three.js material & geometry parameters (metalness, roughness, wireframe) and animated numeric counters.
        </p>
      </div>

      <div className="ll:flex ll:flex-wrap ll:gap-6">
        <div className={demoContainerClass}>
          <RightPanelHeader
            selectionName="Torus 3D"
            selectionIcon={Box}
            onReset={() => {}}
            onDelete={() => {}}
          />
          <RightPanelSection
            id="object3d"
            title="3D"
            moreContent={<Object3DMore {...objMock} layer={objLayer} />}
          >
            <Object3DSection {...objMock} layer={objLayer} />
          </RightPanelSection>
        </div>

        <div className={demoContainerClass}>
          <RightPanelHeader
            selectionName="Stat Counter"
            selectionIcon={Hash}
            onReset={() => {}}
            onDelete={() => {}}
          />
          <RightPanelSection
            id="counter"
            title="Counter"
            moreContent={<CounterMore {...cntMock} layer={cntLayer} />}
          >
            <CounterSection {...cntMock} layer={cntLayer} />
          </RightPanelSection>
        </div>
      </div>
    </div>
  );
}

// 10. Repeatable Rows Demo (Fill, Stroke, Effects, Animation, Data, Logic)
export function RepeatableRowsDemo() {
  const dummyLayer = makeMockLayer("rep-1", "Interactive Card", "container", {});
  const mockProps = useMockProps({});
  const sectionProps = {
    selectedId: dummyLayer.id,
    selectedIds: [dummyLayer.id],
    layer: dummyLayer,
    isMulti: false,
    ...mockProps,
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Repeatable Rows & Shared Popover
        </h2>
        <p className="ll:text-small ll:text-muted">
          One-line rows with drag grip, preview button, eye toggle, and remove button.
          Clicking the preview button opens the shared floating row settings popover.
        </p>
      </div>

      <div className={demoContainerClass}>
        <RightPanelHeader
          selectionName="Repeatable Sections"
          selectionIcon={Layers}
          onReset={() => {}}
          onDelete={() => {}}
        />
        <div className="ll:flex ll:flex-col ll:divide-y ll:divide-border ll:max-h-inspector-demo ll:overflow-y-auto">
          <RightPanelSection id="fill" title="Fill">
            <FillSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection id="stroke" title="Stroke">
            <StrokeSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection id="effects" title="Effects">
            <EffectsSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection id="animation" title="Animation">
            <AnimationSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection id="data" title="Data">
            <DataSection {...sectionProps} />
          </RightPanelSection>
          <RightPanelSection id="logic" title="Logic">
            <LogicSection {...sectionProps} />
          </RightPanelSection>
        </div>
      </div>
    </div>
  );
}

// 11. Expanded AI Chat View Demo
export function AiExpandedViewDemo() {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: "msg-1",
      role: "user",
      content: "Make this button match our primary lilac brand color with smooth hover spring.",
    },
    {
      id: "msg-2",
      role: "assistant",
      content: "Updated fill to `var(--ll-accent)` and added spring hover animation (response 0.35s, damping 0.6).",
    },
  ]);

  const handleSendMessage = (text: string) => {
    const newMsg: AiChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          Expanded AI Chat View
        </h2>
        <p className="ll:text-small ll:text-muted">
          Right panel AI view: header with back/close, messages transcript, and borderless input with focus ring.
        </p>
      </div>

      <div className="ll:w-panel ll:h-inspector-chat ll:border ll:border-border ll:rounded-lg ll:bg-surface-panel ll:shadow-sm ll:overflow-hidden">
        <RightPanelFrame
          mode="design"
          selectionName="Button Primary"
          selectionIcon={Square}
          aiOpen={true}
          onAiClose={() => console.log("AI closed")}
          aiMessages={messages}
          onAiSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
}
