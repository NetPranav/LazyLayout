"use client";

import React, { useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { TextField } from "@/editor/components/TextField";
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

  useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus();
    }
  }, [searchOpen]);

  const isCode = mode === "code";
  const isDesign = mode === "design";
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
    <div className="ll:flex ll:flex-col ll:shrink-0 ll:border-b ll:border-border">
      {/* Top zone header: 44px height */}
      <div className="ll-zhead ll:h-header ll:flex ll:items-center ll:gap-1 ll:pl-4 ll:pr-2 ll:shrink-0">
        {isDesign ? (
          headerStart ? (
            <div className="ll:flex-1 ll:min-w-0">{headerStart}</div>
          ) : (
            <span className="ll-lh ll:text-title ll:font-medium ll:text-primary ll:truncate">
              Layers
            </span>
          )
        ) : (
          <span className="ll-lh ll:text-title ll:font-medium ll:text-primary ll:truncate">
            {isCode ? "Files" : "Layers"}
          </span>
        )}

        <span className="ll-sp ll:flex-1" />

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

      {/* Search box if toggled */}
      {searchOpen && (
        <div id="lfilter" className="ll-lsbox ll:flex ll:flex-col ll:p-3 ll:border-t ll:border-border ll:shrink-0">
          <div className="ll-lsfield ll:relative ll:w-full">
            <TextField
              ref={inputRef}
              id="lsearch"
              size="sm"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchLabel}
              aria-label={searchLabel}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="ll:w-full"
            />
            {searchQuery.length > 0 && (
              <IconButton
                id="lsclear"
                size="sm"
                variant="ghost"
                aria-label="Clear search"
                onClick={handleClear}
                icon={<Icon icon={X} size={12} />}
                className="ll-lsclear ll:absolute ll:right-1.5 ll:top-1/2 ll:-translate-y-1/2 ll:w-5 ll:h-5 ll:min-w-5 ll:min-h-5"
              />
            )}
          </div>

          {trimmedQuery.length > 0 && (
            <div id="lscount" className="ll-lscount ll:mt-2 ll:text-micro ll:text-muted">
              {countText}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
