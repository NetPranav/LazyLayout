"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { RenderLayer } from "@/core/render";
import type { Layer } from "@/core/document/schema";
import { compositor } from "@/core/gpu/compositor";

/** A test scene: a canvas that, when the compositor gives it a context, clears to its colour and draws a triangle. */
function TestScene({ index }: { index: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const posterRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const hue = (index * 47) % 360;
    const rgb = [Math.abs(Math.sin(hue)), Math.abs(Math.cos(hue)), 0.5];
    const slot = compositor.registerScene(canvas, {
      onReady: (gl) => {
        canvas.dataset.ready = String(Number(canvas.dataset.ready ?? "0") + 1);
        canvas.style.visibility = "visible";
        if (posterRef.current) posterRef.current.style.display = "none";
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(rgb[0], rgb[1], rgb[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      },
      onRelease: (poster) => {
        const shown = posterRef.current;
        if (poster && shown) {
          shown.width = poster.width;
          shown.height = poster.height;
          shown.getContext("2d")?.drawImage(poster, 0, 0);
          shown.style.display = "block";
          canvas.style.visibility = "hidden";
        }
      },
    });
    const io = new IntersectionObserver((entries) => compositor.setVisible(slot, entries[entries.length - 1].isIntersecting));
    io.observe(canvas);
    return () => {
      io.disconnect();
      compositor.unregisterScene(slot);
    };
  }, [index]);
  return (
    <div style={{ position: "relative", width: 160, height: 100, margin: 6, display: "inline-block" }} data-test-scene={index}>
      <canvas ref={ref} width={160} height={100} style={{ position: "absolute", inset: 0 }} />
      <canvas ref={posterRef} data-poster="" style={{ position: "absolute", inset: 0, display: "none" }} />
    </div>
  );
}

function surfaceLayers(count: number): Record<string, Layer> {
  const layers: Record<string, Layer> = {};
  const children: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `s${i}`;
    children.push(id);
    layers[id] = {
      id,
      name: id,
      archetype: "container",
      parentId: "root",
      children: [],
      properties: { positioning: "absolute", "frame.x": 10 + (i % 5) * 140, "frame.y": 10 + Math.floor(i / 5) * 70, "frame.width": 120, "frame.height": 50, "appearance.radius": 12, "appearance.background.color": "#0b0b0b", "surface.mode": "inflated", "surface.method": "quick", "surface.depth": 14 },
    } as Layer;
  }
  layers.root = { id: "root", name: "Page", archetype: "container", parentId: null, children, properties: { "frame.width": 720, "frame.height": 300, "appearance.background.color": "#ffffff" } } as Layer;
  return layers;
}

export function GpuLab({ surfaces, scenes, budget }: { surfaces: number; scenes: number; budget: number }) {
  const layers = useMemo(() => surfaceLayers(surfaces), [surfaces]);
  useEffect(() => {
    compositor.sceneBudget = budget;
    const w = window as unknown as { __LL_GPU__?: unknown };
    w.__LL_GPU__ = {
      stats: () => compositor.stats(),
      loseShared: () => compositor.loseSharedForTest(),
      restoreShared: () => compositor.restoreSharedForTest(),
    };
    return () => {
      delete w.__LL_GPU__;
    };
  }, [budget]);
  return (
    <div data-testid="gpu-lab-scroll" style={{ background: "#fff", padding: 0, height: "100vh", overflowY: "auto" }}>
      <div data-testid="gpu-lab-surfaces" style={{ position: "relative", width: 720, height: 300 }}>
        <RenderLayer layerId="root" layers={layers} ctx={{ mode: "preview", layers, frameAtOrigin: true }} root />
      </div>
      <div data-testid="gpu-lab-scenes" style={{ width: 720 }}>
        {Array.from({ length: scenes }, (_, i) => (
          <TestScene key={i} index={i} />
        ))}
      </div>
      <div style={{ height: 3000 }} />
    </div>
  );
}
