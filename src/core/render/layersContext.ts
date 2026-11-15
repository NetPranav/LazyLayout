import { createContext, useContext, type ReactNode } from "react";
import type { Layer } from "../document/schema";
import type { RenderContext } from "./types";

/**
 * The layers being drawn, for a paint that needs another layer (a fill masked by a sibling's outline, Phase 113).
 * Provided by `RenderLayer`, so the stage and the export see the same layers.
 */
export const LayersContext = createContext<Readonly<Record<string, Layer>> | null>(null);
export const useRenderLayers = (): Readonly<Record<string, Layer>> | null => useContext(LayersContext);

/**
 * Draws a layer (and what is under it) from a given set of layers, for a live fill (Phase 116). Provided by
 * `RenderLayer`, so paints can draw layers without importing the renderer (which imports the paints). `inside` lists
 * the live fills being drawn around this one, so a fill whose source contains it is refused instead of recursing.
 */
export interface SubtreeRenderer {
  draw: (layerId: string, layers: Record<string, Layer>, ctx: RenderContext) => ReactNode;
  ctx: RenderContext;
  inside: readonly string[];
}
export const SubtreeContext = createContext<SubtreeRenderer | null>(null);
export const useSubtreeRenderer = (): SubtreeRenderer | null => useContext(SubtreeContext);
