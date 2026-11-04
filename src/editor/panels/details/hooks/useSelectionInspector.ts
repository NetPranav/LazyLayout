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
  setLayerProps,
  alignLayers,
  distributeLayers,
  tidyLayers,
  toggleHidden,
  toggleLock,
  type AlignTarget,
} from "@/core/editing/editOps";
import type { AlignMode, SpreadAxis } from "@/core/geometry/align";
import { STAGE_CONSTANTS } from "@/editor/stage/constants";

export interface PrototypeElementDef {
  name: string;
  archetype: string;
  icon: LucideIcon;
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  op?: number; // 0 to 100
  rad?: number;
  fill?: string;
  fo?: number;
  text?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: string;
  textSizing?: string;
  hasMotion?: boolean;
  hasData?: boolean;
  isFrame?: boolean;
}

/**
 * Exact prototype element values matching DOCS/UI/design/editor-design-mode-blocks-dark.html
 * DATA, TYPE, TXT, KIND, and STAGE_CONSTANTS.
 */
export const PROTOTYPE_ELEMENTS: Record<string, PrototypeElementDef> = {
  headline: {
    name: "Headline",
    archetype: "text",
    icon: Type,
    x: STAGE_CONSTANTS.headlineX, // 36
    y: STAGE_CONSTANTS.headlineY, // 70
    w: STAGE_CONSTANTS.headlineWidth, // 340
    h: STAGE_CONSTANTS.headlineHeight, // 82
    rot: 0,
    op: 100,
    rad: 0,
    fill: "FFFFFF",
    fo: 100,
    text: "Design it once. Ship it lazily.",
    fontFamily: "Geist",
    fontWeight: "600",
    fontSize: 30,
    lineHeight: 1.05,
    letterSpacing: -0.03,
    textAlign: "left",
    textSizing: "autoWidth",
    hasMotion: false,
    hasData: false,
    isFrame: false,
  },
  subtitle: {
    name: "Subtitle",
    archetype: "text",
    icon: Type,
    x: 36,
    y: 160,
    w: 340,
    h: 36,
    rot: 0,
    op: 100,
    rad: 0,
    fill: "BFBFBF",
    fo: 100,
    text: "Build pages visually and get production code out.",
    fontFamily: "Geist",
    fontWeight: "400",
    fontSize: 13,
    lineHeight: 1.4,
    letterSpacing: 0,
    textAlign: "left",
    textSizing: "autoWidth",
    hasMotion: false,
    hasData: false,
    isFrame: false,
  },
  button: {
    name: "Get started",
    archetype: "button",
    icon: RectangleHorizontal,
    x: STAGE_CONSTANTS.buttonX, // 36
    y: STAGE_CONSTANTS.buttonY, // 226
    w: STAGE_CONSTANTS.buttonWidth, // 112
    h: STAGE_CONSTANTS.buttonHeight, // 34
    rot: 0,
    op: 100,
    rad: 6,
    fill: "FFFFFF",
    fo: 100,
    text: "Get started",
    fontFamily: "Geist",
    fontWeight: "500",
    fontSize: 15,
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: "center",
    textSizing: "fixed",
    hasMotion: false,
    hasData: false,
    isFrame: false,
  },
  image: {
    name: "Hero image",
    archetype: "image",
    icon: ImageIcon,
    x: STAGE_CONSTANTS.imageX, // 420
    y: STAGE_CONSTANTS.imageY, // 70
    w: STAGE_CONSTANTS.imageWidth, // 150
    h: STAGE_CONSTANTS.imageHeight, // 170
    rot: 0,
    op: 100,
    rad: 0,
    fill: "2C2C2C",
    fo: 100,
    hasMotion: false,
    hasData: false,
    isFrame: false,
  },
  card: {
    name: "Card",
    archetype: "container",
    icon: Frame,
    x: 36,
    y: 280,
    w: 340,
    h: 120,
    rot: 0,
    op: 100,
    rad: 8,
    fill: "2C2C2C",
    fo: 100,
    isFrame: true,
  },
  hero: {
    name: "Hero",
    archetype: "container",
    icon: Frame,
    x: 0,
    y: 0,
    w: 600,
    h: 380,
    rot: 0,
    op: 100,
    rad: 0,
    fill: "2C2C2C",
    fo: 100,
    isFrame: true,
  },
  features: {
    name: "Features",
    archetype: "container",
    icon: Frame,
    x: 0,
    y: 0,
    w: 600,
    h: 380,
    rot: 0,
    op: 100,
    rad: 0,
    fill: "2C2C2C",
    fo: 100,
    isFrame: true,
  },
  footer: {
    name: "Footer",
    archetype: "container",
    icon: Frame,
    x: 0,
    y: 330,
    w: 600,
    h: 50,
    rot: 0,
    op: 100,
    rad: 0,
    fill: "2C2C2C",
    fo: 100,
    isFrame: true,
  },
  others: {
    name: "Other elements",
    archetype: "container",
    icon: Frame,
    x: 0,
    y: 0,
    w: 600,
    h: 400,
    rot: 0,
    op: 100,
    rad: 0,
    fill: "1E1E1E",
    fo: 100,
    isFrame: true,
  },
  input: {
    name: "Email input",
    archetype: "input",
    icon: TextCursorInput,
    x: 36,
    y: 420,
    w: 240,
    h: 36,
    rot: 0,
    op: 100,
    rad: 6,
    fill: "383838",
    fo: 100,
    fontFamily: "Geist",
    fontWeight: "400",
    fontSize: 13,
    lineHeight: 1.4,
    letterSpacing: 0,
    isFrame: false,
  },
  toggle: {
    name: "Newsletter toggle",
    archetype: "toggle",
    icon: ToggleLeft,
    x: 36,
    y: 470,
    w: 44,
    h: 24,
    rot: 0,
    op: 100,
    rad: 12,
    fill: "FFFFFF",
    fo: 100,
    isFrame: false,
  },
  divider: {
    name: "Section divider",
    archetype: "divider",
    icon: Minus,
    x: 36,
    y: 510,
    w: 528,
    h: 1,
    rot: 0,
    op: 100,
    rad: 0,
    fill: "444444",
    fo: 100,
    isFrame: false,
  },
  background: {
    name: "Page background",
    archetype: "image",
    icon: ImageIcon,
    x: 0,
    y: 0,
    w: 1440,
    h: 900,
    rot: 0,
    op: 100,
    rad: 0,
    fill: "1E1E1E",
    fo: 100,
    isFrame: false,
  },
  icon: {
    name: "Menu icon",
    archetype: "icon",
    icon: Star,
    x: 36,
    y: 530,
    w: 24,
    h: 24,
    rot: 0,
    op: 100,
    rad: 0,
    fill: "FFFFFF",
    fo: 100,
    isFrame: false,
  },
  shape: {
    name: "Star shape",
    archetype: "star",
    icon: Star,
    x: 80,
    y: 530,
    w: 48,
    h: 48,
    rot: 0,
    op: 100,
    rad: 0,
    fill: "FFD60A",
    fo: 100,
    isFrame: false,
  },
  counter: {
    name: "Visitors counter",
    archetype: "counter",
    icon: Hash,
    x: 160,
    y: 530,
    w: 120,
    h: 48,
    rot: 0,
    op: 100,
    rad: 0,
    fill: "FFFFFF",
    fo: 100,
    fontFamily: "Geist",
    fontWeight: "600",
    fontSize: 32,
    lineHeight: 1,
    letterSpacing: 0,
    isFrame: false,
  },
  object3d: {
    name: "3D model",
    archetype: "object3d",
    icon: Box,
    x: 320,
    y: 520,
    w: 160,
    h: 160,
    rot: 0,
    op: 100,
    rad: 0,
    fill: "2C2C2C",
    fo: 100,
    isFrame: false,
  },
};

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
      return Box;
    default:
      return Frame;
  }
}

/** Local interactive overrides store to persist edits made in inspector when layer is mock */
const mockOverrides: Record<string, Record<string, PropValue | null>> = {};

export interface UseSelectionInspectorOptions {
  selectedElementId?: string | null;
}

export function useSelectionInspector(options: UseSelectionInspectorOptions = {}) {
  const storeSelectedId = useSelectionStore((s) => s.selectedId);
  const storeSelectedIds = useSelectionStore((s) => s.selectedIds);
  const layers = useLayers();
  const [, setTick] = useState(0);

  // Selected IDs resolved with priority to options.selectedElementId
  const selectedIds = useMemo(() => {
    if (options.selectedElementId !== undefined) {
      return options.selectedElementId ? [options.selectedElementId] : [];
    }
    return storeSelectedIds;
  }, [options.selectedElementId, storeSelectedIds]);

  const selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
  const isMulti = selectedIds.length > 1;

  // Selected layer objects: resolve from document layers OR synthetic prototype definition
  const selectedLayers = useMemo(() => {
    return selectedIds
      .map((id) => {
        if (layers[id]) return layers[id];
        const proto = PROTOTYPE_ELEMENTS[id];
        if (proto) {
          const overrides = mockOverrides[id] || {};
          const syntheticLayer: Layer = {
            id,
            name: proto.name,
            archetype: proto.archetype as Layer["archetype"],
            parentId: null,
            children: [],
            visible: true,
            locked: false,
            properties: {
              "frame.x": proto.x,
              "frame.y": proto.y,
              "frame.width": proto.w,
              "frame.height": proto.h,
              "frame.rotation": proto.rot ?? 0,
              "sizing.horizontal": "fixed",
              "sizing.vertical": "fixed",
              "appearance.opacity": (proto.op ?? 100) / 100,
              "appearance.radius": proto.rad ?? 0,
              "appearance.background.color": `#${proto.fill || "FFFFFF"}`,
              "fill.opacity": proto.fo ?? 100,
              "content.text": proto.text || proto.name,
              "content.label": proto.text || proto.name,
              "typography.fontFamily": proto.fontFamily || "Geist",
              "typography.fontWeight": proto.fontWeight || "400",
              "typography.fontSize": proto.fontSize || 16,
              "typography.lineHeight": proto.lineHeight || 1.4,
              "typography.letterSpacing": proto.letterSpacing || 0,
              "typography.textAlign": proto.textAlign || "left",
              "text.sizing": proto.textSizing || "fixed",
              ...overrides,
            },
          };
          return syntheticLayer;
        }
        return undefined;
      })
      .filter(Boolean) as Layer[];
  }, [selectedIds, layers]);

  const primaryLayer: Layer | undefined = selectedLayers[0];
  const hasSelection = selectedIds.length > 0;

  // Derive selection name and icon
  const selectionName = useMemo(() => {
    if (!hasSelection) return "Landing page";
    if (isMulti) return `${selectedIds.length} layers`;
    if (primaryLayer) return primaryLayer.name;
    if (selectedId && PROTOTYPE_ELEMENTS[selectedId]) return PROTOTYPE_ELEMENTS[selectedId].name;
    return selectedId || "Headline";
  }, [hasSelection, isMulti, selectedIds.length, primaryLayer, selectedId]);

  const selectionIcon = useMemo(() => {
    if (!hasSelection) return Frame;
    if (isMulti) return Frame;
    if (selectedId && PROTOTYPE_ELEMENTS[selectedId]) return PROTOTYPE_ELEMENTS[selectedId].icon;
    return getIconForArchetype(primaryLayer?.archetype);
  }, [hasSelection, isMulti, selectedId, primaryLayer?.archetype]);

  const isFrame = useMemo(() => {
    if (!primaryLayer) return false;
    return (
      primaryLayer.archetype === "container" ||
      (primaryLayer.archetype as string) === "frame" ||
      PROTOTYPE_ELEMENTS[primaryLayer.id]?.isFrame === true
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

      const firstLayer = selectedLayers[0];
      const overrides = mockOverrides[firstLayer.id];
      const firstVal =
        overrides?.[propKey] !== undefined
          ? overrides[propKey]
          : firstLayer.properties?.[propKey] ?? null;

      for (let i = 1; i < selectedLayers.length; i++) {
        const lyr = selectedLayers[i];
        const lyrOverrides = mockOverrides[lyr.id];
        const val =
          lyrOverrides?.[propKey] !== undefined
            ? lyrOverrides[propKey]
            : lyr.properties?.[propKey] ?? null;

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
      if (realIds.length > 0) {
        setLayerProps(realIds, { [propKey]: value }, `Change ${propKey}`);
      }

      selectedIds.forEach((id) => {
        if (!mockOverrides[id]) mockOverrides[id] = {};
        mockOverrides[id][propKey] = value;
      });
      setTick((t) => t + 1);
    },
    [selectedIds, layers]
  );

  /** Writes multiple properties in one atomic transaction */
  const onUpdateProps = useCallback(
    (patch: Record<string, PropValue | null>) => {
      if (selectedIds.length === 0) return;

      const realIds = selectedIds.filter((id) => Boolean(layers[id]));
      if (realIds.length > 0) {
        setLayerProps(realIds, patch, "Change properties");
      }

      selectedIds.forEach((id) => {
        if (!mockOverrides[id]) mockOverrides[id] = {};
        Object.assign(mockOverrides[id], patch);
      });
      setTick((t) => t + 1);
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
