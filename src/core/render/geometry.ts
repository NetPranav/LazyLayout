import { adjustmentFilter, blendStyle, maskStyle, type PropReader } from "./compositing";
import { fxStyle } from "./fxStack";
import { resolveLayerAnchor, formatCssTransformOrigin } from "@/core/geometry/pins";
import type { CSSProperties } from "react";
import type { Layer } from "../document/schema";
import { getLayerGeometry } from "../document/properties";
import { boxShadowCss, parseShadows } from "../paint/paints";
import { blurOf, effectFilterId, glassCss, maxRadius, needsFilter, parseEffects } from "../paint/effects";
import { isConvex, pinInLayer, pinMatrix3d } from "../geometry/cornerPin";
import { isMeshConvex, parseMesh } from "../geometry/meshWarp";
import type { RenderContext, ResolvedProps } from "./types";

/** Largest frame dimension the renderer will draw; a larger stored value is clamped. */
export const MAX_FRAME_PX = 20_000;

/**
 * The box a layer occupies, from its geometry (Law 10): `frame`, `sizing` and `positioning`.
 * Absolute layers sit at `frame.x/y` inside their positioned parent; flow layers are placed by the
 * parent's layout and take their size from `sizing` (fixed: the frame size, hug: their content,
 * fill: grow along the parent's main axis or stretch across it). Rotation applies to both.
 */
/** The scale, skew and 3D turn a designer set on a layer (the Position section's More), as CSS; empty when there are none. */
function designTransform(resolved: ResolvedProps): string {
  const n = (path: string, fallback: number) => resolved.num(path, fallback);
  const s = n("transform.scale", 1);
  const sx = n("transform.scaleX", 1) * s;
  const sy = n("transform.scaleY", 1) * s;
  const rx = n("transform.rotateX", 0);
  const ry = n("transform.rotateY", 0);
  const tz = n("transform.translateZ", 0);
  const kx = n("transform.skewX", 0);
  const ky = n("transform.skewY", 0);
  const parts: string[] = [];
  if (rx) parts.push(`rotateX(${rx}deg)`);
  if (ry) parts.push(`rotateY(${ry}deg)`);
  if (tz) parts.push(`translateZ(${tz}px)`);
  if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`);
  if (kx || ky) parts.push(`skew(${kx}deg, ${ky}deg)`);
  return parts.join(" ");
}

export function layerBoxStyle(layer: Layer, resolved: ResolvedProps, ctx: RenderContext, options: { shadow?: "box" | "none"; /** The archetype draws progressive blurs itself (a frame's backdrop layers). */ bands?: boolean } = {}): CSSProperties {
  const g = getLayerGeometry(layer);
  const style: CSSProperties = { boxSizing: "border-box" };
  const px = (n: number, unit: string) => `${Math.min(MAX_FRAME_PX, Math.max(0, n))}${unit}`;

  if (ctx.inMeshTile) {
    style.position = "absolute";
    style.left = 0;
    style.top = 0;
  } else if (g.positioning === "absolute") {
    style.position = "absolute";
    const atOrigin = ctx.frameAtOrigin === true && layer.parentId === null;
    style.left = atOrigin ? 0 : g.frame.x;
    style.top = atOrigin ? 0 : g.frame.y;
  } else {
    // A positioned box, so absolute children inside it anchor to it.
    style.position = "relative";
  }

  const parentRow = ctx.parentDirection === "row";
  const inGrid = g.positioning === "flow" && ctx.parentDirection === "grid";
  const axis = (kind: "horizontal" | "vertical") => {
    const sizing = g.sizing[kind];
    const isWidth = kind === "horizontal";
    const size = isWidth ? g.frame.width : g.frame.height;
    const unit = isWidth ? g.units.width : g.units.height;
    if (inGrid) {
      // in a grid cell: fixed is its size, fill stretches across the cell, hug is its content at the cell's start
      if (sizing === "fixed") style[isWidth ? "width" : "height"] = px(size, unit);
      if (sizing === "hug") style[isWidth ? "justifySelf" : "alignSelf"] = "start";
      return;
    }
    if (sizing === "fixed") {
      style[isWidth ? "width" : "height"] = px(size, unit);
      // a fixed size in a stack never shrinks to fit (Figma's fixed): the stack's overflow is the author's to see
      if (g.positioning === "flow" && ((isWidth && parentRow) || (!isWidth && ctx.parentDirection === "column"))) style.flexShrink = 0;
    } else if (sizing === "fill") {
      if (g.positioning === "absolute") {
        style[isWidth ? "width" : "height"] = "100%";
      } else if ((isWidth && parentRow) || (!isWidth && !parentRow)) {
        style.flex = "1 1 0%";
        style[isWidth ? "minWidth" : "minHeight"] = 0;
      } else {
        style.alignSelf = "stretch";
      }
    }
  };
  axis("horizontal");
  axis("vertical");
  // FigCraft port F6: a grid child's own place in its cell (horizontal; `layout.alignSelf` is the vertical one)
  if (inGrid) {
    const js = resolved.get("layout.justifySelf");
    if (js === "start" || js === "center" || js === "end" || js === "stretch") style.justifySelf = js;
    const as = resolved.get("layout.alignSelf");
    if (as === "start" || as === "center" || as === "end" || as === "stretch") style.alignSelf = as;
  }
  // FigCraft port F6: a parent that paints its first child on top hands each child its place in the stacking order
  if (typeof ctx.stackZ === "number") style.zIndex = ctx.stackZ;
  else {
    // The Z field (Position, More): a number above or below its neighbours puts the layer over or under them whatever the order in the list
    const z = resolved.get("layout.zIndex");
    if (typeof z === "number" && Number.isFinite(z) && z !== 0) style.zIndex = Math.round(z);
  }
  if (inGrid) {
    // the cell this layer sits in: a start (1-based) and how many tracks it spans
    const span = (path: string) => {
      const v = resolved.get(path);
      return typeof v === "number" && Number.isFinite(v) && v >= 1 ? Math.min(200, Math.floor(v)) : 1;
    };
    const start = (path: string) => {
      const v = resolved.get(path);
      return typeof v === "number" && Number.isFinite(v) && v >= 1 ? Math.min(200, Math.floor(v)) : 0;
    };
    const cs = start("layout.gridColumnStart");
    const rs = start("layout.gridRowStart");
    const ce = span("layout.gridColumnSpan");
    const re = span("layout.gridRowSpan");
    if (cs > 0 || ce > 1) style.gridColumn = cs > 0 ? `${cs} / span ${ce}` : `span ${ce}`;
    if (rs > 0 || re > 1) style.gridRow = rs > 0 ? `${rs} / span ${re}` : `span ${re}`;
  }

  // Clipping, for any layer: what sticks out of its box.
  const overflow = (path: string) => {
    const v = resolved.get(path);
    return v === "hidden" || v === "scroll" || v === "auto" ? v : undefined;
  };
  const ox = overflow("layout.overflowX");
  const oy = overflow("layout.overflowY");
  if (ox) style.overflowX = ox;
  if (oy) style.overflowY = oy;
  // A layer placed by its stack: the space around it, how it shares the stack's room, and its own cross alignment.
  if (g.positioning === "flow") {
    const margin = (path: string) => {
      const v = resolved.get(path);
      return typeof v === "number" && v !== 0 ? v : undefined;
    };
    const all = margin("layout.margin");
    if (all !== undefined) style.margin = all;
    for (const [path, key] of [["layout.marginTop", "marginTop"], ["layout.marginRight", "marginRight"], ["layout.marginBottom", "marginBottom"], ["layout.marginLeft", "marginLeft"]] as const) {
      const v = margin(path);
      if (v !== undefined) style[key] = v;
    }
    if (!inGrid) {
      const grow = resolved.get("layout.flexGrow");
      if (typeof grow === "number" && grow > 0) style.flexGrow = grow;
      const shrink = resolved.get("layout.flexShrink");
      if (typeof shrink === "number" && shrink !== 1) style.flexShrink = shrink;
      const self = resolved.get("layout.alignSelf");
      if (self === "flex-start" || self === "center" || self === "flex-end" || self === "stretch") style.alignSelf = self;
    }
  }
  // Text is the one leaf with an inside: its padding insets the words.
  if (layer.archetype === "text") {
    for (const [path, key] of [["layout.paddingTop", "paddingTop"], ["layout.paddingRight", "paddingRight"], ["layout.paddingBottom", "paddingBottom"], ["layout.paddingLeft", "paddingLeft"]] as const) {
      const v = resolved.get(path);
      if (typeof v === "number" && v > 0) style[key] = v;
    }
  }

  const designed = designTransform(resolved);
  const perspective = resolved.num("transform.perspective", 0);
  const style3d = resolved.get("transform.style3d");
  if (perspective > 0 && (resolved.num("transform.rotateX", 0) || resolved.num("transform.rotateY", 0) || style3d === "preserve3d")) {
    // 3D: the layer is tilted into the distance first and then turned on that plane, so Rotation steers text along a road, not across the screen
    const tilt = designed.split(" ").filter((t) => t.startsWith("rotateX") || t.startsWith("rotateY"));
    const rest = designed.split(" ").filter((t) => !t.startsWith("rotateX") && !t.startsWith("rotateY"));
    style.transform = [`perspective(${perspective}px)`, ...tilt, g.frame.rotation !== 0 ? `rotate(${g.frame.rotation}deg)` : "", ...rest].filter(Boolean).join(" ");
  } else if (g.frame.rotation !== 0 || designed) style.transform = [g.frame.rotation !== 0 ? `rotate(${g.frame.rotation}deg)` : "", designed].filter(Boolean).join(" ");

  // 3D stage preserve-3d contract (CSS Transforms Level 2):
  // Setting `transform-style: preserve-3d` establishes a shared 3D rendering context where children
  // retain their 3D positions (rotateX, rotateY, translateZ).
  // However, the browser will forcibly FLATTEN this 3D context into a 2D plane if any of the following
  // properties are set on the preserve-3d element or any intermediate ancestor:
  //   1. `overflow` other than `visible` (e.g. `overflow: hidden`, `scroll`, `auto`, `clip`)
  //   2. `opacity` strictly less than 1.0
  //   3. `filter` other than `none`
  //   4. `clip-path` other than `none`
  //   5. `backdrop-filter` other than `none`
  //   6. `mix-blend-mode` other than `normal`
  //   7. `isolation: isolate`
  // Therefore, when `transform.style3d === "preserve3d"`, parents need `preserve-3d` all the way down,
  // and we suppress overflow clipping, opacity < 1, and flattening filters on the 3D stage group.
  if (style3d === "preserve3d") {
    style.transformStyle = "preserve-3d";
    delete style.overflowX;
    delete style.overflowY;
  }
  // Precedence: transform.mesh > transform.pin > perspective / rotation
  const mesh = parseMesh(resolved.get("transform.mesh"));
  const hasMesh = mesh !== null && isMeshConvex(mesh) && g.frame.width > 0 && g.frame.height > 0;
  if (hasMesh || ctx.inMeshTile) {
    // Warp mesh takes precedence: outer layer or tile content carries no pin/perspective transform
    delete style.transform;
    delete style.transformOrigin;
  } else {
    // Corner pin: the layer's corners are dragged onto a surface, and it is drawn in perspective to fit it
    const relative = pinInLayer(resolved.get("transform.pin"), [g.frame.x, g.frame.y]);
    if (relative && g.positioning === "absolute" && g.frame.width > 0 && g.frame.height > 0 && isConvex(relative)) {
      style.transform = pinMatrix3d(g.frame.width, g.frame.height, relative);
      style.transformOrigin = "0 0";
    }
  }
  const origin = resolved.get("transform.origin");
  if (typeof origin === "string" && origin !== "center" && style.transform && !hasMesh && !ctx.inMeshTile) {
    // A pin name (preset or custom) or a coordinate becomes the pixel point inside the layer's box; plain CSS keeps working.
    const isPinName = Object.prototype.hasOwnProperty.call(layer.pins ?? {}, origin) || /^[a-z]+[A-Z]/.test(origin);
    const pinned = isPinName && g.frame.width > 0 && g.frame.height > 0
      ? resolveLayerAnchor({ pins: layer.pins, properties: { "transform.origin": origin } }, g.frame.width, g.frame.height)
      : null;
    style.transformOrigin = pinned ? formatCssTransformOrigin(pinned) : origin;
  }
  const opacity = resolved.get("appearance.opacity");
  if (typeof opacity === "number" && opacity >= 0 && opacity <= 1) {
    if (style3d !== "preserve3d" || opacity === 1) style.opacity = opacity;
  }
  // Compositing (Phase 74): blend mode and isolation, then the mask. A flattening property, so not inside a 3D stage group.
  if (style3d !== "preserve3d") {
    const blend = blendStyle((path) => resolved.get(path));
    if (blend.mixBlendMode) style.mixBlendMode = blend.mixBlendMode;
    if (blend.isolation) style.isolation = blend.isolation;
    const mask = maskStyle((path) => resolved.get(path), { width: g.frame.width, height: g.frame.height });
    if (mask) Object.assign(style, mask);
  }
  // Effects (Phase 35): drop and inner shadows (a shape draws its own, inside its SVG), layer blur and background blur.
  if (options.shadow !== "none") {
    const shadow = boxShadowCss(parseShadows(resolved.get("paint.shadows")));
    if (shadow) style.boxShadow = shadow;
  }
  // FigCraft port F7: the effect list (`paint.effects`); a blur in it wins over the plain one
  const effects = parseEffects(resolved.get("paint.effects"));
  const backdrops: string[] = [];
  // The layer's filters (FigCraft's effects and the plain blur), then the effect stack's CSS ones (Phase 75). The stack's
  // SVG effects and motion blur are added by the animation engine, which keeps their filters in the frame.
  const filters = [...baseFilterFunctions((path) => resolved.get(path), layer.id, options.bands === true), ...fxStyle(layer.id, (path) => resolved.get(path), { svg: false }).functions];
  if (filters.length > 0 && style3d !== "preserve3d") style.filter = filters.join(" ");
  const bgBlur = blurOf(effects, "backgroundBlur");
  const backdrop = resolved.get("paint.backgroundBlur");
  if (style3d !== "preserve3d") {
    if (bgBlur) {
      if (bgBlur.blurType !== "progressive") backdrops.push(`blur(${Math.min(bgBlur.radius, 200)}px)`);
      else if (!options.bands) backdrops.push(`blur(${Math.min(maxRadius(bgBlur), 200)}px)`);
    } else if (typeof backdrop === "number" && backdrop > 0) backdrops.push(`blur(${Math.min(backdrop, 200)}px)`);
    const glass = effects.find((e) => e.visible && e.type === "glass");
    if (glass && glass.type === "glass") {
      const g = glassCss(glass);
      backdrops.push(g.backdropFilter);
      if (options.shadow !== "none") style.boxShadow = style.boxShadow ? `${style.boxShadow}, ${g.boxShadow}` : g.boxShadow;
    }
    const adjustment = adjustmentFilter((path) => resolved.get(path));
    if (adjustment) backdrops.push(adjustment);
    if (backdrops.length > 0) {
      style.backdropFilter = backdrops.join(" ");
      (style as Record<string, unknown>).WebkitBackdropFilter = backdrops.join(" ");
    }
  }
  return style;
}

/**
 * The `filter` functions a layer has apart from the effect stack: FigCraft's noise and texture filter, its layer blur (a
 * progressive one is drawn by the frame's backdrop layers when `bands`; elsewhere it is the uniform blur half way up its
 * ramp) and the plain blur. The render definitions and the animation engine both call this.
 */
export function baseFilterFunctions(get: PropReader, layerId: string, bands: boolean): string[] {
  const effects = parseEffects(get("paint.effects"));
  const filters: string[] = [];
  if (needsFilter(effects)) filters.push(`url(#${effectFilterId(layerId)})`);
  const layerBlur = blurOf(effects, "layerBlur");
  const blur = get("filter.blur");
  if (layerBlur) {
    if (layerBlur.blurType !== "progressive") filters.push(`blur(${Math.min(layerBlur.radius, 200)}px)`);
    else if (!bands) filters.push(`blur(${Math.min((layerBlur.radius + layerBlur.startRadius) / 2, 200)}px)`);
  } else if (typeof blur === "number" && blur > 0) filters.push(`blur(${Math.min(blur, 200)}px)`);
  return filters;
}

/** `px` strings for numbers; used for radii, gaps and paddings read from props. */
export const px = (n: number) => `${n}px`;
