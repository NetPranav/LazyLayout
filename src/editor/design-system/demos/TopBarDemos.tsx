"use client";

import React, { useState } from "react";
import { TopBar } from "../../components/TopBar";
import { ModeTabs, type EditorMode } from "../../components/ModeTabs";
import { LogoMark } from "../../components/LogoMark";
import { PageSwitcher } from "../../components/PageSwitcher";
import { ShipPopover, type ShipIssue } from "../../components/ShipPopover";
import { ThemeToggle } from "../../components/ThemeToggle";

const SAMPLE_ISSUES: readonly ShipIssue[] = [
  { id: "alt", title: "Hero image has no alt text" },
  { id: "contrast", title: "Button contrast is 3.9:1" },
];

export function TopBarDemo() {
  const [mode, setMode] = useState<EditorMode>("design");
  const [issues, setIssues] = useState<readonly ShipIssue[]>(SAMPLE_ISSUES);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">TopBar</h2>
        <p className="ll:text-small ll:text-muted">
          52px Apple-level header with Logo, 1px hairline divider, Project title, sliding Mode tabs, Theme toggle, and Ship popover.
        </p>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-6">
        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-small ll:font-medium ll:text-secondary">Default / Saved State (with 2 issues)</span>
          <div className="ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
            <TopBar
              projectName="Portfolio Website"
              saving={false}
              saveStatus="saved"
              mode={mode}
              onSelectMode={setMode}
              issues={issues}
              onFixIssue={(id) => setIssues((prev) => prev.filter((i) => i.id !== id))}
            />
          </div>
        </div>

        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-small ll:font-medium ll:text-secondary">Saving State (Tracing Logo Animation, No Save Dot)</span>
          <div className="ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
            <TopBar
              projectName="Design System"
              saving={true}
              saveStatus="saving"
              mode={mode}
              onSelectMode={setMode}
              issues={issues}
            />
          </div>
        </div>

        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-small ll:font-medium ll:text-secondary">Unsaved / Dirty State</span>
          <div className="ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
            <TopBar
              projectName="Marketing Landing"
              saving={false}
              saveStatus="dirty"
              mode={mode}
              onSelectMode={setMode}
              issues={issues}
            />
          </div>
        </div>

        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-small ll:font-medium ll:text-secondary">Ready to Ship State (0 Issues, Solid Primary Button)</span>
          <div className="ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
            <TopBar
              projectName="Production Release"
              saving={false}
              saveStatus="saved"
              mode={mode}
              onSelectMode={setMode}
              issues={[]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModeTabsDemo() {
  const [mode, setMode] = useState<EditorMode>("design");

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">ModeTabs</h2>
        <p className="ll:text-small ll:text-muted">
          32px segmented tabs with sliding spring highlight, 10px caret on the active tab, and nested mode dropdown menu on second click.
        </p>
      </div>

      <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-8 ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Interactive</span>
          <ModeTabs mode={mode} onChange={setMode} />
        </div>

        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Motion Active</span>
          <ModeTabs mode="motion" onChange={() => {}} />
        </div>

        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Code Active</span>
          <ModeTabs mode="code" onChange={() => {}} />
        </div>

        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Forced Hover</span>
          <ModeTabs mode="design" onChange={() => {}} dataState="hover" />
        </div>

        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Disabled</span>
          <ModeTabs mode="design" onChange={() => {}} disabled />
        </div>
      </div>
    </div>
  );
}

export function LogoMarkDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">LogoMark</h2>
        <p className="ll:text-small ll:text-muted">
          Lazy Layout brand mark. During saves, traces stroke back and forth infinitely on a 1.6s ease curve.
        </p>
      </div>

      <div className="ll:flex ll:items-center ll:gap-8 ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
        <div className="ll:flex ll:flex-col ll:items-center ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Static (20px)</span>
          <div className="ll:w-8 ll:h-8 ll:grid ll:place-items-center">
            <LogoMark size={20} saving={false} />
          </div>
        </div>

        <div className="ll:flex ll:flex-col ll:items-center ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Saving Trace (20px)</span>
          <div className="ll:w-8 ll:h-8 ll:grid ll:place-items-center">
            <LogoMark size={20} saving={true} />
          </div>
        </div>

        <div className="ll:flex ll:flex-col ll:items-center ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Large (32px)</span>
          <div className="ll:w-10 ll:h-10 ll:grid ll:place-items-center">
            <LogoMark size={32} saving={false} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageSwitcherDemo() {
  const [page, setPage] = useState("Home");

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">PageSwitcher</h2>
        <p className="ll:text-small ll:text-muted">
          Current page trigger with chevron flip, inline renaming, surf popover aligned to active row, search filter on &gt;12 pages, and keyboard navigation.
        </p>
      </div>

      <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-8 ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Interactive</span>
          <PageSwitcher currentPage={page} onSelectPage={setPage} />
        </div>

        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Forced Hover</span>
          <PageSwitcher currentPage="Pricing" onSelectPage={() => {}} dataState="hover" />
        </div>

        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Disabled</span>
          <PageSwitcher currentPage="About" onSelectPage={() => {}} disabled />
        </div>
      </div>
    </div>
  );
}

export function ShipPopoverDemo() {
  const [issues, setIssues] = useState<readonly ShipIssue[]>(SAMPLE_ISSUES);

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">ShipPopover</h2>
        <p className="ll:text-small ll:text-muted">
          Ship trigger showing issue count or &apos;Ready&apos; badge. Morphing popover with per-issue &apos;Fix&apos; flip cards and publication action.
        </p>
      </div>

      <div className="ll:flex ll:flex-wrap ll:items-center ll:gap-8 ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">With Issues (2)</span>
          <ShipPopover
            issues={issues}
            onFixIssue={(id) => setIssues((prev) => prev.filter((i) => i.id !== id))}
          />
        </div>

        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Ready (0 issues)</span>
          <ShipPopover issues={[]} />
        </div>

        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Disabled</span>
          <ShipPopover issues={issues} disabled />
        </div>
      </div>
    </div>
  );
}

export function ThemeToggleDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">ThemeToggle</h2>
        <p className="ll:text-small ll:text-muted">
          Theme picker with all eight themes across Light (Paper, White, Warm, Lilac) and Dark (Noir, Dark, Graphite, Darkroom) with live color swatches.
        </p>
      </div>

      <div className="ll:flex ll:items-center ll:gap-8 ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Menu Picker Mode</span>
          <ThemeToggle mode="menu" />
        </div>

        <div className="ll:flex ll:flex-col ll:gap-2">
          <span className="ll:text-micro ll:font-medium ll:text-muted">Cycle Mode</span>
          <ThemeToggle mode="cycle" />
        </div>
      </div>
    </div>
  );
}
