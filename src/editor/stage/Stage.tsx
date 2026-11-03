"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useDocument } from "@/core/store/useDocumentStore";
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
  snapGuides = true,
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

  return (
    <div
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
        mode={mode}
        snapLines={snapLines}
        spacingMarks={spacingMarks}
        onStartMove={startMove}
        onStartResize={startResize}
      />
    </div>
  );
};
