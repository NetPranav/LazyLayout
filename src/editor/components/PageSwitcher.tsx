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
  TRIGGER_GAP_Y,
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
  onRenamePage?: (page: string) => void;
  onDuplicatePage?: (page: string) => void;
  onDeletePage?: (page: string) => void;
  className?: string;
  disabled?: boolean;
  dataState?: "hover" | "focus";
}

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

  // Filtered pages
  const filteredPages = searchQuery.trim()
    ? pages.filter((p) =>
        p.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : pages;

  const filteredPagesRef = useRef(filteredPages);
  const activeIndexRef = useRef(activeIndex);

  useEffect(() => {
    filteredPagesRef.current = filteredPages;
    activeIndexRef.current = activeIndex;
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
    setActiveIndex(0);
    setIsRendered(true);
    setIsOpen(true);
  }, [disabled]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Handle open/close surf physics
  useEffect(() => {
    if (!isRendered) return;
    const s = surfRef.current;
    const menuEl = menuRef.current;
    const triggerEl = triggerRef.current;
    if (!s || !menuEl || !triggerEl) return;

    if (isOpen) {
      const r = triggerEl.getBoundingClientRect();
      const menuW = PAGE_DROPDOWN_WIDTH;
      const pad = VIEWPORT_EDGE_PAD;

      const left = Math.max(pad, Math.min(r.left, window.innerWidth - menuW - pad));
      const top = r.bottom + TRIGGER_GAP_Y;

      menuEl.style.left = `${left}px`;
      menuEl.style.top = `${top}px`;

      s.open({
        from: {
          w: Math.round(r.width),
          h: Math.round(r.height),
          r: RADIUS_SM,
        },
        y0: -(r.height + TRIGGER_GAP_Y),
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
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const currentList = filteredPagesRef.current;
        if (currentList.length > 0) {
          setActiveIndex((prev) => Math.min(currentList.length - 1, prev + 1));
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const currentList = filteredPagesRef.current;
        if (currentList.length > 0) {
          setActiveIndex((prev) => Math.max(0, prev - 1));
        }
      } else if (e.key === "Enter") {
        const currentList = filteredPagesRef.current;
        const idx = activeIndexRef.current;
        if (currentList.length > 0 && idx >= 0 && idx < currentList.length) {
          e.preventDefault();
          const targetPage = currentList[idx];
          if (targetPage) {
            selectPage(targetPage);
          }
        }
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
              {pages.length > 12 && (
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
                    setSearchQuery(e.target.value);
                    setActiveIndex(0);
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
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onNewPage?.();
                    closeDropdown();
                  }}
                  className="ll:flex ll:items-center ll:w-full ll:h-7 ll:px-3 ll:text-small ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover ll:text-left ll:cursor-pointer ll:border-0 ll:bg-transparent ll:outline-none"
                >
                  + New page
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onRenamePage?.(activePage);
                    closeDropdown();
                  }}
                  className="ll:flex ll:items-center ll:w-full ll:h-7 ll:px-3 ll:text-small ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover ll:text-left ll:cursor-pointer ll:border-0 ll:bg-transparent ll:outline-none"
                >
                  Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onDuplicatePage?.(activePage);
                    closeDropdown();
                  }}
                  className="ll:flex ll:items-center ll:w-full ll:h-7 ll:px-3 ll:text-small ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover ll:text-left ll:cursor-pointer ll:border-0 ll:bg-transparent ll:outline-none"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onDeletePage?.(activePage);
                    closeDropdown();
                  }}
                  className="ll:flex ll:items-center ll:w-full ll:h-7 ll:px-3 ll:text-small ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover ll:text-left ll:cursor-pointer ll:border-0 ll:bg-transparent ll:outline-none"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
