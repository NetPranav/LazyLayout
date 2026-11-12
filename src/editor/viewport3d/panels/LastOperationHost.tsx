"use client";

/**
 * ============================================================================
 * 3D VIEWPORT CHROME & LAST OPERATION HOST (Phase 3D-011, 3D-018, 3D-019)
 * ============================================================================
 * Hosts the floating chrome panels for the 3D viewport:
 *   - Bottom-Left: AdjustLastOperationPanel (when a 3D operation ran)
 *   - Top-Right: OverlaysMenu and ShadingBar (when 3D editing or scene active)
 *   - Top-Left: ViewportStats readout (when statistics overlay is enabled)
 * ============================================================================
 */

import React, { useState, useEffect } from "react";
import { AdjustLastOperationPanel } from "../../components/AdjustLastOperationPanel";
import { ShadingBar } from "../../components/ShadingBar";
import { OverlaysMenu } from "../../components/OverlaysMenu";
import { ViewportStats } from "../../components/ViewportStats";
import { TextPanel3d } from "../TextPanel3d";
import { useViewportStore } from "../../../core/render/scene3d/viewportStore";
import { getLastOperation, subscribe } from "../../../core/3d/commands/lastOperation";
import { documentStore, getDocument } from "../../../core/store/useDocumentStore";

export const LastOperationHost: React.FC = () => {
  const isEditing3d = useViewportStore((s) => Boolean(s.editingSceneId));
  const [hasLastOp, setHasLastOp] = useState<boolean>(() => getLastOperation() !== null);
  const [hasSceneLayers, setHasSceneLayers] = useState<boolean>(() => {
    const doc = getDocument();
    return Boolean(doc.scenes && Object.keys(doc.scenes).length > 0);
  });

  useEffect(() => {
    const updateOp = () => {
      setHasLastOp(getLastOperation() !== null);
    };
    return subscribe(updateOp);
  }, []);

  useEffect(() => {
    const updateDoc = () => {
      const doc = getDocument();
      setHasSceneLayers(Boolean(doc.scenes && Object.keys(doc.scenes).length > 0));
    };
    return documentStore.subscribe(updateDoc);
  }, []);

  const show3dChrome = isEditing3d || hasSceneLayers || hasLastOp;

  return (
    <div
      data-testid="last-operation-host"
      className="ll:pointer-events-none ll:absolute ll:inset-0 ll:overflow-hidden ll:z-20"
    >
      {/* Top Left: Viewport Statistics */}
      <div className="ll:absolute ll:top-3 ll:left-3 ll:pointer-events-auto">
        <ViewportStats />
      </div>

      {/* Top Right: Overlays & Shading Bar */}
      {show3dChrome && (
        <div className="ll:absolute ll:top-3 ll:right-3 ll:flex ll:items-center ll:gap-2 ll:pointer-events-auto">
          <OverlaysMenu />
          <ShadingBar />
        </div>
      )}

      {/* Bottom Left: Adjust Last Operation Panel & 3D Text Panel */}
      <div className="ll:absolute ll:bottom-3 ll:left-3 ll:flex ll:items-end ll:gap-3 ll:pointer-events-auto">
        <AdjustLastOperationPanel />
        <TextPanel3d />
      </div>
    </div>
  );
};

export default LastOperationHost;
