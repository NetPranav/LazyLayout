import type { MotionDocument } from "../../document/schema";
import { getPropertyDefinition, type PropertyDefinition } from "../../document/properties";
import { mattesOf, type ResolvedProps } from "../../kernel/evaluate";
import { adjustmentFilter, isAdjustPath, isMaskPath, maskStyle, readerOf } from "../../render/compositing";
import { baseFilterFunctions } from "../../render/geometry";
import { fxStyle, hasFx, isFxPath, type FxFilterSpec } from "../../render/fxStack";

/**
 * ROADMAP Phase 57: the bridge from the kernel's output (property path → value) to CSS. Pure, so the mapping is
 * tested without a browser. Only properties a layer actually animates are written; everything else stays as React
 * drew it.
 */

const isTransformPath = (path: string) => (path.startsWith("transform.") && path !== "transform.motionPath") || path === "frame.rotation";

/** The SVG filters a layer's effect stack and motion blur need at this moment (the engine keeps them in the frame document). */
export function fxFilters(layerId: string, resolved: ResolvedProps): FxFilterSpec[] {
  return fxStyle(layerId, readerOf(resolved), { svg: true }).filters;
}

/** The property paths animated on a layer: its clips' tracks and its `loop` behaviours, in any composition. */
export function animatedPaths(doc: MotionDocument, layerId: string): Set<string> {
  const paths = new Set<string>();
  for (const clip of Object.values(doc.clips)) {
    if (clip.layerId !== layerId || !clip.enabled) continue;
    for (const track of clip.tracks) if (!track.muted) paths.add(track.property);
  }
  for (const behaviour of Object.values(doc.behaviours)) {
    if (behaviour.layerId === layerId && behaviour.enabled && behaviour.type === "loop") paths.add(behaviour.params.property);
  }
  // Phase 74: a layer with a track matte has its mask written every frame (the source moves), and a matte's source is hidden by opacity.
  const own = doc.layers[layerId]?.properties;
  if (own && typeof own["matte.source"] === "string" && own["matte.source"] !== "" && own["matte.mode"] !== undefined && own["matte.mode"] !== "none") paths.add("mask.path");
  if (mattesOf(doc).has(layerId)) paths.add("appearance.opacity");
  // Phase 75: a layer with an effect, or with motion blur on, has its filter written every frame (a parameter or the velocity may change).
  if (own && hasFx(own, doc.layers[layerId]?.motionBlur === true)) paths.add("fx.stack");
  return paths;
}

/** Layers that animate anything, with the paths they animate. */
export function animatedLayers(doc: MotionDocument): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const layerIds = new Set<string>();
  for (const clip of Object.values(doc.clips)) if (clip.enabled) layerIds.add(clip.layerId);
  for (const behaviour of Object.values(doc.behaviours)) if (behaviour.enabled && behaviour.type === "loop") layerIds.add(behaviour.layerId);
  for (const layer of Object.values(doc.layers)) if (hasFx(layer.properties, layer.motionBlur === true)) layerIds.add(layer.id);
  for (const [source, targets] of mattesOf(doc)) {
    layerIds.add(source);
    for (const id of targets) layerIds.add(id);
  }
  for (const id of layerIds) {
    if (!doc.layers[id]) continue;
    const paths = animatedPaths(doc, id);
    if (paths.size > 0) out.set(id, paths);
  }
  return out;
}

function cssValue(def: PropertyDefinition, resolved: ResolvedProps, value: unknown): string | null {
  switch (def.valueType) {
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
    case "length": {
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      const unitOverride = resolved[`${def.path}Unit`];
      const unit = typeof unitOverride === "string" ? unitOverride : (def.unit ?? "px");
      const isSize = def.path === "frame.width" || def.path === "frame.height";
      return `${isSize ? Math.max(0, value) : value}${unit}`;
    }
    case "angle":
      return typeof value === "number" && Number.isFinite(value) ? `${value}deg` : null;
    case "color":
    case "string":
    case "enum":
    case "clipPath":
      return typeof value === "string" ? value : null;
    default:
      return null;
  }
}

/**
 * The inline styles that show `resolved` for the animated `paths`: `{ "opacity": "0.5", "transform": "…" }`.
 * Every `transform.*` and the frame's rotation become one `transform` (Single Transform Authority), the rotation
 * first, as the stage draws it.
 */
export function styleWrites(paths: Iterable<string>, resolved: ResolvedProps, layerId = ""): Record<string, string> {
  const out: Record<string, string> = {};
  let transformTouched = false;
  for (const path of paths) {
    if (isTransformPath(path)) {
      transformTouched = true;
      continue;
    }
    const def = getPropertyDefinition(path);
    if (!def?.css || resolved[path] === undefined) continue;
    const css = cssValue(def, resolved, resolved[path]);
    if (css !== null) out[def.css] = css;
  }
  // Compositing (Phase 74): an adjustment and a mask are each one CSS value made from several properties.
  const paths2 = Array.from(paths);
  const read = readerOf(resolved);
  if (paths2.some(isAdjustPath)) {
    const blur = typeof resolved["paint.backgroundBlur"] === "number" && resolved["paint.backgroundBlur"] > 0 ? `blur(${Math.min(200, resolved["paint.backgroundBlur"])}px) ` : "";
    const filter = `${blur}${adjustmentFilter(read)}`.trim() || "none";
    out["backdrop-filter"] = filter;
    out["-webkit-backdrop-filter"] = filter;
  }
  if (paths2.some(isMaskPath)) {
    const width = typeof resolved["frame.width"] === "number" ? resolved["frame.width"] : 0;
    const height = typeof resolved["frame.height"] === "number" ? resolved["frame.height"] : 0;
    const mask = maskStyle(read, { width, height });
    for (const key of ["mask-image", "-webkit-mask-image", "mask-size", "-webkit-mask-size", "mask-repeat", "-webkit-mask-repeat"]) out[key] = mask ? { "mask-image": mask.maskImage, "-webkit-mask-image": mask.WebkitMaskImage, "mask-size": mask.maskSize, "-webkit-mask-size": mask.WebkitMaskSize, "mask-repeat": mask.maskRepeat, "-webkit-mask-repeat": mask.WebkitMaskRepeat }[key]! : "none";
  }
  // The effect stack and motion blur (Phase 75): one `filter` made of the layer's own filters, the stack's functions in order and
  // the `url()`s of its SVG filters (which the engine keeps in the frame, see `fxFilters.ts`).
  if (paths2.some((p) => isFxPath(p) || p === "fx.stack")) {
    out.filter = [...baseFilterFunctions(read, typeof layerId === "string" ? layerId : "", false), ...fxStyle(typeof layerId === "string" ? layerId : "", read, { svg: true }).functions].join(" ") || "none";
  }
  if (transformTouched) {
    const parts: string[] = [];
    const rotation = resolved["frame.rotation"];
    if (typeof rotation === "number" && rotation !== 0) parts.push(`rotate(${rotation}deg)`);
    const transform = resolved.transform;
    if (typeof transform === "string" && transform !== "none") parts.push(transform);
    out.transform = parts.length > 0 ? parts.join(" ") : "none";
  }
  return out;
}
