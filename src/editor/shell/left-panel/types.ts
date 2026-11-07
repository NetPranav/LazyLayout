import React from "react";

export type LeftPanelMode = "design" | "motion" | "code";

export interface LayerItem {
  id: string;
  name: string;
  type?:
    | "frame"
    | "text"
    | "box"
    | "image"
    | "circle"
    | "line"
    | "poly"
    | "star"
    | "button"
    | "input"
    | "toggle"
    | "divider"
    | "container"
    | string;
  level?: number;
  hasChildren?: boolean;
  expanded?: boolean;
  selected?: boolean;
  hidden?: boolean;
  locked?: boolean;
  hasMotion?: boolean;
  labelColor?: number;
  parentId?: string | null;
  children?: LayerItem[];
}

export interface FileItem {
  id: string;
  name: string;
  isFolder?: boolean;
  level?: number;
  hasChildren?: boolean;
  expanded?: boolean;
  selected?: boolean;
  modified?: boolean;
  cat?: "All" | "Pages" | "Components" | "Styles" | "Config" | string;
  dir?: string;
  parentId?: string | null;
  children?: FileItem[];
}

export interface TrackItem {
  id: string;
  name: string;
  selected?: boolean;
  layerId?: string;
}

export interface AssetItem {
  id: string;
  name: string;
  kind?: "image" | "font" | "svg" | "icon" | "box" | string;
  thumbUrl?: string;
  size?: string;
}

export type FileMenuAction =
  | "open"
  | "open-side"
  | "copy-path"
  | "download"
  | "reveal-layer";

export type LayerMenuAction =
  | "ask-ai"
  | "copy"
  | "paste"
  | "paste-in-place"
  | "duplicate"
  | "delete"
  | "group"
  | "frame-selection"
  | "tidy-up"
  | "ungroup"
  | "rename"
  | "split-letters"
  | "select-all"
  | "show-all"
  | "unlock-all"
  | "copy-as-code"
  | "add-animation"
  | "bring-forward"
  | "send-backward"
  | "bring-to-front"
  | "send-to-back"
  | "align-left"
  | "align-center"
  | "align-right"
  | "align-top"
  | "align-middle"
  | "align-bottom"
  | "distribute-horizontally"
  | "distribute-vertically"
  | "set-label-1"
  | "set-label-2"
  | "set-label-3"
  | "set-label-4"
  | "set-label-5"
  | "set-label-6"
  | "set-label-default";

export interface LeftPanelProps {
  /** Active editor mode: design (layers + assets), motion (layers + tracks), or code (files) */
  mode?: LeftPanelMode;
  /** Slot for leading header content (e.g. PageSwitcher in design mode) */
  headerStart?: React.ReactNode;
  /** Layer tree data */
  layers?: LayerItem[];
  /** File tree data for code mode */
  files?: FileItem[];
  /** Track list data for motion mode */
  tracks?: TrackItem[];
  /** Asset items for design mode */
  assets?: AssetItem[];
  /** Currently selected IDs in the active tree */
  selectedIds?: string[];
  /** Selection callback */
  onSelect?: (id: string, e?: React.MouseEvent | React.KeyboardEvent) => void;
  /** Currently selected track ID in motion mode */
  selectedTrackId?: string;
  /** Track selection callback */
  onSelectTrack?: (id: string) => void;
  /** Expanded node IDs */
  expandedIds?: string[];
  /** Expansion toggle callback */
  onToggleExpand?: (id: string) => void;
  /** Hide/show toggle callback for layers */
  onToggleHidden?: (id: string) => void;
  /** Lock/unlock toggle callback for layers */
  onToggleLocked?: (id: string) => void;
  /** Layer move / reorder callback */
  onMoveLayer?: (ids: string[], parentId: string | null, index?: number) => void;
  /** Layer context menu action callback (everything except hide and lock, which use the toggle callbacks) */
  onLayerAction?: (action: LayerMenuAction, id: string) => void;
  /** File context menu action callback */
  onFileAction?: (action: FileMenuAction, id: string) => void;
  /** Rename callback for layers or files */
  onRename?: (id: string, newName: string) => void;
  /** Callback when asset upload button is clicked */
  onUploadAsset?: () => void;
  /** Callback when an asset is clicked */
  onSelectAsset?: (asset: AssetItem) => void;
  /** Controlled search open state */
  searchOpen?: boolean;
  /** Search open state change callback */
  onSearchOpenChange?: (open: boolean) => void;
  /** Controlled search query */
  searchQuery?: string;
  /** Search query change callback */
  onSearchQueryChange?: (query: string) => void;
  /** Controlled assets section open state */
  assetsOpen?: boolean;
  /** Assets section open state change callback */
  onAssetsOpenChange?: (open: boolean) => void;
  /** Controlled height for resizable assets panel */
  assetsHeight?: number;
  /** Assets height change callback */
  onAssetsHeightChange?: (height: number) => void;
  /** Tracks section height in motion mode (defaults to var(--bh, 260px)) */
  tracksHeight?: number | string;
  /** Optional class name */
  className?: string;
}
