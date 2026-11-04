"use client";

import React, { useState } from "react";
import { Sliders, Frame, FileCode, Sun } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { KeyframeInspector } from "./KeyframeInspector";
import { CodeInspector } from "@/editor/panels/code-view/CodeInspector";

const THEME_OPTIONS = [
  { value: "paper", label: "Paper" },
  { value: "dark", label: "Dark" },
  { value: "white", label: "White" },
  { value: "warm", label: "Warm" },
  { value: "lilac", label: "Lilac" },
] as const;

const INSPECTOR_VIEW_OPTIONS = [
  { value: "all", label: "All Inspectors" },
  { value: "motion", label: "Motion (Keyframe)" },
  { value: "code", label: "Code (File & Component)" },
  { value: "responsive", label: "Responsive Views" },
] as const;

export const InspectorsLab: React.FC = () => {
  const [theme, setTheme] = useState<string>("paper");
  const [activeView, setActiveView] = useState<string>("all");

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", newTheme);
    }
  };

  return (
    <div
      data-theme={theme}
      className="ll:min-h-screen ll:w-full ll:bg-surface-backdrop ll:text-primary ll:font-sans ll:p-6 ll:flex ll:flex-col ll:gap-8 ll:box-border"
    >
      {/* Lab Header */}
      <header className="ll:flex ll:flex-wrap ll:items-center ll:justify-between ll:gap-4 ll:pb-4 ll:border-b ll:border-border">
        <div className="ll:flex ll:flex-col ll:gap-1">
          <div className="ll:flex ll:items-center ll:gap-2">
            <Icon icon={Sliders} size={20} className="ll:text-primary" />
            <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:m-0">
              Inspectors Parity Lab
            </h1>
            <span className="ll:font-mono ll:text-nano ll:text-muted ll:bg-surface-bar ll:px-2 ll:py-0.5 ll:rounded-xs ll:border ll:border-border">
              Motion & Code Mode
            </span>
          </div>
          <p className="ll:text-small ll:text-secondary ll:m-0">
            Parity verification for KeyframeInspector (#ins-key) and CodeInspector (#ins-code) matching prototype specification.
          </p>
        </div>

        {/* Theme and View Controls */}
        <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-3">
          <div className="ll:flex ll:items-center ll:gap-1.5">
            <Icon icon={Sun} size={14} className="ll:text-muted" />
            <SegmentedControl
              size="sm"
              ariaLabel="Theme selector"
              value={theme}
              onChange={handleThemeChange}
              options={THEME_OPTIONS}
            />
          </div>

          <SegmentedControl
            size="sm"
            ariaLabel="View filter"
            value={activeView}
            onChange={setActiveView}
            options={INSPECTOR_VIEW_OPTIONS}
          />
        </div>
      </header>

      {/* Side-by-side or individual views */}
      {(activeView === "all" || activeView === "motion" || activeView === "code") && (
        <div className="ll:grid ll:grid-cols-1 md:ll:grid-cols-2 ll:gap-8 ll:items-start">
          {/* 1. Motion Right Panel: KeyframeInspector */}
          {(activeView === "all" || activeView === "motion") && (
            <section className="ll:flex ll:flex-col ll:gap-3">
              <div className="ll:flex ll:items-center ll:gap-2">
                <Icon icon={Frame} size={16} className="ll:text-primary" />
                <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:m-0">
                  Motion Mode: Keyframe Inspector (#ins-key)
                </h2>
              </div>
              <p className="ll:text-small ll:text-secondary ll:m-0">
                Shows target layer/property, timing inputs (At, value O%, Dur, Delay), easing curve SVG with bezier control inputs, playback modes (Off/Loop/Bounce), and presets.
              </p>

              <div className="ll:max-w-sm ll:w-full ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:overflow-hidden ll:shadow-soft">
                <KeyframeInspector />
              </div>
            </section>
          )}

          {/* 2. Code Right Panel: CodeInspector */}
          {(activeView === "all" || activeView === "code") && (
            <section className="ll:flex ll:flex-col ll:gap-3">
              <div className="ll:flex ll:items-center ll:gap-2">
                <Icon icon={FileCode} size={16} className="ll:text-primary" />
                <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:m-0">
                  Code Mode: File & Component Inspector (#ins-code)
                </h2>
              </div>
              <p className="ll:text-small ll:text-secondary ll:m-0">
                Shows component name and export type, output target (React/HTML/Vue), styles strategy (CSS modules/Tailwind/Inline), destination file, interactive props manager, and package dependencies.
              </p>

              <div className="ll:max-w-sm ll:w-full ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:overflow-hidden ll:shadow-soft">
                <CodeInspector />
              </div>
            </section>
          )}
        </div>
      )}

      {/* 3. Responsive Containers */}
      {(activeView === "all" || activeView === "responsive") && (
        <section className="ll:flex ll:flex-col ll:gap-6 ll:pt-6 ll:border-t ll:border-border">
          <div className="ll:flex ll:items-center ll:gap-2">
            <Icon icon={Sliders} size={16} className="ll:text-primary" />
            <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:m-0">
              Responsive Container Verification
            </h2>
          </div>

          <div className="ll:flex ll:flex-wrap ll:gap-8 ll:items-start">
            {/* Desktop 320px width (standard right panel width) */}
            <div className="ll:flex ll:flex-col ll:gap-1.5">
              <span className="ll:font-mono ll:text-nano ll:text-muted ll:uppercase">
                Desktop Standard Panel (320px)
              </span>
              <div className="ll:w-80 ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:overflow-hidden">
                <KeyframeInspector />
              </div>
            </div>

            {/* Compact 280px width (breakpoint right panel width) */}
            <div className="ll:flex ll:flex-col ll:gap-1.5">
              <span className="ll:font-mono ll:text-nano ll:text-muted ll:uppercase">
                Compact / Tablet Panel (280px)
              </span>
              <div className="ll:w-70 ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:overflow-hidden">
                <CodeInspector />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default InspectorsLab;
