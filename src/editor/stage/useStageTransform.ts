"use client";

import { getDocument } from "@/core/store/documentState";
import { worldBox } from "@/core/editing/layerBoxes";
import { subtreeIds } from "@/core/editing/cloneLayers";
import { moveLayers } from "@/core/layers/reparent";
import { frameAt } from "./createFromDrag";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { StageElement } from "./types";
import {
  STAGE_CONSTANTS,
  type ResizeHandleName,
} from "./constants";
import {
  snapMove,
  snapEdges,
  distanceMarks,
  type SnapLine,
  type SpacingMark,
  type Guide,
} from "@/core/geometry/snap";
import type { Rect } from "@/core/viewport/camera";
import {
  documentCommands,
  type DocumentTransaction,
} from "@/core/store/useDocumentStore";

interface UseStageTransformOptions {
  elements: Record<string, StageElement>;
  selectedIds: string[];
  artboardWidth: number;
  artboardHeight: number;
  zoom?: number;
  snapObjects?: boolean;
  snapGuides?: boolean;
  smartGuides?: boolean;
  snapThreshold?: number;
  onElementChange?: (id: string, patch: Partial<StageElement>) => void;
  onSelect?: (id: string | null, multi?: boolean) => void;
}

/** Puts a layer under the frame it was dropped on (or back on the page when dropped on none). One undo step; keeps its place. */
function reparentOnDrop(id: string): void {
  const layers = getDocument().layers;
  const layer = layers[id];
  if (!layer || layer.parentId === null || layer.locked) return;
  const box = worldBox(id);
  if (!box) return;
  const exclude = new Set(subtreeIds(layers, id));
  const target = frameAt({ x: box.cx, y: box.cy }, exclude);
  const root = Object.values(layers).find((l) => l.parentId === null)?.id ?? null;
  const parentId = target?.id ?? root;
  if (parentId && parentId !== layer.parentId) moveLayers([id], parentId);
}

export function useStageTransform({
  elements,
  selectedIds,
  artboardWidth,
  artboardHeight,
  zoom = STAGE_CONSTANTS.defaultZoom,
  snapObjects = true,
  snapGuides = true,
  smartGuides = true,
  snapThreshold = STAGE_CONSTANTS.defaultSnapThreshold,
  onElementChange,
  onSelect,
}: UseStageTransformOptions) {
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
  const [spacingMarks, setSpacingMarks] = useState<SpacingMark[]>([]);
  const [isGesturing, setIsGesturing] = useState(false);
  const txRef = useRef<DocumentTransaction | null>(null);

  const gestureRef = useRef<{
    type: "move" | "resize";
    handle?: ResizeHandleName;
    startClientX: number;
    startClientY: number;
    activeId: string;
    targetIds: string[];
    initialBoxes: Record<string, { x: number; y: number; width: number; height: number }>;
    aspectRatio?: number;
    hasMoved: boolean;
  } | null>(null);

  // Parent artboard rect for snapping
  const parentRect = useMemo<Rect>(
    () => ({
      x: 0,
      y: STAGE_CONSTANTS.artboardTitleHeight,
      width: artboardWidth,
      height: Math.max(0, artboardHeight - STAGE_CONSTANTS.artboardTitleHeight),
    }),
    [artboardWidth, artboardHeight]
  );

  // Center alignment guides
  const centerGuides = useMemo<Guide[]>(
    () =>
      snapGuides
        ? [
            { axis: "x", pos: artboardWidth / 2 },
            {
              axis: "y",
              pos: (artboardHeight + STAGE_CONSTANTS.artboardTitleHeight) / 2,
            },
          ]
        : [],
    [snapGuides, artboardWidth, artboardHeight]
  );

  const effectiveThreshold = snapThreshold / (zoom > 0 ? zoom : 1);

  // Start Move Gesture
  const startMove = useCallback(
    (elementId: string, e: React.PointerEvent) => {
      e.stopPropagation();
      const isSelected = selectedIds.includes(elementId);
      let targetIds = selectedIds;

      if (!isSelected) {
        if (e.shiftKey) {
          targetIds = [...selectedIds, elementId];
          onSelect?.(elementId, true);
        } else {
          targetIds = [elementId];
          onSelect?.(elementId, false);
        }
      }

      const initialBoxes: Record<
        string,
        { x: number; y: number; width: number; height: number }
      > = {};

      targetIds.forEach((id) => {
        const el = elements[id];
        if (el) {
          initialBoxes[id] = {
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
          };
        }
      });

      gestureRef.current = {
        type: "move",
        startClientX: e.clientX,
        startClientY: e.clientY,
        activeId: elementId,
        targetIds,
        initialBoxes,
        hasMoved: false,
      };

      try {
        txRef.current = documentCommands.begin("Move layer");
      } catch {
        // Document command transaction fallback for tests / standalone
      }

      setIsGesturing(true);
    },
    [selectedIds, elements, onSelect]
  );

  // Start Resize Gesture
  const startResize = useCallback(
    (handle: ResizeHandleName, e: React.PointerEvent) => {
      e.stopPropagation();
      if (selectedIds.length === 0) return;

      const activeId = selectedIds[0];
      const el = elements[activeId];
      if (!el) return;

      const initialBoxes: Record<
        string,
        { x: number; y: number; width: number; height: number }
      > = {
        [activeId]: {
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
        },
      };

      gestureRef.current = {
        type: "resize",
        handle,
        startClientX: e.clientX,
        startClientY: e.clientY,
        activeId,
        targetIds: [activeId],
        initialBoxes,
        aspectRatio: el.width > 0 && el.height > 0 ? el.width / el.height : 1,
        hasMoved: false,
      };

      try {
        txRef.current = documentCommands.begin("Resize layer");
      } catch {
        // Transaction begin fallback
      }

      setIsGesturing(true);
    },
    [selectedIds, elements]
  );

  // Pointer Move and Up global handlers
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;

      const scale = zoom > 0 ? zoom : 1;
      const rawDx = (e.clientX - gesture.startClientX) / (scale > 0 ? scale : 1);
      const rawDy = (e.clientY - gesture.startClientY) / (scale > 0 ? scale : 1);

      if (Math.abs(rawDx) > 1 || Math.abs(rawDy) > 1) {
        gesture.hasMoved = true;
      }

      if (gesture.type === "move") {
        let dx = rawDx;
        let dy = rawDy;

        // Shift constraint (axis lock)
        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) {
            dy = 0;
          } else {
            dx = 0;
          }
        }

        const primaryBox = gesture.initialBoxes[gesture.activeId];
        if (!primaryBox) return;

        const candidateRect: Rect = {
          x: primaryBox.x + dx,
          y: primaryBox.y + dy,
          width: primaryBox.width,
          height: primaryBox.height,
        };

        // Collect other element rects for snapping
        const otherRects: Rect[] = [];
        Object.values(elements).forEach((other) => {
          if (!gesture.targetIds.includes(other.id)) {
            otherRects.push({
              x: other.x,
              y: other.y,
              width: other.width,
              height: other.height,
            });
          }
        });

        // Compute object & guide snap
        let snapX = 0;
        let snapY = 0;
        let computedLines: SnapLine[] = [];
        let computedMarks: SpacingMark[] = [];

        if (snapObjects || smartGuides) {
          const snapRes = snapMove(
            candidateRect,
            otherRects,
            parentRect,
            centerGuides,
            effectiveThreshold,
            {
              objects: snapObjects,
              guides: snapGuides,
              grid: false,
              gridSize: 1,
            }
          );
          snapX = snapRes.dx;
          snapY = snapRes.dy;
          computedLines = snapRes.lines as SnapLine[];
          computedMarks = snapRes.spacing as SpacingMark[];
        }

        if (e.altKey) {
          const hud = distanceMarks(
            {
              x: candidateRect.x + snapX,
              y: candidateRect.y + snapY,
              width: candidateRect.width,
              height: candidateRect.height,
            },
            otherRects,
            parentRect
          );
          computedMarks = [...computedMarks, ...hud];
        }

        setSnapLines(computedLines);
        setSpacingMarks(computedMarks);

        const finalDx = Math.round(dx + snapX);
        const finalDy = Math.round(dy + snapY);

        // Apply moved positions
        gesture.targetIds.forEach((id) => {
          const init = gesture.initialBoxes[id];
          if (!init) return;
          const nextX = init.x + finalDx;
          const nextY = init.y + finalDy;

          onElementChange?.(id, { x: nextX, y: nextY });

          try {
            documentCommands.updateProps(id, {
              "frame.x": nextX - (elements[id]?.ox ?? 0),
              "frame.y": nextY - (elements[id]?.oy ?? 0),
            });
          } catch {
            // Document store update fallback
          }
        });
      } else if (gesture.type === "resize" && gesture.handle) {
        const handle = gesture.handle;
        const init = gesture.initialBoxes[gesture.activeId];
        if (!init) return;

        let nextX = init.x;
        let nextY = init.y;
        let nextWidth = init.width;
        let nextHeight = init.height;

        const fromCenter = e.altKey;
        const keepRatio = e.shiftKey;
        const ratio = gesture.aspectRatio || 1;

        let dx = rawDx;
        let dy = rawDy;

        // Snapping moving edges
        const edgeFlags = {
          left: handle === "nw" || handle === "w" || handle === "sw",
          right: handle === "ne" || handle === "e" || handle === "se",
          top: handle === "nw" || handle === "n" || handle === "ne",
          bottom: handle === "sw" || handle === "s" || handle === "se",
        };

        const otherRects: Rect[] = [];
        Object.values(elements).forEach((other) => {
          if (other.id !== gesture.activeId) {
            otherRects.push({
              x: other.x,
              y: other.y,
              width: other.width,
              height: other.height,
            });
          }
        });

        if (snapObjects && !keepRatio && !fromCenter) {
          const snapEdgesRes = snapEdges(
            { x: nextX, y: nextY, width: nextWidth, height: nextHeight },
            edgeFlags,
            otherRects,
            parentRect,
            centerGuides,
            effectiveThreshold,
            {
              objects: snapObjects,
              guides: snapGuides,
              grid: false,
              gridSize: 1,
            }
          );
          if (edgeFlags.right) dx += snapEdgesRes.right;
          if (edgeFlags.left) dx += snapEdgesRes.left;
          if (edgeFlags.bottom) dy += snapEdgesRes.bottom;
          if (edgeFlags.top) dy += snapEdgesRes.top;
        }

        // Horizontal sizing
        if (edgeFlags.right) {
          const grow = fromCenter ? dx * 2 : dx;
          nextWidth = Math.max(STAGE_CONSTANTS.minElementSize, init.width + grow);
          if (fromCenter) nextX = init.x - (nextWidth - init.width) / 2;
        } else if (edgeFlags.left) {
          const shrink = fromCenter ? dx * 2 : dx;
          nextWidth = Math.max(STAGE_CONSTANTS.minElementSize, init.width - shrink);
          nextX = fromCenter
            ? init.x - (nextWidth - init.width) / 2
            : init.x + (init.width - nextWidth);
        }

        // Vertical sizing
        if (edgeFlags.bottom) {
          const grow = fromCenter ? dy * 2 : dy;
          nextHeight = Math.max(STAGE_CONSTANTS.minElementSize, init.height + grow);
          if (fromCenter) nextY = init.y - (nextHeight - init.height) / 2;
        } else if (edgeFlags.top) {
          const shrink = fromCenter ? dy * 2 : dy;
          nextHeight = Math.max(STAGE_CONSTANTS.minElementSize, init.height - shrink);
          nextY = fromCenter
            ? init.y - (nextHeight - init.height) / 2
            : init.y + (init.height - nextHeight);
        }

        // Aspect ratio lock
        if (keepRatio) {
          if (handle === "e" || handle === "w") {
            nextHeight = Math.round(nextWidth / ratio);
          } else {
            nextWidth = Math.round(nextHeight * ratio);
          }
        }

        nextX = Math.round(nextX);
        nextY = Math.round(nextY);
        nextWidth = Math.round(nextWidth);
        nextHeight = Math.round(nextHeight);

        onElementChange?.(gesture.activeId, {
          x: nextX,
          y: nextY,
          width: nextWidth,
          height: nextHeight,
        });

        try {
          documentCommands.updateProps(gesture.activeId, {
            "frame.x": nextX - (elements[gesture.activeId]?.ox ?? 0),
            "frame.y": nextY - (elements[gesture.activeId]?.oy ?? 0),
            "frame.width": nextWidth,
            "frame.height": nextHeight,
          });
        } catch {
          // Document store update fallback
        }
      }
    };

    const handlePointerUp = () => {
      if (gestureRef.current) {
        const done = gestureRef.current;
        try {
          // Commit transform transaction
          txRef.current?.commit();
          txRef.current = null;
        } catch {
          // Commit fallback
        }
        // A layer dropped on a frame goes into it, and one dragged out of its frame goes back to the page.
        if (done.type === "move" && done.hasMoved && done.targetIds.length === 1) {
          try {
            reparentOnDrop(done.targetIds[0]);
          } catch {
            // a drop that cannot be made leaves the layer where it is
          }
        }
        gestureRef.current = null;
        setSnapLines([]);
        setSpacingMarks([]);
        setIsGesturing(false);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    zoom,
    elements,
    snapObjects,
    snapGuides,
    smartGuides,
    effectiveThreshold,
    parentRect,
    centerGuides,
    onElementChange,
  ]);

  // Keyboard navigation & nudging (Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIds.length === 0) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const step = e.shiftKey
        ? STAGE_CONSTANTS.nudgeShiftStep
        : STAGE_CONSTANTS.nudgeStep;

      let dx = 0;
      let dy = 0;

      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else if (e.key === "Escape") {
        if (gestureRef.current) {
          try {
            txRef.current?.cancel();
            txRef.current = null;
          } catch {
            // Cancel fallback
          }
          gestureRef.current = null;
          setSnapLines([]);
          setSpacingMarks([]);
          setIsGesturing(false);
        }
        onSelect?.(null);
        return;
      } else {
        return;
      }

      e.preventDefault();

      selectedIds.forEach((id) => {
        const el = elements[id];
        if (!el) return;
        const nextX = el.x + dx;
        const nextY = el.y + dy;

        onElementChange?.(id, { x: nextX, y: nextY });

        try {
          documentCommands.updateProps(id, {
            "frame.x": nextX - (el.ox ?? 0),
            "frame.y": nextY - (el.oy ?? 0),
          });
        } catch {
          // Document update fallback
        }
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, elements, onElementChange, onSelect]);

  return {
    isGesturing,
    snapLines,
    spacingMarks,
    startMove,
    startResize,
  };
}
