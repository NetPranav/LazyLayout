"use client";

import React, { useEffect, useLayoutEffect } from "react";
import { TopBar } from "@/editor/components";
import { CanvasChrome } from "@/editor/shell/canvas-chrome";
import { RightPanelConnected } from "./RightPanelConnected";
import { LeftPanelConnected } from "@/editor/panels/layers";
import { Stage } from "@/editor/stage";
import { TimelinePanel } from "@/editor/panels/timeline";
import { CodePanel } from "@/editor/panels/code-view";
import { documentStore } from "@/core/store/useDocumentStore";
import { useProjectMetaStore } from "@/core/store/useProjectMetaStore";
import { useCollabStore } from "@/core/store/useCollabStore";
import type { CollabUser } from "@/editor/components/AvatarStack";
import { useProjectFiles } from "@/legacy-editor/shell/hooks/useProjectFiles";
import { useProjectLock } from "@/legacy-editor/shell/hooks/useProjectLock";
import { useShellCommands } from "@/legacy-editor/shell/hooks/useShellCommands";
import { projectSession } from "@/core/storage/ProjectSession";
import { isUntouchedSeed, seedPrototypeDocument, upgradeSavedProject } from "./prototypeDocument";
import { ConnectedCommandPalette } from "./ConnectedCommandPalette";
import { FontSync } from "@/legacy-editor/fonts/FontSync";
import { insertCatalogItem } from "@/editor/shell/canvas-chrome/insertCommands";
import { ExportDialog } from "@/legacy-editor/shell/ExportDialog";
import { AgentDialog } from "@/legacy-editor/shell/AgentDialog";
import {
  RecoveryPrompt,
  SaveErrorBanner,
  ReadOnlyBanner,
  FileDropOverlay,
} from "./persistence";
import { useEditorActions } from "./useEditorActions";
import { useShellFx } from "./shellFx";
import { useMotionModel, installDocumentMotionSync } from "@/editor/motion-model";

export interface EditorShellProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  saving?: boolean;
  className?: string;
}

export function EditorShell({
  left,
  center,
  right,
  saving: propSaving = false,
  className = "",
}: EditorShellProps) {
  const saving = propSaving;
  const projectName = useProjectMetaStore((s) => s.projectName);

  // Core shell actions and keyboard shortcut layer
  const [aiPanelOpen, setAiPanelOpen] = React.useState(false);
  const { bindRoot, captureMode, sync, onSplitDown, onSplitDouble } = useShellFx();
  const actions = useEditorActions({
    initialMode: "design",
    initialLeftCollapsed: false,
    initialRightCollapsed: false,
    onBeforeModeChange: captureMode,
  });
  const timelineFullWidth = useMotionModel((s) => s.fullWidth);
  const bottomOpen = !actions.isZen && (actions.mode === "motion" || actions.mode === "code");
  const fullWidth = bottomOpen && timelineFullWidth;

  // Panel springs, mode-switch content transitions: runs before paint, after the new attributes are in the DOM.
  useLayoutEffect(() => {
    sync(actions.mode);
  }, [sync, actions.mode, actions.isLeftCollapsed, actions.isRightCollapsed, actions.isZen, fullWidth]);

  // Project persistence, locking and shell commands
  const files = useProjectFiles();
  useProjectLock();

  // Single centralized synchronization boundary between MDM v5 documentStore and Motion UI
  useEffect(() => installDocumentMotionSync(), []);

  // A brand-new project gets the sample page; one saved by an earlier version is brought up to date when it loads.
  useEffect(() => {
    let upgradedFor: unknown = null;
    const check = () => {
      const doc = documentStore.getState().document;
      if (isUntouchedSeed(doc.layers)) {
        seedPrototypeDocument();
        return;
      }
      if (upgradedFor !== doc.layers) {
        upgradedFor = doc.layers;
        upgradeSavedProject();
      }
    };
    check();
    return documentStore.subscribe(check);
  }, []);

  useShellCommands({
    toggleCommandPalette: actions.handleSearch,
    toggleGlobalSearch: actions.handleSearch,
    toggleAiCoPilot: () => actions.toggleAiBox(),
    dockFullPage: (panelId: string) => {
      if (panelId === "code") actions.setMode("code");
      else if (panelId === "sequencer" || panelId === "timeline") actions.setMode("motion");
      else if (panelId === "blueprint" || panelId === "logic") actions.setMode("design");
      else actions.handleMenuAction("window." + panelId);
    },
    showBottomTab: (tabId: string) => {
      if (tabId === "timeline" || tabId === "sequencer" || tabId === "curves") actions.setMode("motion");
      else if (tabId === "code" || tabId === "console") actions.setMode("code");
      else actions.handleMenuAction("window." + tabId);
    },
    exportProjectFile: () => void files.handleExportProjectFile(),
    openImportPicker: files.handleOpenImportPicker,
    openSettings: () => actions.handleMenuAction("app.settings"),
    selectPreset: (preset: string) => {
      if (preset === "design") actions.setMode("design");
      else if (preset === "animate" || preset === "sequencer") actions.setMode("motion");
      else if (preset === "code") actions.setMode("code");
    },
  });

  // Real collaborator presence resolution
  const connectedPeers = useCollabStore((s) => s.connectedPeers);
  const localUser = useCollabStore((s) => s.localUser);

  const collabUsers: CollabUser[] = React.useMemo(() => {
    const peers = Object.values(connectedPeers || {});
    if (peers.length === 0) return [];
    return [
      {
        id: localUser.id,
        name: localUser.name,
        initials: localUser.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        status: "You",
      },
      ...peers.map((p) => ({
        id: p.id,
        name: p.name,
        initials: p.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        status: p.role || "Viewing",
      })),
    ];
  }, [connectedPeers, localUser]);

  return (
    <div
      ref={bindRoot}
      data-mode={actions.mode}
      data-lc={actions.isLeftCollapsed ? "" : undefined}
      data-rc={actions.isRightCollapsed ? "" : undefined}
      data-zen={actions.isZen ? "" : undefined}
      data-fw={fullWidth ? "1" : "0"}
      className={`ll-editor-root editor-root ll-shell ll:grid ll:relative ll:h-screen ll:w-screen ll:overflow-hidden ll:bg-surface-canvas ll:font-sans ll:text-primary ll:select-none ${className}`}
    >
      {/* Persistence overlays & banners */}
      {files.recovery && (
        <RecoveryPrompt
          recovery={files.recovery}
          onRestore={() => {
            files.setRecovery(null);
            void projectSession.restoreRecovery();
          }}
          onDiscard={() => {
            files.setRecovery(null);
            void projectSession.discardRecovery();
          }}
        />
      )}
      <SaveErrorBanner
        fileError={files.fileError}
        onDismissFileError={() => files.setFileError(null)}
      />
      <FileDropOverlay visible={files.isFileDragOver} />

      {/* Zen mode hint when interface is hidden (prototype parity) */}
      {actions.isZen && (
        <span
          className="ll-zenhint ll:absolute ll:left-1/2 ll:top-2 ll:-translate-x-1/2 ll:font-mono ll:text-nano ll:font-medium ll:text-muted ll:z-50 ll:pointer-events-none"
        >
          Press Tab to show the interface
        </span>
      )}

      {/* 1. Top bar in "top" grid area */}
      <div
        className={`ll-shell-top ll:w-full ll:flex ll:flex-col ${actions.isZen ? "ll:invisible ll:h-0" : "ll:visible"}`}
      >
        <TopBar
          projectName={projectName}
          saving={saving}
          mode={actions.mode}
          onSelectMode={actions.setMode}
          canUndo={actions.canUndo}
          canRedo={actions.canRedo}
          onUndo={actions.undo}
          onRedo={actions.redo}
          onSearch={actions.handleSearch}
          isLeftCollapsed={actions.isLeftCollapsed}
          isRightCollapsed={actions.isRightCollapsed}
          onTogglePanel={actions.togglePanel}
          onMenuAction={actions.handleMenuAction}
          showRulers={actions.showRulers}
          isZen={actions.isZen}
          users={collabUsers}
          viewportPreset={actions.viewportPreset}
          onSelectPreset={actions.setViewportPreset}
        />
        <ReadOnlyBanner />
      </div>

      <ConnectedCommandPalette />
      <FontSync />
      <ExportDialog />
      <AgentDialog />

      {/* 2. Left panel slot in "left" grid area */}
      <div
        className="ll-shell-left"
      >
        {left ?? (
          <LeftPanelConnected mode={actions.mode} />
        )}
      </div>

      {/* 3. Center canvas slot in "canvas" grid area */}
      <div
        className="ll-shell-canvas ll:w-full ll:h-full ll:relative ll:overflow-hidden"
      >
        {center ?? (
          <CanvasChrome
            onAiExpand={() => setAiPanelOpen(true)}
            mode={actions.mode}
            activeTool={actions.activeTool}
            onSelectTool={actions.setActiveTool}
            activeShape={actions.activeShape}
            onSelectShape={actions.setActiveShape}
            zoom={actions.zoom}
            onZoomIn={actions.zoomIn}
            onZoomOut={actions.zoomOut}
            onZoom100={actions.zoom100}
            onZoomFit={actions.zoomFit}
            onZoomSelection={actions.zoomSelection}
            showRulers={actions.showRulers}
            onToggleRulers={actions.toggleRulers}
            snapObjects={actions.snapObjects}
            onToggleSnapObjects={actions.toggleSnapObjects}
            snapGuides={actions.snapGuides}
            onToggleSnapGuides={actions.toggleSnapGuides}
            snapToGrid={actions.snapToGrid}
            onToggleSnapToGrid={actions.toggleSnapToGrid}
            isInsertOpen={actions.isInsertOpen}
            onToggleInsert={actions.toggleInsert}
            isAiBoxOpen={actions.isAiBoxOpen}
            onToggleAiBox={actions.toggleAiBox}
            isViewOptionsOpen={actions.isViewOptionsOpen}
            onToggleViewOptions={actions.toggleViewOptions}
            canUndo={actions.canUndo}
            canRedo={actions.canRedo}
            onUndo={actions.undo}
            onRedo={actions.redo}
            panelsCollapsed={actions.isLeftCollapsed && actions.isRightCollapsed}
            onTogglePanels={actions.toggleBothPanels}
            onPreview={() =>
              actions.setMode(actions.mode === "design" ? "motion" : "design")
            }
            users={collabUsers}
          >
            <Stage
              zoom={actions.zoom}
              activeTool={actions.activeTool}
              activeShape={actions.activeShape}
              onToolDone={() => actions.setActiveTool("select")}
              onAddFrame={() => {
                insertCatalogItem("Frame");
              }}
              onInsert={actions.toggleInsert}
              onAskAi={actions.toggleAiBox}
              snapObjects={actions.snapObjects}
              snapGuides={actions.snapGuides}
              preset={actions.viewportPreset}
              onPresetChange={(p) => actions.setViewportPreset(p as "1440" | "768" | "375")}
            />
          </CanvasChrome>
        )}
      </div>

      {/* 4. Right panel slot in "right" grid area */}
      <div
        className="ll-shell-right"
      >
        {right ?? <RightPanelConnected mode={actions.mode} aiOpen={aiPanelOpen} onAiClose={() => setAiPanelOpen(false)} />}
      </div>

      {/* 5. Bottom area in "bottom" grid area (motion / code modes). The cell stays mounted so its row can spring open and closed. */}
      <div className="ll-shell-bottom">
        {bottomOpen && (
          <>
            <div
              className="ll-shell-bsplit"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize bottom panel"
              title="Drag to resize, double click to reset"
              onPointerDown={onSplitDown}
              onDoubleClick={onSplitDouble}
            />
            {actions.mode === "motion" ? <TimelinePanel height="100%" /> : <CodePanel />}
          </>
        )}
      </div>
    </div>
  );
}
