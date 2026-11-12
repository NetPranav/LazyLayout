"use client";

/**
 * ============================================================================
 * VIEWPORT STATISTICS READOUT (Phase 3D-019)
 * ============================================================================
 * Compact HUD overlay displaying pure scene statistics:
 *   - Object count
 *   - Vertex count
 *   - Planar face count
 *   - Triangle count
 *   - Estimated GPU buffer memory
 *
 * Driven by `sceneStats(doc, sceneId)` from `src/core/3d/viewport/stats.ts`.
 * Visible only when `settings.overlays.stats` is enabled.
 * ============================================================================
 */

import React, { useState, useEffect } from "react";
import { documentStore, getDocument } from "../../core/store/useDocumentStore";
import { useViewportStore } from "../../core/render/scene3d/viewportStore";
import { sceneStats, type SceneStatsResult } from "../../core/3d/viewport/stats";

export interface ViewportStatsProps {
  sceneId?: string;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ViewportStats: React.FC<ViewportStatsProps> = ({
  sceneId: propSceneId,
  className = "",
}) => {
  const statsEnabled = useViewportStore((s) => s.settings.overlays.stats);
  const editingSceneId = useViewportStore((s) => s.editingSceneId);

  const [stats, setStats] = useState<SceneStatsResult>({
    objects: 0,
    vertices: 0,
    faces: 0,
    triangles: 0,
    estimatedMemoryBytes: 0,
  });

  const activeSceneId =
    propSceneId ??
    editingSceneId ??
    Object.keys(getDocument().scenes ?? {})[0] ??
    "";

  useEffect(() => {
    if (!statsEnabled || !activeSceneId) return;

    const update = () => {
      const doc = getDocument();
      const nextStats = sceneStats(doc, activeSceneId);
      setStats(nextStats);
    };

    update();
    const unsubscribeDoc = documentStore.subscribe(update);
    const unsubscribeVp = useViewportStore.subscribe(update);

    return () => {
      unsubscribeDoc();
      unsubscribeVp();
    };
  }, [statsEnabled, activeSceneId]);

  if (!statsEnabled) {
    return null;
  }

  return (
    <div
      data-testid="viewport-stats"
      className={`ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-sm ll:p-2.5 ll:select-none ll:pointer-events-none ll:font-mono ll:text-micro ${className}`}
    >
      <div className="ll:flex ll:flex-col ll:gap-1">
        <div className="ll:flex ll:items-center ll:justify-between ll:gap-4">
          <span className="ll:text-muted">Objects</span>
          <span className="ll:text-primary ll:font-medium">{stats.objects}</span>
        </div>
        <div className="ll:flex ll:items-center ll:justify-between ll:gap-4">
          <span className="ll:text-muted">Vertices</span>
          <span className="ll:text-primary ll:font-medium">
            {stats.vertices.toLocaleString()}
          </span>
        </div>
        <div className="ll:flex ll:items-center ll:justify-between ll:gap-4">
          <span className="ll:text-muted">Faces</span>
          <span className="ll:text-primary ll:font-medium">
            {stats.faces.toLocaleString()}
          </span>
        </div>
        <div className="ll:flex ll:items-center ll:justify-between ll:gap-4">
          <span className="ll:text-muted">Triangles</span>
          <span className="ll:text-primary ll:font-medium">
            {stats.triangles.toLocaleString()}
          </span>
        </div>
        <div className="ll:flex ll:items-center ll:justify-between ll:gap-4 ll:border-t ll:border-border ll:pt-1">
          <span className="ll:text-muted">Memory</span>
          <span className="ll:text-secondary ll:font-medium">
            {formatBytes(stats.estimatedMemoryBytes)}
          </span>
        </div>
      </div>
    </div>
  );
};
