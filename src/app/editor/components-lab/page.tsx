"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sliders,
  Component,
  Link2,
  Sparkles,
  Layers,
  Copy,
  ExternalLink,
  ChevronRight,
  Info,
  CheckCircle,
  Play,
  RotateCcw,
  Workflow,
  Eye,
} from "lucide-react";
import { constrainSpan, type Constraint } from "@/core/layout/constraints";
import { ComponentSection } from "@/editor/panels/details/sections/ComponentSection";
import { LinkSection } from "@/editor/panels/details/sections/LinkSection";
import { Icon } from "@/editor/components/Icon";

export default function ComponentsLabPage() {
  // Testbed 1: Interactive Constraint Simulator
  const [frameWidth, setFrameWidth] = useState(480);
  const [hConstraint, setHConstraint] = useState<Constraint>("end"); // "end" is Right
  const baseFrameWidth = 400;
  const initialRect = { pos: 260, size: 100 }; // 40px margin from right edge in 400px frame
  const constrainedRect = constrainSpan(initialRect, hConstraint, baseFrameWidth, frameWidth);

  // Testbed 2: Interactive Master Component & Variant Playground
  const [variantHierarchy, setVariantHierarchy] = useState<"primary" | "secondary" | "outline" | "ghost">("primary");
  const [variantSize, setVariantSize] = useState<"sm" | "md" | "lg">("md");
  const [variantDisabled, setVariantDisabled] = useState(false);
  const [variantHasIcon, setVariantHasIcon] = useState(true);

  // Testbed 3: Interactive Link & Navigation Playground
  const [linkTarget, setLinkTarget] = useState<"page" | "anchor" | "url">("page");
  const [selectedPage, setSelectedPage] = useState("Pricing");
  const [selectedAnchor, setSelectedAnchor] = useState("#features");
  const [customUrl, setCustomUrl] = useState("https://lazylayouts.com/docs");
  const [newTab, setNewTab] = useState(false);
  const [lastNavigationLog, setLastNavigationLog] = useState<string | null>(null);

  // Active Tab in Lab
  const [activeTab, setActiveTab] = useState<"overview" | "components" | "links" | "constraints">("overview");

  const handleTestLinkClick = () => {
    if (linkTarget === "page") {
      setLastNavigationLog(`[Router Action] Navigate to route: /${selectedPage.toLowerCase()}`);
    } else if (linkTarget === "anchor") {
      setLastNavigationLog(`[Scroll Action] Smooth scroll to element: ${selectedAnchor}`);
    } else {
      setLastNavigationLog(`[External Link] Open URL: ${customUrl} (${newTab ? "New Tab: target='_blank'" : "Same Window"})`);
    }
  };

  return (
    <div className="ll:min-h-screen ll:bg-background ll:text-primary ll:flex ll:flex-col">
      {/* Top Navigation Bar */}
      <header className="ll:sticky ll:top-0 ll:z-30 ll:h-14 ll:bg-surface-bar/95 ll:backdrop-blur-md ll:border-b ll:border-border ll:px-6 ll:flex ll:items-center ll:justify-between">
        <div className="ll:flex ll:items-center ll:gap-4">
          <Link
            href="/editor"
            className="ll:flex ll:items-center ll:gap-2 ll:px-3 ll:py-1.5 ll:rounded-sm ll:bg-surface ll:border ll:border-border ll:text-small ll:font-medium ll:text-secondary ll:hover:text-primary ll:hover:bg-control-active ll:transition-colors"
          >
            <Icon icon={ArrowLeft} size={14} />
            <span>Return to Editor</span>
          </Link>
          <div className="ll:h-4 ll:w-[1px] ll:bg-border" />
          <div className="ll:flex ll:items-center ll:gap-2">
            <span className="ll:w-2 ll:h-2 ll:rounded-full ll:bg-accent" />
            <span className="ll:text-small ll:font-semibold ll:tracking-tight ll:text-primary">
              LazyLayouts Design System & Prototyping Lab
            </span>
          </div>
        </div>

        <div className="ll:flex ll:items-center ll:gap-2">
          <span className="ll:px-2.5 ll:py-1 ll:rounded-full ll:bg-accent/15 ll:text-accent-foreground ll:text-micro ll:font-medium ll:border ll:border-accent/30">
            Route: /editor/components-lab
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="ll:flex-1 ll:max-w-6xl ll:w-full ll:mx-auto ll:p-6 ll:flex ll:flex-col ll:gap-6">
        {/* Executive Summary Hero Banner */}
        <section className="ll:p-6 ll:rounded-md ll:bg-surface-panel ll:border ll:border-border ll:flex ll:flex-col ll:gap-4 ll:shadow-elevation-1">
          <div className="ll:flex ll:items-start ll:justify-between ll:gap-4">
            <div className="ll:flex ll:flex-col ll:gap-1.5">
              <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-widest ll:text-accent">
                Architecture & Workflow Guide
              </span>
              <h2 className="ll:text-xl ll:font-bold ll:tracking-tight">
                Why We Introduced Components, Variants & Links
              </h2>
            </div>
            <div className="ll:flex ll:items-center ll:gap-1.5 ll:bg-surface ll:p-1 ll:rounded-sm ll:border ll:border-border">
              {(
                [
                  ["overview", "Overview"],
                  ["components", "Components & Variants"],
                  ["links", "Interactive Links"],
                  ["constraints", "Constraints"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`ll:px-3 ll:py-1 ll:rounded-sm ll:text-micro ll:font-medium ll:cursor-pointer ll:transition-colors ${
                    activeTab === key
                      ? "ll:bg-control-active ll:text-primary ll:font-semibold ll:shadow-sm"
                      : "ll:text-muted ll:hover:text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="ll:text-small ll:text-secondary ll:leading-relaxed">
            In modern design and frontend development, designing each screen from isolated static rectangles causes
            maintainability issues and UI inconsistencies. This lab showcases four interconnected systems built to
            transform LazyLayouts from a simple canvas into a true component-driven UI builder.
          </p>

          {/* 4 Pillars Summary Grid */}
          <div className="ll:grid ll:grid-cols-1 md:ll:grid-cols-2 lg:ll:grid-cols-4 ll:gap-3 ll:pt-2">
            <div className="ll:p-3.5 ll:rounded-sm ll:bg-surface ll:border ll:border-border ll:flex ll:flex-col ll:gap-1.5">
              <div className="ll:flex ll:items-center ll:gap-2 ll:text-primary ll:font-semibold ll:text-small">
                <Icon icon={Component} size={15} className="ll:text-accent" />
                <span>Master Components</span>
              </div>
              <p className="ll:text-micro ll:text-muted ll:leading-normal">
                Define a UI pattern once. Reuse instances across multiple pages. Updates to the master propagate automatically, while local text/image overrides are preserved.
              </p>
            </div>

            <div className="ll:p-3.5 ll:rounded-sm ll:bg-surface ll:border ll:border-border ll:flex ll:flex-col ll:gap-1.5">
              <div className="ll:flex ll:items-center ll:gap-2 ll:text-primary ll:font-semibold ll:text-small">
                <Icon icon={Workflow} size={15} className="ll:text-emerald-500" />
                <span>Multi-Axis Variants</span>
              </div>
              <p className="ll:text-micro ll:text-muted ll:leading-normal">
                Combine states and styles (e.g. Size: sm/md/lg, Variant: primary/outline) inside a single component instead of maintaining separate disconnected shapes.
              </p>
            </div>

            <div className="ll:p-3.5 ll:rounded-sm ll:bg-surface ll:border ll:border-border ll:flex ll:flex-col ll:gap-1.5">
              <div className="ll:flex ll:items-center ll:gap-2 ll:text-primary ll:font-semibold ll:text-small">
                <Icon icon={Link2} size={15} className="ll:text-indigo-400" />
                <span>Prototyping Links</span>
              </div>
              <p className="ll:text-micro ll:text-muted ll:leading-normal">
                Wire interactive buttons and cards to page navigation, section smooth scrolling, or external URLs that function in Preview Mode and code export.
              </p>
            </div>

            <div className="ll:p-3.5 ll:rounded-sm ll:bg-surface ll:border ll:border-border ll:flex ll:flex-col ll:gap-1.5">
              <div className="ll:flex ll:items-center ll:gap-2 ll:text-primary ll:font-semibold ll:text-small">
                <Icon icon={Sliders} size={15} className="ll:text-amber-500" />
                <span>Responsive Constraints</span>
              </div>
              <p className="ll:text-micro ll:text-muted ll:leading-normal">
                Pin elements to edges (Left, Right, Center, Stretch, Scale) so they maintain intended margins when parent frames resize across device viewports.
              </p>
            </div>
          </div>
        </section>

        {/* Dynamic Section: Master Components & Variants */}
        {(activeTab === "overview" || activeTab === "components") && (
          <section className="ll:p-6 ll:rounded-md ll:bg-surface-panel ll:border ll:border-border ll:flex ll:flex-col ll:gap-5">
            <div className="ll:flex ll:items-center ll:justify-between">
              <div className="ll:flex ll:items-center ll:gap-2">
                <Icon icon={Component} size={18} className="ll:text-accent" />
                <h3 className="ll:text-base ll:font-bold">1. Master Components & Multi-Axis Variants</h3>
              </div>
              <span className="ll:text-micro ll:font-mono ll:text-muted">Phase 46 & 52</span>
            </div>

            <div className="ll:grid ll:grid-cols-1 lg:ll:grid-cols-2 ll:gap-6">
              {/* Interactive Demo */}
              <div className="ll:flex ll:flex-col ll:gap-4 ll:p-4 ll:rounded-sm ll:bg-surface ll:border ll:border-border">
                <span className="ll:text-small ll:font-semibold">Interactive Variant Tester</span>
                <p className="ll:text-micro ll:text-muted">
                  Toggle the properties below to see the master component dynamically update its sizing, colors, and iconography:
                </p>

                {/* Variant Selectors */}
                <div className="ll:grid ll:grid-cols-2 ll:gap-3">
                  <div className="ll:flex ll:flex-col ll:gap-1">
                    <label className="ll:text-micro ll:font-medium ll:text-secondary">Hierarchy:</label>
                    <div className="ll:flex ll:gap-1">
                      {(["primary", "secondary", "outline", "ghost"] as const).map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setVariantHierarchy(h)}
                          className={`ll:px-2 ll:py-1 ll:rounded-sm ll:text-micro ll:capitalize ll:cursor-pointer ll:transition-colors ${
                            variantHierarchy === h ? "ll:bg-accent ll:text-accent-foreground ll:font-semibold" : "ll:bg-control-active ll:text-secondary ll:hover:text-primary"
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="ll:flex ll:flex-col ll:gap-1">
                    <label className="ll:text-micro ll:font-medium ll:text-secondary">Size:</label>
                    <div className="ll:flex ll:gap-1">
                      {(["sm", "md", "lg"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setVariantSize(s)}
                          className={`ll:px-2.5 ll:py-1 ll:rounded-sm ll:text-micro ll:uppercase ll:cursor-pointer ll:transition-colors ${
                            variantSize === s ? "ll:bg-accent ll:text-accent-foreground ll:font-semibold" : "ll:bg-control-active ll:text-secondary ll:hover:text-primary"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="ll:flex ll:items-center ll:gap-4 ll:pt-1">
                  <label className="ll:flex ll:items-center ll:gap-1.5 ll:text-micro ll:cursor-pointer">
                    <input
                      type="checkbox"
                      checked={variantHasIcon}
                      onChange={(e) => setVariantHasIcon(e.target.checked)}
                      className="ll:rounded ll:accent-primary"
                    />
                    <span>Include Icon</span>
                  </label>
                  <label className="ll:flex ll:items-center ll:gap-1.5 ll:text-micro ll:cursor-pointer">
                    <input
                      type="checkbox"
                      checked={variantDisabled}
                      onChange={(e) => setVariantDisabled(e.target.checked)}
                      className="ll:rounded ll:accent-primary"
                    />
                    <span>Disabled State</span>
                  </label>
                </div>

                {/* Rendered Preview */}
                <div className="ll:h-28 ll:bg-canvas-bg ll:rounded-sm ll:border ll:border-border ll:flex ll:items-center ll:justify-center">
                  <button
                    type="button"
                    disabled={variantDisabled}
                    className={`ll:flex ll:items-center ll:gap-2 ll:rounded-sm ll:font-medium ll:transition-all ${
                      variantSize === "sm"
                        ? "ll:h-8 ll:px-3 ll:text-xs"
                        : variantSize === "md"
                        ? "ll:h-10 ll:px-4 ll:text-small"
                        : "ll:h-12 ll:px-6 ll:text-base"
                    } ${
                      variantHierarchy === "primary"
                        ? "ll:bg-primary ll:text-primary-foreground ll:hover:opacity-90"
                        : variantHierarchy === "secondary"
                        ? "ll:bg-control-active ll:text-primary ll:hover:bg-control-hover"
                        : variantHierarchy === "outline"
                        ? "ll:border ll:border-border ll:bg-transparent ll:text-primary ll:hover:bg-control-active"
                        : "ll:bg-transparent ll:text-secondary ll:hover:text-primary ll:hover:bg-control-active"
                    } ${variantDisabled ? "ll:opacity-40 ll:cursor-not-allowed" : "ll:cursor-pointer"}`}
                  >
                    {variantHasIcon && <Icon icon={Sparkles} size={variantSize === "sm" ? 12 : 14} />}
                    <span>Get Started</span>
                  </button>
                </div>

                {/* Export Code Readout */}
                <div className="ll:p-2.5 ll:rounded-sm ll:bg-surface-panel ll:border ll:border-border ll:font-mono ll:text-micro ll:text-secondary">
                  <code>{`<Button variant="${variantHierarchy}" size="${variantSize}"${variantDisabled ? " disabled" : ""}>Get Started</Button>`}</code>
                </div>
              </div>

              {/* Inspector Preview */}
              <div className="ll:flex ll:flex-col ll:gap-3 ll:p-4 ll:rounded-sm ll:bg-surface ll:border ll:border-border">
                <span className="ll:text-small ll:font-semibold">Inspector Panel Representation</span>
                <p className="ll:text-micro ll:text-muted">
                  How this appears inside the right details inspector when a component is selected:
                </p>
                <div className="ll:p-3 ll:rounded-sm ll:bg-surface-panel ll:border ll:border-border">
                  <ComponentSection />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Dynamic Section: Interactive Prototyping Links */}
        {(activeTab === "overview" || activeTab === "links") && (
          <section className="ll:p-6 ll:rounded-md ll:bg-surface-panel ll:border ll:border-border ll:flex ll:flex-col ll:gap-5">
            <div className="ll:flex ll:items-center ll:justify-between">
              <div className="ll:flex ll:items-center ll:gap-2">
                <Icon icon={Link2} size={18} className="ll:text-indigo-400" />
                <h3 className="ll:text-base ll:font-bold">2. Interactive Prototyping Links</h3>
              </div>
              <span className="ll:text-micro ll:font-mono ll:text-muted">Phase 47 & 52</span>
            </div>

            <div className="ll:grid ll:grid-cols-1 lg:ll:grid-cols-2 ll:gap-6">
              {/* Interactive Tester */}
              <div className="ll:flex ll:flex-col ll:gap-4 ll:p-4 ll:rounded-sm ll:bg-surface ll:border ll:border-border">
                <span className="ll:text-small ll:font-semibold">Link Configuration Playground</span>
                <p className="ll:text-micro ll:text-muted">
                  Configure a destination link, then click the button below to test the resulting client action:
                </p>

                {/* Link Type Selector */}
                <div className="ll:flex ll:items-center ll:gap-2">
                  <label className="ll:text-micro ll:font-medium ll:text-secondary">Destination Type:</label>
                  <div className="ll:flex ll:gap-1">
                    {(
                      [
                        ["page", "Page Route"],
                        ["anchor", "Section Anchor"],
                        ["url", "External URL"],
                      ] as const
                    ).map(([t, label]) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setLinkTarget(t)}
                        className={`ll:px-2.5 ll:py-1 ll:rounded-sm ll:text-micro ll:cursor-pointer ll:transition-colors ${
                          linkTarget === t ? "ll:bg-accent ll:text-accent-foreground ll:font-semibold" : "ll:bg-control-active ll:text-secondary ll:hover:text-primary"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-inputs */}
                {linkTarget === "page" && (
                  <div className="ll:flex ll:items-center ll:gap-2">
                    <label className="ll:text-micro ll:font-medium ll:text-muted ll:w-20">Target Page:</label>
                    <select
                      value={selectedPage}
                      onChange={(e) => setSelectedPage(e.target.value)}
                      className="ll:flex-1 ll:h-8 ll:px-2 ll:rounded-sm ll:bg-surface-panel ll:border ll:border-border ll:text-small ll:text-primary ll:outline-none"
                    >
                      <option value="Home">Home (root)</option>
                      <option value="Pricing">Pricing (/pricing)</option>
                      <option value="Features">Features (/features)</option>
                      <option value="Docs">Docs (/docs)</option>
                    </select>
                  </div>
                )}

                {linkTarget === "anchor" && (
                  <div className="ll:flex ll:items-center ll:gap-2">
                    <label className="ll:text-micro ll:font-medium ll:text-muted ll:w-20">Anchor ID:</label>
                    <input
                      type="text"
                      value={selectedAnchor}
                      onChange={(e) => setSelectedAnchor(e.target.value)}
                      className="ll:flex-1 ll:h-8 ll:px-2 ll:rounded-sm ll:bg-surface-panel ll:border ll:border-border ll:text-small ll:text-primary ll:outline-none"
                    />
                  </div>
                )}

                {linkTarget === "url" && (
                  <div className="ll:flex ll:flex-col ll:gap-2">
                    <div className="ll:flex ll:items-center ll:gap-2">
                      <label className="ll:text-micro ll:font-medium ll:text-muted ll:w-20">URL:</label>
                      <input
                        type="url"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        className="ll:flex-1 ll:h-8 ll:px-2 ll:rounded-sm ll:bg-surface-panel ll:border ll:border-border ll:text-small ll:text-primary ll:outline-none"
                      />
                    </div>
                    <label className="ll:flex ll:items-center ll:gap-1.5 ll:text-micro ll:cursor-pointer ll:pl-20">
                      <input
                        type="checkbox"
                        checked={newTab}
                        onChange={(e) => setNewTab(e.target.checked)}
                        className="ll:rounded ll:accent-primary"
                      />
                      <span>Open in new browser tab</span>
                    </label>
                  </div>
                )}

                {/* Test Action Button */}
                <div className="ll:pt-2 ll:flex ll:items-center ll:gap-3">
                  <button
                    type="button"
                    onClick={handleTestLinkClick}
                    className="ll:flex ll:items-center ll:gap-1.5 ll:h-8 ll:px-3 ll:rounded-sm ll:bg-accent ll:text-accent-foreground ll:text-small ll:font-medium ll:hover:opacity-90 ll:transition-opacity ll:cursor-pointer"
                  >
                    <Icon icon={Play} size={13} />
                    <span>Test Interaction</span>
                  </button>
                  {lastNavigationLog && (
                    <span className="ll:text-micro ll:font-mono ll:text-emerald-400 ll:truncate">
                      {lastNavigationLog}
                    </span>
                  )}
                </div>
              </div>

              {/* Inspector Preview */}
              <div className="ll:flex ll:flex-col ll:gap-3 ll:p-4 ll:rounded-sm ll:bg-surface ll:border ll:border-border">
                <span className="ll:text-small ll:font-semibold">Inspector Link Module Representation</span>
                <p className="ll:text-micro ll:text-muted">
                  How this appears inside the right details inspector when configuring a link:
                </p>
                <div className="ll:p-3 ll:rounded-sm ll:bg-surface-panel ll:border ll:border-border">
                  <LinkSection />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Dynamic Section: Responsive Constraints Verification */}
        {(activeTab === "overview" || activeTab === "constraints") && (
          <section className="ll:p-6 ll:rounded-md ll:bg-surface-panel ll:border ll:border-border ll:flex ll:flex-col ll:gap-5">
            <div className="ll:flex ll:items-center ll:justify-between">
              <div className="ll:flex ll:items-center ll:gap-2">
                <Icon icon={Sliders} size={18} className="ll:text-amber-500" />
                <h3 className="ll:text-base ll:font-bold">3. Responsive Constraints Verification Simulator</h3>
              </div>
              <span className="ll:text-micro ll:font-mono ll:text-muted">Phase 42 & 52 Engine</span>
            </div>

            <p className="ll:text-small ll:text-secondary">
              Drag the Frame Width slider to resize the parent frame. When the Horizontal Constraint is set to{" "}
              <strong className="ll:text-primary">Right (end)</strong>, the child rectangle calculates its position relative to the moving right edge, maintaining a constant right margin!
            </p>

            <div className="ll:flex ll:flex-col ll:gap-4 ll:p-4 ll:rounded-sm ll:bg-surface ll:border ll:border-border">
              {/* Slider Control */}
              <div className="ll:flex ll:items-center ll:justify-between">
                <div className="ll:flex ll:items-center ll:gap-2">
                  <label className="ll:text-small ll:font-semibold">Parent Frame Width:</label>
                  <span className="ll:text-small ll:font-mono ll:text-accent ll:font-bold">{frameWidth}px</span>
                </div>
                <span className="ll:text-micro ll:font-mono ll:text-muted">
                  (Base: 400px, Resize delta: {frameWidth - baseFrameWidth >= 0 ? `+${frameWidth - baseFrameWidth}` : frameWidth - baseFrameWidth}px)
                </span>
              </div>
              <input
                type="range"
                min={320}
                max={680}
                value={frameWidth}
                onChange={(e) => setFrameWidth(Number(e.target.value))}
                className="ll:w-full ll:accent-primary ll:cursor-pointer"
              />

              {/* Constraint Selector */}
              <div className="ll:flex ll:items-center ll:gap-3 ll:pt-1">
                <label className="ll:text-micro ll:font-medium ll:text-secondary">Active Constraint:</label>
                <div className="ll:flex ll:gap-1.5 ll:flex-wrap">
                  {(
                    [
                      ["start", "Left (Start)"],
                      ["end", "Right (End)"],
                      ["center", "Center"],
                      ["both", "Left & Right (Stretch)"],
                      ["scale", "Scale (Proportional)"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setHConstraint(key)}
                      className={`ll:px-2.5 ll:py-1 ll:rounded-sm ll:text-micro ll:cursor-pointer ll:transition-colors ${
                        hConstraint === key
                          ? "ll:bg-accent ll:text-accent-foreground ll:font-semibold shadow-sm"
                          : "ll:bg-control-active ll:text-secondary ll:hover:text-primary"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Canvas Stage */}
              <div className="ll:relative ll:h-44 ll:w-full ll:overflow-x-auto ll:p-4 ll:rounded-sm ll:bg-canvas-bg ll:border ll:border-border ll:flex ll:items-center ll:justify-start">
                <div
                  style={{ width: `${frameWidth}px`, height: "130px" }}
                  className="ll:relative ll:bg-surface ll:border-2 ll:border-dashed ll:border-accent/50 ll:rounded-sm ll:transition-all"
                >
                  <span className="ll:absolute ll:top-1.5 ll:left-2 ll:text-micro ll:font-mono ll:text-muted">
                    Frame ({frameWidth} × 130)
                  </span>

                  {/* Child Rectangle */}
                  <div
                    style={{
                      left: `${constrainedRect.pos}px`,
                      top: "30px",
                      width: `${constrainedRect.size}px`,
                      height: "70px",
                    }}
                    className="ll:absolute ll:bg-gradient-to-br ll:from-sky-500/80 ll:to-indigo-500/80 ll:border ll:border-sky-300/80 ll:rounded-sm ll:flex ll:flex-col ll:items-center ll:justify-center ll:text-white ll:shadow-elevation-1 ll:transition-all"
                  >
                    <span className="ll:text-micro ll:font-bold">Child Rect</span>
                    <span className="ll:text-[10px] ll:font-mono ll:opacity-90">left: {constrainedRect.pos}px</span>
                    <span className="ll:text-[10px] ll:font-mono ll:opacity-90">width: {constrainedRect.size}px</span>
                    <span className="ll:text-[10px] ll:font-mono ll:opacity-80">
                      right margin: {frameWidth - (constrainedRect.pos + constrainedRect.size)}px
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
