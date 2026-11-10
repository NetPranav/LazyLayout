/**
 * Preset and Breakpoint synchronization (Task E):
 * Sizes:
 * - Desktop: 1440x900 (base breakpoint)
 * - Tablet: 768x1024 (breakpoint named Tablet at 768)
 * - Mobile: 375x812 (breakpoint named Mobile at 375)
 *
 * New behaviour:
 * a) If the page has no frames and nothing else: choosing a preset CREATES a frame
 *    of that size, named "Desktop" / "Tablet" / "Mobile", placed at the page origin,
 *    selected, one undo step.
 * b) If there is a frame: choosing a preset shows the active frame (the selected layer's
 *    frame, else the active frame) at that device width using the engine's existing
 *    breakpoint system.
 */

import type { Layer } from "@/core/document/schema";
import { breakpointsOf, isBase, type Breakpoint } from "@/core/breakpoints/breakpoints";
import { addBreakpoint, setActiveBreakpoint } from "@/core/breakpoints/breakpointOps";
import { useBreakpointStore } from "@/core/store/useBreakpointStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { documentCommands } from "@/core/store/useDocumentStore";
import { getDocument } from "@/core/store/documentState";
import { activePageRootId } from "./activePage";
import { NEW_FRAME_FILL } from "./frameFill";
import type { StagePreset } from "./types";
import { setLayerProps } from "@/core/editing/editOps";

export type DevicePreset = "1440" | "768" | "375";

export interface PresetDef {
  id: DevicePreset;
  label: "Desktop" | "Tablet" | "Mobile";
  width: number;
  height: number;
}

export const PRESET_DEFS: readonly PresetDef[] = [
  { id: "1440", label: "Desktop", width: 1440, height: 900 },
  { id: "768", label: "Tablet", width: 768, height: 1024 },
  { id: "375", label: "Mobile", width: 375, height: 812 },
];

/** Normalizes any string representation of a preset ("desktop", "tablet", "375", etc.) to "1440" | "768" | "375". */
export function normalizePresetId(preset: string): DevicePreset {
  const p = preset.toLowerCase().trim();
  if (p === "375" || p === "mobile") return "375";
  if (p === "768" || p === "tablet") return "768";
  return "1440";
}

/** Given document breakpoints and currently active breakpoint ID, determines the active preset ID ("1440" | "768" | "375"). */
export function presetForBreakpoint(
  breakpoints: readonly Breakpoint[],
  activeBreakpointId: string | null | undefined
): DevicePreset {
  if (isBase(breakpoints, activeBreakpointId)) return "1440";
  const bp = breakpoints.find((b) => b.id === activeBreakpointId);
  if (!bp) return "1440";
  if (bp.width === 375 || bp.name.toLowerCase() === "mobile") return "375";
  if (bp.width === 768 || bp.name.toLowerCase() === "tablet") return "768";
  return bp.width <= 480 ? "375" : bp.width <= 1024 ? "768" : "1440";
}

/** Finds the breakpoint in the list that corresponds to a preset. */
export function findBreakpointForPreset(
  breakpoints: readonly Breakpoint[],
  preset: DevicePreset
): Breakpoint | undefined {
  if (preset === "1440") {
    // Base breakpoint (widest)
    return breakpoints[0];
  }
  const def = PRESET_DEFS.find((p) => p.id === preset);
  if (!def) return undefined;
  return breakpoints.find((b) => b.width === def.width || b.name.toLowerCase() === def.label.toLowerCase());
}

/** Finds the active container frame given selection and document state. */
export function findActiveFrameId(
  layers: Record<string, { id?: string; archetype?: string; parentId?: string | null; children?: readonly string[] }>,
  rootId: string | null,
  selectedIds: readonly string[],
  activeFrameId?: string | null
): string | null {
  // 1. If a layer is selected: walk up to its direct child of root (or container frame)
  if (selectedIds.length > 0) {
    const sel = selectedIds[0];
    let cur: { id?: string; archetype?: string; parentId?: string | null; children?: readonly string[] } | undefined = layers[sel];
    while (cur) {
      if (cur.parentId === null || cur.parentId === rootId) {
        if (cur.archetype === "container" && cur.id && cur.id !== rootId) return cur.id;
        break;
      }
      cur = cur.parentId ? layers[cur.parentId] : undefined;
    }
  }

  // 2. Active frame from store
  if (activeFrameId && layers[activeFrameId]?.archetype === "container" && activeFrameId !== rootId) {
    return activeFrameId;
  }

  // 3. First container child of root
  if (rootId && layers[rootId]?.children) {
    const firstChild = layers[rootId].children.find((id) => layers[id]?.archetype === "container" && id !== rootId);
    if (firstChild) return firstChild;
  }

  // 4. Any container layer whose parentId === rootId (or parentId !== null)
  for (const layer of Object.values(layers)) {
    if (layer.archetype === "container" && layer.id && layer.id !== rootId && (rootId ? layer.parentId === rootId : layer.parentId !== null)) {
      return layer.id;
    }
  }

  return null;
}

export type PresetActionKind =
  | { kind: "create_frame"; preset: PresetDef; rootId: string }
  | { kind: "activate_breakpoint"; preset: PresetDef; frameId: string; breakpointId: string | null; makeResponsive: boolean; needsAddBreakpoint?: { name: string; width: number } }
  | { kind: "resize_page"; preset: PresetDef; rootId: string };

/** Pure planner for preset actions. */
export function planPresetAction(
  preset: DevicePreset,
  layers: Record<string, Layer>,
  rootId: string | null,
  selectedIds: readonly string[],
  activeFrameId?: string | null
): PresetActionKind {
  const def = PRESET_DEFS.find((p) => p.id === preset) ?? PRESET_DEFS[0];
  const root = rootId ? layers[rootId] : Object.values(layers).find((l) => l.parentId === null);
  const effectiveRootId = root ? root.id : "root";
  const directChildren = root?.children?.map((id) => layers[id]).filter((l): l is Layer => !!l) ?? [];
  const frames = directChildren.filter((l) => l.archetype === "container");
  const hasLoose = directChildren.some((l) => l.archetype !== "container");

  if (frames.length === 0 && !hasLoose) {
    return { kind: "create_frame", preset: def, rootId: effectiveRootId };
  }

  if (frames.length > 0) {
    const targetId = findActiveFrameId(layers, root ? root.id : null, selectedIds, activeFrameId) ?? frames[0].id;
    const frame = layers[targetId];
    const docBps = breakpointsOf({ breakpoints: getDocument().breakpoints });

    if (preset === "1440") {
      return {
        kind: "activate_breakpoint",
        preset: def,
        frameId: targetId,
        breakpointId: null,
        makeResponsive: false,
      };
    }

    const existingBp = findBreakpointForPreset(docBps, preset);
    return {
      kind: "activate_breakpoint",
      preset: def,
      frameId: targetId,
      breakpointId: existingBp ? existingBp.id : null,
      makeResponsive: frame ? frame.properties["breakpoints.responsive"] !== true : true,
      needsAddBreakpoint: existingBp ? undefined : { name: def.label, width: def.width },
    };
  }

  // Loose layers only
  return { kind: "resize_page", preset: def, rootId: effectiveRootId };
}

/** Synchronizes a preset to the active breakpoint on a target frame. */
export function syncBreakpointForPreset(presetId: DevicePreset, frameId?: string | null): void {
  const doc = getDocument();
  const list = breakpointsOf(doc);

  if (presetId === "1440") {
    // Desktop: base breakpoint
    setActiveBreakpoint(null);
    return;
  }

  const def = PRESET_DEFS.find((p) => p.id === presetId)!;
  let bp = list.find((b) => b.width === def.width || b.name.toLowerCase() === def.label.toLowerCase());
  if (!bp) {
    const newId = addBreakpoint(def.label, def.width);
    if (newId) bp = breakpointsOf(getDocument()).find((b) => b.id === newId);
  }

  if (bp) {
    if (frameId) {
      const targetLayer = getDocument().layers[frameId];
      if (targetLayer && targetLayer.properties["breakpoints.responsive"] !== true) {
        documentCommands.updateProps(targetLayer.id, { "breakpoints.responsive": true }, "Make frame responsive");
      }
    }
    setActiveBreakpoint(bp.id);
  }
}

/**
 * Main entry point for selecting a stage preset ("1440" / "768" / "375" / Desktop / Tablet / Mobile).
 * Implements Task E parts 2(a) and 2(b).
 */
export function executeStagePreset(
  preset: string,
  options?: {
    onPresetChange?: (preset: StagePreset) => void;
    selectCreatedFrame?: boolean;
  }
): void {
  const norm = normalizePresetId(preset);
  options?.onPresetChange?.(norm);

  const doc = getDocument();
  const layers = doc.layers;
  const rootId = activePageRootId();
  const root = rootId ? layers[rootId] : Object.values(layers).find((l) => l.parentId === null);
  const directChildren = root?.children?.map((id) => layers[id]).filter((l): l is Layer => !!l) ?? [];
  const frames = directChildren.filter((l) => l.archetype === "container");
  const hasLoose = directChildren.some((l) => l.archetype !== "container");
  const selectedIds = useSelectionStore.getState().selectedIds;
  const def = PRESET_DEFS.find((p) => p.id === norm) ?? PRESET_DEFS[0];

  if (frames.length === 0 && !hasLoose) {
    // Case a: Empty page - create a frame of that size, named Desktop/Tablet/Mobile, at origin, selected
    const frameId = documentCommands.addLayer(
      {
        archetype: "container",
        parentId: root ? root.id : activePageRootId(),
        name: def.label,
        properties: {
          positioning: "absolute",
          "frame.x": 0,
          "frame.y": 0,
          "frame.width": def.width,
          "frame.height": def.height,
          "appearance.background.color": NEW_FRAME_FILL,
        },
      },
      `Create ${def.label} frame`
    );
    if (options?.selectCreatedFrame !== false) {
      useSelectionStore.getState().select(frameId, "element");
    }
    // Also activate the breakpoint for that preset
    syncBreakpointForPreset(norm, frameId);
  } else if (frames.length > 0) {
    // Case b: There is a frame - show active frame at that device width using breakpoints
    const activeFrameId = findActiveFrameId(layers, root ? root.id : null, selectedIds) ?? frames[0].id;
    syncBreakpointForPreset(norm, activeFrameId);
  } else {
    // Case c: Loose layers on page - resize the page itself (existing behavior)
    if (root) {
      setLayerProps([root.id], { "frame.width": def.width, "frame.widthUnit": "px", "frame.height": def.height, "frame.heightUnit": "px" }, "Page size");
    }
  }
}
