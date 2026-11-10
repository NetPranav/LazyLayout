"use client";

import React, { useRef, useEffect, useState, useId, useCallback } from "react";
import { Search, LinkIcon } from "./ColorPickerIcons";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { Button } from "./Button";
import { surf, hlMove, hlHide, type Surf } from "../motion/surface";
import { MENU_FALLBACKS, MOT } from "../motion/presets";
import { prefersReducedMotion } from "../motion/feel";
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
  /** Element whose horizontal centre the panel uses (the floating toolbar). Falls back to the trigger/anchor. */
  centreRef?: React.RefObject<HTMLElement | null>;
  anchorEl?: HTMLElement | null;
  className?: string;
  "aria-label"?: string;
  [key: string]: unknown;
}

const EDGE_GAP = 8;
const DEFAULT_CUSTOM_W = 800;
const DEFAULT_CUSTOM_H = 600;
const MAX_DIM = 10000;

const ORI_PORTRAIT = (
  <svg viewBox="0 0 24 24" className="ll:w-4 ll:h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="7" y="4" width="10" height="16" rx="1" />
  </svg>
);
const ORI_LANDSCAPE = (
  <svg viewBox="0 0 24 24" className="ll:w-4 ll:h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="4" y="7" width="16" height="10" rx="1" />
  </svg>
);

export function FramePresetsPanel({
  open = true,
  onClose,
  onPick,
  anchorRef,
  triggerRef,
  centreRef,
  anchorEl,
  className = "",
  "aria-label": ariaLabel,
}: FramePresetsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const surfRef = useRef<Surf | null>(null);
  const panelId = useId();

  const [isRendered, setIsRendered] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setIsRendered(true);
  }

  const [orientation, setOrientation] = useState<"p" | "l" | "">("");
  const [query, setQuery] = useState("");
  const [customW, setCustomW] = useState(DEFAULT_CUSTOM_W);
  const [customH, setCustomH] = useState(DEFAULT_CUSTOM_H);
  const [ratioLocked, setRatioLocked] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);

  const q = query.trim().toLowerCase();
  const filteredGroups = FRAME_PRESET_GROUPS.map((g) => ({
    group: g.group,
    items: g.items.filter((item) => !q || `${item.name} ${g.group}`.toLowerCase().includes(q)),
  })).filter((g) => g.items.length > 0);

  const visiblePresets = filteredGroups.flatMap((g) =>
    g.items.map((item) => {
      const [w, h] = applyOrientation(item.width, item.height, orientation);
      return { name: item.name, width: w, height: h };
    })
  );

  const getAnchor = useCallback(
    () => anchorRef?.current ?? triggerRef?.current ?? anchorEl ?? null,
    [anchorRef, triggerRef, anchorEl]
  );

  // Centre on the floating toolbar (centreRef), clamped inside the viewport with an 8px edge gap
  const updatePosition = useCallback(() => {
    const el = panelRef.current;
    const centre = centreRef?.current ?? getAnchor();
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const m = parent.getBoundingClientRect();
    const w = el.offsetWidth;
    const c = centre?.getBoundingClientRect();
    const viewW = document.documentElement.clientWidth;
    const centreX = c ? c.left + c.width / 2 : m.left + m.width / 2;
    const min = w / 2 + EDGE_GAP;
    const max = Math.max(min, viewW - w / 2 - EDGE_GAP);
    const x = Math.max(min, Math.min(centreX, max));
    el.style.left = `${x - m.left - parent.clientLeft}px`;
  }, [centreRef, getAnchor]);

  // Keep centred when the toolbar changes width (mode switch, collapsed panels)
  useEffect(() => {
    const target = centreRef?.current;
    if (!open || !isRendered || !target || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => updatePosition());
    ro.observe(target);
    return () => ro.disconnect();
  }, [open, isRendered, centreRef, updatePosition]);

  useEffect(() => {
    if (!isRendered || !panelRef.current) return;
    const s = surf(panelRef.current);
    surfRef.current = s;
    return () => s.reset();
  }, [isRendered]);

  // Open: morph out of the Frame button. Close: reverse. Reduced motion is handled by Surf.
  useEffect(() => {
    if (!isRendered) return;
    const s = surfRef.current;
    const el = panelRef.current;
    if (!s || !el) return;

    if (open) {
      updatePosition();
      const anchor = getAnchor();
      let seed = { ...MENU_FALLBACKS.surfaceSeedDefault };
      if (anchor) {
        const r = anchor.getBoundingClientRect();
        seed = {
          w: Math.round(r.width),
          h: Math.round(r.height),
          r: parseFloat(getComputedStyle(anchor).borderRadius) || MENU_FALLBACKS.popoverRadius,
        };
      }
      s.size = { w: el.offsetWidth, h: el.offsetHeight };
      s.open({ from: seed, up: true });
      searchInputRef.current?.focus({ preventScroll: true });
    } else {
      s.leave();
      const exit = prefersReducedMotion() ? MENU_FALLBACKS.reducedMotionDuration : MOT.exitMs;
      const t = setTimeout(() => setIsRendered(false), exit);
      return () => clearTimeout(t);
    }
  }, [open, isRendered, getAnchor, updatePosition]);

  const moveHighlight = useCallback((idx: number, instant = false) => {
    const list = listRef.current;
    const root = panelRef.current;
    if (!list || !root) return;
    const row = list.querySelectorAll<HTMLElement>(".ll-frr")[idx];
    if (!row) {
      hlHide(root);
      return;
    }
    row.scrollIntoView({ block: "nearest" });
    hlMove(root, row, instant);
  }, []);

  useEffect(() => {
    if (!open || !isRendered) return;

    const handlePointerDown = (e: PointerEvent) => {
      const el = panelRef.current;
      const target = e.target as Node | null;
      if (el && target && !el.contains(target)) {
        const anchor = getAnchor();
        if (anchor && anchor.contains(target)) return;
        onClose?.();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
      const target = e.target as HTMLElement | null;
      if (!panelRef.current || !target || !panelRef.current.contains(target)) return;
      if (e.key === "Enter") {
        if (target !== searchInputRef.current) return;
        const p = visiblePresets[activeIndex >= 0 ? activeIndex : 0];
        if (p) {
          e.preventDefault();
          onPick?.(p);
          onClose?.();
        }
        return;
      }
      e.preventDefault();
      const n = visiblePresets.length;
      if (!n) return;
      const next =
        activeIndex < 0
          ? e.key === "ArrowDown"
            ? 0
            : n - 1
          : (activeIndex + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
      setActiveIndex(next);
      moveHighlight(next);
    };

    const handleResize = () => updatePosition();

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, isRendered, onClose, onPick, getAnchor, activeIndex, visiblePresets, updatePosition, moveHighlight]);

  // Back to the top with no highlight when the filter or orientation changes
  const resetList = () => {
    setActiveIndex(-1);
    if (listRef.current) listRef.current.scrollTop = 0;
    if (panelRef.current) hlHide(panelRef.current);
  };

  const clamp = (raw: string) =>
    Math.min(MAX_DIM, parseInt(raw.replace(/\D/g, "").slice(0, 5), 10) || 0);

  const handleCustomW = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = clamp(e.target.value);
    setCustomW(val);
    if (ratioLocked && ratio && val) setCustomH(Math.max(1, Math.round(val * ratio)));
  };

  const handleCustomH = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = clamp(e.target.value);
    setCustomH(val);
    if (ratioLocked && ratio && val) setCustomW(Math.max(1, Math.round(val / ratio)));
  };

  const toggleLock = () => {
    const on = !ratioLocked;
    setRatioLocked(on);
    setRatio(on && customW > 0 && customH > 0 ? customH / customW : 0);
  };

  const handleAddCustom = () => {
    if (customW > 0 && customH > 0) {
      onPick?.({ name: "Frame", width: customW, height: customH });
      onClose?.();
    }
  };

  const toggleOrientation = (value: "p" | "l") => {
    setOrientation((prev) => (prev === value ? "" : value));
    resetList();
  };

  if (!isRendered) return null;

  const fieldClass =
    "dfield ll-dfield field ll:flex ll:items-center ll:gap-1.5 ll-frfield ll:flex-1 ll:min-w-0 ll:rounded-sm ll:border ll:border-border ll:cursor-text";
  const inputClass =
    "ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:font-mono ll:text-micro ll:text-primary";

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel || "Frame presets"}
      aria-labelledby={panelId}
      tabIndex={-1}
      className={`ll-frp ll:absolute ll:left-1/2 ll:-translate-x-1/2 ll:z-30 ll:flex ll:flex-col ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:overflow-hidden ll:outline-none ${className}`}
    >
      <div className="ll-lay ll:flex ll:flex-col ll:flex-1 ll:min-h-0">
        <div className="ll-frh ll:flex ll:items-center ll:gap-1 ll:h-11 ll:pl-4 ll:pr-2 ll:border-b ll:border-border ll:shrink-0">
          <span id={panelId} className="ll-frt ll:text-body ll:font-medium ll:text-primary">
            Frame
          </span>
          <span className="ll:flex-1" />
          <IconButton
            size="md"
            pressed={orientation === "p"}
            aria-label="Portrait"
            title="Portrait"
            icon={ORI_PORTRAIT}
            onClick={() => toggleOrientation("p")}
          />
          <IconButton
            size="md"
            pressed={orientation === "l"}
            aria-label="Landscape"
            title="Landscape"
            icon={ORI_LANDSCAPE}
            onClick={() => toggleOrientation("l")}
          />
        </div>

        <div className="ll-insq ll:flex ll:items-center ll:gap-2 ll:h-10 ll:px-4 ll:text-muted ll:border-b ll:border-border ll:shrink-0">
          <Icon icon={Search} size={16} className="ll:text-muted ll:shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetList();
            }}
            placeholder="Search presets"
            aria-label="Search presets"
            autoComplete="off"
            spellCheck="false"
            className="ll:flex-1 ll:min-w-0 ll:h-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:text-body ll:text-primary"
          />
        </div>

        <div className="ll-frc ll:flex ll:flex-col ll:gap-2 ll:py-3 ll:px-4 ll:border-b ll:border-border ll:shrink-0">
          <span className="ll-micro ll:text-micro ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted">
            Custom
          </span>
          <div className="ll-frcr ll:flex ll:items-center ll:gap-1.5 ll:min-w-0">
            <label className={fieldClass}>
              <span className="ll-pf ll:text-micro ll:font-mono ll:text-muted ll:select-none">W</span>
              <input
                id="fr-w"
                type="text"
                inputMode="numeric"
                value={customW || ""}
                onChange={handleCustomW}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
                aria-label="Width"
                className={inputClass}
              />
            </label>
            <IconButton
              size="md"
              pressed={ratioLocked}
              aria-label="Lock ratio"
              title="Lock ratio"
              icon={<Icon icon={LinkIcon} size={14} />}
              onClick={toggleLock}
            />
            <label className={fieldClass}>
              <span className="ll-pf ll:text-micro ll:font-mono ll:text-muted ll:select-none">H</span>
              <input
                id="fr-h"
                type="text"
                inputMode="numeric"
                value={customH || ""}
                onChange={handleCustomH}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
                aria-label="Height"
                className={inputClass}
              />
            </label>
            <Button
              size="sm"
              variant="default"
              disabled={customW <= 0 || customH <= 0}
              onClick={handleAddCustom}
              className="ll-frbtn ll:px-3 ll:shrink-0 ll:whitespace-nowrap"
            >
              Add frame
            </Button>
          </div>
        </div>

        <div
          ref={listRef}
          className="ll-frl ll:relative ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:overscroll-contain ll:scrollbar-none ll:pt-1 ll:px-2 ll:pb-2"
          onMouseOver={(e) => {
            const row = (e.target as HTMLElement).closest<HTMLElement>(".ll-frr");
            if (!row || !listRef.current) return;
            const idx = Array.from(listRef.current.querySelectorAll(".ll-frr")).indexOf(row);
            if (idx !== activeIndex) {
              setActiveIndex(idx);
              moveHighlight(idx);
            }
          }}
        >
          {filteredGroups.length === 0 ? (
            <div className="ll-frnone ll:py-8 ll:text-center ll:text-body ll:text-muted">Nothing found</div>
          ) : (
            filteredGroups.map((g) => (
              <React.Fragment key={g.group}>
                <span className="ll-frg ll-micro ll:block ll:pt-3 ll:px-2 ll:pb-1 ll:text-micro ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
                  {g.group}
                </span>
                {g.items.map((item) => {
                  const [w, h] = applyOrientation(item.width, item.height, orientation);
                  const glyph = computeProportionalGlyph(w, h);
                  const on = visiblePresets[activeIndex]?.name === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      tabIndex={-1}
                      onClick={() => {
                        onPick?.({ name: item.name, width: w, height: h });
                        onClose?.();
                      }}
                      className={`ll-frr ${on ? "ll-on ll:text-primary" : "ll:text-secondary"} ll:flex ll:items-center ll:gap-3 ll:w-full ll:h-8 ll:px-2 ll:rounded-sm ll:text-left ll:border-0 ll:bg-transparent ll:cursor-pointer ll:outline-none`}
                    >
                      <span className="ll-frgl ll:w-5 ll:h-5 ll:shrink-0 ll:grid ll:place-items-center">
                        <i
                          style={{ width: glyph.width, height: glyph.height }}
                          className="ll:block ll:box-border ll:border ll:border-muted ll:rounded-xs"
                        />
                      </span>
                      <span className="ll-frnm ll:flex-1 ll:min-w-0 ll:truncate ll:text-body">{item.name}</span>
                      <span className="ll-frsz ll:shrink-0 ll:font-mono ll:text-micro ll:text-muted">
                        {w} × {h}
                      </span>
                    </button>
                  );
                })}
              </React.Fragment>
            ))
          )}
          <i className="ll-hl" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
