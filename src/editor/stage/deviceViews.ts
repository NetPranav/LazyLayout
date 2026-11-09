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
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { documentCommands } from "@/core/store/useDocumentStore";
import { getDocument } from "@/core/store/documentState";
import { activePageRootId } from "./activePage";
import { FRAME_GAP, frameInfo, nextFramePosition, uniqueFrameName } from "@/core/frames/frames";
import {
  DEVICE_SPECS,
  deviceOfFrame,
  framesOfPage,
  isMirrorFrame,
  mirrorSourceId,
  normalizeDeviceKind,
  pageFrameOf,
  type DeviceKind,
  type DeviceSpec,
} from "@/core/frames/devices";

export { DEVICE_SPECS, deviceOfFrame, isMirrorFrame, normalizeDeviceKind, type DeviceKind, type DeviceSpec };

/** Returns the ID of the frame a mirror shows, or null. */
export const getMirroredFrameId = mirrorSourceId;

/** The frames of the page under `rootId` (other pages' roots are not frames of this page). */
export const listTopLevelFrames = framesOfPage;

/** The page frame holding the first selected layer (the layer itself when it is a frame), or null. */
export function getSelectedFrameId(
  layers: Record<string, Layer>,
  rootId: string | null,
  selectedIds: readonly string[]
): string | null {
  return selectedIds.length === 0 ? null : pageFrameOf(layers, rootId, selectedIds[0]);
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
  const targetMainFrameId = mirrorSourceId(selectedFrame) ?? selectedFrame.id;
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

  const effectiveRootId = rootId;
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
    // A frame made at a device size is a design of its own: it is edited and exported as it is (the base), so the
    // view goes back to the base rather than leaving its edits in a breakpoint's overrides.
    setActiveBreakpoint(null);
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

  const isMirror = isMirrorFrame(layer);
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
