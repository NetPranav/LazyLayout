"use client";

import React, { useState, useRef, useEffect, useId, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, Plus } from "./pageSelectorIcons";
import { Icon } from "@/editor/components/Icon";
import { useMounted } from "@/editor/components/useMounted";
import { getMotion, prefersReducedMotion } from "@/editor/motion/feel";
import { springEase } from "@/editor/motion/ease";
import {
  PAGE_POPOVER_WIDTH_PX,
  PAGE_FLYOUT_WIDTH_PX,
  ROW_HEIGHT_PX,
} from "./constants";
import type { UsePagesDataReturn } from "@/editor/panels/layers/types";

export interface PageSelectorProps extends Partial<UsePagesDataReturn> {
  className?: string;
  disabled?: boolean;
}

function slugify(name: string): string {
  if (name.toLowerCase() === "home") return "/";
  if (name.toLowerCase() === "not found") return "/404";
  return `/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export const PageSelector: React.FC<PageSelectorProps> = ({
  pages = ["Home"],
  currentPage = "Home",
  onSelectPage,
  onNewPage,
  onRenamePage,
  onDuplicatePage,
  onDeletePage,
  rawPages,
  className = "",
  disabled = false,
}) => {
  const mounted = useMounted();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [flyoutState, setFlyoutState] = useState<{
    pageName: string;
    index: number;
    top: number;
    left: number;
  } | null>(null);

  const [editingPageName, setEditingPageName] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const isNewPageRef = useRef(false);

  // Compute pages list with slugs
  const pageItems = useMemo(() => {
    return pages.map((name) => {
      const raw = rawPages
        ? Object.values(rawPages).find((p) => p.name === name || p.id === name)
        : null;
      return {
        name,
        slug: raw?.slug || slugify(name),
      };
    });
  }, [pages, rawPages]);

  // Filtered pages based on search
  const visiblePages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pageItems;
    return pageItems.filter(
      (item) => item.name.toLowerCase().includes(q) || item.slug.toLowerCase().includes(q)
    );
  }, [pageItems, searchQuery]);

  // Global LLPages registration for prototype parity
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { LLPages?: { set: (n: string) => void; rename?: () => void } }).LLPages = {
        set: (n: string) => onSelectPage?.(n),
        rename: () => {
          setEditingPageName(currentPage);
          setEditDraft(currentPage);
        },
      };
    }
  }, [currentPage, onSelectPage]);

  // Position calculation for popover
  const [popStyle, setPopStyle] = useState<{ top: number; left: number; maxHeight: number }>({
    top: 0,
    left: 0,
    maxHeight: 320,
  });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const b = triggerRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(b.left, window.innerWidth - PAGE_POPOVER_WIDTH_PX - 8));
    const top = b.bottom + 4;
    const maxHeight = Math.max(120, Math.min(320, window.innerHeight - top - 80));
    setPopStyle({ top, left, maxHeight });
  }, []);

  // Open / close animations
  const openPopover = useCallback(() => {
    updatePosition();
    setSearchQuery("");
    setFlyoutState(null);
    setEditingPageName(null);

    const curIdx = pageItems.findIndex((p) => p.name === currentPage);
    setActiveIndex(curIdx >= 0 ? curIdx : 0);
    setIsOpen(true);
  }, [currentPage, pageItems, updatePosition]);

  const closePopover = useCallback(() => {
    setIsOpen(false);
    setFlyoutState(null);
    setEditingPageName(null);
  }, []);

  // WAAPI animation on open
  useEffect(() => {
    if (!isOpen || !popRef.current) return;
    const el = popRef.current;
    const motion = getMotion();
    const reduced = prefersReducedMotion();

    if (reduced) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 120,
        easing: "ease-out",
        fill: "backwards",
      });
    } else {
      const preset = motion.current();
      const s = springEase(preset.shape[0], preset.shape[1]);
      el.animate(
        [
          { transform: "scaleY(0.12)", clipPath: "inset(0 0 88% 0 round 6px)", opacity: 0 },
          { transform: "none", clipPath: "inset(0 0 0% 0 round 6px)", opacity: 1 },
        ],
        { duration: s.duration, easing: s.easing, fill: "backwards" }
      );

      // Stagger rows
      const rowEls = el.querySelectorAll<HTMLElement>(".llp-r");
      rowEls.forEach((r, idx) => {
        if (idx < 12) {
          const rEase = springEase(preset.rows[0], preset.rows[1]);
          r.animate(
            [
              { opacity: 0, transform: "translateY(6px)" },
              { opacity: 1, transform: "none" },
            ],
            {
              duration: rEase.duration,
              easing: rEase.easing,
              delay: 90 + idx * preset.stagger,
              fill: "backwards",
            }
          );
        }
      });
    }

    searchInputRef.current?.focus({ preventScroll: true });
  }, [isOpen]);

  // WAAPI animation on flyout open (respects reduced motion)
  useEffect(() => {
    if (!flyoutState || !flyoutRef.current) return;
    const el = flyoutRef.current;
    if (prefersReducedMotion()) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 120,
        easing: "ease-out",
        fill: "backwards",
      });
    } else {
      const preset = getMotion().current();
      const s = springEase(preset.pop[0], preset.pop[1]);
      el.animate(
        [
          { opacity: 0, transform: "scale(0.92)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: s.duration, easing: s.easing, fill: "backwards" }
      );
    }
  }, [flyoutState]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        popRef.current?.contains(target) ||
        triggerRef.current?.contains(target) ||
        flyoutRef.current?.contains(target)
      ) {
        return;
      }
      closePopover();
    };

    const handleResize = () => {
      closePopover();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, closePopover]);

  // Handle active row scrolling into view
  useEffect(() => {
    if (!isOpen || activeIndex < 0 || !listRef.current) return;
    const rowEls = listRef.current.querySelectorAll<HTMLElement>(".llp-r");
    const activeEl = rowEls[activeIndex];
    if (activeEl) {
      const top = activeEl.offsetTop;
      const bot = top + activeEl.offsetHeight;
      const st = listRef.current.scrollTop;
      const ch = listRef.current.clientHeight;
      if (top < st) {
        listRef.current.scrollTop = top - 4;
      } else if (bot > st + ch) {
        listRef.current.scrollTop = bot - ch + 4;
      }
    }
  }, [activeIndex, isOpen]);

  // Keyboard navigation inside popover
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingPageName !== null) return;

    const count = visiblePages.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (count > 0) {
        setActiveIndex((prev) => (prev + 1) % count);
        setFlyoutState(null);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (count > 0) {
        setActiveIndex((prev) => (prev - 1 + count) % count);
        setFlyoutState(null);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visiblePages[activeIndex]) {
        onSelectPage?.(visiblePages[activeIndex].name);
        closePopover();
      }
    } else if (e.key === "ArrowRight") {
      if (visiblePages[activeIndex] && listRef.current) {
        e.preventDefault();
        const rowEls = listRef.current.querySelectorAll<HTMLElement>(".llp-r");
        const rowEl = rowEls[activeIndex];
        if (rowEl) {
          openFlyout(visiblePages[activeIndex].name, activeIndex, rowEl);
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (flyoutState) {
        e.preventDefault();
        setFlyoutState(null);
        searchInputRef.current?.focus();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (flyoutState) {
        setFlyoutState(null);
        searchInputRef.current?.focus();
      } else {
        closePopover();
        triggerRef.current?.focus();
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const newBtn = popRef.current?.querySelector<HTMLButtonElement>(".llp-new");
      if (document.activeElement === newBtn) {
        searchInputRef.current?.focus();
      } else {
        newBtn?.focus();
      }
    }
  };

  const openFlyout = (pageName: string, index: number, rowEl: HTMLElement) => {
    const popRect = popRef.current?.getBoundingClientRect();
    const rowRect = rowEl.getBoundingClientRect();
    if (!popRect) return;

    const flip = popRect.right + 4 + PAGE_FLYOUT_WIDTH_PX > window.innerWidth - 8;
    const left = flip ? popRect.left - 4 - PAGE_FLYOUT_WIDTH_PX : popRect.right + 4;
    const top = Math.min(rowRect.top, window.innerHeight - 8 - 120);

    setFlyoutState({ pageName, index, top, left });
  };

  const handleCommitRename = (originalName: string) => {
    const trimmed = editDraft.trim();
    setEditingPageName(null);
    if (trimmed && trimmed !== originalName) {
      onRenamePage?.(originalName, trimmed);
    } else if (isNewPageRef.current && !trimmed) {
      onDeletePage?.(originalName);
    }
    isNewPageRef.current = false;
  };

  const handleStartRename = (name: string) => {
    setFlyoutState(null);
    setEditingPageName(name);
    setEditDraft(name);
  };

  const handleDuplicate = (name: string) => {
    setFlyoutState(null);
    onDuplicatePage?.(name);
  };

  const handleDelete = (name: string) => {
    setFlyoutState(null);
    if (pages.length <= 1) return;
    onDeletePage?.(name);
  };

  const handleNewPage = () => {
    isNewPageRef.current = true;
    onNewPage?.();
    closePopover();
  };

  // Sliding highlight position
  const highlightOffset = activeIndex >= 0 ? activeIndex * ROW_HEIGHT_PX : 0;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id="pagebtn"
        className={`pagebtn ll:appearance-none ll:border-0 ll:bg-transparent ll:cursor-pointer ${className}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Switch page"
        disabled={disabled}
        onClick={() => {
          if (isOpen) closePopover();
          else openPopover();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!isOpen) openPopover();
          }
        }}
      >
        <span id="pagelabel">{currentPage}</span>
        <Icon icon={ChevronDown} size={14} />
      </button>

      {isOpen &&
        mounted &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label="Pages"
            className="llp-pop"
            style={{
              top: `${popStyle.top}px`,
              left: `${popStyle.left}px`,
            }}
            onKeyDown={handleKeyDown}
          >
            {/* Search header */}
            <div className="llp-s">
              <Icon icon={Search} size={16} />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveIndex(0);
                  setFlyoutState(null);
                }}
                placeholder="Search pages"
                aria-label="Search pages"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Pages listbox */}
            <div
              ref={listRef}
              role="listbox"
              aria-label="Pages"
              className="llp-l"
              style={{ maxHeight: `${popStyle.maxHeight}px` }}
            >
              {/* Sliding highlight band */}
              {visiblePages.length > 0 && activeIndex >= 0 && (
                <i
                  className="ll-hl show"
                  style={{
                    transform: `translateY(${highlightOffset}px)`,
                  }}
                />
              )}

              {visiblePages.length > 0 ? (
                visiblePages.map((page, idx) => {
                  const isCurrent = page.name === currentPage;
                  const isActive = idx === activeIndex;
                  const isRenaming = editingPageName === page.name;

                  return (
                    <div
                      key={page.name}
                      role="option"
                      data-k={idx}
                      aria-selected={isCurrent}
                      title={page.slug}
                      className={`llp-r ${isActive ? "on" : ""}`}
                      onMouseEnter={() => {
                        if (!editingPageName) setActiveIndex(idx);
                      }}
                      onClick={() => {
                        if (isRenaming) return;
                        onSelectPage?.(page.name);
                        closePopover();
                      }}
                    >
                      <Icon icon={Check} size={16} className="llp-ck" />

                      <span className="llp-n">
                        {isRenaming ? (
                          <input
                            type="text"
                            autoFocus
                            aria-label="Page name"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") handleCommitRename(page.name);
                              if (e.key === "Escape") setEditingPageName(null);
                            }}
                            onBlur={() => handleCommitRename(page.name)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          page.name
                        )}
                      </span>

                      {!isRenaming && (
                        <button
                          type="button"
                          className="llp-dots ll:appearance-none ll:border-0 ll:bg-transparent ll:cursor-pointer"
                          tabIndex={-1}
                          aria-label={`Actions for ${page.name}`}
                          aria-haspopup="menu"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFlyout(page.name, idx, e.currentTarget.closest(".llp-r") as HTMLElement);
                          }}
                        >
                          ...
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="llp-e">No pages match</div>
              )}
            </div>

            {/* Footer with New page button */}
            <div className="llp-f">
              <button
                type="button"
                className="llp-new ll:appearance-none ll:border-0 ll:cursor-pointer"
                onClick={handleNewPage}
              >
                <Icon icon={Plus} size={16} />
                New page
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Flyout actions popup */}
      {isOpen &&
        flyoutState &&
        mounted &&
        createPortal(
          <div
            ref={flyoutRef}
            role="menu"
            aria-label={`${flyoutState.pageName} actions`}
            className="llp-fly"
            style={{
              top: `${flyoutState.top}px`,
              left: `${flyoutState.left}px`,
            }}
          >
            <button
              type="button"
              role="menuitem"
              className="ll:appearance-none ll:border-0 ll:bg-transparent ll:cursor-pointer"
              onClick={() => handleStartRename(flyoutState.pageName)}
            >
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              className="ll:appearance-none ll:border-0 ll:bg-transparent ll:cursor-pointer"
              onClick={() => handleDuplicate(flyoutState.pageName)}
            >
              Duplicate
            </button>
            <button
              type="button"
              role="menuitem"
              className="ll:appearance-none ll:border-0 ll:bg-transparent ll:cursor-pointer"
              disabled={pages.length < 2}
              onClick={() => handleDelete(flyoutState.pageName)}
            >
              Delete
            </button>
          </div>,
          document.body
        )}
    </>
  );
};
