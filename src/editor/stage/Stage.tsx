"use client";

import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useDocument } from "@/core/store/useDocumentStore";
import { useCameraStore } from "@/core/store/useCameraStore";
import { clampZoom } from "@/core/viewport/camera";
import { invokeCommand, useFocusScope } from "@/core/commands";
import type { LayerMenuAction } from "@/editor/shell/left-panel/types";
import { Artboard } from "./Artboard";
import { useStageTransform } from "./useStageTransform";
import {
  STAGE_CONSTANTS,
  STAGE_PRESETS,
} from "./constants";
import type { StageProps, StageElement, StagePreset, DrawPreview } from "./types";
import { createLayerFromBox, creationSpecFor, drawBox, type CreationSpec } from "./createFromDrag";
import { importFiles, placeImage } from "@/core/assets/assetImport";
import { getDocument } from "@/core/store/documentState";
import { documentOrder } from "@/core/selection/selectionOps";
import { setLayerProps } from "@/core/editing/editOps";

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
  const activePreset = controlledPreset !== undefined ? controlledPreset : internalPreset;

  const handlePresetChange = useCallback(
    (newPreset: StagePreset) => {
      setInternalPreset(newPreset);
      controlledOnPresetChange?.(newPreset);
      // choosing Desktop, Tablet or Mobile resizes the page itself
      const def = STAGE_PRESETS.find((p) => p.id === newPreset);
      const root = Object.values(getDocument().layers).find((l) => l.parentId === null);
      if (def && root) setLayerProps([root.id], { "frame.width": def.artboardWidth, "frame.height": def.artboardHeight }, "Page size");
    },
    [controlledOnPresetChange]
  );

  // Document store layers mapping directly from engine document
  const storeLayers = useDocument((d) => d.layers);

  const elementsFromStore = useMemo<Record<string, StageElement>>(() => {
    if (controlledElements) return controlledElements;
    if (!storeLayers || Object.keys(storeLayers).length === 0) return {};

    const result: Record<string, StageElement> = {};
    // Back to front, the way the document stacks them (a parent, then its children in order): the canvas paints in this order, so Arrange moves what you see.
    const layerEntries = documentOrder(storeLayers).map((id) => storeLayers[id]).filter(Boolean);
    // Where a layer's parent starts on the page: the sum of its ancestors' positions (the page itself is the origin).
    const originOf = (id: string): { x: number; y: number } => {
      let x = 0;
      let y = 0;
      let cur = storeLayers[id]?.parentId ? storeLayers[storeLayers[id].parentId as string] : undefined;
      let guard = 0;
      while (cur && cur.parentId !== null && guard++ < 1000) {
        x += (cur.properties["frame.x"] as number) ?? 0;
        y += (cur.properties["frame.y"] as number) ?? 0;
        cur = storeLayers[cur.parentId];
      }
      return { x, y };
    };

    // Filter out root containers and structural sections from rendering as individual canvas boxes
    const IGNORED_SECTION_IDS = new Set([
      "elem_canvas_root",
      "el_root_container",
      "hero",
      "features",
      "footer",
      "others",
    ]);

    // Subtitle is presented as part of headline on canvas (matching prototype canv={subtitle:'headline'})
    // Other elements under 'others' are catalog elements
    const IGNORED_STAGE_IDS = new Set([
      "subtitle",
      "object3d",
      "counter",
      "shape",
      "icon",
      "background",
      "divider",
      "toggle",
      "input",
    ]);

    layerEntries.forEach((l) => {
      if (IGNORED_SECTION_IDS.has(l.id)) return;
      if (IGNORED_STAGE_IDS.has(l.id)) return;

      const origin = originOf(l.id);
      const x = ((l.properties["frame.x"] as number) ?? 0) + origin.x;
      const y = ((l.properties["frame.y"] as number) ?? 0) + origin.y;
      const width =
        (l.properties["frame.width"] as number) ??
        (l.archetype === "button" ? 112 : 200);
      const height =
        (l.properties["frame.height"] as number) ??
        (l.archetype === "button" ? 34 : 60);

      let subtitleText: string | undefined;
      if (l.id === "headline") {
        subtitleText =
          (storeLayers["subtitle"]?.properties["content.text"] as string) ||
          "Build pages visually and get production code out.";
      }

      result[l.id] = {
        id: l.id,
        name: l.name,
        type:
          l.archetype === "text" || l.archetype === "svgText"
            ? "text"
            : l.archetype === "button" || l.archetype === "fab"
            ? "button"
            : l.archetype === "image"
            ? "image"
            : "container",
        x,
        y,
        ox: origin.x,
        oy: origin.y,
        width,
        height,
        title: (l.properties["content.text"] as string) || l.name,
        subtitle: subtitleText,
        label:
          (l.properties["content.label"] as string) ||
          (l.properties["content.text"] as string) ||
          l.name,
        hidden: l.visible === false,
        locked: l.locked === true,
      };
    });

    return result;
  }, [controlledElements, storeLayers]);

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

  // The page is as big as its own layer says (the Page block writes it); a document that has not set one follows the preset.
  const rootSized = Object.values(storeLayers ?? {}).find((l) => l.parentId === null);
  const presetDef0 =
    STAGE_PRESETS.find((p) => p.id === activePreset) || STAGE_PRESETS[0];
  const presetDef = {
    ...presetDef0,
    artboardWidth: typeof rootSized?.properties["frame.width"] === "number" ? (rootSized.properties["frame.width"] as number) : presetDef0.artboardWidth,
    artboardHeight: typeof rootSized?.properties["frame.height"] === "number" ? (rootSized.properties["frame.height"] as number) : presetDef0.artboardHeight,
  };

  const handleLayerAction = useCallback(
    (action: LayerMenuAction, targetId: string) => {
      switch (action) {
        case "copy":
          invokeCommand("edit.copy");
          break;
        case "duplicate":
          invokeCommand("edit.duplicate");
          setElements((prev) => {
            const item = prev[targetId];
            if (!item) return prev;
            const newId = `${targetId}_copy_${Date.now()}`;
            return {
              ...prev,
              [newId]: {
                ...item,
                id: newId,
                name: `${item.name} copy`,
                x: item.x + 10,
                y: item.y + 10,
              },
            };
          });
          break;
        case "delete":
          invokeCommand("edit.delete");
          setElements((prev) => {
            const { [targetId]: _, ...rest } = prev;
            return rest;
          });
          handleSelect(null);
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
        default:
          break;
      }
    },
    [handleSelect]
  );

  const handleToggleHidden = useCallback((id: string) => {
    invokeCommand("layer.toggleHidden");
    setElements((prev) => {
      const item = prev[id];
      if (!item) return prev;
      return {
        ...prev,
        [id]: {
          ...item,
          hidden: !item.hidden,
        },
      };
    });
  }, []);

  const handleToggleLocked = useCallback((id: string) => {
    invokeCommand("layer.toggleLock");
    setElements((prev) => {
      const item = prev[id];
      if (!item) return prev;
      return {
        ...prev,
        [id]: {
          ...item,
          locked: !item.locked,
        },
      };
    });
  }, []);

  // Snapping and Transform Gestures
  const { snapLines, spacingMarks, startMove, startResize } = useStageTransform({
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

  // Report the stage size to the camera store so fit, zoom to selection and the other camera actions know the viewport.
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
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
    | null
  >(null);
  const justDragged = useRef(false);
  const rightPan = useRef(false);
  const rightMoved = useRef(false);
  const [drawPreview, setDrawPreview] = useState<DrawPreview | null>(null);
  const toolCursor = activeTool === "hand" ? "grab" : creationSpecFor(activeTool, activeShape) ? "crosshair" : undefined;

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
    const spec = creationSpecFor(activeTool, activeShape);
    if (!spec) return;
    if ((e.target as HTMLElement).closest("button,[role=menu]")) return; // the canvas size label and its menu keep working
    const at = toArtboard(e.clientX, e.clientY);
    if (!at) return; // anywhere on the canvas: a frame or shape can start outside the page too
    gesture.current = { kind: "create", spec, start: { x: at.x, y: at.y } };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleToolPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pan") {
      if (rightPan.current && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 3) rightMoved.current = true;
      setDragPan({ x: g.from.x + e.clientX - g.startX, y: g.from.y + e.clientY - g.startY });
      return;
    }
    const at = toArtboard(e.clientX, e.clientY);
    if (!at) return;
    const b = drawBox(g.spec, g.start, { x: at.x, y: at.y }, { shift: e.shiftKey, alt: e.altKey }, at.scale);
    setDrawPreview({ x: b.x, y: b.y, width: b.width, height: b.height, rotation: b.rotation, archetype: g.spec.archetype });
  };

  const handleToolPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    justDragged.current = true; // the click that follows a drag must not deselect what the drag just made
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (g.kind === "pan") {
      rightPan.current = false;
      return;
    }
    setDrawPreview(null);
    const at = toArtboard(e.clientX, e.clientY);
    if (!at) return;
    const box = drawBox(g.spec, g.start, { x: at.x, y: at.y }, { shift: e.shiftKey, alt: e.altKey }, at.scale);
    selectStore(createLayerFromBox(g.spec, box), "element");
    onToolDone?.();
  };

  // The Image tool asks for a picture as soon as it is chosen, then puts it in the middle of the page, at its own size (up to 600px a side).
  useEffect(() => {
    if (activeTool === "image") imageInput.current?.click();
  }, [activeTool]);

  const placePicked = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) {
      onToolDone?.(); // cancelled
      return;
    }
    const outcomes = await importFiles(list);
    const root = Object.values(getDocument().layers).find((l) => l.parentId === null);
    let last: string | null = null;
    outcomes.forEach((o, i) => {
      if (!o.entry || !root) return;
      const at = { x: presetDef.artboardWidth / 2 + i * 24, y: presetDef.artboardHeight / 2 + i * 24, parentId: root.id, parentOrigin: { x: 0, y: 0 } };
      last = placeImage(o.entry, at) ?? last;
    });
    if (last) selectStore(last, "element");
    onToolDone?.();
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
      onContextMenu={(e) => {
        if (rightMoved.current) e.preventDefault(); // that was a canvas drag, not a menu request
        rightMoved.current = false;
      }}
      onPointerDownCapture={handleToolPointerDown}
      onPointerMove={handleToolPointerMove}
      onPointerUp={handleToolPointerUp}
      onPointerCancel={handleToolPointerCancel}
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
        layers={storeLayers}
        drawPreview={drawPreview}
        selectedIds={selectedIds}
        hoveredId={hoveredId}
        onSelect={handleSelect}
        onHover={setHoveredId}
        activeTool={activeTool}
        snapGuides={snapGuides}
        empty={empty}
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
      />
    </div>
  );
};
