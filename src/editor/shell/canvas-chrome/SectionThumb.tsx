"use client";

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { BRAND_DEFAULTS } from "@/core/templates/brand";
import type { SectionTemplate } from "@/core/templates/sections";
import type { TNode } from "@/core/templates/spec";

/** The width a section is drawn at before it is scaled down into its card: a desktop page. */
const DRAW_WIDTH = 1280;
/** Tall sections are cropped to this share of the card's width, so every card stays a similar height. */
const MAX_ASPECT = 0.7;

const ALIGN: Record<string, React.CSSProperties["alignItems"]> = {
  "flex-start": "flex-start",
  center: "center",
  "flex-end": "flex-end",
  stretch: "stretch",
  "space-between": "space-between",
};

const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** One template node drawn as the page will draw it, from the node's own properties. */
const DrawNode: React.FC<{ node: TNode }> = ({ node }) => {
  const p = node.props;
  const fill = p["sizing.horizontal"] === "fill";
  const width = fill ? "100%" : num(p["frame.width"]);
  if (node.archetype === "text") {
    return (
      <div
        style={{
          width,
          maxWidth: num(p["layout.maxWidth"]),
          fontSize: num(p["typography.fontSize"]),
          fontWeight: num(p["typography.fontWeight"]),
          lineHeight: num(p["typography.lineHeight"]),
          textAlign: p["typography.textAlign"] as React.CSSProperties["textAlign"],
          color: str(p["typography.color"]),
        }}
      >
        {str(p["content.text"])}
      </div>
    );
  }
  if (node.archetype === "button") {
    const border = num(p["appearance.border.width"]);
    return (
      <div
        style={{
          padding: `${num(p["layout.paddingY"]) ?? 0}px ${num(p["layout.paddingX"]) ?? 0}px`,
          background: str(p["appearance.background.color"]),
          border: border ? `${border}px solid ${str(p["appearance.border.color"])}` : undefined,
          borderRadius: num(p["appearance.radius"]),
          color: str(p["typography.color"]),
          fontSize: num(p["typography.fontSize"]),
          fontWeight: num(p["typography.fontWeight"]),
          whiteSpace: "nowrap",
        }}
      >
        {str(p["content.label"])}
      </div>
    );
  }
  const border = num(p["appearance.border.width"]);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: p["layout.flexDirection"] === "row" ? "row" : "column",
        flexWrap: p["layout.flexWrap"] === "wrap" ? "wrap" : "nowrap",
        gap: num(p["layout.gap"]),
        padding: `${num(p["layout.paddingTop"]) ?? 0}px ${num(p["layout.paddingRight"]) ?? 0}px ${num(p["layout.paddingBottom"]) ?? 0}px ${num(p["layout.paddingLeft"]) ?? 0}px`,
        alignItems: ALIGN[String(p["layout.alignItems"])],
        justifyContent: ALIGN[String(p["layout.justifyContent"])],
        width,
        maxWidth: num(p["layout.maxWidth"]),
        minWidth: num(p["layout.minWidth"]),
        flex: p["layout.flexGrow"] ? "1 1 0" : undefined,
        height: num(p["frame.height"]),
        background: str(p["appearance.background.color"]),
        border: border ? `${border}px solid ${str(p["appearance.border.color"])}` : undefined,
        borderRadius: num(p["appearance.radius"]),
        boxSizing: "border-box",
      }}
    >
      {node.children.map((c, i) => (
        <DrawNode key={i} node={c} />
      ))}
    </div>
  );
};

/** A live, scaled drawing of a section template, built from the same data the engine inserts (no images). */
export const SectionThumb: React.FC<{ template: SectionTemplate }> = ({ template }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.1);
  const [height, setHeight] = useState(0);
  const nodes = useMemo(() => template.build(template.copy), [template]);
  const bg = template.band.bg ? (BRAND_DEFAULTS[template.band.bg].light as string) : "transparent";

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const band = bandRef.current;
    if (!frame || !band) return;
    const measure = () => {
      const k = frame.clientWidth / DRAW_WIDTH;
      setScale(k);
      setHeight(Math.min(band.offsetHeight * k, frame.clientWidth * MAX_ASPECT));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [nodes]);

  return (
    <div ref={frameRef} aria-hidden="true" className="ll:relative ll:w-full ll:overflow-hidden ll:bg-surface-raised" style={{ height }}>
      <div
        ref={bandRef}
        style={{
          width: DRAW_WIDTH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background: bg,
          padding: `${template.band.padY}px 24px`,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pointerEvents: "none",
          fontFamily: "var(--ll-font-sans)",
        }}
      >
        {nodes.map((n, i) => (
          <DrawNode key={i} node={n} />
        ))}
      </div>
    </div>
  );
};
