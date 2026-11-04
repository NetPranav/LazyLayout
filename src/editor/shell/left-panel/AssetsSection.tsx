"use client";

import React, { useState, useRef, useEffect, useCallback, useSyncExternalStore } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { TextField } from "@/editor/components/TextField";
import type { AssetItem } from "./types";
import { AssetTile } from "./AssetTile";
import {
  ASSETS_MIN_HEIGHT,
  ASSETS_MAX_HEIGHT_MIN_BOUND,
  ASSETS_MAX_HEIGHT_RATIO,
  ASSETS_KEYBOARD_STEP,
  ASSETS_FALLBACK_PARENT_HEIGHT,
} from "./constants";

export interface AssetsSectionProps {
  assets: AssetItem[];
  isOpen: boolean;
  onToggleOpen: () => void;
  height: number;
  onHeightChange: (h: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onUploadAsset?: () => void;
  onSelectAsset?: (asset: AssetItem) => void;
}

function useContainerHeight(
  containerRef?: React.RefObject<HTMLDivElement | null>,
  fallback = ASSETS_FALLBACK_PARENT_HEIGHT
): number {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const el = containerRef?.current;
      if (!el || typeof ResizeObserver === "undefined") {
        return () => {};
      }
      const observer = new ResizeObserver(() => {
        onStoreChange();
      });
      observer.observe(el);
      return () => {
        observer.disconnect();
      };
    },
    [containerRef]
  );

  const getSnapshot = useCallback(() => {
    return containerRef?.current?.clientHeight ?? fallback;
  }, [containerRef, fallback]);

  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const AssetsSection: React.FC<AssetsSectionProps> = ({
  assets,
  isOpen,
  onToggleOpen,
  height,
  onHeightChange,
  containerRef,
  onUploadAsset,
  onSelectAsset,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHRef = useRef(height);

  useEffect(() => {
    if (searchOpen && isOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen, isOpen]);

  const handleToggleSearch = () => {
    if (!isOpen) {
      onToggleOpen();
    }
    const next = !searchOpen;
    setSearchOpen(next);
    if (!next) {
      setSearchQuery("");
    }
  };

  // Compute real maximum height based on parent container via useSyncExternalStore + ResizeObserver
  const parentH = useContainerHeight(containerRef);
  const computedMaxHeight = Math.max(
    ASSETS_MAX_HEIGHT_MIN_BOUND,
    Math.round(parentH * ASSETS_MAX_HEIGHT_RATIO)
  );

  // Drag separator resizing with declarative pointer capture
  const handleSeparatorPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartHRef.current = height;
  };

  const handleSeparatorPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const deltaY = e.clientY - dragStartYRef.current;
    const newH = Math.max(
      ASSETS_MIN_HEIGHT,
      Math.min(computedMaxHeight, dragStartHRef.current - deltaY)
    );
    onHeightChange(newH);
  };

  const handleSeparatorPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if capture was already released
    }
  };

  const handleSeparatorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onHeightChange(Math.min(computedMaxHeight, height + ASSETS_KEYBOARD_STEP));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onHeightChange(Math.max(ASSETS_MIN_HEIGHT, height - ASSETS_KEYBOARD_STEP));
    }
  };

  const filteredAssets = assets.filter((asset) => {
    if (!searchQuery.trim()) return true;
    return asset.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  return (
    <>
      {/* Draggable Split Separator (only when open) */}
      {isOpen && (
        <div
          id="lsplit"
          role="separator"
          tabIndex={0}
          aria-orientation="horizontal"
          aria-label="Resize assets"
          aria-valuenow={height}
          aria-valuemin={ASSETS_MIN_HEIGHT}
          aria-valuemax={computedMaxHeight}
          onPointerDown={handleSeparatorPointerDown}
          onPointerMove={handleSeparatorPointerMove}
          onPointerUp={handleSeparatorPointerUp}
          onPointerCancel={handleSeparatorPointerUp}
          onKeyDown={handleSeparatorKeyDown}
          className="lsplit ll-lsplit ll:h-2 ll:shrink-0 ll:relative ll:cursor-row-resize ll:touch-none ll:select-none ll:group ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
        >
          <div className="ll:absolute ll:left-0 ll:right-0 ll:top-1 ll:h-px ll:bg-transparent ll:group-hover:bg-muted ll:group-focus-visible:bg-primary" />
        </div>
      )}

      {/* Assets Section */}
      <div
        id="p-assets"
        style={{
          height: isOpen ? `${height}px` : "36px",
        }}
        className="lassets ll-lassets ll:relative ll:flex ll:flex-col ll:border-t ll:border-border ll:shrink-0 ll:min-h-0 ll:overflow-hidden ll:bg-surface-panel"
      >
        {/* Header row: 36px height (arow) */}
        <button
          type="button"
          id="abtn"
          aria-expanded={isOpen}
          onClick={onToggleOpen}
          className="arow ll-arow ll:flex ll:items-center ll:gap-2 ll:w-full ll:h-9 ll:px-4 ll:font-medium ll:text-secondary ll:hover:text-primary ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
        >
          <span className="ll:text-small ll:font-medium">Assets</span>
          <Icon
            icon={ChevronRight}
            size={14}
            className={`ll:text-muted ll:transition-transform ll:duration-swap ll:motion-reduce:transition-none ${
              isOpen ? "ll:rotate-90" : ""
            }`}
          />
        </button>

        {/* Action buttons pinned to top right (prototype: .atools { position: absolute; top: 4px; right: 12px; }) */}
        <span className="atools ll-atools ll:absolute ll:top-1 ll:right-3 ll:flex ll:items-center ll:gap-0.5">
          <IconButton
            id="aup"
            size="md"
            variant="ghost"
            aria-label="Upload asset"
            title="Upload asset"
            icon={<Icon icon={Plus} size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              onUploadAsset?.();
            }}
          />
          <IconButton
            id="asrch"
            size="md"
            variant="ghost"
            pressed={searchOpen}
            aria-label="Search assets"
            title="Search assets"
            icon={<Icon icon={Search} size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSearch();
            }}
          />
        </span>

        {/* Assets Body */}
        {isOpen && (
          <div id="abody" className="abody ll-abody ll:flex-1 ll:min-h-0 ll:overflow-y-auto">
            {searchOpen && (
              <div className="ll:px-4 ll:pt-2">
                <TextField
                  ref={searchInputRef}
                  id="asin"
                  size="sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search assets"
                  aria-label="Search assets"
                  className="asin ll-asin ll:w-full"
                />
              </div>
            )}

            <div className="assetgrid ll-assetgrid ll:grid ll:grid-cols-2 ll:gap-3 ll:p-4 ll:pt-1">
              {filteredAssets.map((asset) => (
                <AssetTile
                  key={asset.id}
                  asset={asset}
                  onClick={onSelectAsset}
                />
              ))}

              {filteredAssets.length === 0 && (
                <div className="ll:col-span-2 ll:py-4 ll:text-center ll:text-micro ll:text-muted">
                  No assets found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
