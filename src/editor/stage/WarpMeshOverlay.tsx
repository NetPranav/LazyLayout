"use client";

/**
 * Warp mesh on the canvas: a grid of control points drawn across the surface of a layer,
 * allowing flexible multi-point bending (After Effects tracking/mesh warp style).
 * Dragging a point bends the surface; Shift-dragging moves an entire row.
 */

import React, { useRef } from "react";
import { documentCommands } from "@/core/store/useDocumentStore";
import {
  formatMeshInLayer,
  isMeshConvex,
  meshInParent,
  subdivideMeshCol,
  subdivideMeshRow,
  type Point,
  type WarpMesh,
} from "@/core/geometry/meshWarp";
import type { Layer } from "@/core/document/schema";
import type { StageElement } from "./types";

interface Props {
  selectedIds: string[];
  elements: Record<string, StageElement>;
  layers?: Record<string, Layer>;
  zoom: number;
}

export const WarpMeshOverlay: React.FC<Props> = ({ selectedIds, elements, layers, zoom }) => {
  const drag = useRef<{
    r: number;
    c: number;
    index: number;
    startX: number;
    startY: number;
    initialMesh: WarpMesh;
    tx: ReturnType<typeof documentCommands.begin>;
  } | null>(null);

  const id = selectedIds.length === 1 ? selectedIds[0] : null;
  const layer = id && layers ? layers[id] : undefined;
  const el = id ? elements[id] : undefined;
  const origin: [number, number] = [Number(layer?.properties["frame.x"] ?? 0), Number(layer?.properties["frame.y"] ?? 0)];
  const mesh = meshInParent(layer?.properties["transform.mesh"], origin);

  if (!id || !layer || !el || !mesh) return null;

  const ox = el.ox ?? 0;
  const oy = el.oy ?? 0;
  const pagePoints: Point[] = mesh.points.map(([x, y]) => [x + ox, y + oy]);
  const size = 14 / zoom;

  // Build row polylines and col polylines for the mesh grid
  const rowLines: string[] = [];
  for (let r = 0; r < mesh.rows; r++) {
    const pts: Point[] = [];
    for (let c = 0; c < mesh.cols; c++) {
      pts.push(pagePoints[r * mesh.cols + c]);
    }
    rowLines.push(pts.map(([x, y]) => `${x},${y}`).join(" "));
  }

  const colLines: string[] = [];
  for (let c = 0; c < mesh.cols; c++) {
    const pts: Point[] = [];
    for (let r = 0; r < mesh.rows; r++) {
      pts.push(pagePoints[r * mesh.cols + c]);
    }
    colLines.push(pts.map(([x, y]) => `${x},${y}`).join(" "));
  }

  // Outer boundary polygon
  const boundaryPoints: Point[] = [];
  // Top edge: cols 0 .. cols - 1 at row 0
  for (let c = 0; c < mesh.cols; c++) boundaryPoints.push(pagePoints[0 * mesh.cols + c]);
  // Right edge: rows 1 .. rows - 1 at col (cols - 1)
  for (let r = 1; r < mesh.rows; r++) boundaryPoints.push(pagePoints[r * mesh.cols + (mesh.cols - 1)]);
  // Bottom edge: cols cols - 2 down to 0 at row (rows - 1)
  for (let c = mesh.cols - 2; c >= 0; c--) boundaryPoints.push(pagePoints[(mesh.rows - 1) * mesh.cols + c]);
  // Left edge: rows rows - 2 down to 1 at col 0
  for (let r = mesh.rows - 2; r >= 1; r--) boundaryPoints.push(pagePoints[r * mesh.cols + 0]);

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    const nextPoints = d.initialMesh.points.map((p) => [...p] as Point);

    if (e.shiftKey) {
      // Shift-drag moves a whole row
      for (let col = 0; col < d.initialMesh.cols; col++) {
        const idx = d.r * d.initialMesh.cols + col;
        nextPoints[idx] = [
          d.initialMesh.points[idx][0] + dx,
          d.initialMesh.points[idx][1] + dy,
        ];
      }
    } else {
      nextPoints[d.index] = [
        d.initialMesh.points[d.index][0] + dx,
        d.initialMesh.points[d.index][1] + dy,
      ];
    }

    const nextMesh: WarpMesh = {
      cols: d.initialMesh.cols,
      rows: d.initialMesh.rows,
      points: nextPoints,
    };

    if (isMeshConvex(nextMesh)) {
      documentCommands.updateProps(id, { "transform.mesh": formatMeshInLayer(nextMesh, origin) });
    }
  };

  const end = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    d.tx.commit(); // one undo step per drag
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };

  const handleSubdivideRow = (r: number) => {
    const next = subdivideMeshRow(mesh, r);
    if (next && isMeshConvex(next)) {
      documentCommands.updateProps(id, { "transform.mesh": formatMeshInLayer(next, origin) });
    }
  };

  const handleSubdivideCol = (c: number) => {
    const next = subdivideMeshCol(mesh, c);
    if (next && isMeshConvex(next)) {
      documentCommands.updateProps(id, { "transform.mesh": formatMeshInLayer(next, origin) });
    }
  };

  return (
    <div data-testid="warp-mesh-overlay" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 40 }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden="true">
        {/* Fill the surface inside the mesh bounds */}
        <polygon
          points={boundaryPoints.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="rgba(47,107,255,0.08)"
          stroke="#2F6BFF"
          strokeWidth={1.5 / zoom}
        />
        {/* Interior grid lines */}
        {rowLines.map((points, idx) => (
          <polyline
            key={`row-${idx}`}
            points={points}
            fill="none"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth={1 / zoom}
            strokeDasharray={`${4 / zoom} ${4 / zoom}`}
          />
        ))}
        {colLines.map((points, idx) => (
          <polyline
            key={`col-${idx}`}
            points={points}
            fill="none"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth={1 / zoom}
            strokeDasharray={`${4 / zoom} ${4 / zoom}`}
          />
        ))}
        {/* Invisible wider hit areas to allow double-clicking lines to subdivide */}
        {mesh.rows < 6 &&
          Array.from({ length: mesh.rows - 1 }, (_, r) => (
            <polyline
              key={`hit-row-${r}`}
              points={rowLines[r]}
              fill="none"
              stroke="transparent"
              strokeWidth={12 / zoom}
              style={{ pointerEvents: "stroke", cursor: "copy" }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleSubdivideRow(r);
              }}
            />
          ))}
        {mesh.cols < 6 &&
          Array.from({ length: mesh.cols - 1 }, (_, c) => (
            <polyline
              key={`hit-col-${c}`}
              points={colLines[c]}
              fill="none"
              stroke="transparent"
              strokeWidth={12 / zoom}
              style={{ pointerEvents: "stroke", cursor: "copy" }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleSubdivideCol(c);
              }}
            />
          ))}
      </svg>

      {/* Control point handles */}
      {Array.from({ length: mesh.rows }, (_, r) =>
        Array.from({ length: mesh.cols }, (_, c) => {
          const idx = r * mesh.cols + c;
          const [x, y] = pagePoints[idx];
          return (
            <button
              key={`point-${r}-${c}`}
              type="button"
              aria-label={`Mesh point row ${r} column ${c}`}
              title={`Mesh point row ${r} column ${c}. Drag to warp, Shift-drag to move row.`}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = {
                  r,
                  c,
                  index: idx,
                  startX: e.clientX,
                  startY: e.clientY,
                  initialMesh: mesh,
                  tx: documentCommands.begin("Warp mesh"),
                };
              }}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              style={{
                position: "absolute",
                left: x - size / 2,
                top: y - size / 2,
                width: size,
                height: size,
                padding: 0,
                borderRadius: "50%",
                background: "#fff",
                border: `${2 / zoom}px solid #2F6BFF`,
                cursor: "crosshair",
                pointerEvents: "auto",
                touchAction: "none",
              }}
            />
          );
        })
      )}
    </div>
  );
};
