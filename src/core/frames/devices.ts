/**
 * Device sizes and linked views (mirror frames).
 *
 * A frame can be opened as Desktop, Tablet or Mobile. A mirror frame (`frame.mirrorOf`) draws another frame's layers
 * at its own device's breakpoint without copying them: edits made inside it go to that breakpoint's overrides.
 * A mirror is a design-time view only, so it is never exported (see `isEditorOnlyLayer`).
 *
 * Pure: no store, no DOM. The editor and the exporter both read it.
 */

import type { Layer, MotionDocument } from "../document/schema";
import { breakpointsOf } from "../breakpoints/breakpoints";

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

type PropsHolder = { properties?: Record<string, unknown> } | null | undefined;

/** Normalizes any device string to "desktop" | "tablet" | "mobile". */
export function normalizeDeviceKind(device: string): DeviceKind {
  const d = device.toLowerCase().trim();
  if (d === "mobile" || d === "375") return "mobile";
  if (d === "tablet" || d === "768") return "tablet";
  return "desktop";
}

/** The device a frame is: its `frame.device`, or guessed from its width. */
export function deviceOfFrame(layer: PropsHolder): DeviceKind {
  if (!layer || !layer.properties) return "desktop";
  const dev = layer.properties["frame.device"];
  if (dev === "mobile" || dev === "tablet" || dev === "desktop") return dev;
  const w = Number(layer.properties["frame.width"] ?? 1440);
  if (w <= 480) return "mobile";
  if (w <= 1024) return "tablet";
  return "desktop";
}

/** The device a frame really is: its stored `frame.device`, or a width that is exactly a device's. Null for any other size. */
export function exactDeviceOfFrame(layer: PropsHolder): DeviceKind | null {
  const dev = layer?.properties?.["frame.device"];
  if (dev === "mobile" || dev === "tablet" || dev === "desktop") return dev;
  const w = Number(layer?.properties?.["frame.width"]);
  return (Object.values(DEVICE_SPECS).find((d) => d.width === w)?.id as DeviceKind | undefined) ?? null;
}

/** What a frame's size label says: its device (or "Custom") and its own width, never a device's width it doesn't have. */
export function frameSizeLabel(layer: PropsHolder): { label: string; width: number } {
  const device = exactDeviceOfFrame(layer);
  const stored = Number(layer?.properties?.["frame.width"]);
  return { label: device ? DEVICE_SPECS[device].label : "Custom", width: Number.isFinite(stored) && stored > 0 ? Math.round(stored) : device ? DEVICE_SPECS[device].width : 0 };
}

/** The id of the frame a mirror shows, or null for an ordinary frame (an empty value counts as none). */
export function mirrorSourceId(layer: PropsHolder): string | null {
  const v = layer?.properties?.["frame.mirrorOf"];
  return typeof v === "string" && v !== "" ? v : null;
}

export const isMirrorFrame = (layer: PropsHolder): boolean => mirrorSourceId(layer) !== null;

/** The document's breakpoint for a device: null for Desktop (the base), undefined when the document has none for it. */
export function breakpointIdForDevice(doc: Pick<MotionDocument, "breakpoints">, device: DeviceKind): string | null | undefined {
  if (device === "desktop") return null;
  const spec = DEVICE_SPECS[device];
  const bp = breakpointsOf(doc).find((b) => b.width === spec.width || b.name.toLowerCase() === spec.label.toLowerCase());
  return bp?.id;
}

/**
 * Where edits made inside a mirror go: its device's breakpoint (null for a Desktop mirror, which edits the base).
 * undefined when the layer isn't a mirror of an existing frame.
 */
export function mirrorBreakpointId(doc: Pick<MotionDocument, "breakpoints" | "layers">, mirrorId: string | null | undefined): string | null | undefined {
  if (!mirrorId) return undefined;
  const mirror = doc.layers[mirrorId];
  const source = mirrorSourceId(mirror);
  if (!mirror || !source || !doc.layers[source]) return undefined;
  return breakpointIdForDevice(doc, deviceOfFrame(mirror)) ?? null;
}

/**
 * The frames of a page: the containers placed directly on the page root. Other pages' roots (which also have no
 * parent) are not frames of this page.
 */
export function framesOfPage(layers: Record<string, Layer>, rootId: string | null): Layer[] {
  if (!rootId || !layers[rootId]) return [];
  return layers[rootId].children.map((id) => layers[id]).filter((l): l is Layer => !!l && l.archetype === "container");
}

/** The frame on the page that holds a layer (the layer itself when it is one), or null. */
export function pageFrameOf(layers: Record<string, Layer>, rootId: string | null, layerId: string | null | undefined): string | null {
  if (!rootId || !layerId) return null;
  let cur: Layer | undefined = layers[layerId];
  while (cur) {
    if (cur.parentId === rootId) return cur.archetype === "container" ? cur.id : null;
    cur = cur.parentId ? layers[cur.parentId] : undefined;
  }
  return null;
}
