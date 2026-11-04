"use client";

import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useDocument } from "@/core/store/useDocumentStore";
import { useCameraStore } from "@/core/store/useCameraStore";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import { invokeCommand } from "@/core/commands";
import type { LayerMenuAction } from "@/editor/shell/left-panel/types";
import { Artboard } from "./Artboard";
import { useStageTransform } from "./useStageTransform";
import { SAMPLE_STAGE_ELEMENTS } from "./sampleData";
import {
  STAGE_CONSTANTS,
  STAGE_PRESETS,
} from "./constants";
import type { StageProps, StageElement, StagePreset } from "./types";

export const Stage: React.FC<StageProps> = ({
  zoom = STAGE_CONSTANTS.defaultZoom,
  pan = { x: 0, y: 0 },
  selectedIds: controlledSelectedIds,
  onSelect: controlledOnSelect,
  frames: _frames,
  elements: controlledElements,
  activeTool = "select",
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

  // 1. Prototype parity: Open with headline selected in the real selection store
  // 2. Prototype parity: Open at 59% zoom (0.59) centered. If camera has default 1.0 zoom and untouched, set to 0.59
  useEffect(() => {
    if (useSelectionStore.getState().selectedIds.length === 0) {
      useSelectionStore.getState().select("headline", "element");
    }

    const cam = useCameraStore.getState();
    if (cam.camera.zoom === 1 && !cam.touched) {
      cam.setCamera({ x: 0, y: 0, zoom: STAGE_CONSTANTS.defaultZoom });
    }
  }, []);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [internalPreset, setInternalPreset] = useState<StagePreset>("1440");
  const activePreset = controlledPreset !== undefined ? controlledPreset : internalPreset;

  const handlePresetChange = useCallback(
    (newPreset: StagePreset) => {
      setInternalPreset(newPreset);
      controlledOnPresetChange?.(newPreset);
    },
    [controlledOnPresetChange]
  );

  // Document store layers mapping (if present) or sample elements
  const storeLayers = useDocument((d) => d.layers);

  const elementsFromStore = useMemo<Record<string, StageElement>>(() => {
    if (controlledElements) return controlledElements;

    if (storeLayers && Object.keys(storeLayers).length > 0) {
      const result: Record<string, StageElement> = {};
      const layerEntries = Object.values(storeLayers);

      // Check if layers are positioned; if root container has sample elements or defaults
      let hasPositionedLayers = false;
      layerEntries.forEach((l) => {
        if (
          typeof l.properties["frame.x"] === "number" ||
          typeof l.properties["frame.y"] === "number"
        ) {
          hasPositionedLayers = true;
        }
      });

      if (hasPositionedLayers) {
        layerEntries.forEach((l) => {
          if (l.parentId === null && l.archetype === "container") {
            // Root container
            return;
          }
          const x = (l.properties["frame.x"] as number) ?? 0;
          const y = (l.properties["frame.y"] as number) ?? 0;
          const width =
            (l.properties["frame.width"] as number) ??
            (l.archetype === "button" ? 112 : 200);
          const height =
            (l.properties["frame.height"] as number) ??
            (l.archetype === "button" ? 34 : 60);

          result[l.id] = {
            id: l.id,
            name: l.name,
            type:
              l.archetype === "text"
                ? "text"
                : l.archetype === "button"
                ? "button"
                : l.archetype === "image"
                ? "image"
                : "container",
            x,
            y,
            width,
            height,
            title: (l.properties["content.text"] as string) || l.name,
            label: (l.properties["content.label"] as string) || l.name,
          };
        });
        return result;
      }
    }

    return SAMPLE_STAGE_ELEMENTS;
  }, [controlledElements, storeLayers]);

  // Local elements state for direct interactive dragging / manipulation
  const [elements, setElements] = useState<Record<string, StageElement>>(elementsFromStore);

  useEffect(() => {
    setElements(elementsFromStore);
  }, [elementsFromStore]);

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

  const presetDef =
    STAGE_PRESETS.find((p) => p.id === activePreset) || STAGE_PRESETS[0];

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
          invokeCommand("layer.group");
          break;
        case "ungroup":
          invokeCommand("layer.ungroup");
          break;
        case "frame-selection":
          invokeCommand("layer.frameSelection");
          break;
        case "bring-forward":
          invokeCommand("arrange.bringForward");
          break;
        case "send-backward":
          invokeCommand("arrange.sendBackward");
          break;
        case "bring-to-front":
          invokeCommand("arrange.bringToFront");
          break;
        case "send-to-back":
          invokeCommand("arrange.sendToBack");
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
          invokeCommand("align.distributeHorizontally");
          break;
        case "distribute-vertically":
          invokeCommand("align.distributeVertically");
          break;
        case "tidy-up":
          invokeCommand("align.tidyUp");
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
    invokeCommand("layer.toggleLocked");
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
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const syncSize = () => useCameraStore.getState().setViewport({ width: el.clientWidth, height: el.clientHeight });
    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={viewportRef}
      data-stage="workspace"
      className={`ll-stage-viewport ll:relative ll:w-full ll:h-full ll:overflow-hidden ${className}`}
      onClick={(e) => {
        // Clicking on blank canvas space deselects
        if (e.target === e.currentTarget) {
          handleSelect(null);
        }
      }}
    >
      <Artboard
        title={title}
        preset={activePreset}
        onPresetChange={handlePresetChange}
        width={presetDef.artboardWidth}
        height={presetDef.artboardHeight}
        zoom={zoom}
        pan={pan}
        elements={elements}
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
