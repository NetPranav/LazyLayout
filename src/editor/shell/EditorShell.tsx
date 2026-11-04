"use client";

import React from "react";
import { TopBar } from "@/editor/components";
import { CanvasChrome } from "@/editor/shell/canvas-chrome";
import { RightPanelConnected } from "./RightPanelConnected";
import { LeftPanelConnected } from "@/editor/panels/layers";
import { Stage } from "@/editor/stage";
import { TimelinePanel } from "@/editor/panels/timeline";
import { CodePanel } from "@/editor/panels/code-view";
import { useProjectMetaStore } from "@/core/store/useProjectMetaStore";
import { useCollabStore } from "@/core/store/useCollabStore";
import type { CollabUser } from "@/editor/components/AvatarStack";
import { useProjectFiles } from "@/legacy-editor/shell/hooks/useProjectFiles";
import { useProjectLock } from "@/legacy-editor/shell/hooks/useProjectLock";
import { useShellCommands } from "@/legacy-editor/shell/hooks/useShellCommands";
import { projectSession } from "@/core/storage/ProjectSession";
import {
  RecoveryPrompt,
  SaveErrorBanner,
  ReadOnlyBanner,
  FileDropOverlay,
} from "./persistence";
import { useEditorActions } from "./useEditorActions";

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
  const actions = useEditorActions({
    initialMode: "design",
    initialLeftCollapsed: false,
    initialRightCollapsed: false,
  });

  // Project persistence, locking and shell commands
  const files = useProjectFiles();
  useProjectLock();

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

  // Bottom drawer height in motion/code modes
  const bottomHeight = actions.isZen
    ? "0"
    : actions.mode === "motion"
    ? "var(--ll-size-bottom-motion-h)"
    : actions.mode === "code"
    ? "var(--ll-size-bottom-code-h)"
    : "0";

  const topHeight = actions.isZen ? "0" : "auto";
  const leftWidth = actions.isZen || actions.isLeftCollapsed ? "0" : "var(--ll-size-panel-left-w)";
  const rightWidth = actions.isZen || actions.isRightCollapsed ? "0" : "var(--ll-size-panel-right-w)";

  return (
    <div
      data-mode={actions.mode}
      className={`editor-root ${actions.isZen ? "ll-zen " : ""}${
        actions.isLeftCollapsed ? "ll-lc " : ""
      }${
        actions.isRightCollapsed ? "ll-rc " : ""
      }ll:grid ll:relative ll:h-screen ll:w-screen ll:overflow-hidden ll:bg-surface-canvas ll:font-sans ll:text-primary ll:select-none ${className}`}
      style={{
        gridTemplateColumns: `${leftWidth} minmax(0, 1fr) ${rightWidth}`,
        gridTemplateRows: `${topHeight} minmax(0, 1fr) ${bottomHeight}`,
        gridTemplateAreas: `
          "top top top"
          "left canvas right"
          "left bottom right"
        `,
      }}
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
        style={{ gridArea: "top" }}
        className={`ll:w-full ll:flex ll:flex-col ${actions.isZen ? "ll:invisible ll:h-0" : "ll:visible"}`}
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
        />
        <ReadOnlyBanner />
      </div>

      {/* 2. Left panel slot in "left" grid area */}
      <div
        style={{ gridArea: "left" }}
        className={`ll-left ll-zone ll:h-full ll:overflow-hidden ll:relative ${
          actions.isZen || actions.isLeftCollapsed ? "ll:invisible ll:w-0" : "ll:visible"
        }`}
      >
        {left ?? (
          <LeftPanelConnected mode={actions.mode} />
        )}
      </div>

      {/* 3. Center canvas slot in "canvas" grid area */}
      <div
        style={{ gridArea: "canvas" }}
        className="ll-canvas ll:w-full ll:h-full ll:relative ll:overflow-hidden"
      >
        {center ?? (
          <CanvasChrome
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
              preset={actions.viewportPreset}
              onPresetChange={(p) => actions.setViewportPreset(p as "1440" | "768" | "375")}
            />
          </CanvasChrome>
        )}
      </div>

      {/* 4. Right panel slot in "right" grid area */}
      <div
        style={{ gridArea: "right" }}
        className={`ll-right ll-zone ll:h-full ll:overflow-hidden ll:relative ${
          actions.isZen || actions.isRightCollapsed ? "ll:invisible ll:w-0" : "ll:visible"
        }`}
      >
        {right ?? <RightPanelConnected mode={actions.mode} />}
      </div>

      {/* 5. Bottom area in "bottom" grid area (motion / code modes) */}
      {bottomHeight !== "0" && !actions.isZen && (
        <div
          style={{ gridArea: "bottom" }}
          className="ll-bottom ll:border-t ll:border-border ll:bg-surface-panel ll:overflow-hidden ll:relative"
        >
          {actions.mode === "motion" ? <TimelinePanel /> : <CodePanel />}
        </div>
      )}
    </div>
  );
}
