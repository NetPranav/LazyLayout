"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Play, Code2, Layers, Search, Sun, Moon } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { PageSwitcher } from "@/editor/components/PageSwitcher";
import { LeftPanel } from "./LeftPanel";
import type { LeftPanelMode } from "./types";
import {
  SAMPLE_LAYERS,
  SAMPLE_FILES,
  SAMPLE_TRACKS,
  SAMPLE_ASSETS,
  DEFAULT_EXPANDED_IDS,
  DEFAULT_SELECTED_IDS,
  DEFAULT_SELECTED_TRACK_ID,
} from "./sampleData";
import { LAB_FRAME_HEIGHT } from "./constants";

function LeftPanelLabInner() {
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get("mode") as LeftPanelMode) || "design";
  const initialSearch = searchParams.get("search") === "true" || searchParams.get("search") === "1";
  const initialAssets = searchParams.get("assets") === "true" || searchParams.get("assets") === "1";

  const [mode, setMode] = useState<LeftPanelMode>(initialMode);
  const [searchOpen, setSearchOpen] = useState(initialSearch);
  const [assetsOpen, setAssetsOpen] = useState(initialAssets);
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_SELECTED_IDS);
  const [expandedIds, setExpandedIds] = useState<string[]>(DEFAULT_EXPANDED_IDS);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(DEFAULT_SELECTED_TRACK_ID);
  const [theme, setTheme] = useState<"paper" | "dark">("paper");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "paper" ? "dark" : "paper"));
  };

  const headerStart = <PageSwitcher />;

  return (
    <div className="ll-editor-root ll:flex ll:flex-col ll:items-center ll:justify-start ll:min-h-screen ll:bg-surface-backdrop ll:p-6 ll:font-sans ll:select-none">
      {/* Lab Toolbar */}
      <div className="ll:w-viewport-desktop ll:flex ll:items-center ll:justify-between ll:mb-4 ll:px-4 ll:py-2.5 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-soft">
        <div className="ll:flex ll:items-center ll:gap-4">
          <span className="ll:text-small ll:font-semibold ll:text-primary">
            LeftPanel Lab (1440 × 900)
          </span>

          {/* Mode Switcher */}
          <div className="ll:flex ll:items-center ll:gap-1 ll:bg-surface-bar ll:p-0.5 ll:rounded-sm ll:border ll:border-border">
            <button
              type="button"
              id="mode-btn-design"
              onClick={() => setMode("design")}
              className={`ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:px-3 ll:rounded-xs ll:text-small ll:font-medium ll:transition-colors ${
                mode === "design"
                  ? "ll:bg-control-primary ll:text-control-primary-fg"
                  : "ll:text-secondary ll:hover:text-primary"
              }`}
            >
              <Icon icon={Layers} size={13} />
              <span>Design</span>
            </button>
            <button
              type="button"
              id="mode-btn-motion"
              onClick={() => setMode("motion")}
              className={`ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:px-3 ll:rounded-xs ll:text-small ll:font-medium ll:transition-colors ${
                mode === "motion"
                  ? "ll:bg-control-primary ll:text-control-primary-fg"
                  : "ll:text-secondary ll:hover:text-primary"
              }`}
            >
              <Icon icon={Play} size={13} />
              <span>Motion</span>
            </button>
            <button
              type="button"
              id="mode-btn-code"
              onClick={() => setMode("code")}
              className={`ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:px-3 ll:rounded-xs ll:text-small ll:font-medium ll:transition-colors ${
                mode === "code"
                  ? "ll:bg-control-primary ll:text-control-primary-fg"
                  : "ll:text-secondary ll:hover:text-primary"
              }`}
            >
              <Icon icon={Code2} size={13} />
              <span>Code</span>
            </button>
          </div>
        </div>

        <div className="ll:flex ll:items-center ll:gap-2">
          <button
            type="button"
            id="toggle-search-btn"
            onClick={() => setSearchOpen((prev) => !prev)}
            className={`ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:px-3 ll:rounded-sm ll:border ll:border-border ll:text-small ll:font-medium ${
              searchOpen
                ? "ll:bg-control-primary ll:text-control-primary-fg"
                : "ll:bg-surface-bar ll:text-secondary ll:hover:text-primary"
            }`}
          >
            <Icon icon={Search} size={13} />
            <span>Search: {searchOpen ? "Open" : "Closed"}</span>
          </button>

          {mode === "design" && (
            <button
              type="button"
              id="toggle-assets-btn"
              onClick={() => setAssetsOpen((prev) => !prev)}
              className={`ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:px-3 ll:rounded-sm ll:border ll:border-border ll:text-small ll:font-medium ${
                assetsOpen
                  ? "ll:bg-control-primary ll:text-control-primary-fg"
                  : "ll:bg-surface-bar ll:text-secondary ll:hover:text-primary"
              }`}
            >
              <span>Assets: {assetsOpen ? "Expanded" : "Collapsed"}</span>
            </button>
          )}

          <button
            type="button"
            id="toggle-theme-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:text-secondary ll:hover:text-primary"
          >
            <Icon icon={theme === "paper" ? Moon : Sun} size={14} />
          </button>
        </div>
      </div>

      {/* Frame Container: 1440 × 900 wrapped in .ll-editor-root */}
      <div
        id="lab-frame"
        style={{ height: LAB_FRAME_HEIGHT }}
        className="ll-editor-root ll:w-viewport-desktop ll:flex ll:flex-col ll:bg-surface-panel ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:overflow-hidden ll:relative"
      >
        {/* Frame Top Bar (52px) */}
        <header className="ll:h-topbar ll:flex ll:items-center ll:justify-between ll:px-4 ll:border-b ll:border-border ll:bg-surface-panel ll:shrink-0">
          <div className="ll:flex ll:items-center ll:gap-2">
            <span className="ll:text-title ll:font-semibold ll:text-primary">Lazy Layout</span>
            <span className="ll:text-nano ll:font-mono ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:bg-surface-bar ll:text-muted">
              {mode.toUpperCase()}
            </span>
          </div>

          <div className="ll:text-small ll:font-medium ll:text-secondary">
            Frame Preview · 1440 × 900
          </div>
        </header>

        {/* Frame Content Grid */}
        <div className="ll:flex-1 ll:flex ll:min-h-0 ll:overflow-hidden ll:relative">
          {/* LEFT PANEL */}
          <LeftPanel
            mode={mode}
            headerStart={headerStart}
            layers={SAMPLE_LAYERS}
            files={SAMPLE_FILES}
            tracks={SAMPLE_TRACKS}
            assets={SAMPLE_ASSETS}
            selectedIds={selectedIds}
            onSelect={(id) => setSelectedIds([id])}
            expandedIds={expandedIds}
            onToggleExpand={(id) =>
              setExpandedIds((prev) =>
                prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
              )
            }
            selectedTrackId={selectedTrackId}
            onSelectTrack={(id) => setSelectedTrackId(id)}
            searchOpen={searchOpen}
            onSearchOpenChange={setSearchOpen}
            assetsOpen={assetsOpen}
            onAssetsOpenChange={setAssetsOpen}
          />

          {/* Center Canvas Preview Area */}
          <main
            className="ll:flex-1 ll:flex ll:flex-col ll:bg-surface-canvas ll:min-w-0 ll:relative ll:overflow-hidden"
            aria-label="Canvas Preview"
          >
            {/* Top ruler mock */}
            <div
              style={{ gap: "var(--ll-spacing-16)" }}
              className="ll:h-ruler ll:bg-surface-panel ll:border-b ll:border-border ll:flex ll:items-center ll:px-3 ll:shrink-0"
            >
              <span className="ll:font-mono ll:text-nano ll:text-muted">0px</span>
              <span className="ll:font-mono ll:text-nano ll:text-muted">100px</span>
              <span className="ll:font-mono ll:text-nano ll:text-muted">200px</span>
              <span className="ll:font-mono ll:text-nano ll:text-muted">300px</span>
              <span className="ll:font-mono ll:text-nano ll:text-muted">400px</span>
            </div>

            {/* Stage artboard */}
            <div
              style={{ padding: "var(--ll-spacing-12)" }}
              className="ll:flex-1 ll:flex ll:items-center ll:justify-center ll:overflow-auto"
            >
              <div className="ll:w-full ll:max-w-canvas ll:bg-board-bg ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:p-8 ll:flex ll:flex-col ll:justify-between">
                <div>
                  <div className="ll:text-micro ll:font-mono ll:text-muted ll:uppercase ll:tracking-normal ll:mb-2">
                    Hero Section
                  </div>
                  <h1 className="ll:text-display ll:font-display ll:text-primary">
                    Design it once. Ship it lazily.
                  </h1>
                  <p className="ll:text-body ll:text-secondary ll:mt-2">
                    Build pages visually and get production code out.
                  </p>
                </div>

                <div className="ll:flex ll:items-center ll:gap-3 ll:mt-8">
                  <div className="ll:h-btn ll:px-4 ll:grid ll:place-items-center ll:bg-control-primary ll:text-control-primary-fg ll:rounded-sm ll:text-small ll:font-medium">
                    Get started
                  </div>
                  <div className="ll:h-btn ll:px-4 ll:grid ll:place-items-center ll:bg-surface-bar ll:border ll:border-border ll:text-primary ll:rounded-sm ll:text-small ll:font-medium">
                    Documentation
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Panel if Motion or Code */}
            {mode === "motion" && (
              <div
                style={{ height: "var(--ll-size-bottom-motion-h)" }}
                className="ll:flex ll:flex-col ll:border-t ll:border-border ll:bg-surface-panel ll:shrink-0"
              >
                <div className="ll:h-header ll:flex ll:items-center ll:justify-between ll:px-4 ll:border-b ll:border-border">
                  <span className="ll:text-small ll:font-medium ll:text-primary">
                    Timeline Ruler
                  </span>
                  <span className="ll:font-mono ll:text-nano ll:text-muted">
                    00:00:00 / 00:05:00
                  </span>
                </div>
                <div className="ll:flex-1 ll:p-4 ll:flex ll:flex-col ll:gap-3 ll:justify-center">
                  <div className="ll:h-row ll:bg-surface-bar ll:border ll:border-border ll:rounded-xs ll:relative ll:overflow-hidden">
                    <div className="ll:absolute ll:left-4 ll:top-1 ll:bottom-1 ll:w-1/2 ll:bg-control-primary ll:rounded-xs ll:opacity-30" />
                  </div>
                  <div className="ll:h-row ll:bg-surface-bar ll:border ll:border-border ll:rounded-xs ll:relative ll:overflow-hidden">
                    <div
                      style={{ left: "var(--ll-spacing-6)" }}
                      className="ll:absolute ll:top-1 ll:bottom-1 ll:w-1/3 ll:bg-control-primary ll:rounded-xs ll:opacity-30"
                    />
                  </div>
                </div>
              </div>
            )}

            {mode === "code" && (
              <div
                style={{ height: "var(--ll-size-bottom-code-h)" }}
                className="ll:flex ll:flex-col ll:border-t ll:border-border ll:bg-surface-panel ll:shrink-0"
              >
                <div className="ll:h-header ll:flex ll:items-center ll:justify-between ll:px-4 ll:border-b ll:border-border">
                  <span className="ll:font-mono ll:text-small ll:text-primary">Hero.tsx</span>
                  <span className="ll:text-nano ll:font-mono ll:text-muted">TypeScript JSX</span>
                </div>
                <div className="ll:flex-1 ll:p-4 ll:font-mono ll:text-micro ll:text-secondary ll:overflow-auto">
                  <pre className="ll:m-0">
                    {`export function Hero() {\n  return (\n    <section className="hero">\n      <h1>Design it once. Ship it lazily.</h1>\n      <a className="cta">Get started</a>\n    </section>\n  );\n}`}
                  </pre>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export function LeftPanelLab() {
  return (
    <Suspense
      fallback={
        <div className="ll:p-8 ll:text-body ll:text-muted">Loading LeftPanel Lab...</div>
      }
    >
      <LeftPanelLabInner />
    </Suspense>
  );
}
