import { z } from "zod";
import { defineTypedCommand } from "../commands";
import type { PropValue } from "../document/registry";
import { setLayerProps, transaction } from "../editing/editOps";
import { getDocument } from "../store/documentState";
import { useSelectionStore } from "../store/useSelectionStore";
import { getTransport } from "../time/transport";
import { setKeyframeAt } from "../timeline/keyframeOps";
import { MORPH_MATCHES, matchPaths, morphOptions } from "./morphMatch";
import { DRAW_PATHS } from "./strokeDraw";

/**
 * Path morph and stroke drawing commands (ROADMAP Phase 85, Law 20). A layer drawn from one path (`svgPath`, `icon`)
 * can morph into another path and have its stroke drawn on. Each command acts on the selected layers unless given ids
 * and is one undo step.
 *
 * - `path.setMorph`: how the layer's path keyframes are matched (`morph.match`, `morph.startOffset`, `morph.reverse`).
 * - `path.setDraw`: the part of the stroke that shows (`draw.*`), or `clear` to take the settings off.
 * - `path.animateDraw`: keyframes that draw the stroke on (or off) over a time, from the playhead.
 * - `path.morphTo`: keyframes that morph the layer's path into another layer's (or a given path), from the playhead.
 */
const PATH = "svg.path";
const ARCHETYPES = ["svgPath", "icon"];
const selected = () => useSelectionStore.getState().selectedIds;
const targets = z.array(z.string()).optional();

/** The layers of `ids` that are drawn from one path and may be edited. */
function pathLayers(ids: readonly string[]) {
  const doc = getDocument();
  return ids.map((id) => doc.layers[id]).filter((l) => !!l && ARCHETYPES.includes(l.archetype) && l.locked !== true);
}

export function registerPathMotionCommands(): () => void {
  const offs: Array<() => void> = [];

  offs.push(defineTypedCommand({
    id: "path.setMorph", title: "Set How a Path Morphs", category: "Paths",
    args: z.object({ ids: targets, match: z.enum(MORPH_MATCHES).optional(), startOffset: z.number().int().min(-256).max(256).optional(), reverse: z.boolean().optional() }),
    run: ({ ids, match, startOffset, reverse }) => {
      const patch: Record<string, PropValue> = {};
      if (match !== undefined) patch["morph.match"] = match;
      if (startOffset !== undefined) patch["morph.startOffset"] = startOffset;
      if (reverse !== undefined) patch["morph.reverse"] = reverse;
      const layers = pathLayers(ids ?? selected());
      if (layers.length === 0 || Object.keys(patch).length === 0) return { changed: 0 };
      return { changed: setLayerProps(layers.map((l) => l.id), patch, "Set path morph") };
    },
  }));

  offs.push(defineTypedCommand({
    id: "path.setDraw", title: "Set How Much of a Stroke Is Drawn", category: "Paths",
    args: z.object({
      ids: targets,
      start: z.number().min(0).max(1).optional(),
      end: z.number().min(0).max(1).optional(),
      offset: z.number().min(-100).max(100).optional(),
      reverse: z.boolean().optional(),
      stagger: z.number().min(0).max(1).optional(),
      /** Takes every drawing setting off the layer (the whole stroke shows again). */
      clear: z.boolean().optional(),
    }),
    run: ({ ids, start, end, offset, reverse, stagger, clear }) => {
      const layers = pathLayers(ids ?? selected());
      if (layers.length === 0) return { changed: 0 };
      const patch: Record<string, PropValue | null> = {};
      if (clear) for (const p of DRAW_PATHS) patch[p] = null;
      else {
        if (start !== undefined) patch["draw.start"] = start;
        if (end !== undefined) patch["draw.end"] = end;
        if (offset !== undefined) patch["draw.offset"] = offset;
        if (reverse !== undefined) patch["draw.reverse"] = reverse;
        if (stagger !== undefined) patch["draw.stagger"] = stagger;
      }
      if (Object.keys(patch).length === 0) return { changed: 0 };
      return { changed: setLayerProps(layers.map((l) => l.id), patch, clear ? "Remove stroke drawing" : "Set stroke drawing") };
    },
  }));

  offs.push(defineTypedCommand({
    id: "path.animateDraw", title: "Animate a Stroke Drawing On or Off", category: "Paths",
    args: z.object({ ids: targets, duration: z.number().min(0.05).max(600).optional(), at: z.number().min(0).optional(), direction: z.enum(["on", "off"]).optional(), ease: z.string().optional() }),
    run: ({ ids, duration = 1, at, direction = "on", ease }) => {
      const layers = pathLayers(ids ?? selected());
      if (layers.length === 0) return { ok: false, code: "NO_PATH", message: "Select a path or an icon to draw." };
      const from = at ?? getTransport().time;
      const keys: string[] = [];
      transaction(direction === "on" ? "Draw stroke on" : "Draw stroke off", () => {
        for (const layer of layers) {
          // the settings at rest: the whole stroke, so the layer is drawn as it was outside the animation
          const rest: Record<string, PropValue> = {};
          if (layer.properties["draw.start"] === undefined) rest["draw.start"] = 0;
          if (layer.properties["draw.end"] === undefined) rest["draw.end"] = 1;
          if (Object.keys(rest).length > 0) setLayerProps([layer.id], rest, "Set stroke drawing");
          // on: the end runs from the start to the end of the path; off: the start follows it there
          const property = direction === "on" ? "draw.end" : "draw.start";
          const a = setKeyframeAt(layer.id, property, from, { value: 0 });
          const b = setKeyframeAt(layer.id, property, from + duration, { value: 1, ...(ease ? { ease } : {}) });
          if (a) keys.push(a);
          if (b) keys.push(b);
        }
      });
      return keys.length > 0 ? { ok: true, keyframes: keys } : { ok: false, code: "NO_KEYFRAMES", message: "No keyframes could be added here." };
    },
  }));

  offs.push(defineTypedCommand({
    id: "path.morphTo", title: "Morph a Path into Another", category: "Paths",
    args: z.object({ id: z.string().optional(), source: z.string().optional(), path: z.string().max(200_000).optional(), duration: z.number().min(0.05).max(600).optional(), at: z.number().min(0).optional(), ease: z.string().optional() }),
    run: ({ id: given, source, path, duration = 1, at, ease }) => {
      const doc = getDocument();
      const layer = pathLayers([given ?? selected()[0] ?? ""])[0];
      if (!layer) return { ok: false, code: "NO_PATH", message: "Select a path or an icon to morph." };
      if (typeof layer.properties["svg.network"] === "string" && layer.properties["svg.network"] !== "") return { ok: false, code: "NETWORK", message: "This path is a vector network, which doesn't morph. Edit it as a path first." };
      const other = source ? doc.layers[source] : undefined;
      if (source && (!other || !ARCHETYPES.includes(other.archetype) || other.id === layer.id)) return { ok: false, code: "BAD_SOURCE", message: "Pick another path or icon to morph into." };
      // a path is drawn in its archetype's own space (200 x 200 for a path, 24 x 24 for an icon), so the two must be the same kind
      if (other && other.archetype !== layer.archetype) return { ok: false, code: "DIFFERENT_KIND", message: "A path morphs into a path, and an icon into an icon." };
      const target = other ? other.properties[PATH] : path;
      const current = layer.properties[PATH];
      if (typeof target !== "string" || target === "" || typeof current !== "string" || current === "") return { ok: false, code: "NO_PATH_DATA", message: "There is no path to morph into." };
      if (!matchPaths(current, target, morphOptions(layer.properties))) return { ok: false, code: "BAD_PATH", message: "That path can't be read." };
      const from = at ?? getTransport().time;
      const keys: string[] = [];
      transaction("Morph path", () => {
        // the path as it is drawn at the start (it may already be part way through an earlier morph), then the new one
        const a = setKeyframeAt(layer.id, PATH, from);
        const b = setKeyframeAt(layer.id, PATH, from + duration, { value: target, ...(ease ? { ease } : {}) });
        if (a) keys.push(a);
        if (b) keys.push(b);
      });
      return keys.length === 2 ? { ok: true, keyframes: keys } : { ok: false, code: "NO_KEYFRAMES", message: "No keyframes could be added here." };
    },
  }));

  return () => offs.forEach((off) => off());
}
