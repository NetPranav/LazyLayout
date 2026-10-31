"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Swatch, type SwatchProps } from "../components/Swatch";
import { WorkspaceFrame } from "../components/WorkspaceFrame";
import { Button } from "../components/Button";
import { SegmentedControl, type SegmentedControlOption } from "../components/SegmentedControl";
import { Tooltip } from "../components/Tooltip";
import { TopBar, type DeviceMode } from "../components/TopBar";
import {
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Search,
  Settings,
  Sparkles,
  Download,
  Share2,
} from "lucide-react";

type NavSectionId =
  | "colors"
  | "type"
  | "spacing"
  | "radii"
  | "shadows"
  | "button"
  | "segmented-control"
  | "tooltip"
  | "top-bar"
  | "swatch"
  | "workspace-frame";

interface NavItem {
  id: NavSectionId;
  label: string;
}

const FOUNDATIONS_NAV: readonly NavItem[] = [
  { id: "colors", label: "Colors" },
  { id: "type", label: "Type" },
  { id: "spacing", label: "Spacing" },
  { id: "radii", label: "Radii" },
  { id: "shadows", label: "Shadows" },
];

const COMPONENTS_NAV: readonly NavItem[] = [
  { id: "button", label: "Button" },
  { id: "segmented-control", label: "SegmentedControl" },
  { id: "tooltip", label: "Tooltip" },
  { id: "top-bar", label: "TopBar" },
  { id: "swatch", label: "Swatch" },
  { id: "workspace-frame", label: "WorkspaceFrame" },
];

const ALL_NAV = [...FOUNDATIONS_NAV, ...COMPONENTS_NAV];

const SURFACE_SWATCHES: readonly SwatchProps[] = [
  {
    role: "Backdrop (outside the app)",
    token: "--ll-neutral-400",
    hex: "#8F8F8F",
    bgClass: "ll:bg-neutral-400",
    borderClass: "ll:border-border",
  },
  {
    role: "Panels and side rails",
    token: "--ll-neutral-200",
    hex: "#C4C4C4",
    bgClass: "ll:bg-neutral-200",
    borderClass: "ll:border-border",
  },
  {
    role: "Canvas",
    token: "--ll-neutral-100",
    hex: "#DFDFDF",
    bgClass: "ll:bg-neutral-100",
    borderClass: "ll:border-border",
  },
  {
    role: "Toolbar and floating bars",
    token: "--ll-neutral-50",
    hex: "#F1F1F1",
    bgClass: "ll:bg-neutral-50",
    borderClass: "ll:border-border",
  },
  {
    role: "Raised surfaces (cards, menus, inputs)",
    token: "--ll-neutral-0",
    hex: "#FFFFFF",
    bgClass: "ll:bg-neutral-0",
    borderClass: "ll:border-border",
  },
];

const SPACING_STEPS = [
  { token: "--ll-spacing-1", px: 4, widthClass: "ll:w-1" },
  { token: "--ll-spacing-2", px: 8, widthClass: "ll:w-2" },
  { token: "--ll-spacing-3", px: 12, widthClass: "ll:w-3" },
  { token: "--ll-spacing-4", px: 16, widthClass: "ll:w-4" },
  { token: "--ll-spacing-5", px: 20, widthClass: "ll:w-5" },
  { token: "--ll-spacing-6", px: 24, widthClass: "ll:w-6" },
  { token: "--ll-spacing-8", px: 32, widthClass: "ll:w-8" },
  { token: "--ll-spacing-12", px: 48, widthClass: "ll:w-12" },
  { token: "--ll-spacing-16", px: 64, widthClass: "ll:w-16" },
];

export function DesignSystemPage() {
  const [activeSection, setActiveSection] = useState<NavSectionId>("colors");
  const navButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Demo state for SegmentedControl and TopBar
  const [demoDevice, setDemoDevice] = useState<DeviceMode>("desktop");
  const [topBarDevice, setTopBarDevice] = useState<DeviceMode>("desktop");

  // Hash-based routing for bookmarking and direct links
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "") as NavSectionId;
      if (ALL_NAV.some((item) => item.id === hash)) {
        setActiveSection(hash);
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const handleSelect = useCallback((id: NavSectionId) => {
    setActiveSection(id);
    window.location.hash = id;
  }, []);

  // Keyboard navigation for nav list (arrow keys & Enter/Space)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = (index + 1) % ALL_NAV.length;
        navButtonRefs.current[nextIndex]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = (index - 1 + ALL_NAV.length) % ALL_NAV.length;
        navButtonRefs.current[prevIndex]?.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect(ALL_NAV[index].id);
      }
    },
    [handleSelect]
  );

  return (
    <div className="design-system-root ll:h-screen ll:w-screen ll:overflow-hidden ll:bg-neutral-400 ll:p-4 ll:box-border ll:font-sans ll:text-neutral-1000">
      {/* App frame: 16px inset on neutral-400 backdrop, modest 8px radius, hairline border, soft shadow */}
      <div className="ll:w-full ll:h-full ll:rounded-lg ll:border ll:border-border ll:shadow-soft ll:overflow-hidden ll:isolate ll:flex ll:flex-col ll:xl:flex-row ll:bg-neutral-100">
        {/* Mobile & Tablet Nav Header / Desktop Right Panel (fixed 320px) */}
        <aside className="ll:w-full ll:xl:w-80 ll:xl:h-full ll:bg-neutral-200 ll:xl:order-last ll:border-b ll:xl:border-b-0 ll:xl:border-l ll:border-border ll:flex ll:flex-col ll:shrink-0 ll:overflow-y-auto">
          {/* Header */}
          <div className="ll:p-4 ll:border-b ll:border-border">
            <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
              Design System
            </span>
          </div>

          {/* Navigation groups */}
          <nav aria-label="Design system navigation" className="ll:p-3 ll:flex ll:flex-col ll:gap-4">
            {/* Foundations group */}
            <div className="ll:flex ll:flex-col ll:gap-1">
              <div className="ll:px-3 ll:py-1 ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                Foundations
              </div>
              <ul role="list" className="ll:flex ll:flex-col ll:gap-1">
                {FOUNDATIONS_NAV.map((item, index) => {
                  const isSelected = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        ref={(el) => {
                          navButtonRefs.current[index] = el;
                        }}
                        type="button"
                        aria-current={isSelected ? "page" : undefined}
                        onClick={() => handleSelect(item.id)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        className={`ll:w-full ll:h-11 ll:min-h-11 ll:px-3 ll:rounded-md ll:flex ll:items-center ll:justify-start ll:text-left ll:text-body ll:font-medium ll:focus-visible:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-neutral-1000 ${
                          isSelected
                            ? "ll:bg-neutral-1000 ll:text-neutral-0"
                            : "ll:text-neutral-1000 ll:bg-transparent ll:hover:bg-neutral-400"
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Hairline divider */}
            <div className="ll:h-px ll:w-full ll:bg-border" />

            {/* Components group */}
            <div className="ll:flex ll:flex-col ll:gap-1">
              <div className="ll:px-3 ll:py-1 ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                Components
              </div>
              <ul role="list" className="ll:flex ll:flex-col ll:gap-1">
                {COMPONENTS_NAV.map((item, index) => {
                  const globalIndex = FOUNDATIONS_NAV.length + index;
                  const isSelected = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        ref={(el) => {
                          navButtonRefs.current[globalIndex] = el;
                        }}
                        type="button"
                        aria-current={isSelected ? "page" : undefined}
                        onClick={() => handleSelect(item.id)}
                        onKeyDown={(e) => handleKeyDown(e, globalIndex)}
                        className={`ll:w-full ll:h-11 ll:min-h-11 ll:px-3 ll:rounded-md ll:flex ll:items-center ll:justify-start ll:text-left ll:text-body ll:font-medium ll:focus-visible:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-neutral-1000 ${
                          isSelected
                            ? "ll:bg-neutral-1000 ll:text-neutral-0"
                            : "ll:text-neutral-1000 ll:bg-transparent ll:hover:bg-neutral-400"
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        </aside>

        {/* Canvas (left, takes remaining width, content strictly centered) */}
        <main className="ll:flex-1 ll:h-full ll:overflow-y-auto ll:p-6 ll:sm:p-8 ll:md:p-12 ll:flex ll:flex-col ll:items-center">
          <div key={activeSection} className="ll:w-full ll:max-w-canvas">
            {activeSection === "colors" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-neutral-1000 ll:font-sans">
                    Colors
                  </h1>
                </div>

                {/* Real workspace layer stack */}
                <div className="ll:flex ll:flex-col ll:gap-2">
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                    Workspace Preview (Real Layers)
                  </span>
                  <WorkspaceFrame />
                </div>

                {/* Group 1: Surfaces */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800"
                  >
                    Surfaces
                  </div>
                  <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:md:grid-cols-3 ll:gap-6">
                    {SURFACE_SWATCHES.map((swatch) => (
                      <Swatch key={swatch.token} {...swatch} />
                    ))}
                  </div>
                </div>

                {/* Group 2: Text */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800"
                  >
                    Text
                  </div>
                  <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:gap-6">
                    <Swatch
                      role="Secondary text (5.6:1 on neutral-200)"
                      token="--ll-neutral-800"
                      hex="#464646"
                      sample={
                        <div className="ll:w-full ll:h-full ll:bg-neutral-200 ll:p-4 ll:flex ll:flex-col ll:justify-center">
                          <span className="ll:text-small ll:font-medium ll:text-neutral-800">
                            Secondary label on neutral-200 surface
                          </span>
                        </div>
                      }
                    />
                    <Swatch
                      role="Primary text & active controls"
                      token="--ll-neutral-1000"
                      hex="#000000"
                      sample={
                        <div className="ll:w-full ll:h-full ll:bg-neutral-100 ll:p-3 ll:flex ll:items-center ll:justify-between ll:gap-2">
                          <span className="ll:text-small ll:font-semibold ll:text-neutral-1000">
                            Primary text
                          </span>
                          <span className="ll:px-2.5 ll:py-1 ll:rounded-sm ll:bg-neutral-1000 ll:text-neutral-0 ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider">
                            Active
                          </span>
                        </div>
                      }
                    />
                  </div>
                </div>

                {/* Group 3: Lines */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800"
                  >
                    Lines
                  </div>
                  <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:gap-6">
                    <Swatch
                      role="Border (hairline separator)"
                      token="--ll-border-color"
                      hex="#8F8F8F at 50%"
                      sample={
                        <div className="ll:w-full ll:h-full ll:bg-neutral-100 ll:p-4 ll:flex ll:flex-col ll:items-center ll:justify-center ll:gap-2">
                          <div className="ll:w-full ll:h-px ll:bg-border" />
                          <span className="ll:text-micro ll:text-neutral-800">
                            Hairline divider (1px)
                          </span>
                          <div className="ll:w-full ll:h-px ll:bg-border" />
                        </div>
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "type" && (
              <div className="ll:flex ll:flex-col ll:gap-6">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-neutral-1000 ll:font-sans">
                    Type Scale
                  </h1>
                </div>

                <div className="ll:flex ll:flex-col">
                  <div className="ll:border-b ll:border-border ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                        Display — 28px / Bold / Tracking -0.025em
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-neutral-800">
                        --ll-text-display
                      </span>
                    </div>
                    <div className="ll:text-display ll:font-bold ll:text-neutral-1000">
                      Motion Design Studio
                    </div>
                  </div>

                  <div className="ll:border-b ll:border-border ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                        Title — 18px / Semibold / Tracking -0.015em
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-neutral-800">
                        --ll-text-title
                      </span>
                    </div>
                    <div className="ll:text-title ll:font-semibold ll:text-neutral-1000">
                      Apple-level craft and motion choreography
                    </div>
                  </div>

                  <div className="ll:border-b ll:border-border ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                        Body — 14px / Regular / Tracking -0.005em
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-neutral-800">
                        --ll-text-body
                      </span>
                    </div>
                    <div className="ll:text-body ll:font-normal ll:text-neutral-1000">
                      Visually author interactive motion, effects, and components with GSAP and CSS, compiled to production-grade code.
                    </div>
                  </div>

                  <div className="ll:border-b ll:border-border ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                        Small — 12px / Regular
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-neutral-800">
                        --ll-text-small
                      </span>
                    </div>
                    <div className="ll:text-small ll:font-normal ll:text-neutral-1000">
                      Inspect keyframes, ease curves, transform vectors, and runtime nodes.
                    </div>
                  </div>

                  <div className="ll:border-b ll:border-border ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                        Micro Label — 10px / Semibold / Uppercase / Tracking 0.06em
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-neutral-800">
                        --ll-text-micro
                      </span>
                    </div>
                    <div className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-1000">
                      FOUNDATIONS &amp; MOTION ARCHITECTURE
                    </div>
                  </div>

                  <div className="ll:py-6 ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                        Code &amp; Numbers — Geist Mono
                      </span>
                      <span className="ll:font-mono ll:text-micro ll:text-neutral-800">
                        --ll-font-mono
                      </span>
                    </div>
                    <div className="ll:font-mono ll:text-small ll:text-neutral-1000">
                      const backdrop = &quot;--ll-neutral-400&quot;; // #8F8F8F at 120ms
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "spacing" && (
              <div className="ll:flex ll:flex-col ll:gap-6">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-neutral-1000 ll:font-sans">
                    Spacing (4px Grid)
                  </h1>
                </div>
                <div className="ll:flex ll:flex-col">
                  {SPACING_STEPS.map((step) => (
                    <div
                      key={step.px}
                      className="ll:flex ll:items-center ll:gap-6 ll:py-4 ll:border-b ll:border-border"
                    >
                      <span className="ll:font-mono ll:text-small ll:w-16 ll:text-neutral-800 ll:shrink-0">
                        {step.px}px
                      </span>
                      <span className="ll:font-mono ll:text-small ll:w-36 ll:text-neutral-800 ll:shrink-0">
                        {step.token}
                      </span>
                      <div className="ll:flex-1 ll:flex ll:items-center">
                        <div
                          className={`ll:h-4 ll:bg-neutral-400 ll:rounded-sm ${step.widthClass}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === "radii" && (
              <div className="ll:flex ll:flex-col ll:gap-6">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-neutral-1000 ll:font-sans">
                    Radii (Modest, No Pills)
                  </h1>
                </div>
                <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-3 ll:gap-6">
                  <div className="ll:h-28 ll:rounded-sm ll:bg-neutral-200 ll:border ll:border-border ll:p-4 ll:flex ll:flex-col ll:justify-between">
                    <span className="ll:text-body ll:font-medium ll:text-neutral-1000">Small (4px)</span>
                    <span className="ll:font-mono ll:text-small ll:text-neutral-800">--ll-radius-sm</span>
                  </div>
                  <div className="ll:h-28 ll:rounded-md ll:bg-neutral-200 ll:border ll:border-border ll:p-4 ll:flex ll:flex-col ll:justify-between">
                    <span className="ll:text-body ll:font-medium ll:text-neutral-1000">Medium (6px)</span>
                    <span className="ll:font-mono ll:text-small ll:text-neutral-800">--ll-radius-md</span>
                  </div>
                  <div className="ll:h-28 ll:rounded-lg ll:bg-neutral-200 ll:border ll:border-border ll:p-4 ll:flex ll:flex-col ll:justify-between">
                    <span className="ll:text-body ll:font-medium ll:text-neutral-1000">Large (8px)</span>
                    <span className="ll:font-mono ll:text-small ll:text-neutral-800">--ll-radius-lg</span>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "shadows" && (
              <div className="ll:flex ll:flex-col ll:gap-6">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-neutral-1000 ll:font-sans">
                    Shadows
                  </h1>
                </div>
                <div className="ll:py-4">
                  <div className="ll:p-8 ll:rounded-lg ll:bg-neutral-0 ll:border ll:border-border ll:shadow-soft">
                    <div className="ll:text-body ll:font-semibold ll:text-neutral-1000">
                      Soft Shadow
                    </div>
                    <div className="ll:font-mono ll:text-small ll:text-neutral-800">
                      --ll-shadow-soft
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* BUTTON COMPONENT */}
            {activeSection === "button" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-neutral-1000 ll:font-sans">
                    Button
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                    Variants, Sizes, Icon-Only Shapes &amp; All States
                  </span>
                </div>

                {/* Group 1: Variants & Sizes */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800"
                  >
                    Variants &amp; Sizes
                  </div>
                  <div className="ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:p-6 ll:flex ll:flex-col ll:gap-6">
                    {/* Primary variant */}
                    <div className="ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-small ll:font-semibold ll:text-neutral-1000">
                        Primary (Solid Black neutral-1000, White text)
                      </span>
                      <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-3">
                        <Button variant="primary" size="md">
                          Primary Medium (32px)
                        </Button>
                        <Button variant="primary" size="sm">
                          Primary Small (28px)
                        </Button>
                        <Button
                          variant="primary"
                          size="md"
                          leftIcon={<Sparkles size={14} />}
                        >
                          With Icon
                        </Button>
                      </div>
                    </div>

                    <div className="ll:h-px ll:w-full ll:bg-border" />

                    {/* Secondary variant */}
                    <div className="ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-small ll:font-semibold ll:text-neutral-1000">
                        Secondary (White neutral-0, Hairline Border, Black text)
                      </span>
                      <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-3">
                        <Button variant="secondary" size="md">
                          Secondary Medium (32px)
                        </Button>
                        <Button variant="secondary" size="sm">
                          Secondary Small (28px)
                        </Button>
                        <Button
                          variant="secondary"
                          size="md"
                          leftIcon={<Download size={14} />}
                        >
                          With Icon
                        </Button>
                      </div>
                    </div>

                    <div className="ll:h-px ll:w-full ll:bg-border" />

                    {/* Ghost variant */}
                    <div className="ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-small ll:font-semibold ll:text-neutral-1000">
                        Ghost (Transparent Surface, Instant Hover on neutral-100)
                      </span>
                      <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-3">
                        <Button variant="ghost" size="md">
                          Ghost Medium (32px)
                        </Button>
                        <Button variant="ghost" size="sm">
                          Ghost Small (28px)
                        </Button>
                        <Button
                          variant="ghost"
                          size="md"
                          leftIcon={<Share2 size={14} />}
                        >
                          With Icon
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group 2: Icon-Only Buttons */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800"
                  >
                    Icon-Only Shape (Square, 6px Radius)
                  </div>
                  <div className="ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:p-6 ll:flex ll:flex-wrap ll:items-center ll:gap-4">
                    <div className="ll:flex ll:flex-col ll:items-center ll:gap-1">
                      <Button variant="secondary" size="md" iconOnly aria-label="Undo">
                        <Undo2 size={16} strokeWidth={1.5} />
                      </Button>
                      <span className="ll:text-micro ll:text-neutral-800">Secondary 32px</span>
                    </div>

                    <div className="ll:flex ll:flex-col ll:items-center ll:gap-1">
                      <Button variant="secondary" size="sm" iconOnly aria-label="Undo">
                        <Undo2 size={14} strokeWidth={1.5} />
                      </Button>
                      <span className="ll:text-micro ll:text-neutral-800">Secondary 28px</span>
                    </div>

                    <div className="ll:flex ll:flex-col ll:items-center ll:gap-1">
                      <Button variant="primary" size="md" iconOnly aria-label="Search">
                        <Search size={16} strokeWidth={1.5} />
                      </Button>
                      <span className="ll:text-micro ll:text-neutral-800">Primary 32px</span>
                    </div>

                    <div className="ll:flex ll:flex-col ll:items-center ll:gap-1">
                      <Button variant="ghost" size="md" iconOnly aria-label="Settings">
                        <Settings size={16} strokeWidth={1.5} />
                      </Button>
                      <span className="ll:text-micro ll:text-neutral-800">Ghost 32px</span>
                    </div>
                  </div>
                </div>

                {/* Group 3: States Showcase */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800"
                  >
                    All States
                  </div>
                  <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:md:grid-cols-3 ll:gap-4">
                    {/* Default */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                        Default
                      </span>
                      <Button variant="secondary" size="md">
                        Default Action
                      </Button>
                    </div>

                    {/* Hover */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                        Hover (Instant on neutral-100)
                      </span>
                      <button
                        type="button"
                        className="ll:h-8 ll:px-3 ll:rounded-md ll:font-sans ll:font-medium ll:text-small ll:bg-neutral-100 ll:border ll:border-border ll:text-neutral-1000 ll:flex ll:items-center ll:justify-center"
                      >
                        Hovered State
                      </button>
                    </div>

                    {/* Focus-Visible */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                        Focus-Visible (2px Ring, 2px Offset)
                      </span>
                      <button
                        type="button"
                        className="ll:h-8 ll:px-3 ll:rounded-md ll:font-sans ll:font-medium ll:text-small ll:bg-neutral-0 ll:border ll:border-border ll:text-neutral-1000 ll:ring-2 ll:ring-neutral-1000 ll:ring-offset-2 ll:flex ll:items-center ll:justify-center"
                      >
                        Focused Control
                      </button>
                    </div>

                    {/* Active */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                        Active (Pressed on neutral-200)
                      </span>
                      <button
                        type="button"
                        className="ll:h-8 ll:px-3 ll:rounded-md ll:font-sans ll:font-medium ll:text-small ll:bg-neutral-200 ll:border ll:border-border ll:text-neutral-1000 ll:flex ll:items-center ll:justify-center"
                      >
                        Active Pressed
                      </button>
                    </div>

                    {/* Disabled */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                        Disabled (Opacity 40%)
                      </span>
                      <Button variant="secondary" size="md" disabled>
                        Disabled Action
                      </Button>
                    </div>

                    {/* Loading */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:flex ll:flex-col ll:gap-2">
                      <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                        Loading (1.5px Stroke Spinner)
                      </span>
                      <Button variant="secondary" size="md" loading>
                        Saving Project...
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SEGMENTED CONTROL COMPONENT */}
            {activeSection === "segmented-control" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-neutral-1000 ll:font-sans">
                    SegmentedControl
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                    Concentric Radii (6px Outer, 4px Inner), Radiogroup, Keyboard Nav
                  </span>
                </div>

                {/* Interactive live control */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800"
                  >
                    Interactive Demonstration
                  </div>
                  <div className="ll:p-6 ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:flex ll:flex-col ll:gap-4">
                    <div className="ll:flex ll:items-center ll:justify-between">
                      <span className="ll:text-small ll:font-medium ll:text-neutral-800">
                        Selected Target: <strong className="ll:text-neutral-1000">{demoDevice}</strong>
                      </span>
                      <span className="ll:text-micro ll:text-neutral-800">Use arrow keys or click</span>
                    </div>

                    <div className="ll:flex ll:items-center ll:gap-4">
                      <SegmentedControl<DeviceMode>
                        value={demoDevice}
                        onChange={setDemoDevice}
                        size="md"
                        ariaLabel="Interactive Device Preview"
                        options={[
                          {
                            value: "desktop",
                            icon: <Monitor size={16} strokeWidth={1.5} />,
                            label: "Desktop",
                          },
                          {
                            value: "tablet",
                            icon: <Tablet size={16} strokeWidth={1.5} />,
                            label: "Tablet",
                          },
                          {
                            value: "mobile",
                            icon: <Smartphone size={16} strokeWidth={1.5} />,
                            label: "Mobile",
                          },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* Sizes and Variants */}
                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800"
                  >
                    Sizes &amp; Concentric Geometry
                  </div>
                  <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-2 ll:gap-6">
                    {/* Medium (32px) */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:flex ll:flex-col ll:gap-3">
                      <span className="ll:text-small ll:font-semibold ll:text-neutral-1000">
                        Medium Size (32px Container, 28px Inner)
                      </span>
                      <SegmentedControl<DeviceMode>
                        value="desktop"
                        onChange={() => {}}
                        size="md"
                        options={[
                          { value: "desktop", label: "Desktop" },
                          { value: "tablet", label: "Tablet" },
                          { value: "mobile", label: "Mobile" },
                        ]}
                      />
                    </div>

                    {/* Small (28px) */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:flex ll:flex-col ll:gap-3">
                      <span className="ll:text-small ll:font-semibold ll:text-neutral-1000">
                        Small Size (28px Container, 24px Inner)
                      </span>
                      <SegmentedControl<DeviceMode>
                        value="desktop"
                        onChange={() => {}}
                        size="sm"
                        options={[
                          { value: "desktop", label: "Desktop" },
                          { value: "tablet", label: "Tablet" },
                          { value: "mobile", label: "Mobile" },
                        ]}
                      />
                    </div>

                    {/* Icon-Only */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:flex ll:flex-col ll:gap-3">
                      <span className="ll:text-small ll:font-semibold ll:text-neutral-1000">
                        Icon-Only Mode (Below sm Viewport)
                      </span>
                      <SegmentedControl<DeviceMode>
                        value="desktop"
                        onChange={() => {}}
                        size="md"
                        options={[
                          { value: "desktop", icon: <Monitor size={16} strokeWidth={1.5} />, ariaLabel: "Desktop" },
                          { value: "tablet", icon: <Tablet size={16} strokeWidth={1.5} />, ariaLabel: "Tablet" },
                          { value: "mobile", icon: <Smartphone size={16} strokeWidth={1.5} />, ariaLabel: "Mobile" },
                        ]}
                      />
                    </div>

                    {/* Disabled State */}
                    <div className="ll:p-4 ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:flex ll:flex-col ll:gap-3">
                      <span className="ll:text-small ll:font-semibold ll:text-neutral-1000">
                        Disabled State
                      </span>
                      <SegmentedControl<DeviceMode>
                        value="desktop"
                        onChange={() => {}}
                        size="md"
                        disabled
                        options={[
                          { value: "desktop", label: "Desktop" },
                          { value: "tablet", label: "Tablet" },
                          { value: "mobile", label: "Mobile" },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TOOLTIP COMPONENT */}
            {activeSection === "tooltip" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-neutral-1000 ll:font-sans">
                    Tooltip
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                    Solid Black Rectangle, White Micro Text, 4px Radius, 300ms Delay
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800"
                  >
                    Interactive Hover &amp; Keyboard Focus
                  </div>
                  <div className="ll:p-8 ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:flex ll:flex-wrap ll:items-center ll:gap-8">
                    <Tooltip content="Undo last change (Ctrl+Z)">
                      <Button variant="secondary" size="md" iconOnly aria-label="Undo action">
                        <Undo2 size={16} strokeWidth={1.5} />
                      </Button>
                    </Tooltip>

                    <Tooltip content="Redo action (Ctrl+Shift+Z)">
                      <Button variant="secondary" size="md" iconOnly aria-label="Redo action">
                        <Redo2 size={16} strokeWidth={1.5} />
                      </Button>
                    </Tooltip>

                    <Tooltip content="Search commands &amp; actions (Ctrl+K)">
                      <Button variant="secondary" size="md" iconOnly aria-label="Search actions">
                        <Search size={16} strokeWidth={1.5} />
                      </Button>
                    </Tooltip>

                    <Tooltip content="Configure project settings">
                      <Button variant="secondary" size="md" iconOnly aria-label="Settings">
                        <Settings size={16} strokeWidth={1.5} />
                      </Button>
                    </Tooltip>

                    <Tooltip content="Primary black action button">
                      <Button variant="primary" size="md">
                        Hover Me
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800"
                  >
                    Static Visual Geometry
                  </div>
                  <div className="ll:p-8 ll:rounded-md ll:border ll:border-border ll:bg-neutral-50 ll:flex ll:items-center ll:justify-center">
                    <div className="ll:flex ll:flex-col ll:items-center ll:gap-2">
                      {/* Visible Tooltip Specimen */}
                      <div className="ll:px-2 ll:py-1 ll:bg-neutral-1000 ll:text-neutral-0 ll:rounded-sm ll:text-micro ll:font-medium ll:whitespace-nowrap ll:shadow-soft">
                        Tooltip: 4px radius, white micro text
                      </div>
                      <div className="ll:h-8 ll:px-3 ll:rounded-md ll:bg-neutral-0 ll:border ll:border-border ll:text-small ll:font-medium ll:text-neutral-1000 ll:flex ll:items-center ll:justify-center">
                        Target Control
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TOP BAR COMPONENT */}
            {activeSection === "top-bar" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-neutral-1000 ll:font-sans">
                    TopBar
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                    Master Shell Top Bar Specification &amp; Three Width Previews
                  </span>
                </div>

                {/* Desktop Preview (1440px) */}
                <div className="ll:flex ll:flex-col ll:gap-2">
                  <div className="ll:flex ll:items-center ll:justify-between">
                    <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                      Desktop Viewport Preview (1440px)
                    </span>
                    <span className="ll:font-mono ll:text-micro ll:text-neutral-800">1440 &times; 48</span>
                  </div>
                  <div className="ll:w-full ll:overflow-x-auto ll:rounded-md ll:border ll:border-border ll:shadow-soft">
                    <div className="ll:w-[1440px]">
                      <TopBar
                        projectName="Visual Web App"
                        deviceMode={topBarDevice}
                        onSelectDeviceMode={setTopBarDevice}
                        canUndo={true}
                        canRedo={false}
                      />
                    </div>
                  </div>
                </div>

                {/* Tablet Preview (1024px) */}
                <div className="ll:flex ll:flex-col ll:gap-2">
                  <div className="ll:flex ll:items-center ll:justify-between">
                    <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                      Tablet Viewport Preview (1024px)
                    </span>
                    <span className="ll:font-mono ll:text-micro ll:text-neutral-800">1024 &times; 48</span>
                  </div>
                  <div className="ll:w-full ll:overflow-x-auto ll:rounded-md ll:border ll:border-border ll:shadow-soft">
                    <div className="ll:w-[1024px]">
                      <TopBar
                        projectName="Visual Web App"
                        deviceMode={topBarDevice}
                        onSelectDeviceMode={setTopBarDevice}
                        canUndo={true}
                        canRedo={false}
                      />
                    </div>
                  </div>
                </div>

                {/* Mobile Preview (390px) */}
                <div className="ll:flex ll:flex-col ll:gap-2">
                  <div className="ll:flex ll:items-center ll:justify-between">
                    <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                      Mobile Viewport Preview (390px — Compact, No Overflow)
                    </span>
                    <span className="ll:font-mono ll:text-micro ll:text-neutral-800">390 &times; 48</span>
                  </div>
                  <div className="ll:w-[390px] ll:max-w-full ll:rounded-md ll:border ll:border-border ll:shadow-soft ll:overflow-hidden">
                    <TopBar
                      compact={true}
                      projectName="Visual Web App"
                      deviceMode={topBarDevice}
                      onSelectDeviceMode={setTopBarDevice}
                      canUndo={true}
                      canRedo={false}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "swatch" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-neutral-1000 ll:font-sans">
                    Swatch
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                    Component Specification &amp; Variants
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800"
                  >
                    Component Variants
                  </div>
                  <div className="ll:grid ll:grid-cols-1 ll:sm:grid-cols-3 ll:gap-6">
                    <Swatch
                      role="Surface Swatch"
                      token="--ll-neutral-100"
                      hex="#DFDFDF"
                      bgClass="ll:bg-neutral-100"
                    />
                    <Swatch
                      role="Text Sample Variant"
                      token="--ll-neutral-800"
                      hex="#464646"
                      sample={
                        <div className="ll:w-full ll:h-full ll:bg-neutral-200 ll:p-4 ll:flex ll:items-center ll:justify-center">
                          <span className="ll:text-small ll:font-medium ll:text-neutral-800">
                            Sample on neutral-200
                          </span>
                        </div>
                      }
                    />
                    <Swatch
                      role="Line Sample Variant"
                      token="--ll-border-color"
                      hex="rgba(143, 143, 143, 0.5)"
                      sample={
                        <div className="ll:w-full ll:h-full ll:bg-neutral-100 ll:p-4 ll:flex ll:flex-col ll:items-center ll:justify-center ll:gap-2">
                          <div className="ll:w-full ll:h-px ll:bg-border" />
                          <span className="ll:text-micro ll:text-neutral-800">
                            1px Hairline
                          </span>
                          <div className="ll:w-full ll:h-px ll:bg-border" />
                        </div>
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "workspace-frame" && (
              <div className="ll:flex ll:flex-col ll:gap-8">
                <div>
                  <h1 className="ll:text-title ll:font-semibold ll:text-neutral-1000 ll:font-sans">
                    WorkspaceFrame
                  </h1>
                  <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800">
                    Component Specification &amp; Real Layers
                  </span>
                </div>

                <div className="ll:flex ll:flex-col ll:gap-4">
                  <div
                    role="heading"
                    aria-level={2}
                    className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-neutral-800"
                  >
                    Interactive Studio Workspace Frame
                  </div>
                  <WorkspaceFrame />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
