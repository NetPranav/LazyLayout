"use client";

import React, { useEffect, useLayoutEffect } from "react";
import { TopBar } from "@/editor/components";
import { CanvasChrome } from "@/editor/shell/canvas-chrome";
import { RightPanelConnected } from "./RightPanelConnected";
import { LeftPanelConnected } from "@/editor/panels/layers";
import { Stage } from "@/editor/stage";
import { TimelinePanel } from "@/editor/panels/timeline";
import { CodePanel } from "@/editor/panels/code-view";
import { documentStore, useLayers } from "@/core/store/useDocumentStore";
import { runCode } from "@/editor/panels/console";
import { useProjectMetaStore } from "@/core/store/useProjectMetaStore";
import { useCollabStore } from "@/core/store/useCollabStore";
import type { CollabUser } from "@/editor/components/AvatarStack";
import { useProjectFiles } from "@/legacy-editor/shell/hooks/useProjectFiles";
import { useProjectLock } from "@/legacy-editor/shell/hooks/useProjectLock";
import { useShellCommands } from "@/legacy-editor/shell/hooks/useShellCommands";
import { projectSession } from "@/core/storage/ProjectSession";
import { isUntouchedSeed, seedPrototypeDocument, upgradeSavedProject } from "./prototypeDocument";
import { FontSync } from "@/legacy-editor/fonts/FontSync";
import { insertCatalogItem } from "@/editor/shell/canvas-chrome/insertCommands";
import { ExportDialog } from "@/legacy-editor/shell/ExportDialog";
import { ExportDialog as RepoExportDialog } from "@/editor/shell/export-dialog";
import { useExportUiStore } from "@/core/store/useExportUiStore";
import { AgentDialog } from "@/legacy-editor/shell/AgentDialog";
import {
  RecoveryPrompt,
  SaveErrorBanner,
  ReadOnlyBanner,
  FileDropOverlay,
} from "./persistence";
import { useEditorActions } from "./useEditorActions";
import {
  useShellFx,
  useBottomCollapsed,
  LEFT_PANEL_MIN,
  LEFT_PANEL_DEFAULT,
  LEFT_PANEL_MAX,
  RIGHT_PANEL_MIN,
  RIGHT_PANEL_DEFAULT,
  RIGHT_PANEL_DEFAULT_COMPACT,
  RIGHT_PANEL_MAX,
} from "./shellFx";
import { useMotionModel, installDocumentMotionSync } from "@/editor/motion-model";
import { installTransportCommands } from "@/core/time/transportCommands";
import { installTransportDriver } from "@/core/time/transportDriver";
import { transport, transportStore } from "@/core/time/transport";

/** Where the playhead starts when the editor opens (it was the Motion panel's own start before the one clock). */
const OPENING_FRAME = 72;

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
  const [leftWidth, setLeftWidth] = React.useState(LEFT_PANEL_DEFAULT);
  const [rightWidth, setRightWidth] = React.useState(
    typeof window !== "undefined" && window.innerWidth <= 1200
      ? RIGHT_PANEL_DEFAULT_COMPACT
      : RIGHT_PANEL_DEFAULT
  );
  const {
    bindRoot,
    captureMode,
    sync,
    onSplitDown,
    onSplitDouble,
    onLeftSplitDown,
    onLeftSplitDouble,
    onLeftSplitKeyDown,
    onRightSplitDown,
    onRightSplitDouble,
    onRightSplitKeyDown,
    setTargetWidth,
  } = useShellFx();

  // Hydration-safe restore of user-persisted panel widths
  useEffect(() => {
    try {
      const savedL = localStorage.getItem("ll-lw");
      if (savedL) {
        const n = parseFloat(savedL);
        if (!isNaN(n) && n >= LEFT_PANEL_MIN && n <= LEFT_PANEL_MAX) {
          queueMicrotask(() => {
            setLeftWidth(n);
            setTargetWidth("left", n);
          });
        }
      }
      const savedR = localStorage.getItem("ll-rw");
      if (savedR) {
        const n = parseFloat(savedR);
        if (!isNaN(n) && n >= RIGHT_PANEL_MIN && n <= RIGHT_PANEL_MAX) {
          queueMicrotask(() => {
            setRightWidth(n);
            setTargetWidth("right", n);
          });
        }
      } else if (window.innerWidth <= 1200) {
        queueMicrotask(() => {
          setRightWidth(RIGHT_PANEL_DEFAULT_COMPACT);
          setTargetWidth("right", RIGHT_PANEL_DEFAULT_COMPACT);
        });
      }
    } catch (_) {}
  }, [setTargetWidth]);

  const actions = useEditorActions({
    initialMode: "design",
    initialLeftCollapsed: typeof window !== "undefined" && window.innerWidth <= 768,
    initialRightCollapsed: typeof window !== "undefined" && window.innerWidth <= 768,
    onBeforeModeChange: captureMode,
  });
  const timelineFullWidth = useMotionModel((s) => s.fullWidth);
  const bottomOpen = !actions.isZen && (actions.mode === "motion" || actions.mode === "code");
  // Full width belongs to the Motion timeline only; Code always keeps its side panels.
  const fullWidth = bottomOpen && actions.mode === "motion" && timelineFullWidth;
  const bcMotion = useBottomCollapsed("motion");
  const bcCode = useBottomCollapsed("code");
  const bottomCollapsed = bottomOpen && (actions.mode === "motion" ? bcMotion : bcCode);

  // Panel springs, mode-switch content transitions: runs before paint, after the new attributes are in the DOM.
  useLayoutEffect(() => {
    sync(
      actions.mode,
      actions.isLeftCollapsed,
      actions.isRightCollapsed,
      actions.isZen
    );
  }, [
    sync,
    actions.mode,
    actions.isLeftCollapsed,
    actions.isRightCollapsed,
    actions.isZen,
    fullWidth,
    bottomCollapsed,
  ]);

  // Project persistence, locking and shell commands
  const files = useProjectFiles();
  useProjectLock();

  // Single centralized synchronization boundary between MDM v5 documentStore and Motion UI
  useEffect(() => installDocumentMotionSync(), []);

  // One-clock transport command bindings and master driver
  useEffect(() => installTransportCommands(), []);
  useEffect(() => installTransportDriver(), []);
  // The editor opens with the playhead where the Motion panel always put it (frame 72, past the sample entrances), so
  // the canvas shows layers at rest rather than at the first frame of their entrance. Only on a fresh, untouched clock.
  useEffect(() => {
    const t = transportStore.getState();
    if (t.time === 0 && !t.playing) transport.seek(OPENING_FRAME / (t.fps || 60));
  }, []);

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

  // Reactive blank page detection (Item 3: when page has no layers, hide rulers and guides)
  const docLayers = useLayers();
  const isBlankPage = React.useMemo(() => {
    const layerEntries = Object.values(docLayers);
    if (layerEntries.length === 0) return true;
    if (
      layerEntries.length === 1 &&
      (layerEntries[0].id === "elem_canvas_root" || layerEntries[0].id === "el_root_container")
    ) {
      return layerEntries[0].children.length === 0;
    }
    return false;
  }, [docLayers]);

  // Responsive shell auto-collapse on narrow viewports <= 768px (Item 4)
  const { togglePanel } = actions;
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined" && window.innerWidth <= 768) {
        togglePanel("lc", false);
        togglePanel("rc", false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [togglePanel]);

  useShellCommands({
    // Ctrl+K is handled only by the Spotlight (CanvasChrome). These used to send "antigravity:open_command_palette",
    // which opened the full-screen palette on top of it. Nothing opens that palette any more.
    toggleCommandPalette: () => {
      // no-op: see above
    },
    toggleGlobalSearch: () => {
      // no-op: see above
    },
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
        src: localUser.avatarUrl,
        color: localUser.color,
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
        src: p.avatarUrl,
        color: p.color,
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
      data-bc={bottomCollapsed ? "1" : undefined}
      data-blank={isBlankPage ? "1" : undefined}
      className={`ll-editor-root editor-root app ${isBlankPage ? "blank ll-blank" : ""} ll-shell ll:grid ll:relative ll:h-screen ll:w-screen ll:overflow-hidden ll:bg-surface-canvas ll:font-sans ll:text-primary ll:select-none ${className}`}
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
          onExport={() => useExportUiStore.getState().open()}
        />
        <ReadOnlyBanner />
      </div>

      <FontSync />
      <ExportDialog />
      <RepoExportDialog />
      <AgentDialog />

      {/* 2. Left panel slot in "left" grid area */}
      <div className="ll-shell-left">
        {left ?? (
          <LeftPanelConnected mode={actions.mode} />
        )}
        {!actions.isLeftCollapsed && !actions.isZen && (
          <div
            className="ll-shell-lsplit"
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label="Resize left panel"
            aria-valuenow={Math.round(leftWidth)}
            aria-valuemin={LEFT_PANEL_MIN}
            aria-valuemax={LEFT_PANEL_MAX}
            title="Drag to resize, double click to reset"
            onPointerDown={(e) => onLeftSplitDown(e, setLeftWidth)}
            onDoubleClick={() => onLeftSplitDouble(() => setLeftWidth(LEFT_PANEL_DEFAULT))}
            onKeyDown={(e) => onLeftSplitKeyDown(e, setLeftWidth)}
          />
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
            showRulers={!isBlankPage && actions.showRulers}
            onToggleRulers={actions.toggleRulers}
            snapObjects={actions.snapObjects}
            onToggleSnapObjects={actions.toggleSnapObjects}
            snapGuides={actions.snapGuides}
            onToggleSnapGuides={actions.toggleSnapGuides}
            snapToGrid={actions.snapToGrid}
            onToggleSnapToGrid={actions.toggleSnapToGrid}
            gridStyle={actions.gridStyle}
            onGridStyleChange={actions.setGridStyle}
            gridSize={actions.gridSize}
            onGridSizeChange={actions.setGridSize}
            pixelGrid={actions.pixelGrid}
            onTogglePixelGrid={actions.togglePixelGrid}
            checkerboard={actions.checkerboard}
            onToggleCheckerboard={actions.toggleCheckerboard}
            theme={actions.theme}
            onThemeChange={actions.setTheme}
            motionFeel={actions.motionFeel}
            onMotionFeelChange={actions.setMotionFeel}
            dropdownBulge={actions.dropdownBulge}
            onDropdownBulgeChange={actions.setDropdownBulge}
            inspectMode={actions.inspectMode}
            onToggleInspectMode={actions.toggleInspectMode}
            canvasPan={actions.canvasPan}
            onToggleCanvasPan={actions.toggleCanvasPan}
            panMethod={actions.panMethod}
            onPanMethodChange={actions.setPanMethod}
            canvasZoom={actions.canvasZoom}
            onToggleCanvasZoom={actions.toggleCanvasZoom}
            zoomSpeed={actions.zoomSpeed}
            onZoomSpeedChange={actions.setZoomSpeed}
            worldAxes={actions.worldAxes}
            onToggleWorldAxes={actions.toggleWorldAxes}
            elementDragging={actions.elementDragging}
            onToggleElementDragging={actions.toggleElementDragging}
            reparenting={actions.reparenting}
            onToggleReparenting={actions.toggleReparenting}
            collisionMode={actions.collisionMode}
            onCollisionModeChange={actions.setCollisionMode}
            marqueeMode={actions.marqueeMode}
            onMarqueeModeChange={actions.setMarqueeMode}
            smartGuides={actions.smartGuides}
            onToggleSmartGuides={actions.toggleSmartGuides}
            snapThreshold={actions.snapThreshold}
            onSnapThresholdChange={actions.setSnapThreshold}
            isInsertOpen={actions.isInsertOpen}
            onToggleInsert={actions.toggleInsert}
            onInsertItem={insertCatalogItem}
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
            onRunCode={() => {
              if (actions.mode !== "code") {
                actions.setMode("code");
              }
              void runCode();
            }}
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
              smartGuides={actions.smartGuides}
              checkerboard={actions.checkerboard}
              pixelGrid={actions.pixelGrid}
              gridStyle={actions.gridStyle}
              gridSize={actions.gridSize}
              preset={actions.viewportPreset}
              onPresetChange={(p) => actions.setViewportPreset(p as "1440" | "768" | "375")}
            />
          </CanvasChrome>
        )}
      </div>

      {/* 4. Right panel slot in "right" grid area */}
      <div className="ll-shell-right">
        {!actions.isRightCollapsed && !actions.isZen && (
          <div
            className="ll-shell-rsplit"
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label="Resize right panel"
            aria-valuenow={Math.round(rightWidth)}
            aria-valuemin={RIGHT_PANEL_MIN}
            aria-valuemax={RIGHT_PANEL_MAX}
            title="Drag to resize, double click to reset"
            onPointerDown={(e) => onRightSplitDown(e, setRightWidth)}
            onDoubleClick={() =>
              onRightSplitDouble(() =>
                setRightWidth(
                  typeof window !== "undefined" && window.innerWidth <= 1200
                    ? RIGHT_PANEL_DEFAULT_COMPACT
                    : RIGHT_PANEL_DEFAULT
                )
              )
            }
            onKeyDown={(e) => onRightSplitKeyDown(e, setRightWidth)}
          />
        )}
        {right ?? (
          <RightPanelConnected
            mode={actions.mode}
            aiOpen={aiPanelOpen}
            onAiClose={() => setAiPanelOpen(false)}
          />
        )}
      </div>

      {/* 5. Bottom area in "bottom" grid area (motion / code modes). The cell stays mounted so its row can spring open and closed. */}
      <div className="ll-shell-bottom">
        {bottomOpen && (
          <>
            {!bottomCollapsed && (
              <div
                className="ll-shell-bsplit"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize bottom panel"
                title="Drag to resize, double click to reset"
                onPointerDown={onSplitDown}
                onDoubleClick={onSplitDouble}
              />
            )}
            {actions.mode === "motion" ? <TimelinePanel height="100%" /> : <CodePanel />}
          </>
        )}
      </div>
    </div>
  );
}
