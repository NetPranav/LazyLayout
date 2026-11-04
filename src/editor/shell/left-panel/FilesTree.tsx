"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { Folder, FolderOpen, File, ChevronRight } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>("");

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
      id="p-files"
      role="tree"
      tabIndex={visibleNodes.length === 0 ? 0 : -1}
      aria-label="Files"
      onKeyDown={handleTreeKeyDown}
      className="zbody ll-zbody ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:outline-none"
    >
      {visibleNodes.length > 0 ? (
        visibleNodes.map((node) => {
          const isSelected = selectedSet.has(node.id) || selectedSet.has(node.name);

          return (
            <button
              key={node.id}
              type="button"
              role="treeitem"
              data-file={node.name}
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
                if (onRename) {
                  setEditingId(node.id);
                  setDraftName(node.name);
                }
              }}
              className={`row ll-row ll:group ll:relative ll:flex ll:items-center ll:gap-2 ll:h-8 ll:pr-3 ll:text-left ll:w-full ll:whitespace-nowrap ll:select-none ll:outline-none ll:cursor-pointer ll:text-small ll:font-normal ll:transition-none ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${
                isSelected
                  ? "ll:bg-select-bg ll:text-select-fg"
                  : "ll:text-secondary ll:hover:bg-surface-canvas ll:hover:text-primary"
              }`}
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

              {/* Folder or File icon */}
              <span
                className={`ll:w-3.5 ll:h-3.5 ll:grid ll:place-items-center ll:shrink-0 ${
                  isSelected ? "ll:text-select-fg" : "ll:text-muted ll:group-hover:text-primary"
                }`}
              >
                {getFileIcon(node.name, node.isFolder, node.expanded)}
              </span>

              {/* Name */}
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
            </button>
          );
        })
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
