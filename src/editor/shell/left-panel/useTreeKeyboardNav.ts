import React, { useCallback } from "react";

export interface NavigableTreeNode {
  id: string;
  hasChildren: boolean;
  expanded: boolean;
  parentId?: string | null;
}

export interface UseTreeKeyboardNavOptions<T extends NavigableTreeNode> {
  visibleNodes: T[];
  selectedIds: string[];
  containerRef?: React.RefObject<HTMLDivElement | null>;
  onSelect?: (id: string, e?: React.MouseEvent | React.KeyboardEvent) => void;
  onToggleExpand?: (id: string) => void;
}

/**
 * Shared keyboard navigation hook for tree components (LayersTree, FilesTree).
 * Supports ArrowDown, ArrowUp, ArrowRight, ArrowLeft, Home, End, Enter, Space.
 * Synchronizes roving tabindex and moves DOM focus onto active treeitem rows.
 */
export function useTreeKeyboardNav<T extends NavigableTreeNode>({
  visibleNodes,
  selectedIds,
  containerRef,
  onSelect,
  onToggleExpand,
}: UseTreeKeyboardNavOptions<T>) {
  return useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (visibleNodes.length === 0) return;

      const activeId = selectedIds[selectedIds.length - 1] || visibleNodes[0]?.id;
      const currentIndex = visibleNodes.findIndex((node) => node.id === activeId);

      const focusNode = (id: string) => {
        if (containerRef?.current) {
          const el = containerRef.current.querySelector<HTMLElement>(`[data-id="${id}"]`);
          if (el) {
            el.tabIndex = 0;
            el.focus();
          }
        }
      };

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, visibleNodes.length - 1);
          const nextNode = visibleNodes[nextIndex];
          if (nextNode) {
            onSelect?.(nextNode.id, e);
            focusNode(nextNode.id);
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          const prevNode = visibleNodes[prevIndex];
          if (prevNode) {
            onSelect?.(prevNode.id, e);
            focusNode(prevNode.id);
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const currNode = visibleNodes[currentIndex];
          if (currNode && currNode.hasChildren) {
            if (!currNode.expanded) {
              onToggleExpand?.(currNode.id);
            } else if (currentIndex + 1 < visibleNodes.length) {
              const nextId = visibleNodes[currentIndex + 1].id;
              onSelect?.(nextId, e);
              focusNode(nextId);
            }
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const currNode = visibleNodes[currentIndex];
          if (currNode) {
            if (currNode.hasChildren && currNode.expanded) {
              onToggleExpand?.(currNode.id);
            } else if (currNode.parentId) {
              onSelect?.(currNode.parentId, e);
              focusNode(currNode.parentId);
            }
          }
          break;
        }
        case "Home": {
          e.preventDefault();
          if (visibleNodes[0]) {
            onSelect?.(visibleNodes[0].id, e);
            focusNode(visibleNodes[0].id);
          }
          break;
        }
        case "End": {
          e.preventDefault();
          const last = visibleNodes[visibleNodes.length - 1];
          if (last) {
            onSelect?.(last.id, e);
            focusNode(last.id);
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          const currNode = visibleNodes[currentIndex];
          if (currNode) {
            onSelect?.(currNode.id, e);
            focusNode(currNode.id);
          }
          break;
        }
      }
    },
    [visibleNodes, selectedIds, containerRef, onSelect, onToggleExpand]
  );
}
