import React from "react";
import type { Layer } from "../document/schema";
import { parseColor, toCss } from "../paint/colorMath";
import { effectiveFills, hasAdjustFilter, imageFilterCss, paintBlendCss, paintCss, parseShadows, safeDashArray, type GradientStop, type ImagePaint, type Paint, type Shadow } from "../paint/paints";
import { adjustmentMatrix, adjustmentToneTable, type ImageAdjustments } from "../paint/color";
import type { BezPath } from "../geometry/bezpath";
import { StrokeLayer, strokeSettings } from "./strokePaint";
import { useAssetUrlMap } from "../assets/useAssetUrl";
import { useRenderLayers } from "./layersContext";
import { fromWorld, layerOutline, layerSize, toParent } from "../editing/layerOutline";
import type { PaintMask } from "../paint/paints";
import type { ResolvedProps } from "./types";

/**
 * Painting an SVG shape (ROADMAP Phase 35): its fills (solid, linear, radial, conic), its stroke with a dash
 * pattern, and its drop and inner shadows as an SVG filter. The shape's own geometry is passed in as a function
 * so every fill, the stroke, and the clip for a conic fill draw the same outline.
 *
 * Gradients use user-space coordinates so the stops sit exactly where the CSS gradient (and the handles on the
 * canvas) put them, whatever the box's shape. A conic gradient has no SVG form: it is a CSS gradient in a
 * `foreignObject`, clipped to the outline.
 */

/** The paint attributes a shape's outline is drawn with. */
export interface PaintAttrs {
  fill: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
}

export type Geometry = (attrs: PaintAttrs) => React.ReactElement;

const rgb = (color: string) => {
  const c = parseColor(color);
  return c ? { color: `rgb(${c.r}, ${c.g}, ${c.b})`, alpha: c.a } : { color: "#000000", alpha: 1 };
};

function Stops({ stops, opacity }: { stops: readonly GradientStop[]; opacity: number }) {
  return (
    <>
      {stops.map((s, i) => {
        const c = rgb(s.color);
        return <stop key={i} offset={s.at} stopColor={c.color} stopOpacity={Number((c.alpha * opacity).toFixed(4))} />;
      })}
    </>
  );
}

function ShadowFilter({ id, shadows, width, height }: { id: string; shadows: readonly Shadow[]; width: number; height: number }) {
  const visible = shadows.filter((s) => s.visible);
  // The filter's region is given in the shape's own pixels, not as a share of its outline: a line has no height, so a share of it is nothing.
  const reach = Math.ceil(visible.reduce((m, s) => Math.max(m, Math.abs(s.x), Math.abs(s.y)) + s.blur * 1.5 + Math.abs(s.spread) + 2, 8));
  // listed top first; an SVG filter draws bottom first, so go through them backwards
  const drops = visible.filter((s) => s.kind === "drop").reverse();
  const inners = visible.filter((s) => s.kind === "inner").reverse();
  return (
    <filter id={id} filterUnits="userSpaceOnUse" x={-reach} y={-reach} width={width + reach * 2} height={height + reach * 2} colorInterpolationFilters="sRGB">
      {drops.map((s, i) => {
        const c = rgb(s.color);
        return (
          <React.Fragment key={`d${i}`}>
            {s.spread !== 0 ? <feMorphology in="SourceAlpha" operator={s.spread > 0 ? "dilate" : "erode"} radius={Math.abs(s.spread)} result={`m${i}`} /> : null}
            <feGaussianBlur in={s.spread !== 0 ? `m${i}` : "SourceAlpha"} stdDeviation={s.blur / 2} result={`b${i}`} />
            <feOffset in={`b${i}`} dx={s.x} dy={s.y} result={`o${i}`} />
            <feFlood floodColor={c.color} floodOpacity={c.alpha} result={`c${i}`} />
            <feComposite in={`c${i}`} in2={`o${i}`} operator="in" result={`d${i}`} />
          </React.Fragment>
        );
      })}
      {inners.map((s, i) => {
        const c = rgb(s.color);
        return (
          <React.Fragment key={`i${i}`}>
            <feFlood floodColor={c.color} floodOpacity={c.alpha} result={`ic${i}`} />
            <feComposite in={`ic${i}`} in2="SourceAlpha" operator="out" result={`iv${i}`} />
            {s.spread !== 0 ? <feMorphology in={`iv${i}`} operator={s.spread > 0 ? "dilate" : "erode"} radius={Math.abs(s.spread)} result={`im${i}`} /> : null}
            <feGaussianBlur in={s.spread !== 0 ? `im${i}` : `iv${i}`} stdDeviation={s.blur / 2} result={`ib${i}`} />
            <feOffset in={`ib${i}`} dx={s.x} dy={s.y} result={`io${i}`} />
            <feComposite in={`io${i}`} in2="SourceAlpha" operator="in" result={`is${i}`} />
          </React.Fragment>
        );
      })}
      <feMerge>
        {drops.map((_, i) => <feMergeNode key={`md${i}`} in={`d${i}`} />)}
        <feMergeNode in="SourceGraphic" />
        {inners.map((_, i) => <feMergeNode key={`mi${i}`} in={`is${i}`} />)}
      </feMerge>
    </filter>
  );
}

/**
 * FigCraft's seven image adjustments as an SVG filter (FigCraft port F2): the exact colour matrix for exposure,
 * contrast, saturation, temperature and tint, then a tone table for highlights and shadows.
 */
export function AdjustFilter({ id, adjust }: { id: string; adjust: ImageAdjustments }) {
  const table = adjustmentToneTable(adjust);
  return (
    <filter id={id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
      <feColorMatrix type="matrix" values={adjustmentMatrix(adjust).join(" ")} />
      {table && (
        <feComponentTransfer>
          <feFuncR type="table" tableValues={table.join(" ")} />
          <feFuncG type="table" tableValues={table.join(" ")} />
          <feFuncB type="table" tableValues={table.join(" ")} />
        </feComponentTransfer>
      )}
    </filter>
  );
}

export interface ShapePaintProps {
  layer: Layer;
  resolved: ResolvedProps;
  width: number;
  height: number;
  /** The plain fill colour when the layer has no `paint.fills`. */
  defaultFill: string;
  defaultStroke: string;
  defaultStrokeWidth: number;
  /** Draws the shape's outline with the given paint attributes. */
  geometry: Geometry;
  /** Draw no fill and no stroke (a line is stroke only: set `fillable` false). */
  fillable?: boolean;
  /** Does the shape draw a stroke? (An arrow doesn't.) */
  strokable?: boolean;
  /** The shape's outline as a path (FigCraft port F3: variable widths, per-side weights, arrowheads). */
  outline?: BezPath | null;
  /** Whether the outline is closed. Default true. */
  closed?: boolean;
  /** Rectangle corners, for per-side stroke weights. */
  rect?: { radii: number[]; smoothing: number };
  /** Maps outline coordinates into the drawing's. */
  toDrawing?: (p: BezPath) => BezPath;
}

/**
 * A fill's mask (Phase 113) as an SVG alpha mask: where the mask is opaque the fill shows, where it is clear the fill
 * is hidden. (Alpha, not luminance: browsers disagree on the colour space a luminance mask is read in.) Null when
 * the mask can't be drawn (a layer mask whose layer is gone or isn't a sibling); the fill is then drawn unmasked.
 */
function fillMask({ id, mask, width, height, owner, layers, toDrawing }: { id: string; mask: PaintMask; width: number; height: number; owner: Layer; layers: Readonly<Record<string, Layer>> | null; toDrawing?: (p: BezPath) => BezPath }): React.ReactElement | null {
  const reach = Math.hypot(width, height);
  const region = { maskUnits: "userSpaceOnUse" as const, x: -reach, y: -reach, width: width + 2 * reach, height: height + 2 * reach, style: { maskType: "alpha" as const } };
  const big = `M${-reach} ${-reach}H${width + reach}V${height + reach}H${-reach}Z`;
  if (mask.type === "layer") {
    const other = layers?.[mask.id];
    if (!other || !layers || other.id === owner.id || other.parentId !== owner.parentId) return null;
    const o = layerOutline(other, layers);
    if (!o) return null;
    const { w, h } = layerSize(owner);
    const num = (k: string) => (typeof owner.properties[k] === "number" ? (owner.properties[k] as number) : 0);
    let path = fromWorld(toParent(o.path, other), { cx: num("frame.x") + w / 2, cy: num("frame.y") + h / 2, w, h, rot: num("frame.rotation") });
    if (toDrawing) path = toDrawing(path);
    // inverted: the whole region with the layer cut out of it, in one even-odd path
    return (
      <mask id={id} {...region}>
        <path d={mask.invert ? big + path.toSvg(2) : path.toSvg(2)} fill="#fff" fillRule={mask.invert || o.evenOdd ? "evenodd" : "nonzero"} />
      </mask>
    );
  }
  // a fade: shown fully at `start`, gone at `end`
  const lo = Math.min(mask.start, mask.end);
  const hi = Math.max(mask.start, mask.end);
  const shownFirst = mask.start <= mask.end;
  const value = (t: number) => {
    const k = t <= lo ? 0 : t >= hi ? 1 : (t - lo) / (hi - lo || 1);
    return shownFirst ? 1 - k : k;
  };
  const cx = width / 2;
  const cy = height / 2;
  if (mask.type === "conic") {
    // as wedges round the centre, each as opaque as the fade is at its middle (SVG has no conic gradient)
    const n = 96;
    const R = reach;
    const a0 = ((mask.angle - 90) * Math.PI) / 180;
    return (
      <mask id={id} {...region}>
        {Array.from({ length: n }, (_, i) => {
          const s0 = a0 + (i / n) * 2 * Math.PI;
          const e0 = a0 + ((i + 1) / n) * 2 * Math.PI;
          return <path key={i} d={`M${cx} ${cy}L${cx + Math.cos(s0) * R} ${cy + Math.sin(s0) * R}L${cx + Math.cos(e0) * R} ${cy + Math.sin(e0) * R}Z`} fill="#fff" fillOpacity={Number(value((i + 0.5) / n).toFixed(3))} shapeRendering="crispEdges" />;
        })}
      </mask>
    );
  }
  const gid = `${id}__g`;
  const stops = (
    <>
      <stop offset={lo} stopColor="#fff" stopOpacity={value(lo)} />
      <stop offset={hi} stopColor="#fff" stopOpacity={value(hi)} />
    </>
  );
  let grad: React.ReactElement;
  if (mask.type === "radial") {
    grad = (
      <radialGradient id={gid} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={Math.hypot(width, height) / 2}>
        {stops}
      </radialGradient>
    );
  } else {
    const a = (mask.angle * Math.PI) / 180;
    const d = { x: Math.sin(a), y: Math.cos(a) };
    const half = (Math.abs(width * d.x) + Math.abs(height * d.y)) / 2;
    grad = (
      <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={cx - d.x * half} y1={cy - d.y * half} x2={cx + d.x * half} y2={cy + d.y * half}>
        {stops}
      </linearGradient>
    );
  }
  return (
    <mask id={id} {...region}>
      {grad}
      <path d={big} fill={`url(#${gid})`} />
    </mask>
  );
}

/** How opaque a fade mask is at a point of the box (0–1): the same rule `fillMask` draws, for tests and tools. */
export function fadeAt(mask: Exclude<PaintMask, { type: "layer" }>, width: number, height: number, x: number, y: number): number {
  const lo = Math.min(mask.start, mask.end);
  const hi = Math.max(mask.start, mask.end);
  const cx = width / 2;
  const cy = height / 2;
  let t: number;
  if (mask.type === "radial") t = Math.hypot(x - cx, y - cy) / (Math.hypot(width, height) / 2);
  else if (mask.type === "conic") {
    let a = Math.atan2(y - cy, x - cx) - ((mask.angle - 90) * Math.PI) / 180;
    a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    t = a / (2 * Math.PI);
  } else {
    const a = (mask.angle * Math.PI) / 180;
    const d = { x: Math.sin(a), y: Math.cos(a) };
    const half = (Math.abs(width * d.x) + Math.abs(height * d.y)) / 2;
    t = ((x - cx) * d.x + (y - cy) * d.y + half) / (2 * half || 1);
  }
  const k = t <= lo ? 0 : t >= hi ? 1 : (t - lo) / (hi - lo || 1);
  return mask.start <= mask.end ? 1 - k : k;
}

/** The fills, stroke and shadows of a shape, as the children of its `<svg>`. */
export function ShapePaint({ layer, resolved, width, height, defaultFill, defaultStroke, defaultStrokeWidth, geometry, fillable = true, strokable = true, outline = null, closed = true, rect, toDrawing }: ShapePaintProps) {
  const id = layer.id.replace(/[^A-Za-z0-9_-]/g, "_");
  const fills: Paint[] = fillable ? effectiveFills(resolved.get("paint.fills"), resolved.str("svg.fill", defaultFill)) : [];
  const urlOf = useAssetUrlMap(fills.filter((p): p is ImagePaint => p.type === "image").map((p) => p.src));
  const stroke = resolved.str("svg.stroke", defaultStroke);
  const strokeWidth = Math.min(200, Math.max(0, resolved.num("svg.strokeWidth", defaultStrokeWidth)));
  const dash = safeDashArray(resolved.str("svg.strokeDasharray", "none"));
  const cap = resolved.str("svg.strokeLinecap", "butt");
  const join = resolved.str("svg.strokeLinejoin", "miter");
  const shadows = parseShadows(resolved.get("paint.shadows")).filter((s) => s.visible);
  const allLayers = useRenderLayers();
  const filterId = `${id}__shadow`;

  const defs: React.ReactNode[] = [];
  const painted: React.ReactNode[] = [];
  // the first fill is on top, so draw them last to first
  [...fills].reverse().forEach((p, k) => {
    if (!p.visible) return;
    const i = fills.length - 1 - k;
    const gid = `${id}__f${i}`;
    const before = painted.length;
    switch (p.type) {
      case "solid":
        painted.push(<React.Fragment key={`f${i}`}>{geometry({ fill: p.color, fillOpacity: p.opacity, stroke: "none" })}</React.Fragment>);
        break;
      case "linear":
        defs.push(
          <linearGradient key={gid} id={gid} gradientUnits="userSpaceOnUse" x1={p.from.x * width} y1={p.from.y * height} x2={p.to.x * width} y2={p.to.y * height}>
            <Stops stops={p.stops} opacity={p.opacity} />
          </linearGradient>,
        );
        painted.push(<React.Fragment key={`f${i}`}>{geometry({ fill: `url(#${gid})`, stroke: "none" })}</React.Fragment>);
        break;
      case "radial":
        defs.push(
          <radialGradient key={gid} id={gid} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={1} gradientTransform={`translate(${p.center.x * width} ${p.center.y * height}) scale(${p.radius.x * width} ${p.radius.y * height})`}>
            <Stops stops={p.stops} opacity={p.opacity} />
          </radialGradient>,
        );
        painted.push(<React.Fragment key={`f${i}`}>{geometry({ fill: `url(#${gid})`, stroke: "none" })}</React.Fragment>);
        break;
      case "image": {
        const url = p.src ? urlOf(p.src) : null;
        if (!url) break;
        const adjustId = `${gid}__adjust`;
        if (hasAdjustFilter(p)) defs.push(<AdjustFilter key={adjustId} id={adjustId} adjust={p.adjust!} />);
        const filter = imageFilterCss(p, adjustId) || undefined;
        const W = width;
        const H = height;
        const nw = (p.natural?.w ?? 128) * p.scale;
        const nh = (p.natural?.h ?? 128) * p.scale;
        const c = p.crop;
        // a pattern the size of the box (or of one tile), holding the picture placed as the mode says
        const pw = p.mode === "tile" ? nw : W;
        const ph = p.mode === "tile" ? nh : H;
        const place =
          p.mode === "crop" ? { x: (-c.x / c.w) * W, y: (-c.y / c.h) * H, width: W / c.w, height: H / c.h, par: "none" }
          : p.mode === "tile" ? { x: 0, y: 0, width: nw, height: nh, par: "none" }
          : p.natural
            ? // placed by hand: engines disagree about `slice` on an SVG picture inside a pattern, so the size is worked out here
              (() => {
                const k = (p.mode === "fit" ? Math.min : Math.max)(W / p.natural.w, H / p.natural.h);
                const iw = p.natural.w * k;
                const ih = p.natural.h * k;
                return { x: (W - iw) / 2, y: (H - ih) / 2, width: iw, height: ih, par: "none" };
              })()
            : { x: 0, y: 0, width: W, height: H, par: p.mode === "fit" ? "xMidYMid meet" : "xMidYMid slice" };
        defs.push(
          <pattern key={gid} id={gid} patternUnits="userSpaceOnUse" x={0} y={0} width={pw} height={ph}>
            <image href={url} x={place.x} y={place.y} width={place.width} height={place.height} preserveAspectRatio={place.par} opacity={p.opacity} style={filter ? { filter } : undefined} />
          </pattern>,
        );
        painted.push(<React.Fragment key={`f${i}`}>{geometry({ fill: `url(#${gid})`, stroke: "none" })}</React.Fragment>);
        break;
      }
      case "conic":
      case "diamond": {
        const css = paintCss(p, width, height);
        defs.push(<clipPath key={gid} id={gid}>{geometry({ fill: "#000", stroke: "none" })}</clipPath>);
        painted.push(
          <foreignObject key={`f${i}`} x={0} y={0} width={width} height={height} clipPath={`url(#${gid})`}>
            <div style={{ width: "100%", height: "100%", backgroundImage: css ?? "none" }} />
          </foreignObject>,
        );
        break;
      }
    }
    // a fill with a mask shows only where its mask is white (Phase 113)
    if (p.mask && painted.length > before) {
      const maskId = `${gid}__mask`;
      // a plain function (no hooks), called directly so a mask that can't be drawn leaves the fill unmasked
      const m = fillMask({ id: maskId, mask: p.mask, width, height, owner: layer, layers: allLayers, toDrawing });
      if (m) {
        defs.push(<React.Fragment key={maskId}>{m}</React.Fragment>);
        const node = painted.pop();
        painted.push(<g key={`m${i}`} mask={`url(#${maskId})`}>{node}</g>);
      }
    }
    // a fill with a blend mode blends with everything drawn under it (FigCraft port F2)
    const blend = paintBlendCss(p);
    if (blend !== "normal" && painted.length > before) {
      const node = painted.pop();
      painted.push(<g key={`b${i}`} style={{ mixBlendMode: blend as React.CSSProperties["mixBlendMode"] }}>{node}</g>);
    }
  });
  const advanced = strokable ? strokeSettings(resolved, defaultStroke, defaultStrokeWidth, !closed) : null;
  if (advanced) {
    painted.push(<StrokeLayer key="strokes" id={id} settings={advanced} width={width} height={height} geometry={geometry} outline={outline} closed={closed} rect={rect} toDrawing={toDrawing} />);
  } else if (strokable && strokeWidth > 0 && stroke !== "none" && parseColor(stroke) !== null) {
    painted.push(
      <React.Fragment key="stroke">
        {geometry({
          fill: "none",
          stroke: toCss(parseColor(stroke)!),
          strokeWidth,
          ...(dash ? { strokeDasharray: dash } : {}),
          strokeLinecap: cap === "round" || cap === "square" ? cap : "butt",
          strokeLinejoin: join === "round" || join === "bevel" ? join : "miter",
        })}
      </React.Fragment>,
    );
  }
  return (
    <>
      {(defs.length > 0 || shadows.length > 0) && (
        <defs>
          {defs}
          {shadows.length > 0 && <ShadowFilter id={filterId} shadows={shadows} width={width} height={height} />}
        </defs>
      )}
      <g filter={shadows.length > 0 ? `url(#${filterId})` : undefined}>{painted}</g>
    </>
  );
}
