/**
 * Phase 71: Onion skin domain logic and sampling engine.
 *
 * Provides deterministic sampling of past and future ghost frames from the
 * canonical evaluate() kernel, opacity falloff computation, boundary suppression,
 * and coordinate translation matching Stage.tsx and TransformOverlay.tsx.
 */

import type { MotionDocument } from "@/core/document/schema";
import { evaluate } from "@/core/kernel/evaluate";
import {
  type OnionSkinConfig,
  DEFAULT_ONION_SKIN_CONFIG,
  calculateGhostOpacity,
  normalizeOnionSkinConfig,
} from "./onionSkinModel";

export {
  type OnionSkinConfig,
  DEFAULT_ONION_SKIN_CONFIG,
  calculateGhostOpacity,
  normalizeOnionSkinConfig,
};

export interface GhostSample {
  time: number;
  frameOffset: number; // e.g. -2, -1, +1, +2, +3
  direction: "before" | "after";
  opacity: number;
  canvasX: number;
  canvasY: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  layerOpacity: number;
}

export interface SampleGhostOptions {
  doc: MotionDocument;
  compositionId: string;
  layerId: string;
  currentTime: number;
  fps: number;
  duration: number;
  config: OnionSkinConfig;
  parentOrigin?: { ox: number; oy: number };
}

/**
 * Samples ghost frames for a layer using the deterministic evaluation kernel.
 * Automatically suppresses invalid boundary samples (outside composition bounds or layer active range).
 */
export function sampleLayerGhosts(options: SampleGhostOptions): GhostSample[] {
  const { doc, compositionId, layerId, currentTime, fps, duration, config, parentOrigin } = options;

  if (!config.enabled) return [];
  const comp = doc.compositions[compositionId];
  if (!comp) return [];

  const layer = doc.layers[layerId];
  if (!layer) return [];

  const compLayer = comp.layers[layerId];
  const layerIn = compLayer?.in ?? 0;
  const layerOut = compLayer?.out ?? duration;

  const ox = parentOrigin?.ox ?? 0;
  const oy = parentOrigin?.oy ?? 0;

  const validFps = Math.max(1, fps || 60);
  const frameDuration = (config.step || 1) / validFps;

  const ghosts: GhostSample[] = [];

  // 1. Sample "before" (past) ghost frames: k = framesBefore down to 1 (rendered back-to-front)
  for (let k = config.framesBefore; k >= 1; k--) {
    const sampleTime = currentTime - k * frameDuration;
    // Suppress samples falling strictly outside composition bounds or layer active interval
    if (sampleTime < 0 || sampleTime < layerIn || sampleTime > layerOut || sampleTime > duration) {
      continue;
    }

    const evaluated = evaluate(doc, compositionId, layerId, sampleTime);
    const frameX = Number(evaluated["frame.x"] ?? layer.properties["frame.x"] ?? 0);
    const frameY = Number(evaluated["frame.y"] ?? layer.properties["frame.y"] ?? 0);
    const transformX = Number(evaluated["transform.x"] ?? 0);
    const transformY = Number(evaluated["transform.y"] ?? 0);
    const rotation = Number(evaluated["frame.rotation"] ?? 0) + Number(evaluated["transform.rotate"] ?? 0);
    const scaleX = Number(evaluated["transform.scaleX"] ?? 1);
    const scaleY = Number(evaluated["transform.scaleY"] ?? 1);
    const layerOpacity = Number(evaluated["appearance.opacity"] ?? 1);
    const width = Number(evaluated["frame.width"] ?? layer.properties["frame.width"] ?? 100);
    const height = Number(evaluated["frame.height"] ?? layer.properties["frame.height"] ?? 100);

    const ghostOpacity = calculateGhostOpacity(k, config.framesBefore, config.baseOpacity);

    ghosts.push({
      time: sampleTime,
      frameOffset: -k * config.step,
      direction: "before",
      opacity: ghostOpacity,
      canvasX: frameX + ox + transformX,
      canvasY: frameY + oy + transformY,
      width,
      height,
      rotation,
      scaleX,
      scaleY,
      layerOpacity,
    });
  }

  // 2. Sample "after" (future) ghost frames: k = 1 up to framesAfter
  for (let k = 1; k <= config.framesAfter; k++) {
    const sampleTime = currentTime + k * frameDuration;
    // Suppress samples falling strictly outside composition bounds or layer active interval
    if (sampleTime < 0 || sampleTime < layerIn || sampleTime > layerOut || sampleTime > duration) {
      continue;
    }

    const evaluated = evaluate(doc, compositionId, layerId, sampleTime);
    const frameX = Number(evaluated["frame.x"] ?? layer.properties["frame.x"] ?? 0);
    const frameY = Number(evaluated["frame.y"] ?? layer.properties["frame.y"] ?? 0);
    const transformX = Number(evaluated["transform.x"] ?? 0);
    const transformY = Number(evaluated["transform.y"] ?? 0);
    const rotation = Number(evaluated["frame.rotation"] ?? 0) + Number(evaluated["transform.rotate"] ?? 0);
    const scaleX = Number(evaluated["transform.scaleX"] ?? 1);
    const scaleY = Number(evaluated["transform.scaleY"] ?? 1);
    const layerOpacity = Number(evaluated["appearance.opacity"] ?? 1);
    const width = Number(evaluated["frame.width"] ?? layer.properties["frame.width"] ?? 100);
    const height = Number(evaluated["frame.height"] ?? layer.properties["frame.height"] ?? 100);

    const ghostOpacity = calculateGhostOpacity(k, config.framesAfter, config.baseOpacity);

    ghosts.push({
      time: sampleTime,
      frameOffset: k * config.step,
      direction: "after",
      opacity: ghostOpacity,
      canvasX: frameX + ox + transformX,
      canvasY: frameY + oy + transformY,
      width,
      height,
      rotation,
      scaleX,
      scaleY,
      layerOpacity,
    });
  }

  return ghosts;
}
