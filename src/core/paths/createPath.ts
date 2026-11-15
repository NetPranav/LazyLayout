import type { PropValue } from "../document/registry";
import { documentCommands } from "../store/useDocumentStore";
import type { PathNode } from "./pathFit";
import { buildPath, serializePathNodes } from "./pathLayer";
import { fitStroke } from "./pathFit";
import { hasPressure, penWidthProfile, type PenSample, type WidthSource } from "./penInput";
import { serializeWidthProfile } from "./strokes";
import { preset as brushPreset, sanitizeBrush } from "./brush";

export interface PathStyle {
  stroke: string;
  strokeWidth: number;
  cap: "butt" | "round" | "square";
  join: "miter" | "round" | "bevel";
  /** The fill a closed path starts with. */
  fill: string;
}

export const PENCIL_STYLE: PathStyle = { stroke: "#0f172a", strokeWidth: 2, cap: "round", join: "round", fill: "#cbd5e1" };
export const PEN_STYLE: PathStyle = { stroke: "#0f172a", strokeWidth: 2, cap: "butt", join: "miter", fill: "#cbd5e1" };

/**
 * Makes the vector layer for a finished path (one undo step): an `svgPath` inside `parent`, framed around the path.
 * `nodes` are in canvas space; `parent.origin` is where the parent's top-left is. A closed path starts with a fill,
 * an open one with none. Returns the layer's id, or null when there is nothing to draw or nowhere to put it.
 */
export function createPathLayer(nodes: readonly PathNode[], closed: boolean, parent: { id: string; origin: { x: number; y: number } } | null, style: PathStyle, name = "Path", extra: Record<string, PropValue> = {}): string | null {
  if (nodes.length < 2 || !parent) return null;
  const built = buildPath(nodes, closed, style.strokeWidth);
  const props: Record<string, PropValue> = {
    positioning: "absolute",
    "frame.x": Math.round((built.frame.x - parent.origin.x) * 100) / 100,
    "frame.y": Math.round((built.frame.y - parent.origin.y) * 100) / 100,
    "frame.width": built.frame.width,
    "frame.height": built.frame.height,
    "svg.path": built.d,
    "svg.nodes": serializePathNodes(built.nodes, closed),
    "svg.stroke": style.stroke,
    "svg.strokeWidth": style.strokeWidth,
    "svg.strokeLinecap": style.cap,
    "svg.strokeLinejoin": style.join,
    "svg.fill": closed ? style.fill : "none",
    ...extra,
  };
  return documentCommands.addLayer({ archetype: "svgPath", parentId: parent.id, name, properties: props }, `Draw ${name.toLowerCase()}`);
}

// --- Phase 120: brushes and pen pressure -----------------------------------------------------------

export const BRUSH_STYLE: PathStyle = { stroke: "#0f172a", strokeWidth: 8, cap: "round", join: "round", fill: "none" };

export interface BrushToolSettings {
  /** The stroke's widest width, in px. */
  size: number;
  color: string;
  /** A brush preset id (`core/paths/brush.ts`), or "" for a plain band. */
  brush: string;
  /** What thins and thickens the stroke. */
  source: WidthSource;
  /** 0 to 1: how much the drawn line and its widths are smoothed. */
  smoothing: number;
}

export const DEFAULT_BRUSH_TOOL: BrushToolSettings = { size: 8, color: "#0f172a", brush: "", source: "auto", smoothing: 0.5 };

/** The properties a drawn stroke gets from its samples: its width profile and, for the brush tool, its brush. */
export function drawnStrokeProps(samples: readonly PenSample[], settings: Pick<BrushToolSettings, "brush" | "source" | "smoothing">): Record<string, PropValue> {
  const profile = penWidthProfile(samples, { source: settings.source, smoothing: settings.smoothing });
  const out: Record<string, PropValue> = {};
  if (profile) out["stroke.widthProfile"] = serializeWidthProfile(profile);
  if (settings.brush && brushPreset(settings.brush)) out["stroke.brush"] = JSON.stringify(sanitizeBrush({ preset: settings.brush }));
  return out;
}

/**
 * The layer a brush stroke makes (one undo step): the samples fitted into a path (smoothed as asked), its width
 * from the pen (or the mouse's speed), drawn with the chosen brush. Never closed, never filled.
 */
export function createBrushStroke(samples: readonly PenSample[], parent: { id: string; origin: { x: number; y: number } } | null, settings: BrushToolSettings): string | null {
  const { nodes } = fitStroke(samples, { smoothing: Math.min(1, Math.max(0, settings.smoothing)) * 0.7 });
  const size = Math.min(200, Math.max(0.5, settings.size));
  return createPathLayer(nodes, false, parent, { ...BRUSH_STYLE, stroke: settings.color, strokeWidth: size }, "Brush", drawnStrokeProps(samples, settings));
}

/** A pencil stroke's extra properties: a width profile only when the pen reported pressure (a mouse draws as before). */
export const pencilStrokeProps = (samples: readonly PenSample[]): Record<string, PropValue> => (hasPressure(samples) ? drawnStrokeProps(samples, { brush: "", source: "pressure", smoothing: 0.5 }) : {});
