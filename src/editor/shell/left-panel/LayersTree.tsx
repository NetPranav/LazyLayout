"use client";

import React, { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
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
import { getMotion, prefersReducedMotion } from "@/editor/motion/feel";
import { springEase, springAnim } from "@/editor/motion/ease";
import { Spring } from "@/editor/motion/spring";
import { simAdd, type Sim } from "@/editor/motion/loop";
import {
  ROW_HEIGHT_PX,
  BASE_INDENT_PX,
  LEVEL_INDENT_PX,
  ICON_SIZE_PX,
  CHEVRON_SIZE_PX,
  DRAG_THRESHOLD_PX,
  TOAST_DURATION_MS,
  LOCK_DROP_OFFSET_PX,
  EYE_BLINK_SCALE_Y,
  BAND_STRETCH_FACTOR,
} from "./constants";

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
  onMoveLayer?: (ids: string[], parentId: string | null, index?: number) => void;
  onRename?: (id: string, newName: string) => void;
  onLayerAction?: (action: LayerMenuAction, id: string) => void;
  /** Show the motion badge on animated layers (design mode only). */
  showMotion?: boolean;
}

function getLayerIcon(type?: string): React.ReactNode {
  switch (type) {
    case "text":
    case "input":
      return <Icon icon={Type} size={ICON_SIZE_PX} />;
    case "box":
    case "button":
    case "object3d":
      return <Icon icon={Square} size={ICON_SIZE_PX} />;
    case "image":
    case "background":
      return <Icon icon={ImageIcon} size={ICON_SIZE_PX} />;
    case "circle":
    case "toggle":
      return <Icon icon={Circle} size={ICON_SIZE_PX} />;
    case "line":
    case "divider":
      return <Icon icon={Minus} size={ICON_SIZE_PX} />;
    case "star":
    case "icon":
      return <Icon icon={Star} size={ICON_SIZE_PX} />;
    case "poly":
    case "shape":
      return <Icon icon={Hexagon} size={ICON_SIZE_PX} />;
    case "frame":
    default:
      return <Icon icon={Frame} size={ICON_SIZE_PX} />;
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
      <span className="hit ll-hit">{match}</span>
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
  const selBandRef = useRef<HTMLElement>(null);
  const hovBandRef = useRef<HTMLElement>(null);
  const dropLineRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Drag and drop state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), TOAST_DURATION_MS);
  }, []);

  // Derive visible nodes through shared pure filter function if not provided by parent
  const { visibleNodes } = useMemo(() => {
    if (propVisibleNodes) {
      return { visibleNodes: propVisibleNodes };
    }
    const all = flattenLayers(layers, expandedSet, selectedSet);
    return filterTreeNodes(all, searchQuery, { keepCollapsed: true });
  }, [propVisibleNodes, layers, expandedSet, selectedSet, searchQuery]);

  // Compute Ancestor IDs for ancestor tint (.anc)
  const ancestorIds = useMemo(() => {
    const set = new Set<string>();
    if (selectedIds.length === 0) return set;
    for (const selId of selectedIds) {
      const node = visibleNodes.find((n) => n.id === selId);
      let curParentId = node?.parentId;
      while (curParentId) {
        set.add(curParentId);
        const parentNode = visibleNodes.find((n) => n.id === curParentId);
        curParentId = parentNode?.parentId;
      }
    }
    return set;
  }, [selectedIds, visibleNodes]);

  // ==================== Real Spring Highlight Bands ====================
  const selSpringRef = useRef<Spring | null>(null);
  const hovSpringRef = useRef<Spring | null>(null);
  const bumpSpringRef = useRef<Spring | null>(null);

  if (selSpringRef.current == null) {
    selSpringRef.current = new Spring(0, [0.26, 0.6]);
  }
  if (hovSpringRef.current == null) {
    hovSpringRef.current = new Spring(0, [0.22, 0.75]);
  }
  if (bumpSpringRef.current == null) {
    bumpSpringRef.current = new Spring(0, [0.26, 0.5]);
  }

  // Paint highlight band with stretch along velocity
  const paintBand = useCallback((el: HTMLElement | null, sp: Spring, stretchFactor: number) => {
    if (!el) return;
    const v = sp.v;
    const stretch = getMotion().current().stretch;
    const s = 1 + Math.min(0.5, Math.abs(v) * stretch * BAND_STRETCH_FACTOR * stretchFactor);
    el.style.transform = `translateY(${sp.x.toFixed(2)}px) scaleY(${s.toFixed(3)})`;
    el.style.transformOrigin = v > 0 ? "50% 0" : "50% 100%";
  }, []);

  // Setup spring simulations
  useEffect(() => {
    const selBand = selBandRef.current;
    const hovBand = hovBandRef.current;
    const tree = treeRef.current;

    const selSim: Sim = {
      sp: [selSpringRef.current!],
      apply: () => paintBand(selBand, selSpringRef.current!, 1.0),
    };

    const hovSim: Sim = {
      sp: [hovSpringRef.current!],
      apply: () => paintBand(hovBand, hovSpringRef.current!, 0.5),
    };

    const bumpSim: Sim = {
      sp: [bumpSpringRef.current!],
      apply: () => {
        if (tree) {
          tree.style.setProperty("--lyb", `${bumpSpringRef.current!.x.toFixed(2)}px`);
        }
      },
      rest: () => {
        if (tree) {
          tree.classList.remove("lybm");
          tree.style.removeProperty("--lyb");
        }
      },
    };

    // Store references for access in handlers
    (tree as unknown as { _selSim?: Sim; _hovSim?: Sim; _bumpSim?: Sim })._selSim = selSim;
    (tree as unknown as { _selSim?: Sim; _hovSim?: Sim; _bumpSim?: Sim })._hovSim = hovSim;
    (tree as unknown as { _selSim?: Sim; _hovSim?: Sim; _bumpSim?: Sim })._bumpSim = bumpSim;
  }, [paintBand]);

  // Sync selection band when single selected id changes
  useEffect(() => {
    const isSingle = selectedIds.length === 1;
    const selBand = selBandRef.current;
    const tree = treeRef.current;
    if (!selBand || !tree) return;

    tree.classList.toggle("lyb1", isSingle);

    if (!isSingle) {
      selBand.classList.remove("on");
      return;
    }

    const singleId = selectedIds[0];
    const idx = visibleNodes.findIndex((n) => n.id === singleId);
    if (idx < 0) {
      selBand.classList.remove("on");
      return;
    }

    const rowEl = tree.querySelector<HTMLElement>(`.row[data-sel="${singleId}"]`);
    const targetY = rowEl ? rowEl.offsetTop : idx * ROW_HEIGHT_PX;
    const sp = selSpringRef.current!;
    const sim = (tree as unknown as { _selSim?: Sim })._selSim;
    const preset = getMotion().current();

    selBand.classList.add("on");

    if (prefersReducedMotion()) {
      sp.jump(targetY);
      paintBand(selBand, sp, 1.0);
      return;
    }

    sp.tune(preset.hl);
    sp.to = targetY;
    if (sim) simAdd(sim);
  }, [selectedIds, visibleNodes, paintBand]);

  // Hover band tracking
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState?.active) return;
    const target = (e.target as HTMLElement).closest(".row[data-sel]") as HTMLElement | null;
    const hovBand = hovBandRef.current;
    const tree = treeRef.current;
    if (!hovBand || !tree) return;

    if (!target) {
      hovBand.classList.remove("on");
      return;
    }

    const rowId = target.getAttribute("data-sel");
    const idx = visibleNodes.findIndex((n) => n.id === rowId);
    if (idx < 0) {
      hovBand.classList.remove("on");
      return;
    }

    hovBand.classList.add("on");
    const targetY = target.offsetTop;
    const sp = hovSpringRef.current!;
    const sim = (tree as unknown as { _hovSim?: Sim })._hovSim;
    const preset = getMotion().current();

    if (prefersReducedMotion()) {
      sp.jump(targetY);
      paintBand(hovBand, sp, 0.5);
      return;
    }

    sp.tune(preset.hl);
    sp.to = targetY;
    if (sim) simAdd(sim);
  };

  const handlePointerLeave = () => {
    const hovBand = hovBandRef.current;
    if (hovBand) hovBand.classList.remove("on");
  };

  // End bump on wheel or scroll past boundary
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const tree = treeRef.current;
    if (!tree) return;
    const max = tree.scrollHeight - tree.clientHeight;
    if (max <= 2) return;

    const isTop = tree.scrollTop <= 0 && e.deltaY < 0;
    const isBot = tree.scrollTop >= max - 1 && e.deltaY > 0;
    if (!isTop && !isBot) return;

    const preset = getMotion().current();
    if (prefersReducedMotion() || !preset.endBump) return;

    const sp = bumpSpringRef.current!;
    const sim = (tree as unknown as { _bumpSim?: Sim })._bumpSim;
    const dir = isBot ? 1 : -1;

    tree.classList.add("lybm");
    sp.v -= dir * preset.endBump * 0.5;
    if (sim) simAdd(sim);
  };

  // Synchronize roving tabindex on rendered treeitem rows
  const activeId = selectedIds[selectedIds.length - 1] || visibleNodes[0]?.id;
  useEffect(() => {
    const container = treeRef.current;
    if (!container) return;
    const rowEls = container.querySelectorAll<HTMLElement>('[role="treeitem"]');
    rowEls.forEach((el) => {
      const rowId = el.getAttribute("data-sel");
      el.tabIndex = rowId === activeId ? 0 : -1;
    });
  }, [activeId, visibleNodes]);

  // Shared roving keyboard navigation over visible (non-collapsed) rows
  const navigableNodes = useMemo(
    () => visibleNodes.filter((n) => !n.isCollapsed),
    [visibleNodes]
  );

  const baseKeyNav = useTreeKeyboardNav({
    visibleNodes: navigableNodes,
    selectedIds,
    containerRef: treeRef,
    onSelect,
    onToggleExpand,
  });

  // Cascade rows on layer data / page change (matching prototype cascade line 6098 / 11413)
  useEffect(() => {
    const tree = treeRef.current;
    if (!tree || prefersReducedMotion()) return;
    const p = getMotion().current();
    const rows = Array.from(tree.querySelectorAll<HTMLElement>(".row:not(.lcl)"));
    const rs = String(1 - (1 - Number(p.rowScale)) * 0.5);

    rows.slice(0, 16).forEach((r, i) => {
      springAnim(
        r,
        [
          { opacity: 0, scale: rs, translate: "0 6px" },
          { opacity: 1, scale: "1", translate: "0 0" },
        ],
        p.rows[0],
        p.rows[1],
        { delay: Math.min(i, 14) * (p.stagger || 18), fill: "backwards" }
      );
    });
  }, [layers]);

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

  const handleCommitRename = (id: string, originalName: string, nameEl: HTMLElement | null) => {
    setEditingId(null);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== originalName) {
      onRename?.(id, trimmed);

      // Spring pop animation on settle
      if (nameEl && !prefersReducedMotion()) {
        const p = getMotion().current();
        const ease = springEase(p.pop[0], p.pop[1]);
        nameEl.style.transformOrigin = "0 50%";
        nameEl.animate(
          [
            { transform: "scale(1)" },
            { transform: `scale(${1 + (1 - Number(p.rowScale)) * 0.4})`, offset: 0.3 },
            { transform: "scale(1)" },
          ],
          { duration: ease.duration, easing: ease.easing }
        );
      }
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

  // React rewrites the row className on every fold (adding "lcl" at once, dropping "lan"), which
  // would hide a collapsing row before its spring runs. Re-assert the animation classes after commit.
  useLayoutEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;
    tree.querySelectorAll<HTMLElement>(".row").forEach((el) => {
      const s = el as unknown as { _an?: Animation | null };
      if (!s._an) return;
      el.classList.add("lan");
      el.classList.remove("lcl");
    });
  });

  // Chevron click with spring rotation and staggered child rows (matching P lyFold lines 5987-6006)
  const handleChevronClick = (e: React.MouseEvent, id: string, hasKids: boolean) => {
    e.stopPropagation();
    if (!hasKids) return;

    const tree = treeRef.current;
    if (!tree) {
      onToggleExpand?.(id);
      return;
    }

    const clickedRow = tree.querySelector<HTMLElement>(`.row[data-sel="${id}"]`);
    const isCurrentlyOpen = expandedSet.has(id);
    const willOpen = !isCurrentlyOpen;
    const p = getMotion().current();
    const reduced = prefersReducedMotion();

    // 1. Chevron rotation spring
    const chev = clickedRow?.querySelector<HTMLElement>(".c svg") || clickedRow?.querySelector<HTMLElement>(".c");
    if (chev && !reduced) {
      springAnim(
        chev,
        [
          { rotate: willOpen ? "0deg" : "90deg" },
          { rotate: willOpen ? "90deg" : "0deg" },
        ],
        p.pop[0],
        Math.max(0.42, p.pop[1])
      );
    }

    // 2. Identify descendant rows for staggered animation
    const getDescendants = (rootId: string): FlatLayerNode[] => {
      const descendants: FlatLayerNode[] = [];
      const parentIds = new Set<string>([rootId]);
      for (const node of visibleNodes) {
        if (node.parentId && parentIds.has(node.parentId)) {
          descendants.push(node);
          if (node.hasChildren && (willOpen ? expandedSet.has(node.id) : true)) {
            parentIds.add(node.id);
          }
        }
      }
      return descendants;
    };

    const targetDescendants = getDescendants(id);
    const rs = String(1 - (1 - Number(p.rowScale)) * 0.5);
    const bl = `blur(${((1 - Number(p.rowScale)) * 30).toFixed(1)}px)`;

    targetDescendants.forEach((desc, i) => {
      const rowEl = tree.querySelector<HTMLElement>(`.row[data-sel="${desc.id}"]`);
      if (!rowEl) return;

      const anyEl = rowEl as unknown as { _an?: Animation | null; _bl?: Animation | null; _lk?: number };
      const tok = (anyEl._lk = (anyEl._lk || 0) + 1);

      if (anyEl._an) {
        anyEl._an.cancel();
        anyEl._an = null;
      }
      if (anyEl._bl) {
        anyEl._bl.cancel();
        anyEl._bl = null;
      }

      if (reduced) {
        rowEl.classList.toggle("lcl", !willOpen);
        rowEl.classList.remove("lan");
        return;
      }

      const d = willOpen
        ? Math.min(i, 8) * (p.stagger || 18)
        : Math.min(targetDescendants.length - 1 - i, 6) * (p.stagger || 18) * 0.3;

      rowEl.classList.add("lan");
      rowEl.style.transformOrigin = "0 50%";

      if (willOpen) {
        rowEl.classList.remove("lcl");
        const a = springAnim(
          rowEl,
          [
            { height: "0px", opacity: 0, scale: rs, translate: "0 -8px" },
            { height: "32px", opacity: desc.hidden ? 0.45 : 1, scale: "1", translate: "0 0" },
          ],
          p.rows[0],
          Math.max(0.6, p.rows[1]),
          { delay: d, fill: "backwards" }
        );

        if (Number(p.rowScale) < 1 && rowEl.animate) {
          anyEl._bl = rowEl.animate(
            [{ filter: bl }, { filter: "blur(0px)" }],
            { duration: 200, delay: d, easing: "ease-out", fill: "backwards" }
          );
        }

        const end = () => {
          if (anyEl._lk !== tok) return;
          anyEl._an = null;
          rowEl.classList.remove("lan");
          rowEl.style.transformOrigin = "";
          if (a) a.cancel();
          if (anyEl._bl) {
            anyEl._bl.cancel();
            anyEl._bl = null;
          }
        };

        if (a) {
          anyEl._an = a;
          a.onfinish = end;
        } else {
          end();
        }
      } else {
        const a = springAnim(
          rowEl,
          [
            { height: "32px", opacity: desc.hidden ? 0.45 : 1, translate: "0 0" },
            { height: "0px", opacity: 0, translate: "0 -8px" },
          ],
          0.22,
          1,
          { delay: d, fill: "forwards" }
        );

        const end = () => {
          if (anyEl._lk !== tok) return;
          anyEl._an = null;
          rowEl.classList.add("lcl");
          rowEl.classList.remove("lan");
          rowEl.style.transformOrigin = "";
          if (a) a.cancel();
        };

        if (a) {
          anyEl._an = a;
          a.onfinish = end;
        } else {
          end();
        }
      }
    });

    onToggleExpand?.(id);
  };

  // Eye click with vertical blink spring
  const handleEyeClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const iconEl = e.currentTarget.querySelector("svg");
    if (iconEl && !prefersReducedMotion()) {
      const p = getMotion().current();
      const ease = springEase(p.pop[0], p.pop[1]);
      iconEl.animate(
        [
          { transform: "scale(1, 1)" },
          { transform: `scale(1, ${EYE_BLINK_SCALE_Y})`, offset: 0.3 },
          { transform: "scale(1, 1)" },
        ],
        { duration: ease.duration, easing: ease.easing }
      );
    }
    onToggleHidden?.(id);
  };

  // Lock click with drop spring
  const handleLockClick = (e: React.MouseEvent, id: string, isCurrentlyLocked: boolean) => {
    e.stopPropagation();
    const iconEl = e.currentTarget.querySelector("svg");
    if (iconEl && !prefersReducedMotion() && !isCurrentlyLocked) {
      const p = getMotion().current();
      const ease = springEase(p.pop[0], p.pop[1]);
      iconEl.animate(
        [
          { transform: `translate(0, ${LOCK_DROP_OFFSET_PX}px) scale(1, 1.12)` },
          { transform: "translate(0, 0) scale(1, 1)" },
        ],
        { duration: ease.duration, easing: ease.easing }
      );
    }
    onToggleLocked?.(id);
  };

  // Global pointer move & up listeners for drag-to-reorder and drag-to-timeline
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      const current = dragStateRef.current;
      if (!current) return;

      if (!current.active) {
        if (Math.abs(e.clientY - current.startY) < DRAG_THRESHOLD_PX) return;
        current.active = true;
      }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const targetEl = el?.closest("#p-layers .row[data-sel]");
      if (!targetEl) {
        setDragState({ ...current, targetId: null, pos: null });
        if (dropLineRef.current) dropLineRef.current.style.display = "none";
        return;
      }

      const targetId = targetEl.getAttribute("data-sel");
      if (!targetId || targetId === current.id) {
        setDragState({ ...current, targetId: null, pos: null });
        if (dropLineRef.current) dropLineRef.current.style.display = "none";
        return;
      }

      const subtree = getSubtreeIds(current.id);
      if (subtree.has(targetId)) {
        setDragState({ ...current, targetId: null, pos: null });
        if (dropLineRef.current) dropLineRef.current.style.display = "none";
        return;
      }

      const b = targetEl.getBoundingClientRect();
      const f = (e.clientY - b.top) / b.height;
      const targetNode = visibleNodes.find((n) => n.id === targetId);
      const isFrame = targetNode?.item.type === "frame" || targetNode?.item.type === "container";

      const pos = isFrame ? (f < 0.25 ? "before" : f > 0.75 ? "after" : "in") : f < 0.5 ? "before" : "after";

      setDragState({
        ...current,
        targetId,
        pos,
      });

      // Update drop line indicator
      if (dropLineRef.current && treeRef.current && pos !== "in") {
        const treeRect = treeRef.current.getBoundingClientRect();
        const lineTop = pos === "before" ? b.top - treeRect.top + treeRef.current.scrollTop : b.bottom - treeRect.top + treeRef.current.scrollTop;
        const lineLeft = BASE_INDENT_PX + (targetNode?.level || 0) * LEVEL_INDENT_PX;
        dropLineRef.current.style.display = "block";
        dropLineRef.current.style.top = `${lineTop}px`;
        dropLineRef.current.style.left = `${lineLeft}px`;
      } else if (dropLineRef.current) {
        dropLineRef.current.style.display = "none";
      }
    };

    const handleGlobalPointerUp = () => {
      const current = dragStateRef.current;
      if (!current) return;
      setDragState(null);
      if (dropLineRef.current) dropLineRef.current.style.display = "none";

      if (!current.active || !current.targetId || !current.pos) return;

      const targetNode = visibleNodes.find((n) => n.id === current.targetId);
      if (!targetNode) return;

      if (current.pos === "in") {
        if (targetNode.item.type !== "frame" && targetNode.item.type !== "container") {
          showToast("Only frames can hold layers");
          return;
        }
        onMoveLayer?.([current.id], current.targetId, 0);
        if (!expandedSet.has(current.targetId)) {
          onToggleExpand?.(current.targetId);
        }
      } else if (current.pos === "before") {
        const parentId = targetNode.parentId;
        const siblings = visibleNodes.filter((n) => n.parentId === parentId);
        const targetIdx = siblings.findIndex((n) => n.id === current.targetId);
        onMoveLayer?.([current.id], parentId, Math.max(0, targetIdx));
      } else {
        const parentId = targetNode.parentId;
        const siblings = visibleNodes.filter((n) => n.parentId === parentId);
        const targetIdx = siblings.findIndex((n) => n.id === current.targetId);
        onMoveLayer?.([current.id], parentId, targetIdx + 1);
      }
    };

    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
    };
  }, [visibleNodes, getSubtreeIds, onMoveLayer, expandedSet, onToggleExpand, showToast]);

  const hasSearch = searchQuery.trim().length > 0;

  return (
    <div
      ref={treeRef}
      id="p-layers"
      data-testid="layer-tree"
      role="tree"
      tabIndex={visibleNodes.length === 0 ? 0 : -1}
      aria-label="Layers"
      onKeyDown={handleTreeKeyDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
      className={`zbody ll-zbody ll-list-edge-blur ${hasSearch ? "lsq" : ""} ll:relative ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:outline-none`}
    >
      {/* Sliding Highlight Bands (sel & hov) */}
      <i ref={hovBandRef} className="lyhl hov ll-lyhl" aria-hidden="true" />
      <i ref={selBandRef} className="lyhl sel ll-lyhl" aria-hidden="true" />

      {/* Drop indicator line */}
      <div ref={dropLineRef} className="lyline ll-lyline" style={{ display: "none" }} />

      {visibleNodes.length > 0 ? (
        visibleNodes.map((node) => {
          const isSelected = selectedSet.has(node.id);
          const isAncestor = !isSelected && ancestorIds.has(node.id);
          const targetIds = isSelected ? selectedIds : [node.id];
          const isBeingDragged = dragState?.active && dragState?.id === node.id;
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
                  data-open={node.hasChildren && node.expanded ? "" : undefined}
                  data-selected={isSelected ? "true" : "false"}
                  aria-selected={isSelected}
                  aria-expanded={node.hasChildren ? node.expanded : undefined}
                  style={
                    {
                      "--lvl": node.level,
                      paddingLeft: `calc(${BASE_INDENT_PX}px + ${node.level} * ${LEVEL_INDENT_PX}px)`,
                    } as React.CSSProperties
                  }
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    const target = e.target as HTMLElement;
                    if (target.closest(".mb, .act, input, button:not([role=treeitem])")) return;
                    setDragState({
                      id: node.id,
                      startY: e.clientY,
                      active: false,
                      targetId: null,
                      pos: null,
                    });
                  }}
                  onClick={(e) => {
                    onSelect?.(node.id, e);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (!node.locked && onRename) {
                      setEditingId(node.id);
                      setDraftName(node.name);
                    }
                  }}
                  className={`row ll-row ll:group ll:relative ll:flex ll:items-center ll:h-8 ll:pr-2 ll:text-left ll:w-full ll:whitespace-nowrap ll:select-none ll:outline-none ll:cursor-pointer ll:text-body ll:font-normal ll:box-border ${
                    isBeingDragged ? "ldrag" : ""
                  } ${isAncestor ? "anc" : ""} ${
                    dropPos === "before"
                      ? "ldb"
                      : dropPos === "after"
                      ? "lda"
                      : dropPos === "in"
                      ? "ldi"
                      : ""
                  } ${node.hidden ? "ll:opacity-40" : ""} ${node.isCollapsed ? "lcl" : ""}`}
                >
                  {/* Chevron: rotated 90deg on expanded, empty 12px span on leaf node */}
                  {node.hasChildren ? (
                    <span
                      role="button"
                      aria-label={node.expanded ? "Collapse" : "Expand"}
                      onClick={(e) => handleChevronClick(e, node.id, node.hasChildren)}
                      className="c ll-c ll:w-3 ll:h-3 ll:grid ll:place-items-center ll:shrink-0 ll:text-muted ll:hover:text-primary"
                    >
                      <Icon icon={ChevronRight} size={CHEVRON_SIZE_PX} />
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
                  <div
                    data-testid="layer-name"
                    className="nm ll-nm ll:flex-1 ll:min-w-0 ll:truncate ll:text-body"
                  >
                    {editingId === node.id ? (
                      <input
                        type="text"
                        value={draftName}
                        autoFocus
                        aria-label="Rename layer"
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={(e) => handleCommitRename(node.id, node.name, e.currentTarget.parentElement)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleCommitRename(node.id, node.name, e.currentTarget.parentElement);
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rnin ll-rnin"
                      />
                    ) : (
                      <span className="ll:truncate ll:block">
                        {renderHighlightedName(node.name, searchQuery)}
                      </span>
                    )}
                  </div>

                  {/* Actions: Eye (visibility) and Lock (sits before motion badge in P) */}
                  <span className="act ll-act">
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={node.hidden ? "Show layer" : "Hide layer"}
                      title={node.hidden ? "Show layer" : "Hide layer"}
                      onClick={(e) => handleEyeClick(e, node.id)}
                      className="ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:cursor-pointer"
                    >
                      <Icon icon={node.hidden ? EyeOff : Eye} size={ICON_SIZE_PX} />
                    </span>
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={node.locked ? "Unlock layer" : "Lock layer"}
                      title={node.locked ? "Unlock layer" : "Lock layer"}
                      onClick={(e) => handleLockClick(e, node.id, node.locked)}
                      className="ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:cursor-pointer"
                    >
                      <Icon icon={node.locked ? Lock : Unlock} size={ICON_SIZE_PX} />
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
                      className="mb ll-mb"
                    >
                      <Icon icon={Film} size={12} />
                    </span>
                  )}
                </button>
              </ContextMenu>
            </div>
          );
        })
      ) : hasSearch ? (
        <div id="lsnone" className="lsnone ll-lsnone ll:p-4 ll:text-muted ll:text-body">
          No layers match
        </div>
      ) : (
        <div id="lsnone" className="lsnone ll-lsnone ll:p-4 ll:text-muted ll:text-body">
          No layers
        </div>
      )}

      {/* Floating status toast message (e.g. "Only frames can hold layers") */}
      <div id="lmsg" role="status" className={`lmsg ll-lmsg ${toastMsg ? "on" : ""}`}>
        {toastMsg}
      </div>
    </div>
  );
};
