"use client";

import React, { useRef, useEffect, useState, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, LinkIcon } from "./ColorPickerIcons";
import { Icon } from "./Icon";
import { useMounted } from "./useMounted";
import { getActivePreset, prefersReducedMotion } from "../motion/feel";
import { springEase } from "../motion/ease";
import {
  MORPH_EXPANDED_CLIP,
  buildTriggerMorphClip,
  POP_ENTER_TRANSFORM,
  POP_SETTLE_TRANSFORM,
  POP_CLOSE_TRANSFORM,
  REDUCED_DURATION,
  CLOSE_DURATION,
} from "./ColorPickerMotion";
import {
  FRAME_PRESET_GROUPS,
  computeProportionalGlyph,
  applyOrientation,
  type FramePresetItem,
} from "./FramePresetsData";

export interface FramePresetsPanelProps {
  open?: boolean;
  onClose?: () => void;
  onPick?: (preset: FramePresetItem) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  triggerRef?: React.RefObject<HTMLElement | null>;
  anchorEl?: HTMLElement | null;
  className?: string;
  "aria-label"?: string;
  [key: string]: unknown;
}

const PANEL_WIDTH = 340;
const PANEL_HEIGHT = 480;
const PANEL_GAP = 8;
const DEFAULT_CUSTOM_W = 800;
const DEFAULT_CUSTOM_H = 600;

export function FramePresetsPanel({
  open = true,
  onClose,
  onPick,
  anchorRef,
  triggerRef,
  anchorEl,
  className = "",
  "aria-label": ariaLabel,
}: FramePresetsPanelProps) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  const [isRendered, setIsRendered] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsRendered(true);
    }
  }

  // State
  const [orientation, setOrientation] = useState<"p" | "l" | "">("");
  const [query, setQuery] = useState("");
  const [customW, setCustomW] = useState(DEFAULT_CUSTOM_W);
  const [customH, setCustomH] = useState(DEFAULT_CUSTOM_H);
  const [ratioLocked, setRatioLocked] = useState(false);
  const [activePresetIndex, setActivePresetIndex] = useState(-1);

  // Filtered preset items
  const q = query.trim().toLowerCase();
  const filteredGroups = FRAME_PRESET_GROUPS.map((g) => {
    const items = g.items.filter((item) => {
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) || g.group.toLowerCase().includes(q)
      );
    });
    return { group: g.group, items };
  }).filter((g) => g.items.length > 0);

  // Flat list of visible presets for keyboard navigation
  const visiblePresets = filteredGroups.flatMap((g) =>
    g.items.map((item) => {
      const [w, h] = applyOrientation(item.width, item.height, orientation);
      return { name: item.name, width: w, height: h };
    })
  );

  // Positioning
  const updatePosition = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;

    const anchor = anchorRef?.current ?? triggerRef?.current ?? anchorEl;
    let left = Math.max(PANEL_GAP, (window.innerWidth - PANEL_WIDTH) / 2);
    let top = Math.max(PANEL_GAP, (window.innerHeight - PANEL_HEIGHT) / 2);

    if (anchor) {
      const r = anchor.getBoundingClientRect();
      const x = r.left + r.width / 2 - PANEL_WIDTH / 2;
      left = Math.max(
        PANEL_GAP,
        Math.min(x, window.innerWidth - PANEL_WIDTH - PANEL_GAP)
      );
      // Place above or below anchor
      if (r.top - PANEL_HEIGHT - PANEL_GAP >= PANEL_GAP) {
        top = r.top - PANEL_HEIGHT - PANEL_GAP;
      } else if (r.bottom + PANEL_GAP + PANEL_HEIGHT <= window.innerHeight - PANEL_GAP) {
        top = r.bottom + PANEL_GAP;
      }
    }

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [anchorRef, anchorEl]);

  // Open & Close animations
  useEffect(() => {
    if (!isRendered) return;
    const el = panelRef.current;
    if (!el) return;

    updatePosition();

    const reduced = prefersReducedMotion();
    const preset = getActivePreset();
    const anchor = anchorRef?.current ?? triggerRef?.current ?? anchorEl;

    if (open) {
      if (reduced) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: REDUCED_DURATION,
          easing: "ease-out",
          fill: "backwards",
        });
      } else if (anchor) {
        const s = anchor.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const originX = s.left + s.width / 2 - r.left;
        const originY = s.top + s.height / 2 - r.top;
        el.style.transformOrigin = `${originX}px ${originY}px`;

        const morphFrom = buildTriggerMorphClip(s, r);
        const morphTo = MORPH_EXPANDED_CLIP;

        const se = springEase(preset.shape[0], preset.shape[1]);
        el.animate(
          [
            { clipPath: morphFrom, transform: "scale(0.8)" },
            { clipPath: morphTo, transform: "scale(1)" },
          ],
          {
            duration: se.duration,
            easing: se.easing,
            fill: "backwards",
          }
        );
      } else {
        const se = springEase(preset.shape[0], preset.shape[1]);
        el.animate(
          [
            { opacity: 0, transform: POP_ENTER_TRANSFORM },
            { opacity: 1, transform: POP_SETTLE_TRANSFORM },
          ],
          {
            duration: se.duration,
            easing: se.easing,
            fill: "backwards",
          }
        );
      }
      searchInputRef.current?.focus({ preventScroll: true });
    } else {
      let anim: Animation;
      if (reduced) {
        anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: REDUCED_DURATION,
          easing: "ease-out",
          fill: "forwards",
        });
      } else if (anchor) {
        const s = anchor.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const originX = s.left + s.width / 2 - r.left;
        const originY = s.top + s.height / 2 - r.top;
        el.style.transformOrigin = `${originX}px ${originY}px`;

        const morphTarget = buildTriggerMorphClip(s, r);
        anim = el.animate(
          [
            { clipPath: MORPH_EXPANDED_CLIP, transform: "scale(1)", opacity: 1 },
            { clipPath: morphTarget, transform: "scale(0.86)", opacity: 0 },
          ],
          {
            duration: CLOSE_DURATION,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            fill: "forwards",
          }
        );
      } else {
        anim = el.animate(
          [
            { opacity: 1, transform: POP_SETTLE_TRANSFORM },
            { opacity: 0, transform: POP_CLOSE_TRANSFORM },
          ],
          {
            duration: CLOSE_DURATION,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            fill: "forwards",
          }
        );
      }
      anim.onfinish = () => {
        setIsRendered(false);
      };
    }
  }, [open, isRendered, anchorRef, anchorEl, updatePosition]);

  // Outside click & Escape
  useEffect(() => {
    if (!open || !isRendered) return;

    const handlePointerDown = (e: PointerEvent) => {
      const el = panelRef.current;
      const anchor = anchorRef?.current ?? triggerRef?.current ?? anchorEl;
      const target = e.target as Node | null;

      if (el && target && !el.contains(target)) {
        if (anchor && anchor.contains(target)) return;
        onClose?.();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActivePresetIndex((prev) =>
          visiblePresets.length > 0 ? (prev + 1) % visiblePresets.length : -1
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActivePresetIndex((prev) =>
          visiblePresets.length > 0
            ? (prev - 1 + visiblePresets.length) % visiblePresets.length
            : -1
        );
      } else if (e.key === "Enter") {
        if (activePresetIndex >= 0 && activePresetIndex < visiblePresets.length) {
          e.preventDefault();
          const p = visiblePresets[activePresetIndex];
          onPick?.(p);
          onClose?.();
        }
      }
    };

    const handleResize = () => {
      updatePosition();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, isRendered, onClose, onPick, anchorRef, anchorEl, activePresetIndex, visiblePresets, updatePosition]);

  const handleCustomWChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
    setCustomW(val);
    if (ratioLocked && customW > 0 && customH > 0) {
      const ratio = customH / customW;
      setCustomH(Math.max(1, Math.round(val * ratio)));
    }
  };

  const handleCustomHChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
    setCustomH(val);
    if (ratioLocked && customW > 0 && customH > 0) {
      const ratio = customW / customH;
      setCustomW(Math.max(1, Math.round(val * ratio)));
    }
  };

  const handleAddCustom = () => {
    if (customW > 0 && customH > 0) {
      onPick?.({ name: "Frame", width: customW, height: customH });
      onClose?.();
    }
  };

  if (!mounted || !isRendered) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel || "Frame presets"}
      aria-labelledby={panelId}
      tabIndex={-1}
      className={`ll:fixed ll:z-60 ll:w-frame-presets ll:h-frame-presets ll:bg-surface-float ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:text-primary ll:flex ll:flex-col ll:overflow-hidden ll:outline-none ${className}`}
    >
      {/* Header (44px) */}
      <div className="ll:flex ll:items-center ll:gap-1 ll:h-11 ll:pl-4 ll:pr-2 ll:border-b ll:border-border ll:shrink-0">
        <span
          id={panelId}
          className="ll:text-body ll:font-medium ll:text-primary"
        >
          Frame
        </span>
        <span className="ll:flex-1" />

        {/* Orientation: Portrait */}
        <button
          type="button"
          data-ori="p"
          aria-pressed={orientation === "p"}
          aria-label="Portrait"
          title="Portrait"
          onClick={() => setOrientation((prev) => (prev === "p" ? "" : "p"))}
          className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${
            orientation === "p"
              ? "ll:bg-surface-seg ll:text-primary"
              : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="ll:w-4 ll:h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="7" y="4" width="10" height="16" rx="1" />
          </svg>
        </button>

        {/* Orientation: Landscape */}
        <button
          type="button"
          data-ori="l"
          aria-pressed={orientation === "l"}
          aria-label="Landscape"
          title="Landscape"
          onClick={() => setOrientation((prev) => (prev === "l" ? "" : "l"))}
          className={`ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:transition-colors ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${
            orientation === "l"
              ? "ll:bg-surface-seg ll:text-primary"
              : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="ll:w-4 ll:h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="4" y="7" width="16" height="10" rx="1" />
          </svg>
        </button>
      </div>

      {/* Search Input (40px) */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:h-10 ll:px-3 ll:border-b ll:border-border ll:shrink-0 ll:bg-surface-bar ll:focus-within:border-primary ll:focus-within:ring-1 ll:focus-within:ring-primary">
        <Icon icon={Search} size={16} className="ll:text-muted ll:shrink-0" />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActivePresetIndex(-1);
          }}
          placeholder="Search presets"
          aria-label="Search presets"
          autoComplete="off"
          spellCheck="false"
          className="ll:flex-1 ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:text-body ll:text-primary placeholder:ll:text-muted"
        />
      </div>

      {/* Custom Size Section */}
      <div className="ll:flex ll:flex-col ll:gap-2 ll:p-3 ll:px-4 ll:border-b ll:border-border ll:shrink-0">
        <span className="ll:text-micro ll:font-medium ll:uppercase ll:tracking-wider ll:text-muted">
          Custom
        </span>
        <div className="ll:flex ll:items-center ll:gap-1.5 ll:min-w-0">
          {/* W Field */}
          <div className="ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0 ll:h-7.5 ll:px-2 ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:focus-within:border-primary ll:focus-within:ring-1 ll:focus-within:ring-primary">
            <label
              htmlFor="fr-w"
              className="ll:text-micro ll:font-mono ll:text-muted ll:select-none"
            >
              W
            </label>
            <input
              id="fr-w"
              type="text"
              inputMode="numeric"
              value={customW || ""}
              onChange={handleCustomWChange}
              aria-label="Width"
              className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:font-mono ll:text-micro ll:text-primary"
            />
          </div>

          {/* Ratio Lock */}
          <button
            type="button"
            aria-pressed={ratioLocked}
            aria-label="Lock ratio"
            title="Lock ratio"
            onClick={() => setRatioLocked((prev) => !prev)}
            className={`ll:w-7.5 ll:h-7.5 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:border ll:border-border ll:transition-colors ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${
              ratioLocked
                ? "ll:bg-surface-seg ll:text-primary"
                : "ll:bg-surface-bar ll:text-muted ll:hover:text-primary"
            }`}
          >
            <Icon icon={LinkIcon} size={14} />
          </button>

          {/* H Field */}
          <div className="ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0 ll:h-7.5 ll:px-2 ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:focus-within:border-primary ll:focus-within:ring-1 ll:focus-within:ring-primary">
            <label
              htmlFor="fr-h"
              className="ll:text-micro ll:font-mono ll:text-muted ll:select-none"
            >
              H
            </label>
            <input
              id="fr-h"
              type="text"
              inputMode="numeric"
              value={customH || ""}
              onChange={handleCustomHChange}
              aria-label="Height"
              className="ll:w-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:font-mono ll:text-micro ll:text-primary"
            />
          </div>

          {/* Add Frame Button */}
          <button
            type="button"
            disabled={customW <= 0 || customH <= 0}
            onClick={handleAddCustom}
            className="ll:h-7.5 ll:px-3 ll:rounded-sm ll:bg-surface-bar ll:hover:bg-surface-seg ll:text-secondary ll:hover:text-primary ll:text-micro ll:font-medium ll:whitespace-nowrap ll:disabled:opacity-40 ll:disabled:pointer-events-none ll:transition-colors ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
          >
            Add frame
          </button>
        </div>
      </div>

      {/* Preset List */}
      <div className="ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:overscroll-contain ll:scrollbar-none ll:p-2">
        {filteredGroups.length === 0 ? (
          <div className="ll:py-8 ll:text-center ll:text-body ll:text-muted">
            Nothing found
          </div>
        ) : (
          filteredGroups.map((g) => (
            <div key={g.group} className="ll:flex ll:flex-col">
              <span className="ll:px-2 ll:pt-3 ll:pb-1 ll:text-micro ll:font-medium ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
                {g.group}
              </span>
              {g.items.map((item) => {
                const [w, h] = applyOrientation(
                  item.width,
                  item.height,
                  orientation
                );
                const glyph = computeProportionalGlyph(w, h);
                const isSelected =
                  visiblePresets[activePresetIndex]?.name === item.name;

                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      onPick?.({ name: item.name, width: w, height: h });
                      onClose?.();
                    }}
                    className={`ll:flex ll:items-center ll:gap-3 ll:w-full ll:h-8 ll:px-2 ll:rounded-sm ll:text-left ll:transition-colors ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${
                      isSelected
                        ? "ll:bg-surface-hover ll:text-primary"
                        : "ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover"
                    }`}
                  >
                    {/* Proportional Glyph */}
                    <span className="ll:w-5 ll:h-5 ll:shrink-0 ll:grid ll:place-items-center">
                      <i
                        style={{ width: glyph.width, height: glyph.height }}
                        className="ll:block ll:border ll:border-muted ll:rounded-xs"
                      />
                    </span>
                    <span className="ll:flex-1 ll:min-w-0 ll:truncate ll:text-body">
                      {item.name}
                    </span>
                    <span className="ll:shrink-0 ll:font-mono ll:text-micro ll:text-muted">
                      {w} × {h}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>,
    document.body
  );
}
