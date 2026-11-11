"use client";

import React from "react";
import { useDraftPathStore } from "@/core/store/useDraftPathStore";
import { useCameraStore } from "@/core/store/useCameraStore";
import { nodesToPathData } from "@/core/paths/pathFit";
import { penRubberBand } from "@/core/paths/penModel";
import { AnchorMark } from "./pen/AnchorMark";

const CLOSE_RING_PX = 12; // the Stage closes the path when the pen is this close (screen px) to the first point

/**
 * The vector path being drafted on stage right now: pencil points, or pen points with their handles, a ghost line for
 * the next segment under the pointer, and a ring on the first point when a click there would close the path.
 * Nothing renders unless a draft is under way.
 */
export const DraftPath: React.FC = () => {
  const { kind, points, nodes, closed, cursor } = useDraftPathStore();
  const zoom = useCameraStore((s) => s.camera.zoom) || 1;
  if (!kind) return null;
  const px = 1 / zoom;
  const solid = kind === "pencil" ? points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") : nodesToPathData(nodes, closed);
  const ghost = kind === "pen" && cursor && !closed ? nodesToPathData(penRubberBand({ nodes, closed }, cursor), false) : "";
  const first = nodes[0];
  const canClose = kind === "pen" && !closed && nodes.length >= 3 && !!first;
  const nearFirst = canClose && !!cursor && Math.hypot(cursor.x - first.x, cursor.y - first.y) <= CLOSE_RING_PX * px;
  const lastIndex = nodes.length - 1;

  return (
    <svg
      data-testid="draft-path"
      aria-hidden="true"
      className="ll:absolute ll:pointer-events-none"
      style={{ left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", zIndex: 40 }}
    >
      <path d={solid} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--ll-pen-mark)", strokeWidth: 1.5 * px }} />
      {ghost && <path data-testid="draft-ghost" d={ghost} fill="none" strokeLinecap="round" strokeDasharray={`${4 * px} ${4 * px}`} style={{ stroke: "var(--ll-pen-mark)", strokeWidth: px, opacity: 0.55 }} />}
      {kind === "pen" &&
        nodes.map((n, i) => (
          <g key={i}>
            {n.hin && <line x1={n.x} y1={n.y} x2={n.hin.x} y2={n.hin.y} style={{ stroke: "var(--ll-pen-mark)", strokeWidth: px }} />}
            {n.hout && <line x1={n.x} y1={n.y} x2={n.hout.x} y2={n.hout.y} style={{ stroke: "var(--ll-pen-mark)", strokeWidth: px }} />}
            {n.hin && <circle cx={n.hin.x} cy={n.hin.y} r={3 * px} style={{ fill: "var(--ll-surface-raised)", stroke: "var(--ll-pen-mark)", strokeWidth: px }} />}
            {n.hout && <circle cx={n.hout.x} cy={n.hout.y} r={3 * px} style={{ fill: "var(--ll-surface-raised)", stroke: "var(--ll-pen-mark)", strokeWidth: px }} />}
          </g>
        ))}
      {canClose && (
        <circle
          data-testid="draft-close-ring"
          cx={first.x}
          cy={first.y}
          r={(nearFirst ? 8 : 7) * px}
          fill="none"
          style={{ stroke: "var(--ll-pen-mark)", strokeWidth: (nearFirst ? 1.5 : 1) * px, opacity: nearFirst ? 1 : 0.6 }}
        />
      )}
      {kind === "pen" && nodes.map((n, i) => <AnchorMark key={i} x={n.x} y={n.y} px={px} selected={i === lastIndex} delayIndex={0} />)}
    </svg>
  );
};
