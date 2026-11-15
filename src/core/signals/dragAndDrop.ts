/**
 * @file dragAndDrop.ts
 * @module core/signals/dragAndDrop
 * @description Phase 150: Drop zones, animated sortable lists & grids (pointer + keyboard),
 * swipe-to-remove rows, and typed drop/reorder/remove events for rules & Blueprints.
 */

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface DropZoneSpec {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly accepts?: readonly string[];
  readonly priority?: number;
}

export interface DropZoneHit {
  readonly zoneId: string;
  readonly localX: number;
  readonly localY: number;
  readonly normalizedX: number;
  readonly normalizedY: number;
}

export type SortableLayoutMode = "vertical-list" | "horizontal-list" | "grid";

export interface SortableSpec {
  readonly itemIds: readonly string[];
  readonly mode: SortableLayoutMode;
  readonly itemWidth: number;
  readonly itemHeight: number;
  readonly gap?: number;
  readonly columns?: number;
  readonly swipeRemoveThresholdPx?: number;
  readonly animationStiffness?: number;
}

export type DragDropEventType =
  | "pickup"
  | "hoverZone"
  | "reorder"
  | "drop"
  | "remove"
  | "cancel";

export interface DragDropEvent {
  readonly type: DragDropEventType;
  readonly itemId: string;
  readonly fromIndex?: number;
  readonly toIndex?: number;
  readonly zoneId?: string | null;
  readonly source: "pointer" | "keyboard" | "swipe";
}

export interface SortableItemPose {
  readonly id: string;
  readonly index: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly visualX: number;
  readonly visualY: number;
  readonly dragging: boolean;
  readonly swipeOffsetX: number;
}

export interface SortableSnapshot {
  readonly order: readonly string[];
  readonly activeItemId: string | null;
  readonly activeMode: "idle" | "pointer" | "keyboard";
  readonly hoveredZoneId: string | null;
  readonly items: readonly SortableItemPose[];
  readonly events: readonly DragDropEvent[];
}

export interface SortableController {
  beginDrag(itemId: string, pointerX: number, pointerY: number): SortableSnapshot;
  moveDrag(
    pointerX: number,
    pointerY: number,
    zones?: readonly DropZoneSpec[],
    itemKind?: string,
  ): SortableSnapshot;
  endDrag(zones?: readonly DropZoneSpec[], itemKind?: string): SortableSnapshot;
  cancelDrag(): SortableSnapshot;
  pickUpKeyboard(itemId: string): SortableSnapshot;
  moveKeyboard(direction: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"): SortableSnapshot;
  dropKeyboard(): SortableSnapshot;
  swipeRow(itemId: string, deltaX: number, commitRelease?: boolean): SortableSnapshot;
  stepAnimation(dtSec: number): SortableSnapshot;
  consumeEvents(): readonly DragDropEvent[];
  snapshot(): SortableSnapshot;
}

/** Hit-tests pointer coordinates against drop zones with optional `accepts` and `priority`. */
export function resolveDropZone(
  pointer: Point2D,
  zones: readonly DropZoneSpec[],
  itemKind?: string,
): DropZoneHit | null {
  let best: DropZoneSpec | null = null;
  let bestPriority = -Infinity;

  for (const zone of zones) {
    if (zone.width <= 0 || zone.height <= 0) continue;
    const inside =
      pointer.x >= zone.x &&
      pointer.x <= zone.x + zone.width &&
      pointer.y >= zone.y &&
      pointer.y <= zone.y + zone.height;
    if (!inside) continue;

    if (zone.accepts && zone.accepts.length > 0 && itemKind !== undefined) {
      if (!zone.accepts.includes(itemKind)) continue;
    }

    const priority = zone.priority ?? 0;
    if (priority >= bestPriority) {
      best = zone;
      bestPriority = priority;
    }
  }

  if (!best) return null;
  const localX = pointer.x - best.x;
  const localY = pointer.y - best.y;
  return {
    zoneId: best.id,
    localX,
    localY,
    normalizedX: Math.min(1, Math.max(0, localX / best.width)),
    normalizedY: Math.min(1, Math.max(0, localY / best.height)),
  };
}

function slotCoordinates(
  index: number,
  mode: SortableLayoutMode,
  itemWidth: number,
  itemHeight: number,
  gap: number,
  columns: number,
): Point2D {
  if (mode === "vertical-list") {
    return { x: 0, y: index * (itemHeight + gap) };
  }
  if (mode === "horizontal-list") {
    return { x: index * (itemWidth + gap), y: 0 };
  }
  const col = index % columns;
  const row = Math.floor(index / columns);
  return {
    x: col * (itemWidth + gap),
    y: row * (itemHeight + gap),
  };
}

function arrayMove<T>(arr: readonly T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  if (item !== undefined) {
    copy.splice(to, 0, item);
  }
  return copy;
}

/**
 * Creates a sortable list/grid controller supporting pointer drag reordering,
 * keyboard accessibility reordering, animated sibling displacement, drop-zone events,
 * and swipe-to-remove row behavior.
 */
export function createSortableController(spec: SortableSpec): SortableController {
  const gap = Math.max(0, spec.gap ?? 8);
  const columns = Math.max(1, Math.floor(spec.columns ?? 3));
  const swipeThreshold = Math.max(20, spec.swipeRemoveThresholdPx ?? 96);
  const stiffness = Math.max(1, spec.animationStiffness ?? 18);

  let order = [...spec.itemIds];
  let savedOrderBeforeDrag = [...order];
  let activeItemId: string | null = null;
  let activeMode: "idle" | "pointer" | "keyboard" = "idle";
  let dragStartPointer: Point2D = { x: 0, y: 0 };
  let dragStartItemOrigin: Point2D = { x: 0, y: 0 };
  let hoveredZoneId: string | null = null;

  const visualCoords = new Map<string, { x: number; y: number }>();
  const swipeOffsets = new Map<string, number>();
  const eventQueue: DragDropEvent[] = [];

  for (let i = 0; i < order.length; i++) {
    const id = order[i]!;
    visualCoords.set(id, { ...slotCoordinates(i, spec.mode, spec.itemWidth, spec.itemHeight, gap, columns) });
    swipeOffsets.set(id, 0);
  }

  const pushEvent = (event: DragDropEvent): void => {
    eventQueue.push(event);
  };

  const findNearestSlotIndex = (x: number, y: number): number => {
    let bestIdx = 0;
    let bestDistSq = Infinity;
    for (let i = 0; i < order.length; i++) {
      const slot = slotCoordinates(i, spec.mode, spec.itemWidth, spec.itemHeight, gap, columns);
      const dx = x - slot.x;
      const dy = y - slot.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIdx = i;
      }
    }
    return bestIdx;
  };

  const buildSnapshot = (): SortableSnapshot => {
    const items: SortableItemPose[] = order.map((id, idx) => {
      const target = slotCoordinates(idx, spec.mode, spec.itemWidth, spec.itemHeight, gap, columns);
      const visual = visualCoords.get(id) ?? target;
      return {
        id,
        index: idx,
        targetX: target.x,
        targetY: target.y,
        visualX: visual.x,
        visualY: visual.y,
        dragging: id === activeItemId,
        swipeOffsetX: swipeOffsets.get(id) ?? 0,
      };
    });
    return {
      order: [...order],
      activeItemId,
      activeMode,
      hoveredZoneId,
      items,
      events: [...eventQueue],
    };
  };

  return {
    beginDrag(itemId: string, pointerX: number, pointerY: number): SortableSnapshot {
      const idx = order.indexOf(itemId);
      if (idx === -1) return buildSnapshot();
      savedOrderBeforeDrag = [...order];
      activeItemId = itemId;
      activeMode = "pointer";
      hoveredZoneId = null;
      dragStartPointer = { x: pointerX, y: pointerY };
      const slot = slotCoordinates(idx, spec.mode, spec.itemWidth, spec.itemHeight, gap, columns);
      dragStartItemOrigin = { x: slot.x, y: slot.y };
      visualCoords.set(itemId, { ...slot });
      pushEvent({
        type: "pickup",
        itemId,
        fromIndex: idx,
        source: "pointer",
      });
      return buildSnapshot();
    },

    moveDrag(pointerX, pointerY, zones = [], itemKind): SortableSnapshot {
      if (!activeItemId || activeMode !== "pointer") return buildSnapshot();
      const idx = order.indexOf(activeItemId);
      if (idx === -1) return buildSnapshot();

      const dx = pointerX - dragStartPointer.x;
      const dy = pointerY - dragStartPointer.y;
      const dragX = dragStartItemOrigin.x + dx;
      const dragY = dragStartItemOrigin.y + dy;
      visualCoords.set(activeItemId, { x: dragX, y: dragY });

      const zoneHit = resolveDropZone({ x: pointerX, y: pointerY }, zones, itemKind);
      const nextZoneId = zoneHit ? zoneHit.zoneId : null;
      if (nextZoneId !== hoveredZoneId) {
        hoveredZoneId = nextZoneId;
        pushEvent({
          type: "hoverZone",
          itemId: activeItemId,
          zoneId: hoveredZoneId,
          source: "pointer",
        });
      }

      const targetIdx = findNearestSlotIndex(dragX, dragY);
      if (targetIdx !== idx) {
        order = arrayMove(order, idx, targetIdx);
        pushEvent({
          type: "reorder",
          itemId: activeItemId,
          fromIndex: idx,
          toIndex: targetIdx,
          source: "pointer",
        });
      }

      return buildSnapshot();
    },

    endDrag(zones = [], itemKind): SortableSnapshot {
      if (!activeItemId || activeMode !== "pointer") return buildSnapshot();
      const itemId = activeItemId;
      const currentVisual = visualCoords.get(itemId);
      const dropCenter: Point2D = currentVisual
        ? { x: currentVisual.x + spec.itemWidth * 0.5, y: currentVisual.y + spec.itemHeight * 0.5 }
        : dragStartPointer;

      const hit = resolveDropZone(dropCenter, zones, itemKind);
      const toIndex = order.indexOf(itemId);
      const fromIndex = savedOrderBeforeDrag.indexOf(itemId);

      pushEvent({
        type: "drop",
        itemId,
        fromIndex,
        toIndex,
        zoneId: hit ? hit.zoneId : hoveredZoneId,
        source: "pointer",
      });

      activeItemId = null;
      activeMode = "idle";
      hoveredZoneId = null;
      return buildSnapshot();
    },

    cancelDrag(): SortableSnapshot {
      if (!activeItemId) return buildSnapshot();
      const itemId = activeItemId;
      const source = activeMode === "keyboard" ? "keyboard" : "pointer";
      order = [...savedOrderBeforeDrag];
      activeItemId = null;
      activeMode = "idle";
      hoveredZoneId = null;
      pushEvent({
        type: "cancel",
        itemId,
        source,
      });
      return buildSnapshot();
    },

    pickUpKeyboard(itemId: string): SortableSnapshot {
      const idx = order.indexOf(itemId);
      if (idx === -1) return buildSnapshot();
      savedOrderBeforeDrag = [...order];
      activeItemId = itemId;
      activeMode = "keyboard";
      pushEvent({
        type: "pickup",
        itemId,
        fromIndex: idx,
        source: "keyboard",
      });
      return buildSnapshot();
    },

    moveKeyboard(direction): SortableSnapshot {
      if (!activeItemId || activeMode !== "keyboard") return buildSnapshot();
      const fromIndex = order.indexOf(activeItemId);
      if (fromIndex === -1) return buildSnapshot();

      let delta = 0;
      if (spec.mode === "vertical-list") {
        delta = direction === "ArrowUp" ? -1 : direction === "ArrowDown" ? 1 : 0;
      } else if (spec.mode === "horizontal-list") {
        delta = direction === "ArrowLeft" ? -1 : direction === "ArrowRight" ? 1 : 0;
      } else {
        if (direction === "ArrowLeft") delta = -1;
        else if (direction === "ArrowRight") delta = 1;
        else if (direction === "ArrowUp") delta = -columns;
        else if (direction === "ArrowDown") delta = columns;
      }

      const nextIndex = Math.max(0, Math.min(order.length - 1, fromIndex + delta));
      if (nextIndex !== fromIndex) {
        order = arrayMove(order, fromIndex, nextIndex);
        pushEvent({
          type: "reorder",
          itemId: activeItemId,
          fromIndex,
          toIndex: nextIndex,
          source: "keyboard",
        });
      }
      return buildSnapshot();
    },

    dropKeyboard(): SortableSnapshot {
      if (!activeItemId || activeMode !== "keyboard") return buildSnapshot();
      const itemId = activeItemId;
      const toIndex = order.indexOf(itemId);
      const fromIndex = savedOrderBeforeDrag.indexOf(itemId);
      pushEvent({
        type: "drop",
        itemId,
        fromIndex,
        toIndex,
        zoneId: null,
        source: "keyboard",
      });
      activeItemId = null;
      activeMode = "idle";
      return buildSnapshot();
    },

    swipeRow(itemId: string, deltaX: number, commitRelease = false): SortableSnapshot {
      const idx = order.indexOf(itemId);
      if (idx === -1) return buildSnapshot();
      const safeDelta = Number.isFinite(deltaX) ? deltaX : 0;
      swipeOffsets.set(itemId, safeDelta);

      if (commitRelease) {
        if (Math.abs(safeDelta) >= swipeThreshold) {
          order = order.filter((id) => id !== itemId);
          swipeOffsets.delete(itemId);
          visualCoords.delete(itemId);
          pushEvent({
            type: "remove",
            itemId,
            fromIndex: idx,
            source: "swipe",
          });
        } else {
          swipeOffsets.set(itemId, 0);
        }
      }
      return buildSnapshot();
    },

    stepAnimation(dtSec: number): SortableSnapshot {
      const dt = Math.max(0, Math.min(0.25, Number.isFinite(dtSec) ? dtSec : 0));
      const blend = 1 - Math.exp(-stiffness * dt);
      for (let i = 0; i < order.length; i++) {
        const id = order[i]!;
        if (id === activeItemId && activeMode === "pointer") {
          continue;
        }
        const target = slotCoordinates(i, spec.mode, spec.itemWidth, spec.itemHeight, gap, columns);
        const current = visualCoords.get(id) ?? target;
        const nextX = current.x + (target.x - current.x) * blend;
        const nextY = current.y + (target.y - current.y) * blend;
        visualCoords.set(id, { x: nextX, y: nextY });
      }
      return buildSnapshot();
    },

    consumeEvents(): readonly DragDropEvent[] {
      return eventQueue.splice(0, eventQueue.length);
    },

    snapshot: buildSnapshot,
  };
}
