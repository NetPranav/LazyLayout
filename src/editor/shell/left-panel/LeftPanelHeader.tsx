"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { getMotion, prefersReducedMotion } from "@/editor/motion/feel";
import { springEase } from "@/editor/motion/ease";
import { SEARCH_BOX_HEIGHT_PX } from "./constants";
import type { LeftPanelMode } from "./types";

export interface LeftPanelHeaderProps {
  mode: LeftPanelMode;
  headerStart?: React.ReactNode;
  searchOpen: boolean;
  onToggleSearch: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  matchCount: number;
}

export const LeftPanelHeader: React.FC<LeftPanelHeaderProps> = ({
  mode,
  headerStart,
  searchOpen,
  onToggleSearch,
  searchQuery,
  onSearchChange,
  matchCount,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus();
    }
  }, [searchOpen]);

  // WAAPI spring morph animation matching prototype openSearch(o)
  useEffect(() => {
    if (!searchOpen || !boxRef.current || !fieldRef.current || !searchBtnRef.current) return;
    const box = boxRef.current;
    const field = fieldRef.current;
    const btn = searchBtnRef.current;
    const input = inputRef.current;

    if (prefersReducedMotion()) {
      box.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 120,
        easing: "ease-out",
        fill: "backwards",
      });
      return;
    }

    const b = btn.getBoundingClientRect();
    const f = field.getBoundingClientRect();
    const full = f.width;
    const p = getMotion().current();
    const s = springEase(p.shape[0], p.shape[1]);

    if (input) input.style.caretColor = "transparent";

    const anim = field.animate(
      [
        {
          width: `${b.width}px`,
          marginLeft: `${full - b.width}px`,
          height: `${b.height}px`,
          transform: `translateY(${b.top - f.top}px)`,
        },
        {
          width: `${full}px`,
          marginLeft: "0px",
          height: `${f.height || SEARCH_BOX_HEIGHT_PX}px`,
          transform: "none",
        },
      ],
      {
        duration: s.duration,
        easing: s.easing,
        fill: "backwards",
      }
    );

    // Fade inside elements with stagger
    const innerIcons = field.querySelectorAll("svg, input, button");
    innerIcons.forEach((c) => {
      c.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 160,
        easing: "ease-out",
        delay: s.duration * 0.45,
        fill: "backwards",
      });
    });

    anim.onfinish = () => {
      if (input) input.style.caretColor = "";
    };
  }, [searchOpen]);

  const isCode = mode === "code";
  const searchLabel = isCode ? "Search files" : "Search layers";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onSearchChange("");
      onToggleSearch();
    }
  };

  const handleClear = () => {
    onSearchChange("");
    inputRef.current?.focus();
  };

  const trimmedQuery = searchQuery.trim();
  const countText = `${matchCount} ${isCode ? "file" : "layer"}${matchCount === 1 ? "" : "s"}`;

  return (
    <div className="ll:flex ll:flex-col ll:shrink-0">
      {/* Top zone header: 44px height (zhead) */}
      <div className="zhead ll-zhead ll:h-header ll:flex ll:items-center ll:gap-1 ll:pl-4 ll:pr-2 ll:border-b ll:border-border ll:shrink-0">
        {mode === "design" && headerStart ? (
          <div className="ll:flex-none">{headerStart}</div>
        ) : (
          <span id="lhead" className="lh ll-lh ll:text-body ll:font-medium ll:text-primary ll:truncate">
            {isCode ? "Files" : "Layers"}
          </span>
        )}

        <span className="sp ll-sp ll:flex-1" />

        <div ref={searchBtnRef as unknown as React.RefObject<HTMLDivElement>} className="ll:flex-none">
          <IconButton
            id="lsearchbtn"
            size="md"
            variant="ghost"
            pressed={searchOpen}
            aria-label={searchLabel}
            title={searchLabel}
            icon={<Icon icon={Search} size={14} />}
            onClick={onToggleSearch}
          />
        </div>
      </div>

      {/* Search box if toggled (lsbox) */}
      {searchOpen && (
        <div
          ref={boxRef}
          id="lfilter"
          className="lsbox ll-lsbox ll:flex ll:flex-col ll:p-3 ll:border-b ll:border-border ll:shrink-0"
        >
          <div
            ref={fieldRef}
            className="lsfield ll-lsfield ll:flex ll:items-center ll:gap-2 ll:h-8 ll:px-2 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-sm ll:text-muted ll:focus-within:border-primary"
          >
            <Icon icon={Search} size={14} className="ll:text-muted ll:shrink-0" />
            <input
              ref={inputRef}
              id="lsearch"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchLabel}
              aria-label={searchLabel}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="ll:flex-1 ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:text-body ll:font-normal ll:text-primary ll:placeholder:text-muted"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                id="lsclear"
                aria-label="Clear search"
                onClick={handleClear}
                className="lsclear ll-lsclear ll:w-5 ll:h-5 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-surface-panel ll:hover:text-primary ll:outline-none"
              >
                <Icon icon={X} size={12} />
              </button>
            )}
          </div>

          {trimmedQuery.length > 0 && (
            <div id="lscount" className="lscount ll-lscount ll:mt-2 ll:text-micro ll:text-muted">
              {countText}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
