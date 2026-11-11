"use client";

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Folder, File, Code, Hash, Braces, ChevronRight } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Checkbox } from "@/editor/components/Checkbox";
import { springAnim } from "@/editor/motion/ease";
import { isMotionOff } from "@/editor/motion/reducedMotion";
import { flattenFiles } from "@/editor/shell/left-panel/treeFilter";
import type { FileItem } from "@/editor/shell/left-panel/types";
import { filePathsUnder } from "./exportFiles";

export interface ExportFileTreeProps {
  tree: FileItem[];
  selectedPath: string | null;
  excluded: readonly string[];
  onSelect: (path: string) => void;
  onSetIncluded: (paths: string[], included: boolean) => void;
}

function allFolderIds(items: FileItem[]): string[] {
  return items.flatMap((f) => (f.isFolder ? [f.id, ...allFolderIds(f.children ?? [])] : []));
}

function iconFor(name: string, isFolder: boolean) {
  if (isFolder) return Folder;
  if (/\.(tsx|jsx|ts|js|mjs)$/.test(name)) return Code;
  if (/\.css$/.test(name)) return Hash;
  if (/\.json$/.test(name)) return Braces;
  return File;
}

function indexOfItem(items: FileItem[], id: string): FileItem | null {
  for (const it of items) {
    if (it.id === id) return it;
    const hit = it.children ? indexOfItem(it.children, id) : null;
    if (hit) return hit;
  }
  return null;
}

/** The generated files as a tree with a checkbox per file and per folder. Same rows and folder fold as the Code page's files tree. */
export const ExportFileTree: React.FC<ExportFileTreeProps> = ({ tree, selectedPath, excluded, onSelect, onSetIncluded }) => {
  const treeRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const excludedSet = useMemo(() => new Set(excluded), [excluded]);
  const expandedSet = useMemo(() => new Set(allFolderIds(tree).filter((id) => !collapsed.includes(id))), [tree, collapsed]);
  const selectedSet = useMemo(() => new Set(selectedPath ? [selectedPath] : []), [selectedPath]);

  const nodes = useMemo(() => {
    const flat = flattenFiles(tree, expandedSet, selectedSet);
    const byId = new Map(flat.map((n) => [n.id, n]));
    return flat.map((n) => {
      let p = n.parentId;
      let hidden = false;
      while (p) {
        if (!expandedSet.has(p)) {
          hidden = true;
          break;
        }
        p = byId.get(p)?.parentId ?? null;
      }
      return { ...n, isCollapsed: hidden };
    });
  }, [tree, expandedSet, selectedSet]);

  const visibleFiles = useMemo(() => nodes.filter((n) => !n.isFolder && !n.isCollapsed), [nodes]);

  // Folder fold: the chevron springs round and the folder's rows spring open or shut (as on the Code page).
  const prevExpanded = useRef<Set<string>>(expandedSet);
  useLayoutEffect(() => {
    const prev = prevExpanded.current;
    prevExpanded.current = expandedSet;
    const root = treeRef.current;
    if (!root || isMotionOff()) return;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    nodes
      .filter((n) => n.hasChildren && prev.has(n.id) !== expandedSet.has(n.id))
      .forEach((folder) => {
        const open = expandedSet.has(folder.id);
        const ref = open ? expandedSet : prev;
        const chev = root.querySelector<HTMLElement>(`[data-id="${CSS.escape(folder.id)}"] [data-chev]`);
        if (chev) springAnim(chev, [{ rotate: open ? "0deg" : "90deg" }, { rotate: open ? "90deg" : "0deg" }], 0.26, 0.55);
        nodes.forEach((n) => {
          let p = n.parentId;
          let inside = false;
          while (p) {
            if (p === folder.id) {
              inside = true;
              break;
            }
            if (!ref.has(p)) break;
            p = byId.get(p)?.parentId ?? null;
          }
          if (!inside) return;
          const el = root.querySelector<HTMLElement>(`[data-id="${CSS.escape(n.id)}"]`);
          if (!el) return;
          el.style.overflow = "hidden";
          const a = open
            ? springAnim(el, [{ height: "0px", opacity: 0 }, { height: "32px", opacity: 1 }], 0.3, 0.72)
            : springAnim(el, [{ height: "32px", opacity: 1 }, { height: "0px", opacity: 0 }], 0.26, 0.9);
          if (a) a.onfinish = () => (el.style.overflow = "");
          else el.style.overflow = "";
        });
      });
  }, [expandedSet, nodes]);

  const toggleFolder = (id: string) => setCollapsed((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const i = visibleFiles.findIndex((n) => n.id === selectedPath);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = visibleFiles[Math.max(0, Math.min(visibleFiles.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
      if (next) onSelect(next.id);
    } else if (e.key === " " && selectedPath) {
      e.preventDefault();
      onSetIncluded([selectedPath], excludedSet.has(selectedPath));
    }
  };

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label="Files to export"
      aria-activedescendant={selectedPath ? `xd-row-${selectedPath}` : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="ll:flex ll:flex-col ll:outline-none ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
    >
      {nodes.map((node) => {
        const item = indexOfItem(tree, node.id);
        const paths = item ? filePathsUnder(item) : [node.id];
        const off = paths.filter((p) => excludedSet.has(p)).length;
        const checked = off === 0;
        const mixed = off > 0 && off < paths.length;
        const isSelected = !node.isFolder && node.id === selectedPath;
        const Glyph = iconFor(node.name, node.isFolder);
        return (
          <div
            key={node.id}
            id={`xd-row-${node.id}`}
            role="treeitem"
            data-id={node.id}
            aria-selected={isSelected}
            aria-expanded={node.isFolder ? node.expanded : undefined}
            style={{ paddingLeft: `calc(var(--ll-spacing-3) + ${node.level} * var(--ll-spacing-4))`, display: node.isCollapsed ? "none" : undefined }}
            className={`ll:relative ll:flex ll:items-center ll:gap-2 ll:h-8 ll:pr-3 ll:shrink-0 ll:select-none ll:text-body ${
              isSelected ? "ll:font-medium ll:bg-select-bg ll:text-select-fg" : "ll:text-secondary ll:hover:bg-surface-canvas ll:hover:text-primary"
            }`}
          >
            {node.isFolder ? (
              <button
                type="button"
                tabIndex={-1}
                aria-label={node.expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
                onClick={() => toggleFolder(node.id)}
                className="ll:w-3 ll:h-3 ll:grid ll:place-items-center ll:shrink-0 ll:p-0 ll:border-0 ll:bg-transparent ll:text-muted ll:hover:text-primary ll:cursor-pointer"
              >
                <span data-chev className="ll:grid ll:place-items-center" style={{ rotate: node.expanded ? "90deg" : "0deg" }}>
                  <Icon icon={ChevronRight} size={12} />
                </span>
              </button>
            ) : (
              <span className="ll:w-3 ll:h-3 ll:shrink-0" />
            )}
            <Checkbox
              checked={checked}
              indeterminate={mixed}
              onChange={(next) => onSetIncluded(paths, next)}
              aria-label={`Include ${node.name}`}
              className="ll:shrink-0"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => (node.isFolder ? toggleFolder(node.id) : onSelect(node.id))}
              className={`ll:flex ll:flex-1 ll:min-w-0 ll:items-center ll:gap-2 ll:h-full ll:p-0 ll:border-0 ll:bg-transparent ll:text-left ll:text-body ll:cursor-pointer ll:outline-none ll:text-inherit ${
                checked || mixed ? "" : "ll:opacity-50"
              }`}
            >
              <span className={`ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:shrink-0 ${isSelected ? "ll:text-select-fg" : "ll:text-muted"}`}>
                <Icon icon={Glyph} size={16} />
              </span>
              <span className="ll:truncate ll:min-w-0">{node.name}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};
