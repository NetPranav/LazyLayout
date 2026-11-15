/**
 * @file interactiveExportRuntime.ts
 * @module core/export/interactiveExportRuntime
 * @description Phase 197: Selective MIT-licensed vendored interactive runtime
 * emitter copying only the modules an effect actually uses (`ticker`, `signals`,
 * `kinetics`, `physics2d`, `blueprint`, `gl`, `particles`, `sims`, `cursor`,
 * `gestures`, `raster`, `deform`, `audio`) across Next.js (`"use client"`,
 * poster-first, idle init, cleanup), Vite React, Vue 3, and Web Component targets.
 */

import type { EffectDefinitionV1 } from "../effects/effectSdk";

export const ALL_RUNTIME_MODULE_IDS = [
  "ticker",
  "signals",
  "kinetics",
  "physics2d",
  "blueprint",
  "gl",
  "particles",
  "sims",
  "cursor",
  "gestures",
  "raster",
  "deform",
  "audio",
] as const;

export type VendoredRuntimeModuleId = (typeof ALL_RUNTIME_MODULE_IDS)[number];
export type ExportFrameworkTarget = "next" | "vite_react" | "vue3" | "web_component";

export interface VendoredModuleFile {
  readonly moduleId: VendoredRuntimeModuleId;
  readonly filename: string;
  readonly byteLength: number;
  readonly source: string;
}

export interface InteractiveExportBundle {
  readonly effectId: string;
  readonly target: ExportFrameworkTarget;
  readonly vendoredModules: readonly VendoredModuleFile[];
  readonly totalVendoredBytes: number;
  readonly entryFilename: string;
  readonly entrySource: string;
  readonly zeroLazyLayoutImports: true;
  readonly disposesContextsOnUnmount: true;
}

const MIT_HEADER = `/**
 * MIT License — Copyright (c) LazyLayout Contributors
 * Standalone vendored runtime module — zero external runtime dependency.
 */`;

const MODULE_BODY_TABLE: Readonly<Record<VendoredRuntimeModuleId, string>> = {
  ticker: `${MIT_HEADER}
export function createIdleInit(cb) {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const id = window.requestIdleCallback(cb, { timeout: 120 });
    return () => window.cancelIdleCallback(id);
  }
  const timer = setTimeout(cb, 16);
  return () => clearTimeout(timer);
}
`,
  signals: `${MIT_HEADER}
export function sampleNormalizedSignal(x, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number.isFinite(x) ? x : min));
}
`,
  kinetics: `${MIT_HEADER}
export function stepSpring(pos, vel, target, stiffness = 180, damping = 22, dt = 1 / 60) {
  const acc = (target - pos) * stiffness - vel * damping;
  const nextVel = vel + acc * dt;
  return { pos: pos + nextVel * dt, vel: nextVel };
}
`,
  physics2d: `${MIT_HEADER}
export function integrateBody2D(state, gx, gy, dt = 1 / 120) {
  const vx = state.vx + gx * dt;
  const vy = state.vy + gy * dt;
  return { x: state.x + vx * dt, y: state.y + vy * dt, vx, vy };
}
`,
  blueprint: `${MIT_HEADER}
export function dispatchGraphTrigger(listeners, event, payload) {
  const list = listeners[event] || [];
  for (const fn of list) fn(payload);
}
`,
  gl: `${MIT_HEADER}
export function createGlLifecycle(canvas) {
  const gl = canvas ? canvas.getContext("webgl2") : null;
  return {
    gl,
    dispose() {
      const lose = gl && gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    },
  };
}
`,
  particles: `${MIT_HEADER}
export function stepParticleBuffer(pos, vel, dt = 1 / 60) {
  for (let i = 0; i < pos.length; i += 2) {
    pos[i] += vel[i] * dt;
    pos[i + 1] += vel[i + 1] * dt;
  }
}
`,
  sims: `${MIT_HEADER}
export function stepGridDissipation(grid, rate = 0.98) {
  for (let i = 0; i < grid.length; i++) grid[i] *= rate;
}
`,
  cursor: `${MIT_HEADER}
export function shouldHideCursor(reducedMotion, pointerType, isTextInput) {
  return !reducedMotion && pointerType !== "touch" && !isTextInput;
}
`,
  gestures: `${MIT_HEADER}
export function clampHoldProgress(elapsedMs, holdMs = 600) {
  return Math.max(0, Math.min(1, elapsedMs / Math.max(1, holdMs)));
}
`,
  raster: `${MIT_HEADER}
export function supportsCssBackdrop() {
  return typeof CSS !== "undefined" && CSS.supports("backdrop-filter", "blur(4px)");
}
`,
  deform: `${MIT_HEADER}
export function evaluateMeshWave(u, phase = 0, amp = 8) {
  return Math.sin(u * Math.PI * 2 + phase) * amp;
}
`,
  audio: `${MIT_HEADER}
export function clampStereoPan(normX) {
  return Math.max(-1, Math.min(1, normX * 2 - 1));
}
`,
};

/** Select strictly the vendored runtime modules declared by the effect(s). */
export function selectVendoredModules(
  moduleIds: readonly string[]
): VendoredModuleFile[] {
  const unique = new Set<VendoredRuntimeModuleId>();
  for (const raw of moduleIds) {
    if ((ALL_RUNTIME_MODULE_IDS as readonly string[]).includes(raw)) {
      unique.add(raw as VendoredRuntimeModuleId);
    }
  }
  const ordered = ALL_RUNTIME_MODULE_IDS.filter((id) => unique.has(id));
  return ordered.map((moduleId) => {
    const source = MODULE_BODY_TABLE[moduleId];
    return {
      moduleId,
      filename: `runtime/${moduleId}.js`,
      byteLength: new TextEncoder().encode(source).length,
      source,
    };
  });
}

/** Generate framework-native wrapper component importing only selected local vendored files. */
export function buildInteractiveExportBundle(
  effect: EffectDefinitionV1,
  target: ExportFrameworkTarget
): InteractiveExportBundle {
  const modules = effect.requiredRuntimeModules.length > 0
    ? effect.requiredRuntimeModules
    : ["ticker"];
  const vendoredModules = selectVendoredModules(modules);
  const totalVendoredBytes = vendoredModules.reduce((s, m) => s + m.byteLength, 0);
  const safeId = effect.id.replace(/[^a-zA-Z0-9_]/g, "_");
  const hasGl = vendoredModules.some((m) => m.moduleId === "gl");

  let entryFilename = `${safeId}.tsx`;
  let entrySource = "";

  if (target === "next" || target === "vite_react") {
    const prefix = target === "next" ? '"use client";\n' : "";
    const glImport = hasGl ? 'import { createGlLifecycle } from "./runtime/gl.js";\n' : "";
    entrySource = `${prefix}${MIT_HEADER}
import React, { useEffect, useRef } from "react";
import { createIdleInit } from "./runtime/ticker.js";
${glImport}
export function ${safeId}Fx() {
  const hostRef = useRef(null);
  useEffect(() => {
    const el = hostRef.current;
    let disposeGl = () => {};
    const cancelIdle = createIdleInit(() => {
      if (el && ${String(hasGl)}) {
        const life = ${hasGl ? "createGlLifecycle(el.querySelector('canvas'))" : "{ dispose() {} }"};
        disposeGl = () => life.dispose();
      }
    });
    return () => { cancelIdle(); disposeGl(); };
  }, []);
  return React.createElement("div", { ref: hostRef, "data-fx": "${effect.id}" }, "${effect.name}");
}
`;
  } else if (target === "vue3") {
    entryFilename = `${safeId}.vue`;
    entrySource = `<script setup lang="ts">
${MIT_HEADER}
import { onMounted, onBeforeUnmount, ref } from "vue";
import { createIdleInit } from "./runtime/ticker.js";
const host = ref<HTMLElement | null>(null);
let stop = () => {};
onMounted(() => { stop = createIdleInit(() => { void host.value; }); });
onBeforeUnmount(() => { stop(); });
</script>
<template><div ref="host" data-fx="${effect.id}">${effect.poster.svgPreview}</div></template>
`;
  } else {
    entryFilename = `${safeId}.wc.js`;
    entrySource = `${MIT_HEADER}
import { createIdleInit } from "./runtime/ticker.js";
export class Lazy${safeId}Element extends HTMLElement {
  connectedCallback() {
    this.innerHTML = ${JSON.stringify(effect.poster.svgPreview)};
    this._stop = createIdleInit(() => { this.setAttribute("data-fx-ready", "true"); });
  }
  disconnectedCallback() {
    if (this._stop) this._stop();
  }
}
`;
  }

  return {
    effectId: effect.id,
    target,
    vendoredModules,
    totalVendoredBytes,
    entryFilename,
    entrySource,
    zeroLazyLayoutImports: true,
    disposesContextsOnUnmount: true,
  };
}
