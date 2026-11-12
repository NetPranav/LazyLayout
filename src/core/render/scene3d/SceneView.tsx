"use client";

/**
 * ============================================================================
 * 3D SCENE VIEW COMPONENT (Phase 3D-012)
 * ============================================================================
 * Renders a document 3D scene inside a canvas-backed layer:
 *   - Registers with `compositor.registerScene(canvas, { onReady, onRelease })`.
 *   - Reports visibility through IntersectionObserver.
 *   - Manages Three.js WebGLRenderer lifecycle (created onReady, disposed onRelease).
 *   - Displays 2D poster canvas during sleep / context loss.
 *   - Renders deterministically via `frameScheduler` ONLY when state changes
 *     (document version, camera, shading settings, dimensions). Off screen it costs 0 frames.
 * ============================================================================
 */

import React, { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import type { Layer } from "../../document/schema";
import type { ResolvedProps, RenderContext } from "../types";
import { compositor } from "../../gpu/compositor";
import { frameScheduler } from "../../time/scheduler";
import { documentStore, getDocument } from "../../store/useDocumentStore";
import { transportStore } from "../../time/transport";
import { evaluate3D } from "../../kernel/evaluate3d";
import { useViewportStore } from "./viewportStore";
import { buildScene, applyEvaluated, type BuiltScene } from "./buildScene";
import { applyShading } from "./shading";
import { applyOverlays } from "./overlays";
import { cameraPosition } from "../../3d/camera/viewCamera";

export interface SceneViewProps {
  layer: Layer;
  resolved: ResolvedProps;
  ctx: RenderContext;
  sceneId: string;
  width: number;
  height: number;
}

export const SceneView: React.FC<SceneViewProps> = ({
  sceneId,
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const posterRef = useRef<HTMLCanvasElement | null>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const builtSceneRef = useRef<BuiltScene | null>(null);
  const isAwakeRef = useRef<boolean>(false);
  const renderScheduledRef = useRef<boolean>(false);
  const unregisterTaskRef = useRef<(() => void) | null>(null);

  const currentSizeRef = useRef<{ width: number; height: number }>({ width, height });
  useEffect(() => {
    currentSizeRef.current = { width, height };
  }, [width, height]);

  const sceneIdRef = useRef<string>(sceneId);
  useEffect(() => {
    sceneIdRef.current = sceneId;
  }, [sceneId]);

  // Single render execution
  const renderNow = useCallback(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas || !isAwakeRef.current) return;

    const doc = getDocument();
    const curSceneId = sceneIdRef.current;
    if (!curSceneId || !doc.scenes?.[curSceneId]) return;

    // 1. Build or retrieve scene
    let built = builtSceneRef.current;
    if (!built) {
      built = buildScene(doc, curSceneId);
      builtSceneRef.current = built;
    }

    // 2. Evaluate animated state and apply
    const time = transportStore.getState().time;
    const evaluated = evaluate3D(doc, time);
    applyEvaluated(built, evaluated);

    // 3. Camera alignment: viewport camera during editing, active scene camera otherwise
    const vpState = useViewportStore.getState();
    const isEditingThisScene = vpState.editingSceneId === curSceneId;

    const activeCam: THREE.PerspectiveCamera = built.camera;
    const { width: curW, height: curH } = currentSizeRef.current;
    const aspect = Math.max(0.001, curW / Math.max(1, curH));

    if (isEditingThisScene) {
      const storeCam = vpState.camera;
      const pos = cameraPosition(storeCam);
      activeCam.position.set(pos[0], pos[1], pos[2]);
      activeCam.lookAt(storeCam.target[0], storeCam.target[1], storeCam.target[2]);
      activeCam.fov = (storeCam.fovY * 180) / Math.PI; // the store keeps radians, three wants degrees
      activeCam.near = storeCam.near;
      activeCam.far = storeCam.far;
      activeCam.aspect = aspect;
      activeCam.updateProjectionMatrix();
    } else {
      activeCam.aspect = aspect;
      activeCam.updateProjectionMatrix();
    }

    // 4. Shading modes and X-ray
    applyShading(built.threeScene, vpState.settings, renderer, activeCam);

    // 5. Overlays (grid, axes, origins, cursor, normals, wireframe on shaded, selection outline)
    applyOverlays(built.threeScene, vpState.settings, vpState.selection, vpState.cursor);

    // 6. Draw
    renderer.render(built.threeScene, activeCam);
  }, []);

  // Request a render through frameScheduler (deduplicated, 0 cost when idle)
  const scheduleRender = useCallback(() => {
    if (renderScheduledRef.current || !isAwakeRef.current) return;
    renderScheduledRef.current = true;

    const unregister = frameScheduler.register("render", () => {
      if (unregisterTaskId) unregisterTaskId();
      renderScheduledRef.current = false;
      renderNow();
    });
    const unregisterTaskId = unregister;
    unregisterTaskRef.current = unregister;
  }, [renderNow]);

  // Handle compositor registration and WebGL context lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    const poster = posterRef.current;
    if (!canvas) return;

    // Set canvas dimensions
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));

    const slot = compositor.registerScene(canvas, {
      onReady: (gl) => {
        isAwakeRef.current = true;
        if (poster) poster.style.display = "none";
        canvas.style.visibility = "visible";

        // Increment ready count for test assertions & compositor diagnostics
        canvas.dataset.ready = String(Number(canvas.dataset.ready ?? 0) + 1);

        // Create Three.js renderer bound to the compositor's WebGL2 context
        const renderer = new THREE.WebGLRenderer({
          canvas,
          context: gl,
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
        });
        renderer.setSize(canvas.width, canvas.height, false);
        renderer.setPixelRatio(1); // Canvas already sized to physical pixels
        rendererRef.current = renderer;

        // Invalidate cached scene on context restore/recreation
        if (builtSceneRef.current) {
          builtSceneRef.current.dispose();
          builtSceneRef.current = null;
        }

        scheduleRender();
      },
      onRelease: (posterCanvas) => {
        isAwakeRef.current = false;

        // Cancel any pending scheduled frame
        if (unregisterTaskRef.current) {
          unregisterTaskRef.current();
          unregisterTaskRef.current = null;
          renderScheduledRef.current = false;
        }

        // Show poster canvas if available
        if (poster && posterCanvas) {
          poster.width = posterCanvas.width;
          poster.height = posterCanvas.height;
          const ctx2d = poster.getContext("2d");
          if (ctx2d) {
            ctx2d.drawImage(posterCanvas, 0, 0);
          }
          poster.style.display = "block";
          canvas.style.visibility = "hidden";
        }

        if (rendererRef.current) {
          rendererRef.current.dispose();
          rendererRef.current = null;
        }
        if (builtSceneRef.current) {
          builtSceneRef.current.dispose();
          builtSceneRef.current = null;
        }
      },
    });

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        compositor.setVisible(slot, entry.isIntersecting);
      });
      io.observe(canvas);
    } else {
      compositor.setVisible(slot, true);
    }

    return () => {
      if (io) io.disconnect();
      if (unregisterTaskRef.current) {
        unregisterTaskRef.current();
        unregisterTaskRef.current = null;
        renderScheduledRef.current = false;
      }
      compositor.unregisterScene(slot);
      if (builtSceneRef.current) {
        builtSceneRef.current.dispose();
        builtSceneRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      isAwakeRef.current = false;
    };
  }, [width, height, scheduleRender]);

  // Resize canvas when width/height change
  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      renderer.setSize(pixelWidth, pixelHeight, false);
      scheduleRender();
    }
  }, [width, height, scheduleRender]);

  // Subscribe to document changes
  useEffect(() => {
    const unsubscribeDoc = documentStore.subscribe(() => {
      scheduleRender();
    });
    return () => unsubscribeDoc();
  }, [scheduleRender]);

  // Subscribe to transport scrubbing/playback
  useEffect(() => {
    const unsubscribeTransport = transportStore.subscribe(() => {
      scheduleRender();
    });
    return () => unsubscribeTransport();
  }, [scheduleRender]);

  // Subscribe to viewport store changes (camera orbit, shading mode, x-ray, editingSceneId)
  useEffect(() => {
    const unsubscribeViewport = useViewportStore.subscribe(() => {
      scheduleRender();
    });
    return () => unsubscribeViewport();
  }, [scheduleRender]);

  const editingSceneId = useViewportStore((s) => s.editingSceneId);
  const isEditingThisScene = Boolean(sceneId && editingSceneId === sceneId);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        data-scene-canvas=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
      <canvas
        ref={posterRef}
        data-poster=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "none",
        }}
      />
    </div>
  );
};

export default SceneView;
