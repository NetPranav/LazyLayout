"use client";

import React, { useState } from "react";
import {
  Frame,
  Type,
  Square,
  Layers,
  FileCode,
  Folder,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { LogoMark } from "@/editor/components/LogoMark";
import { ModeTabs, type EditorMode } from "@/editor/components/ModeTabs";
import { PageSwitcher } from "@/editor/components/PageSwitcher";
import { ShipPopover } from "@/editor/components/ShipPopover";
import { AvatarStack, type CollabUser } from "@/editor/components/AvatarStack";
import { TreeRow } from "@/editor/components/TreeRow";
import { LeftPanelHeader } from "@/editor/shell/left-panel/LeftPanelHeader";
import { LeftPanelEmpty } from "@/editor/shell/left-panel/LeftPanelEmpty";
import { AssetTile } from "@/editor/shell/left-panel/AssetTile";
import { LayerContextMenuContent } from "@/editor/shell/left-panel/LayerContextMenu";
import { RightPanelHeader } from "@/editor/shell/right-panel/RightPanelHeader";
import { RightPanelAccordionRow } from "@/editor/shell/right-panel/RightPanelAccordionRow";
import { RightPanelAiChat } from "@/editor/shell/right-panel/RightPanelAiChat";
import { RightPanelEmptyPlaceholder } from "@/editor/shell/right-panel/RightPanelEmptyPlaceholder";
import type { AssetItem } from "@/editor/shell/left-panel/types";
import type { AiChatMessage } from "@/editor/shell/right-panel/types";

const SAMPLE_USERS: CollabUser[] = [
  { id: "1", name: "Ada Lovelace", status: "Editing Hero" },
  { id: "2", name: "Claude Shannon", status: "Designing Animation" },
  { id: "3", name: "Alan Turing", status: "Reviewing Code" },
  { id: "4", name: "Grace Hopper", status: "Viewing" },
  { id: "5", name: "John von Neumann", status: "Viewing" },
];

const SAMPLE_ASSETS: AssetItem[] = [
  { id: "a1", name: "hero-illustration.svg", kind: "svg" },
  { id: "a2", name: "product-mockup.png", kind: "image" },
  { id: "a3", name: "GeistMono-Medium.woff2", kind: "font" },
  { id: "a4", name: "CardWidget.json", kind: "component" },
];

const SAMPLE_AI_MESSAGES: AiChatMessage[] = [
  { id: "m1", role: "assistant", content: "I analyzed the hero section. Would you like me to make the headline bolder and add a stagger reveal?" },
  { id: "m2", role: "user", content: "Yes, use a 0.08s stagger delay between words." },
  { id: "m3", role: "assistant", content: "Done. The springs have been configured with response 0.35s and damping 0.85." },
];

/* =========================================================================
   1. LOGOMARK DEMO
   ========================================================================= */
export function LogoMarkDemo() {
  const [saving, setSaving] = useState(false);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">LogoMark</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Idle State, Saving Trace Animation (1.6s) &amp; Reduced Motion Fade
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Interactive Saving Trace State
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-6">
          <div className="ll:flex ll:items-center ll:gap-4">
            <Button
              variant={saving ? "primary" : "secondary"}
              size="md"
              onClick={() => setSaving((prev) => !prev)}
            >
              {saving ? "Stop Saving Trace" : "Trigger Saving Trace"}
            </Button>
            <span className="ll:text-small ll:text-secondary">
              State: <strong className="ll:text-primary">{saving ? "Saving (Tracing 1.6s)" : "Idle (Solid)"}</strong>
            </span>
          </div>

          <div className="ll:flex ll:items-center ll:gap-8 ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
            <div className="ll:flex ll:flex-col ll:items-center ll:gap-2">
              <span className="ll:text-micro ll:text-secondary ll:uppercase">Standard (20px)</span>
              <div className="ll:w-8 ll:h-8 ll:grid ll:place-items-center ll:text-primary">
                <LogoMark saving={saving} size={20} />
              </div>
            </div>

            <div className="ll:flex ll:flex-col ll:gap-1">
              <span className="ll:text-small ll:font-medium ll:text-primary">Trace Physics</span>
              <span className="ll:text-micro ll:text-secondary">
                Uses token <code className="ll:font-mono">--ll-dur-trace: 1.6s</code> with cubic-bezier(0.65, 0, 0.35, 1).
                Under <code className="ll:font-mono">prefers-reduced-motion</code>, the stroke trace drops and becomes an opacity pulse.
              </span>
            </div>
          </div>
        </div>

        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Size Scale Comparison
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:items-center ll:gap-8">
          {[16, 20, 24, 32, 48].map((size) => (
            <div key={size} className="ll:flex ll:flex-col ll:items-center ll:gap-2">
              <div className="ll:p-3 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:text-primary ll:grid ll:place-items-center">
                <LogoMark saving={saving} size={size} />
              </div>
              <span className="ll:text-micro ll:font-mono ll:text-secondary">{size}px</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   2. MODE TABS DEMO
   ========================================================================= */
export function ModeTabsDemo() {
  const [activeMode, setActiveMode] = useState<EditorMode>("design");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">ModeTabs</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Top Bar Segmented Mode Switcher (Design, Motion, Code)
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Interactive Mode Switcher (Keyboard Arrow Navigation)
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:items-center ll:gap-6">
          <div className="ll:bg-surface-panel ll:p-2 ll:border ll:border-border ll:rounded-md">
            <ModeTabs mode={activeMode} onChange={setActiveMode} />
          </div>
          <span className="ll:text-small ll:text-secondary">
            Current active mode: <strong className="ll:text-primary ll:uppercase">{activeMode}</strong>
          </span>
        </div>

        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Forced Inspection States
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:grid ll:grid-cols-1 ll:md:grid-cols-3 ll:gap-4">
          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:text-secondary ll:uppercase">Design Active</span>
            <div className="ll:bg-surface-panel ll:p-2 ll:border ll:border-border ll:rounded-md">
              <ModeTabs mode="design" onChange={() => {}} />
            </div>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:text-secondary ll:uppercase">Motion Active</span>
            <div className="ll:bg-surface-panel ll:p-2 ll:border ll:border-border ll:rounded-md">
              <ModeTabs mode="motion" onChange={() => {}} />
            </div>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:text-secondary ll:uppercase">Code Active</span>
            <div className="ll:bg-surface-panel ll:p-2 ll:border ll:border-border ll:rounded-md">
              <ModeTabs mode="code" onChange={() => {}} />
            </div>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:text-secondary ll:uppercase">Forced Hover State</span>
            <div className="ll:bg-surface-panel ll:p-2 ll:border ll:border-border ll:rounded-md">
              <ModeTabs mode="design" onChange={() => {}} dataState="hover" />
            </div>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:text-secondary ll:uppercase">Forced Focus Ring</span>
            <div className="ll:bg-surface-panel ll:p-2 ll:border ll:border-border ll:rounded-md">
              <ModeTabs mode="design" onChange={() => {}} dataState="focus" />
            </div>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:text-secondary ll:uppercase">Disabled State</span>
            <div className="ll:bg-surface-panel ll:p-2 ll:border ll:border-border ll:rounded-md">
              <ModeTabs mode="design" onChange={() => {}} disabled={true} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   3. PAGE SWITCHER DEMO
   ========================================================================= */
export function PageSwitcherDemo() {
  const [page, setPage] = useState("Home");
  const pages = ["Home", "About", "Pricing", "Blog", "Contact"];

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">PageSwitcher</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Closed, Open, Searchable Dropdown &amp; Disabled States
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Interactive Page Dropdown
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:items-center ll:gap-6">
          <div className="ll:bg-surface-panel ll:px-3 ll:py-1 ll:border ll:border-border ll:rounded-sm">
            <PageSwitcher
              currentPage={page}
              pages={pages}
              onSelectPage={setPage}
              onNewPage={() => setPage("New Untitled Page")}
            />
          </div>
          <span className="ll:text-small ll:text-secondary">
            Selected: <strong className="ll:text-primary">{page}</strong>
          </span>
        </div>

        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Forced Inspection States
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-wrap ll:gap-6">
          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:text-secondary ll:uppercase">Forced Hover State</span>
            <div className="ll:bg-surface-panel ll:px-3 ll:py-1 ll:border ll:border-border ll:rounded-sm">
              <PageSwitcher currentPage={page} dataState="hover" />
            </div>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:text-secondary ll:uppercase">Forced Focus State</span>
            <div className="ll:bg-surface-panel ll:px-3 ll:py-1 ll:border ll:border-border ll:rounded-sm">
              <PageSwitcher currentPage={page} dataState="focus" />
            </div>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-micro ll:text-secondary ll:uppercase">Disabled State</span>
            <div className="ll:bg-surface-panel ll:px-3 ll:py-1 ll:border ll:border-border ll:rounded-sm">
              <PageSwitcher currentPage={page} disabled={true} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   4. SHIP POPOVER DEMO
   ========================================================================= */
export function ShipPopoverDemo() {
  const [ready, setReady] = useState(false);
  const sampleIssues = [
    { id: "1", title: "Frame has 2 unlabelled icon buttons" },
    { id: "2", title: "Low contrast ratio on subtitle text (3.8:1)" },
  ];

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">ShipPopover</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Pre-flight Checklist Popover (Ready, Issues Checklist, Themes)
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Interactive Pre-flight Popover
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:items-center ll:gap-6">
          <Button
            variant={ready ? "secondary" : "primary"}
            size="md"
            onClick={() => setReady((prev) => !prev)}
          >
            Toggle State ({ready ? "Switch to Has Issues" : "Switch to Ready"})
          </Button>

          <div className="ll:bg-surface-panel ll:p-3 ll:border ll:border-border ll:rounded-md">
            <ShipPopover issues={ready ? [] : sampleIssues} ready={ready} />
          </div>
        </div>

        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Themes Comparison
        </div>
        <div className="ll:grid ll:grid-cols-1 ll:md:grid-cols-5 ll:gap-3">
          {(
            [
              { id: "paper", label: "Paper (Default)" },
              { id: "dark", label: "Dark" },
              { id: "white", label: "White" },
              { id: "warm", label: "Warm" },
              { id: "lilac", label: "Lilac (Accent)" },
            ] as const
          ).map((t) => (
            <div
              key={t.id}
              data-theme={t.id}
              className="ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:p-4 ll:flex ll:flex-col ll:gap-3"
            >
              <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
                {t.label}
              </span>
              <div className="ll:flex ll:flex-col ll:gap-2">
                <ShipPopover issues={sampleIssues} ready={false} />
                <ShipPopover issues={[]} ready={true} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   5. AVATAR STACK DEMO
   ========================================================================= */
export function AvatarStackDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">AvatarStack</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Collaborator Avatar Stack (With +N Chip, Single, Empty State)
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          States: Multiple Users (+N Chip), Single User &amp; Empty State
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-wrap ll:items-center ll:gap-8">
          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:font-semibold ll:text-primary">5 Collaborators (+2 chip, click for menu)</span>
            <div className="ll:bg-surface-panel ll:p-3 ll:border ll:border-border ll:rounded-md ll:inline-flex">
              <AvatarStack users={SAMPLE_USERS} max={3} />
            </div>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:font-semibold ll:text-primary">Single Collaborator</span>
            <div className="ll:bg-surface-panel ll:p-3 ll:border ll:border-border ll:rounded-md ll:inline-flex">
              <AvatarStack users={[SAMPLE_USERS[0]]} />
            </div>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-2">
            <span className="ll:text-small ll:font-semibold ll:text-primary">Empty State (0 collaborators)</span>
            <div className="ll:bg-surface-panel ll:p-3 ll:border ll:border-border ll:rounded-md ll:inline-flex">
              <AvatarStack users={[]} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   6. LEFT PANEL HEADER DEMO
   ========================================================================= */
export function LeftPanelHeaderDemo() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelMode, setPanelMode] = useState<"design" | "code">("design");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">LeftPanelHeader</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Section Header, Search Layer / Search Files &amp; Match Counter
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div role="heading" aria-level={2} className="ll:pt-6 ll:border-t ll:border-border ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Interactive Header (44px Zone Head)
        </div>
        <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-bar ll:p-6 ll:flex ll:flex-col ll:gap-4">
          <div className="ll:flex ll:items-center ll:gap-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPanelMode((m) => (m === "design" ? "code" : "design"))}
            >
              Switch to {panelMode === "design" ? "Code" : "Design"} Mode
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSearchOpen((s) => !s)}
            >
              {searchOpen ? "Close Search Box" : "Open Search Box"}
            </Button>
          </div>

          <div className="ll:w-72 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
            <LeftPanelHeader
              mode={panelMode}
              searchOpen={searchOpen}
              onToggleSearch={() => setSearchOpen((s) => !s)}
              searchQuery={query}
              onSearchChange={setQuery}
              matchCount={query ? 3 : 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   7. LEFT PANEL ROWS DEMO
   ========================================================================= */
export function LeftPanelRowsDemo() {
  const [selectedId, setSelectedId] = useState("layer-2");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Left Panel Rows</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Layer Rows, File Rows, Track Rows &amp; Asset Tiles
        </span>
      </div>

      <div className="ll:grid ll:grid-cols-1 ll:md:grid-cols-2 ll:gap-6">
        {/* Layer Tree Rows */}
        <div className="ll:flex ll:flex-col ll:gap-3">
          <span className="ll:text-small ll:font-semibold ll:text-primary">Layer Rows (Hierarchy &amp; Hover Actions)</span>
          <div className="ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:py-1">
            <TreeRow
              id="layer-1"
              name="Hero Section"
              level={0}
              icon={<Icon icon={Frame} size={14} />}
              hasChildren={true}
              expanded={true}
              selected={selectedId === "layer-1"}
              onSelect={() => setSelectedId("layer-1")}
            />
            <TreeRow
              id="layer-2"
              name="Headline Text"
              level={1}
              icon={<Icon icon={Type} size={14} />}
              selected={selectedId === "layer-2"}
              onSelect={() => setSelectedId("layer-2")}
            />
            <TreeRow
              id="layer-3"
              name="CTA Button"
              level={1}
              icon={<Icon icon={Square} size={14} />}
              selected={selectedId === "layer-3"}
              onSelect={() => setSelectedId("layer-3")}
            />
            <TreeRow
              id="layer-4"
              name="Hidden Wireframe"
              level={1}
              hidden={true}
              icon={<Icon icon={Square} size={14} />}
              selected={selectedId === "layer-4"}
              onSelect={() => setSelectedId("layer-4")}
            />
          </div>
        </div>

        {/* File Rows */}
        <div className="ll:flex ll:flex-col ll:gap-3">
          <span className="ll:text-small ll:font-semibold ll:text-primary">File Rows (Code Mode)</span>
          <div className="ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:py-1">
            <TreeRow
              id="file-1"
              name="src"
              level={0}
              hasChildren={true}
              expanded={true}
              icon={<Icon icon={Folder} size={14} />}
              selected={false}
            />
            <TreeRow
              id="file-2"
              name="Hero.tsx"
              level={1}
              icon={<Icon icon={FileCode} size={14} />}
              selected={true}
            />
            <TreeRow
              id="file-3"
              name="styles.module.css"
              level={1}
              icon={<Icon icon={Layers} size={14} />}
              selected={false}
            />
          </div>
        </div>

        {/* Asset Tiles */}
        <div className="ll:flex ll:flex-col ll:gap-3 ll:md:col-span-2">
          <span className="ll:text-small ll:font-semibold ll:text-primary">Asset Tiles (Assets Library Grid)</span>
          <div className="ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:p-4 ll:grid ll:grid-cols-2 ll:sm:grid-cols-4 ll:gap-4">
            {SAMPLE_ASSETS.map((asset) => (
              <AssetTile key={asset.id} asset={asset} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   8. LAYER CONTEXT MENU DEMO
   ========================================================================= */
export function LayerContextMenuDemo() {
  const [multiSelect, setMultiSelect] = useState(false);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">LayerContextMenu</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Layer Right-Click Context Menu (Single Selection vs Multi-selection with Align)
        </span>
      </div>

      <div className="ll:flex ll:flex-col ll:gap-4">
        <div className="ll:flex ll:items-center ll:gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMultiSelect((prev) => !prev)}
          >
            {multiSelect ? "Show Single-Select Menu" : "Show Multi-Select Menu (with Align)"}
          </Button>
          <span className="ll:text-small ll:text-secondary">
            Selection count: <strong className="ll:text-primary">{multiSelect ? "2 layers" : "1 layer"}</strong>
          </span>
        </div>

        <div className="ll:w-64 ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:shadow-soft ll:overflow-hidden ll:py-1">
          <LayerContextMenuContent
            selectionCount={multiSelect ? 2 : 1}
            onAction={() => {}}
            onToggleHidden={() => {}}
            onToggleLocked={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   9. LEFT PANEL EMPTY DEMO
   ========================================================================= */
export function LeftPanelEmptyDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">LeftPanelEmpty</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Blank / Empty State for Left Rail Tree
        </span>
      </div>

      <div className="ll:grid ll:grid-cols-1 ll:md:grid-cols-2 ll:gap-6">
        <div className="ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
          <LeftPanelEmpty
            title="No layers yet"
            description="Add a frame or press F to start designing."
          />
        </div>

        <div className="ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
          <LeftPanelEmpty
            title="No matching layers"
            description="No layer matched your search filter."
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   10. RIGHT PANEL HEADER DEMO
   ========================================================================= */
export function RightPanelHeaderDemo() {
  const [hidden, setHidden] = useState(false);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">RightPanelHeader</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Inspector Header with Layer Name, Eye Button, More Menu &amp; Status Chips
        </span>
      </div>

      <div className="ll:w-80 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
        <RightPanelHeader
          selectionName="Headline Hero"
          selectionIcon={Type}
          isLayerHidden={hidden}
          onToggleHideLayer={() => setHidden((h) => !h)}
          statusChips={[
            { id: "1", label: "H1" },
            { id: "2", label: "Geist" },
            { id: "3", label: "48px" },
          ]}
        />
      </div>
    </div>
  );
}

/* =========================================================================
   11. RIGHT PANEL ACCORDION ROW DEMO
   ========================================================================= */
export function RightPanelAccordionRowDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">RightPanelAccordionRow</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Motion &amp; Code Inspector Accordion Rows with Summary Value
        </span>
      </div>

      <div className="ll:w-80 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:divide-y ll:divide-border">
        <RightPanelAccordionRow
          label="Spring"
          value="Smooth (0.35s)"
          defaultOpen={true}
        >
          <div className="ll:p-3 ll:text-small ll:text-secondary">
            Spring response: 0.35s, damping ratio: 0.85
          </div>
        </RightPanelAccordionRow>

        <RightPanelAccordionRow
          label="Delay"
          value="0s"
          defaultOpen={false}
        >
          <div className="ll:p-3 ll:text-small ll:text-secondary">
            Stagger delay: 0.08s per child
          </div>
        </RightPanelAccordionRow>

        <RightPanelAccordionRow
          label="Ease curve"
          value="ease-out"
          defaultOpen={false}
        >
          <div className="ll:p-3 ll:text-small ll:text-secondary">
            cubic-bezier(0, 0, 0.58, 1)
          </div>
        </RightPanelAccordionRow>
      </div>
    </div>
  );
}

/* =========================================================================
   12. RIGHT PANEL AI CHAT DEMO
   ========================================================================= */
export function RightPanelAiChatDemo() {
  const [messages, setMessages] = useState<AiChatMessage[]>(SAMPLE_AI_MESSAGES);

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">RightPanelAiChat</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Expanded Right Rail AI Conversation Interface
        </span>
      </div>

      <div className="ll:w-80 ll:h-96 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:flex ll:flex-col">
        <RightPanelAiChat
          aiMessages={messages}
          onAiSendMessage={(content) => {
            setMessages((prev) => [
              ...prev,
              { id: `m_${Date.now()}`, role: "user", content },
            ]);
          }}
          onAiClose={() => {}}
        />
      </div>
    </div>
  );
}

/* =========================================================================
   13. RIGHT PANEL EMPTY PLACEHOLDER DEMO
   ========================================================================= */
export function RightPanelEmptyDemo() {
  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">RightPanelEmptyPlaceholder</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Placeholder Shown in Inspector When No Element Is Selected
        </span>
      </div>

      <div className="ll:w-80 ll:h-48 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:flex ll:items-center ll:justify-center ll:p-4">
        <RightPanelEmptyPlaceholder label="Select an element to view properties" />
      </div>
    </div>
  );
}
