"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { Folder, FolderOpen, FileCode, FileText, File } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { TreeRow } from "@/editor/components/TreeRow";
import { LeftPanelEmpty } from "./LeftPanelEmpty";
import type { FileItem } from "./types";
import { flattenFiles, filterTreeNodes, type FlatFileNode } from "./treeFilter";
import { useTreeKeyboardNav } from "./useTreeKeyboardNav";

export interface FilesTreeProps {
  files: FileItem[];
  selectedIds: string[];
  expandedIds: string[];
  searchQuery?: string;
  visibleNodes?: FlatFileNode[];
  onSelect?: (id: string, e?: React.MouseEvent | React.KeyboardEvent) => void;
  onToggleExpand?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
}

function getFileIcon(name: string, isFolder: boolean, expanded: boolean): React.ReactNode {
  if (isFolder) {
    return <Icon icon={expanded ? FolderOpen : Folder} size={14} />;
  }
  if (name.endsWith(".tsx") || name.endsWith(".ts") || name.endsWith(".jsx") || name.endsWith(".js")) {
    return <Icon icon={FileCode} size={14} />;
  }
  if (name.endsWith(".css") || name.endsWith(".json") || name.endsWith(".md")) {
    return <Icon icon={FileText} size={14} />;
  }
  return <Icon icon={File} size={14} />;
}

export const FilesTree: React.FC<FilesTreeProps> = ({
  files,
  selectedIds,
  expandedIds,
  searchQuery = "",
  visibleNodes: propVisibleNodes,
  onSelect,
  onToggleExpand,
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
    const all = flattenFiles(files, expandedSet, selectedSet);
    return filterTreeNodes(all, searchQuery);
  }, [propVisibleNodes, files, expandedSet, selectedSet, searchQuery]);

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
      id="p-files"
      role="tree"
      tabIndex={visibleNodes.length === 0 ? 0 : -1}
      aria-label="Files"
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
            icon={getFileIcon(node.name, node.isFolder, node.expanded)}
            hasChildren={node.hasChildren}
            expanded={node.expanded}
            selected={node.selected}
            className="ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
            onToggleExpand={() => onToggleExpand?.(node.id)}
            onSelect={(e) => {
              onSelect?.(node.id, e);
              (e.currentTarget as HTMLElement)?.focus();
            }}
            onRename={onRename ? (newName) => onRename(node.id, newName) : undefined}
          />
        ))
      ) : searchQuery.trim().length > 0 ? (
        <LeftPanelEmpty
            title="No files found"
            description={`No files match "${searchQuery.trim()}"`}
          />
      ) : (
        <LeftPanelEmpty
          title="No files"
          description="Project files will appear here."
        />
      )}
    </div>
  );
};
