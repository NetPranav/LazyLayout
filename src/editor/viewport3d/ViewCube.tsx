"use client";

/**
 * ============================================================================
 * 3D VIEW CUBE (ROADMAP Phase 3D-014)
 * ============================================================================
 * Interactive orientation cube displayed in the top-right of the 3D viewport:
 *   - Shows the camera's spatial orientation in real-time.
 *   - Clicking any of the 6 faces ("TOP", "BOTTOM", "FRONT", "BACK", "RIGHT", "LEFT")
 *     aligns the camera to that standard orthographic/perspective view.
 *   - Follows Apple-level design: solid neutral panels, hairline borders,
 *     no glass/blur, crisp typography, and modest border radius.
 * ============================================================================
 */

import React, { useCallback } from "react";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { setStandardView, type StandardView } from "@/core/3d/camera/viewCamera";

export interface ViewCubeProps {
  size?: number;
  className?: string;
}

interface FaceDef {
  id: StandardView;
  label: string;
  transform: string;
  bgTint: string;
}

export const ViewCube: React.FC<ViewCubeProps> = ({
  size = 64,
  className = "",
}) => {
  const camera = useViewportStore((s) => s.camera);
  const setCamera = useViewportStore((s) => s.setCamera);

  const half = size / 2;

  // Convert camera pitch and yaw (in radians) to CSS 3D rotation
  // Camera orbit rotates around Z (yaw) and then pitches up/down from XY plane
  const pitchDeg = (camera.pitch * 180) / Math.PI;
  const yawDeg = (camera.yaw * 180) / Math.PI;

  const handleFaceClick = useCallback(
    (view: StandardView, e: React.MouseEvent) => {
      e.stopPropagation();
      setCamera((cam) => setStandardView(cam, view));
    },
    [setCamera]
  );

  const faces: FaceDef[] = [
    {
      id: "top",
      label: "TOP",
      transform: `rotateX(90deg) translateZ(${half}px)`,
      bgTint: "var(--ll-surface-raised, #FDFCF8)",
    },
    {
      id: "bottom",
      label: "BTM",
      transform: `rotateX(-90deg) translateZ(${half}px)`,
      bgTint: "var(--ll-surface-raised, #FDFCF8)",
    },
    {
      id: "front",
      label: "FRONT",
      transform: `translateZ(${half}px)`,
      bgTint: "var(--ll-surface-raised, #FDFCF8)",
    },
    {
      id: "back",
      label: "BACK",
      transform: `rotateY(180deg) translateZ(${half}px)`,
      bgTint: "var(--ll-surface-raised, #FDFCF8)",
    },
    {
      id: "right",
      label: "RIGHT",
      transform: `rotateY(90deg) translateZ(${half}px)`,
      bgTint: "var(--ll-surface-raised, #FDFCF8)",
    },
    {
      id: "left",
      label: "LEFT",
      transform: `rotateY(-90deg) translateZ(${half}px)`,
      bgTint: "var(--ll-surface-raised, #FDFCF8)",
    },
  ];

  return (
    <div
      className={`ll:select-none ll:pointer-events-auto ${className}`}
      data-testid="view-cube"
      style={{
        width: size + 24,
        height: size + 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: 320,
      }}
      title="3D Navigation Cube (Click face for standard view)"
    >
      <div
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `rotateX(${-pitchDeg}deg) rotateZ(${yawDeg}deg)`,
          transition: "transform 100ms ease-out",
        }}
      >
        {faces.map((f) => (
          <button
            key={f.id}
            type="button"
            data-face={f.id}
            aria-label={`View ${f.label}`}
            onClick={(e) => handleFaceClick(f.id, e)}
            style={{
              position: "absolute",
              inset: 0,
              width: size,
              height: size,
              transform: f.transform,
              backgroundColor: f.bgTint,
              border: "1px solid var(--ll-border-color, #CECDC8)",
              borderRadius: 3,
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 600,
              color: "var(--ll-text-primary, #1e293b)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              letterSpacing: "0.02em",
              cursor: "pointer",
              padding: 0,
              userSelect: "none",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ViewCube;
