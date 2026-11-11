"use client";

import React, { useState } from "react";
import { LeftPanel } from "../../shell/left-panel/LeftPanel";
import { LayersTree } from "../../shell/left-panel/LayersTree";
import { PageSelector } from "../../shell/left-panel/PageSelector";
import {
  SAMPLE_LAYERS,
  DEFAULT_EXPANDED_IDS,
  DEFAULT_SELECTED_IDS,
} from "../../shell/left-panel/sampleData";

export function B2LayersTreeDemo() {
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_SELECTED_IDS);
  const [expandedIds, setExpandedIds] = useState<string[]>(DEFAULT_EXPANDED_IDS);

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          B2 Layers Tree (Sliding Band, Ancestor Tint, Springs)
        </h3>
        <p className="ll:text-small ll:text-muted">
          32px rows with single sliding selection band, hover band, ancestor tint, spring chevrons with staggered fold/unfold, eye blink, lock drop, and rename settle.
        </p>
      </div>

      <div className="ll:w-62 ll:h-96 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel ll:shadow-soft ll:flex ll:flex-col">
        <LayersTree
          layers={SAMPLE_LAYERS}
          selectedIds={selectedIds}
          expandedIds={expandedIds}
          onSelect={(id) => setSelectedIds([id])}
          onToggleExpand={(id) =>
            setExpandedIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
          onRename={(id, newName) => {
            console.log("Renamed layer:", id, "->", newName);
          }}
        />
      </div>
    </div>
  );
}

export function B2SearchHighlightDemo() {
  const [selectedIds, setSelectedIds] = useState<string[]>(["headline"]);
  const [expandedIds] = useState<string[]>(DEFAULT_EXPANDED_IDS);
  const [query, setQuery] = useState("head");

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          B2 Search & Hit Highlighting
        </h3>
        <p className="ll:text-small ll:text-muted">
          Calm search field with bouncy open animation, match count, clear button, and highlighted matched letters in layer names.
        </p>
      </div>

      <div className="ll:w-62 ll:h-96 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel ll:shadow-soft">
        <LeftPanel
          mode="design"
          headerStart={<PageSelector />}
          layers={SAMPLE_LAYERS}
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

export function B2PageSelectorDemo() {
  const [currentPage, setCurrentPage] = useState("Home");
  const [pages, setPages] = useState<readonly string[]>([
    "Home",
    "Pricing",
    "About",
    "Blank",
    "Contact",
    "Blog",
    "Blog post",
    "Docs",
    "Changelog",
    "Careers",
    "Login",
    "Sign up",
    "Dashboard",
    "Settings",
    "Terms",
    "Privacy",
    "Not found",
  ]);

  return (
    <div className="ll:flex ll:flex-col ll:gap-4">
      <div>
        <h3 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">
          B2 Page Selector Dropdown
        </h3>
        <p className="ll:text-small ll:text-muted">
          32px rows with sliding highlight, checkmark on current page, route tooltip, row &quot;...&quot; flyout actions (Rename, Duplicate, Delete), search filter, and New page row.
        </p>
      </div>

      <div className="ll:p-4 ll:border ll:border-border ll:rounded-md ll:bg-surface-panel ll:flex ll:items-center ll:gap-4">
        <PageSelector
          pages={pages}
          currentPage={currentPage}
          onSelectPage={(page) => setCurrentPage(page)}
          onNewPage={() => {
            const newName = `Page ${pages.length + 1}`;
            setPages((prev) => [...prev, newName]);
            setCurrentPage(newName);
          }}
          onRenamePage={(oldName, newName) => {
            setPages((prev) => prev.map((p) => (p === oldName ? newName : p)));
            if (currentPage === oldName) setCurrentPage(newName);
          }}
          onDuplicatePage={(name) => {
            const copyName = `${name} copy`;
            setPages((prev) => [...prev, copyName]);
            setCurrentPage(copyName);
          }}
          onDeletePage={(name) => {
            if (pages.length <= 1) return;
            const nextPages = pages.filter((p) => p !== name);
            setPages(nextPages);
            if (currentPage === name) setCurrentPage(nextPages[0]);
          }}
        />
        <span className="ll:text-small ll:text-muted">
          Current: <strong className="ll:text-primary">{currentPage}</strong>
        </span>
      </div>
    </div>
  );
}

export function B2Demos() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-8 ll:p-6 ll:bg-surface-canvas">
      <B2LayersTreeDemo />
      <B2SearchHighlightDemo />
      <B2PageSelectorDemo />
    </div>
  );
}
