"use client";

import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import {
  Frame,
  Type,
  Square,
  Image as ImageIcon,
  Circle,
  Minus,
  Star,
  Hexagon,
  ChevronRight,
  Film,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { ContextMenu } from "@/editor/components/ContextMenu";
import { LayerContextMenuContent } from "./LayerContextMenu";
import type { LayerItem, LayerMenuAction } from "./types";
import { flattenLayers, filterTreeNodes, type FlatLayerNode } from "./treeFilter";
import { useTreeKeyboardNav } from "./useTreeKeyboardNav";
import { useLayersUiStore } from "@/core/store/useLayersUiStore";

export interface LayersTreeProps {
  layers: LayerItem[];
  selectedIds: string[];
  expandedIds: string[];
  searchQuery?: string;
  visibleNodes?: FlatLayerNode[];
  onSelect?: (id: string, e?: React.MouseEvent | React.KeyboardEvent) => void;
  onToggleExpand?: (id: string) => void;
  onToggleHidden?: (id: string) => void;
  onToggleLocked?: (id: string) => void;
  /** Returns why the move was refused, if it was. */
  onMoveLayer?: (ids: string[], parentId: string | null, index?: number) => string | void;
  onRename?: (id: string, newName: string) => void;
  onLayerAction?: (action: LayerMenuAction, id: string) => void;
  /** Show the motion badge on animated layers (design mode only, as in the prototype). */
  showMotion?: boolean;
}

function getLayerIcon(type?: string): React.ReactNode {
  switch (type) {
    case "text":
    case "input":
      return <Icon icon={Type} size={16} />;
    case "box":
    case "button":
    case "object3d":
      return <Icon icon={Square} size={16} />;
    case "image":
    case "background":
      return <Icon icon={ImageIcon} size={16} />;
    case "circle":
    case "toggle":
      return <Icon icon={Circle} size={16} />;
    case "line":
    case "divider":
      return <Icon icon={Minus} size={16} />;
    case "star":
    case "icon":
      return <Icon icon={Star} size={16} />;
    case "poly":
    case "shape":
      return <Icon icon={Hexagon} size={16} />;
    case "frame":
    default:
      return <Icon icon={Frame} size={16} />;
  }
}

function renderHighlightedName(name: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return name;
  const idx = name.toLowerCase().indexOf(q);
  if (idx < 0) return name;
  const before = name.slice(0, idx);
  const match = name.slice(idx, idx + q.length);
  const after = name.slice(idx + q.length);
  return (
    <>
      {before}
      <span className="hit ll-hit ll:text-primary ll:font-semibold">{match}</span>
      {after}
    </>
  );
}

interface DragState {
  id: string;
  startY: number;
  active: boolean;
  targetId: string | null;
  pos: "before" | "after" | "in" | null;
}

export const LayersTree: React.FC<LayersTreeProps> = ({
  layers,
  selectedIds,
  expandedIds,
  searchQuery = "",
  visibleNodes: propVisibleNodes,
  onSelect,
  onToggleExpand,
  onToggleHidden,
  onToggleLocked,
  onMoveLayer,
  onRename,
  onLayerAction,
  showMotion = true,
}) => {
  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const treeRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>("");
  const storeToastMsg = useLayersUiStore((s) => s.toastMsg);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Drag and drop state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  /** A drag that selects: started on empty space in the list or on a row that is not selected (a selected row drags to reorder). */
  const bandRef = useRef<{ startY: number; active: boolean; lastKey: string } | null>(null);
  const [band, setBand] = useState<{ top: number; height: number } | null>(null);
  const bandJustEnded = useRef(false);
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  const showToast = useCallback((msg: string) => {
    useLayersUiStore.getState().showToast(msg);
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const currentToast = storeToastMsg ?? toastMsg;

  // Derive visible nodes through shared pure filter function if not provided by parent
  const { visibleNodes } = useMemo(() => {
    if (propVisibleNodes) {
      return { visibleNodes: propVisibleNodes };
    }
    const all = flattenLayers(layers, expandedSet, selectedSet);
    return filterTreeNodes(all, searchQuery);
  }, [propVisibleNodes, layers, expandedSet, selectedSet, searchQuery]);

  // Synchronize roving tabindex on rendered treeitem rows
  const activeId = selectedIds[selectedIds.length - 1] || visibleNodes[0]?.id;
  useEffect(() => {
    const container = treeRef.current;
    if (!container) return;
    const rowEls = container.querySelectorAll<HTMLElement>('[role="treeitem"]');
    rowEls.forEach((el) => {
      const rowId = el.getAttribute("data-id");
      if (rowId === activeId) {
        el.tabIndex = 0;
      } else {
        el.tabIndex = -1;
      }
    });
  }, [activeId, visibleNodes]);

  // Shared roving keyboard navigation
  const baseKeyNav = useTreeKeyboardNav({
    visibleNodes,
    selectedIds,
    containerRef: treeRef,
    onSelect,
    onToggleExpand,
  });

  const handleTreeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "F2") {
      e.preventDefault();
      const target = visibleNodes.find((n) => n.id === activeId);
      if (target && !target.locked && onRename) {
        setEditingId(target.id);
        setDraftName(target.name);
      }
      return;
    }
    baseKeyNav(e);
  };

  const handleCommitRename = (id: string, originalName: string) => {
    setEditingId(null);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== originalName) {
      onRename?.(id, trimmed);
    }
  };

  // Subtree set calculation to prevent dropping into own descendants
  const getSubtreeIds = useCallback(
    (rootId: string): Set<string> => {
      const ids = new Set<string>([rootId]);
      let added = true;
      while (added) {
        added = false;
        for (const n of visibleNodes) {
          if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
            ids.add(n.id);
            added = true;
          }
        }
      }
      return ids;
    },
    [visibleNodes]
  );

  // Dragging across rows selects them (the rows the dragged box touches), so a run of layers can be picked with the mouse and deleted.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const b = bandRef.current;
      const tree = treeRef.current;
      if (!b || !tree) return;
      if (!b.active) {
        if (Math.abs(e.clientY - b.startY) < 4) return;
        b.active = true;
      }
      const box = tree.getBoundingClientRect();
      // near the top or bottom edge the list scrolls under the drag
      if (e.clientY < box.top + 24) tree.scrollTop -= 12;
      else if (e.clientY > box.bottom - 24) tree.scrollTop += 12;
      const y0 = Math.min(b.startY, e.clientY);
      const y1 = Math.max(b.startY, e.clientY);
      setBand({ top: y0 - box.top + tree.scrollTop, height: y1 - y0 });
      const hits = [...tree.querySelectorAll<HTMLElement>(".row[data-sel]")]
        .filter((row) => {
          const r = row.getBoundingClientRect();
          return r.bottom > y0 && r.top < y1;
        })
        .map((row) => row.getAttribute("data-sel") as string);
      if (hits.length === 0) return;
      const key = `${hits[0]}|${hits[hits.length - 1]}`;
      if (key === b.lastKey) return;
      b.lastKey = key;
      onSelect?.(hits[0]);
      if (hits.length > 1) onSelect?.(hits[hits.length - 1], { shiftKey: true } as React.MouseEvent);
    };
    const onUp = () => {
      const b = bandRef.current;
      bandRef.current = null;
      if (!b) return;
      setBand(null);
      if (b.active) {
        bandJustEnded.current = true; // the click that follows a drag must not pick one row again
        window.setTimeout(() => {
          bandJustEnded.current = false; // (no click follows when the drag ends on another row)
        }, 60);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onSelect]);

  /** A row that is part of the selection drags the whole selection. */
  const movingIds = useCallback((id: string): string[] => (selectedIds.includes(id) ? [...selectedIds] : [id]), [selectedIds]);

  // Global pointer move & up listeners for drag-to-reorder and drag-to-timeline
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const current = dragStateRef.current;
      if (!current) return;

      if (!current.active) {
        if (Math.abs(e.clientY - current.startY) < 5) return;
        current.active = true;
      }

      // Check if dragging over timeline drop zone (.tl)
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const tl = el?.closest(".tl, #tldz");
      if (tl) {
        setDragState({ ...current, targetId: null, pos: null });
        return;
      }

      const moving = movingIds(current.id);
      const blocked = new Set(moving.flatMap((id) => [...getSubtreeIds(id)]));

      const targetEl = el?.closest('#p-layers .row[data-sel]');
      if (!targetEl) {
        // below the last row: the bottom of the page's own list
        const last = el?.closest("#p-layers") ? [...visibleNodes].reverse().find((n) => n.level === 0 && !blocked.has(n.id)) : undefined;
        setDragState({ ...current, targetId: last?.id ?? null, pos: last ? "after" : null });
        return;
      }
      const targetId = targetEl.getAttribute("data-sel");
      if (!targetId || blocked.has(targetId)) {
        setDragState({ ...current, targetId: null, pos: null });
        return;
      }

      const b = targetEl.getBoundingClientRect();
      const f = (e.clientY - b.top) / b.height;
      const node = visibleNodes.find((n) => n.id === targetId);
      // Only a frame can take layers inside it. On any other row the drop goes beside it (so into the frame that row is in).
      const holds = node?.item.type === "frame" || node?.item.type === "container";
      const pos = !node?.parentId ? "in" : holds ? (f < 0.25 ? "before" : f > 0.75 ? "after" : "in") : f < 0.5 ? "before" : "after";

      setDragState({
        ...current,
        targetId,
        pos,
      });
    };

    const handlePointerUp = (e: PointerEvent) => {
      const current = dragStateRef.current;
      if (!current) return;
      setDragState(null);

      if (!current.active) return;

      // Check if dropped onto timeline
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const tl = el?.closest(".tl, #tldz");
      if (tl) {
        const motionBtn = document.querySelector<HTMLButtonElement>('button[data-mode="motion"]');
        if (motionBtn) motionBtn.click();
        onSelect?.(current.id);
        return;
      }

      if (!current.targetId || !current.pos) return;

      const targetNode = visibleNodes.find((n) => n.id === current.targetId);
      if (!targetNode) return;

      const moving = movingIds(current.id);
      let refused: string | void;
      if (current.pos === "in" || !targetNode.parentId) {
        // no index: on top of what the frame already holds, as it would be if it had just been drawn there
        refused = onMoveLayer?.(moving, current.targetId);
        if (!refused && !expandedSet.has(current.targetId)) {
          onToggleExpand?.(current.targetId);
        }
      } else {
        // The list runs front to back and `children` runs back to front, and the index counts after the moved layers have left.
        const parentId = targetNode.parentId;
        const siblings = visibleNodes.filter((n) => n.parentId === parentId && !moving.includes(n.id));
        const shownAt = siblings.findIndex((n) => n.id === current.targetId);
        const index = current.pos === "before" ? siblings.length - shownAt : siblings.length - 1 - shownAt;
        refused = onMoveLayer?.(moving, parentId, Math.max(0, index));
      }
      if (refused) showToast(refused);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [visibleNodes, getSubtreeIds, movingIds, onMoveLayer, onSelect, expandedSet, onToggleExpand, showToast]);

  return (
    <div
      ref={treeRef}
      id="p-layers"
      data-testid="layer-tree"
      role="tree"
      tabIndex={visibleNodes.length === 0 ? 0 : -1}
      aria-label="Layers"
      onKeyDown={handleTreeKeyDown}
      onPointerDown={(e) => {
        // empty space in the list: a drag from here selects the rows it touches
        if (e.button === 0 && e.target === e.currentTarget) bandRef.current = { startY: e.clientY, active: false, lastKey: "" };
      }}
      className="zbody ll-zbody ll:relative ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:outline-none"
    >
      {band && (
        <div
          aria-hidden="true"
          data-testid="layers-band"
          style={{ position: "absolute", left: 0, right: 0, top: band.top, height: band.height, zIndex: 5, pointerEvents: "none", background: "color-mix(in srgb, var(--ll-text-primary) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--ll-text-primary) 45%, transparent)" }}
        />
      )}
      {visibleNodes.length > 0 ? (
        visibleNodes.map((node) => {
          const isSelected = selectedSet.has(node.id);
          const targetIds = isSelected ? selectedIds : [node.id];
          const isBeingDragged = dragState?.active && (selectedSet.has(dragState.id) ? isSelected : dragState.id === node.id);
          const isDropTarget = dragState?.active && dragState?.targetId === node.id;
          const dropPos = isDropTarget ? dragState?.pos : null;

          return (
            <div
              key={node.id}
              role="presentation"
              className="ll:contents"
              onContextMenuCapture={() => {
                if (!selectedSet.has(node.id)) onSelect?.(node.id);
              }}
            >
              <ContextMenu
                content={
                  <LayerContextMenuContent
                    selectionCount={targetIds.length}
                    onAction={(action) => onLayerAction?.(action, node.id)}
                    onToggleHidden={() => targetIds.forEach((id) => onToggleHidden?.(id))}
                    onToggleLocked={() => targetIds.forEach((id) => onToggleLocked?.(id))}
                  />
                }
              >
                <button
                  type="button"
                  role="treeitem"
                  data-sel={node.id}
                  data-id={node.id}
                  data-testid="layer-row"
                  data-layer-id={node.id}
                  data-depth={node.level}
                  data-selected={isSelected ? "true" : "false"}
                  aria-selected={isSelected}
                  aria-expanded={node.hasChildren ? node.expanded : undefined}
                  style={{
                    paddingLeft: `calc(16px + ${node.level} * 16px)`,
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    const target = e.target as HTMLElement;
                    if (target.closest(".mb, .act, input, button:not([role=treeitem])")) return;
                    if (!isSelected) {
                      // a row that is not selected: dragging from it selects the rows it sweeps over
                      bandRef.current = { startY: e.clientY, active: false, lastKey: "" };
                      return;
                    }
                    setDragState({
                      id: node.id,
                      startY: e.clientY,
                      active: false,
                      targetId: null,
                      pos: null,
                    });
                  }}
                  onClick={(e) => {
                    if (bandJustEnded.current) {
                      bandJustEnded.current = false;
                      return;
                    }
                    onSelect?.(node.id, e);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (!node.locked && onRename) {
                      setEditingId(node.id);
                      setDraftName(node.name);
                    }
                  }}
                  className={`row ll-row ll:group ll:relative ll:flex ll:items-center ll:gap-2 ll:h-8 ll:pr-3 ll:text-left ll:w-full ll:whitespace-nowrap ll:select-none ll:outline-none ll:cursor-pointer ll:text-body ll:font-normal ll:transition-none ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${
                    isBeingDragged ? "ldrag ll:opacity-50" : ""
                  } ${
                    dropPos === "before"
                      ? "ldb"
                      : dropPos === "after"
                      ? "lda"
                      : dropPos === "in"
                      ? "ldi ll:bg-surface-hover"
                      : ""
                  } ${
                    isSelected
                      ? "ll:bg-select-bg ll:text-select-fg"
                      : "ll:text-secondary ll:hover:bg-surface-canvas ll:hover:text-primary"
                  } ${node.hidden ? "ll:opacity-40" : ""}`}
                >
                  {/* Chevron: rotated 90deg on expanded, empty 12px span on leaf node */}
                  {node.hasChildren ? (
                    <span
                      role="button"
                      aria-label={node.expanded ? "Collapse" : "Expand"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand?.(node.id);
                      }}
                      className="c ll-c ll:w-3 ll:h-3 ll:grid ll:place-items-center ll:shrink-0 ll:text-muted ll:hover:text-primary"
                    >
                      <Icon
                        icon={ChevronRight}
                        size={12}
                        className={`ll:transition-transform ll:duration-120 ${
                          node.expanded ? "ll:rotate-90" : ""
                        }`}
                      />
                    </span>
                  ) : (
                    <span className="c ll-c ll:w-3 ll:h-3 ll:shrink-0" />
                  )}

                  {/* Type icon (16x16 matching prototype) */}
                  <span
                    className={`ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:shrink-0 ${
                      isSelected ? "ll:text-select-fg" : "ll:text-muted ll:group-hover:text-primary"
                    }`}
                  >
                    {getLayerIcon(node.item.type)}
                  </span>

                  {/* Layer name */}
                  <div data-testid="layer-name" className="nm ll-nm ll:flex-1 ll:min-w-0 ll:truncate ll:text-body">
                    {editingId === node.id ? (
                      <input
                        type="text"
                        value={draftName}
                        autoFocus
                        aria-label="Rename layer"
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={() => handleCommitRename(node.id, node.name)}
                        onKeyUp={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation(); // Space and the arrows belong to the name being typed, not to the row
                          if (e.key === "Enter") handleCommitRename(node.id, node.name);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rnin ll-rnin ll:w-full ll:h-6 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-primary ll:rounded-sm ll:outline-none ll:text-body ll:text-primary ll:font-sans"
                      />
                    ) : (
                      <span className="ll:truncate ll:block">
                        {renderHighlightedName(node.name, searchQuery)}
                      </span>
                    )}
                  </div>

                  {/* Actions: Eye (visibility) and Lock (sits before motion badge in P) */}
                  <span className="act ll-act ll:flex ll:items-center ll:gap-0.5 ll:shrink-0 ll:opacity-0 ll:group-hover:opacity-100 ll:transition-opacity ll:text-muted">
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={node.hidden ? "Show layer" : "Hide layer"}
                      title={node.hidden ? "Show layer" : "Hide layer"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleHidden?.(node.id);
                      }}
                      className="ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:cursor-pointer"
                    >
                      <Icon icon={node.hidden ? EyeOff : Eye} size={16} />
                    </span>
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={node.locked ? "Unlock layer" : "Lock layer"}
                      title={node.locked ? "Unlock layer" : "Lock layer"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLocked?.(node.id);
                      }}
                      className="ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:cursor-pointer"
                    >
                      <Icon icon={node.locked ? Lock : Unlock} size={16} />
                    </span>
                  </span>

                  {/* Motion Badge for animated layers (sits at right end of row after act) */}
                  {showMotion && node.hasMotion && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Animated, open in Motion"
                      title="Animated, open in Motion"
                      onClick={(e) => {
                        e.stopPropagation();
                        const motionBtn = document.querySelector<HTMLButtonElement>(
                          'button[data-mode="motion"]'
                        );
                        if (motionBtn) {
                          motionBtn.click();
                        }
                        onSelect?.(node.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          const motionBtn = document.querySelector<HTMLButtonElement>(
                            'button[data-mode="motion"]'
                          );
                          if (motionBtn) {
                            motionBtn.click();
                          }
                          onSelect?.(node.id);
                        }
                      }}
                      className="mb ll-mb ll:w-5 ll:h-5 ll:grid ll:place-items-center ll:shrink-0 ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar ll:rounded-sm ll:cursor-pointer"
                    >
                      <Icon icon={Film} size={12} />
                    </span>
                  )}
                </button>
              </ContextMenu>
            </div>
          );
        })
      ) : searchQuery.trim().length > 0 ? (
        <div id="lsnone" className="lsnone ll-lsnone ll:p-4 ll:text-muted ll:text-body">
          No layers found
        </div>
      ) : (
        <div id="lsnone" className="lsnone ll-lsnone ll:p-4 ll:text-muted ll:text-body">
          No layers
        </div>
      )}

      {/* Floating status toast message (e.g. "Only frames can hold layers") */}
      <div
        id="lmsg"
        role="status"
        className={`lmsg ll-lmsg ${currentToast ? "on" : ""}`}
      >
        {currentToast}
      </div>
    </div>
  );
};
