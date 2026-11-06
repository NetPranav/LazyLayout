"use client";

import React, { useMemo } from "react";
import { RenderLayer } from "@/core/render";
import type { Layer } from "@/core/document/schema";

/**
 * Draws one document layer through the engine's render definition for its archetype (the same drawing the exporter
 * and the old stage use), so a shape, a frame, a line or a star looks like its properties say.
 *
 * It is drawn at the top-left of the element box that wraps it (that box is already placed at the layer's x and y), and
 * without its children, which are stage elements of their own.
 */
export const EngineLayer: React.FC<{ layer: Layer; layers: Record<string, Layer> }> = ({ layer, layers }) => {
  const plan = useMemo(() => new Map<string, string[]>([[layer.id, []]]), [layer.id]);
  const placed = useMemo(
    () => ({ ...layers, [layer.id]: { ...layer, properties: { ...layer.properties, positioning: "absolute", "frame.x": 0, "frame.y": 0 } } }),
    [layers, layer],
  );
  return <RenderLayer layerId={layer.id} layers={placed} plan={plan} root />;
};
