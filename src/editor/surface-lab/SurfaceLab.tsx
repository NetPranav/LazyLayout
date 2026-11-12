"use client";

import React, { useEffect, useMemo } from "react";
import { RenderLayer } from "@/core/render";
import { frameScheduler } from "@/core/time/scheduler";
import { referenceScene } from "./scene";

/**
 * The reference scene at 720 × 720 in Preview mode (presses dent the surface). The comparison harness steps time
 * itself through `window.__LL_SURFACE_LAB__`, so every recorded frame is exactly 1/fps after the last.
 */
export function SurfaceLab({ overrides }: { overrides: Record<string, string | number> }) {
  const layers = useMemo(() => referenceScene(overrides), [overrides]);
  useEffect(() => {
    const w = window as unknown as { __LL_SURFACE_LAB__?: { deterministic: (on: boolean) => void; step: (dt: number) => void } };
    w.__LL_SURFACE_LAB__ = { deterministic: (on) => frameScheduler.setDeterministic(on), step: (dt) => void frameScheduler.step(dt) };
    return () => {
      delete w.__LL_SURFACE_LAB__;
    };
  }, []);
  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", margin: 0 }}>
      <div data-testid="surface-lab" style={{ position: "relative", width: 720, height: 720, overflow: "hidden" }}>
        <RenderLayer layerId="root" layers={layers} ctx={{ mode: "preview", layers, frameAtOrigin: true }} root />
      </div>
    </div>
  );
}
