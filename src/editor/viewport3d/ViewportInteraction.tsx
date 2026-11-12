"use client";

/**
 * ============================================================================
 * 3D VIEWPORT INTERACTION LAYER (ROADMAP Phases 3D-014 – 3D-017)
 * ============================================================================
 * Main interactive layer mounted over the 3D scene canvas while editingSceneId
 * is active:
 *   1. Camera Navigation: Maps middle mouse and trackpad gestures via
 *      `gestures.ts` (`navigationFromGesture`) to camera `orbit`, `pan`, `dolly`.
 *   2. Selection: Click picks objects via `pickScene` (three-mesh-bvh); drag on
 *      empty space triggers box select (or lasso with Alt). Shift toggles add.
 *   3. 3D Cursor: Shift + Right-Click places the 3D cursor on geometry via `placeCursor`.
 *   4. Modal G / R / S: Commands `3d.transform.translate|rotate|scale` (or keys G, R, S)
 *      initiate a `TransformSession`. The container holds focus and React `onKeyDown`
 *      feeds axis locks (X/Y/Z, Shift), typed digits, `-`, `.`, Backspace, Enter, Escape.
 *      One single-step undo commit on Enter, cancel on Escape.
 *   5. Overlays: Mounts `SnapBar` header strip, `ViewCube` widget, `GizmoOverlay`,
 *      and `TransformStatus` HUD.
 *
 * Strictly adheres to eslint rules: NO raw window keydown listeners and NO requestAnimationFrame.
 * ============================================================================
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { getDocument, documentCommands } from "@/core/store/useDocumentStore";
import {
  viewMatrix as calcViewMatrix,
  projectionMatrix as calcProjMatrix,
  orbit,
  pan,
  dolly,
} from "@/core/3d/camera/viewCamera";
import { navigationFromGesture } from "@/core/3d/camera/gestures";
import { rayFromScreen } from "@/core/3d/pick/ray";
import {
  pickScene,
  type PickableSceneObject,
} from "@/core/3d/pick/bvh";
import {
  click,
  boxSelect,
  lassoSelect,
  selectNone,
} from "@/core/3d/pick/select";
import { placeCursor } from "@/core/3d/snap/cursor";
import {
  TransformSession,
  type TransformSessionObject,
} from "@/core/3d/transform/session";
import type { TransformMode, TransformAxis } from "@/core/3d/transform/typed";
import { worldMatrix } from "@/core/3d/hierarchy";
import {
  multiply,
  vec3,
  type Mat4,
  type Vec3,
} from "@/core/3d/math";
import { SnapBar } from "./SnapBar";
import { ViewCube } from "./ViewCube";
import { GizmoOverlay } from "./GizmoOverlay";
import { TransformStatus } from "./TransformStatus";
import { AddMenu3d, AddMenuButton } from "./AddMenu3d";
import { PrimitiveHandles } from "./PrimitiveHandles";
import { TextEditOverlay3d } from "./TextEditOverlay3d";
import { registerTransformTrigger, registerBoxSelectTrigger } from "./viewCommands";
import type {
  ViewportInteractionProps,
  ModalTransformState,
  BoxSelectState,
  LassoSelectState,
} from "./types";

/** The objects as box and lasso selection want them: an origin and world-space bounds (the mesh box carried through the world matrix). */
function selectables(pickables: PickableSceneObject[]) {
  return pickables.map((p) => {
    const m = p.mesh.worldMatrix;
    const pos = p.mesh.positions;
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i + 2 < pos.length; i += 3) {
      const x = pos[i], y = pos[i + 1], z = pos[i + 2];
      const w = m
        ? [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]
        : [x, y, z];
      for (let k = 0; k < 3; k++) {
        if (w[k] < lo[k]) lo[k] = w[k];
        if (w[k] > hi[k]) hi[k] = w[k];
      }
    }
    const origin = m ? [m[12], m[13], m[14]] : [0, 0, 0];
    return { id: p.id, origin, bounds: { min: lo, max: hi } };
  });
}

function projectPointToScreen(
  p: Vec3 | [number, number, number],
  vpMatrix: Mat4,
  width: number,
  height: number
): { x: number; y: number; visible: boolean } {
  const x = p[0], y = p[1], z = p[2];
  const clipX = vpMatrix[0] * x + vpMatrix[4] * y + vpMatrix[8] * z + vpMatrix[12];
  const clipY = vpMatrix[1] * x + vpMatrix[5] * y + vpMatrix[9] * z + vpMatrix[13];
  const clipW = vpMatrix[3] * x + vpMatrix[7] * y + vpMatrix[11] * z + vpMatrix[15];

  if (clipW <= 1e-4) return { x: 0, y: 0, visible: false };
  const ndcX = clipX / clipW;
  const ndcY = clipY / clipW;
  return {
    x: (ndcX * 0.5 + 0.5) * width,
    y: (1.0 - (ndcY * 0.5 + 0.5)) * height,
    visible: true,
  };
}

function formatStatus(session: TransformSession): string {
  const modeStr =
    session.mode === "translate"
      ? "Move"
      : session.mode === "rotate"
      ? "Rotate"
      : "Scale";

  const axisStr = session.currentAxis
    ? ` ${session.currentAxis}${session.isPlaneLocked ? " (Plane)" : ""}`
    : "";

  const val = session.value();
  let valStr = "";
  if (session.mode === "translate") {
    valStr = ` ${val.toFixed(2)} m`;
  } else if (session.mode === "rotate") {
    valStr = ` ${val.toFixed(2)}°`;
  } else if (session.mode === "scale") {
    valStr = ` ${val.toFixed(2)}`;
  }

  return `${modeStr}${axisStr}${valStr}`;
}

export const ViewportInteraction: React.FC<ViewportInteractionProps> = ({
  sceneId,
  width,
  height,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const camera = useViewportStore((s) => s.camera);
  const setCamera = useViewportStore((s) => s.setCamera);

  const selection = useViewportStore((s) => s.selection);
  const setSelection = useViewportStore((s) => s.setSelection);

  const cursor = useViewportStore((s) => s.cursor);
  const setCursor = useViewportStore((s) => s.setCursor);

  const orientationKind = useViewportStore((s) => s.orientation);

  // Interaction States
  const [modalTransform, setModalTransform] = useState<ModalTransformState | null>(null);
  const [boxSelectState, setBoxSelectState] = useState<BoxSelectState | null>(null);
  const [lassoSelectState, setLassoSelectState] = useState<LassoSelectState | null>(null);
  const [isGizmoDragging, setIsGizmoDragging] = useState(false);
  // mirrors navDragRef for the cursor style (a ref must not be read while rendering)
  const [isNavigating, setIsNavigating] = useState(false);

  // Pointer drag tracking
  const navDragRef = useRef<{
    active: boolean;
    button: number;
    lastX: number;
    lastY: number;
  }>({ active: false, button: -1, lastX: 0, lastY: 0 });

  const leftClickDownRef = useRef<{
    startX: number;
    startY: number;
    hasMoved: boolean;
    isAlt: boolean;
  } | null>(null);

  // Matrices
  const aspect = Math.max(0.001, width / Math.max(1, height));
  const vMat = useMemo(() => calcViewMatrix(camera), [camera]);
  const pMat = useMemo(() => calcProjMatrix(camera, aspect), [camera, aspect]);
  const vpMat = useMemo(() => multiply(pMat, vMat), [pMat, vMat]);

  // Project 3D Cursor to Screen
  const cursorScreen = useMemo(() => {
    return projectPointToScreen(cursor.position, vpMat, width, height);
  }, [cursor.position, vpMat, width, height]);

  // Construct pickable scene objects list from active scene in document
  const getPickableSceneObjects = useCallback((): PickableSceneObject[] => {
    const doc = getDocument();
    const scene = doc.scenes?.[sceneId];
    if (!scene || !scene.objects) return [];

    const result: PickableSceneObject[] = [];

    for (const objId of scene.objects) {
      const obj = doc.objects?.[objId];
      if (!obj || obj.visible === false || obj.type !== "mesh" || !obj.dataId) continue;

      const mesh = doc.meshes?.[obj.dataId];
      if (!mesh || !mesh.positions) continue;

      const wMat = worldMatrix(doc, objId);

      result.push({
        id: objId,
        mesh: {
          id: mesh.id,
          positions: mesh.positions,
          indices: mesh.indices,
          worldMatrix: wMat,
        },
      });
    }

    return result;
  }, [sceneId]);

  // Start modal transform session (G / R / S)
  const startModalTransform = useCallback(
    (mode: TransformMode) => {
      const selectedIds = selection.selected;
      if (selectedIds.length === 0) return;

      const doc = getDocument();
      const sessionObjects: TransformSessionObject[] = [];

      for (const id of selectedIds) {
        const obj = doc.objects?.[id];
        if (!obj) continue;

        const wMat = worldMatrix(doc, id);
        let parentWMat: Mat4 | undefined;
        let parentInv: Mat4 | undefined;

        if (obj.parentId && doc.objects?.[obj.parentId]) {
          parentWMat = worldMatrix(doc, obj.parentId);
          parentInv = obj.parentInverse ? Float64Array.from(obj.parentInverse) : undefined;
        }

        sessionObjects.push({
          id,
          worldMatrix: wMat,
          parentWorldMatrix: parentWMat,
          parentInverse: parentInv,
          local: {
            location: vec3(
              obj.transform.location[0],
              obj.transform.location[1],
              obj.transform.location[2]
            ),
            rotationQuat: obj.transform.rotationQuat,
            scale: vec3(
              obj.transform.scale[0],
              obj.transform.scale[1],
              obj.transform.scale[2]
            ),
          },
        });
      }

      if (sessionObjects.length === 0) return;

      // Determine pivot
      const activeObj = sessionObjects[0];
      const pivotPt = vec3(
        activeObj.worldMatrix[12],
        activeObj.worldMatrix[13],
        activeObj.worldMatrix[14]
      );

      const session = new TransformSession({
        mode,
        objects: sessionObjects,
        viewCamera: {
          viewMatrix: vMat,
          projectionMatrix: pMat,
          viewport: { width, height },
        },
        pivot: pivotPt,
        orientation: orientationKind === "local" ? "local" : "global",
      });

      const initialStatus = formatStatus(session);

      setModalTransform({
        mode,
        session,
        startClientX: width / 2,
        startClientY: height / 2,
        axis: session.currentAxis,
        planeLocked: session.isPlaneLocked,
        numericString: "",
        hasNumericInput: false,
        committedTransforms: [],
        statusText: initialStatus,
      });

      // Ensure viewport container holds keyboard focus
      containerRef.current?.focus();
    },
    [selection.selected, vMat, pMat, width, height, orientationKind]
  );

  // Register command trigger listener
  useEffect(() => {
    const unreg = registerTransformTrigger((mode) => {
      startModalTransform(mode);
    });
    return unreg;
  }, [startModalTransform]);

  useEffect(() => {
    const unreg = registerBoxSelectTrigger(() => {
      setBoxSelectState({
        startX: width * 0.25,
        startY: height * 0.25,
        currentX: width * 0.75,
        currentY: height * 0.75,
      });
    });
    return unreg;
  }, [width, height]);

  // Pointer Down
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      // the stage is zoomed: the box is `width` x `height` in the page but drawn smaller (or larger) on screen
      const pointerX = (e.clientX - rect.left) * (rect.width > 0 ? width / rect.width : 1);
      const pointerY = (e.clientY - rect.top) * (rect.height > 0 ? height / rect.height : 1);

      // 1. Shift + Right Click places 3D Cursor
      if (e.button === 2 && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();

        const ray = rayFromScreen(pointerX, pointerY, width, height, vMat, pMat);
        const pickables = getPickableSceneObjects();
        const snapScene = {
          objects: pickables.map((p) => ({
            id: p.id,
            worldMatrix: p.mesh.worldMatrix,
            positions: p.mesh.positions as number[],
            indices: p.mesh.indices as number[],
          })),
        };

        const newCursor = placeCursor(
          { origin: ray.origin, direction: ray.dir },
          snapScene
        );
        setCursor(newCursor);
        return;
      }

      // 2. Middle Button (1) Camera Navigation (Orbit / Pan / Dolly)
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();

        setIsNavigating(true);
        navDragRef.current = {
          active: true,
          button: 1,
          lastX: e.clientX,
          lastY: e.clientY,
        };

        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Mock fallback
        }
        return;
      }

      // 3. Left Button (0) Picking / Box Select / Lasso
      if (e.button === 0) {
        // If modal transform is active, left click commits
        if (modalTransform) {
          e.preventDefault();
          e.stopPropagation();
          const committed = modalTransform.session.commit();
          documentCommands.mutate(`Transform ${modalTransform.mode}`, (draft) => {
            for (const c of committed) {
              const obj = draft.objects?.[c.id];
              if (obj) {
                obj.transform.location = [c.location[0], c.location[1], c.location[2]];
                obj.transform.rotationQuat = [
                  c.rotationQuat[0],
                  c.rotationQuat[1],
                  c.rotationQuat[2],
                  c.rotationQuat[3],
                ];
                obj.transform.scale = [c.scale[0], c.scale[1], c.scale[2]];
              }
            }
          });
          setModalTransform(null);
          return;
        }

        leftClickDownRef.current = {
          startX: pointerX,
          startY: pointerY,
          hasMoved: false,
          isAlt: e.altKey,
        };

        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Mock fallback
        }
      }

      // 4. Right Button (2) Cancels active modal transform
      if (e.button === 2 && modalTransform) {
        e.preventDefault();
        e.stopPropagation();
        modalTransform.session.cancel();
        setModalTransform(null);
      }
    },
    [width, height, vMat, pMat, modalTransform, setCursor, getPickableSceneObjects]
  );

  // Pointer Move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      // the stage is zoomed: the box is `width` x `height` in the page but drawn smaller (or larger) on screen
      const pointerX = (e.clientX - rect.left) * (rect.width > 0 ? width / rect.width : 1);
      const pointerY = (e.clientY - rect.top) * (rect.height > 0 ? height / rect.height : 1);

      // A. Camera Navigation
      if (navDragRef.current.active) {
        e.preventDefault();
        e.stopPropagation();

        const dx = e.clientX - navDragRef.current.lastX;
        const dy = e.clientY - navDragRef.current.lastY;

        navDragRef.current.lastX = e.clientX;
        navDragRef.current.lastY = e.clientY;

        const navDelta = navigationFromGesture({
          device: "mouse",
          button: 1,
          dx,
          dy,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
        });

        if (navDelta.action === "orbit") {
          setCamera((cam) => orbit(cam, navDelta.dx, navDelta.dy));
        } else if (navDelta.action === "pan") {
          setCamera((cam) => pan(cam, navDelta.dx, navDelta.dy, height));
        } else if (navDelta.action === "dolly") {
          setCamera((cam) => dolly(cam, navDelta.dollyDelta));
        }
        return;
      }

      // B. Modal Transform Mouse Move
      if (modalTransform) {
        const dx = e.clientX - modalTransform.startClientX;
        const dy = e.clientY - modalTransform.startClientY;
        modalTransform.session.moveMouse(dx, dy);

        // Preview transforms in document
        const preview = modalTransform.session.commit();
        const doc = getDocument();
        for (const c of preview) {
          const obj = doc.objects?.[c.id];
          if (obj) {
            obj.transform.location = [c.location[0], c.location[1], c.location[2]];
            obj.transform.rotationQuat = [
              c.rotationQuat[0],
              c.rotationQuat[1],
              c.rotationQuat[2],
              c.rotationQuat[3],
            ];
            obj.transform.scale = [c.scale[0], c.scale[1], c.scale[2]];
          }
        }

        setModalTransform((prev) =>
          prev ? { ...prev, statusText: formatStatus(prev.session) } : null
        );
        return;
      }

      // C. Left Click Drag (Box or Lasso select)
      const leftDown = leftClickDownRef.current;
      if (leftDown) {
        const dist = Math.hypot(pointerX - leftDown.startX, pointerY - leftDown.startY);
        if (dist > 4) {
          leftDown.hasMoved = true;
          if (leftDown.isAlt) {
            setLassoSelectState((prev) => ({
              points: [...(prev?.points ?? [{ x: leftDown.startX, y: leftDown.startY }]), { x: pointerX, y: pointerY }],
            }));
          } else {
            setBoxSelectState({
              startX: leftDown.startX,
              startY: leftDown.startY,
              currentX: pointerX,
              currentY: pointerY,
            });
          }
        }
      }
    },
    [modalTransform, setCamera, width, height]
  );

  // Pointer Up
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Release camera navigation
      if (navDragRef.current.active) {
        navDragRef.current.active = false;
        setIsNavigating(false);
        return;
      }

      const leftDown = leftClickDownRef.current;
      if (!leftDown) return;
      leftClickDownRef.current = null;

      const rect = e.currentTarget.getBoundingClientRect();
      // the stage is zoomed: the box is `width` x `height` in the page but drawn smaller (or larger) on screen
      const pointerX = (e.clientX - rect.left) * (rect.width > 0 ? width / rect.width : 1);
      const pointerY = (e.clientY - rect.top) * (rect.height > 0 ? height / rect.height : 1);

      const pickables = getPickableSceneObjects();

      // Case 1: Simple Click -> Single Object Picking
      if (!leftDown.hasMoved) {
        const ray = rayFromScreen(pointerX, pointerY, width, height, vMat, pMat);
        const hits = pickScene(
          { origin: ray.origin, dir: ray.dir },
          pickables
        );

        if (hits.length > 0) {
          const hitObjId = hits[0].objectId ?? null;
          const nextSel = click(selection, hitObjId, {
            shift: e.shiftKey,
            ctrl: e.ctrlKey || e.metaKey,
          });
          setSelection(nextSel);
        } else {
          if (!e.shiftKey) {
            setSelection(selectNone());
          }
        }
      } else {
        // Case 2: Dragged Box Selection or Lasso Selection
        const mode = e.shiftKey ? "add" : "replace";

        if (lassoSelectState && lassoSelectState.points.length > 2) {
          const nextSel = lassoSelect(
            selectables(pickables),
            lassoSelectState.points,
            vpMat,
            mode,
            { width, height },
            selection
          );
          setSelection(nextSel);
          setLassoSelectState(null);
        } else if (boxSelectState) {
          const minX = Math.min(boxSelectState.startX, boxSelectState.currentX);
          const maxX = Math.max(boxSelectState.startX, boxSelectState.currentX);
          const minY = Math.min(boxSelectState.startY, boxSelectState.currentY);
          const maxY = Math.max(boxSelectState.startY, boxSelectState.currentY);

          const nextSel = boxSelect(
            selectables(pickables),
            { x1: minX, y1: minY, x2: maxX, y2: maxY },
            vpMat,
            mode,
            { width, height },
            selection
          );
          setSelection(nextSel);
          setBoxSelectState(null);
        }
      }
    },
    [
      getPickableSceneObjects,
      width,
      height,
      vMat,
      pMat,
      vpMat,
      selection,
      setSelection,
      lassoSelectState,
      boxSelectState,
    ]
  );

  // Wheel Gesture -> Dolly
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = navigationFromGesture({
        device: "wheel",
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
      });

      if (delta.action === "dolly") {
        setCamera((cam) => dolly(cam, delta.dollyDelta));
      }
    },
    [setCamera]
  );

  // React onKeyDown for modal transformations (G / R / S, digits, axes, Enter, Escape)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // 1. While Modal Transform is Active
      if (modalTransform) {
        e.preventDefault();
        e.stopPropagation();

        const s = modalTransform.session;
        const key = e.key;

        if (key === "x" || key === "X") {
          s.setAxis("X", { plane: e.shiftKey });
        } else if (key === "y" || key === "Y") {
          s.setAxis("Y", { plane: e.shiftKey });
        } else if (key === "z" || key === "Z") {
          s.setAxis("Z", { plane: e.shiftKey });
        } else if ((key >= "0" && key <= "9") || key === ".") {
          s.typeChar(key);
        } else if (key === "-") {
          s.typeChar("-");
        } else if (key === "Backspace") {
          s.backspace();
        } else if (key === "Enter") {
          // Commit transform
          const committed = s.commit();
          documentCommands.mutate(`Transform ${modalTransform.mode}`, (draft) => {
            for (const c of committed) {
              const obj = draft.objects?.[c.id];
              if (obj) {
                obj.transform.location = [c.location[0], c.location[1], c.location[2]];
                obj.transform.rotationQuat = [
                  c.rotationQuat[0],
                  c.rotationQuat[1],
                  c.rotationQuat[2],
                  c.rotationQuat[3],
                ];
                obj.transform.scale = [c.scale[0], c.scale[1], c.scale[2]];
              }
            }
          });
          setModalTransform(null);
          return;
        } else if (key === "Escape") {
          // Cancel transform
          s.cancel();
          setModalTransform(null);
          return;
        }

        setModalTransform((prev) =>
          prev ? { ...prev, statusText: formatStatus(prev.session) } : null
        );
        return;
      }

      // 2. Not in modal transform: keys trigger commands
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        startModalTransform("translate");
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        startModalTransform("rotate");
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        startModalTransform("scale");
      } else if (e.key === "Escape") {
        // Exit scene editing mode
        useViewportStore.getState().setEditingSceneId(null);
      }
    },
    [modalTransform, startModalTransform]
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      data-testid="viewport-interaction"
      className={`ll:absolute ll:inset-0 ll:w-full ll:h-full ll:outline-none ll:overflow-hidden ll:select-none ${className}`}
      style={{
        cursor: isGizmoDragging
          ? "grabbing"
          : isNavigating
          ? "move"
          : modalTransform
          ? "crosshair"
          : "default",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => {
        // Prevent browser context menu on canvas
        e.preventDefault();
      }}
    >
      {/* 1. Transform Gizmo Overlay */}
      {!modalTransform && (
        <GizmoOverlay
          width={width}
          height={height}
          mode="translate"
          onDragStateChange={setIsGizmoDragging}
        />
      )}

      {/* 2. 3D Cursor SVG Indicator */}
      {cursorScreen.visible && (
        <svg
          data-testid="cursor-3d"
          className="ll:absolute ll:inset-0 ll:pointer-events-none"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          <g transform={`translate(${cursorScreen.x}, ${cursorScreen.y})`}>
            {/* Outer dotted/dashed red-white circle */}
            <circle
              r={9}
              fill="none"
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            {/* Inner crosshairs */}
            <line x1={-12} y1={0} x2={12} y2={0} stroke="#ef4444" strokeWidth={1} />
            <line x1={0} y1={-12} x2={0} y2={12} stroke="#ef4444" strokeWidth={1} />
            <circle r={2} fill="#ef4444" />
          </g>
        </svg>
      )}

      {/* 3. Box Select Preview */}
      {boxSelectState && (
        <div
          data-testid="box-select-rect"
          style={{
            position: "absolute",
            left: Math.min(boxSelectState.startX, boxSelectState.currentX),
            top: Math.min(boxSelectState.startY, boxSelectState.currentY),
            width: Math.abs(boxSelectState.currentX - boxSelectState.startX),
            height: Math.abs(boxSelectState.currentY - boxSelectState.startY),
            border: "1px dashed #3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.12)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 4. Lasso Select Preview */}
      {lassoSelectState && lassoSelectState.points.length > 1 && (
        <svg
          className="ll:absolute ll:inset-0 ll:pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        >
          <polygon
            points={lassoSelectState.points.map((p) => `${p.x},${p.y}`).join(" ")}
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="rgba(59, 130, 246, 0.12)"
          />
        </svg>
      )}

      {/* 5. Header Strip (SnapBar & Add Button) */}
      {/* the Add button comes first and the strip wraps, so a narrow scene never clips it */}
      <div
        className="ll:absolute ll:top-2 ll:left-2 ll:right-2 ll:z-10 ll:flex ll:flex-wrap ll:items-center ll:gap-2 ll:pointer-events-none"
        onPointerDown={(e) => e.stopPropagation()} /* controls here are not part of the 3D drag */
      >
        <div className="ll:pointer-events-auto">
          <AddMenuButton />
        </div>
        <SnapBar />
      </div>

      {/* 6. Navigation ViewCube */}
      <div className="ll:absolute ll:top-20 ll:right-2 ll:z-10" onPointerDown={(e) => e.stopPropagation()}>
        <ViewCube size={54} />
      </div>

      {/* 7. Modal Transform Status HUD */}
      <div className="ll:absolute ll:bottom-3 ll:left-3 ll:z-10">
        <TransformStatus state={modalTransform} />
      </div>

      {/* 8. Parametric Primitive Handles */}
      <PrimitiveHandles width={width} height={height} />

      {/* 9. 3D In-Place Text Editing Overlay */}
      <TextEditOverlay3d width={width} height={height} />

      {/* 10. Blender-style Add Menu (Shift+A) */}
      <AddMenu3d />
    </div>
  );
};

export default ViewportInteraction;
