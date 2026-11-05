"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Layers,
  Play,
  Code2,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { Checkbox } from "@/editor/components/Checkbox";
import { ThemeToggle } from "@/editor/components/ThemeToggle";
import { SegmentedControl, type SegmentedControlOption } from "@/editor/components/SegmentedControl";
import { LeftPanelConnected } from "./LeftPanelConnected";
import { usePagesData } from "./usePagesData";
import { useLayers, documentCommands } from "@/core/store/useDocumentStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useProjectStore } from "@/core/store/useProjectStore";
import { invokeCommand } from "@/core/commands";
import type { LeftPanelMode } from "./types";

const MODE_OPTIONS: readonly SegmentedControlOption<LeftPanelMode>[] = [
  { value: "design", label: "Design", icon: <Icon icon={Layers} size={14} /> },
  { value: "motion", label: "Motion", icon: <Icon icon={Play} size={14} /> },
  { value: "code", label: "Code", icon: <Icon icon={Code2} size={14} /> },
];

export const LayersLab: React.FC = () => {
  const [mode, setMode] = useState<LeftPanelMode>("design");
  const [filterByActivePage, setFilterByActivePage] = useState(false);
  const [lastAction, setLastAction] = useState<string>("Initialized connected layers lab");

  // Connected data hooks
  const layers = useLayers();
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const pagesData = usePagesData();
  const activePageId = useProjectStore((s) => s.activePageId);
  const pages = useProjectStore((s) => s.pages);

  const activePage = pages[activePageId];
  const activePageName = activePage?.name || "Home";
  const selectedId = selectedIds[selectedIds.length - 1] || null;
  const selectedLayer = selectedId ? layers[selectedId] : null;

  // Lab document actions
  const handleMountDemo = useCallback(() => {
    useProjectStore.getState().mountDemoProject();
    setLastAction("Mounted showcase demo project");
  }, []);

  const handleClearCanvas = useCallback(() => {
    useProjectStore.getState().clearToBlankCanvas();
    setLastAction("Cleared canvas to blank state");
  }, []);

  const handleAddLayer = useCallback(() => {
    const parentId =
      selectedId && layers[selectedId]?.children
        ? selectedId
        : activePage?.rootElementId && layers[activePage.rootElementId]
        ? activePage.rootElementId
        : null;

    const count = Object.keys(layers).length + 1;
    const name = `Box ${count}`;
    const newId = documentCommands.addLayer(
      {
        archetype: "rectangle",
        name,
        parentId,
        properties: {
          "layout.display": "block",
          "frame.width": 160,
          "frame.height": 80,
        },
      },
      "Add Test Layer"
    );

    useSelectionStore.getState().select(newId, "element");
    setLastAction(`Added layer "${name}" (${newId})`);
  }, [layers, selectedId, activePage]);

  const handleToggleHide = useCallback(() => {
    if (!selectedId || !selectedLayer) return;
    const nextVisible = selectedLayer.visible === false;
    void invokeCommand("layer.setVisible", {
      ids: [selectedId],
      visible: nextVisible,
    });
    setLastAction(`Set layer "${selectedLayer.name}" visible: ${nextVisible}`);
  }, [selectedId, selectedLayer]);

  const handleToggleLock = useCallback(() => {
    if (!selectedId || !selectedLayer) return;
    const nextLocked = !selectedLayer.locked;
    void invokeCommand("layer.setLocked", {
      ids: [selectedId],
      locked: nextLocked,
    });
    setLastAction(`Set layer "${selectedLayer.name}" locked: ${nextLocked}`);
  }, [selectedId, selectedLayer]);

  const handleDuplicate = useCallback(() => {
    if (!selectedId) return;
    void invokeCommand("edit.duplicate");
    setLastAction(`Duplicated layer (${selectedId})`);
  }, [selectedId]);

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    void invokeCommand("edit.delete");
    setLastAction(`Deleted layer (${selectedId})`);
  }, [selectedId]);

  const layerCount = useMemo(() => Object.keys(layers).length, [layers]);
  const pageCount = useMemo(() => Object.keys(pages).length, [pages]);

  return (
    <div className="ll-editor-root ll:flex ll:flex-col ll:items-center ll:justify-start ll:min-h-screen ll:bg-surface-backdrop ll:p-6 ll:font-sans ll:select-none">
      {/* 1. Lab Header Toolbar */}
      <header
        role="region"
        aria-label="Layers Lab Toolbar"
        className="ll:w-viewport-desktop ll:flex ll:items-center ll:justify-between ll:mb-4 ll:px-4 ll:py-3 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-soft"
      >
        <div className="ll:flex ll:items-center ll:gap-4">
          <div className="ll:flex ll:flex-col">
            <span className="ll:text-title ll:font-title ll:text-primary">
              Layers Panel Data Wiring Lab
            </span>
            <span className="ll:text-small ll:text-secondary">
              Real store connections: layer tree, selection sync, expand/collapse, hide/lock, rename, reorder & page switcher
            </span>
          </div>

          {/* Mode Switcher */}
          <SegmentedControl
            options={MODE_OPTIONS}
            value={mode}
            onChange={(m) => setMode(m)}
            size="sm"
            ariaLabel="Editor mode switcher"
          />
        </div>

        {/* Action Controls & Theme Toggle */}
        <div className="ll:flex ll:items-center ll:gap-2">
          <Checkbox
            id="filter-page-checkbox"
            checked={filterByActivePage}
            onChange={setFilterByActivePage}
            label={<span className="ll:text-small ll:text-secondary">Filter by page</span>}
          />

          <div className="ll:h-4 ll:w-px ll:bg-border ll:mx-1" />

          <Button variant="secondary" size="sm" onClick={handleMountDemo} leftIcon={<Icon icon={Sparkles} size={13} />}>
            Demo
          </Button>
          <Button variant="secondary" size="sm" onClick={handleClearCanvas} leftIcon={<Icon icon={RotateCcw} size={13} />}>
            Blank
          </Button>
          <Button variant="secondary" size="sm" onClick={handleAddLayer} leftIcon={<Icon icon={Plus} size={13} />}>
            Add Layer
          </Button>
          <Button variant="primary" size="sm" onClick={() => pagesData.onNewPage()} leftIcon={<Icon icon={Plus} size={13} />}>
            Add Page
          </Button>

          <div className="ll:h-4 ll:w-px ll:bg-border ll:mx-1" />

          <ThemeToggle />
        </div>
      </header>

      {/* 2. Main 1440 × 900 Desktop Frame */}
      <main
        role="main"
        aria-label="Connected Layers Viewport"
        style={{
          width: "var(--ll-size-viewport-desktop)",
          height: "var(--ll-size-viewport-desktop-h)",
        }}
        className="ll:flex ll:flex-row ll:bg-surface-canvas ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:overflow-hidden ll:relative"
      >
        {/* Left: Real Connected LeftPanel */}
        <LeftPanelConnected
          mode={mode}
          filterByActivePage={filterByActivePage}
          className="ll:h-full"
        />

        {/* Right: Mock Canvas Stage & Connected Inspector */}
        <div className="ll:flex-1 ll:flex ll:flex-col ll:h-full ll:bg-surface-canvas ll:overflow-hidden">
          {/* Stage Top Bar */}
          <div className="ll:flex ll:items-center ll:justify-between ll:h-header ll:px-4 ll:bg-surface-bar ll:border-b ll:border-border">
            <div className="ll:flex ll:items-center ll:gap-3">
              <span className="ll:text-small ll:font-semibold ll:text-primary">
                Active Page: {activePageName} ({activePageId})
              </span>
              <span className="ll:text-micro ll:text-secondary ll:px-2 ll:py-0.5 ll:bg-surface-panel ll:border ll:border-border ll:rounded-xs">
                {layerCount} layers • {pageCount} pages
              </span>
            </div>

            {/* Quick Action Buttons for the selected layer */}
            {selectedLayer && (
              <div className="ll:flex ll:items-center ll:gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleHide}
                  leftIcon={<Icon icon={selectedLayer.visible === false ? EyeOff : Eye} size={13} />}
                >
                  {selectedLayer.visible === false ? "Show" : "Hide"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleLock}
                  leftIcon={<Icon icon={selectedLayer.locked ? Lock : Unlock} size={13} />}
                >
                  {selectedLayer.locked ? "Unlock" : "Lock"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDuplicate}
                  leftIcon={<Icon icon={Copy} size={13} />}
                >
                  Duplicate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  leftIcon={<Icon icon={Trash2} size={13} />}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>

          {/* Stage Canvas Workspace Area */}
          <div className="ll:flex-1 ll:flex ll:flex-col ll:p-8 ll:overflow-y-auto ll:gap-6">
            {/* Inspector Summary Card */}
            <div className="ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-soft">
              <span className="ll:text-small ll:font-semibold ll:text-primary ll:block ll:mb-2">
                Connected Store Inspector
              </span>
              <div className="ll:grid ll:grid-cols-2 ll:gap-4 ll:text-small">
                <div>
                  <span className="ll:text-secondary ll:block">Selected Layer:</span>
                  <span className="ll:text-primary ll:font-mono ll:font-medium">
                    {selectedLayer ? `${selectedLayer.name} (${selectedLayer.id})` : "None (click a row in left panel)"}
                  </span>
                </div>
                <div>
                  <span className="ll:text-secondary ll:block">Layer Archetype:</span>
                  <span className="ll:text-primary ll:font-mono">
                    {selectedLayer?.archetype || "—"}
                  </span>
                </div>
                <div>
                  <span className="ll:text-secondary ll:block">Visibility / Lock:</span>
                  <span className="ll:text-primary">
                    {selectedLayer ? (
                      `${selectedLayer.visible === false ? "Hidden" : "Visible"}, ${selectedLayer.locked ? "Locked" : "Unlocked"}`
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
                <div>
                  <span className="ll:text-secondary ll:block">Child Layers:</span>
                  <span className="ll:text-primary">
                    {selectedLayer ? `${selectedLayer.children.length} direct children` : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Document Layers Visual Mockup */}
            <div className="ll:flex-1 ll:flex ll:flex-col ll:p-6 ll:bg-surface-backdrop ll:border ll:border-border ll:rounded-md ll:overflow-hidden">
              <span className="ll:text-small ll:font-semibold ll:text-secondary ll:mb-4">
                Canvas Preview (Interactive Selection)
              </span>

              <div className="ll:flex-1 ll:flex ll:flex-wrap ll:gap-4 ll:items-start ll:content-start ll:overflow-y-auto">
                {Object.values(layers)
                  .filter((l) => (filterByActivePage ? l.parentId === activePage?.rootElementId || l.id === activePage?.rootElementId : l.parentId === null))
                  .map((layer) => {
                    const isSelected = selectedIds.includes(layer.id);
                    return (
                      <div
                        key={layer.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => useSelectionStore.getState().select(layer.id, "element")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            useSelectionStore.getState().select(layer.id, "element");
                          }
                        }}
                        className={`ll:flex ll:flex-col ll:p-4 ll:rounded-md ll:border ll:cursor-pointer ll:transition-colors ${
                          isSelected
                            ? "ll:bg-select-bg ll:border-primary ll:text-primary"
                            : "ll:bg-surface-panel ll:border-border ll:text-primary ll:hover:bg-surface-hover"
                        }`}
                        style={{ minWidth: 200, minHeight: 100 }}
                      >
                        <div className="ll:flex ll:items-center ll:justify-between ll:mb-2">
                          <span className="ll:font-medium ll:text-small">{layer.name}</span>
                          <span className="ll:text-micro ll:text-secondary">{layer.archetype}</span>
                        </div>
                        <div className="ll:flex ll:items-center ll:gap-2 ll:text-micro ll:text-secondary ll:mt-auto">
                          <span>{layer.children.length} kids</span>
                          {layer.visible === false && <span className="ll:text-muted">• Hidden</span>}
                          {layer.locked && <span className="ll:text-muted">• Locked</span>}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Command & Event Status Bar */}
            <div
              role="status"
              aria-live="polite"
              className="ll:flex ll:items-center ll:justify-between ll:px-3 ll:py-2 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:text-small"
            >
              <span className="ll:text-secondary">Activity Status:</span>
              <span className="ll:font-mono ll:text-primary ll:font-medium">{lastAction}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
