import React, { useContext } from "react";
import { layerBoxStyle } from "../geometry";
import { clampNumber, clampText, safeFragmentHref, safePathData } from "../limits";
import type { ArchetypeRenderProps } from "../types";
import { InSvgContext } from "./svgContext";
import { safeDashArray } from "../../paint/paints";
import { ShapePaint } from "../shapePaint";
import { strokeSettings } from "../strokePaint";
import { pathDataToBez } from "../../paths/bezBridge";
import { fillPath as networkFill, fillRule as networkRule, parseNetwork, strokePath as networkStroke } from "../../paths/vectorNetwork";
import type { BezPath } from "../../geometry/bezpath";
import { drawDashes, drawSettings, hasDraw } from "../../paths/strokeDraw";
import { subpathData } from "../../paths/morphMatch";
import type { Layer } from "../../document/schema";

const pick = <T extends string>(value: string, allowed: readonly T[], fallback: T): T => ((allowed as readonly string[]).includes(value) ? (value as T) : fallback);
const CAPS = ["butt", "round", "square"] as const;
const JOINS = ["miter", "round", "bevel"] as const;

/**
 * A plain stroked path, with its stroke drawing (ROADMAP Phase 85, `core/paths/strokeDraw.ts`). Without drawing settings
 * it is the one `<path>` it always was. With them, the part of the stroke between `draw.start` and `draw.end` is one
 * dash on a path whose length is called 1; and a path of several sub-paths is drawn as a fill and one stroke per
 * sub-path, so they draw together or one after another (`draw.stagger`) instead of along one long line. The animation
 * engine writes the same attributes on the same elements (`core/engine/stage/svgPaths.ts`).
 */
function StrokedPath({ layer, resolved, d, attrs, pathRef, marked }: { layer: Layer; resolved: ArchetypeRenderProps["resolved"]; d: string; attrs: React.SVGProps<SVGPathElement>; pathRef?: ArchetypeRenderProps["nodeRef"]; marked: boolean }) {
  const id = marked ? { "data-element-id": layer.id } : {};
  const settings = hasDraw(layer.properties) ? drawSettings((path) => resolved.get(path)) : null;
  const parts = settings ? subpathData(d) : [];
  if (!settings || parts.length <= 1) {
    const dash = settings ? drawDashes(settings, 1)?.[0] : undefined;
    return <path ref={pathRef as React.Ref<SVGPathElement>} {...id} d={d} {...attrs} {...(dash ? { pathLength: 1, strokeDasharray: dash.array, strokeDashoffset: dash.offset } : {})} />;
  }
  const dashes = drawDashes(settings, parts.length);
  return (
    <g ref={pathRef as React.Ref<SVGGElement>} {...id} data-path-parts="">
      <path data-path-fill="" d={d} {...attrs} stroke="none" strokeDasharray={undefined} />
      {parts.map((part, i) => {
        const dash = dashes?.[i];
        return <path key={i} data-path-part={i} d={part} {...attrs} fill="none" {...(dash ? { pathLength: 1, strokeDasharray: dash.array, strokeDashoffset: dash.offset } : {})} />;
      })}
    </g>
  );
}

/**
 * Draws `inner` as an SVG child inside an `svgGroup`, or inside its own `<svg>` standing alone.
 * `space` is the coordinate system of a standalone `<svg>`: the Pen and Pencil tools author paths in a
 * 200 × 200 space that stretches to the frame (`unit`); text and groups use the frame's own pixels.
 */
const SvgShell: React.FC<ArchetypeRenderProps & { inner: (nodeRef: ArchetypeRenderProps["nodeRef"]) => React.ReactNode; space?: "unit" | "pixels" }> = ({ layer, resolved, ctx, inner, space = "unit", nodeRef }) => {
  const inGroup = useContext(InSvgContext);
  if (inGroup) return <>{inner(nodeRef)}</>;
  const width = clampNumber(resolved.num("frame.width", 100), 1, 10_000, 100);
  const height = clampNumber(resolved.num("frame.height", 100), 1, 10_000, 100);
  return (
    <svg
      ref={nodeRef}
      data-element-id={layer.id}
      data-archetype={layer.archetype}
      viewBox={space === "unit" ? "0 0 200 200" : `0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ ...layerBoxStyle(layer, resolved, ctx, { shadow: "none" }), width, height, display: "block", overflow: "visible" }}
    >
      {inner(undefined)}
    </svg>
  );
};

/**
 * An `svgPath` with FigCraft-port strokes (several stroke paints, alignment, a variable width, arrowheads). The path
 * is authored in a 200 × 200 space stretched to the frame, but a stroke keeps its width in px: so the stroke's outline
 * is built in px (`core/paths/strokes.ts`) and mapped back into the 200 × 200 space.
 */
function AdvancedSvgPath(p: ArchetypeRenderProps & { d: string; strokeD?: string; rule?: "nonzero" | "evenodd" }) {
  const width = clampNumber(p.resolved.num("frame.width", 100), 1, 10_000, 100);
  const height = clampNumber(p.resolved.num("frame.height", 100), 1, 10_000, 100);
  const unit = pathDataToBez(p.strokeD ?? p.d);
  const px = unit ? unit.map((q) => ({ x: (q.x * width) / 200, y: (q.y * height) / 200 })) : null;
  const closed = !!unit && unit.els.some((e) => e.t === "Z");
  const toDrawing = (b: BezPath) => b.map((q) => ({ x: (q.x * 200) / width, y: (q.y * 200) / height }));
  return (
    <SvgShell
      {...p}
      inner={() => (
        <ShapePaint
          layer={p.layer}
          resolved={withProfile(p.resolved)}
          width={200}
          height={200}
          defaultFill="none"
          defaultStroke="#0f172a"
          defaultStrokeWidth={2}
          closed={closed}
          outline={px}
          toDrawing={toDrawing}
          geometry={(a) => <path {...a} d={a.fill === "none" && p.strokeD ? p.strokeD : p.d} fillRule={p.rule ?? (p.resolved.str("svg.fillRule", "nonzero") === "evenodd" ? "evenodd" : "nonzero")} />}
        />
      )}
    />
  );
}

/** In a stretched space a native stroke would stretch with it: give the stroke a uniform width profile so it is drawn as an outline built in px. */
function withProfile(resolved: ArchetypeRenderProps["resolved"]): ArchetypeRenderProps["resolved"] {
  if (resolved.get("stroke.widthProfile")) return resolved;
  const uniform = JSON.stringify([{ t: 0, scale: 1 }, { t: 1, scale: 1 }]);
  return { ...resolved, get: (path: string) => (path === "stroke.widthProfile" ? uniform : resolved.get(path)) };
}

/**
 * A path layer with a vector network (FigCraft port F4): the fill is drawn from its regions (by their fill rule), the
 * stroke from its segments chained into runs, both in the layer's 200 × 200 space.
 */
function NetworkSvgPath(p: ArchetypeRenderProps & { fillD: string; strokeD: string; rule: "nonzero" | "evenodd" }) {
  if (strokeSettings(p.resolved, "#0f172a", 2, !/[zZ]/.test(p.strokeD))) return <AdvancedSvgPath {...p} d={p.fillD} strokeD={p.strokeD} rule={p.rule} />;
  return (
    <SvgShell
      {...p}
      inner={(ref) => (
        <g ref={ref as React.Ref<SVGGElement>} data-element-id={p.layer.id} data-network="">
          <path d={p.fillD} fill={p.resolved.str("svg.fill", "none")} fillRule={p.rule} stroke="none" />
          <path
            d={p.strokeD}
            fill="none"
            stroke={p.resolved.str("svg.stroke", "#0f172a")}
            strokeWidth={clampNumber(p.resolved.num("svg.strokeWidth", 2), 0, 200, 2)}
            strokeLinecap={pick<(typeof CAPS)[number]>(p.resolved.str("svg.strokeLinecap", "butt"), CAPS, "butt")}
            strokeLinejoin={pick<(typeof JOINS)[number]>(p.resolved.str("svg.strokeLinejoin", "miter"), JOINS, "miter")}
            strokeDasharray={safeDashArray(p.resolved.str("svg.strokeDasharray", "none"))}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    />
  );
}

/** `svgPath`: the Pen and Pencil tools' output, and any imported path. */
export const SvgPath: React.FC<ArchetypeRenderProps> = (p) => {
  const net = parseNetwork(p.resolved.get("svg.network"));
  if (net) return <NetworkSvgPath {...p} fillD={networkFill(net).toSvg(3)} strokeD={networkStroke(net).toSvg(3)} rule={networkRule(net)} />;
  return strokeSettings(p.resolved, "#0f172a", 2, !/[zZ]/.test(p.resolved.str("svg.path", ""))) ? (
    <AdvancedSvgPath {...p} d={safePathData(p.resolved.str("svg.path", "M0 0 L100 100"))} />
  ) : (
  <SvgShell
    {...p}
    inner={(ref) => (
      <StrokedPath
        layer={p.layer}
        resolved={p.resolved}
        pathRef={ref}
        marked
        d={safePathData(p.resolved.str("svg.path", "M0 0 L100 100"))}
        attrs={{
          stroke: p.resolved.str("svg.stroke", "#0f172a"),
          strokeWidth: clampNumber(p.resolved.num("svg.strokeWidth", 2), 0, 200, 2),
          fill: p.resolved.str("svg.fill", "none"),
          fillRule: p.resolved.str("svg.fillRule", "nonzero") === "evenodd" ? "evenodd" : "nonzero",
          strokeLinecap: pick<(typeof CAPS)[number]>(p.resolved.str("svg.strokeLinecap", "butt"), CAPS, "butt"),
          strokeLinejoin: pick<(typeof JOINS)[number]>(p.resolved.str("svg.strokeLinejoin", "miter"), JOINS, "miter"),
          strokeDasharray: safeDashArray(p.resolved.str("svg.strokeDasharray", "none")),
          // the path is drawn in a 200 x 200 space stretched to the frame: the stroke must keep its width in px however it is stretched
          vectorEffect: "non-scaling-stroke",
        }}
      />
    )}
  />
  );
};

/** `svgText`: a text run in a group or on its own. */
export const SvgText: React.FC<ArchetypeRenderProps> = (p) => {
  const raw = p.resolved.str("content.text", "Text");
  const text = clampText(p.ctx.interpolate ? p.ctx.interpolate(raw) : raw);
  return (
    <SvgShell
      {...p}
      space="pixels"
      inner={(ref) => (
        <text ref={ref as React.Ref<SVGTextElement>} data-element-id={p.layer.id} x={0} y={20} fontSize={clampNumber(p.resolved.num("typography.fontSize", 16), 4, 512, 16)} fill={p.resolved.str("svg.fill", "#0f172a")}>
          {text}
        </text>
      )}
    />
  );
};

/** `svgUse`: a reference to something in the same document only; an external reference draws nothing. */
export const SvgUse: React.FC<ArchetypeRenderProps> = (p) => {
  const href = safeFragmentHref(p.resolved.str("svg.href", ""));
  return <SvgShell {...p} inner={(ref) => (href ? <use ref={ref as React.Ref<SVGUseElement>} data-element-id={p.layer.id} href={href} /> : null)} />;
};

/** `svgGroup`: one `<svg>` that its children draw into. */
export const SvgGroup: React.FC<ArchetypeRenderProps> = ({ layer, resolved, ctx, children, nodeRef }) => (
  <svg
    ref={nodeRef}
    data-element-id={layer.id}
    data-archetype="svgGroup"
    viewBox={`0 0 ${clampNumber(resolved.num("frame.width", 100), 1, 10_000, 100)} ${clampNumber(resolved.num("frame.height", 100), 1, 10_000, 100)}`}
    style={{ ...layerBoxStyle(layer, resolved, ctx), width: clampNumber(resolved.num("frame.width", 100), 1, 10_000, 100), height: clampNumber(resolved.num("frame.height", 100), 1, 10_000, 100), display: "block", overflow: "visible" }}
  >
    <InSvgContext.Provider value>
      <g>{children}</g>
    </InSvgContext.Provider>
  </svg>
);

/** `icon`: a single path in a square viewBox, tinted by its text colour. */
export const Icon: React.FC<ArchetypeRenderProps> = ({ layer, resolved, ctx, nodeRef }) => {
  const size = clampNumber(resolved.num("svg.size", 24), 4, 512, 24);
  return (
    <svg
      ref={nodeRef}
      data-element-id={layer.id}
      data-archetype="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={resolved.str("content.iconName", layer.name)}
      style={{ ...layerBoxStyle(layer, resolved, ctx), width: size, height: size, display: "inline-block", flexShrink: 0, color: resolved.str("typography.color", "#0f172a") }}
    >
      <StrokedPath
        layer={layer}
        resolved={resolved}
        marked={false}
        d={safePathData(resolved.str("svg.path", ""))}
        attrs={{ stroke: resolved.str("svg.stroke", "currentColor"), strokeWidth: clampNumber(resolved.num("svg.strokeWidth", 2), 0, 24, 2), fill: resolved.str("svg.fill", "none"), strokeLinecap: "round", strokeLinejoin: "round" }}
      />
    </svg>
  );
};
