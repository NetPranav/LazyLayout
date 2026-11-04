"use client";

import React, { useRef, useState, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";
import { surf, pressEl, type Surf } from "../motion/surface";
import { prefersReducedMotion } from "../motion/feel";
import { Icon } from "./Icon";
import { useMounted } from "./useMounted";
import {
  PAGE_DROPDOWN_WIDTH,
  VIEWPORT_EDGE_PAD,
  RADIUS_SM,
  POPUP_LEAVE_DURATION_MS,
  POPUP_LEAVE_REDUCED_DURATION_MS,
  MENU_ICON_SIZE,
} from "./topbar-constants";

export interface PageSwitcherProps {
  pages?: readonly string[];
  currentPage?: string;
  onSelectPage?: (page: string) => void;
  onNewPage?: () => void;
  onRenamePage?: (page: string, newName: string) => void;
  onDuplicatePage?: (page: string) => void;
  onDeletePage?: (page: string) => void;
  className?: string;
  disabled?: boolean;
  dataState?: "hover" | "focus";
}

/** The prototype shows the search field only for long lists. */
const SEARCH_THRESHOLD = 12;

type ActionKey = "new" | "rename" | "duplicate" | "delete";

const DEFAULT_PAGES: readonly string[] = [
  "Home",
  "Pricing",
  "About",
  "Blank",
  "Contact",
  "Blog",
  "Blog post",
  "Docs",
  "Changelog",
  "Careers",
  "Login",
  "Sign up",
  "Dashboard",
  "Settings",
  "Terms",
  "Privacy",
  "Not found",
];

export const PageSwitcher: React.FC<PageSwitcherProps> = ({
  pages = DEFAULT_PAGES,
  currentPage: propCurrentPage,
  onSelectPage,
  onNewPage,
  onRenamePage,
  onDuplicatePage,
  onDeletePage,
  className = "",
  disabled = false,
  dataState,
}) => {
  const mounted = useMounted();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const layRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const surfRef = useRef<Surf | null>(null);
  const menuId = useId();

  const [internalPage, setInternalPage] = useState("Home");
  const activePage = propCurrentPage !== undefined ? propCurrentPage : internalPage;

  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const renameDoneRef = useRef(false);
  const typeAheadRef = useRef("");
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const canDelete = pages.length > 1;

  // Filtered pages
  const filteredPages = searchQuery.trim()
    ? pages.filter((p) =>
        p.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : pages;

  const filteredPagesRef = useRef(filteredPages);
  const activeIndexRef = useRef(activeIndex);
  const hasSearch = pages.length > SEARCH_THRESHOLD;
  const hasSearchRef = useRef(hasSearch);

  // Rows are the filtered pages followed by the action rows.
  const actions: { key: ActionKey; label: string; disabled: boolean; title?: string }[] = [
    { key: "new", label: "+ New page", disabled: !onNewPage },
    { key: "rename", label: "Rename", disabled: !onRenamePage },
    { key: "duplicate", label: "Duplicate", disabled: !onDuplicatePage },
    {
      key: "delete",
      label: "Delete",
      disabled: !onDeletePage || !canDelete,
      title: canDelete ? undefined : "A project needs at least one page",
    },
  ];
  const actionsRef = useRef(actions);

  useEffect(() => {
    filteredPagesRef.current = filteredPages;
    activeIndexRef.current = activeIndex;
    hasSearchRef.current = hasSearch;
    actionsRef.current = actions;
  });

  useEffect(() => {
    if (!isOpen) return;
    rowRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const beginRename = () => {
    renameDoneRef.current = false;
    setDraftName(activePage);
    setRenaming(true);
  };

  const finishRename = (commit: boolean) => {
    if (renameDoneRef.current) return;
    renameDoneRef.current = true;
    const next = draftName.trim();
    setRenaming(false);
    if (commit && next && next !== activePage) onRenamePage?.(activePage, next);
  };

  const runAction = (key: ActionKey) => {
    if (key === "new") onNewPage?.();
    else if (key === "rename") beginRename();
    else if (key === "duplicate") onDuplicatePage?.(activePage);
    else onDeletePage?.(activePage);
  };
  const runActionRef = useRef(runAction);
  useEffect(() => {
    runActionRef.current = runAction;
  });

  // Initialize Surf instance
  useEffect(() => {
    if (!isRendered || !menuRef.current) return;
    const s = surf(menuRef.current);
    surfRef.current = s;

    return () => {
      s.reset();
    };
  }, [isRendered]);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setSearchQuery("");
    typeAheadRef.current = "";
    const cur = pages.indexOf(activePage);
    setActiveIndex(cur >= 0 ? cur : 0);
    setIsRendered(true);
    setIsOpen(true);
  }, [disabled, pages, activePage]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Handle open/close surf physics
  useEffect(() => {
    if (!isRendered) return;
    const s = surfRef.current;
    const menuEl = menuRef.current;
    const triggerEl = triggerRef.current;
    if (!s || !menuEl) return;

    if (isOpen) {
      if (!triggerEl) return;
      const r = triggerEl.getBoundingClientRect();
      const pad = VIEWPORT_EDGE_PAD;

      menuEl.style.minWidth = `${Math.max(Math.round(r.width), PAGE_DROPDOWN_WIDTH)}px`;
      const menuW = menuEl.offsetWidth;
      const left = Math.max(pad, Math.min(r.left, window.innerWidth - menuW - pad));

      // Keep the whole menu inside the viewport: shrink the list if needed.
      const listEl = menuEl.querySelector<HTMLElement>("[role=listbox]");
      if (listEl) {
        const overflow = menuEl.offsetHeight - (window.innerHeight - pad * 2);
        if (overflow > 0) {
          listEl.style.maxHeight = `${Math.max(0, listEl.clientHeight - overflow)}px`;
        }
        const curRow = listEl.querySelector<HTMLElement>("[aria-selected=true]");
        if (curRow) {
          listEl.scrollTop = curRow.offsetTop - (listEl.clientHeight - curRow.offsetHeight) / 2;
        }
      }

      // Like the prototype, the current page row sits over the trigger.
      const curRowEl = menuEl.querySelector<HTMLElement>("[aria-selected=true]");
      const rowOffset = curRowEl
        ? curRowEl.getBoundingClientRect().top - menuEl.getBoundingClientRect().top
        : 0;
      const rowH = curRowEl ? curRowEl.offsetHeight : r.height;
      const top = Math.max(
        pad,
        Math.min(
          r.top + (r.height - rowH) / 2 - rowOffset,
          window.innerHeight - menuEl.offsetHeight - pad
        )
      );

      menuEl.style.left = `${left}px`;
      menuEl.style.top = `${top}px`;

      s.open({
        from: {
          w: Math.round(r.width),
          h: Math.round(r.height),
          r: RADIUS_SM,
        },
        y0: r.top - top,
      });
    } else {
      s.leave();
      const duration = prefersReducedMotion()
        ? POPUP_LEAVE_REDUCED_DURATION_MS
        : POPUP_LEAVE_DURATION_MS;
      const t = setTimeout(() => {
        setIsRendered(false);
      }, duration);
      return () => clearTimeout(t);
    }
  }, [isOpen, isRendered]);

  const selectPage = useCallback(
    (page: string) => {
      if (onSelectPage) {
        onSelectPage(page);
      } else {
        setInternalPage(page);
      }
      closeDropdown();
      triggerRef.current?.focus();
    },
    [onSelectPage, closeDropdown]
  );

  // Outside click & Escape / ArrowUp / ArrowDown / Enter keyboard navigation (Item 14)
  useEffect(() => {
    if (!isOpen || !isRendered) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeDropdown();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeDropdown();
        triggerRef.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const total = filteredPagesRef.current.length + actionsRef.current.length;
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((prev) => Math.max(0, Math.min(total - 1, prev + step)));
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        const total = filteredPagesRef.current.length + actionsRef.current.length;
        setActiveIndex(e.key === "Home" ? 0 : total - 1);
      } else if (e.key === "Enter") {
        const currentList = filteredPagesRef.current;
        const idx = activeIndexRef.current;
        if (idx < 0) return;
        e.preventDefault();
        if (idx < currentList.length) {
          const targetPage = currentList[idx];
          if (targetPage) selectPage(targetPage);
          return;
        }
        const action = actionsRef.current[idx - currentList.length];
        if (action && !action.disabled) {
          closeDropdown();
          triggerRef.current?.focus();
          runActionRef.current(action.key);
        }
      } else if (
        !hasSearchRef.current &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        // Type-ahead on short lists (no search field).
        typeAheadRef.current += e.key.toLowerCase();
        const hit = filteredPagesRef.current.findIndex((p) =>
          p.toLowerCase().startsWith(typeAheadRef.current)
        );
        if (hit >= 0) setActiveIndex(hit);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isRendered, closeDropdown, selectPage]);

  const handlePointerDown = () => {
    if (!disabled && triggerRef.current) {
      pressEl(triggerRef.current, true);
    }
  };

  const handlePointerUp = () => {
    if (!disabled && triggerRef.current) {
      pressEl(triggerRef.current, false);
    }
  };

  return (
    <>
      {renaming ? (
        <input
          ref={(el) => {
            if (el && !renameDoneRef.current && document.activeElement !== el) {
              el.focus();
              el.select();
            }
          }}
          type="text"
          value={draftName}
          aria-label="Rename page"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              finishRename(true);
            } else if (e.key === "Escape") {
              e.preventDefault();
              finishRename(false);
            }
          }}
          onBlur={() => finishRename(true)}
          className={`ll:w-full ll:min-w-0 ll:h-6 ll:px-1.5 ll:bg-surface-raised ll:border ll:border-primary ll:rounded-sm ll:text-body ll:font-medium ll:text-primary ll:font-sans ll:outline-none ${className}`}
        />
      ) : (
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        data-state={dataState}
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={`Current page: ${activePage}. Switch page`}
        title="Switch page"
        className={`ll-pagebtn ll:flex ll:items-center ll:gap-1 ll:h-8 ll:p-0 ll:rounded-sm ll:bg-transparent ll:border-0 ll:text-primary ll:hover:text-primary ll:select-none ll:cursor-pointer ll:outline-none ${
          dataState === "hover" ? "ll:bg-surface-hover " : ""
        }${dataState === "focus" ? "ll:ring-2 ll:ring-primary " : ""}${
          disabled ? "ll:opacity-40 ll:cursor-not-allowed" : ""
        } ${className}`}
      >
        <span className="ll:font-sans ll:text-body ll:font-medium ll:truncate">
          {activePage}
        </span>

        <Icon
          icon={ChevronDown}
          size={MENU_ICON_SIZE}
          className="ll-chevron-flip ll:shrink-0"
        />
      </button>
      )}

      {mounted &&
        isRendered &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Pages"
            tabIndex={-1}
            className="ll-menu ll-dd ll:fixed ll:z-50 ll:min-w-menu ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:overflow-hidden ll:outline-none ll:font-sans"
          >
            <div ref={layRef} className="ll-lay ll:flex ll:flex-col ll:gap-0">
              {/* Search box (prototype: only when more than 12 pages) */}
              {hasSearch && (
              <div className="ll-dd-s ll:flex ll:items-center ll:gap-2 ll:h-9 ll:px-3 ll:border-b ll:border-border ll:text-muted">
                <Icon icon={Search} size={MENU_ICON_SIZE} className="ll:shrink-0" />
                <input
                  ref={(el) => {
                    searchInputRef.current = el;
                    if (el) el.focus();
                  }}
                  autoFocus
                  type="text"
                  role="searchbox"
                  placeholder="Search pages"
                  value={searchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setSearchQuery(q);
                    const trimmed = q.trim().toLowerCase();
                    const hits = trimmed
                      ? pages.filter((p) => p.toLowerCase().includes(trimmed)).length
                      : pages.length;
                    setActiveIndex(hits > 0 ? 0 : -1);
                  }}
                  className="ll:flex-1 ll:min-w-0 ll:bg-transparent ll:border-0 ll:outline-none ll:text-small ll:text-primary ll:placeholder:text-muted"
                />
              </div>
              )}

              {/* Pages list */}
              <div
                role="listbox"
                aria-label="Pages list"
                className="ll-ddl ll:max-h-75 ll:overflow-y-auto ll:overscroll-contain"
              >
                {filteredPages.length > 0 ? (
                  filteredPages.map((page, index) => {
                    const isSelected = page === activePage;
                    const isFocused = index === activeIndex;
                    return (
                      <button
                        key={page}
                        ref={(el) => {
                          rowRefs.current[index] = el;
                        }}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => selectPage(page)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`ll-dd-o ll:relative ll:flex ll:items-center ll:w-full ll:h-7 ll:pl-8 ll:pr-3 ll:text-left ll:border-0 ll:cursor-pointer ll:text-small ll:outline-none ${
                          isSelected ? "ll:text-primary" : "ll:text-secondary"
                        } ${
                          isFocused ? "ll:bg-surface-hover ll:text-primary" : "ll:bg-transparent"
                        }`}
                      >
                        {isSelected && (
                          <Icon
                            icon={Check}
                            size={MENU_ICON_SIZE}
                            className="ll:absolute ll:left-3 ll:text-primary ll:shrink-0"
                          />
                        )}
                        <span className="ll:truncate">{page}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="ll-dd-none ll:flex ll:items-center ll:justify-center ll:h-14 ll:text-small ll:text-muted">
                    No results
                  </div>
                )}
              </div>

              {/* Hairline divider */}
              <div className="ll-dd-sep ll:h-px ll:bg-border ll:my-1" />

              {/* Page action items */}
              <div className="ll:flex ll:flex-col">
                {actions.map((action, j) => {
                  const index = filteredPages.length + j;
                  const isFocused = index === activeIndex;
                  return (
                    <button
                      key={action.key}
                      ref={(el) => {
                        rowRefs.current[index] = el;
                      }}
                      type="button"
                      role="menuitem"
                      disabled={action.disabled}
                      title={action.title}
                      onMouseEnter={() => !action.disabled && setActiveIndex(index)}
                      onClick={() => {
                        closeDropdown();
                        triggerRef.current?.focus();
                        runAction(action.key);
                      }}
                      className={`ll:flex ll:items-center ll:w-full ll:h-7 ll:px-3 ll:text-small ll:text-left ll:whitespace-nowrap ll:border-0 ll:outline-none ll:cursor-pointer ll:disabled:opacity-40 ll:disabled:cursor-not-allowed ${
                        isFocused && !action.disabled
                          ? "ll:bg-surface-hover ll:text-primary"
                          : "ll:bg-transparent ll:text-secondary"
                      }`}
                    >
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
