"use client";

/**
 * ============================================================================
 * SCENE 3D LAYER ARCHETYPE (Phase 3D-012)
 * ============================================================================
 * The canvas-backed 3D layer archetype:
 *   - Box participates in standard page layout and responsive breakpoints.
 *   - Lazy-loads Three.js and the SceneView component via dynamic `import()`
 *     so pages without 3D pay nothing in bundle size.
 *   - Double-click enters 3D scene editing mode (`viewportStore.editingSceneId`).
 *   - Shows poster while asleep or off screen.
 * ============================================================================
 */

import React, { Suspense, lazy } from "react";
import { layerBoxStyle } from "../geometry";
import type { ArchetypeRenderProps } from "../types";
import { useViewportStore } from "../scene3d/viewportStore";

const LazySceneView = lazy(() => import("../scene3d/SceneView"));

export const Scene3dLayer: React.FC<ArchetypeRenderProps> = ({
  layer,
  resolved,
  ctx,
  nodeRef,
}) => {
  const box = layerBoxStyle(layer, resolved, ctx);
  const sceneId =
    resolved.str("scene", "") ||
    (typeof layer.properties.scene === "string" ? layer.properties.scene : "");

  const editingSceneId = useViewportStore((s) => s.editingSceneId);
  const isEditing = Boolean(sceneId && editingSceneId === sceneId);

  const width = Math.max(1, Math.round(Number(box.width) || resolved.num("frame.width", 480)));
  const height = Math.max(1, Math.round(Number(box.height) || resolved.num("frame.height", 320)));

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sceneId) {
      useViewportStore.getState().setEditingSceneId(sceneId);
    }
  };

  return (
    <div
      ref={nodeRef}
      data-element-id={ctx.inMeshTile ? undefined : layer.id}
      data-archetype={ctx.inMeshTile ? undefined : "scene3d"}
      data-scene-id={sceneId || undefined}
      data-editing-3d={isEditing ? "true" : undefined}
      onDoubleClick={handleDoubleClick}
      style={{
        ...box,
        position: (box.position as React.CSSProperties["position"]) || "absolute",
        overflow: "hidden",
        outline: isEditing ? "2px solid #3b82f6" : undefined,
        outlineOffset: isEditing ? "-2px" : undefined,
      }}
    >
      {sceneId ? (
        <Suspense
          fallback={
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "#00000008",
              }}
            />
          }
        >
          <LazySceneView
            layer={layer}
            resolved={resolved}
            ctx={ctx}
            sceneId={sceneId}
            width={width}
            height={height}
          />
        </Suspense>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f8fafc",
            color: "#64748b",
            fontSize: 12,
            fontFamily: "sans-serif",
          }}
        >
          No 3D scene linked
        </div>
      )}
    </div>
  );
};

export default Scene3dLayer;
