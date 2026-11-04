"use client";

import React, { useState } from "react";
import { Frame, Type, Square, Layers } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { RightPanelFrame } from "@/editor/shell/right-panel/RightPanelFrame";
import type { DesignSectionConfig } from "@/editor/shell/right-panel/types";
import {
  PositionSection,
  PositionMore,
  LayoutSection,
  LayoutMore,
  AppearanceSection,
  AppearanceMore,
  TypographySection,
  TypographyMore,
  FillSection,
  StrokeSection,
  EffectsSection,
  AnimationSection,
  DataSection,
  LogicSection,
  AccessibilitySection,
  PageSectionBody,
  PageBackgroundBody,
  ThemeTokensBody,
  ThemeTokensMore,
} from "./index";
import { EasingCurveBox } from "./controls/EasingCurveBox";
import { AlignmentGrid } from "./controls/AlignmentGrid";
import { AlignBar } from "./controls/AlignBar";
import { EASING_PRESETS, type CubicBezierCurve } from "./constants";
import type { PropValue } from "@/core/document/registry";

type MockLayerKind = "text" | "frame" | "button" | "multi" | "page";

interface MockLayerData {
  id: string;
  name: string;
  icon: typeof Frame;
  props: Record<string, PropValue | null>;
}

const MOCK_LAYERS: Record<MockLayerKind, MockLayerData> = {
  text: {
    id: "headline",
    name: "Headline",
    icon: Type,
    props: {
      "frame.x": 120,
      "frame.y": 80,
      "frame.rotation": 0,
      "frame.width": 480,
      "frame.height": 64,
      "sizing.horizontal": "hug",
      "sizing.vertical": "hug",
      "layout.display": "block",
      "appearance.opacity": 1,
      "appearance.radius": 0,
      "appearance.background.color": "transparent",
      "typography.fontFamily": "Geist",
      "typography.fontWeight": "700",
      "typography.fontSize": 32,
      "typography.lineHeight": 1.1,
      "typography.letterSpacing": -0.5,
      "typography.textAlign": "left",
      "content.text": "Design it once. Ship it lazily.",
      "transition.duration": 0.6,
      "a11y.role": "heading",
      "a11y.label": "Main heading",
    },
  },
  frame: {
    id: "hero-card",
    name: "Hero Card",
    icon: Frame,
    props: {
      "frame.x": 60,
      "frame.y": 140,
      "frame.rotation": 0,
      "frame.width": 640,
      "frame.height": 420,
      "sizing.horizontal": "fixed",
      "sizing.vertical": "fixed",
      "layout.display": "flex",
      "layout.mode": "stack",
      "layout.flexDirection": "column",
      "layout.gap": 16,
      "layout.paddingX": 24,
      "layout.paddingY": 24,
      "layout.justifyContent": "flex-start",
      "layout.alignItems": "flex-start",
      "appearance.opacity": 1,
      "appearance.radius": 12,
      "appearance.background.color": "#2C2C2C",
      "appearance.border.color": "#444444",
      "appearance.border.width": 1,
      "appearance.border.style": "solid",
      "transition.duration": 0.4,
      "a11y.role": "article",
    },
  },
  button: {
    id: "cta-btn",
    name: "Action Button",
    icon: Square,
    props: {
      "frame.x": 240,
      "frame.y": 360,
      "frame.rotation": 0,
      "frame.width": 140,
      "frame.height": 36,
      "sizing.horizontal": "hug",
      "sizing.vertical": "fixed",
      "layout.display": "flex",
      "layout.mode": "stack",
      "layout.flexDirection": "row",
      "layout.gap": 8,
      "layout.paddingX": 16,
      "layout.paddingY": 8,
      "layout.justifyContent": "center",
      "layout.alignItems": "center",
      "appearance.opacity": 1,
      "appearance.radius": 6,
      "appearance.background.color": "#FFFFFF",
      "typography.fontFamily": "Geist",
      "typography.fontWeight": "500",
      "typography.fontSize": 14,
      "typography.lineHeight": 1.2,
      "typography.letterSpacing": 0,
      "typography.textAlign": "center",
      "content.text": "Get Started",
      "a11y.role": "button",
      "a11y.label": "Get Started CTA",
    },
  },
  multi: {
    id: "multi-layers",
    name: "2 Layers Selected",
    icon: Layers,
    props: {
      "frame.x": 120,
      "frame.y": null, // Mixed
      "frame.rotation": 0,
      "frame.width": null, // Mixed
      "frame.height": null, // Mixed
      "appearance.opacity": 1,
      "appearance.radius": null, // Mixed
    },
  },
  page: {
    id: "canvas-page",
    name: "Page 1",
    icon: Frame,
    props: {},
  },
};

export function DetailsLabView() {
  const [selectedKind, setSelectedKind] = useState<MockLayerKind>("text");
  const [customProps, setCustomProps] = useState<Record<string, Record<string, PropValue | null>>>({
    text: { ...MOCK_LAYERS.text.props },
    frame: { ...MOCK_LAYERS.frame.props },
    button: { ...MOCK_LAYERS.button.props },
    multi: { ...MOCK_LAYERS.multi.props },
    page: {},
  });

  // Standalone easing curve tester
  const [testCurve, setTestCurve] = useState<CubicBezierCurve>(EASING_PRESETS[2]);

  const activeLayer = MOCK_LAYERS[selectedKind];
  const activeProps = customProps[selectedKind] || {};

  const handleUpdateProp = (key: string, value: PropValue | null) => {
    setCustomProps((prev) => ({
      ...prev,
      [selectedKind]: {
        ...prev[selectedKind],
        [key]: value,
      },
    }));
  };

  const handleUpdateProps = (patch: Record<string, PropValue | null>) => {
    setCustomProps((prev) => ({
      ...prev,
      [selectedKind]: {
        ...prev[selectedKind],
        ...patch,
      },
    }));
  };

  const getValue = (key: string): PropValue | null => {
    return activeProps[key] ?? null;
  };

  const isMulti = selectedKind === "multi";
  const isPage = selectedKind === "page";

  const sectionProps = {
    selectedId: activeLayer.id,
    selectedIds: isMulti ? ["layer-1", "layer-2"] : [activeLayer.id],
    isMulti,
    getValue,
    onUpdateProp: handleUpdateProp,
    onUpdateProps: handleUpdateProps,
  };

  // Build the section configurations for RightPanelFrame
  const designSections: DesignSectionConfig[] = isPage
    ? [
        {
          id: "page",
          title: "Page",
          defaultOpen: true,
          children: <PageSectionBody />,
        },
        {
          id: "page-background",
          title: "Background",
          defaultOpen: true,
          children: <PageBackgroundBody />,
        },
        {
          id: "theme-tokens",
          title: "Theme & tokens",
          defaultOpen: true,
          moreContent: <ThemeTokensMore />,
          children: <ThemeTokensBody />,
        },
      ]
    : [
        {
          id: "position",
          title: "Position",
          defaultOpen: true,
          moreContent: <PositionMore />,
          children: <PositionSection {...sectionProps} />,
        },
        {
          id: "layout",
          title: "Layout",
          defaultOpen: true,
          moreContent: <LayoutMore />,
          children: <LayoutSection {...sectionProps} />,
        },
        {
          id: "appearance",
          title: "Appearance",
          defaultOpen: true,
          moreContent: <AppearanceMore />,
          children: <AppearanceSection {...sectionProps} />,
        },
        {
          id: "typography",
          title: "Typography",
          defaultOpen: selectedKind === "text" || selectedKind === "button",
          moreContent: <TypographyMore />,
          children: <TypographySection {...sectionProps} />,
        },
        {
          id: "fill",
          title: "Fill",
          defaultOpen: true,
          onAdd: () => console.log("Add fill"),
          children: <FillSection {...sectionProps} />,
        },
        {
          id: "stroke",
          title: "Stroke",
          defaultOpen: true,
          onAdd: () => console.log("Add stroke"),
          children: <StrokeSection {...sectionProps} />,
        },
        {
          id: "effects",
          title: "Effects",
          defaultOpen: true,
          onAdd: () => console.log("Add effect"),
          children: <EffectsSection {...sectionProps} />,
        },
        {
          id: "animation",
          title: "Animation",
          defaultOpen: true,
          onAdd: () => console.log("Add animation"),
          children: <AnimationSection {...sectionProps} />,
        },
        {
          id: "data",
          title: "Data",
          defaultOpen: true,
          onAdd: () => console.log("Add data"),
          children: <DataSection {...sectionProps} />,
        },
        {
          id: "logic",
          title: "Logic",
          defaultOpen: true,
          onAdd: () => console.log("Add logic"),
          children: <LogicSection {...sectionProps} />,
        },
        {
          id: "accessibility",
          title: "Accessibility",
          defaultOpen: true,
          onAdd: () => console.log("Add a11y"),
          children: <AccessibilitySection {...sectionProps} />,
        },
      ];

  return (
    <div className="ll:w-full ll:min-h-screen ll:bg-surface-canvas ll:text-primary ll:flex ll:flex-col">
      {/* Top Lab Header */}
      <header className="ll:flex ll:items-center ll:justify-between ll:h-12 ll:px-6 ll:bg-surface-panel ll:border-b ll:border-border ll:shrink-0">
        <div className="ll:flex ll:items-center ll:gap-3">
          <span className="ll:font-mono ll:text-small ll:font-semibold ll:tracking-wider">
            DETAILS INSPECTOR LAB
          </span>
          <span className="ll:text-micro ll:text-muted ll:font-mono">
            Phase 2: Inspector fields &amp; RightPanelFrame contract
          </span>
        </div>

        {/* Selection Switcher Pills */}
        <div className="ll:flex ll:items-center ll:gap-1.5">
          <span className="ll:text-micro ll:font-mono ll:text-muted ll:mr-1">
            Active Selection:
          </span>
          {(["text", "frame", "button", "multi", "page"] as const).map((kind) => {
            const isSelected = selectedKind === kind;
            const item = MOCK_LAYERS[kind];
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setSelectedKind(kind)}
                className={`ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:px-2.5 ll:rounded-sm ll:text-small ll:font-mono ll:border ll:transition-colors ${
                  isSelected
                    ? "ll:bg-control-primary-bg ll:text-control-primary-fg ll:border-control-primary-bg"
                    : "ll:bg-surface-bar ll:text-primary ll:border-border ll:hover:border-muted"
                }`}
              >
                <Icon icon={item.icon} size={12} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Lab Workspace */}
      <div className="ll:flex ll:flex-1 ll:min-h-0 ll:overflow-hidden">
        {/* Left Side: Interactive Component Showcases */}
        <div className="ll:flex-1 ll:overflow-y-auto ll:p-8 ll:flex ll:flex-col ll:gap-8">
          <div>
            <h1 className="ll:text-lead ll:font-semibold ll:text-primary ll:mb-1">
              Inspector Control Foundations
            </h1>
            <p className="ll:text-small ll:text-muted">
              Precision Apple-level fields, scrub controls, 3x3 alignment matrix, and cubic-bezier easing editor.
            </p>
          </div>

          {/* Card 1: Standalone Easing Curve Box */}
          <div className="ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:p-6 ll:max-w-xl ll:flex ll:flex-col ll:gap-4 ll:shadow-soft">
            <div className="ll:flex ll:items-center ll:justify-between">
              <div>
                <h2 className="ll:text-title ll:font-medium ll:text-primary">
                  Cubic-Bezier Easing Box &amp; x1/y1/x2/y2 Scrub
                </h2>
                <p className="ll:text-small ll:text-muted">
                  Interactive 100x100 SVG curve with 4 scrubbable control handles.
                </p>
              </div>
              <span className="ll:text-micro ll:font-mono ll:text-muted ll:px-2 ll:py-1 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-border">
                cubic-bezier({testCurve.x1}, {testCurve.y1}, {testCurve.x2}, {testCurve.y2})
              </span>
            </div>

            <EasingCurveBox
              curve={testCurve}
              onChange={setTestCurve}
            />
          </div>

          {/* Card 2: Alignment Grid & Align Bar */}
          <div className="ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:p-6 ll:max-w-xl ll:flex ll:flex-col ll:gap-4 ll:shadow-soft">
            <div>
              <h2 className="ll:text-title ll:font-medium ll:text-primary">
                Alignment Matrix (3x3) &amp; Align Bar
              </h2>
              <p className="ll:text-small ll:text-muted">
                9-position spatial alignment matrix for flexbox/grid containers with arrow key navigation.
              </p>
            </div>

            <div className="ll:flex ll:items-start ll:gap-6">
              <AlignmentGrid
                selectedIndex={4}
                onChange={(idx) => console.log("Selected matrix idx:", idx)}
              />
              <div className="ll:flex ll:flex-col ll:gap-3 ll:flex-1">
                <span className="ll:text-nano ll:font-mono ll:uppercase ll:text-muted">
                  Multi-item distribution toolbar
                </span>
                <AlignBar isMulti={true} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Real RightPanelFrame mounting our inspector sections */}
        <div className="ll:w-panel ll:h-full ll:shrink-0 ll:border-l ll:border-border">
          <RightPanelFrame
            mode="design"
            selectionName={activeLayer.name}
            selectionIcon={activeLayer.icon}
            designSections={designSections}
          />
        </div>
      </div>
    </div>
  );
}
