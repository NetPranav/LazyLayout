import type {
  LeftPanelMode,
  LayerItem,
  FileItem,
  TrackItem,
  AssetItem,
  LayerMenuAction,
  LeftPanelProps,
} from "@/editor/shell/left-panel/types";
import type { PageDefinition } from "@/core/store/useProjectStore";

export type {
  LeftPanelMode,
  LayerItem,
  FileItem,
  TrackItem,
  AssetItem,
  LayerMenuAction,
  LeftPanelProps,
};

export interface UsePagesDataReturn {
  /** Array of page names for PageSwitcher dropdown */
  pages: readonly string[];
  /** Active page name */
  currentPage: string;
  /** Active page ID */
  activePageId: string;
  /** Switch active page */
  onSelectPage: (pageName: string) => void;
  /** Create a new page */
  onNewPage: () => void;
  /** Rename a page to the given name */
  onRenamePage: (pageName: string, newName: string) => void;
  /** Duplicate a page */
  onDuplicatePage: (pageName: string) => void;
  /** Delete a page */
  onDeletePage: (pageName: string) => void;
  /** Raw pages dictionary from useProjectStore */
  rawPages: Record<string, PageDefinition>;
  /** Which listed names are loading pages (thin rows between two pages) */
  pageKinds: Record<string, "page" | "loading">;
  /** The + between two pages: adds a loading page there */
  onAddLoading: (fromName: string, toName: string) => void;
}

export interface UseLeftPanelDataOptions {
  /** Active editor mode: design, motion, or code */
  mode?: LeftPanelMode;
  /** When true, only layers under the active page rootElementId are displayed */
  filterByActivePage?: boolean;
}

export interface UseLeftPanelDataReturn extends LeftPanelProps {
  /** Helper to move layers within tree (calls layer.move command) */
  /** Returns why the move was refused, if it was. */
  onMoveLayer: (ids: string[], parentId: string | null, index?: number) => string | void;
  /** All document layer items before filtering */
  allLayers: LayerItem[];
}

export interface LeftPanelConnectedProps extends Partial<LeftPanelProps> {
  mode?: LeftPanelMode;
  filterByActivePage?: boolean;
}
