"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { EditorMode } from "@/editor/components";
import type { CanvasTool, ShapeTool } from "@/editor/shell/canvas-chrome/types";
import { useCameraStore } from "@/core/store/useCameraStore";
import { useSnapStore } from "@/core/store/useSnapStore";
import { useToolStore } from "@/core/store/useToolStore";
import { useHistoryStore } from "@/core/store/useHistoryStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import { projectSession } from "@/core/storage/ProjectSession";
import {
  defineCommand,
  getCommand,
  isCommandAvailable,
  invokeCommand,
  tryRunCommand,
} from "@/core/commands";
import { transport, transportStore } from "@/core/time/transport";
import { isTextEditingTarget, normalizeShortcut } from "@/core/commands/normalize";
import { getAllCommands, getContextKeys } from "@/core/commands";
import { useExportUiStore } from "@/core/store/useExportUiStore";
import { useAgentUiStore } from "@/core/store/useAgentUiStore";
import { listFrames } from "@/core/frames/frames";
import { motionActions, useMotionModel } from "@/editor/motion-model";
import { getDocument } from "@/core/store/documentState";
import { useProjectStore } from "@/core/store/useProjectStore";
import { useProjectMetaStore } from "@/core/store/useProjectMetaStore";
import { ProjectDatabase, generateProjectId } from "@/core/storage/ProjectDatabase";
import { embedAssets, restoreAssets } from "@/core/assets/embed";
import { getAssetStore } from "@/core/assets/AssetStore";
import { lazyFileName, parseLazyFile, serializeLazyFile } from "@/core/storage/lazyFile";
import { executeStagePreset, presetForBreakpoint } from "@/editor/stage/presetBreakpoints";
import { useBreakpointStore } from "@/core/store/useBreakpointStore";
import { breakpointsOf } from "@/core/breakpoints/breakpoints";

export interface UseEditorActionsOptions {
  initialMode?: EditorMode;
  initialLeftCollapsed?: boolean;
  initialRightCollapsed?: boolean;
  /** Called synchronously before a mode change commits, so the shell can capture the old panel content for the transition. */
  onBeforeModeChange?: (next: EditorMode) => void;
}

export interface UseEditorActionsReturn {
  // Modes & layout
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  isLeftCollapsed: boolean;
  setIsLeftCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isRightCollapsed: boolean;
  setIsRightCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  togglePanel: (panel: "lc" | "rc", open?: boolean) => void;
  toggleBothPanels: () => void;
  isZen: boolean;
  setIsZen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleZen: () => void;

  // Tools & shapes
  activeTool: CanvasTool;
  setActiveTool: (tool: CanvasTool) => void;
  activeShape: ShapeTool;
  setActiveShape: (shape: ShapeTool) => void;

  // Overlays
  isInsertOpen: boolean;
  setIsInsertOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleInsert: (open?: boolean) => void;
  isAiBoxOpen: boolean;
  setIsAiBoxOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleAiBox: (open?: boolean) => void;
  isViewOptionsOpen: boolean;
  setIsViewOptionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleViewOptions: (open?: boolean) => void;

  // Viewport / Camera
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  zoom100: () => void;
  zoomFit: () => void;
  zoomSelection: () => void;
  viewportPreset: "1440" | "768" | "375";
  setViewportPreset: (preset: "1440" | "768" | "375") => void;

  // Snapping & Rulers
  showRulers: boolean;
  toggleRulers: () => void;
  snapObjects: boolean;
  toggleSnapObjects: () => void;
  snapGuides: boolean;
  toggleSnapGuides: () => void;
  snapToGrid: boolean;
  toggleSnapToGrid: () => void;

  // File import / export
  exportProjectFile: () => Promise<void>;
  importProjectFile: () => void;

  // History
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Search & Menu dispatcher
  handleSearch: () => void;
  handleMenuAction: (id: string) => void;
}

/** Whether a command currently runs for this normalized key. */
function shortcutHasCommand(shortcut: string): boolean {
  const ctx = getContextKeys();
  return getAllCommands().some((c) => {
    if (!c.keybinding) return false;
    const keys = Array.isArray(c.keybinding) ? c.keybinding : [c.keybinding];
    return keys.includes(shortcut) && (!c.when || c.when(ctx));
  });
}

export function useEditorActions(
  options: UseEditorActionsOptions = {}
): UseEditorActionsReturn {
  const router = useRouter();
  const {
    initialMode = "design",
    initialLeftCollapsed = false,
    initialRightCollapsed = false,
    onBeforeModeChange,
  } = options;

  // Mode state: Design | Motion | Code
  const [mode, setModeState] = useState<EditorMode>(initialMode);

  // Panels collapsed state
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(initialLeftCollapsed);
  const [isRightCollapsed, setIsRightCollapsed] = useState(initialRightCollapsed);

  // Zen mode (Hide interface) - Tab shortcut
  const [isZen, setIsZen] = useState(false);

  // Viewport preset (Desktop: 1440, Tablet: 768, Mobile: 375)
  const [viewportPreset, setViewportPresetState] = useState<"1440" | "768" | "375">("1440");

  // Keep viewportPresetState in sync when breakpoint is changed elsewhere (e.g. artboard dropdown)
  useEffect(() => {
    return useBreakpointStore.subscribe((state) => {
      const doc = getDocument();
      const p = presetForBreakpoint(breakpointsOf(doc), state.activeId);
      setViewportPresetState(p);
    });
  }, []);

  const setViewportPreset = useCallback((preset: "1440" | "768" | "375") => {
    setViewportPresetState(preset);
    executeStagePreset(preset);
    const SIZES: Record<string, { width: number; height: number }> = {
      "1440": { width: 1440, height: 900 },
      "768": { width: 768, height: 1024 },
      "375": { width: 375, height: 812 },
    };
    const s = SIZES[preset] || SIZES["1440"];
    useCameraStore.getState().fitToRect(
      { x: 0, y: 0, width: s.width, height: s.height },
      { padding: 48, maxZoom: 1, bottomInset: 56 }
    );
  }, []);

  // Snapping store bindings
  const snapObjects = useSnapStore((s) => s.objects);
  const snapGuides = useSnapStore((s) => s.guides);
  const snapToGrid = useSnapStore((s) => s.grid);

  const toggleSnapObjects = useCallback(() => {
    useSnapStore.getState().toggle("objects");
  }, []);

  const toggleSnapGuides = useCallback(() => {
    useSnapStore.getState().toggle("guides");
  }, []);

  const toggleSnapToGrid = useCallback(() => {
    useSnapStore.getState().toggle("grid");
  }, []);

  // Real Project Export (.lazy.json download)
  const exportProjectFile = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const state = useProjectStore.getState();
      const meta = useProjectMetaStore.getState();
      const record = meta.projectId ? await ProjectDatabase.getProject(meta.projectId) : null;
      const snapshot = state.getSnapshot();
      const embed = await embedAssets(snapshot.document, getAssetStore()).catch(() => undefined);
      const blob = new Blob([serializeLazyFile(snapshot, record?.settings, embed)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = lazyFileName(meta.projectName || "project");
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Export project file failed:", err);
    }
  }, []);

  // Real Project Import (.lazy.json upload)
  const importProjectFile = useCallback(() => {
    if (typeof window === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.lazy.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const lazy = parseLazyFile(text);
        if (lazy.assets.embedded) {
          await restoreAssets(lazy.assets.embedded, getAssetStore()).catch(() => undefined);
        }
        const newId = generateProjectId();
        await projectSession.open(newId, {
          create: {
            name: lazy.project.name,
            settings: lazy.project.settings,
            snapshot: lazy.snapshot,
          },
        });
        const url = new URL(window.location.href);
        url.searchParams.set("projectId", newId);
        window.history.replaceState({}, "", url.pathname + url.search);
      } catch (err) {
        console.error("Import project file failed:", err);
      }
    };
    input.click();
  }, []);

  // Active tool and shape
  const [activeTool, setActiveToolState] = useState<CanvasTool>("select");
  const [activeShape, setActiveShapeState] = useState<ShapeTool>("box");

  // Floating overlays
  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [isAiBoxOpen, setIsAiBoxOpen] = useState(false);
  const [isViewOptionsOpen, setIsViewOptionsOpen] = useState(false);

  // Reactive store state
  const cameraZoom = useCameraStore((s) => s.camera.zoom);
  const showRulers = useSnapStore((s) => s.rulers);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);

  // Sync mode with canvas view store
  const setMode = useCallback((newMode: EditorMode) => {
    onBeforeModeChange?.(newMode);
    setModeState(newMode);
    if (newMode === "design") {
      useCanvasViewStore.getState().setMode("design");
    } else {
      useCanvasViewStore.getState().setMode("preview");
    }
  }, [onBeforeModeChange]);

  // Sync tool selection with core tool store
  const setActiveTool = useCallback((tool: CanvasTool) => {
    setActiveToolState(tool);
    const toolMap: Record<CanvasTool, string> = {
      select: "select",
      hand: "pan",
      frame: "frame",
      shape: "rectangle",
      text: "text",
      image: "select",
      pen: "pen",
      pencil: "pencil",
    };
    useToolStore.getState().setActive(toolMap[tool] ?? "select");
  }, []);

  // Sync shape selection with core tool store
  const setActiveShape = useCallback((shape: ShapeTool) => {
    setActiveShapeState(shape);
    const shapeMap: Record<ShapeTool, string> = {
      box: "rectangle",
      circle: "ellipse",
      line: "line",
      arrow: "arrow",
      poly: "polygon",
      star: "star",
    };
    useToolStore.getState().setActive(shapeMap[shape] ?? "rectangle");
  }, []);

  // Toggle single panel
  const togglePanel = useCallback((panel: "lc" | "rc", open?: boolean) => {
    if (panel === "lc") {
      setIsLeftCollapsed((prev) => (open !== undefined ? !open : !prev));
    } else if (panel === "rc") {
      setIsRightCollapsed((prev) => (open !== undefined ? !open : !prev));
    }
  }, []);

  // Toggle both panels together (Ctrl+\)
  const toggleBothPanels = useCallback(() => {
    const anyOpen = !isLeftCollapsed || !isRightCollapsed;
    setIsLeftCollapsed(anyOpen);
    setIsRightCollapsed(anyOpen);
  }, [isLeftCollapsed, isRightCollapsed]);

  // Toggle Zen mode (Tab)
  const toggleZen = useCallback(() => {
    setIsZen((prev) => !prev);
  }, []);

  // Overlays mutual exclusivity
  const toggleInsert = useCallback((open?: boolean) => {
    setIsInsertOpen((prev) => {
      const next = open !== undefined ? open : !prev;
      if (next) {
        setIsAiBoxOpen(false);
        setIsViewOptionsOpen(false);
      }
      return next;
    });
  }, []);

  const toggleAiBox = useCallback((open?: boolean) => {
    setIsAiBoxOpen((prev) => {
      const next = open !== undefined ? open : !prev;
      if (next) {
        setIsInsertOpen(false);
        setIsViewOptionsOpen(false);
      }
      return next;
    });
  }, []);

  const toggleViewOptions = useCallback((open?: boolean) => {
    setIsViewOptionsOpen((prev) => {
      const next = open !== undefined ? open : !prev;
      if (next) {
        setIsInsertOpen(false);
        setIsAiBoxOpen(false);
      }
      return next;
    });
  }, []);

  // Camera zoom actions
  const zoomIn = useCallback(() => {
    useCameraStore.getState().stepZoom(1);
  }, []);

  const zoomOut = useCallback(() => {
    useCameraStore.getState().stepZoom(-1);
  }, []);

  const zoom100 = useCallback(() => {
    useCameraStore.getState().zoomTo100();
  }, []);

  const zoomFit = useCallback(() => {
    const doc = getDocument();
    const frames = listFrames(doc.layers);
    if (frames.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const f of frames) {
        minX = Math.min(minX, f.x);
        minY = Math.min(minY, f.y);
        maxX = Math.max(maxX, f.x + f.width);
        maxY = Math.max(maxY, f.y + f.height);
      }
      useCameraStore.getState().fitToRect(
        { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        { padding: 48, maxZoom: 1, bottomInset: 56 }
      );
    } else {
      useCameraStore.getState().fitToRect(
        { x: 0, y: 0, width: 1440, height: 900 },
        { padding: 48, maxZoom: 1, bottomInset: 56 }
      );
    }
  }, []);

  const zoomSelection = useCallback(() => {
    const selectedIds = useSelectionStore.getState().selectedIds;
    const doc = getDocument();
    if (selectedIds.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let found = false;

      for (const id of selectedIds) {
        const layer = doc.layers[id];
        if (layer && layer.properties) {
          const x = Number(layer.properties["frame.x"] ?? 0);
          const y = Number(layer.properties["frame.y"] ?? 0);
          const width = Number(layer.properties["frame.width"] ?? 100);
          const height = Number(layer.properties["frame.height"] ?? 100);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + width);
          maxY = Math.max(maxY, y + height);
          found = true;
        }
      }

      if (found) {
        useCameraStore.getState().fitToRect(
          { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
          { padding: 64, maxZoom: 2, bottomInset: 56 }
        );
        return;
      }
    }
    zoomFit();
  }, [zoomFit]);

  // Snapping / Rulers toggle
  const toggleRulers = useCallback(() => {
    useSnapStore.getState().toggle("rulers");
  }, []);

  // History undo / redo
  const undo = useCallback(() => {
    invokeCommand("edit.undo");
  }, []);

  const redo = useCallback(() => {
    invokeCommand("edit.redo");
  }, []);

  // Open Command Palette
  const handleSearch = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("antigravity:open_command_palette"));
    }
  }, []);

  // Central Menu Action Dispatcher
  const handleMenuAction = useCallback(
    (id: string) => {
      switch (id) {
        // App / Navigation
        case "app.back": {
          void projectSession.flush().finally(() => {
            router.push("/");
          });
          break;
        }
        case "app.search": {
          handleSearch();
          break;
        }
        case "app.settings": {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("antigravity:open_settings"));
          }
          break;
        }

        // File operations
        case "file.new": {
          void projectSession.flush().finally(() => {
            const newId = generateProjectId();
            router.push(`/editor?projectId=${newId}`);
          });
          break;
        }
        case "file.open":
        case "file.import": {
          importProjectFile();
          break;
        }
        case "file.save": {
          invokeCommand("file.save");
          break;
        }
        case "file.exportCode": {
          useExportUiStore.getState().open();
          break;
        }
        case "file.connectAgent": {
          useAgentUiStore.getState().open();
          break;
        }
        case "file.copyLink": {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            void navigator.clipboard.writeText(window.location.href).catch(() => undefined);
          }
          break;
        }
        case "file.exportFile": {
          void exportProjectFile();
          break;
        }

        // Edit operations
        case "edit.undo": {
          undo();
          break;
        }
        case "edit.redo": {
          redo();
          break;
        }
        case "edit.cut": {
          invokeCommand("edit.cut");
          break;
        }
        case "edit.copy": {
          invokeCommand("edit.copy");
          break;
        }
        case "edit.paste": {
          invokeCommand("edit.paste");
          break;
        }
        case "edit.pasteInPlace": {
          invokeCommand("edit.pasteInPlace");
          break;
        }
        case "edit.selectAll": {
          invokeCommand("selection.all");
          break;
        }
        case "edit.duplicate": {
          invokeCommand("edit.duplicate");
          break;
        }
        case "edit.delete": {
          invokeCommand("edit.delete");
          break;
        }
        case "edit.group": {
          invokeCommand("edit.group");
          break;
        }
        case "edit.ungroup": {
          invokeCommand("edit.ungroup");
          break;
        }

        // Align & Distribute
        case "align.left": {
          invokeCommand("align.left");
          break;
        }
        case "align.center": {
          invokeCommand("align.hcenter");
          break;
        }
        case "align.right": {
          invokeCommand("align.right");
          break;
        }
        case "align.top": {
          invokeCommand("align.top");
          break;
        }
        case "align.middle": {
          invokeCommand("align.vcenter");
          break;
        }
        case "align.bottom": {
          invokeCommand("align.bottom");
          break;
        }
        case "align.distributeH": {
          invokeCommand("distribute.horizontal");
          break;
        }
        case "align.distributeV": {
          invokeCommand("distribute.vertical");
          break;
        }

        // View operations
        case "view.zoomIn": {
          zoomIn();
          break;
        }
        case "view.zoomOut": {
          zoomOut();
          break;
        }
        case "view.zoom100": {
          zoom100();
          break;
        }
        case "view.fit": {
          zoomFit();
          break;
        }
        case "view.zoomSelection": {
          zoomSelection();
          break;
        }
        case "view.rulers": {
          toggleRulers();
          break;
        }
        case "view.options": {
          toggleViewOptions(true);
          break;
        }
        case "view.hideInterface": {
          toggleZen();
          break;
        }
        case "view.fullscreen": {
          if (typeof document !== "undefined") {
            if (document.fullscreenElement) {
              void document.exitFullscreen().catch(() => undefined);
            } else {
              void document.documentElement.requestFullscreen().catch(() => undefined);
            }
          }
          break;
        }

        // Window / Panels
        case "window.leftPanel": {
          togglePanel("lc");
          break;
        }
        case "window.rightPanel": {
          togglePanel("rc");
          break;
        }
        case "window.assets": {
          setIsLeftCollapsed(false);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("antigravity:focus_tab", { detail: "assets" })
            );
          }
          break;
        }
        case "window.layouts": {
          // Preset cycle / layout options
          break;
        }
        case "layouts.design": {
          setMode("design");
          break;
        }
        case "layouts.animate": {
          setMode("motion");
          break;
        }
        case "layouts.code": {
          setMode("code");
          break;
        }
        case "layouts.debug": {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("antigravity:open_debug"));
          }
          break;
        }
        case "view.desktop": {
          setViewportPreset("1440");
          break;
        }
        case "view.tablet": {
          setViewportPreset("768");
          break;
        }
        case "view.mobile": {
          setViewportPreset("375");
          break;
        }
        case "window.resetLayout": {
          setIsLeftCollapsed(false);
          setIsRightCollapsed(false);
          setIsZen(false);
          break;
        }
        case "window.outputLog":
        case "window.executionTrace":
        case "window.undoHistory":
        case "window.versionHistory":
        case "window.referenceViewer":
        case "window.plugins":
        case "window.deployment":
        case "window.logic":
        case "window.data": {
          // Documented tool panel trigger
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("antigravity:open_tool", { detail: id })
            );
          }
          break;
        }
        case "window.globalSearch": {
          handleSearch();
          break;
        }

        // Help
        case "help.shortcuts": {
          handleSearch();
          break;
        }
        case "help.demo": {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("antigravity:toggle_demo"));
          }
          break;
        }
        case "help.docs": {
          if (typeof window !== "undefined") {
            window.open(
              "https://github.com",
              "_blank",
              "noopener,noreferrer"
            );
          }
          break;
        }
        case "help.about": {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("antigravity:open_about"));
          }
          break;
        }

        default: {
          tryRunCommand(id);
          break;
        }
      }
    },
    [
      handleSearch,
      undo,
      redo,
      zoomIn,
      zoomOut,
      zoom100,
      zoomFit,
      zoomSelection,
      toggleRulers,
      toggleViewOptions,
      toggleZen,
      togglePanel,
      setMode,
      setViewportPreset,
      exportProjectFile,
      importProjectFile,
      router,
    ]
  );

  // Register view and layout commands once at mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const unregisters: (() => void)[] = [];

    // Custom view/shell commands
    unregisters.push(
      defineCommand({
        id: "view.zoomIn",
        title: "Zoom In",
        category: "View",
        run: zoomIn,
      }),
      defineCommand({
        id: "view.zoomOut",
        title: "Zoom Out",
        category: "View",
        run: zoomOut,
      }),
      defineCommand({
        id: "view.zoom100",
        title: "Zoom to 100%",
        category: "View",
        run: zoom100,
      }),
      defineCommand({
        id: "view.zoomReset",
        title: "Reset Zoom (100%)",
        category: "View",
        run: zoom100,
      }),
      defineCommand({
        id: "view.fit",
        title: "Fit to Screen",
        category: "View",
        run: zoomFit,
      }),
      defineCommand({
        id: "canvas.zoomToFit",
        title: "Fit to Screen",
        category: "View",
        run: zoomFit,
      }),
      defineCommand({
        id: "view.zoomSelection",
        title: "Zoom to Selection",
        category: "View",
        run: zoomSelection,
      }),
      defineCommand({
        id: "canvas.zoomToSelection",
        title: "Zoom to Selection",
        category: "View",
        run: zoomSelection,
      }),
      defineCommand({
        id: "view.rulers",
        title: "Show / Hide Rulers",
        category: "View",
        run: toggleRulers,
      }),
      defineCommand({
        id: "view.toggleRulers",
        title: "Show / Hide Rulers",
        category: "View",
        run: toggleRulers,
      }),
      defineCommand({
        id: "view.options",
        title: "View Options...",
        category: "View",
        run: () => toggleViewOptions(true),
      }),
      defineCommand({
        id: "view.hideInterface",
        title: "Hide Interface",
        category: "View",
        run: toggleZen,
      }),
      defineCommand({
        id: "view.fullscreen",
        title: "Toggle Fullscreen",
        category: "View",
        run: () => handleMenuAction("view.fullscreen"),
      }),
      defineCommand({
        id: "view.toggleFullscreen",
        title: "Toggle Fullscreen",
        category: "View",
        run: () => handleMenuAction("view.fullscreen"),
      }),
      defineCommand({
        id: "shell.togglePanels",
        title: "Toggle Panels",
        category: "View",
        run: toggleBothPanels,
      }),
      defineCommand({
        id: "file.exportProjectFile",
        title: "Export Project File",
        category: "File",
        run: exportProjectFile,
      }),
      defineCommand({
        id: "file.importProjectFile",
        title: "Import Project File",
        category: "File",
        run: importProjectFile,
      }),
      defineCommand({
        id: "edit.selectAll",
        title: "Select All",
        category: "Selection",
        run: () => invokeCommand("selection.all"),
      }),
      defineCommand({
        id: "align.center",
        title: "Align Horizontal Centers",
        category: "Arrange",
        run: () => invokeCommand("align.hcenter"),
      }),
      defineCommand({
        id: "align.middle",
        title: "Align Vertical Centers",
        category: "Arrange",
        run: () => invokeCommand("align.vcenter"),
      }),
      defineCommand({
        id: "align.distributeH",
        title: "Distribute Horizontal Spacing",
        category: "Arrange",
        run: () => invokeCommand("distribute.horizontal"),
      }),
      defineCommand({
        id: "align.distributeV",
        title: "Distribute Vertical Spacing",
        category: "Arrange",
        run: () => invokeCommand("distribute.vertical"),
      }),
      defineCommand({
        id: "layouts.design",
        title: "Design Layout",
        category: "Layout",
        run: () => setMode("design"),
      }),
      defineCommand({
        id: "layouts.animate",
        title: "Animate Layout",
        category: "Layout",
        run: () => setMode("motion"),
      }),
      defineCommand({
        id: "layouts.code",
        title: "Code Layout",
        category: "Layout",
        run: () => setMode("code"),
      }),
      defineCommand({
        id: "viewport.desktop",
        title: "Desktop Viewport (1440px)",
        category: "View",
        run: () => setViewportPreset("1440"),
      }),
      defineCommand({
        id: "viewport.tablet",
        title: "Tablet Viewport (768px)",
        category: "View",
        run: () => setViewportPreset("768"),
      }),
      defineCommand({
        id: "viewport.mobile",
        title: "Mobile Viewport (375px)",
        category: "View",
        run: () => setViewportPreset("375"),
      })
    );

    return () => {
      for (const unreg of unregisters) {
        unreg();
      }
    };
  }, [
    zoomIn,
    zoomOut,
    zoom100,
    zoomFit,
    zoomSelection,
    toggleRulers,
    toggleViewOptions,
    toggleZen,
    toggleBothPanels,
    handleMenuAction,
    exportProjectFile,
    importProjectFile,
    setMode,
    setViewportPreset,
  ]);

  // Keyboard shortcut layer covering prototype shortcuts, ignored during text editing
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ignore while typing in inputs
      if (isTextEditingTarget(e.target)) {
        return;
      }
      // 2. A key the command bus answers is its alone (it has its own listener): running it here too made Undo undo two
      // steps and Duplicate make two copies. Copy and paste are the browser's own events (installClipboardEvents).
      const shortcut = normalizeShortcut(e);
      if (e.defaultPrevented || (shortcut && shortcutHasCommand(shortcut))) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key.toLowerCase() === "c" || e.key.toLowerCase() === "v" || e.key.toLowerCase() === "x")) return;

      const key = e.key.toLowerCase();
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;

      // Escape closes overlays and exits preview
      if (e.key === "Escape") {
        if (useCanvasViewStore.getState().mode === "preview") {
          useCanvasViewStore.getState().setMode("design");
          e.preventDefault();
          return;
        }
        if (isInsertOpen) {
          setIsInsertOpen(false);
          e.preventDefault();
          return;
        }
        if (isAiBoxOpen) {
          setIsAiBoxOpen(false);
          e.preventDefault();
          return;
        }
        if (isViewOptionsOpen) {
          setIsViewOptionsOpen(false);
          e.preventDefault();
          return;
        }
        return;
      }

      // Tab toggles hide interface (Zen mode)
      if (e.key === "Tab" && !isCtrl && !isShift && !isAlt) {
        e.preventDefault();
        toggleZen();
        return;
      }

      // F11 Fullscreen
      if (e.key === "F11") {
        e.preventDefault();
        handleMenuAction("view.fullscreen");
        return;
      }

      // F1 Keyboard shortcuts
      if (e.key === "F1") {
        e.preventDefault();
        handleMenuAction("help.shortcuts");
        return;
      }

      // F2 Rename layer
      if (e.key === "F2") {
        e.preventDefault();
        invokeCommand("layer.rename");
        return;
      }

      // Ctrl shortcuts:
      if (isCtrl && !isAlt) {
        if (key === "k" || key === "p") {
          e.preventDefault();
          handleMenuAction("app.search");
          return;
        }
        if (key === "\\" || e.code === "Backslash") {
          e.preventDefault();
          toggleBothPanels();
          return;
        }
        if (key === "0" || e.code === "Digit0") {
          e.preventDefault();
          zoom100();
          return;
        }
        if (key === "+" || key === "=") {
          e.preventDefault();
          zoomIn();
          return;
        }
        if (key === "-") {
          e.preventDefault();
          zoomOut();
          return;
        }
        if (key === ",") {
          e.preventDefault();
          handleMenuAction("app.settings");
          return;
        }
        if (key === "z") {
          e.preventDefault();
          if (isShift) {
            redo();
          } else {
            undo();
          }
          return;
        }
        if (key === "y") {
          e.preventDefault();
          redo();
          return;
        }
        if (key === "s") {
          e.preventDefault();
          invokeCommand("file.save");
          return;
        }
        if (key === "a") {
          e.preventDefault();
          invokeCommand("selection.all");
          return;
        }
        if (key === "d") {
          e.preventDefault();
          invokeCommand("edit.duplicate");
          return;
        }
        if (key === "]" || e.code === "BracketRight") {
          e.preventDefault();
          if (isShift) {
            invokeCommand("layer.bringToFront");
          } else {
            invokeCommand("layer.bringForward");
          }
          return;
        }
        if (key === "[" || e.code === "BracketLeft") {
          e.preventDefault();
          if (isShift) {
            invokeCommand("layer.sendToBack");
          } else {
            invokeCommand("layer.sendBackward");
          }
          return;
        }
        if (key === "h" && isShift) {
          e.preventDefault();
          invokeCommand("layer.toggleHidden");
          return;
        }
        if (key === "l" && isShift) {
          e.preventDefault();
          invokeCommand("layer.toggleLock");
          return;
        }
        if (key === "g") {
          e.preventDefault();
          if (isShift) {
            invokeCommand("edit.ungroup");
          } else {
            invokeCommand("edit.group");
          }
          return;
        }
        if (key === "e") {
          e.preventDefault();
          handleMenuAction("file.exportCode");
          return;
        }
        if (key === "n") {
          e.preventDefault();
          handleMenuAction("file.new");
          return;
        }
        if (key === "o") {
          e.preventDefault();
          handleMenuAction("file.open");
          return;
        }
      }

      // Ctrl+Alt shortcuts
      if (isCtrl && isAlt && !isShift) {
        if (key === "g") {
          e.preventDefault();
          invokeCommand("edit.frameSelection");
          return;
        }
        if (key === "h") {
          e.preventDefault();
          invokeCommand("distribute.horizontal");
          return;
        }
        if (key === "v") {
          e.preventDefault();
          invokeCommand("distribute.vertical");
          return;
        }
        if (key === "t") {
          e.preventDefault();
          invokeCommand("layer.tidy");
          return;
        }
      }

      // Alt alignment shortcuts without Ctrl:
      if (!isCtrl && isAlt && !isShift) {
        if (key === "a") {
          e.preventDefault();
          invokeCommand("align.left");
          return;
        }
        if (key === "h") {
          e.preventDefault();
          invokeCommand("align.hcenter");
          return;
        }
        if (key === "d") {
          e.preventDefault();
          invokeCommand("align.right");
          return;
        }
        if (key === "w") {
          e.preventDefault();
          invokeCommand("align.top");
          return;
        }
        if (key === "v") {
          e.preventDefault();
          invokeCommand("align.vcenter");
          return;
        }
        if (key === "s") {
          e.preventDefault();
          invokeCommand("align.bottom");
          return;
        }
      }

      // Shift shortcuts without Ctrl or Alt:
      if (isShift && !isCtrl && !isAlt) {
        if (key === "t" && (mode === "motion" || mode === "code")) {
          e.preventDefault();
          motionActions.setFullWidth(!useMotionModel.getState().fullWidth);
          return;
        }
        if (key === "r") {
          e.preventDefault();
          toggleRulers();
          return;
        }
        if (key === "1" || e.code === "Digit1") {
          e.preventDefault();
          zoomFit();
          return;
        }
        if (key === "2" || e.code === "Digit2") {
          e.preventDefault();
          zoomSelection();
          return;
        }
        if (key === "l") {
          e.preventDefault();
          setActiveShape("arrow");
          setActiveTool("shape");
          return;
        }
        if (key === "y") {
          e.preventDefault();
          setActiveShape("star");
          setActiveTool("shape");
          return;
        }
      }

      // Single-key shortcuts without modifiers:
      if (!isCtrl && !isAlt && !isShift) {
        if (key === " " || e.code === "Space") {
          const tag = (document.activeElement as HTMLElement | null)?.tagName;
          if (tag !== "BUTTON" && tag !== "INPUT" && tag !== "TEXTAREA" && !(document.activeElement as HTMLElement | null)?.isContentEditable) {
            e.preventDefault();
            transport.togglePlay();
            return;
          }
        }
        if (key === "k") {
          e.preventDefault();
          if (transportStore.getState().playing) {
            transport.pause();
          } else {
            const kfCmd = getCommand("timeline.addKeyframe") || getCommand("keyframe.add");
            if (kfCmd && isCommandAvailable(kfCmd)) {
              tryRunCommand(kfCmd.id);
            }
          }
          return;
        }
        if (key === "v") {
          e.preventDefault();
          setActiveTool("select");
          return;
        }
        if (key === "h") {
          e.preventDefault();
          setActiveTool("hand");
          return;
        }
        if (key === "f") {
          e.preventDefault();
          setActiveTool("frame");
          return;
        }
        if (key === "t") {
          e.preventDefault();
          setActiveTool("text");
          return;
        }
        if (key === "p") {
          e.preventDefault();
          if (e.shiftKey) {
            setActiveTool("pencil");
          } else {
            setActiveTool("pen");
          }
          return;
        }
        if (key === "r") {
          e.preventDefault();
          setActiveShape("box");
          setActiveTool("shape");
          return;
        }
        if (key === "o") {
          e.preventDefault();
          setActiveShape("circle");
          setActiveTool("shape");
          return;
        }
        if (key === "l") {
          e.preventDefault();
          setActiveShape("line");
          setActiveTool("shape");
          return;
        }
        if (key === "y") {
          e.preventDefault();
          setActiveShape("poly");
          setActiveTool("shape");
          return;
        }
        if (key === "i") {
          e.preventDefault();
          toggleInsert();
          return;
        }
        if (key === "/") {
          e.preventDefault();
          toggleAiBox();
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          invokeCommand("edit.delete");
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    mode,
    isInsertOpen,
    isAiBoxOpen,
    isViewOptionsOpen,
    toggleZen,
    toggleBothPanels,
    zoomIn,
    zoomOut,
    zoom100,
    zoomFit,
    zoomSelection,
    toggleRulers,
    toggleInsert,
    toggleAiBox,
    undo,
    redo,
    setActiveTool,
    setActiveShape,
    handleMenuAction,
  ]);

  return useMemo(
    () => ({
      mode,
      setMode,
      isLeftCollapsed,
      setIsLeftCollapsed,
      isRightCollapsed,
      setIsRightCollapsed,
      togglePanel,
      toggleBothPanels,
      isZen,
      setIsZen,
      toggleZen,
      activeTool,
      setActiveTool,
      activeShape,
      setActiveShape,
      isInsertOpen,
      setIsInsertOpen,
      toggleInsert,
      isAiBoxOpen,
      setIsAiBoxOpen,
      toggleAiBox,
      isViewOptionsOpen,
      setIsViewOptionsOpen,
      toggleViewOptions,
      zoom: cameraZoom,
      zoomIn,
      zoomOut,
      zoom100,
      zoomFit,
      zoomSelection,
      showRulers,
      toggleRulers,
      canUndo,
      canRedo,
      undo,
      redo,
      handleSearch,
      handleMenuAction,
      viewportPreset,
      setViewportPreset,
      snapObjects,
      toggleSnapObjects,
      snapGuides,
      toggleSnapGuides,
      snapToGrid,
      toggleSnapToGrid,
      exportProjectFile,
      importProjectFile,
    }),
    [
      mode,
      setMode,
      isLeftCollapsed,
      isRightCollapsed,
      togglePanel,
      toggleBothPanels,
      isZen,
      toggleZen,
      activeTool,
      setActiveTool,
      activeShape,
      setActiveShape,
      isInsertOpen,
      toggleInsert,
      isAiBoxOpen,
      toggleAiBox,
      isViewOptionsOpen,
      toggleViewOptions,
      cameraZoom,
      zoomIn,
      zoomOut,
      zoom100,
      zoomFit,
      zoomSelection,
      showRulers,
      toggleRulers,
      canUndo,
      canRedo,
      undo,
      redo,
      handleSearch,
      handleMenuAction,
      viewportPreset,
      setViewportPreset,
      snapObjects,
      toggleSnapObjects,
      snapGuides,
      toggleSnapGuides,
      snapToGrid,
      toggleSnapToGrid,
      exportProjectFile,
      importProjectFile,
    ]
  );
}
