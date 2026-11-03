"use client";

import { useMemo, useCallback } from "react";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useLayers } from "@/core/store/useDocumentStore";
import type { Layer } from "@/core/document/schema";
import type { PropValue } from "@/core/document/registry";
import {
  setLayerProps,
  alignLayers,
  distributeLayers,
  tidyLayers,
  toggleHidden,
  toggleLock,
  type AlignTarget,
} from "@/core/editing/editOps";
import type { AlignMode, SpreadAxis } from "@/core/geometry/align";

export interface UseSelectionInspectorOptions {
  selectedElementId?: string | null;
}

export function useSelectionInspector(options: UseSelectionInspectorOptions = {}) {
  const storeSelectedId = useSelectionStore((s) => s.selectedId);
  const storeSelectedIds = useSelectionStore((s) => s.selectedIds);
  const layers = useLayers();

  // Selected IDs resolved with priority to options.selectedElementId
  const selectedIds = useMemo(() => {
    if (options.selectedElementId !== undefined) {
      return options.selectedElementId ? [options.selectedElementId] : [];
    }
    return storeSelectedIds;
  }, [options.selectedElementId, storeSelectedIds]);

  const selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
  const isMulti = selectedIds.length > 1;

  // Selected layer objects (filtered to valid layers in doc)
  const selectedLayers = useMemo(() => {
    return selectedIds.map((id) => layers[id]).filter(Boolean) as Layer[];
  }, [selectedIds, layers]);

  const primaryLayer: Layer | undefined = selectedLayers[0];

  /**
   * Reads property across all selected layers.
   * If all selected layers have the exact same value, returns that value.
   * If they differ or none exist, returns null ("Mixed").
   */
  const getValue = useCallback(
    (propKey: string): PropValue | null => {
      if (selectedLayers.length === 0) return null;

      const firstLayer = selectedLayers[0];
      const firstVal = firstLayer.properties?.[propKey] ?? null;

      for (let i = 1; i < selectedLayers.length; i++) {
        const val = selectedLayers[i].properties?.[propKey] ?? null;
        if (val !== firstVal) {
          return null;
        }
      }

      return firstVal;
    },
    [selectedLayers]
  );

  /** Writes a single property to all selected layers with an undoable transaction */
  const onUpdateProp = useCallback(
    (propKey: string, value: PropValue | null) => {
      if (selectedIds.length === 0) return;
      setLayerProps(selectedIds, { [propKey]: value }, `Change ${propKey}`);
    },
    [selectedIds]
  );

  /** Writes multiple properties in one atomic transaction */
  const onUpdateProps = useCallback(
    (patch: Record<string, PropValue | null>) => {
      if (selectedIds.length === 0) return;
      setLayerProps(selectedIds, patch, "Change properties");
    },
    [selectedIds]
  );

  // Alignment actions
  const onAlign = useCallback(
    (mode: AlignMode, target: AlignTarget = "auto") => {
      if (selectedIds.length === 0) return;
      alignLayers(selectedIds, mode, target);
    },
    [selectedIds]
  );

  const onDistribute = useCallback(
    (axis: SpreadAxis) => {
      if (selectedIds.length < 2) return;
      distributeLayers(selectedIds, axis);
    },
    [selectedIds]
  );

  const onTidy = useCallback(() => {
    if (selectedIds.length < 2) return;
    tidyLayers(selectedIds);
  }, [selectedIds]);

  const onToggleHide = useCallback(() => {
    if (selectedIds.length === 0) return;
    toggleHidden(selectedIds);
  }, [selectedIds]);

  const onToggleLock = useCallback(() => {
    if (selectedIds.length === 0) return;
    toggleLock(selectedIds);
  }, [selectedIds]);

  return {
    selectedId,
    selectedIds,
    selectedLayers,
    primaryLayer,
    isMulti,
    hasSelection: selectedIds.length > 0,
    getValue,
    onUpdateProp,
    onUpdateProps,
    onAlign,
    onDistribute,
    onTidy,
    onToggleHide,
    onToggleLock,
  };
}
