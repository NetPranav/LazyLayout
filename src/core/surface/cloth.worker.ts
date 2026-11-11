/// <reference lib="webworker" />
/**
 * Surfaces (S4b): the cloth simulation, off the main thread (it takes a second or more). Pure maths in, a height field
 * out (transferred, not copied).
 */
import { clothSurface, type ClothSettings } from "./cloth";
import { shapeDistance, type SurfaceShape } from "./field";

export interface ClothJob {
  id: number;
  shape: SurfaceShape;
  depth: number;
  cloth: ClothSettings;
  cell: number;
}

self.onmessage = (e: MessageEvent<ClothJob>) => {
  const job = e.data;
  const { height, w, h } = clothSurface({
    width: job.shape.width,
    height: job.shape.height,
    inside: (x, y) => shapeDistance(job.shape, x, y) > 0,
    depth: job.depth,
    cloth: job.cloth,
    cell: job.cell,
  });
  (self as unknown as Worker).postMessage({ id: job.id, height, w, h }, [height.buffer]);
};
