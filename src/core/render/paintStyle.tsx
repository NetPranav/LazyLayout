import React from "react";
import type { CSSProperties } from "react";
import type { Layer } from "../document/schema";
import { getLayerGeometry } from "../document/properties";
import { diamondCss, effectiveFills, fillLayers, hasAdjustFilter, imageFilterCss, imageLayout, paintBlendCss, paintCss, parseFills, type ImagePaint } from "../paint/paints";
import { AdjustFilter } from "./shapePaint";
import { useAssetUrlMap } from "../assets/useAssetUrl";
import type { ResolvedProps } from "./types";

/** The data attribute the filtered-image layer carries (the render gallery and the tests look for it). */
export const FILL_LAYER_ATTR = "data-fill-layer";

/**
 * The background of an HTML layer (Phase 35, 37). With no `paint.fills` it is the layer's plain colour, exactly as
 * before. With them, the fills stack as background images (first on top) and the plain colour steps aside. A picture
 * whose colours are changed (brightness, contrast, saturation) can't be a background image, so it is drawn by a
 * `<span>` of its own behind the layer's content, and `isolate` says the layer must make its own stacking context.
 */
export function useFillStyle(layer: Layer, resolved: ResolvedProps, plainColor: string): { style: CSSProperties; overlay: React.ReactNode } {
  const fills = parseFills(resolved.get("paint.fills"));
  const list = fills === null ? [] : effectiveFills(resolved.get("paint.fills"), undefined);
  const urlOf = useAssetUrlMap(list.filter((p): p is ImagePaint => p.type === "image").map((p) => p.src));
  if (fills === null) return { style: { backgroundColor: plainColor }, overlay: null };
  const g = getLayerGeometry(layer);
  const { layers, filtered } = fillLayers(list, g.frame.width, g.frame.height, urlOf);
  const style: CSSProperties = {
    backgroundColor: "transparent",
    ...(layers ? { backgroundImage: layers.image, backgroundSize: layers.size, backgroundPosition: layers.position, backgroundRepeat: layers.repeat } : {}),
    ...(layers?.blend ? { backgroundBlendMode: layers.blend } : {}),
    ...(filtered.length ? { isolation: "isolate" as const } : {}),
  };
  const overlay =
    filtered.length === 0 ? null : (
      <>
        {filtered.map((p, i) => {
          const url = urlOf(p.src);
          if (!url) return null;
          const l = imageLayout(p);
          const adjustId = `${layer.id.replace(/[^A-Za-z0-9_-]/g, "_")}__adjust${i}`;
          const blend = paintBlendCss(p);
          return (
            <React.Fragment key={i}>
            {hasAdjustFilter(p) && (
              <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
                <defs><AdjustFilter id={adjustId} adjust={p.adjust!} /></defs>
              </svg>
            )}
            <span
              {...{ [FILL_LAYER_ATTR]: "image" }}
              aria-hidden="true"
              style={{
                position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none", borderRadius: "inherit",
                backgroundImage: paintCss(p, g.frame.width, g.frame.height, urlOf) ?? undefined, backgroundSize: l.size, backgroundPosition: l.position, backgroundRepeat: l.repeat,
                filter: imageFilterCss(p, adjustId), opacity: p.opacity, ...(blend !== "normal" ? { mixBlendMode: blend as CSSProperties["mixBlendMode"] } : {}),
              }}
            />
            </React.Fragment>
          );
        })}
      </>
    );
  return { style, overlay };
}

/**
 * Fills applied to text glyphs (Phase 35/37 Task A). When a text layer carries a non-solid fill (image or gradient),
 * the letters are filled with it: background-image + background-clip: text + -webkit-text-fill-color: transparent.
 * Solid fills keep working through typography.color (undefined returned here).
 */
export function useTextFillStyle(layer: Layer, resolved: ResolvedProps): CSSProperties | undefined {
  const fills = parseFills(resolved.get("paint.fills"));
  const imageSources = fills ? fills.filter((p): p is ImagePaint => p.type === "image").map((p) => p.src) : [];
  const urlOf = useAssetUrlMap(imageSources);

  if (!fills || fills.length === 0) return undefined;
  const hasNonSolid = fills.some((p) => p.visible && p.type !== "solid");
  if (!hasNonSolid) return undefined;

  const g = getLayerGeometry(layer);
  // A text that sizes itself has no width stored: estimate the box from its words and size rather than a fixed
  // 100px square, so a gradient's angle and stops land across the actual text.
  const estimate = () => {
    const raw = resolved.get("content.text");
    const lines = (typeof raw === "string" ? raw : layer.name).split("\n");
    const size = resolved.num("typography.fontSize", 16);
    const longest = Math.max(1, ...lines.map((l) => l.length));
    return { w: longest * size * 0.55, h: lines.length * size * resolved.num("typography.lineHeight", 1.2) };
  };
  const sized = g.frame.width > 0 && g.frame.height > 0 ? null : estimate();
  let w = g.frame.width > 0 ? g.frame.width : sized!.w;
  let h = g.frame.height > 0 ? g.frame.height : sized!.h;
  // A split letter carries its word's box: the fill is laid out on the word and this letter shows its own part of it.
  const fillBox = String(resolved.get("paint.fillBox") ?? "").split(",").map(Number);
  const shared = fillBox.length === 4 && fillBox.every(Number.isFinite) && fillBox[2] > 0 && fillBox[3] > 0;
  if (shared) {
    w = fillBox[2];
    h = fillBox[3];
  }
  const offset = shared ? `${-fillBox[0]}px ${-fillBox[1]}px` : null;

  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  const repeats: string[] = [];
  const blends: string[] = [];

  for (const p of fills) {
    if (!p.visible) continue;
    if (p.type === "diamond") {
      for (const q of diamondCss(p, w, h)) {
        images.push(q.image);
        sizes.push(q.size);
        const [qx, qy] = q.position.split(/\s+/).map((v) => parseFloat(v) || 0);
        positions.push(shared ? `${qx - fillBox[0]}px ${qy - fillBox[1]}px` : q.position);
        repeats.push("no-repeat");
        blends.push(paintBlendCss(p));
      }
      continue;
    }
    const css = paintCss(p, w, h, urlOf);
    if (!css) continue;
    images.push(css);
    const l = p.type === "image" ? imageLayout(p) : { size: "auto", position: "0 0", repeat: "no-repeat" };
    // laid out on the word's box: the picture or gradient is the word's size, moved so this letter shows its part
    sizes.push(shared ? `${w}px ${h}px` : l.size);
    positions.push(offset ?? l.position);
    repeats.push(shared ? "no-repeat" : l.repeat);
    blends.push(paintBlendCss(p));
  }

  if (images.length === 0) return undefined;
  const blend = blends.some((b) => b !== "normal") ? blends.join(", ") : undefined;

  return {
    backgroundImage: images.join(", "),
    backgroundSize: sizes.join(", "),
    backgroundPosition: positions.join(", "),
    backgroundRepeat: repeats.join(", "),
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
    ...(blend ? { backgroundBlendMode: blend } : {}),
  };
}
