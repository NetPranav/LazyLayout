"use client";

/**
 * ============================================================================
 * PRIMITIVE ON-OBJECT INTERACTIVE HANDLES (Phase 3D-025, Task B3-W3-addtext)
 * ============================================================================
 * Renders diamond-shaped SVG handles on procedural primitive meshes:
 *   - Driven by `handles(params)` from primitive specs (cylinder depth, cube width,
 *     sphere radius, torus major/minor radius, etc.).
 *   - Constant pixel size on screen, projected through the viewport camera.
 *   - Dragging computes ray-to-axis closest point in object space.
 *   - Param updates execute live via `3d.primitive.set_param`.
 *   - Coalesced into exactly ONE undo step via `documentCommands.begin(...)` / `commit()`.
 *   - Escape cancels and restores the initial parameter value.
 *   - Shows the live numeric parameter readout adjacent to the active handle.
 * ============================================================================
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { getDocument, documentStore, documentCommands, type DocumentTransaction } from "@/core/store/useDocumentStore";
import { runCommand } from "@/core/commands";
import {
  viewMatrix as calcViewMatrix,
  projectionMatrix as calcProjMatrix,
} from "@/core/3d/camera/viewCamera";
import { worldMatrix } from "@/core/3d/hierarchy";
import {
  multiply,
  invert,
  vec3,
  type Mat4,
  type Vec3,
} from "@/core/3d/math";
import { rayFromScreen } from "@/core/3d/pick/ray";
import { getPrimitiveSpec } from "@/core/3d/primitives/specs";
import type { HandleDef } from "@/core/3d/primitives/types";

const dot = (a: ArrayLike<number>, b: ArrayLike<number>): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export interface PrimitiveHandlesProps {
  width: number;
  height: number;
}

interface ProjectedHandleDef {
  handle: HandleDef<Record<string, unknown>>;
  screenPos: { x: number; y: number; visible: boolean };
}

interface ActiveDrag {
  handle: HandleDef<Record<string, unknown>>;
  objectId: string;
  startPointer: { x: number; y: number };
  startParams: Record<string, unknown>;
  currentVal: unknown;
  tx: DocumentTransaction;
  objMatrix: Mat4;
  invObjMatrix: Mat4;
  initialParamVal: unknown;
}

function projectToScreen(
  p: Vec3 | [number, number, number],
  vpMatrix: Mat4,
  width: number,
  height: number
): { x: number; y: number; visible: boolean } {
  const x = p[0];
  const y = p[1];
  const z = p[2];

  const clipX = vpMatrix[0] * x + vpMatrix[4] * y + vpMatrix[8] * z + vpMatrix[12];
  const clipY = vpMatrix[1] * x + vpMatrix[5] * y + vpMatrix[9] * z + vpMatrix[13];
  const clipW = vpMatrix[3] * x + vpMatrix[7] * y + vpMatrix[11] * z + vpMatrix[15];

  if (clipW <= 1e-4) {
    return { x: 0, y: 0, visible: false };
  }

  const ndcX = clipX / clipW;
  const ndcY = clipY / clipW;

  return {
    x: (ndcX * 0.5 + 0.5) * width,
    y: (1.0 - (ndcY * 0.5 + 0.5)) * height,
    visible: true,
  };
}

function transformPoint(m: Mat4, p: Vec3): Vec3 {
  const x = p[0], y = p[1], z = p[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  const invW = Math.abs(w) > 1e-6 ? 1 / w : 1;
  return vec3(
    (m[0] * x + m[4] * y + m[8] * z + m[12]) * invW,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) * invW,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) * invW
  );
}

function transformDirection(m: Mat4, v: Vec3): Vec3 {
  return vec3(
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2]
  );
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len < 1e-6) return vec3(0, 0, 0);
  return vec3(v[0] / len, v[1] / len, v[2] / len);
}

function closestPointOnLineFromRay(
  rOrig: Vec3,
  rDir: Vec3,
  lOrig: Vec3,
  lDir: Vec3
): number {
  const w0 = vec3(rOrig[0] - lOrig[0], rOrig[1] - lOrig[1], rOrig[2] - lOrig[2]);
  const a = dot(rDir, rDir);
  const b = dot(rDir, lDir);
  const c = dot(lDir, lDir);
  const d = dot(rDir, w0);
  const e = dot(lDir, w0);

  const denom = a * c - b * b;
  if (denom < 1e-9) {
    return c > 1e-9 ? e / c : 0;
  }
  return (a * e - b * d) / denom;
}

export const PrimitiveHandles: React.FC<PrimitiveHandlesProps> = ({ width, height }) => {
  const camera = useViewportStore((s) => s.camera);
  const selection = useViewportStore((s) => s.selection);
  const activeObjectId = selection.active ?? selection.selected[0] ?? null;

  const [docVersion, setDocVersion] = useState(0);
  const [hoveredHandleId, setHoveredHandleId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<ActiveDrag | null>(null);

  const dragRef = useRef<ActiveDrag | null>(null);
  useEffect(() => {
    dragRef.current = dragState;
  }, [dragState]);

  // Subscribe to document updates to re-project handles when params change
  useEffect(() => {
    return documentStore.subscribe(() => {
      setDocVersion((v) => v + 1);
    });
  }, []);

  // Compute camera matrices
  const aspect = Math.max(0.001, width / Math.max(1, height));
  const vMat = useMemo(() => calcViewMatrix(camera), [camera]);
  const pMat = useMemo(() => calcProjMatrix(camera, aspect), [camera, aspect]);
  const vpMat = useMemo(() => multiply(pMat, vMat), [pMat, vMat]);

  // Read active object and source mesh
  const activeData = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    docVersion; // trigger dependency
    if (!activeObjectId) return null;

    const doc = getDocument();
    const obj = doc.objects?.[activeObjectId];
    if (!obj || !obj.dataId) return null;

    const mesh = doc.meshes?.[obj.dataId];
    if (!mesh || !mesh.source || !mesh.source.kind || !mesh.source.params) return null;

    const spec = getPrimitiveSpec(mesh.source.kind);
    if (!spec || !spec.handles) return null;

    const objMatrix = worldMatrix(doc, activeObjectId);
    const invObjMatrix = invert(objMatrix);
    const rawHandles = spec.handles(mesh.source.params);

    return {
      obj,
      mesh,
      spec,
      objMatrix,
      invObjMatrix,
      rawHandles,
      params: mesh.source.params,
    };
  }, [activeObjectId, docVersion]);

  // Project handles to screen coordinates
  const projectedHandles = useMemo<ProjectedHandleDef[]>(() => {
    if (!activeData) return [];
    const { objMatrix, rawHandles } = activeData;

    return rawHandles.map((h) => {
      const worldPos = transformPoint(objMatrix, h.position);
      const screenPos = projectToScreen(worldPos, vpMat, width, height);
      return {
        handle: h,
        screenPos,
      };
    });
  }, [activeData, vpMat, width, height]);

  // Start handle drag
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, handle: HandleDef<Record<string, unknown>>) => {
      if (!activeData || !activeObjectId) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = e.currentTarget.parentElement?.getBoundingClientRect() ?? e.currentTarget.getBoundingClientRect();
      const scaleX = rect.width > 0 ? width / rect.width : 1;
      const scaleY = rect.height > 0 ? height / rect.height : 1;
      const pointerX = (e.clientX - rect.left) * scaleX;
      const pointerY = (e.clientY - rect.top) * scaleY;

      const tx = documentCommands.begin(`Drag ${handle.label} Handle`);

      const drag: ActiveDrag = {
        handle,
        objectId: activeObjectId,
        startPointer: { x: pointerX, y: pointerY },
        startParams: { ...activeData.params },
        currentVal: activeData.params[handle.param],
        initialParamVal: activeData.params[handle.param],
        tx,
        objMatrix: activeData.objMatrix,
        invObjMatrix: activeData.invObjMatrix,
      };

      setDragState(drag);

      try {
        (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
      } catch {
        // Fallback for tests
      }
    },
    [activeData, activeObjectId, width, height]
  );

  // Drag movement
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = e.currentTarget.parentElement?.getBoundingClientRect() ?? e.currentTarget.getBoundingClientRect();
      const scaleX = rect.width > 0 ? width / rect.width : 1;
      const scaleY = rect.height > 0 ? height / rect.height : 1;
      const pointerX = (e.clientX - rect.left) * scaleX;
      const pointerY = (e.clientY - rect.top) * scaleY;

      // Project rays for start and current pointer
      const rayStart = rayFromScreen(drag.startPointer.x, drag.startPointer.y, width, height, vMat, pMat);
      const rayNow = rayFromScreen(pointerX, pointerY, width, height, vMat, pMat);

      // Transform rays into object local space
      const orig0 = transformPoint(drag.invObjMatrix, rayStart.origin);
      const dir0 = normalize(transformDirection(drag.invObjMatrix, rayStart.dir));

      const orig1 = transformPoint(drag.invObjMatrix, rayNow.origin);
      const dir1 = normalize(transformDirection(drag.invObjMatrix, rayNow.dir));

      const s0 = closestPointOnLineFromRay(orig0, dir0, drag.handle.position, drag.handle.axis);
      const s1 = closestPointOnLineFromRay(orig1, dir1, drag.handle.position, drag.handle.axis);
      const delta = s1 - s0;

      const newParams = drag.handle.apply(drag.startParams, delta);
      const newVal = newParams[drag.handle.param];

      drag.currentVal = newVal;
      setDragState({ ...drag });

      runCommand("3d.primitive.set_param", {
        objectId: drag.objectId,
        param: drag.handle.param,
        value: newVal,
      });
    },
    [width, height, vMat, pMat]
  );

  // Commit drag
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      e.preventDefault();
      e.stopPropagation();

      drag.tx.commit();
      setDragState(null);

      try {
        (e.currentTarget as SVGElement).releasePointerCapture(e.pointerId);
      } catch {
        // Fallback for tests
      }
    },
    []
  );

  // Right-click cancels a handle drag (Blender's way). Escape belongs to the command system (it leaves the scene), and a raw
  // keydown listener here is not allowed: shortcuts are commands.
  const cancelDrag = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();
    drag.tx.cancel();
    setDragState(null);
  }, []);

  if (!activeData || projectedHandles.length === 0) return null;

  return (
    <svg
      data-testid="primitive-handles-overlay"
      className="ll:absolute ll:inset-0 ll:pointer-events-none ll:overflow-visible ll:z-30"
      style={{ width: "100%", height: "100%" }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={cancelDrag}
    >
      {projectedHandles.map(({ handle, screenPos }) => {
        if (!screenPos.visible) return null;

        const isHovered = hoveredHandleId === handle.id;
        const isDragging = dragState?.handle.id === handle.id;
        const size = isDragging ? 8 : isHovered ? 7 : 6;

        return (
          <g
            key={handle.id}
            data-testid={`primitive-handle-${handle.id}`}
            transform={`translate(${screenPos.x}, ${screenPos.y})`}
            className="ll:pointer-events-auto ll:cursor-grab ll:active:cursor-grabbing"
            onPointerDown={(e) => handlePointerDown(e, handle)}
            onPointerEnter={() => setHoveredHandleId(handle.id)}
            onPointerLeave={() => setHoveredHandleId(null)}
          >
            {/* Hit area */}
            <circle r={14} fill="transparent" />

            {/* Diamond handle path */}
            <polygon
              points={`0,${-size} ${size},0 0,${size} ${-size},0`}
              fill={isDragging ? "#2563eb" : isHovered ? "#3b82f6" : "#60a5fa"}
              stroke="#ffffff"
              strokeWidth={1.5}
            />

            {/* Live readout badge during drag */}
            {isDragging && dragState && (
              <g transform="translate(14, -14)" className="ll:pointer-events-none">
                <rect
                  x={0}
                  y={-12}
                  width={68}
                  height={18}
                  rx={3}
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth={1}
                />
                <text
                  x={6}
                  y={1}
                  fill="#f8fafc"
                  fontSize={10}
                  fontFamily="sans-serif"
                  fontWeight={500}
                >
                  {typeof dragState.currentVal === "number"
                    ? dragState.currentVal.toFixed(2)
                    : String(dragState.currentVal)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default PrimitiveHandles;
