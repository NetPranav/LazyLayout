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
  const w = g.frame.width > 0 ? g.frame.width : 100;
  const h = g.frame.height > 0 ? g.frame.height : 100;

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
        positions.push(q.position);
        repeats.push("no-repeat");
        blends.push(paintBlendCss(p));
      }
      continue;
    }
    const css = paintCss(p, w, h, urlOf);
    if (!css) continue;
    images.push(css);
    const l = p.type === "image" ? imageLayout(p) : { size: "auto", position: "0 0", repeat: "no-repeat" };
    sizes.push(l.size);
    positions.push(l.position);
    repeats.push(l.repeat);
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
