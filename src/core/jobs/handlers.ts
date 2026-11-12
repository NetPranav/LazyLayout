/**
 * ROADMAP_3D 3D-006: what the job workers can do, by kind. Pure functions of their payload: a handler gets the payload and
 * a `progress` callback and returns its result (typed arrays are transferred back, not copied). New heavy work (meshes,
 * simulation, baking) registers a handler here.
 */
import { clothSurface, type ClothSettings } from "../surface/cloth";
import { shapeDistance, type SurfaceShape } from "../surface/field";
import { evaluateModifiersWorker } from "../3d/modifiers/stack";
import type { MeshData } from "../3d/modifiers/types";
import type { Modifier3d } from "../document/schema";

export interface HandlerContext {
  progress: (progress: number) => void;
}
export interface HandlerResult {
  result: unknown;
  /** Buffers of `result` to transfer back. */
  transfer?: Transferable[];
}
export type Handler = (payload: never, ctx: HandlerContext) => HandlerResult;

export interface ClothPayload {
  shape: SurfaceShape;
  depth: number;
  cloth: ClothSettings;
  cell: number;
}

export interface ModifiersEvalPayload {
  mesh: MeshData;
  modifiers?: Modifier3d[];
  viewport?: boolean;
}

export const handlers: Record<string, Handler> = {
  cloth: ((payload: ClothPayload, ctx: HandlerContext): HandlerResult => {
    const { height, w, h } = clothSurface({
      width: payload.shape.width,
      height: payload.shape.height,
      inside: (x, y) => shapeDistance(payload.shape, x, y) > 0,
      depth: payload.depth,
      cloth: payload.cloth,
      cell: payload.cell,
      onProgress: ctx.progress,
    });
    return { result: { height, w, h }, transfer: [height.buffer] };
  }) as Handler,

  "modifiers.eval": ((payload: ModifiersEvalPayload, _ctx: HandlerContext): HandlerResult => {
    const raw = payload.mesh;
    const mesh: MeshData = {
      positions: raw.positions instanceof Float32Array ? raw.positions : new Float32Array(raw.positions),
      indices: raw.indices instanceof Uint32Array ? raw.indices : new Uint32Array(raw.indices),
      uvs: raw.uvs ? (raw.uvs instanceof Float32Array ? raw.uvs : new Float32Array(raw.uvs)) : undefined,
      normals: raw.normals ? (raw.normals instanceof Float32Array ? raw.normals : new Float32Array(raw.normals)) : undefined,
    };
    const result = evaluateModifiersWorker(mesh, payload.modifiers, payload.viewport);
    const transfer: Transferable[] = [result.positions.buffer, result.indices.buffer];
    if (result.uvs) transfer.push(result.uvs.buffer);
    if (result.normals) transfer.push(result.normals.buffer);
    return { result, transfer };
  }) as Handler,

  /** A busy loop for `ms`, reporting progress (tests: the main thread must stay free, and cancel must be prompt). */
  "test.burn": ((payload: { ms: number }, ctx: HandlerContext): HandlerResult => {
    const end = performance.now() + payload.ms;
    let n = 0;
    for (let now = performance.now(); now < end; now = performance.now()) {
      n++;
      if (n % 20000 === 0) ctx.progress(1 - (end - now) / payload.ms);
    }
    return { result: { spun: payload.ms } };
  }) as Handler,
};
