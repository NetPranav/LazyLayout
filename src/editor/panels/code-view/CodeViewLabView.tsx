"use client";

import React, { useState } from "react";
import { Code, Terminal, Sliders, Split, Sun } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { CodePanel } from "./CodePanel";
import { CodeInspector } from "./CodeInspector";
import { LiveCodeInspector } from "./LiveCodeInspector";
import { BlueprintCanvas } from "@/editor/panels/blueprint/BlueprintCanvas";

const THEME_OPTIONS = [
  { value: "paper", label: "Paper" },
  { value: "dark", label: "Dark" },
  { value: "white", label: "White" },
  { value: "warm", label: "Warm" },
  { value: "lilac", label: "Lilac" },
] as const;

const VIEW_SECTIONS = [
  { value: "all", label: "All Views" },
  { value: "bottom-code", label: "Bottom Code Panel" },
  { value: "bottom-console", label: "Bottom Console" },
  { value: "inspector", label: "Code Inspector (#ins-code)" },
  { value: "split", label: "Live Split View" },
  { value: "responsive", label: "Responsive Frames" },
] as const;

export const CodeViewLabView: React.FC = () => {
  const [theme, setTheme] = useState<string>("paper");
  const [activeSection, setActiveSection] = useState<string>("all");
  const [highlightedLine, setHighlightedLine] = useState<number | null>(2);

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
            <Icon icon={Code} size={20} className="ll:text-primary" />
            <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:m-0">
              Code View & Console Lab
            </h1>
            <span className="ll:font-mono ll:text-nano ll:text-muted ll:bg-surface-bar ll:px-2 ll:py-0.5 ll:rounded-xs ll:border ll:border-border">
              Phase 2 / Batch 3
            </span>
          </div>
          <p className="ll:text-small ll:text-secondary ll:m-0">
            Bottom CodePanel (--ll-size-bottom-code-h), CodeInspector (#ins-code), and compiler stream
          </p>
        </div>

        {/* Theme and Section Switchers */}
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
            value={activeSection}
            onChange={setActiveSection}
            options={VIEW_SECTIONS}
          />
        </div>
      </header>

      {/* SECTION 1: Bottom CodePanel in Code Mode */}
      {(activeSection === "all" || activeSection === "bottom-code") && (
        <section className="ll:flex ll:flex-col ll:gap-3">
          <div className="ll:flex ll:items-center ll:gap-2">
            <Icon icon={Code} size={16} className="ll:text-primary" />
            <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:m-0">
              1. Bottom CodePanel — Code Mode (Height: var(--ll-size-bottom-code-h))
            </h2>
          </div>
          <p className="ll:text-small ll:text-secondary ll:m-0">
            Displays active file tabs (Hero.tsx, useHeroAnimation.ts, Hero.module.css, README.md), syntax highlighting with line numbers, copy with feedback, and export. Click a line to test AST line selection.
          </p>

          <div
            className="ll:w-full ll:rounded-md ll:border ll:border-border ll:overflow-hidden ll:shadow-soft"
            style={{ height: "var(--ll-size-bottom-code-h)" }}
          >
            <CodePanel
              activeTab="code"
              highlightedLine={highlightedLine}
              onLineClick={(idx) => setHighlightedLine(idx)}
            />
          </div>
        </section>
      )}

      {/* SECTION 2: Bottom CodePanel in Console Mode */}
      {(activeSection === "all" || activeSection === "bottom-console") && (
        <section className="ll:flex ll:flex-col ll:gap-3">
          <div className="ll:flex ll:items-center ll:gap-2">
            <Icon icon={Terminal} size={16} className="ll:text-primary" />
            <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:m-0">
              2. Bottom CodePanel — Console Mode (Live DiagnosticBus & CLI)
            </h2>
          </div>
          <p className="ll:text-small ll:text-secondary ll:m-0">
            Subscribed to the central DiagnosticBus. Supports category filtering, search, auto-scroll, copy, clear, and interactive commands: try &apos;help&apos;, &apos;fps&apos;, &apos;build&apos;, or &apos;version&apos;.
          </p>

          <div
            className="ll:w-full ll:rounded-md ll:border ll:border-border ll:overflow-hidden ll:shadow-soft"
            style={{ height: "var(--ll-size-bottom-code-h)" }}
          >
            <CodePanel activeTab="console" />
          </div>
        </section>
      )}

      {/* SECTION 2B: Bottom CodePanel in Trace Mode */}
      {(activeSection === "all" || activeSection === "bottom-code") && (
        <section className="ll:flex ll:flex-col ll:gap-3">
          <div className="ll:flex ll:items-center ll:gap-2">
            <Icon icon={Terminal} size={16} className="ll:text-primary" />
            <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:m-0">
              2B. Bottom CodePanel — Execution Trace View (Waterfall &amp; Scrubber)
            </h2>
          </div>
          <p className="ll:text-small ll:text-secondary ll:m-0">
            Execution trace waterfall with time scrub slider, step forward/back, breakpoints toggle, and watch expressions evaluation.
          </p>

          <div
            className="ll:w-full ll:rounded-md ll:border ll:border-border ll:overflow-hidden ll:shadow-soft"
            style={{ height: "var(--ll-size-bottom-code-h)" }}
          >
            <CodePanel activeTab="trace" />
          </div>
        </section>
      )}

      {/* SECTION 3: CodeInspector (Right Panel #ins-code) */}
      {(activeSection === "all" || activeSection === "inspector") && (
        <section className="ll:flex ll:flex-col ll:gap-3">
          <div className="ll:flex ll:items-center ll:gap-2">
            <Icon icon={Sliders} size={16} className="ll:text-primary" />
            <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:m-0">
              3. CodeInspector — Right Panel Section (#ins-code Parity)
            </h2>
          </div>
          <p className="ll:text-small ll:text-secondary ll:m-0">
            Exact match for the prototype&apos;s #ins-code: Component (Name, Export), Output (Target, Styles, File), Props (dynamic add/remove), and Dependencies.
          </p>

          <div className="ll:flex ll:gap-6 ll:flex-wrap">
            <div className="ll:w-80 ll:border ll:border-border ll:rounded-md ll:bg-surface-panel ll:overflow-hidden ll:shadow-soft">
              <CodeInspector />
            </div>

            <div className="ll:flex-1 ll:min-w-64 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:flex ll:flex-col ll:gap-2">
              <span className="ll:font-mono ll:text-nano ll:text-muted ll:uppercase">
                Interactive Spec
              </span>
              <ul className="ll:text-small ll:text-secondary ll:flex ll:flex-col ll:gap-1.5 ll:pl-4 ll:m-0">
                <li>• Component Name: input updates exported symbol name</li>
                <li>• Export Type: Named vs Default radio segmented control</li>
                <li>• Target Lib: React, HTML, Vue radio segmented control</li>
                <li>• Styles: CSS modules, Tailwind, Inline dropdown selection</li>
                <li>• Props: live add new prop (name + type), remove prop row</li>
                <li>• Dependencies: live package dependency adding and removal</li>
                <li>• Output File: updates output .tsx/.jsx destination path</li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 3B: Coming Soon Shells (Logic and Data) */}
      {(activeSection === "all" || activeSection === "inspector") && (
        <section className="ll:flex ll:flex-col ll:gap-3">
          <div className="ll:flex ll:items-center ll:gap-2">
            <Icon icon={Sliders} size={16} className="ll:text-primary" />
            <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:m-0">
              3B. Full-Page Coming-Soon Shells (Logic and Data)
            </h2>
          </div>
          <div className="ll:grid ll:grid-cols-2 ll:gap-6">
            <div className="ll:h-64 ll:rounded-md ll:border ll:border-border ll:overflow-hidden ll:shadow-soft">
              <BlueprintCanvas mode="Logic" />
            </div>
            <div className="ll:h-64 ll:rounded-md ll:border ll:border-border ll:overflow-hidden ll:shadow-soft">
              <BlueprintCanvas mode="Data" />
            </div>
          </div>
        </section>
      )}

      {/* SECTION 4: Live Split-View Code Inspector (Legacy Panel 16 Parity) */}
      {(activeSection === "all" || activeSection === "split") && (
        <section className="ll:flex ll:flex-col ll:gap-3">
          <div className="ll:flex ll:items-center ll:gap-2">
            <Icon icon={Split} size={16} className="ll:text-primary" />
            <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:m-0">
              4. LiveCodeInspector — Split-View File Browser & AST Mapping
            </h2>
          </div>
          <p className="ll:text-small ll:text-secondary ll:m-0">
            Left file tree with search and category filters + right syntax-highlighted viewer. Supports single-file export and standalone repository ZIP bundle.
          </p>

          <div className="ll:w-full ll:h-96 ll:rounded-md ll:border ll:border-border ll:overflow-hidden ll:shadow-soft">
            <LiveCodeInspector />
          </div>
        </section>
      )}

      {/* SECTION 5: Responsive Width Containers */}
      {(activeSection === "all" || activeSection === "responsive") && (
        <section className="ll:flex ll:flex-col ll:gap-6">
          <div className="ll:flex ll:items-center ll:gap-2">
            <Icon icon={Code} size={16} className="ll:text-primary" />
            <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:m-0">
              5. Responsive Viewport Checks
            </h2>
          </div>

          {/* Desktop 1440 */}
          <div className="ll:flex ll:flex-col ll:gap-1.5">
            <span className="ll:font-mono ll:text-nano ll:text-muted ll:uppercase">
              Desktop Viewport (1440px max width)
            </span>
            <div
              className="ll:w-full ll:max-w-screen-xl ll:rounded-md ll:border ll:border-border ll:overflow-hidden"
              style={{ height: "var(--ll-size-bottom-code-h)" }}
            >
              <CodePanel activeTab="code" />
            </div>
          </div>

          {/* Tablet 1024 */}
          <div className="ll:flex ll:flex-col ll:gap-1.5">
            <span className="ll:font-mono ll:text-nano ll:text-muted ll:uppercase">
              Tablet Viewport (1024px container)
            </span>
            <div
              className="ll:w-full ll:rounded-md ll:border ll:border-border ll:overflow-hidden"
              style={{ maxWidth: 1024, height: "var(--ll-size-bottom-code-h)" }}
            >
              <CodePanel activeTab="code" />
            </div>
          </div>

          {/* Mobile 390 */}
          <div className="ll:flex ll:flex-col ll:gap-1.5">
            <span className="ll:font-mono ll:text-nano ll:text-muted ll:uppercase">
              Mobile Viewport (390px container)
            </span>
            <div
              className="ll:w-full ll:rounded-md ll:border ll:border-border ll:overflow-hidden"
              style={{ maxWidth: 390, height: "var(--ll-size-bottom-code-h)" }}
            >
              <CodePanel activeTab="code" />
            </div>
          </div>
        </section>
      )}

      {/* SECTION 3B: Coming Soon Shells (Logic and Data) */}
      {(activeSection === "all" || activeSection === "inspector") && (
        <section className="ll:flex ll:flex-col ll:gap-3">
          <div className="ll:flex ll:items-center ll:gap-2">
            <Icon icon={Sliders} size={16} className="ll:text-primary" />
            <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:m-0">
              3B. Full-Page Coming-Soon Shells (Logic and Data)
            </h2>
          </div>
          <div className="ll:grid ll:grid-cols-2 ll:gap-6">
            <div className="ll:h-64 ll:rounded-md ll:border ll:border-border ll:overflow-hidden ll:shadow-soft">
              <BlueprintCanvas mode="Logic" />
            </div>
            <div className="ll:h-64 ll:rounded-md ll:border ll:border-border ll:overflow-hidden ll:shadow-soft">
              <BlueprintCanvas mode="Data" />
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
