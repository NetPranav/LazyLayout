"use client";

import React, { useState } from "react";
import { LeftPanel } from "../../shell/left-panel/LeftPanel";
import { PageSwitcher } from "../../components/PageSwitcher";
import {
  SAMPLE_LAYERS,
  SAMPLE_FILES,
  SAMPLE_ASSETS,
  DEFAULT_EXPANDED_IDS,
  DEFAULT_SELECTED_IDS,
} from "../../shell/left-panel/sampleData";
import type { LeftPanelMode } from "../../shell/left-panel/types";

export function LeftPanelDesignDemo() {
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_SELECTED_IDS);
  const [expandedIds, setExpandedIds] = useState<string[]>(DEFAULT_EXPANDED_IDS);

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Design Mode (Layers + Assets)</h3>
        <p className="ll:text-small ll:text-muted">
          Default 248px left panel with PageSwitcher header slot, 32px layer rows with type icons, motion badges, eye/lock actions, and collapsed assets drawer.
        </p>
      </div>
      <div className="ll:w-62 ll:h-120 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel ll:shadow-soft">
        <LeftPanel
          mode="design"
          headerStart={<PageSwitcher />}
          layers={SAMPLE_LAYERS}
          assets={SAMPLE_ASSETS}
          selectedIds={selectedIds}
          onSelect={(id) => setSelectedIds([id])}
          expandedIds={expandedIds}
          onToggleExpand={(id) =>
            setExpandedIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
        />
      </div>
    </div>
  );
}

export function LeftPanelSearchDemo() {
  const [selectedIds, setSelectedIds] = useState<string[]>(["headline"]);
  const [expandedIds] = useState<string[]>(DEFAULT_EXPANDED_IDS);
  const [query, setQuery] = useState("head");

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Search & Hit Highlighting</h3>
        <p className="ll:text-small ll:text-muted">
          Collapsible search box with active match count and bold yellow hit highlight on matching layer names.
        </p>
      </div>
      <div className="ll:w-62 ll:h-120 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel ll:shadow-soft">
        <LeftPanel
          mode="design"
          headerStart={<PageSwitcher />}
          layers={SAMPLE_LAYERS}
          assets={SAMPLE_ASSETS}
          selectedIds={selectedIds}
          onSelect={(id) => setSelectedIds([id])}
          expandedIds={expandedIds}
          searchOpen={true}
          searchQuery={query}
          onSearchQueryChange={setQuery}
        />
      </div>
    </div>
  );
}

export function LeftPanelAssetsOpenDemo() {
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_SELECTED_IDS);
  const [expandedIds] = useState<string[]>(DEFAULT_EXPANDED_IDS);
  const [assetsHeight, setAssetsHeight] = useState(200);

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Assets Drawer Open</h3>
        <p className="ll:text-small ll:text-muted">
          Resizable drawer via draggable separator with 2-column asset preview grid, upload button, and asset search.
        </p>
      </div>
      <div className="ll:w-62 ll:h-120 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel ll:shadow-soft">
        <LeftPanel
          mode="design"
          headerStart={<PageSwitcher />}
          layers={SAMPLE_LAYERS}
          assets={SAMPLE_ASSETS}
          selectedIds={selectedIds}
          onSelect={(id) => setSelectedIds([id])}
          expandedIds={expandedIds}
          assetsOpen={true}
          assetsHeight={assetsHeight}
          onAssetsHeightChange={setAssetsHeight}
        />
      </div>
    </div>
  );
}

export function LeftPanelCodeDemo() {
  const [selectedIds, setSelectedIds] = useState<string[]>(["f-hero"]);
  const [expandedIds, setExpandedIds] = useState<string[]>([
    "f-src",
    "f-components",
    "f-pages",
    "f-styles",
  ]);

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Code Mode (Files Tree)</h3>
        <p className="ll:text-small ll:text-muted">
          Category filter dropdown (All, Pages, Components, Styles, Config), modified indicator dots on changed files, and file context menus.
        </p>
      </div>
      <div className="ll:w-62 ll:h-120 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel ll:shadow-soft">
        <LeftPanel
          mode="code"
          files={SAMPLE_FILES}
          selectedIds={selectedIds}
          onSelect={(id) => setSelectedIds([id])}
          expandedIds={expandedIds}
          onToggleExpand={(id) =>
            setExpandedIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
        />
      </div>
    </div>
  );
}

export function LeftPanelEmptyDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Empty State</h3>
        <p className="ll:text-small ll:text-muted">
          Text-only empty state (#lsnone) without dead buttons when search finds no matches or the tree is blank.
        </p>
      </div>
      <div className="ll:w-62 ll:h-80 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel ll:shadow-soft">
        <LeftPanel
          mode="design"
          headerStart={<PageSwitcher />}
          layers={[]}
          assets={[]}
          searchOpen={true}
          searchQuery="xyz-not-found"
        />
      </div>
    </div>
  );
}

export function LeftPanelDemo() {
  const [mode, setMode] = useState<LeftPanelMode>("design");
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_SELECTED_IDS);
  const [expandedIds, setExpandedIds] = useState<string[]>(DEFAULT_EXPANDED_IDS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [assetsHeight, setAssetsHeight] = useState(200);

  return (
    <div className="ll:flex ll:flex-col ll:gap-6">
      <div>
        <h2 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">LeftPanel</h2>
        <p className="ll:text-small ll:text-muted">
          Complete Left Panel navigation component for Design, Motion, and Code modes matching the prototype layout and metrics.
        </p>
      </div>

      <div className="ll:flex ll:items-center ll:gap-2">
        <button
          type="button"
          onClick={() => setMode("design")}
          className={`ll:h-7 ll:px-3 ll:rounded-sm ll:text-small ll:font-medium ${
            mode === "design"
              ? "ll:bg-control-primary ll:text-control-primary-fg"
              : "ll:bg-surface-bar ll:text-secondary ll:hover:text-primary"
          }`}
        >
          Design
        </button>
        <button
          type="button"
          onClick={() => setMode("motion")}
          className={`ll:h-7 ll:px-3 ll:rounded-sm ll:text-small ll:font-medium ${
            mode === "motion"
              ? "ll:bg-control-primary ll:text-control-primary-fg"
              : "ll:bg-surface-bar ll:text-secondary ll:hover:text-primary"
          }`}
        >
          Motion
        </button>
        <button
          type="button"
          onClick={() => setMode("code")}
          className={`ll:h-7 ll:px-3 ll:rounded-sm ll:text-small ll:font-medium ${
            mode === "code"
              ? "ll:bg-control-primary ll:text-control-primary-fg"
              : "ll:bg-surface-bar ll:text-secondary ll:hover:text-primary"
          }`}
        >
          Code
        </button>
      </div>

      <div className="ll:w-62 ll:h-140 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel ll:shadow-soft">
        <LeftPanel
          mode={mode}
          headerStart={mode !== "code" ? <PageSwitcher /> : undefined}
          layers={SAMPLE_LAYERS}
          files={SAMPLE_FILES}
          assets={SAMPLE_ASSETS}
          selectedIds={selectedIds}
          onSelect={(id) => setSelectedIds([id])}
          expandedIds={expandedIds}
          onToggleExpand={(id) =>
            setExpandedIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
          searchOpen={searchOpen}
          onSearchOpenChange={setSearchOpen}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          assetsOpen={assetsOpen}
          onAssetsOpenChange={setAssetsOpen}
          assetsHeight={assetsHeight}
          onAssetsHeightChange={setAssetsHeight}
        />
      </div>
    </div>
  );
}
