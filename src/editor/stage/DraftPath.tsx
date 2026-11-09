"use client";

import React from "react";
import { useDraftPathStore } from "@/core/store/useDraftPathStore";
import { useCameraStore } from "@/core/store/useCameraStore";
import { nodesToPathData } from "@/core/paths/pathFit";
import { penRubberBand } from "@/core/paths/penModel";

/**
 * The vector path being drafted on stage right now: pencil points or pen anchors with rubberband.
 */
export const DraftPath: React.FC = () => {
  const { kind, points, nodes, closed, cursor } = useDraftPathStore();
  const zoom = useCameraStore((s) => s.camera.zoom) || 1;
  if (!kind) return null;
  const px = 1 / zoom;
  const d =
    kind === "pencil"
      ? points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ")
      : nodesToPathData(cursor && !closed ? penRubberBand({ nodes, closed }, cursor) : nodes, closed);

  return (
    <svg
      data-testid="draft-path"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      <path
        d={d}
        fill="none"
        stroke="#2563eb"
        strokeWidth={2 * px}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {kind === "pen" &&
        nodes.map((n, i) => (
          <g key={i}>
            {/* Control handle lines if present */}
            {n.hin && (
              <line
                x1={n.x}
                y1={n.y}
                x2={n.hin.x}
                y2={n.hin.y}
                stroke="#60a5fa"
                strokeWidth={px}
              />
            )}
            {n.hout && (
              <line
                x1={n.x}
                y1={n.y}
                x2={n.hout.x}
                y2={n.hout.y}
                stroke="#60a5fa"
                strokeWidth={px}
              />
            )}
            {/* Anchor vertex square */}
            <rect
              x={n.x - 3.5 * px}
              y={n.y - 3.5 * px}
              width={7 * px}
              height={7 * px}
              fill={i === 0 ? "#2563eb" : "#ffffff"}
              stroke="#2563eb"
              strokeWidth={1.5 * px}
            />
          </g>
        ))}
    </svg>
  );
};
