"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
import { invokeCommand } from "@/core/commands";
import { registerEditingCommands } from "@/core/editing/editCommands";
import { registerSelectionCommands } from "@/core/selection/selectionCommands";
import { registerFrameCommands } from "@/core/frames/frameCommands";
import { registerTimelineCommands } from "@/core/timeline/timelineCommands";
import { useLayers, useDocument } from "@/core/store/useDocumentStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useLayersUiStore } from "@/core/store/useLayersUiStore";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import { useTimelineUiStore } from "@/core/store/useTimelineUiStore";
import { useProjectStore } from "@/core/store/useProjectStore";
import { motionIndex, type MotionSummary } from "@/core/timeline/model";
import { buildRows, ancestorsOf, rangeBetween } from "@/core/layers/layerTree";
import { frameIdOf } from "@/core/frames/frames";
import { buildLayerTree } from "./buildLayerTree";
import type {
  UseLeftPanelDataOptions,
  UseLeftPanelDataReturn,
  LayerMenuAction,
  TrackItem,
  AssetItem,
  FileItem,
} from "./types";
import {
  SAMPLE_FILES,
  SAMPLE_TRACKS,
  SAMPLE_ASSETS,
} from "@/editor/shell/left-panel/sampleData";

export function useLeftPanelData(
  options?: UseLeftPanelDataOptions
): UseLeftPanelDataReturn {
  const mode = options?.mode ?? "design";
  const filterByActivePage = options?.filterByActivePage ?? false;

  // 1. Ensure core commands are registered for the lifetime of the left panel
  useEffect(() => {
    const offEditing = registerEditingCommands();
    const offSelection = registerSelectionCommands();
    const offFrame = registerFrameCommands();
    const offTimeline = registerTimelineCommands();

    return () => {
      offEditing();
      offSelection();
      offFrame();
      offTimeline();
    };
  }, []);

  // 2. Document & layers reactive subscriptions
  const layers = useLayers();
  const clips = useDocument((d) => d.clips);
  const states = useDocument((d) => d.states);
  const behaviours = useDocument((d) => d.behaviours);

  const motionMap = useMemo(
    () => motionIndex({ layers, clips, states, behaviours }),
    [layers, clips, states, behaviours]
  );

  // 3. Selection & layer UI store subscriptions
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const expandedSet = useLayersUiStore((s) => s.expanded);
  const query = useLayersUiStore((s) => s.query);
  const activePageId = useProjectStore((s) => s.activePageId);
  const pages = useProjectStore((s) => s.pages);

  // 4. Derive LayerItem trees (all layers and filtered page layers)
  const rootFilterId = filterByActivePage ? pages[activePageId]?.rootElementId : null;
  const layerTree = useMemo(
    () => buildLayerTree(layers, motionMap, rootFilterId),
    [layers, motionMap, rootFilterId]
  );
  const allLayers = useMemo(
    () => buildLayerTree(layers, motionMap, null),
    [layers, motionMap]
  );

  // Expanded IDs as array
  const expandedIds = useMemo(() => Array.from(expandedSet), [expandedSet]);

  // 5. Expand ancestors when selection changes externally (e.g. from canvas)
  useEffect(() => {
    const activeId = selectedIds[selectedIds.length - 1];
    if (!activeId || !layers[activeId]) return;
    const ancestors = ancestorsOf(layers, activeId);
    if (ancestors.length > 0) {
      useLayersUiStore.getState().expandAll(ancestors);
    }
  }, [selectedIds, layers]);

  // 6. Selection handler with Shift-range and Ctrl-toggle support
  const onSelect = useCallback(
    (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
      const store = useSelectionStore.getState();
      const ui = useLayersUiStore.getState();

      if (e?.shiftKey) {
        const anchor = ui.anchor ?? store.selectedIds[store.selectedIds.length - 1] ?? id;
        const rows = buildRows(layers, expandedSet, query);
        const range = rangeBetween(rows, anchor, id);
        store.selectMultiple(range, "element");
      } else if (e?.metaKey || e?.ctrlKey) {
        store.toggleSelection(id, "element");
        ui.setAnchor(id);
      } else {
        store.select(id, "element");
        ui.setAnchor(id);
      }

      const frame = frameIdOf(layers, id);
      if (frame) {
        useCanvasViewStore.getState().setActiveFrame(frame);
      }
    },
    [layers, expandedSet, query]
  );

  // 7. Tree expansion toggle
  const onToggleExpand = useCallback(
    (id: string) => {
      useLayersUiStore.getState().setExpanded(id, !expandedSet.has(id));
    },
    [expandedSet]
  );

  // 8. Hide & Lock toggles
  const onToggleHidden = useCallback(
    (id: string) => {
      const layer = layers[id];
      if (layer) {
        void invokeCommand("layer.setVisible", {
          ids: [id],
          visible: layer.visible === false,
        });
      }
    },
    [layers]
  );

  const onToggleLocked = useCallback(
    (id: string) => {
      const layer = layers[id];
      if (layer) {
        void invokeCommand("layer.setLocked", {
          ids: [id],
          locked: !layer.locked,
        });
      }
    },
    [layers]
  );

  // 9. Rename handler
  const onRename = useCallback((id: string, newName: string) => {
    if (newName && newName.trim()) {
      void invokeCommand("layer.setName", { id, name: newName.trim() });
    }
  }, []);

  // 10. Reorder / move helper
  const onMoveLayer = useCallback(
    (ids: string[], parentId: string | null, index?: number) => {
      void invokeCommand("layer.move", { ids, parentId, index });
    },
    []
  );

  // 11. Context menu action handler mapped to real commands
  const onLayerAction = useCallback(
    (action: LayerMenuAction, id: string) => {
      const selStore = useSelectionStore.getState();
      if (!selStore.selectedIds.includes(id)) {
        selStore.select(id, "element");
      }

      switch (action) {
        case "copy":
          void invokeCommand("edit.copy");
          break;
        case "paste":
          void invokeCommand("edit.paste");
          break;
        case "paste-in-place":
          void invokeCommand("edit.pasteInPlace");
          break;
        case "duplicate":
          void invokeCommand("edit.duplicate");
          break;
        case "delete":
          void invokeCommand("edit.delete");
          break;
        case "group":
          void invokeCommand("edit.group");
          break;
        case "frame-selection":
          void invokeCommand("edit.frameSelection");
          break;
        case "tidy-up":
          void invokeCommand("layer.tidy");
          break;
        case "ungroup":
          void invokeCommand("edit.ungroup");
          break;
        case "rename":
          useCanvasViewStore.getState().startRename(id);
          void invokeCommand("layer.rename");
          break;
        case "select-all":
          void invokeCommand("selection.all");
          break;
        case "show-all":
          void invokeCommand("layer.showAll");
          break;
        case "unlock-all":
          void invokeCommand("layer.unlockAll");
          break;
        case "bring-forward":
          void invokeCommand("layer.bringForward");
          break;
        case "send-backward":
          void invokeCommand("layer.sendBackward");
          break;
        case "bring-to-front":
          void invokeCommand("layer.bringToFront");
          break;
        case "send-to-back":
          void invokeCommand("layer.sendToBack");
          break;
        case "align-left":
          void invokeCommand("align.left");
          break;
        case "align-center":
          void invokeCommand("align.hcenter");
          break;
        case "align-right":
          void invokeCommand("align.right");
          break;
        case "align-top":
          void invokeCommand("align.top");
          break;
        case "align-middle":
          void invokeCommand("align.vcenter");
          break;
        case "align-bottom":
          void invokeCommand("align.bottom");
          break;
        case "distribute-horizontally":
          void invokeCommand("distribute.horizontal");
          break;
        case "distribute-vertically":
          void invokeCommand("distribute.vertical");
          break;
        case "add-animation":
          selStore.selectMultiple([id], "element");
          useTimelineUiStore.getState().focusLayer(id);
          void invokeCommand("view.timeline");
          break;
        case "ask-ai":
          // Action unmapped to core command in Phase 2
          console.info("[Layers] ask-ai action on layer", id);
          break;
        case "copy-as-code":
          // Action unmapped to core command in Phase 2
          console.info("[Layers] copy-as-code action on layer", id);
          break;
        default:
          break;
      }
    },
    []
  );

  // 12. Search bar wiring
  const [searchOpen, setSearchOpen] = useState(Boolean(query));
  const onSearchQueryChange = useCallback((nextQuery: string) => {
    useLayersUiStore.getState().setQuery(nextQuery);
  }, []);

  const onSearchOpenChange = useCallback((open: boolean) => {
    setSearchOpen(open);
    if (!open) {
      useLayersUiStore.getState().setQuery("");
    }
  }, []);

  // 13. Motion tracks derivation
  const tracks: TrackItem[] = useMemo(() => {
    const list: TrackItem[] = [];
    for (const [layerId, layer] of Object.entries(layers)) {
      const summary = motionMap.get(layerId);
      if (summary && (summary.clips > 0 || summary.states > 0)) {
        list.push({
          id: layerId,
          name: layer.name,
          layerId,
        });
      }
    }
    if (list.length > 0) return list;

    // Fallback: top-level frames or sample tracks
    for (const layer of Object.values(layers)) {
      if (layer.parentId === null) {
        list.push({
          id: layer.id,
          name: layer.name,
          layerId: layer.id,
        });
      }
    }
    return list.length > 0 ? list : SAMPLE_TRACKS;
  }, [layers, motionMap]);

  const [selectedTrackId, setSelectedTrackId] = useState<string>(
    tracks[0]?.id || ""
  );

  const onSelectTrack = useCallback((trackId: string) => {
    setSelectedTrackId(trackId);
    const store = useSelectionStore.getState();
    store.select(trackId, "element");
    useTimelineUiStore.getState().focusLayer(trackId);
  }, []);

  // 14. Files & Assets defaults
  const files: FileItem[] = SAMPLE_FILES;
  const assets: AssetItem[] = SAMPLE_ASSETS;

  // 15. Assets drawer state
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [assetsHeight, setAssetsHeight] = useState<number | undefined>(undefined);

  return {
    mode,
    layers: layerTree,
    allLayers,
    selectedIds,
    onSelect,
    expandedIds,
    onToggleExpand,
    onToggleHidden,
    onToggleLocked,
    onRename,
    onMoveLayer,
    onLayerAction,
    searchQuery: query,
    onSearchQueryChange,
    searchOpen,
    onSearchOpenChange,
    tracks,
    selectedTrackId,
    onSelectTrack,
    files,
    assets,
    assetsOpen,
    onAssetsOpenChange: setAssetsOpen,
    assetsHeight,
    onAssetsHeightChange: setAssetsHeight,
  };
}
