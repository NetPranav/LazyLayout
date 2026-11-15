import React from "react";
import { layerBoxStyle, px } from "../geometry";
import { clampNumber, safeImageSrc } from "../limits";
import type { ArchetypeRenderProps } from "../types";
import { useAssetUrl } from "../../assets/useAssetUrl";
import { sequenceGrid, sequencePosition, sequenceSize } from "../sequence";
import { AdjustFilter } from "../shapePaint";
import { imageEditOf } from "../../paint/imageLook";

const FITS = new Set(["cover", "contain", "fill", "none", "scale-down"]);

/** An `image`. A source that isn't a safe image URL is not loaded; the alt text shows instead. */
export const Image: React.FC<ArchetypeRenderProps> = ({ layer, resolved, ctx, nodeRef }) => {
  const wanted = safeImageSrc(resolved.str("media.src", ""));
  const src = useAssetUrl(wanted); // an imported file loads from the asset store
  const alt = resolved.str("media.alt", layer.name);
  const fit = resolved.str("media.objectFit", "cover");
  const plainFilters = [
    `grayscale(${clampNumber(resolved.num("media.filter.grayscale", 0), 0, 1, 0)})`,
    `blur(${clampNumber(resolved.num("media.filter.blur", 0), 0, 100, 0)}px)`,
    `brightness(${clampNumber(resolved.num("media.filter.brightness", 1), 0, 5, 1)})`,
    `contrast(${clampNumber(resolved.num("media.filter.contrast", 1), 0, 5, 1)})`,
    `saturate(${clampNumber(resolved.num("media.filter.saturate", 1), 0, 5, 1)})`,
  ].join(" ");
  // Phase 122: the adjustments and look, as an SVG filter after the plain ones; "show original" draws the picture as it is
  const edit = imageEditOf(resolved.get("media.adjust"), resolved.get("media.look"));
  const filterId = `${layer.id.replace(/[^A-Za-z0-9_-]/g, "_")}__image`;
  const filters = edit.bypass ? "none" : edit.filtered ? `${plainFilters} url(#${filterId})` : plainFilters;
  const filterDefs = edit.filtered ? (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        <AdjustFilter id={filterId} adjust={edit.adjust} look={edit.look} />
      </defs>
    </svg>
  ) : null;
  const overlayOpacity = clampNumber(resolved.num("media.overlay.opacity", 0), 0, 1, 0);
  const box = layerBoxStyle(layer, resolved, ctx);
  // Design track D13: a sheet of frames is drawn as a background shifted to the frame, so the engine, a driver and the export all move it the same way
  const grid = sequenceGrid((p) => resolved.get(p));
  if (grid && src) {
    return (
      <div
        ref={nodeRef}
        role="img"
        aria-label={alt}
        data-element-id={ctx.inMeshTile ? undefined : layer.id}
        data-archetype={ctx.inMeshTile ? undefined : "image"}
        data-seq={`${grid.cols},${grid.rows},${grid.frames}`}
        style={{
          ...box,
          overflow: "hidden",
          borderRadius: px(resolved.num("appearance.radius", 0)),
          display: "inline-block",
          backgroundImage: `url("${src}")`,
          backgroundRepeat: "no-repeat",
          backgroundSize: sequenceSize(grid),
          backgroundPosition: sequencePosition(grid, resolved.num("sequence.frame", 0)),
          filter: filters,
        }}
      >
        {filterDefs}
      </div>
    );
  }
  return (
    <div
      ref={nodeRef}
      data-element-id={ctx.inMeshTile ? undefined : layer.id}
      data-archetype={ctx.inMeshTile ? undefined : "image"}
      style={{ ...box, overflow: "hidden", borderRadius: px(resolved.num("appearance.radius", 0)), display: "inline-block", lineHeight: 0 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: (FITS.has(fit) ? fit : "cover") as React.CSSProperties["objectFit"],
            objectPosition: resolved.str("media.objectPosition", "center"),
            filter: filters,
            display: "block",
          }}
        />
      ) : (
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", minHeight: 24, background: "#f1f5f9", color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>
          {alt}
        </span>
      )}
      {filterDefs}
      {overlayOpacity > 0 && (
        <span style={{ position: "absolute", inset: 0, backgroundColor: resolved.str("media.overlay.color", "#000000"), opacity: overlayOpacity }} />
      )}
    </div>
  );
};
