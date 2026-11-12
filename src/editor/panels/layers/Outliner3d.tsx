"use client";

/**
 * ============================================================================
 * 3D OUTLINER COMPONENT (ROADMAP_3D Phases 3D-021, 3D-024)
 * ============================================================================
 * Scene tree outliner rendered in the Layers panel when a 3D scene is active.
 * Displays:
 *   - Collections, objects, data blocks (mesh, light, camera), materials, modifiers
 *   - Visibility (eye), selectability (arrow cursor), and render (camera) toggles
 *   - Selection synchronized between 3D viewport store and document selection store
 *   - Inline renaming on double-click or Enter
 *   - Drag and drop reparenting (reparent) and collection moving
 *   - Shared data block user count badges and "Make single user" buttons
 *   - Context menu with "Copy attributes" and "Paste attributes to selected"
 * ============================================================================
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  Box,
  Sun,
  Camera,
  CircleDashed,
  Circle,
  Palette,
  Wrench,
  Eye,
  EyeOff,
  MousePointer,
  Copy,
  ClipboardPaste,
  Trash2,
  Search,
  X,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { Menu, MenuItem, MenuSeparator, SubMenu } from "@/editor/components/Menu";
import { MENU_ICON_SIZE } from "@/editor/components/topbar-constants";
import { useDocument } from "@/core/store/useDocumentStore";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { invokeCommand } from "@/core/commands";
import {
  buildOutliner,
  flattenVisible,
  type OutlinerNode,
} from "@/core/3d/outliner/tree";
import { userCounts } from "@/core/3d/blocks/userCounts";
import { click } from "@/core/3d/pick/select";

export interface Outliner3dProps {
  sceneId: string;
  className?: string;
}

interface DragState {
  draggedId: string;
  targetId: string | null;
  position: "inside" | "before" | "after" | null;
}

// Module-level clipboard for copied 3D attributes
let copiedAttributesObjectId: string | null = null;

function getNodeIcon(node: OutlinerNode, expanded: boolean): React.ReactNode {
  switch (node.kind) {
    case "collection":
      return expanded ? (
        <Icon icon={FolderOpen} size={14} className="ll:text-primary" />
      ) : (
        <Icon icon={Folder} size={14} className="ll:text-primary" />
      );
    case "object":
      switch (node.icon) {
        case "mesh":
          return <Icon icon={Box} size={14} className="ll:text-secondary" />;
        case "light":
          return <Icon icon={Sun} size={14} className="ll:text-secondary" />;
        case "camera":
          return <Icon icon={Camera} size={14} className="ll:text-secondary" />;
        case "empty":
          return <Icon icon={CircleDashed} size={14} className="ll:text-secondary" />;
        default:
          return <Icon icon={Box} size={14} className="ll:text-secondary" />;
      }
    case "data":
      switch (node.icon) {
        case "mesh":
          return <Icon icon={Box} size={13} className="ll:text-muted" />;
        case "light":
          return <Icon icon={Sun} size={13} className="ll:text-muted" />;
        case "camera":
          return <Icon icon={Camera} size={13} className="ll:text-muted" />;
        default:
          return <Icon icon={Circle} size={13} className="ll:text-muted" />;
      }
    case "material":
      return <Icon icon={Palette} size={13} className="ll:text-muted" />;
    case "modifier":
      return <Icon icon={Wrench} size={13} className="ll:text-muted" />;
    default:
      return <Icon icon={Circle} size={13} className="ll:text-muted" />;
  }
}

export const Outliner3d: React.FC<Outliner3dProps> = ({ sceneId, className = "" }) => {
  const doc = useDocument((d) => d);
  const viewportSelection = useViewportStore((s) => s.selection);
  const setViewportSelection = useViewportStore((s) => s.setSelection);
  const setEditingSceneId = useViewportStore((s) => s.setEditingSceneId);

  const containerRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: OutlinerNode;
  } | null>(null);

  // Compute hierarchical outliner tree
  const tree = useMemo(() => buildOutliner(doc, sceneId), [doc, sceneId]);

  // Track expanded parent nodes (default to all top-level collections & root objects expanded)
  const initialExpanded = useMemo(() => {
    const ids = new Set<string>();
    for (const node of tree) {
      ids.add(node.id);
      for (const child of node.children) {
        if (child.kind === "collection" || child.kind === "object") {
          ids.add(child.id);
        }
      }
    }
    return ids;
  }, [tree]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(initialExpanded);

  // Synchronize expanded IDs when tree structure expands
  /* eslint-disable react-hooks/set-state-in-effect -- new rows of the tree open by default; the set follows the document's tree */
  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const node of tree) {
        if (!prev.has(node.id)) next.add(node.id);
      }
      return next;
    });
  }, [tree]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Compute flattened list of visible nodes
  const visibleNodes = useMemo(
    () => flattenVisible(tree, expandedIds),
    [tree, expandedIds]
  );

  // Filter visible nodes by search query
  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visibleNodes;
    return visibleNodes.filter((node) => node.label.toLowerCase().includes(q));
  }, [visibleNodes, searchQuery]);

  // Data block user counts table
  const counts = useMemo(() => userCounts(doc), [doc]);

  // Get user count for a shared data block or material
  const getNodeUserCount = useCallback(
    (node: OutlinerNode): number => {
      if (node.kind === "data") {
        if (!node.dataId) return 1;
        return (
          counts.meshes[node.dataId] ??
          counts.lights[node.dataId] ??
          counts.cameras[node.dataId] ??
          counts.armatures[node.dataId] ??
          1
        );
      }
      if (node.kind === "material") {
        return counts.materials[node.id] ?? 1;
      }
      return 1;
    },
    [counts]
  );

  // Toggle expand / collapse
  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Selection handler (both viewportStore and IDE useSelectionStore)
  const handleSelectNode = useCallback(
    (node: OutlinerNode, e: React.MouseEvent | React.KeyboardEvent) => {
      const targetId = node.objectId ?? node.id;
      const nextSel = click(viewportSelection, targetId, {
        shift: e.shiftKey,
        ctrl: e.ctrlKey || e.metaKey,
      });
      setViewportSelection(nextSel);

      if (nextSel.selected.length > 0) {
        useSelectionStore
          .getState()
          .selectMultiple(Array.from(nextSel.selected), "element");
      } else {
        useSelectionStore.getState().clearSelection();
      }
    },
    [viewportSelection, setViewportSelection]
  );

  // Flag toggles (eye, arrow, camera)
  const handleToggleFlag = useCallback(
    (node: OutlinerNode, flag: "visible" | "selectable" | "renderVisible") => {
      const targetId = node.objectId ?? node.id;
      const currentVal = node.flags[flag];
      void invokeCommand("3d.outliner.set_flag", {
        id: targetId,
        flag,
        value: !currentVal,
      });
    },
    []
  );

  // Inline rename commit
  const handleCommitRename = useCallback(
    (nodeId: string) => {
      const trimmed = draftName.trim();
      setEditingId(null);
      if (trimmed) {
        void invokeCommand("3d.outliner.rename", {
          id: nodeId,
          newName: trimmed,
        });
      }
    },
    [draftName]
  );

  // Make single user
  const handleMakeSingleUser = useCallback((node: OutlinerNode) => {
    if (!node.objectId) return;
    const target = node.kind === "material" ? "material" : "mesh";
    void invokeCommand("3d.blocks.make_single_user", {
      objectId: node.objectId,
      target,
      slot: node.slot,
    });
  }, []);

  // HTML5 Drag and Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, node: OutlinerNode) => {
    if (node.kind !== "object") return;
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
    setDragState({
      draggedId: node.id,
      targetId: null,
      position: null,
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetNode: OutlinerNode) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const height = rect.height;

    let position: "before" | "after" | "inside" = "inside";
    if (relY < height * 0.25) {
      position = "before";
    } else if (relY > height * 0.75) {
      position = "after";
    }

    setDragState((prev) =>
      prev
        ? {
            ...prev,
            targetId: targetNode.id,
            position,
          }
        : null
    );
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragState((prev) =>
      prev ? { ...prev, targetId: null, position: null } : null
    );
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetNode: OutlinerNode) => {
      e.preventDefault();
      e.stopPropagation();

      const draggedId = e.dataTransfer.getData("text/plain") || dragState?.draggedId;
      setDragState(null);

      if (!draggedId || draggedId === targetNode.id) return;

      if (targetNode.kind === "object") {
        void invokeCommand("3d.outliner.reparent", {
          objectId: draggedId,
          newParentId: targetNode.id,
        });
      } else if (targetNode.kind === "collection") {
        void invokeCommand("3d.outliner.move_to_collection", {
          objectId: draggedId,
          collectionId: targetNode.id,
        });
      }
    },
    [dragState]
  );

  const handleDropOnBackground = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData("text/plain") || dragState?.draggedId;
      setDragState(null);
      if (draggedId) {
        // Unparent to scene root
        void invokeCommand("3d.outliner.reparent", {
          objectId: draggedId,
          newParentId: null,
        });
      }
    },
    [dragState]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (filteredNodes.length === 0) return;
      const activeId = viewportSelection.active;
      const currentIndex = filteredNodes.findIndex(
        (n) => (n.objectId ?? n.id) === activeId || n.id === activeId
      );

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIdx = Math.min(currentIndex + 1, filteredNodes.length - 1);
          const nextNode = filteredNodes[nextIdx];
          if (nextNode) handleSelectNode(nextNode, e);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIdx = Math.max(currentIndex - 1, 0);
          const prevNode = filteredNodes[prevIdx];
          if (prevNode) handleSelectNode(prevNode, e);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const curr = filteredNodes[currentIndex];
          if (curr && curr.children.length > 0) {
            if (!expandedIds.has(curr.id)) {
              handleToggleExpand(curr.id);
            } else if (currentIndex + 1 < filteredNodes.length) {
              handleSelectNode(filteredNodes[currentIndex + 1], e);
            }
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const curr = filteredNodes[currentIndex];
          if (curr) {
            if (curr.children.length > 0 && expandedIds.has(curr.id)) {
              handleToggleExpand(curr.id);
            }
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          const curr = filteredNodes[currentIndex];
          if (curr && !editingId) {
            setEditingId(curr.id);
            setDraftName(curr.label);
          }
          break;
        }
        case "Delete":
        case "Backspace": {
          if (editingId) return;
          e.preventDefault();
          const curr = filteredNodes[currentIndex];
          if (curr) {
            if (curr.kind === "object") {
              void invokeCommand("3d.object.delete", { objectId: curr.id });
            } else {
              void invokeCommand("3d.outliner.delete", { id: curr.id });
            }
          }
          break;
        }
      }
    },
    [
      filteredNodes,
      viewportSelection.active,
      expandedIds,
      editingId,
      handleSelectNode,
      handleToggleExpand,
    ]
  );

  // Scene details
  const sceneName = doc.scenes?.[sceneId]?.name ?? "Scene";

  return (
    <div
      ref={containerRef}
      role="tree"
      tabIndex={0}
      aria-label="3D Scene Outliner"
      data-testid="outliner-3d"
      onKeyDown={handleKeyDown}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDropOnBackground}
      className={`ll:flex ll:flex-col ll:w-full ll:h-full ll:min-h-0 ll:bg-surface-panel ll:font-sans ll:outline-none ll:select-none ${className}`}
    >
      {/* 1. Header Toolbar */}
      <div className="ll:h-header ll:flex ll:items-center ll:gap-1.5 ll:px-3 ll:border-b ll:border-border ll:shrink-0">
        <IconButton
          size="sm"
          variant="ghost"
          aria-label="Exit 3D Scene"
          title="Exit 3D Scene"
          icon={<Icon icon={ArrowLeft} size={14} />}
          onClick={() => {
            void invokeCommand("3d.scene.exit");
            setEditingSceneId(null);
          }}
        />

        <div className="ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0">
          <span className="ll:text-caption ll:font-semibold ll:text-primary ll:truncate">
            {sceneName}
          </span>
          <span className="ll:px-1 ll:py-0.2 ll:text-nano ll:font-mono ll:bg-surface-bar ll:border ll:border-border ll:rounded-xs ll:text-muted">
            3D
          </span>
        </div>

        <IconButton
          size="sm"
          variant="ghost"
          aria-label="New Collection"
          title="New Collection"
          icon={<Icon icon={Plus} size={14} />}
          onClick={() => {
            void invokeCommand("3d.outliner.create_collection", {
              sceneId,
              name: "Collection",
            });
          }}
        />

        <IconButton
          size="sm"
          variant="ghost"
          pressed={searchOpen}
          aria-label="Search Scene"
          title="Search Scene"
          icon={<Icon icon={Search} size={14} />}
          onClick={() => setSearchOpen((prev) => !prev)}
        />
      </div>

      {/* 2. Optional Search Box */}
      {searchOpen && (
        <div className="ll:flex ll:items-center ll:gap-2 ll:p-2.5 ll:border-b ll:border-border ll:shrink-0">
          <div className="ll:flex ll:items-center ll:gap-2 ll:flex-1 ll:h-7 ll:px-2 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-sm">
            <Icon icon={Search} size={13} className="ll:text-muted ll:shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search objects..."
              className="ll:flex-1 ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:text-small ll:text-primary ll:outline-none ll:placeholder:text-muted"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="ll:text-muted ll:hover:text-primary"
              >
                <Icon icon={X} size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Outliner Rows Scroll Container */}
      <div className="ll:relative ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:py-1">
        {filteredNodes.length === 0 ? (
          <div className="ll:p-4 ll:text-center ll:text-small ll:text-muted">
            {searchQuery ? "No matching objects" : "Empty scene"}
          </div>
        ) : (
          filteredNodes.map((node) => {
            const hasChildren = node.children.length > 0;
            const isExpanded = expandedIds.has(node.id);
            const targetId = node.objectId ?? node.id;
            const isSelected = viewportSelection.selected.includes(targetId);
            const isActive = viewportSelection.active === targetId;
            const userCount = getNodeUserCount(node);
            const isShared = userCount > 1;

            const isDropTarget = dragState?.targetId === node.id;
            const dropPos = isDropTarget ? dragState.position : null;

            let rowDropClass = "";
            if (dropPos === "before") rowDropClass = "ll:shadow-drop-above";
            else if (dropPos === "after") rowDropClass = "ll:shadow-drop-below";
            else if (dropPos === "inside") rowDropClass = "ll:bg-surface-hover";

            return (
              <div
                key={node.id}
                role="treeitem"
                data-testid="outliner-row"
                data-id={node.id}
                data-kind={node.kind}
                data-selected={isSelected ? "true" : "false"}
                aria-selected={isSelected}
                aria-expanded={hasChildren ? isExpanded : undefined}
                draggable={node.kind === "object"}
                onDragStart={(e) => handleDragStart(e, node)}
                onDragOver={(e) => handleDragOver(e, node)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, node)}
                onClick={(e) => handleSelectNode(node, e)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingId(node.id);
                  setDraftName(node.label);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelectNode(node, e);
                  setContextMenu({ x: e.clientX, y: e.clientY, node });
                }}
                style={{
                  paddingLeft: `calc(${node.depth} * 14px + 10px)`,
                }}
                className={`ll:group ll:relative ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:pr-2 ll:text-left ll:cursor-pointer ll:select-none ll:transition-colors ${
                  isSelected
                    ? "ll:bg-select-bg ll:text-select-fg"
                    : isActive
                    ? "ll:bg-surface-bar ll:text-primary"
                    : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
                } ${!node.flags.visible ? "ll:opacity-40" : ""} ${rowDropClass}`}
              >
                {/* Expand / Collapse Chevron */}
                {hasChildren ? (
                  <button
                    type="button"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleExpand(node.id);
                    }}
                    className="ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:shrink-0"
                  >
                    <Icon
                      icon={ChevronRight}
                      size={12}
                      className={`ll:transition-transform ll:duration-120 ${
                        isExpanded ? "ll:rotate-90" : ""
                      }`}
                    />
                  </button>
                ) : (
                  <span className="ll:w-4 ll:h-4 ll:shrink-0" />
                )}

                {/* Node Icon */}
                <span className="ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:shrink-0">
                  {getNodeIcon(node, isExpanded)}
                </span>

                {/* Node Label or Inline Rename Input */}
                <div className="ll:flex-1 ll:min-w-0">
                  {editingId === node.id ? (
                    <input
                      autoFocus
                      data-testid="outliner-rename-input"
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => handleCommitRename(node.id)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") handleCommitRename(node.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="ll:w-full ll:h-5 ll:px-1 ll:bg-surface-bar ll:border ll:border-primary ll:rounded-xs ll:text-small ll:text-primary ll:outline-none"
                    />
                  ) : (
                    <span
                      data-testid="outliner-row-label"
                      className="ll:truncate ll:text-small ll:block"
                    >
                      {node.label}
                    </span>
                  )}
                </div>

                {/* Shared Data Block Badge & Make Single User Button */}
                {isShared && (
                  <div className="ll:flex ll:items-center ll:gap-1 ll:shrink-0">
                    <span
                      data-testid="outliner-user-count"
                      title={`${userCount} users`}
                      className="ll:px-1 ll:py-0.2 ll:text-nano ll:font-mono ll:bg-surface-bar ll:border ll:border-border ll:rounded-xs ll:text-muted"
                    >
                      {userCount}
                    </span>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      data-testid="outliner-make-single-user"
                      aria-label="Make single user"
                      title="Make single user"
                      icon={<Icon icon={Copy} size={11} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMakeSingleUser(node);
                      }}
                    />
                  </div>
                )}

                {/* Visibility, Selectability, Render Toggles */}
                <div className="ll:flex ll:items-center ll:gap-0.5 ll:shrink-0 ll:opacity-0 ll:group-hover:opacity-100 ll:transition-opacity">
                  {/* Eye Toggle (Visibility) */}
                  <IconButton
                    size="sm"
                    variant="ghost"
                    data-testid="outliner-toggle-eye"
                    aria-label={node.flags.visible ? "Hide object" : "Show object"}
                    title={node.flags.visible ? "Hide object" : "Show object"}
                    icon={
                      node.flags.visible ? (
                        <Icon icon={Eye} size={12} />
                      ) : (
                        <Icon icon={EyeOff} size={12} className="ll:text-muted" />
                      )
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFlag(node, "visible");
                    }}
                  />

                  {/* Arrow Toggle (Selectability) */}
                  <IconButton
                    size="sm"
                    variant="ghost"
                    data-testid="outliner-toggle-selectable"
                    aria-label={
                      node.flags.selectable
                        ? "Make unselectable"
                        : "Make selectable"
                    }
                    title={
                      node.flags.selectable
                        ? "Make unselectable"
                        : "Make selectable"
                    }
                    icon={
                      <Icon
                        icon={MousePointer}
                        size={12}
                        className={node.flags.selectable ? "" : "ll:text-muted ll:opacity-40"}
                      />
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFlag(node, "selectable");
                    }}
                  />

                  {/* Camera Toggle (Render Visible) */}
                  <IconButton
                    size="sm"
                    variant="ghost"
                    data-testid="outliner-toggle-camera"
                    aria-label={
                      node.flags.renderVisible
                        ? "Disable in renders"
                        : "Enable in renders"
                    }
                    title={
                      node.flags.renderVisible
                        ? "Disable in renders"
                        : "Enable in renders"
                    }
                    icon={
                      <Icon
                        icon={Camera}
                        size={12}
                        className={
                          node.flags.renderVisible
                            ? ""
                            : "ll:text-muted ll:opacity-40"
                        }
                      />
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFlag(node, "renderVisible");
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Right-Click Context Menu */}
      {contextMenu && (
        <Menu
          open={true}
          onClose={() => setContextMenu(null)}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          variant="context"
          aria-label="3D Outliner Context Menu"
        >
          {/* Copy Attributes */}
          <MenuItem
            data-testid="outliner-copy-attributes"
            icon={<Icon icon={Copy} size={MENU_ICON_SIZE} />}
            onClick={() => {
              copiedAttributesObjectId =
                contextMenu.node.objectId ?? contextMenu.node.id;
              setContextMenu(null);
            }}
          >
            Copy attributes
          </MenuItem>

          {/* Paste Attributes to Selected */}
          <MenuItem
            data-testid="outliner-paste-attributes"
            icon={<Icon icon={ClipboardPaste} size={MENU_ICON_SIZE} />}
            disabled={!copiedAttributesObjectId}
            onClick={() => {
              if (copiedAttributesObjectId) {
                const targetIds =
                  viewportSelection.selected.length > 0
                    ? Array.from(viewportSelection.selected)
                    : [contextMenu.node.objectId ?? contextMenu.node.id];
                void invokeCommand("3d.blocks.copy_attributes", {
                  fromObjectId: copiedAttributesObjectId,
                  toObjectIds: targetIds,
                  parts: ["material", "modifiers", "transform", "visibility"],
                });
              }
              setContextMenu(null);
            }}
          >
            Paste attributes to selected
          </MenuItem>

          {/* Submenu for selective pasting */}
          {copiedAttributesObjectId && (
            <SubMenu
              id="outliner-paste-specific"
              label="Paste specific attribute"
              icon={<Icon icon={ClipboardPaste} size={MENU_ICON_SIZE} />}
            >
              <MenuItem
                onClick={() => {
                  if (copiedAttributesObjectId) {
                    const targetIds =
                      viewportSelection.selected.length > 0
                        ? Array.from(viewportSelection.selected)
                        : [contextMenu.node.objectId ?? contextMenu.node.id];
                    void invokeCommand("3d.blocks.copy_attributes", {
                      fromObjectId: copiedAttributesObjectId,
                      toObjectIds: targetIds,
                      parts: ["material"],
                    });
                  }
                  setContextMenu(null);
                }}
              >
                Material
              </MenuItem>
              <MenuItem
                onClick={() => {
                  if (copiedAttributesObjectId) {
                    const targetIds =
                      viewportSelection.selected.length > 0
                        ? Array.from(viewportSelection.selected)
                        : [contextMenu.node.objectId ?? contextMenu.node.id];
                    void invokeCommand("3d.blocks.copy_attributes", {
                      fromObjectId: copiedAttributesObjectId,
                      toObjectIds: targetIds,
                      parts: ["modifiers"],
                    });
                  }
                  setContextMenu(null);
                }}
              >
                Modifiers
              </MenuItem>
              <MenuItem
                onClick={() => {
                  if (copiedAttributesObjectId) {
                    const targetIds =
                      viewportSelection.selected.length > 0
                        ? Array.from(viewportSelection.selected)
                        : [contextMenu.node.objectId ?? contextMenu.node.id];
                    void invokeCommand("3d.blocks.copy_attributes", {
                      fromObjectId: copiedAttributesObjectId,
                      toObjectIds: targetIds,
                      parts: ["transform"],
                    });
                  }
                  setContextMenu(null);
                }}
              >
                Transform
              </MenuItem>
              <MenuItem
                onClick={() => {
                  if (copiedAttributesObjectId) {
                    const targetIds =
                      viewportSelection.selected.length > 0
                        ? Array.from(viewportSelection.selected)
                        : [contextMenu.node.objectId ?? contextMenu.node.id];
                    void invokeCommand("3d.blocks.copy_attributes", {
                      fromObjectId: copiedAttributesObjectId,
                      toObjectIds: targetIds,
                      parts: ["visibility"],
                    });
                  }
                  setContextMenu(null);
                }}
              >
                Visibility
              </MenuItem>
            </SubMenu>
          )}

          <MenuSeparator />

          {/* Make Single User if shared */}
          {getNodeUserCount(contextMenu.node) > 1 && (
            <MenuItem
              icon={<Icon icon={Copy} size={MENU_ICON_SIZE} />}
              onClick={() => {
                handleMakeSingleUser(contextMenu.node);
                setContextMenu(null);
              }}
            >
              Make single user
            </MenuItem>
          )}

          {/* Rename */}
          <MenuItem
            icon={<Icon icon={Palette} size={MENU_ICON_SIZE} />}
            shortcut="Enter"
            onClick={() => {
              setEditingId(contextMenu.node.id);
              setDraftName(contextMenu.node.label);
              setContextMenu(null);
            }}
          >
            Rename
          </MenuItem>

          {/* Delete */}
          <MenuItem
            icon={<Icon icon={Trash2} size={MENU_ICON_SIZE} />}
            shortcut="Del"
            onClick={() => {
              if (contextMenu.node.kind === "object") {
                void invokeCommand("3d.object.delete", {
                  objectId: contextMenu.node.id,
                });
              } else {
                void invokeCommand("3d.outliner.delete", {
                  id: contextMenu.node.id,
                });
              }
              setContextMenu(null);
            }}
          >
            Delete
          </MenuItem>
        </Menu>
      )}
    </div>
  );
};
