"use client";

import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useDocument } from "@/core/store/useDocumentStore";
import { useCameraStore } from "@/core/store/useCameraStore";
import { clampZoom } from "@/core/viewport/camera";
import { invokeCommand, useFocusScope } from "@/core/commands";
import type { LayerMenuAction } from "@/editor/shell/left-panel/types";
import { Artboard } from "./Artboard";
import { TransitionReferences, TRANSITION_GAP } from "./TransitionReferences";
import { isLoadingPage } from "@/core/pages/loadingPages";
import { useStageTransform } from "./useStageTransform";
import {
  STAGE_CONSTANTS,
  STAGE_PRESETS,
} from "./constants";
import type { StageProps, StageElement, StagePreset, DrawPreview } from "./types";
import { createLayerFromBox, creationSpecFor, drawBox, frameAt, pictureHome, type CreationSpec } from "./createFromDrag";
import { useDraftPathStore } from "@/core/store/useDraftPathStore";
import { EMPTY_PEN, penClose, penDrag, penFinishable, penNearFirst, penPress, penUndo, type PenState } from "@/core/paths/penModel";
import { fitStroke, type Sample } from "@/core/paths/pathFit";
import { createPathLayer, PENCIL_STYLE, PEN_STYLE } from "@/core/paths/createPath";
import { importFiles, placeImage } from "@/core/assets/assetImport";
import { getDocument } from "@/core/store/documentState";
import { documentOrder } from "@/core/selection/selectionOps";
import { setLayerProps } from "@/core/editing/editOps";
import { registerFrameRenderer, type StageRenderer } from "@/core/render/StageRenderer";
import { measurePage, pageMeasurer } from "./pageMeasure";
import { activePageRootId } from "./activePage";
import { marqueeHits } from "./marquee";
import { useProjectStore } from "@/core/store/useProjectStore";
import { useStageOriginStore } from "@/editor/shell/canvas-chrome/stageOrigin";
import { executeStagePreset, presetForBreakpoint } from "./presetBreakpoints";
import { useBreakpointStore } from "@/core/store/useBreakpointStore";
import { breakpointsOf } from "@/core/breakpoints/breakpoints";

/** The page's size in pixels, or nothing when it is stored as a share of its parent (a project that never set one). */
function pagePixels(root: { properties: Record<string, unknown> } | undefined, side: "width" | "height"): number | undefined {
  const v = root?.properties[`frame.${side}`];
  if (typeof v !== "number" || v <= 0) return undefined;
  return root?.properties[`frame.${side}Unit`] === "%" && v <= 100 ? undefined : v;
}

/** Choosing Desktop, Tablet or Mobile resizes the page itself. */
function resizePageToPreset(preset: StagePreset): void {
  const def = STAGE_PRESETS.find((p) => p.id === preset);
  const rootLayerId = activePageRootId();
  const root = rootLayerId ? getDocument().layers[rootLayerId] : undefined;
  if (!def || !root) return;
  if (root.properties["frame.width"] === def.artboardWidth && root.properties["frame.height"] === def.artboardHeight && root.properties["frame.widthUnit"] === "px") return;
  setLayerProps([root.id], { "frame.width": def.artboardWidth, "frame.widthUnit": "px", "frame.height": def.artboardHeight, "frame.heightUnit": "px" }, "Page size");
}

export const Stage: React.FC<StageProps> = ({
  zoom = STAGE_CONSTANTS.defaultZoom,
  pan: controlledPan,
  selectedIds: controlledSelectedIds,
  onSelect: controlledOnSelect,
  frames: _frames,
  elements: controlledElements,
  activeTool = "select",
  activeShape = "box",
  onToolDone,
  snapObjects = true,
  snapGuides = false,
  smartGuides = true,
  snapThreshold = STAGE_CONSTANTS.defaultSnapThreshold,
  preset: controlledPreset,
  onPresetChange: controlledOnPresetChange,
  title = "LazyLayout",
  empty = false,
  onAddFrame,
  onInsert,
  onAskAi,
  mode = "design",
  className = "",
}) => {
  // Store-backed selection
  const storeSelectedIds = useSelectionStore((s) => s.selectedIds);
  const selectStore = useSelectionStore((s) => s.select);
  const toggleStore = useSelectionStore((s) => s.toggleSelection);
  const clearStore = useSelectionStore((s) => s.clearSelection);

  const selectedIds = useMemo(
    () => (controlledSelectedIds !== undefined ? controlledSelectedIds : storeSelectedIds),
    [controlledSelectedIds, storeSelectedIds]
  );

  // Prototype parity: Open at 59% zoom (0.59) centered. If camera has default 1.0 zoom and untouched, set to 0.59
  useEffect(() => {
    const cam = useCameraStore.getState();
    if (cam.camera.zoom === 1 && !cam.touched) {
      cam.setCamera({ x: 0, y: 0, zoom: STAGE_CONSTANTS.defaultZoom });
    }
  }, []);

  // The Hand tool moves the artboard in the viewport; the offset is a view setting, not document content.
  const [dragPan, setDragPan] = useState({ x: 0, y: 0 });
  const pan = controlledPan ?? dragPan;

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [internalPreset, setInternalPreset] = useState<StagePreset>("1440");
  const activeBreakpointId = useBreakpointStore((s) => s.activeId);
  const docBreakpoints = useDocument((d) => d.breakpoints);
  const bpPreset = presetForBreakpoint(breakpointsOf({ breakpoints: docBreakpoints }), activeBreakpointId);
  const activePreset = controlledPreset !== undefined ? controlledPreset : (activeBreakpointId !== null ? bpPreset : internalPreset);

  const handlePresetChange = useCallback(
    (newPreset: StagePreset) => {
      setInternalPreset(newPreset);
      executeStagePreset(newPreset, { onPresetChange: controlledOnPresetChange });
    },
    [controlledOnPresetChange]
  );

  // A preset chosen from the menu or a command (Tablet, Mobile) triggers preset logic
  const lastPreset = useRef(activePreset);
  useEffect(() => {
    if (lastPreset.current === activePreset) return;
    lastPreset.current = activePreset;
    if (useSelectionStore.getState().selectedMirrorId) return;
    executeStagePreset(activePreset);
  }, [activePreset]);

  // Document store layers mapping directly from engine document
  const storeLayers = useDocument((d) => d.layers);

  const pageRef = useRef<HTMLDivElement>(null);
  const activePageRoot = useProjectStore((p) => p.pages[p.activePageId]?.rootElementId);
  const rootId = useMemo(
    () => (activePageRoot && storeLayers?.[activePageRoot] ? activePageRoot : (Object.values(storeLayers ?? {}).find((l) => l.parentId === null)?.id ?? null)),
    [storeLayers, activePageRoot],
  );

  // What is on the page, read from what the engine drew (see pageMeasure.ts).
  const [measured, setMeasured] = useState<Record<string, StageElement>>({});
  const [rootHeight, setRootHeight] = useState(0);
  const storeLayersRef = useRef(storeLayers);
  const remeasure = useCallback(() => {
    const page = pageRef.current;
    if (!page || !storeLayersRef.current) return;
    const next = measurePage(page, storeLayersRef.current);
    // applied at once, so a selection box never lags a frame behind what it surrounds
    const rootNode = page.firstElementChild as HTMLElement | null;
    flushSync(() => {
      setMeasured((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      setRootHeight(rootNode?.offsetHeight ?? 0);
    });
  }, []);
  useLayoutEffect(() => {
    storeLayersRef.current = storeLayers;
    queueMicrotask(remeasure);
  });
  // Things that change sizes without the document changing: a picture or a font arriving, the page resizing.
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;
    page.addEventListener("load", remeasure, true);
    const observer = new ResizeObserver(remeasure);
    observer.observe(page);
    let live = true;
    void document.fonts?.ready.then(() => live && remeasure());
    // align, group and reparent ask the same reading
    const off = rootId ? registerFrameRenderer(rootId, pageMeasurer(() => pageRef.current) as unknown as StageRenderer) : undefined;
    return () => {
      live = false;
      page.removeEventListener("load", remeasure, true);
      observer.disconnect();
      off?.();
    };
  }, [remeasure, rootId]);

  const elementsFromStore = controlledElements ?? measured;

  // Local elements state for direct interactive dragging / manipulation
  const [elements, setElements] = useState<Record<string, StageElement>>(elementsFromStore);
  const [prevElementsFromStore, setPrevElementsFromStore] = useState(elementsFromStore);

  if (elementsFromStore !== prevElementsFromStore) {
    setPrevElementsFromStore(elementsFromStore);
    setElements(elementsFromStore);
  }

  const handleElementChange = useCallback(
    (id: string, patch: Partial<StageElement>) => {
      setElements((prev) => {
        const target = prev[id];
        if (!target) return prev;
        return {
          ...prev,
          [id]: {
            ...target,
            ...patch,
          },
        };
      });
    },
    []
  );

  const handleSelect = useCallback(
    (id: string | null, multi = false) => {
      if (controlledOnSelect) {
        controlledOnSelect(id, multi);
        return;
      }

      if (!id) {
        clearStore();
      } else if (multi) {
        toggleStore(id, "element");
      } else {
        selectStore(id, "element");
      }
    },
    [controlledOnSelect, clearStore, toggleStore, selectStore]
  );

  // The page is as big as its own layer says (the Page block writes it). A size in % (a project that never set one) follows the preset.
  const rootSized = rootId ? storeLayers?.[rootId] : undefined;
  const maxRight = useMemo(() => {
    if (!storeLayers) return 0;
    let r = 0;
    for (const l of Object.values(storeLayers)) {
      if ((l.parentId === rootId || l.parentId === null) && l.archetype === "container" && l.id !== rootId) {
        const x = Number(l.properties["frame.x"] ?? 0);
        const w = Number(l.properties["frame.width"] ?? 0);
        r = Math.max(r, x + w);
      }
    }
    return r;
  }, [storeLayers, rootId]);
  const presetDef0 =
    STAGE_PRESETS.find((p) => p.id === activePreset) || STAGE_PRESETS[0];
  const presetDef = {
    ...presetDef0,
    artboardWidth: Math.max(pagePixels(rootSized, "width") ?? presetDef0.artboardWidth, maxRight),
    // a page of stacked sections grows with them
    artboardHeight: Math.max(pagePixels(rootSized, "height") ?? presetDef0.artboardHeight, rootSized?.properties["sizing.vertical"] === "hug" ? rootHeight : 0),
  };

  const handleLayerAction = useCallback(
    (action: LayerMenuAction, targetId: string) => {
      switch (action) {
        case "copy":
          invokeCommand("edit.copy");
          break;
        case "duplicate":
          invokeCommand("edit.duplicate");
          break;
        case "paste":
          invokeCommand("edit.paste");
          break;
        case "paste-in-place":
          invokeCommand("edit.pasteInPlace");
          break;
        case "delete":
          invokeCommand("edit.delete");
          break;
        case "group":
          invokeCommand("edit.group");
          break;
        case "ungroup":
          invokeCommand("edit.ungroup");
          break;
        case "frame-selection":
          invokeCommand("edit.frameSelection");
          break;
        case "bring-forward":
          invokeCommand("layer.bringForward");
          break;
        case "send-backward":
          invokeCommand("layer.sendBackward");
          break;
        case "bring-to-front":
          invokeCommand("layer.bringToFront");
          break;
        case "send-to-back":
          invokeCommand("layer.sendToBack");
          break;
        case "align-left":
          invokeCommand("align.left");
          break;
        case "align-center":
          invokeCommand("align.center");
          break;
        case "align-right":
          invokeCommand("align.right");
          break;
        case "align-top":
          invokeCommand("align.top");
          break;
        case "align-middle":
          invokeCommand("align.middle");
          break;
        case "align-bottom":
          invokeCommand("align.bottom");
          break;
        case "distribute-horizontally":
          invokeCommand("distribute.horizontal");
          break;
        case "distribute-vertically":
          invokeCommand("distribute.vertical");
          break;
        case "tidy-up":
          invokeCommand("layer.tidy");
          break;
        case "rename":
          invokeCommand("layer.rename");
          break;
        case "split-letters":
          invokeCommand("text.splitLetters");
          break;
        default:
          break;
      }
    },
    []
  );

  const handleToggleHidden = useCallback((id: string) => {
    invokeCommand("layer.setVisible", { ids: [id], visible: getDocument().layers[id]?.visible === false });
  }, []);

  const handleToggleLocked = useCallback((id: string) => {
    invokeCommand("layer.setLocked", { ids: [id], locked: getDocument().layers[id]?.locked !== true });
  }, []);

  // Snapping and Transform Gestures
  const { isGesturing, snapLines, spacingMarks, startMove, startResize } = useStageTransform({
    elements,
    selectedIds,
    artboardWidth: presetDef.artboardWidth,
    artboardHeight: presetDef.artboardHeight,
    zoom,
    snapObjects,
    snapGuides,
    smartGuides,
    snapThreshold,
    onElementChange: handleElementChange,
    onSelect: handleSelect,
  });

  // A loading page shows the page it comes from and the one it leads to beside it, so the view zooms out to hold all three.
  const activePageDef = useProjectStore((p) => p.pages[p.activePageId]);
  const allPages = useProjectStore((p) => p.pages);
  const onLoadingPage = isLoadingPage(activePageDef);
  const wasLoadingPage = useRef(false);
  const pageW = presetDef.artboardWidth;
  const pageH = presetDef.artboardHeight;
  useEffect(() => {
    const camera = useCameraStore.getState();
    if (onLoadingPage) {
      wasLoadingPage.current = true;
      camera.fitToRect({ x: -(pageW + TRANSITION_GAP), y: 0, width: 3 * pageW + 2 * TRANSITION_GAP, height: pageH }, { padding: 64, maxZoom: 1, bottomInset: 56 });
    } else if (wasLoadingPage.current) {
      wasLoadingPage.current = false;
      camera.fitToRect({ x: 0, y: 0, width: pageW, height: pageH }, { padding: 48, maxZoom: 1, bottomInset: 56 });
    }
  }, [onLoadingPage, activePageDef?.id, pageW, pageH]);

  // Report the stage size to the camera store so fit, zoom to selection and the other camera actions know the viewport.
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const onToolDoneRef = useRef(onToolDone);
  useEffect(() => {
    onToolDoneRef.current = onToolDone;
  });
  // The canvas owns the keyboard while the pointer is over it: this is what Select All, Delete, Duplicate, Group and arrow-nudging check.
  useFocusScope("canvas", viewportRef);
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const syncSize = () => useCameraStore.getState().setViewport({ width: el.clientWidth, height: el.clientHeight });
    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Tell the rulers where the page's corner is on screen; and re-centre when a camera action (fit, 100%) asks for a new view.
  const reportOrigin = useCallback(() => {
    const view = viewportRef.current;
    const art = view?.querySelector<HTMLElement>('[data-stage="artboard"]');
    if (!view || !art) return;
    const hRuler = document.querySelector<HTMLElement>('[data-ruler="horizontal"]')?.getBoundingClientRect();
    const vRuler = document.querySelector<HTMLElement>('[data-ruler="vertical"]')?.getBoundingClientRect();
    const a = art.getBoundingClientRect();
    const v = view.getBoundingClientRect();
    useStageOriginStore.getState().setOrigin({ x: a.left - (hRuler?.left ?? v.left), y: a.top - (vRuler?.top ?? v.top), width: hRuler?.width ?? v.width, height: vRuler?.height ?? v.height });
  }, []);
  useLayoutEffect(reportOrigin);
  useEffect(() => {
    const view = viewportRef.current;
    if (!view) return undefined;
    const observer = new ResizeObserver(reportOrigin);
    observer.observe(view);
    return () => observer.disconnect();
  }, [reportOrigin]);
  const cameraX = useCameraStore((c) => c.camera.x);
  const cameraY = useCameraStore((c) => c.camera.y);
  const [seenCamera, setSeenCamera] = useState({ x: cameraX, y: cameraY });
  if (seenCamera.x !== cameraX || seenCamera.y !== cameraY) {
    setSeenCamera({ x: cameraX, y: cameraY });
    setDragPan({ x: 0, y: 0 });
  }

  // The wheel, as on the old canvas: a plain wheel or trackpad scroll pans, Ctrl or Cmd with the wheel (a pinch sends the same) zooms.
  // A native listener, because React's wheel listener is passive and could not stop the page from scrolling or zooming itself.
  const wheelPans = controlledPan === undefined;
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const { camera, setCamera } = useCameraStore.getState();
        setCamera({ ...camera, zoom: clampZoom(camera.zoom * Math.exp(-e.deltaY * 0.01)) });
      } else if (wheelPans) {
        // Shift with the wheel moves sideways (browsers that send it as a vertical wheel are turned around here)
        const sideways = e.shiftKey && e.deltaX === 0;
        setDragPan((p) => ({ x: p.x - (sideways ? e.deltaY : e.deltaX), y: p.y - (sideways ? 0 : e.deltaY) }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [wheelPans]);

  // The active tool at work (the old editor's tools, on this stage): Hand moves the artboard; Frame, Shape and Text draw a layer by dragging
  // (click for the default size, Shift constrains, Alt draws from the centre) and then hand back to Select. Select is the stage's own
  // move and resize, below.
  const gesture = useRef<
    | { kind: "create"; spec: CreationSpec; start: { x: number; y: number } }
    | { kind: "pan"; startX: number; startY: number; from: { x: number; y: number } }
    | { kind: "marquee"; start: { x: number; y: number }; moved: boolean; pointerId: number; /** The frame it started in: it selects that frame's layers. */ scope: string | null; additive: boolean }
    | null
  >(null);
  const justDragged = useRef(false);
  const rightPan = useRef(false);
  const rightMoved = useRef(false);
  const syntheticMenu = useRef(false);
  const rightDownAt = useRef<{ target: EventTarget | null; x: number; y: number } | null>(null);
  const [drawPreview, setDrawPreview] = useState<DrawPreview | null>(null);
  const toolCursor = activeTool === "hand" ? "grab" : activeTool === "pen" || activeTool === "pencil" ? "crosshair" : creationSpecFor(activeTool, activeShape) ? "crosshair" : undefined;

  // Vector Pen & Pencil tool state
  const penStateRef = useRef<PenState>(EMPTY_PEN);
  const penParentRef = useRef<{ id: string; origin: { x: number; y: number } } | null>(null);
  const penDownRef = useRef<{ x: number; y: number } | null>(null);
  const pencilSamplesRef = useRef<Sample[]>([]);
  const pencilParentRef = useRef<{ id: string; origin: { x: number; y: number } } | null>(null);
  const pencilT0Ref = useRef<number>(0);

  const finishPen = useCallback(() => {
    const state = penStateRef.current;
    const parent = penParentRef.current;
    penStateRef.current = EMPTY_PEN;
    penParentRef.current = null;
    penDownRef.current = null;
    useDraftPathStore.getState().clear();
    if (penFinishable(state) && parent) {
      const newId = createPathLayer(state.nodes, state.closed, parent, PEN_STYLE, "Path");
      if (newId) selectStore(newId, "element");
    }
    onToolDone?.();
  }, [onToolDone, selectStore]);

  const cancelPen = useCallback(() => {
    penStateRef.current = EMPTY_PEN;
    penParentRef.current = null;
    penDownRef.current = null;
    useDraftPathStore.getState().clear();
    onToolDone?.();
  }, [onToolDone]);

  // Clean up draft path on tool change
  useEffect(() => {
    if (activeTool !== "pen" && activeTool !== "pencil") {
      penStateRef.current = EMPTY_PEN;
      penParentRef.current = null;
      penDownRef.current = null;
      pencilSamplesRef.current = [];
      pencilParentRef.current = null;
      useDraftPathStore.getState().clear();
    }
  }, [activeTool]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (activeTool !== "pen") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        finishPen();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelPen();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        e.stopPropagation();
        const next = penUndo(penStateRef.current);
        penStateRef.current = next;
        if (next.nodes.length === 0) {
          cancelPen();
        } else {
          useDraftPathStore.getState().setPen(next.nodes, next.closed, null);
        }
      }
    },
    [activeTool, finishPen, cancelPen]
  );

  /** A screen point in the artboard's own pixels, and how many screen px one artboard px is. */
  const toArtboard = useCallback((clientX: number, clientY: number) => {
    const art = viewportRef.current?.querySelector<HTMLElement>('[data-stage="artboard"]');
    if (!art) return null;
    const r = art.getBoundingClientRect();
    const scale = art.offsetWidth > 0 ? r.width / art.offsetWidth : 1;
    return { x: (clientX - r.left) / scale - art.clientLeft, y: (clientY - r.top) / scale - art.clientTop, scale };
  }, []);

  const handleToolPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    justDragged.current = false;
    rightMoved.current = false;
    if (e.button === 2) {
      // Right button on empty canvas drags the canvas; a plain right-click (no drag) still opens the menu.
      if ((e.target as HTMLElement).closest('[data-testid="stage-element"],button,[role=menu]')) return;
      gesture.current = { kind: "pan", startX: e.clientX, startY: e.clientY, from: pan };
      rightPan.current = true;
      rightDownAt.current = { target: e.target, x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    if (activeTool === "hand") {
      gesture.current = { kind: "pan", startX: e.clientX, startY: e.clientY, from: pan };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (activeTool === "pencil") {
      const at = toArtboard(e.clientX, e.clientY);
      if (!at) return;
      const inside = frameAt({ x: at.x, y: at.y }, undefined, elements);
      const parentId = inside?.id ?? activePageRootId();
      const parentOrigin = inside ? { x: inside.x, y: inside.y } : { x: 0, y: 0 };
      pencilParentRef.current = parentId ? { id: parentId, origin: parentOrigin } : null;
      pencilT0Ref.current = Date.now();
      pencilSamplesRef.current = [{ x: at.x, y: at.y, t: 0, p: e.pressure || 0.5 }];
      useDraftPathStore.getState().setPencil([{ x: at.x, y: at.y }]);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (activeTool === "pen") {
      const at = toArtboard(e.clientX, e.clientY);
      if (!at) return;
      let s = penStateRef.current;
      if (s.nodes.length === 0) {
        const inside = frameAt({ x: at.x, y: at.y }, undefined, elements);
        const parentId = inside?.id ?? activePageRootId();
        const parentOrigin = inside ? { x: inside.x, y: inside.y } : { x: 0, y: 0 };
        penParentRef.current = parentId ? { id: parentId, origin: parentOrigin } : null;
      }
      if (penNearFirst(s, at, 12 / at.scale)) {
        penStateRef.current = penClose(s);
        finishPen();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      s = penPress(s, at, Date.now(), e.pressure || 0.5);
      penStateRef.current = s;
      penDownRef.current = { x: at.x, y: at.y };
      useDraftPathStore.getState().setPen(s.nodes, s.closed, at);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const spec = creationSpecFor(activeTool, activeShape);
    if (!spec) {
      // Select on empty canvas: a drag selects what it touches
      const pressedOn = e.target as HTMLElement;
      if (activeTool !== "select" || pressedOn.closest('[data-testid="selection-handle"],button,[role=menu]')) return;
      const from = toArtboard(e.clientX, e.clientY);
      if (!from) return;
      const box = pressedOn.closest<HTMLElement>('[data-testid="stage-element"]');
      let scope: string | null = null;
      if (box) {
        // A drag on a frame that holds layers selects inside it, or nothing could be marquee-selected on a page of frames.
        // A selected frame still moves, and a plain click still selects the frame (its click handler reads this press).
        const id = box.dataset.elementId ?? "";
        const pressed = getDocument().layers[id];
        if (!pressed || pressed.archetype !== "container" || pressed.children.length === 0 || pressed.locked || selectedIds.includes(id) || e.shiftKey || e.altKey) return;
        scope = id;
        box.dataset.press = `${e.clientX},${e.clientY},0`;
        e.stopPropagation();
      }
      gesture.current = { kind: "marquee", start: { x: from.x, y: from.y }, moved: false, pointerId: e.pointerId, scope, additive: e.shiftKey };
      return;
    }
    if ((e.target as HTMLElement).closest("button,[role=menu]")) return; // the canvas size label and its menu keep working
    const at = toArtboard(e.clientX, e.clientY);
    if (!at) return; // anywhere on the canvas: a frame or shape can start outside the page too
    gesture.current = { kind: "create", spec, start: { x: at.x, y: at.y } };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleToolPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === "pencil") {
      if (pencilSamplesRef.current.length > 0) {
        const at = toArtboard(e.clientX, e.clientY);
        if (at) {
          pencilSamplesRef.current.push({ x: at.x, y: at.y, t: Date.now() - pencilT0Ref.current, p: e.pressure || 0.5 });
          useDraftPathStore.getState().setPencil(pencilSamplesRef.current.map((pt) => ({ x: pt.x, y: pt.y })));
        }
      }
      return;
    }
    if (activeTool === "pen") {
      const at = toArtboard(e.clientX, e.clientY);
      if (at) {
        if (penDownRef.current) {
          const s = penDrag(penStateRef.current, at, e.altKey);
          penStateRef.current = s;
          useDraftPathStore.getState().setPen(s.nodes, s.closed, at);
        } else if (penStateRef.current.nodes.length > 0) {
          useDraftPathStore.getState().setPen(penStateRef.current.nodes, penStateRef.current.closed, at);
        }
      }
      return;
    }
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pan") {
      if (rightPan.current && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 3) rightMoved.current = true;
      setDragPan({ x: g.from.x + e.clientX - g.startX, y: g.from.y + e.clientY - g.startY });
      return;
    }
    const at = toArtboard(e.clientX, e.clientY);
    if (!at) return;
    if (g.kind === "marquee") {
      if (!g.moved && Math.hypot(at.x - g.start.x, at.y - g.start.y) * at.scale < 4) return;
      if (!g.moved) e.currentTarget.setPointerCapture(g.pointerId);
      g.moved = true;
      setDrawPreview({ x: Math.min(g.start.x, at.x), y: Math.min(g.start.y, at.y), width: Math.abs(at.x - g.start.x), height: Math.abs(at.y - g.start.y), rotation: 0, archetype: "marquee" });
      return;
    }
    const b = drawBox(g.spec, g.start, { x: at.x, y: at.y }, { shift: e.shiftKey, alt: e.altKey }, at.scale);
    setDrawPreview({ x: b.x, y: b.y, width: b.width, height: b.height, rotation: b.rotation, archetype: g.spec.archetype });
  };

  const handleToolPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === "pencil") {
      const samples = pencilSamplesRef.current;
      const parent = pencilParentRef.current;
      pencilSamplesRef.current = [];
      pencilParentRef.current = null;
      useDraftPathStore.getState().clear();
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (samples.length >= 2 && parent) {
        const at = toArtboard(e.clientX, e.clientY);
        const scale = at?.scale ?? 1;
        const { nodes, closed } = fitStroke(samples, {}, 8 / scale);
        const newId = createPathLayer(nodes, closed, parent, PENCIL_STYLE, "Pencil");
        if (newId) selectStore(newId, "element");
      }
      onToolDone?.();
      return;
    }
    if (activeTool === "pen") {
      penDownRef.current = null;
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.kind === "marquee" && !g.moved) return; // a plain click: the click handler deselects
    justDragged.current = true; // the click that follows a drag must not deselect what the drag just made
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (g.kind === "pan") {
      if (rightPan.current && !rightMoved.current && rightDownAt.current?.target instanceof Element) {
        // a right-click that did not drag: open the canvas menu now
        const at = rightDownAt.current;
        syntheticMenu.current = true;
        (at.target as Element).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, button: 2 }));
        syntheticMenu.current = false;
      }
      rightPan.current = false;
      rightMoved.current = false;
      return;
    }
    setDrawPreview(null);
    const at = toArtboard(e.clientX, e.clientY);
    if (!at) return;
    if (g.kind === "marquee") {
      const x0 = Math.min(g.start.x, at.x);
      const x1 = Math.max(g.start.x, at.x);
      const y0 = Math.min(g.start.y, at.y);
      const y1 = Math.max(g.start.y, at.y);
      const layersNow = getDocument().layers;
      // every element it touches, at any depth (a frame only when nothing in it is touched)
      const hit = marqueeHits(layersNow, Object.values(elements), { x0, y0, x1, y1 }, g.scope);
      useSelectionStore.getState().selectMultiple(g.additive ? [...new Set([...selectedIds, ...hit])] : hit, "element");
      return;
    }
    const box = drawBox(g.spec, g.start, { x: at.x, y: at.y }, { shift: e.shiftKey, alt: e.altKey }, at.scale);
    selectStore(createLayerFromBox(g.spec, box, elements), "element");
    onToolDone?.();
  };

  // The Image tool asks for a picture as soon as it is chosen, then puts it in the middle of the page, at its own size (up to 600px a side).
  useEffect(() => {
    if (activeTool === "image") imageInput.current?.click();
  }, [activeTool]);
  // Closing the file dialog without a choice hands the tool back too.
  useEffect(() => {
    const input = imageInput.current;
    if (!input) return undefined;
    const cancelled = () => onToolDoneRef.current?.();
    input.addEventListener("cancel", cancelled);
    return () => input.removeEventListener("cancel", cancelled);
  }, []);

  const placePicked = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) {
      onToolDone?.(); // cancelled
      return;
    }
    const outcomes = await importFiles(list);
    let last: string | null = null;
    const home = pictureHome({ x: presetDef.artboardWidth / 2, y: presetDef.artboardHeight / 2 }, elements);
    outcomes.forEach((o, i) => {
      if (!o.entry || !home) return;
      last = placeImage(o.entry, { ...home, x: home.x + i * 24, y: home.y + i * 24 }) ?? last;
    });
    if (last) selectStore(last, "element");
    onToolDone?.();
  };

  /** Pictures dropped on the canvas are stored in the assets and placed where they were dropped, in the frame under the drop. */
  const dropPictures = async (e: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    e.preventDefault();
    const at = toArtboard(e.clientX, e.clientY) ?? { x: presetDef.artboardWidth / 2, y: presetDef.artboardHeight / 2 };
    const outcomes = await importFiles(files);
    const under = frameAt(at, undefined, elements);
    const parentId = under?.id ?? activePageRootId();
    if (!parentId) return;
    let last: string | null = null;
    outcomes.forEach((o, i) => {
      if (!o.entry || o.entry.kind === "font") return; // a font is only stored
      last = placeImage(o.entry, { x: at.x + i * 24, y: at.y + i * 24, parentId, parentOrigin: under ? { x: under.x, y: under.y } : { x: 0, y: 0 } }) ?? last;
    });
    if (last) selectStore(last, "element");
  };

  const handleToolPointerCancel = () => {
    gesture.current = null;
    setDrawPreview(null);
  };

  return (
    <div
      ref={viewportRef}
      data-stage="workspace"
      data-testid="stage-viewport"
      className={`ll-stage-viewport ll:relative ll:w-full ll:h-full ll:overflow-hidden ${className}`}
      style={{ cursor: toolCursor }}
      onPointerDownCapture={handleToolPointerDown}
      onPointerMove={handleToolPointerMove}
      onPointerUp={handleToolPointerUp}
      onPointerCancel={handleToolPointerCancel}
      onKeyDown={handleKeyDown}
      onDoubleClick={(e) => {
        if (activeTool === "pen" && penStateRef.current.nodes.length >= 2) {
          e.preventDefault();
          e.stopPropagation();
          finishPen();
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => void dropPictures(e)}
      onContextMenu={(e) => {
        // On empty canvas the menu waits for the button to come up (macOS sends it on press): a right-drag pans, a plain
        // right-click opens it. Layers keep their own menu, opened at once.
        if (syntheticMenu.current) return;
        if ((e.target as HTMLElement).closest('[data-testid="stage-element"],button,[role=menu]')) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        if (justDragged.current) {
          justDragged.current = false;
          return;
        }
        // Clicking on blank canvas space deselects
        if (e.target === e.currentTarget) {
          handleSelect(null);
        }
      }}
    >
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Image file"
        data-testid="image-tool-input"
        onChange={(e) => {
          void placePicked(e.target.files);
          e.target.value = "";
        }}
      />
      <Artboard
        title={title}
        preset={activePreset}
        onPresetChange={handlePresetChange}
        width={presetDef.artboardWidth}
        height={presetDef.artboardHeight}
        background={typeof rootSized?.properties["appearance.background.color"] === "string" && rootSized.properties["appearance.background.color"] !== "transparent" ? (rootSized.properties["appearance.background.color"] as string) : undefined}
        zoom={zoom}
        pan={pan}
        elements={elements}
        layers={controlledElements ? undefined : storeLayers}
        pageRef={pageRef}
        rootId={controlledElements ? null : rootId}
        drawPreview={drawPreview}
        selectedIds={selectedIds}
        hoveredId={hoveredId}
        onSelect={handleSelect}
        onHover={setHoveredId}
        activeTool={activeTool}
        snapGuides={snapGuides && isGesturing}
        empty={empty}
        references={
          onLoadingPage && activePageDef && !controlledElements && storeLayers ? (
            <TransitionReferences loading={activePageDef} pages={allPages} layers={storeLayers} width={pageW} height={pageH} zoom={zoom > 0 ? zoom : 1} />
          ) : undefined
        }
        onAddFrame={onAddFrame}
        onInsert={onInsert}
        onAskAi={onAskAi}
        onLayerAction={handleLayerAction}
        onToggleHidden={handleToggleHidden}
        onToggleLocked={handleToggleLocked}
        mode={mode}
        snapLines={snapLines}
        spacingMarks={spacingMarks}
        onStartMove={startMove}
        onStartResize={startResize}
        isGesturing={isGesturing}
      />
    </div>
  );
};
