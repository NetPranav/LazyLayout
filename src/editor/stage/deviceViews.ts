/**
 * Device views and linked mirror frames (Task I):
 *
 * 1. Design pill dropdown choices:
 *    - Desktop: 1440x900
 *    - Tablet: 768x1024
 *    - Mobile: 375x812
 *
 * 2. Clicking a choice from the Design pill:
 *    a) If NO frame or selected layer's frame is not a frame:
 *       create a new frame of that device size, named after the device, selected.
 *    b) If a frame is selected and it is a DIFFERENT device:
 *       open a live linked view (mirror frame) to its right (120 px gap, same top).
 *       Edits inside the mirror write that device's breakpoint overrides on shared layers.
 *       Mirror content resolves the same layers at the device's breakpoint without copying.
 *    c) If the selected frame already IS the clicked device:
 *       open a NEW independent frame of that device placed to the right.
 *
 * 3. Frame size label menu:
 *    Dropdown on each frame changes that frame to that device view without changing others.
 */

import type { Layer } from "@/core/document/schema";
import { breakpointsOf } from "@/core/breakpoints/breakpoints";
import { addBreakpoint, setActiveBreakpoint } from "@/core/breakpoints/breakpointOps";
import { useBreakpointStore } from "@/core/store/useBreakpointStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { documentCommands } from "@/core/store/useDocumentStore";
import { getDocument } from "@/core/store/documentState";
import { activePageRootId } from "./activePage";
import {
  FRAME_GAP,
  frameInfo,
  nextFramePosition,
  uniqueFrameName,
  type FrameInfo,
} from "@/core/frames/frames";

export type DeviceKind = "desktop" | "tablet" | "mobile";

export interface DeviceSpec {
  id: DeviceKind;
  label: "Desktop" | "Tablet" | "Mobile";
  width: number;
  height: number;
}

export const DEVICE_SPECS: Record<DeviceKind, DeviceSpec> = {
  desktop: { id: "desktop", label: "Desktop", width: 1440, height: 900 },
  tablet: { id: "tablet", label: "Tablet", width: 768, height: 1024 },
  mobile: { id: "mobile", label: "Mobile", width: 375, height: 812 },
};

/** Normalizes any device string to "desktop" | "tablet" | "mobile". */
export function normalizeDeviceKind(device: string): DeviceKind {
  const d = device.toLowerCase().trim();
  if (d === "mobile" || d === "375") return "mobile";
  if (d === "tablet" || d === "768") return "tablet";
  return "desktop";
}

/** Determines the device classification of a frame layer. */
export function deviceOfFrame(layer?: { properties?: Record<string, unknown> } | null): DeviceKind {
  if (!layer || !layer.properties) return "desktop";
  const dev = layer.properties["frame.device"];
  if (dev === "mobile" || dev === "tablet" || dev === "desktop") return dev;
  const w = Number(layer.properties["frame.width"] ?? 1440);
  if (w <= 480) return "mobile";
  if (w <= 1024) return "tablet";
  return "desktop";
}

/** Checks whether a frame layer is a live linked mirror of another frame. */
export function isMirrorFrame(layer?: { properties?: Record<string, unknown> } | null): boolean {
  return Boolean(layer?.properties?.["frame.mirrorOf"]);
}

/** Returns the ID of the main frame that this mirror links to. */
export function getMirroredFrameId(layer?: { properties?: Record<string, unknown> } | null): string | null {
  return (layer?.properties?.["frame.mirrorOf"] as string) ?? null;
}

/** Lists all top-level container frames under the given root. */
export function listTopLevelFrames(layers: Record<string, Layer>, rootId: string | null): Layer[] {
  return Object.values(layers).filter(
    (l) => (l.parentId === rootId || l.parentId === null) && l.archetype === "container" && l.id !== rootId
  );
}

/** Finds the selected frame (either selected directly or ancestor frame of selected layer). */
export function getSelectedFrameId(
  layers: Record<string, Layer>,
  rootId: string | null,
  selectedIds: readonly string[]
): string | null {
  if (selectedIds.length === 0) return null;
  const sel = selectedIds[0];
  let cur: Layer | undefined = layers[sel];
  while (cur) {
    if (cur.parentId === null || cur.parentId === rootId) {
      if (cur.archetype === "container" && cur.id !== rootId) return cur.id;
      return null;
    }
    cur = cur.parentId ? layers[cur.parentId] : undefined;
  }
  return null;
}

export type DeviceChoiceAction =
  | { kind: "create_frame"; device: DeviceSpec; placement: { x: number; y: number } }
  | { kind: "create_mirror"; device: DeviceSpec; mainFrameId: string; placement: { x: number; y: number } }
  | { kind: "create_independent_frame"; device: DeviceSpec; placement: { x: number; y: number } };

/**
 * Pure planner for device choice actions clicked from the Design pill dropdown.
 */
export function planDeviceChoiceAction(params: {
  device: DeviceKind;
  layers: Record<string, Layer>;
  rootId: string | null;
  selectedIds: readonly string[];
}): DeviceChoiceAction {
  const { device, layers, rootId, selectedIds } = params;
  const spec = DEVICE_SPECS[device];
  const frames = listTopLevelFrames(layers, rootId);
  const selectedFrameId = getSelectedFrameId(layers, rootId, selectedIds);

  if (!selectedFrameId || !layers[selectedFrameId]) {
    // 2(a) If there is NO frame or selected layer's frame is not a frame at all: create a new frame
    const placement = frames.length === 0 ? { x: 0, y: 0 } : nextFramePosition(frames.map(frameInfo));
    return { kind: "create_frame", device: spec, placement };
  }

  const selectedFrame = layers[selectedFrameId];
  const targetMainFrameId = (selectedFrame.properties["frame.mirrorOf"] as string) ?? selectedFrame.id;
  const currentDevice = deviceOfFrame(selectedFrame);

  const selX = Number(selectedFrame.properties["frame.x"] ?? 0);
  const selY = Number(selectedFrame.properties["frame.y"] ?? 0);
  const selW = Number(selectedFrame.properties["frame.width"] ?? 1440);
  const placement = { x: Math.round(selX + selW + FRAME_GAP), y: Math.round(selY) };

  if (currentDevice !== device) {
    // 2(b) Selected frame is a DIFFERENT device: open a LIVE LINKED VIEW (mirror frame) to its right
    return { kind: "create_mirror", device: spec, mainFrameId: targetMainFrameId, placement };
  }

  // 2(c) Selected frame already IS the clicked device: open a NEW independent frame placed to the right
  return { kind: "create_independent_frame", device: spec, placement };
}

/** Ensures that a breakpoint corresponding to the device exists in the document. */
export function ensureBreakpointForDevice(spec: DeviceSpec): void {
  const doc = getDocument();
  const list = breakpointsOf(doc);
  if (spec.id === "desktop") return;
  const existing = list.find((b) => b.width === spec.width || b.name.toLowerCase() === spec.label.toLowerCase());
  if (!existing) {
    addBreakpoint(spec.label, spec.width);
  }
}

/**
 * Executes a device choice clicked from the Design pill navigation dropdown.
 */
export function executeDeviceChoice(deviceKindInput: string): string {
  const device = normalizeDeviceKind(deviceKindInput);
  const spec = DEVICE_SPECS[device];
  const doc = getDocument();
  const rootId = activePageRootId();
  const selectedIds = useSelectionStore.getState().selectedIds;
  const action = planDeviceChoiceAction({
    device,
    layers: doc.layers,
    rootId,
    selectedIds,
  });

  ensureBreakpointForDevice(spec);

  const effectiveRootId = rootId ?? (Object.values(doc.layers).find((l) => l.parentId === null)?.id ?? null);
  const frames = listTopLevelFrames(doc.layers, rootId);

  if (action.kind === "create_frame") {
    const frameId = documentCommands.addLayer(
      {
        archetype: "container",
        parentId: effectiveRootId,
        name: spec.label,
        properties: {
          positioning: "absolute",
          "frame.x": action.placement.x,
          "frame.y": action.placement.y,
          "frame.width": spec.width,
          "frame.height": spec.height,
          "frame.device": spec.id,
          "appearance.background.color": "#ffffff",
        },
      },
      `Create ${spec.label} frame`
    );
    useSelectionStore.getState().select(frameId, "element");
    if (device !== "desktop") {
      const bp = breakpointsOf(getDocument()).find((b) => b.width === spec.width);
      if (bp) setActiveBreakpoint(bp.id);
    } else {
      setActiveBreakpoint(null);
    }
    return frameId;
  }

  if (action.kind === "create_mirror") {
    // 2(b) Create a live linked mirror frame
    const mainFrame = doc.layers[action.mainFrameId];
    if (mainFrame && mainFrame.properties["breakpoints.responsive"] !== true) {
      documentCommands.updateProps(mainFrame.id, { "breakpoints.responsive": true }, "Make frame responsive");
    }
    const mirrorId = documentCommands.addLayer(
      {
        archetype: "container",
        parentId: effectiveRootId,
        name: `${spec.label}`,
        properties: {
          positioning: "absolute",
          "frame.x": action.placement.x,
          "frame.y": action.placement.y,
          "frame.width": spec.width,
          "frame.height": spec.height,
          "frame.mirrorOf": action.mainFrameId,
          "frame.device": spec.id,
          "appearance.background.color": "#ffffff",
        },
      },
      `Open ${spec.label} linked view`
    );
    useSelectionStore.getState().select(mirrorId, "element");
    return mirrorId;
  }

  // 2(c) Create independent frame
  const name = uniqueFrameName(frames.map(frameInfo), spec.label);
  const frameId = documentCommands.addLayer(
    {
      archetype: "container",
      parentId: effectiveRootId,
      name,
      properties: {
        positioning: "absolute",
        "frame.x": action.placement.x,
        "frame.y": action.placement.y,
        "frame.width": spec.width,
        "frame.height": spec.height,
        "frame.device": spec.id,
        "appearance.background.color": "#ffffff",
      },
    },
    `Create ${name} frame`
  );
  useSelectionStore.getState().select(frameId, "element");
  return frameId;
}

/**
 * Switches a specific frame's device view from its size label menu (Requirement 3).
 * Changes this frame without altering other frames.
 */
export function switchFrameView(frameId: string, targetDevice: DeviceKind): void {
  const spec = DEVICE_SPECS[targetDevice];
  const doc = getDocument();
  const layer = doc.layers[frameId];
  if (!layer) return;

  ensureBreakpointForDevice(spec);

  const isMirror = Boolean(layer.properties["frame.mirrorOf"]);
  if (isMirror) {
    documentCommands.updateProps(
      frameId,
      {
        "frame.device": spec.id,
        "frame.width": spec.width,
        "frame.height": spec.height,
      },
      `Switch mirror to ${spec.label}`
    );
    return;
  }

  // Regular frame. Write the frame's own size and device on the base, not into
  // the active breakpoint's overrides, so leave any breakpoint view first.
  setActiveBreakpoint(null);
  documentCommands.updateProps(
    frameId,
    {
      "frame.device": spec.id,
      "frame.width": spec.width,
      "frame.height": spec.height,
      "breakpoints.responsive": true,
    },
    `Switch frame to ${spec.label}`
  );

  if (targetDevice === "desktop") {
    setActiveBreakpoint(null);
  } else {
    const bp = breakpointsOf(getDocument()).find((b) => b.width === spec.width);
    if (bp) setActiveBreakpoint(bp.id);
  }
}
