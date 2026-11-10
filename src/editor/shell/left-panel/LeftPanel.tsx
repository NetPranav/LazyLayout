"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import { useFocusScope } from "@/core/commands";
import type { LeftPanelProps, LayerItem, FileItem, TrackItem, AssetItem } from "./types";
import { LeftPanelHeader } from "./LeftPanelHeader";
import { LayersTree } from "./LayersTree";
import { FilesTree } from "./FilesTree";
import { AssetsSection } from "./AssetsSection";
import { flattenLayers, flattenFiles, filterTreeNodes } from "./treeFilter";
import { ASSETS_DEFAULT_HEIGHT } from "./constants";

const EMPTY_LAYERS: LayerItem[] = [];
const EMPTY_FILES: FileItem[] = [];
const EMPTY_TRACKS: TrackItem[] = [];
const EMPTY_ASSETS: AssetItem[] = [];

export const LeftPanel: React.FC<LeftPanelProps> = ({
  mode = "design",
  headerStart,
  layers = EMPTY_LAYERS,
  files = EMPTY_FILES,
  tracks: _tracks = EMPTY_TRACKS,
  assets = EMPTY_ASSETS,
  selectedIds: controlledSelectedIds,
  onSelect: controlledOnSelect,
  selectedTrackId: _controlledSelectedTrackId,
  onSelectTrack: _controlledOnSelectTrack,
  expandedIds: controlledExpandedIds,
  onToggleExpand: controlledOnToggleExpand,
  onToggleHidden: controlledOnToggleHidden,
  onToggleLocked: controlledOnToggleLocked,
  onMoveLayer: controlledOnMoveLayer,
  onRename,
  onLayerAction,
  onFileAction,
  onUploadAsset,
  onSelectAsset,
  searchOpen: controlledSearchOpen,
  onSearchOpenChange,
  searchQuery: controlledSearchQuery,
  onSearchQueryChange,
  assetsOpen: controlledAssetsOpen,
  onAssetsOpenChange,
  assetsHeight: controlledAssetsHeight,
  onAssetsHeightChange,
  tracksHeight: _tracksHeight,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Uncontrolled state fallbacks (clean defaults, no hardcoded sample state in production component)
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const [internalExpandedIds, setInternalExpandedIds] = useState<string[]>([]);
  const [internalHiddenIds, setInternalHiddenIds] = useState<string[]>([]);
  const [internalLockedIds, setInternalLockedIds] = useState<string[]>([]);
  const [internalSearchOpen, setInternalSearchOpen] = useState(false);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [internalAssetsOpen, setInternalAssetsOpen] = useState(false);
  const [internalAssetsHeight, setInternalAssetsHeight] = useState(ASSETS_DEFAULT_HEIGHT);

  const selectedIds = controlledSelectedIds ?? internalSelectedIds;
  const expandedIds = controlledExpandedIds ?? internalExpandedIds;
  const searchOpen = controlledSearchOpen ?? internalSearchOpen;
  const searchQuery = controlledSearchQuery ?? internalSearchQuery;
  const assetsOpen = controlledAssetsOpen ?? internalAssetsOpen;
  const assetsHeight = controlledAssetsHeight ?? internalAssetsHeight;

  const isCode = mode === "code";
  const isDesign = mode === "design";

  // Pure filtering and match count derivation during render (no setState in useEffect)
  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const hiddenSet = useMemo(() => new Set(internalHiddenIds), [internalHiddenIds]);
  const lockedSet = useMemo(() => new Set(internalLockedIds), [internalLockedIds]);

  const { visibleNodes: visibleLayerNodes, matchCount: layerMatchCount } = useMemo(() => {
    if (isCode) return { visibleNodes: [], matchCount: 0 };
    const all = flattenLayers(layers, expandedSet, selectedSet, hiddenSet, lockedSet);
    return filterTreeNodes(all, searchQuery, { keepCollapsed: true });
  }, [isCode, layers, expandedSet, selectedSet, hiddenSet, lockedSet, searchQuery]);

  const { visibleNodes: visibleFileNodes, matchCount: fileMatchCount } = useMemo(() => {
    if (!isCode) return { visibleNodes: [], matchCount: 0 };
    const all = flattenFiles(files, expandedSet, selectedSet);
    return filterTreeNodes(all, searchQuery, { keepCollapsed: true });
  }, [isCode, files, expandedSet, selectedSet, searchQuery]);

  const matchCount = isCode ? fileMatchCount : layerMatchCount;

  // Handlers with controlled / uncontrolled fallback
  const handleSelect = useCallback(
    (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
      if (controlledOnSelect) {
        controlledOnSelect(id, e);
      } else {
        if (e?.shiftKey && internalSelectedIds.length > 0) {
          const list = isCode ? visibleFileNodes.map((n) => n.id) : visibleLayerNodes.map((n) => n.id);
          const last = internalSelectedIds[internalSelectedIds.length - 1];
          const a = list.indexOf(last);
          const b = list.indexOf(id);
          if (a > -1 && b > -1) {
            const min = Math.min(a, b);
            const max = Math.max(a, b);
            setInternalSelectedIds(list.slice(min, max + 1));
            return;
          }
        }
        if (e?.ctrlKey || e?.metaKey) {
          setInternalSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
          );
          return;
        }
        setInternalSelectedIds([id]);
      }
    },
    [controlledOnSelect, isCode, visibleFileNodes, visibleLayerNodes, internalSelectedIds]
  );


  const handleToggleExpand = useCallback(
    (id: string) => {
      if (controlledOnToggleExpand) {
        controlledOnToggleExpand(id);
      } else {
        setInternalExpandedIds((prev) =>
          prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
      }
    },
    [controlledOnToggleExpand]
  );

  const handleToggleHidden = useCallback(
    (id: string) => {
      if (controlledOnToggleHidden) {
        controlledOnToggleHidden(id);
      } else {
        setInternalHiddenIds((prev) =>
          prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
      }
    },
    [controlledOnToggleHidden]
  );

  const handleToggleLocked = useCallback(
    (id: string) => {
      if (controlledOnToggleLocked) {
        controlledOnToggleLocked(id);
      } else {
        setInternalLockedIds((prev) =>
          prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
      }
    },
    [controlledOnToggleLocked]
  );

  const handleToggleSearch = useCallback(() => {
    const next = !searchOpen;
    if (onSearchOpenChange) {
      onSearchOpenChange(next);
    } else {
      setInternalSearchOpen(next);
    }
    if (!next) {
      if (onSearchQueryChange) {
        onSearchQueryChange("");
      } else {
        setInternalSearchQuery("");
      }
    }
  }, [searchOpen, onSearchOpenChange, onSearchQueryChange]);

  const handleSearchChange = useCallback(
    (q: string) => {
      if (onSearchQueryChange) {
        onSearchQueryChange(q);
      } else {
        setInternalSearchQuery(q);
      }
    },
    [onSearchQueryChange]
  );

  const handleToggleAssetsOpen = useCallback(() => {
    const next = !assetsOpen;
    if (onAssetsOpenChange) {
      onAssetsOpenChange(next);
    } else {
      setInternalAssetsOpen(next);
    }
  }, [assetsOpen, onAssetsOpenChange]);

  const handleAssetsHeightChange = useCallback(
    (h: number) => {
      if (onAssetsHeightChange) {
        onAssetsHeightChange(h);
      } else {
        setInternalAssetsHeight(h);
      }
    },
    [onAssetsHeightChange]
  );

  // Layer shortcuts (Delete, Duplicate, Group, Select all) work while the pointer is over the Layers list, as they do over the canvas.
  useFocusScope("canvas", containerRef);

  return (
    <aside
      ref={containerRef}
      aria-label={isCode ? "Files" : "Layers"}
      data-testid="left-panel"
      className={`zone left ll-zone ll-left ll:flex ll:flex-col ll:w-full ll:h-full ll:bg-surface-panel ll:border-r ll:border-border ll:select-none ll:overflow-hidden ll:min-h-0 ll:min-w-0 ${className}`}
    >
      {/* Zone Header + Search Bar */}
      <LeftPanelHeader
        mode={mode}
        headerStart={headerStart}
        searchOpen={searchOpen}
        onToggleSearch={handleToggleSearch}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        matchCount={matchCount}
      />

      {/* Main Body based on mode */}
      {isCode ? (
        <FilesTree
          files={files}
          selectedIds={selectedIds}
          expandedIds={expandedIds}
          searchQuery={searchQuery}
          visibleNodes={visibleFileNodes}
          onSelect={handleSelect}
          onToggleExpand={handleToggleExpand}
          onRename={onRename}
          onFileAction={onFileAction}
        />
      ) : (
        <LayersTree
          layers={layers}
          selectedIds={selectedIds}
          expandedIds={expandedIds}
          searchQuery={searchQuery}
          visibleNodes={visibleLayerNodes}
          onSelect={handleSelect}
          onToggleExpand={handleToggleExpand}
          onToggleHidden={handleToggleHidden}
          onToggleLocked={handleToggleLocked}
          onMoveLayer={controlledOnMoveLayer}
          onRename={onRename}
          onLayerAction={onLayerAction}
          showMotion={isDesign}
        />
      )}

      {/* Design Mode: Assets section with resizable split (hidden in motion and code modes) */}
      {isDesign && (
        <AssetsSection
          assets={assets}
          isOpen={assetsOpen}
          onToggleOpen={handleToggleAssetsOpen}
          height={assetsHeight}
          onHeightChange={handleAssetsHeightChange}
          containerRef={containerRef}
          onUploadAsset={onUploadAsset}
          onSelectAsset={onSelectAsset}
        />
      )}
    </aside>
  );
};
