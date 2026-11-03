"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import type { LeftPanelProps, LayerItem, FileItem, TrackItem, AssetItem } from "./types";
import { LeftPanelHeader } from "./LeftPanelHeader";
import { LayersTree } from "./LayersTree";
import { FilesTree } from "./FilesTree";
import { TracksList } from "./TracksList";
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
  tracks = EMPTY_TRACKS,
  assets = EMPTY_ASSETS,
  selectedIds: controlledSelectedIds,
  onSelect: controlledOnSelect,
  selectedTrackId: controlledSelectedTrackId,
  onSelectTrack: controlledOnSelectTrack,
  expandedIds: controlledExpandedIds,
  onToggleExpand: controlledOnToggleExpand,
  onToggleHidden: controlledOnToggleHidden,
  onToggleLocked: controlledOnToggleLocked,
  onRename,
  onLayerAction,
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
  tracksHeight,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Uncontrolled state fallbacks (clean defaults, no hardcoded sample state in production component)
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const [internalExpandedIds, setInternalExpandedIds] = useState<string[]>([]);
  const [internalHiddenIds, setInternalHiddenIds] = useState<string[]>([]);
  const [internalLockedIds, setInternalLockedIds] = useState<string[]>([]);
  const [internalSelectedTrackId, setInternalSelectedTrackId] = useState<string>("");
  const [internalSearchOpen, setInternalSearchOpen] = useState(false);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [internalAssetsOpen, setInternalAssetsOpen] = useState(false);
  const [internalAssetsHeight, setInternalAssetsHeight] = useState(ASSETS_DEFAULT_HEIGHT);

  const selectedIds = controlledSelectedIds ?? internalSelectedIds;
  const expandedIds = controlledExpandedIds ?? internalExpandedIds;
  const selectedTrackId = controlledSelectedTrackId ?? internalSelectedTrackId;
  const searchOpen = controlledSearchOpen ?? internalSearchOpen;
  const searchQuery = controlledSearchQuery ?? internalSearchQuery;
  const assetsOpen = controlledAssetsOpen ?? internalAssetsOpen;
  const assetsHeight = controlledAssetsHeight ?? internalAssetsHeight;

  // Handlers with controlled / uncontrolled fallback
  const handleSelect = useCallback(
    (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
      if (controlledOnSelect) {
        controlledOnSelect(id, e);
      } else {
        setInternalSelectedIds([id]);
      }
    },
    [controlledOnSelect]
  );

  const handleSelectTrack = useCallback(
    (id: string) => {
      if (controlledOnSelectTrack) {
        controlledOnSelectTrack(id);
      } else {
        setInternalSelectedTrackId(id);
      }
    },
    [controlledOnSelectTrack]
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

  const isCode = mode === "code";
  const isMotion = mode === "motion";
  const isDesign = mode === "design";

  // Pure filtering and match count derivation during render (no setState in useEffect)
  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const hiddenSet = useMemo(() => new Set(internalHiddenIds), [internalHiddenIds]);
  const lockedSet = useMemo(() => new Set(internalLockedIds), [internalLockedIds]);

  const { visibleNodes: visibleLayerNodes, matchCount: layerMatchCount } = useMemo(() => {
    if (isCode) return { visibleNodes: [], matchCount: 0 };
    const all = flattenLayers(layers, expandedSet, selectedSet, hiddenSet, lockedSet);
    return filterTreeNodes(all, searchQuery);
  }, [isCode, layers, expandedSet, selectedSet, hiddenSet, lockedSet, searchQuery]);

  const { visibleNodes: visibleFileNodes, matchCount: fileMatchCount } = useMemo(() => {
    if (!isCode) return { visibleNodes: [], matchCount: 0 };
    const all = flattenFiles(files, expandedSet, selectedSet);
    return filterTreeNodes(all, searchQuery);
  }, [isCode, files, expandedSet, selectedSet, searchQuery]);

  const matchCount = isCode ? fileMatchCount : layerMatchCount;

  return (
    <aside
      ref={containerRef}
      aria-label={isCode ? "Files" : "Layers"}
      className={`ll-zone ll-left ll:flex ll:flex-col ll:w-panel-left ll:h-full ll:bg-surface-panel ll:border-r ll:border-border ll:select-none ll:overflow-hidden ll:min-h-0 ll:min-w-0 ${className}`}
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
          onRename={onRename}
          onLayerAction={onLayerAction}
          showMotion={isDesign}
        />
      )}

      {/* Motion Mode: Tracks section at bottom */}
      {isMotion && (
        <TracksList
          tracks={tracks}
          selectedTrackId={selectedTrackId}
          onSelectTrack={handleSelectTrack}
          height={tracksHeight}
        />
      )}

      {/* Design Mode: Assets section with resizable split */}
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
