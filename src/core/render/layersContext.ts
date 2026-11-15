import { createContext, useContext } from "react";
import type { Layer } from "../document/schema";

/**
 * The layers being drawn, for a paint that needs another layer (a fill masked by a sibling's outline, Phase 113).
 * Provided by `RenderLayer`, so the stage and the export see the same layers.
 */
export const LayersContext = createContext<Readonly<Record<string, Layer>> | null>(null);
export const useRenderLayers = (): Readonly<Record<string, Layer>> | null => useContext(LayersContext);
