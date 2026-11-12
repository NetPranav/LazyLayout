import { z } from "zod";
import { defineTypedCommand } from "../commands";
import { setLayerProps } from "../editing/editOps";
import { getDocument } from "../store/documentState";
import { useSelectionStore } from "../store/useSelectionStore";
import { BLEND_MODE_VALUES } from "./compositing";

/**
 * Compositing commands (ROADMAP Phase 74, Law 20): the blend mode and isolation, an adjustment, a mask and a track matte
 * as commands, so the inspector, the timeline and agents set them the same way. Each acts on the selected layers unless
 * given ids, is one undo step, and only changes what it is given. They write the properties `core/render/compositing.ts`
 * draws; `layer.setProps` writes the same ones.
 */
const ids = () => useSelectionStore.getState().selectedIds;
const targets = z.array(z.string()).optional();
const MODES = ["none", "alpha", "alphaInverted", "luma", "lumaInverted"] as const;

const given = <T extends Record<string, unknown>>(values: T, map: Record<string, string>): Record<string, number | string | boolean> => {
  const out: Record<string, number | string | boolean> = {};
  for (const [key, path] of Object.entries(map)) {
    const v = values[key];
    if (v !== undefined) out[path] = v as number | string | boolean;
  }
  return out;
};

export function registerCompositingCommands(): () => void {
  const offs: Array<() => void> = [];
  const add = (off: () => void) => offs.push(off);

  add(defineTypedCommand({
    id: "layer.setBlend", title: "Set Blend Mode and Isolation", category: "Appearance",
    args: z.object({ ids: targets, mode: z.enum(BLEND_MODE_VALUES as unknown as [string, ...string[]]).optional(), isolate: z.boolean().optional() }),
    run: ({ ids: t, mode, isolate }) => ({ changed: setLayerProps(t ?? ids(), { ...(mode !== undefined ? { "appearance.blendMode": mode } : {}), ...(isolate !== undefined ? { "appearance.isolation": isolate ? "isolate" : "auto" } : {}) }, "Set blend mode") }),
  }));

  add(defineTypedCommand({
    id: "layer.setAdjustment", title: "Set an Adjustment (Filters on What Is Behind)", category: "Appearance",
    args: z.object({
      ids: targets,
      /** Make the layer an adjustment layer (it draws nothing of its own) or an ordinary layer again. */
      asLayer: z.boolean().optional(),
      blur: z.number().min(0).max(200).optional(), brightness: z.number().min(0).max(5).optional(), contrast: z.number().min(0).max(5).optional(), saturate: z.number().min(0).max(5).optional(),
      hueRotate: z.number().optional(), grayscale: z.number().min(0).max(1).optional(), sepia: z.number().min(0).max(1).optional(), invert: z.number().min(0).max(1).optional(),
    }),
    run: ({ ids: t, asLayer, ...values }) => {
      const props = given(values, { blur: "adjust.blur", brightness: "adjust.brightness", contrast: "adjust.contrast", saturate: "adjust.saturate", hueRotate: "adjust.hueRotate", grayscale: "adjust.grayscale", sepia: "adjust.sepia", invert: "adjust.invert" });
      if (asLayer !== undefined) props["render.role"] = asLayer ? "adjustment" : "content";
      return { changed: setLayerProps(t ?? ids(), props, "Set adjustment") };
    },
  }));

  add(defineTypedCommand({
    id: "layer.setMask", title: "Set a Mask", category: "Appearance",
    args: z.object({
      ids: targets, mode: z.enum(MODES).optional(), shape: z.enum(["rect", "ellipse", "path"]).optional(), path: z.string().max(20000).optional(),
      x: z.number().optional(), y: z.number().optional(), width: z.number().min(-1).optional(), height: z.number().min(-1).optional(), radius: z.number().min(0).optional(),
      feather: z.number().min(0).max(200).optional(), expansion: z.number().min(0).max(200).optional(), fill: z.string().max(60).optional(), opacity: z.number().min(0).max(1).optional(),
    }),
    run: ({ ids: t, ...values }) => ({ changed: setLayerProps(t ?? ids(), given(values, { mode: "mask.mode", shape: "mask.shape", path: "mask.path", x: "mask.x", y: "mask.y", width: "mask.width", height: "mask.height", radius: "mask.radius", feather: "mask.feather", expansion: "mask.expansion", fill: "mask.fill", opacity: "mask.opacity" }), "Set mask") }),
  }));

  add(defineTypedCommand({
    id: "layer.setMatte", title: "Use Another Layer as a Matte", category: "Appearance",
    args: z.object({ ids: targets, sourceId: z.string().nullable().optional(), mode: z.enum(MODES).optional(), showSource: z.boolean().optional() }),
    run: ({ ids: t, sourceId, mode, showSource }) => {
      const layers = getDocument().layers;
      const chosen = (t ?? ids()).filter((id) => layers[id]);
      if (typeof sourceId === "string" && !layers[sourceId]) return { changed: 0, reason: `No layer "${sourceId}".` };
      if (typeof sourceId === "string" && chosen.includes(sourceId)) return { changed: 0, reason: "A layer can't be its own matte." };
      const props: Record<string, string | boolean | null> = {};
      if (sourceId !== undefined) props["matte.source"] = sourceId ?? "";
      // naming a source with no mode asks for the usual one: the source's shape shows the layer
      if (mode !== undefined) props["matte.mode"] = mode;
      else if (typeof sourceId === "string") props["matte.mode"] = "alpha";
      else if (sourceId === null) props["matte.mode"] = "none";
      if (showSource !== undefined) props["matte.showSource"] = showSource;
      return { changed: setLayerProps(chosen, props, "Set matte") };
    },
  }));

  return () => offs.forEach((off) => off());
}
