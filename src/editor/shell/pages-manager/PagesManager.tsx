"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, CopyPlus, House, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { useProjectStore } from "@/core/store/useProjectStore";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { Popover } from "@/editor/components/Popover";
import { Menu, MenuItem, MenuSeparator } from "@/editor/components/Menu";
import { MENU_ICON_SIZE } from "@/editor/components/topbar-constants";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { Button } from "@/editor/components/Button";
import {
  addPage,
  deletePage,
  duplicatePage,
  listPages,
  movePage,
  renamePage,
  selectPage,
  setHomePage,
  type PageItem,
} from "./pagesModel";
import { PageRow } from "./PageRow";
import { PageSettingsPopover } from "./PageSettingsPopover";
import { takeLayerPress, trackLayerPresses } from "./layerGuard";
import { useRowDrag, type RowDrag } from "./useRowDrag";

export interface PagesManagerProps {
  /** The layer search box's text: pages whose name or route match it are the only ones listed. */
  query?: string;
  className?: string;
}

const CHOOSE_CLOSE_MS = 240;

interface MenuState {
  id: string;
  x: number;
  y: number;
  row: HTMLElement | null;
}

interface SettingsState {
  id: string;
  row: HTMLElement | null;
}

/**
 * The left panel's front door: the current page's name with a caret. It opens a quiet list of the pages, where a page is
 * chosen, renamed, duplicated, made home, deleted, reordered by dragging, and has its settings opened.
 */
export const PagesManager: React.FC<PagesManagerProps> = ({ query = "", className = "" }) => {
  const pages = useProjectStore((s) => s.pages);
  const activePageId = useProjectStore((s) => s.activePageId);
  const all = useMemo(() => listPages(pages, activePageId), [pages, activePageId]);
  const q = query.trim().toLowerCase();
  const items = useMemo(
    () => (q ? all.filter((p) => p.name.toLowerCase().includes(q) || p.route.toLowerCase().includes(q)) : all),
    [all, q],
  );
  const current = all.find((p) => p.isCurrent) ?? all[0];

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => (open ? trackLayerPresses() : undefined), [open]);

  const close = useCallback(() => {
    if (takeLayerPress()) return;
    setOpen(false);
  }, []);

  const openList = () => {
    setRenamingId(null);
    setConfirmId(null);
    setMenu(null);
    setSettings(null);
    setOpen(true);
  };

  // The canvas follows the page: after an undo or a switch the active page's frame is the active frame.
  const activeRoot = pages[activePageId]?.rootElementId;
  const firstRoot = useRef(activeRoot);
  useEffect(() => {
    if (firstRoot.current === activeRoot) return;
    firstRoot.current = activeRoot;
    if (!activeRoot) return;
    useCanvasViewStore.getState().setActiveFrame(activeRoot);
    useSelectionStore.getState().select(activeRoot, "element");
  }, [activeRoot]);

  const drag = useRowDrag<string>({
    listRef,
    lineRef,
    rowEls,
    ids: items.map((p) => p.id),
    enabled: !q && renamingId === null && confirmId === null,
    onDrop: (id, index) => movePage(id, index),
  });

  const act = {
    choose: (p: PageItem) => {
      selectPage(p.id);
      // closes a moment later, so that a double click on the name can still start a rename
      clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(() => setOpen(false), CHOOSE_CLOSE_MS);
    },
    startRename: (p: PageItem) => {
      clearTimeout(closeTimer.current);
      setRenamingId(p.id);
    },
    add: () => {
      const id = addPage();
      setCreated(id);
      setRenamingId(id);
    },
    rename: (p: PageItem, name: string) => {
      setRenamingId(null);
      renamePage(p.id, name);
    },
    duplicate: (p: PageItem) => {
      const id = duplicatePage(p.id);
      if (id) setCreated(id);
    },
  };

  const menuPage = menu ? all.find((p) => p.id === menu.id) : undefined;
  const settingsPage = settings ? all.find((p) => p.id === settings.id) ?? null : null;
  const rowDrag: RowDrag = drag;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id="pagebtn"
        data-testid="pages-trigger"
        className={`pagebtn ll:appearance-none ll:border-0 ll:bg-transparent ll:cursor-pointer ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Pages"
        onClick={() => (open ? close() : openList())}
      >
        <span id="pagelabel">{current?.name ?? "Pages"}</span>
        <Icon icon={ChevronDown} size={14} />
        {q && items.length > 0 && <span className="ll:w-1 ll:h-1 ll:rounded-xs ll:bg-primary ll:ml-1" aria-label={`${items.length} matching pages`} />}
      </button>

      <Popover open={open} onClose={close} anchorRef={triggerRef} width={288} family="page-selector" aria-label="Pages">
        <div className="ll:-m-3 ll:flex ll:flex-col ll:font-sans" data-testid="pages-popover">
          <div className="ll:flex ll:items-center ll:gap-2 ll:h-9 ll:pl-3 ll:pr-1.5 ll:border-b ll:border-border ll:select-none">
            <span className="ll:text-small ll:font-medium ll:text-primary">Pages</span>
            <span className="ll:text-micro ll:text-muted ll:flex-1">{q ? `${items.length} of ${all.length}` : all.length}</span>
            <IconButton size="sm" variant="ghost" aria-label="Add page" tooltip="Add page" data-testid="pages-add" icon={<Icon icon={Plus} size={14} />} onClick={act.add} />
          </div>

          {all.length === 0 ? (
            <div className="ll:flex ll:flex-col ll:items-center ll:gap-3 ll:py-6 ll:px-3" data-testid="pages-empty">
              <span className="ll:text-small ll:text-muted">No pages yet</span>
              <Button size="sm" variant="strong" onClick={act.add}>
                Add page
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="ll:py-6 ll:px-3 ll:text-center ll:text-small ll:text-muted">No pages match</div>
          ) : (
            <div ref={listRef} role="listbox" aria-label="Pages" className="ll:relative ll:flex ll:flex-col ll:p-1 ll:max-h-80 ll:overflow-y-auto">
              {items.map((p) => (
                <PageRow
                  key={p.id}
                  page={p}
                  drag={rowDrag}
                  entering={created === p.id}
                  renaming={renamingId === p.id}
                  confirming={confirmId === p.id}
                  canDelete={all.length > 1}
                  setRef={(el) => {
                    if (el) rowEls.current.set(p.id, el);
                    else rowEls.current.delete(p.id);
                  }}
                  onChoose={() => act.choose(p)}
                  onStartRename={() => act.startRename(p)}
                  onCommitRename={(name) => act.rename(p, name)}
                  onCancelRename={() => setRenamingId(null)}
                  onMenu={(x, y) => setMenu({ id: p.id, x, y, row: rowEls.current.get(p.id) ?? null })}
                  onAskDelete={() => setConfirmId(p.id)}
                  onCancelDelete={() => setConfirmId(null)}
                  onConfirmDelete={() => {
                    setConfirmId(null);
                    deletePage(p.id);
                  }}
                />
              ))}
              <div ref={lineRef} aria-hidden="true" className="ll:absolute ll:left-2 ll:right-2 ll:h-px ll:bg-primary ll:pointer-events-none" style={{ display: "none" }} />
            </div>
          )}
        </div>
      </Popover>

      <Menu open={open && menu !== null && menuPage !== undefined} onClose={() => setMenu(null)} anchorEl={menu?.row ?? null} position={menu ? { x: menu.x, y: menu.y } : null} variant="context" aria-label="Page actions">
        {menuPage && (
          <>
            <MenuItem icon={<Icon icon={Pencil} size={MENU_ICON_SIZE} />} onClick={() => setRenamingId(menuPage.id)}>
              Rename
            </MenuItem>
            <MenuItem icon={<Icon icon={CopyPlus} size={MENU_ICON_SIZE} />} onClick={() => act.duplicate(menuPage)}>
              Duplicate
            </MenuItem>
            <MenuItem icon={<Icon icon={House} size={MENU_ICON_SIZE} />} disabled={menuPage.isHome} onClick={() => setHomePage(menuPage.id)}>
              Set as home
            </MenuItem>
            <MenuItem icon={<Icon icon={Settings2} size={MENU_ICON_SIZE} />} onClick={() => setSettings({ id: menuPage.id, row: menu?.row ?? null })}>
              Settings…
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Icon icon={Trash2} size={MENU_ICON_SIZE} />} disabled={all.length < 2} onClick={() => setConfirmId(menuPage.id)}>
              Delete
            </MenuItem>
          </>
        )}
      </Menu>

      <PageSettingsPopover page={open ? settingsPage : null} anchorEl={settings?.row ?? null} onClose={() => setSettings(null)} />
    </>
  );
};
