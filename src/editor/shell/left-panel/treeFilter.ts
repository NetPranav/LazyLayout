import type { LayerItem, FileItem } from "./types";

export interface FlatLayerNode {
  item: LayerItem;
  id: string;
  name: string;
  level: number;
  hasChildren: boolean;
  expanded: boolean;
  selected: boolean;
  hidden: boolean;
  locked: boolean;
  hasMotion: boolean;
  parentId: string | null;
}

export interface FlatFileNode {
  item: FileItem;
  id: string;
  name: string;
  level: number;
  isFolder: boolean;
  hasChildren: boolean;
  expanded: boolean;
  selected: boolean;
  modified?: boolean;
  cat?: string;
  dir?: string;
  parentId: string | null;
}

export function flattenLayers(
  items: LayerItem[],
  expandedSet: Set<string>,
  selectedSet: Set<string>,
  hiddenSet?: Set<string>,
  lockedSet?: Set<string>,
  level = 0,
  parentId: string | null = null,
  acc: FlatLayerNode[] = []
): FlatLayerNode[] {
  for (const item of items) {
    const hasChildren =
      Boolean(item.hasChildren) || Boolean(item.children && item.children.length > 0);
    const expanded = expandedSet.has(item.id);
    const selected = selectedSet.has(item.id);
    const hidden = Boolean(item.hidden) || Boolean(hiddenSet?.has(item.id));
    const locked = Boolean(item.locked) || Boolean(lockedSet?.has(item.id));

    acc.push({
      item,
      id: item.id,
      name: item.name,
      level: item.level ?? level,
      hasChildren,
      expanded,
      selected,
      hidden,
      locked,
      hasMotion: Boolean(item.hasMotion),
      parentId: item.parentId !== undefined ? item.parentId : parentId,
    });

    if (item.children && item.children.length > 0) {
      flattenLayers(
        item.children,
        expandedSet,
        selectedSet,
        hiddenSet,
        lockedSet,
        level + 1,
        item.id,
        acc
      );
    }
  }
  return acc;
}

export function flattenFiles(
  items: FileItem[],
  expandedSet: Set<string>,
  selectedSet: Set<string>,
  level = 0,
  parentId: string | null = null,
  acc: FlatFileNode[] = []
): FlatFileNode[] {
  for (const item of items) {
    const isFolder = Boolean(item.isFolder || (item.children && item.children.length > 0));
    const hasChildren = Boolean(item.hasChildren || (item.children && item.children.length > 0));
    const expanded = expandedSet.has(item.id);
    const selected = selectedSet.has(item.id);

    acc.push({
      item,
      id: item.id,
      name: item.name,
      level: item.level ?? level,
      isFolder,
      hasChildren,
      expanded,
      selected,
      modified: Boolean(item.modified),
      cat: item.cat,
      dir: item.dir,
      parentId: item.parentId !== undefined ? item.parentId : parentId,
    });

    if (item.children && item.children.length > 0) {
      flattenFiles(item.children, expandedSet, selectedSet, level + 1, item.id, acc);
    }
  }
  return acc;
}

export interface TreeFilterResult<T> {
  visibleNodes: T[];
  matchCount: number;
}

/**
 * Shared pure filtering function for tree nodes.
 * When searchQuery is empty, only shows nodes whose ancestors are expanded.
 * When searchQuery is present, matches nodes case-insensitively and keeps all their ancestors.
 * Returns both the visible nodes and the exact count of direct matches.
 */
export function filterTreeNodes<
  T extends { id: string; name: string; hasChildren: boolean; expanded: boolean; parentId: string | null }
>(allNodes: T[], searchQuery: string): TreeFilterResult<T> {
  const q = searchQuery.trim().toLowerCase();

  // If no search query, return nodes whose ancestors are all expanded
  if (!q) {
    const nodeMap = new Map<string, T>();
    const collapsedIds = new Set<string>();
    for (const node of allNodes) {
      nodeMap.set(node.id, node);
      if (node.hasChildren && !node.expanded) {
        collapsedIds.add(node.id);
      }
    }

    const visible: T[] = [];
    for (const node of allNodes) {
      let isAncestorCollapsed = false;
      let currParentId = node.parentId;
      while (currParentId) {
        if (collapsedIds.has(currParentId)) {
          isAncestorCollapsed = true;
          break;
        }
        const parentNode = nodeMap.get(currParentId);
        currParentId = parentNode ? parentNode.parentId : null;
      }

      if (!isAncestorCollapsed) {
        visible.push(node);
      }
    }

    return { visibleNodes: visible, matchCount: 0 };
  }

  // Active search: find matching nodes and retain all ancestors
  const nodeMap = new Map<string, T>();
  for (const node of allNodes) {
    nodeMap.set(node.id, node);
  }

  const matchedIds = new Set<string>();
  const ancestorIdsToKeep = new Set<string>();

  for (const node of allNodes) {
    if (node.name.toLowerCase().includes(q)) {
      matchedIds.add(node.id);
      let currParentId = node.parentId;
      while (currParentId) {
        ancestorIdsToKeep.add(currParentId);
        const parentNode = nodeMap.get(currParentId);
        currParentId = parentNode ? parentNode.parentId : null;
      }
    }
  }

  const visibleNodes = allNodes.filter(
    (node) => matchedIds.has(node.id) || ancestorIdsToKeep.has(node.id)
  );

  return { visibleNodes, matchCount: matchedIds.size };
}
