"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { Folder, File, Code, Hash, Braces, ChevronRight } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { ContextMenu } from "@/editor/components/ContextMenu";
import { FileContextMenuContent } from "./FileContextMenu";
import type { FileItem, FileMenuAction } from "./types";
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
  onFileAction?: (action: FileMenuAction, fileId: string) => void;
}

const CATEGORY_OPTIONS = [
  { value: "All", label: "All" },
  { value: "Pages", label: "Pages" },
  { value: "Components", label: "Components" },
  { value: "Styles", label: "Styles" },
  { value: "Config", label: "Config" },
];

function getFileIcon(name: string, isFolder: boolean): React.ReactNode {
  if (isFolder) {
    return <Icon icon={Folder} size={16} />;
  }
  if (/\.(tsx|jsx|ts|js)$/.test(name)) {
    return <Icon icon={Code} size={16} />;
  }
  if (/\.css$/.test(name)) {
    return <Icon icon={Hash} size={16} />;
  }
  if (/\.json$/.test(name)) {
    return <Icon icon={Braces} size={16} />;
  }
  return <Icon icon={File} size={16} />;
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

export const FilesTree: React.FC<FilesTreeProps> = ({
  files,
  selectedIds,
  expandedIds,
  searchQuery = "",
  visibleNodes: propVisibleNodes,
  onSelect,
  onToggleExpand,
  onRename,
  onFileAction,
}) => {
  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const treeRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>("");
  const [selectedCat, setSelectedCat] = useState<string>("All");

  // Derive visible nodes through shared pure filter function if not provided by parent
  const { visibleNodes } = useMemo(() => {
    let all = propVisibleNodes || flattenFiles(files, expandedSet, selectedSet);
    if (selectedCat !== "All") {
      const matchingFileIds = new Set(
        all.filter((f) => !f.isFolder && f.cat === selectedCat).map((f) => f.id)
      );
      // Keep folders that contain any matching file
      const neededFolderIds = new Set<string>();
      for (const node of all) {
        if (matchingFileIds.has(node.id)) {
          let curr = node.parentId;
          while (curr) {
            neededFolderIds.add(curr);
            const parent = all.find((p) => p.id === curr);
            curr = parent ? parent.parentId : null;
          }
        }
      }
      all = all.filter((n) => matchingFileIds.has(n.id) || neededFolderIds.has(n.id));
    }
    return filterTreeNodes(all, searchQuery);
  }, [propVisibleNodes, files, expandedSet, selectedSet, searchQuery, selectedCat]);

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
      if (target && onRename) {
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
      {/* Category filter bar (.fsbar) */}
      <div className="fsbar ll-fsbar ll:sticky ll:top-0 ll:z-10 ll:p-2 ll:px-3 ll:bg-surface-panel ll:border-b ll:border-border ll:shrink-0">
        <Select
          options={CATEGORY_OPTIONS}
          value={selectedCat}
          onChange={(val) => setSelectedCat(val)}
          aria-label="Show files"
          className="ll:w-full"
        />
      </div>

      <div id="ftree" role="group">
        {visibleNodes.length > 0 ? (
          visibleNodes.map((node) => {
            const isSelected = selectedSet.has(node.id) || selectedSet.has(node.name);

            const rowContent = (
              <button
                type="button"
                role="treeitem"
                data-file={node.name}
                data-id={node.id}
                aria-selected={isSelected}
                aria-expanded={node.hasChildren ? node.expanded : undefined}
                style={{
                  paddingLeft: `calc(16px + ${node.level} * 16px)`,
                }}
                onClick={(e) => {
                  onSelect?.(node.id, e);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (node.isFolder) {
                    onToggleExpand?.(node.id);
                  } else if (onRename) {
                    setEditingId(node.id);
                    setDraftName(node.name);
                  }
                }}
                className={`row frow ll-row ll-frow ll:group ll:relative ll:flex ll:items-center ll:gap-2 ll:h-8 ll:pr-3 ll:text-left ll:w-full ll:whitespace-nowrap ll:select-none ll:outline-none ll:cursor-pointer ll:text-body ll:font-normal ll:transition-none ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${
                  node.isFolder ? "fold ll-fold" : ""
                } ${
                  isSelected
                    ? "on ll:font-medium ll:bg-select-bg ll:text-select-fg"
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

                {/* Folder or File icon (16x16) */}
                <span
                  className={`ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:shrink-0 ${
                    isSelected ? "ll:text-select-fg" : "ll:text-muted ll:group-hover:text-primary"
                  }`}
                >
                  {getFileIcon(node.name, node.isFolder)}
                </span>

                {/* Name */}
                <div className="nm ll-nm ll:flex-1 ll:min-w-0 ll:truncate ll:text-body">
                  {editingId === node.id ? (
                    <input
                      type="text"
                      value={draftName}
                      autoFocus
                      aria-label="Rename file"
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => handleCommitRename(node.id, node.name)}
                      onKeyDown={(e) => {
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

                {/* Modified dot on changed files (.mdot) */}
                {node.modified && (
                  <i className="mdot ll-mdot" title="Changed since the last export" />
                )}
              </button>
            );

            if (node.isFolder) {
              return <React.Fragment key={node.id}>{rowContent}</React.Fragment>;
            }

            return (
              <ContextMenu
                key={node.id}
                content={
                  <FileContextMenuContent
                    fileId={node.id}
                    fileName={node.name}
                    filePath={node.dir ? `${node.dir}/${node.name}` : node.name}
                    onAction={onFileAction}
                  />
                }
              >
                {rowContent}
              </ContextMenu>
            );
          })
        ) : searchQuery.trim().length > 0 ? (
          <div id="lsnone" className="lsnone ll-lsnone ll:p-4 ll:text-muted ll:text-body">
            No files found
          </div>
        ) : (
          <div id="lsnone" className="lsnone ll-lsnone ll:p-4 ll:text-muted ll:text-body">
            No files
          </div>
        )}
      </div>
    </div>
  );
};
