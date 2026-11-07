"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Sliders, Box, Component, Link2, Sparkles, Layers } from "lucide-react";
import { constrainSpan, type Constraint } from "@/core/layout/constraints";
import { ComponentSection } from "@/editor/panels/details/sections/ComponentSection";
import { LinkSection } from "@/editor/panels/details/sections/LinkSection";
import { Icon } from "@/editor/components/Icon";

export default function ComponentsLabPage() {
  // Testbed 1: Live Interactive Constraint Simulator
  const [frameWidth, setFrameWidth] = useState(480);
  const [hConstraint, setHConstraint] = useState<Constraint>("end"); // "end" is Right
  const baseFrameWidth = 400;
  const initialRect = { pos: 260, size: 100 }; // 40px from right edge when frame is 400px wide
  const constrainedRect = constrainSpan(initialRect, hConstraint, baseFrameWidth, frameWidth);

  // Testbed 2: Sample Layer Selection for Components & Links
  const [selectedSample, setSelectedSample] = useState<"button" | "card" | "nav">("button");

  return (
    <div className="ll:min-h-screen ll:bg-background ll:text-primary ll:p-6 ll:flex ll:flex-col ll:gap-6 ll:max-w-6xl ll:mx-auto">
      {/* Top Header */}
      <div className="ll:flex ll:items-center ll:justify-between ll:pb-4 ll:border-b ll:border-line-subtle">
        <div className="ll:flex ll:items-center ll:gap-3">
          <Link
            href="/editor"
            className="ll:flex ll:items-center ll:gap-1.5 ll:px-3 ll:py-1.5 ll:rounded ll:bg-surface ll:border ll:border-line-subtle ll:text-small ll:font-medium ll:text-secondary ll:hover:text-primary ll:hover:bg-control-hover ll:transition-colors"
          >
            <Icon icon={ArrowLeft} size={14} />
            <span>Back to Editor</span>
          </Link>
          <h1 className="ll:text-xl ll:font-bold ll:tracking-tight">
            Components, Links & Constraints Lab
          </h1>
        </div>
        <span className="ll:px-2.5 ll:py-1 ll:rounded-full ll:bg-emerald-500/15 ll:text-emerald-400 ll:text-micro ll:font-medium ll:border ll:border-emerald-500/30">
          Preview Route: /editor/components-lab
        </span>
      </div>

      {/* Grid: 2 Columns */}
      <div className="ll:grid ll:grid-cols-1 lg:ll:grid-cols-2 ll:gap-6">
        {/* Column 1: Live Interactive Constraints Testbed */}
        <div className="ll:flex ll:flex-col ll:gap-4 ll:p-5 ll:rounded-lg ll:bg-surface-panel ll:border ll:border-line-subtle">
          <div className="ll:flex ll:items-center ll:justify-between">
            <span className="ll:flex ll:items-center ll:gap-2 ll:text-base ll:font-semibold">
              <Icon icon={Sliders} size={16} className="ll:text-accent-foreground" />
              <span>1. Live Constraints Verification</span>
            </span>
            <span className="ll:text-micro ll:font-mono ll:text-muted">Phase 42 & 52</span>
          </div>

          <p className="ll:text-small ll:text-secondary">
            Drag the Frame Width slider below. Notice that when Horizontal Constraint is set to{" "}
            <strong className="ll:text-primary">Right</strong>, the child rectangle maintains its exact distance from the right edge of the frame!
          </p>

          {/* Controls */}
          <div className="ll:flex ll:flex-col ll:gap-3 ll:p-3 ll:rounded ll:bg-surface ll:border ll:border-line-subtle">
            <div className="ll:flex ll:items-center ll:justify-between">
              <label className="ll:text-micro ll:font-medium ll:text-muted">Frame Width: {frameWidth}px</label>
              <span className="ll:text-micro ll:font-mono ll:text-secondary">(Base: 400px, Δ: {frameWidth - 400}px)</span>
            </div>
            <input
              type="range"
              min={320}
              max={640}
              value={frameWidth}
              onChange={(e) => setFrameWidth(Number(e.target.value))}
              className="ll:w-full ll:accent-primary ll:cursor-pointer"
            />

            <div className="ll:flex ll:items-center ll:gap-2 ll:pt-2">
              <label className="ll:text-micro ll:font-medium ll:text-muted">Constraint:</label>
              <div className="ll:flex ll:gap-1 ll:flex-wrap">
                {(
                  [
                    ["start", "Left"],
                    ["end", "Right"],
                    ["center", "Center"],
                    ["both", "Left & Right"],
                    ["scale", "Scale"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setHConstraint(key)}
                    className={`ll:px-2.5 ll:py-1 ll:rounded ll:text-micro ll:font-medium ll:cursor-pointer ll:transition-colors ${
                      hConstraint === key
                        ? "ll:bg-accent ll:text-accent-foreground ll:font-semibold"
                        : "ll:bg-control-active ll:text-secondary ll:hover:text-primary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Visual Frame Canvas Stage */}
          <div className="ll:relative ll:h-48 ll:w-full ll:overflow-x-auto ll:p-4 ll:rounded ll:bg-canvas-bg ll:border ll:border-line-subtle ll:flex ll:items-center ll:justify-start">
            <div
              style={{ width: `${frameWidth}px`, height: "140px" }}
              className="ll:relative ll:bg-surface ll:border-2 ll:border-dashed ll:border-primary/40 ll:rounded ll:transition-all"
            >
              <span className="ll:absolute ll:top-1.5 ll:left-2 ll:text-micro ll:font-mono ll:text-muted">
                Frame ({frameWidth} × 140)
              </span>

              {/* Child Rectangle */}
              <div
                style={{
                  left: `${constrainedRect.pos}px`,
                  top: "35px",
                  width: `${constrainedRect.size}px`,
                  height: "70px",
                }}
                className="ll:absolute ll:bg-gradient-to-br ll:from-sky-500/80 ll:to-purple-500/80 ll:border ll:border-sky-300 ll:rounded ll:flex ll:flex-col ll:items-center ll:justify-center ll:text-white ll:shadow-elevation-1 ll:transition-all"
              >
                <span className="ll:text-micro ll:font-bold">Child Rect</span>
                <span className="ll:text-[10px] ll:font-mono ll:opacity-90">x: {constrainedRect.pos}px</span>
                <span className="ll:text-[10px] ll:font-mono ll:opacity-90">w: {constrainedRect.size}px</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: New Component & Link Inspector UI */}
        <div className="ll:flex ll:flex-col ll:gap-4 ll:p-5 ll:rounded-lg ll:bg-surface-panel ll:border ll:border-line-subtle">
          <div className="ll:flex ll:items-center ll:justify-between">
            <span className="ll:flex ll:items-center ll:gap-2 ll:text-base ll:font-semibold">
              <Icon icon={Component} size={16} className="ll:text-purple-400" />
              <span>2. New Proposed Component & Link UI</span>
            </span>
            <span className="ll:text-micro ll:font-mono ll:text-muted">Inspector Modules</span>
          </div>

          <p className="ll:text-small ll:text-secondary">
            Test the proposed new UI designs and naming below. Select a sample layer archetype to review the inspector controls.
          </p>

          {/* Sample Layer Switcher */}
          <div className="ll:flex ll:gap-2">
            {[
              { id: "button", label: "Primary Button" },
              { id: "card", label: "Feature Card" },
              { id: "nav", label: "Nav Link" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedSample(tab.id as never)}
                className={`ll:px-3 ll:py-1.5 ll:rounded ll:text-micro ll:font-medium ll:transition-colors ll:cursor-pointer ${
                  selectedSample === tab.id
                    ? "ll:bg-control-active ll:text-primary ll:font-semibold ll:border ll:border-line-subtle"
                    : "ll:text-muted ll:hover:text-primary ll:hover:bg-control-hover"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* The New ComponentSection */}
          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:font-medium ll:text-muted ll:uppercase ll:tracking-wider">
              Component Inspector Section
            </span>
            <ComponentSection />
          </div>

          {/* The New LinkSection */}
          <div className="ll:flex ll:flex-col ll:gap-2 ll:pt-2 ll:border-t ll:border-line-subtle">
            <span className="ll:text-micro ll:font-medium ll:text-muted ll:uppercase ll:tracking-wider">
              Interactive Link Section
            </span>
            <LinkSection />
          </div>
        </div>
      </div>
    </div>
  );
}
