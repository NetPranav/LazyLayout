"use client";

import React, { useMemo, useRef, useEffect } from "react";
import {
  Frame,
  Type,
  Square,
  Image as ImageIcon,
  Circle,
  Minus,
  Star,
  Hexagon,
  MousePointerClick,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { TreeRow } from "@/editor/components/TreeRow";
import { LeftPanelEmpty } from "./LeftPanelEmpty";
import type { LayerItem } from "./types";
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
}

function getLayerIcon(type?: string): React.ReactNode {
  switch (type) {
    case "text":
    case "input":
      return <Icon icon={Type} size={14} />;
    case "box":
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
    case "button":
      return <Icon icon={MousePointerClick} size={14} />;
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
}) => {
  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const treeRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={treeRef}
      id="p-layers"
      role="tree"
      tabIndex={visibleNodes.length === 0 ? 0 : -1}
      aria-label="Layers"
      onKeyDown={handleTreeKeyDown}
      className="zbody ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:outline-none"
    >
      {visibleNodes.length > 0 ? (
        visibleNodes.map((node) => (
          <TreeRow
            key={node.id}
            id={node.id}
            name={node.name}
            level={node.level}
            icon={getLayerIcon(node.item.type)}
            hasChildren={node.hasChildren}
            expanded={node.expanded}
            selected={node.selected}
            hidden={node.hidden}
            locked={node.locked}
            hasMotion={node.hasMotion}
            className="ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
            onToggleExpand={() => onToggleExpand?.(node.id)}
            onSelect={(e) => {
              onSelect?.(node.id, e);
              (e.currentTarget as HTMLElement)?.focus();
            }}
            onRename={onRename ? (newName) => onRename(node.id, newName) : undefined}
            onToggleHidden={onToggleHidden ? () => onToggleHidden(node.id) : undefined}
            onToggleLocked={onToggleLocked ? () => onToggleLocked(node.id) : undefined}
          />
        ))
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
