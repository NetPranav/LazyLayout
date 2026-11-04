"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
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
import { LeftPanelEmpty } from "./LeftPanelEmpty";
import { LayerContextMenuContent } from "./LayerContextMenu";
import type { LayerItem, LayerMenuAction } from "./types";
import { flattenLayers, filterTreeNodes, type FlatLayerNode } from "./treeFilter";
import { useTreeKeyboardNav } from "./useTreeKeyboardNav";

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
  onRename?: (id: string, newName: string) => void;
  onLayerAction?: (action: LayerMenuAction, id: string) => void;
  /** Show the motion badge on animated layers (design mode only, as in the prototype). */
  showMotion?: boolean;
}

function getLayerIcon(type?: string): React.ReactNode {
  switch (type) {
    case "text":
    case "input":
      return <Icon icon={Type} size={14} />;
    case "box":
    case "button":
    case "object3d":
      return <Icon icon={Square} size={14} />;
    case "image":
    case "background":
      return <Icon icon={ImageIcon} size={14} />;
    case "circle":
    case "toggle":
      return <Icon icon={Circle} size={14} />;
    case "line":
    case "divider":
      return <Icon icon={Minus} size={14} />;
    case "star":
    case "icon":
      return <Icon icon={Star} size={14} />;
    case "poly":
    case "shape":
      return <Icon icon={Hexagon} size={14} />;
    case "frame":
    default:
      return <Icon icon={Frame} size={14} />;
  }
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
  onRename,
  onLayerAction,
  showMotion = true,
}) => {
  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const treeRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>("");

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
  const handleTreeKeyDown = useTreeKeyboardNav({
    visibleNodes,
    selectedIds,
    containerRef: treeRef,
    onSelect,
    onToggleExpand,
  });

  const handleCommitRename = (id: string, originalName: string) => {
    setEditingId(null);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== originalName) {
      onRename?.(id, trimmed);
    }
  };

  return (
    <div
      ref={treeRef}
      id="p-layers"
      role="tree"
      tabIndex={visibleNodes.length === 0 ? 0 : -1}
      aria-label="Layers"
      onKeyDown={handleTreeKeyDown}
      className="zbody ll-zbody ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:outline-none"
    >
      {visibleNodes.length > 0 ? (
        visibleNodes.map((node) => {
          const isSelected = selectedSet.has(node.id);
          const targetIds = isSelected ? selectedIds : [node.id];

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
                  aria-selected={isSelected}
                  aria-expanded={node.hasChildren ? node.expanded : undefined}
                  style={{
                    paddingLeft: `calc(${node.level} * var(--ll-size-tree-indent) + var(--ll-size-tree-indent-base))`,
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
                  className={`row ll-row ll:group ll:relative ll:flex ll:items-center ll:gap-2 ll:h-8 ll:pr-3 ll:text-left ll:w-full ll:whitespace-nowrap ll:select-none ll:outline-none ll:cursor-pointer ll:text-small ll:font-normal ll:transition-none ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${
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

                  {/* Type icon */}
                  <span
                    className={`ll:w-3.5 ll:h-3.5 ll:grid ll:place-items-center ll:shrink-0 ${
                      isSelected ? "ll:text-select-fg" : "ll:text-muted ll:group-hover:text-primary"
                    }`}
                  >
                    {getLayerIcon(node.item.type)}
                  </span>

                  {/* Layer name */}
                  <div className="nm ll-nm ll:flex-1 ll:min-w-0 ll:truncate ll:text-small">
                    {editingId === node.id ? (
                      <input
                        type="text"
                        value={draftName}
                        autoFocus
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={() => handleCommitRename(node.id, node.name)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCommitRename(node.id, node.name);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="ll:w-full ll:h-6 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-primary ll:rounded-sm ll:outline-none ll:text-small ll:text-primary ll:font-sans"
                      />
                    ) : (
                      <span className="ll:truncate ll:block">{node.name}</span>
                    )}
                  </div>

                  {/* Motion Badge for animated layers */}
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

                  {/* Actions: Eye (visibility) and Lock */}
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
                      <Icon icon={node.hidden ? EyeOff : Eye} size={12} />
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
                      <Icon icon={node.locked ? Lock : Unlock} size={12} />
                    </span>
                  </span>
                </button>
              </ContextMenu>
            </div>
          );
        })
      ) : searchQuery.trim().length > 0 ? (
        <LeftPanelEmpty
          title="No layers found"
          description={`No layers match "${searchQuery.trim()}"`}
        />
      ) : (
        <LeftPanelEmpty
          title="No layers"
          description="Layers added to canvas will appear here."
        />
      )}
    </div>
  );
};
