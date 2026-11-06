"use client";

import { useMemo, useCallback, useState } from "react";
import {
  Type,
  Frame,
  RectangleHorizontal,
  Image as ImageIcon,
  Box,
  Star,
  Minus,
  TextCursorInput,
  ToggleLeft,
  Hash,
  type LucideIcon,
} from "lucide-react";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useLayers } from "@/core/store/useDocumentStore";
import type { Layer } from "@/core/document/schema";
import type { PropValue } from "@/core/document/registry";
import {
  transaction,
  setLayerProps,
  alignLayers,
  distributeLayers,
  tidyLayers,
  toggleHidden,
  toggleLock,
  type AlignTarget,
} from "@/core/editing/editOps";
import type { AlignMode, SpreadAxis } from "@/core/geometry/align";
import { isSvgPainted, propertyFor, readFor, valueFor } from "./shapeProps";

export function getIconForArchetype(archetype?: string): LucideIcon {
  switch (archetype) {
    case "text":
    case "svgText":
      return Type;
    case "button":
    case "fab":
      return RectangleHorizontal;
    case "image":
    case "background":
      return ImageIcon;
    case "container":
    case "frame":
      return Frame;
    case "input":
      return TextCursorInput;
    case "toggle":
      return ToggleLeft;
    case "divider":
    case "line":
      return Minus;
    case "star":
    case "icon":
      return Star;
    case "object3d":
    case "object3D":
      return Box;
    case "counter":
      return Hash;
    default:
      return Frame;
  }
}

export interface UseSelectionInspectorOptions {
  selectedElementId?: string | null;
}

export function useSelectionInspector(options: UseSelectionInspectorOptions = {}) {
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

  // Selected layer objects: map directly from document layers
  const selectedLayers = useMemo(() => {
    return selectedIds
      .map((id) => layers[id])
      .filter(Boolean) as Layer[];
  }, [selectedIds, layers]);

  const primaryLayer: Layer | undefined = selectedLayers[0];
  const hasSelection = selectedIds.length > 0;

  // Derive selection name and icon
  const selectionName = useMemo(() => {
    if (!hasSelection) return "Landing page";
    if (isMulti) return `${selectedIds.length} layers`;
    if (primaryLayer) return primaryLayer.name;
    return selectedId || "Headline";
  }, [hasSelection, isMulti, selectedIds.length, primaryLayer, selectedId]);

  const selectionIcon = useMemo(() => {
    if (!hasSelection) return Frame;
    if (isMulti) return Frame;
    return getIconForArchetype(primaryLayer?.archetype);
  }, [hasSelection, isMulti, primaryLayer?.archetype]);

  const isFrame = useMemo(() => {
    if (!primaryLayer) return false;
    return (
      primaryLayer.archetype === "container" ||
      (primaryLayer.archetype as string) === "frame"
    );
  }, [primaryLayer]);

  /**
   * Reads property across all selected layers.
   * If all selected layers have the exact same value, returns that value.
   * If they differ or none exist, returns null ("Mixed").
   */
  const getValue = useCallback(
    (propKey: string): PropValue | null => {
      if (selectedLayers.length === 0) return null;

      // Each layer's own property for this field (a shape is painted by svg.fill, a box by its background); "Mixed" only when layers differ.
      const firstVal = readFor(selectedLayers[0], propKey) ?? null;

      for (let i = 1; i < selectedLayers.length; i++) {
        const val = readFor(selectedLayers[i], propKey) ?? null;
        if (val !== firstVal) {
          return null;
        }
      }

      return firstVal;
    },
    [selectedLayers]
  );

  /** Writes a single property to all selected layers */
  const onUpdateProp = useCallback(
    (propKey: string, value: PropValue | null) => {
      if (selectedIds.length === 0) return;

      const realIds = selectedIds.filter((id) => Boolean(layers[id]));
      if (realIds.length === 0) return;
      if (!realIds.some((id) => isSvgPainted(layers[id]))) {
        setLayerProps(realIds, { [propKey]: value }, `Change ${propKey}`);
        return;
      }
      // a shape takes the property it is painted by; one undo step for the whole selection
      transaction(`Change ${propKey}`, () => {
        for (const id of realIds) setLayerProps([id], { [propertyFor(layers[id], propKey)]: valueFor(layers[id], propKey, value) }, `Change ${propKey}`);
      });
    },
    [selectedIds, layers]
  );

  /** Writes multiple properties in one atomic transaction */
  const onUpdateProps = useCallback(
    (patch: Record<string, PropValue | null>) => {
      if (selectedIds.length === 0) return;

      const realIds = selectedIds.filter((id) => Boolean(layers[id]));
      if (realIds.length === 0) return;
      if (!realIds.some((id) => isSvgPainted(layers[id]))) {
        setLayerProps(realIds, patch, "Change properties");
        return;
      }
      transaction("Change properties", () => {
        for (const id of realIds) {
          const own: Record<string, PropValue | null> = {};
          for (const [key, value] of Object.entries(patch)) own[propertyFor(layers[id], key)] = valueFor(layers[id], key, value);
          setLayerProps([id], own, "Change properties");
        }
      });
    },
    [selectedIds, layers]
  );

  // Alignment actions
  const onAlign = useCallback(
    (mode: AlignMode, target: AlignTarget = "auto") => {
      if (selectedIds.length === 0) return;
      const realIds = selectedIds.filter((id) => Boolean(layers[id]));
      if (realIds.length > 0) {
        alignLayers(realIds, mode, target);
      }
    },
    [selectedIds, layers]
  );

  const onDistribute = useCallback(
    (axis: SpreadAxis) => {
      if (selectedIds.length < 2) return;
      const realIds = selectedIds.filter((id) => Boolean(layers[id]));
      if (realIds.length >= 2) {
        distributeLayers(realIds, axis);
      }
    },
    [selectedIds, layers]
  );

  const onTidy = useCallback(() => {
    if (selectedIds.length < 2) return;
    const realIds = selectedIds.filter((id) => Boolean(layers[id]));
    if (realIds.length >= 2) {
      tidyLayers(realIds);
    }
  }, [selectedIds, layers]);

  const [isLayerHidden, setIsLayerHidden] = useState(false);
  const onToggleHide = useCallback(() => {
    if (selectedIds.length === 0) return;
    const realIds = selectedIds.filter((id) => Boolean(layers[id]));
    if (realIds.length > 0) {
      toggleHidden(realIds);
    }
    setIsLayerHidden((prev) => !prev);
  }, [selectedIds, layers]);

  const onToggleLock = useCallback(() => {
    if (selectedIds.length === 0) return;
    const realIds = selectedIds.filter((id) => Boolean(layers[id]));
    if (realIds.length > 0) {
      toggleLock(realIds);
    }
  }, [selectedIds, layers]);

  return {
    selectedId,
    selectedIds,
    selectedLayers,
    primaryLayer,
    isMulti,
    hasSelection,
    isFrame,
    archetype: primaryLayer?.archetype || (isMulti ? "multi" : "page"),
    selectionName,
    selectionIcon,
    isLayerHidden,
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
