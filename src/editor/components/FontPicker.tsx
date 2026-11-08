"use client";

import React, { useRef, useEffect, useState, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, Check, Plus } from "./ColorPickerIcons";
import { Icon } from "./Icon";
import { SegmentedControl } from "./SegmentedControl";
import { Button } from "./Button";
import { useMounted } from "./useMounted";
import { useSlidingIndicator } from "./useSlidingIndicator";
import { getActivePreset, prefersReducedMotion } from "../motion/feel";
import { springEase } from "../motion/ease";
import {
  MORPH_EXPANDED_CLIP,
  buildTriggerMorphClip,
  rowCascadeInitialTransform,
  rowCascadeSettleTransform,
  ROW_CASCADE_BLUR_ENTER,
  ROW_CASCADE_BLUR_SETTLE,
  LIST_EDGE_MASK_IMAGE,
  REDUCED_DURATION,
  CLOSE_DURATION,
} from "./ColorPickerMotion";
import {
  registerOverlay,
  unregisterOverlay,
  getFamilyHandoff,
  animateRetarget,
} from "./retarget";
import {
  FONT_CATEGORIES,
  DEFAULT_PROJECT_FONTS,
  SYSTEM_FONTS,
  LIBRARY_FONTS,
  fontStack,
  matchHighlight,
  type FontCategory,
  type FontEntry,
} from "./FontPickerData";

export interface FontPickerProps {
  open?: boolean;
  value?: string;
  onChange?: (family: string) => void;
  onPreview?: (family: string | null) => void;
  onClose?: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  triggerRef?: React.RefObject<HTMLElement | null>;
  anchorEl?: HTMLElement | null;
  className?: string;
  "aria-label"?: string;
  [key: string]: unknown;
}

const PICKER_WIDTH = 304;
const PICKER_GAP = 8;
const STAGGER_BASE = 50;
const STAGGER_MS = 18;

export function FontPicker({
  open = true,
  value = "Inter",
  onChange,
  onPreview,
  onClose,
  anchorRef,
  triggerRef,
  anchorEl,
  className = "",
  "aria-label": ariaLabel,
}: FontPickerProps) {
  const mounted = useMounted();
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevAnchorRef = useRef<HTMLElement | null>(null);
  const isImmediateCloseRef = useRef(false);
  const pickerId = useId();
  const pickerUniqueId = useId();

  const [isRendered, setIsRendered] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsRendered(true);
    }
  }

  const [activeCategory, setActiveCategory] = useState<FontCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadedFonts, setUploadedFonts] = useState<FontEntry[]>([]);
  const [focusedFamily, setFocusedFamily] = useState<string>(value);

  // Combine project fonts with uploads
  const allProjectFonts = [...uploadedFonts, ...DEFAULT_PROJECT_FONTS];

  // Filter groups
  const q = searchQuery.trim().toLowerCase();
  const filterEntry = (entry: FontEntry): boolean => {
    if (activeCategory !== "All" && entry.category !== activeCategory) {
      return false;
    }
    if (!q) return true;
    return matchHighlight(entry.name, q) !== null;
  };

  const projectGroup = allProjectFonts.filter(filterEntry);
  const systemGroup = SYSTEM_FONTS.filter(filterEntry);
  const libraryGroup = LIBRARY_FONTS.filter(filterEntry);

  const flatVisible = [...projectGroup, ...systemGroup, ...libraryGroup];

  // Position calculation
  const updatePosition = useCallback(() => {
    const el = pickerRef.current;
    if (!el) return;

    const anchor = anchorRef?.current ?? triggerRef?.current ?? anchorEl;
    const rightZone = document.querySelector(".zone.right");
    const rightRect = rightZone
      ? rightZone.getBoundingClientRect()
      : anchor
      ? anchor.getBoundingClientRect()
      : null;

    let left = window.innerWidth - PICKER_WIDTH - PICKER_GAP;
    let top = PICKER_GAP;
    const maxHeight = Math.max(120, window.innerHeight - 2 * PICKER_GAP);

    if (anchor && rightRect) {
      const s = anchor.getBoundingClientRect();
      left = rightRect.left - PICKER_WIDTH - PICKER_GAP;
      if (left < PICKER_GAP) {
        left = Math.max(
          PICKER_GAP,
          Math.min(s.left - PICKER_WIDTH - PICKER_GAP, window.innerWidth - PICKER_WIDTH - PICKER_GAP)
        );
      }
      top = s.top - 12;
    }

    const pickerH = el.offsetHeight || 380;
    const fittedTop = Math.max(
      PICKER_GAP,
      Math.min(top, window.innerHeight - PICKER_GAP - pickerH)
    );

    el.style.left = `${left}px`;
    el.style.top = `${fittedTop}px`;
    el.style.maxHeight = `${maxHeight}px`;
  }, [anchorRef, anchorEl]);

  // Open & Close animations with retargeting
  useEffect(() => {
    if (!isRendered) return;
    const el = pickerRef.current;
    if (!el) return;

    updatePosition();

    const reduced = prefersReducedMotion();
    const preset = getActivePreset();
    const anchor = (anchorRef?.current ?? triggerRef?.current ?? anchorEl) as HTMLElement | null;

    if (open) {
      const toRect = el.getBoundingClientRect();
      const isAnchorSwitch =
        prevAnchorRef.current !== null &&
        prevAnchorRef.current !== anchor;
      const handoff = !isAnchorSwitch ? getFamilyHandoff("font-picker", pickerUniqueId) : null;

      if (reduced) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: REDUCED_DURATION,
          easing: "ease-out",
          fill: "backwards",
        });
      } else if (isAnchorSwitch && prevAnchorRef.current) {
        const oldRect = prevAnchorRef.current.getBoundingClientRect();
        animateRetarget(el, oldRect, toRect, listRef.current);
      } else if (handoff) {
        animateRetarget(el, handoff, toRect, listRef.current);
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

        // Stagger rows
        if (listRef.current) {
          const rowElements = Array.from(
            listRef.current.querySelectorAll("[data-fp-row]")
          ) as HTMLElement[];
          const rowSe = springEase(preset.rows[0], preset.rows[1]);
          rowElements.slice(0, 14).forEach((row, i) => {
            row.animate(
              [
                {
                  opacity: 0,
                  transform: rowCascadeInitialTransform(preset.rowScale),
                  filter: ROW_CASCADE_BLUR_ENTER,
                },
                {
                  opacity: 1,
                  transform: rowCascadeSettleTransform,
                  filter: ROW_CASCADE_BLUR_SETTLE,
                },
              ],
              {
                duration: rowSe.duration,
                easing: rowSe.easing,
                delay: STAGGER_BASE + i * (preset.stagger || STAGGER_MS),
                fill: "backwards",
              }
            );
          });
        }
      }

      prevAnchorRef.current = anchor;
      registerOverlay({
        id: pickerUniqueId,
        family: "font-picker",
        element: el,
        anchor,
        close: (immediate) => {
          if (immediate) isImmediateCloseRef.current = true;
          onClose?.();
        },
        rect: toRect,
        timestamp: performance.now(),
      });
      searchInputRef.current?.focus({ preventScroll: true });
    } else {
      prevAnchorRef.current = null;
      unregisterOverlay(pickerUniqueId);
      if (isImmediateCloseRef.current) {
        isImmediateCloseRef.current = false;
        setIsRendered(false);
        return;
      }
      let anim: Animation;
      if (reduced || !anchor) {
        anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: REDUCED_DURATION,
          easing: "ease-out",
          fill: "forwards",
        });
      } else {
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
            easing: "cubic-bezier(0.4, 0, 0.8, 0.6)",
            fill: "forwards",
          }
        );
      }
      anim.onfinish = () => {
        setIsRendered(false);
      };
    }
  }, [open, isRendered, anchorRef, anchorEl, triggerRef, updatePosition, pickerUniqueId, onClose]);

  useEffect(() => {
    return () => {
      unregisterOverlay(pickerUniqueId);
    };
  }, [pickerUniqueId]);

  // Outside pointerdown, Escape, and Arrow keys
  useEffect(() => {
    if (!open || !isRendered) return;

    const handlePointerDown = (e: PointerEvent) => {
      const el = pickerRef.current;
      const anchor = anchorRef?.current ?? triggerRef?.current ?? anchorEl;
      const target = e.target as Node | null;

      if (el && target && !el.contains(target)) {
        if (anchor && anchor.contains(target)) return;
        onPreview?.(null);
        onClose?.();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onPreview?.(null);
        onClose?.();
        const anchor = anchorRef?.current ?? triggerRef?.current ?? anchorEl;
        anchor?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (flatVisible.length === 0) return;
        e.preventDefault();
        const currentIdx = flatVisible.findIndex((f) => f.name === focusedFamily);
        let nextIdx = 0;
        if (e.key === "ArrowDown") {
          nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % flatVisible.length;
        } else {
          nextIdx =
            currentIdx < 0
              ? flatVisible.length - 1
              : (currentIdx - 1 + flatVisible.length) % flatVisible.length;
        }
        const nextFont = flatVisible[nextIdx];
        setFocusedFamily(nextFont.name);
        onPreview?.(nextFont.name);

        // Auto-scroll into view
        const targetEl = listRef.current?.querySelector(
          `[data-fp-family="${CSS.escape(nextFont.name)}"]`
        ) as HTMLElement | null;
        targetEl?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        if (focusedFamily) {
          e.preventDefault();
          onChange?.(focusedFamily);
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
  }, [open, isRendered, onClose, onPreview, onChange, focusedFamily, flatVisible, anchorRef, anchorEl, updatePosition]);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cleanName =
      file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() ||
      "Custom Font";

    if (typeof window !== "undefined" && "FontFace" in window) {
      try {
        const url = URL.createObjectURL(file);
        const fontFace = new FontFace(cleanName, `url(${url})`);
        fontFace.load().then((loaded) => {
          document.fonts.add(loaded);
        }).catch(() => {});
      } catch {
        // ignore font face loading error
      }
    }

    const newEntry: FontEntry = {
      name: cleanName,
      group: "proj",
      category: "Sans",
      meta: "Uploaded",
    };

    setUploadedFonts((prev) => [newEntry, ...prev.filter((f) => f.name !== cleanName)]);
    setFocusedFamily(cleanName);
    onChange?.(cleanName);
    e.target.value = "";
  };

  const handleGoogleFontsClick = () => {
    setActiveCategory("All");
    setSearchQuery("");
    const libHeader = listRef.current?.querySelector("[data-fp-group=lib]");
    libHeader?.scrollIntoView({ behavior: "smooth" });
  };

  if (!mounted || !isRendered) return null;

  return createPortal(
    <div
      ref={pickerRef}
      role="dialog"
      aria-label={ariaLabel || "Font picker"}
      aria-labelledby={pickerId}
      tabIndex={-1}
      className={`fp ll-fp ll:fixed ll:z-60 ll:w-picker ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:text-primary ll:flex ll:flex-col ll:overflow-hidden ll:outline-none ${className}`}
    >
      {/* Header (Search + Categories) */}
      <div className="fp-hd ll:p-2 ll:flex ll:flex-col ll:gap-2 ll:shrink-0">
        {/* Search Field (28px) */}
        <div className="dfield ll-dfield fp-s ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:hover:border-muted ll:focus-within:border-primary">
          <Icon icon={Search} size={14} className="ll:text-muted ll:shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-label="Search fonts"
            placeholder="Search fonts"
            autoComplete="off"
            spellCheck="false"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ll:flex-1 ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:font-mono ll:text-micro ll:text-primary placeholder:ll:text-muted"
          />
        </div>

        {/* Categories Segmented Control (24px) with sliding highlight */}
        <SegmentedControl<FontCategory>
          size="compact"
          options={FONT_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
          value={activeCategory}
          onChange={(cat) => setActiveCategory(cat)}
          ariaLabel="Font category"
          className="fp-seg"
        />
      </div>

      <div className="ll:h-px ll:bg-border ll:shrink-0" />

      {/* Font List with edge-blur masking and no visible scrollbar */}
      <div
        ref={listRef}
        role="listbox"
        aria-label="Font family"
        tabIndex={-1}
        onMouseLeave={() => onPreview?.(null)}
        style={{
          maskImage: LIST_EDGE_MASK_IMAGE,
          WebkitMaskImage: LIST_EDGE_MASK_IMAGE,
        }}
        className="ll:flex-1 ll:min-h-24 ll:max-h-75 ll:overflow-y-auto ll:overscroll-contain ll:scrollbar-none ll:p-1 ll:outline-none"
      >
        {flatVisible.length === 0 ? (
          <div className="ll:py-7 ll:px-3 ll:text-center ll:text-muted ll:text-small">
            No fonts match
          </div>
        ) : (
          <>
            {/* Project Fonts Group */}
            {projectGroup.length > 0 && (
              <div className="ll:flex ll:flex-col">
                <div className="ll:flex ll:items-center ll:gap-2 ll:px-2 ll:pt-2 ll:pb-1 ll:text-micro ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
                  <span>In this project</span>
                  <div className="ll:flex-1 ll:h-px ll:bg-border" />
                </div>
                {projectGroup.map((entry) => renderFontRow(entry))}
              </div>
            )}

            {/* System Fonts Group */}
            {systemGroup.length > 0 && (
              <div className="ll:flex ll:flex-col">
                <div className="ll:flex ll:items-center ll:gap-2 ll:px-2 ll:pt-2 ll:pb-1 ll:text-micro ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
                  <span>System</span>
                  <div className="ll:flex-1 ll:h-px ll:bg-border" />
                </div>
                {systemGroup.map((entry) => renderFontRow(entry))}
              </div>
            )}

            {/* Library Group */}
            {libraryGroup.length > 0 && (
              <div data-fp-group="lib" className="ll:flex ll:flex-col">
                <div className="ll:flex ll:items-center ll:gap-2 ll:px-2 ll:pt-2 ll:pb-1 ll:text-micro ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none">
                  <span>Library</span>
                  <div className="ll:flex-1 ll:h-px ll:bg-border" />
                </div>
                {libraryGroup.map((entry) => renderFontRow(entry))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="ll:h-px ll:bg-border ll:shrink-0" />

      {/* Footer (Upload Font & Google Fonts buttons) */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:p-2 ll:shrink-0">
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={() => fileInputRef.current?.click()}
          leftIcon={<Icon icon={Plus} size={14} />}
          className="ll:flex-1"
        >
          Upload font…
        </Button>

        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={handleGoogleFontsClick}
          className="ll:flex-1"
        >
          Google Fonts
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          onChange={handleFileUpload}
          hidden
          aria-label="Upload font file"
        />
      </div>
    </div>,
    document.body
  );

  function renderFontRow(entry: FontEntry) {
    const isSelected = entry.name === value;
    const isFocused = entry.name === focusedFamily;
    const slices = matchHighlight(entry.name, searchQuery) ?? [
      { text: entry.name, isMatch: false },
    ];

    return (
      <div
        key={entry.name}
        data-fp-row
        data-fp-family={entry.name}
        role="option"
        tabIndex={0}
        aria-selected={isSelected}
        onClick={() => {
          onChange?.(entry.name);
          onClose?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChange?.(entry.name);
            onClose?.();
          }
        }}
        onMouseEnter={() => {
          setFocusedFamily(entry.name);
          onPreview?.(entry.name);
        }}
        className={`ll:flex ll:items-center ll:gap-2 ll:h-8 ll:px-2 ll:rounded-sm ll:cursor-pointer ll:select-none ll:transition-colors ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${
          isFocused
            ? "ll:bg-surface-hover ll:text-primary"
            : "ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover"
        }`}
      >
        {/* Selected Checkmark (14px) */}
        <span
          className={`ll:w-3.5 ll:h-3.5 ll:shrink-0 ll:flex ll:items-center ll:justify-center ${
            isSelected ? "ll:opacity-100 ll:text-primary" : "ll:opacity-0"
          }`}
        >
          <Icon icon={Check} size={14} />
        </span>

        {/* Font Name in its own Family */}
        <span
          style={{ fontFamily: fontStack(entry.name) }}
          className="ll:flex-1 ll:min-w-0 ll:truncate ll:text-body"
        >
          {slices.map((slice, i) =>
            slice.isMatch ? (
              <em
                key={i}
                className="ll:not-italic ll:bg-surface-seg ll:rounded-xs ll:px-0.5"
              >
                {slice.text}
              </em>
            ) : (
              <span key={i}>{slice.text}</span>
            )
          )}
        </span>

        {/* Meta label */}
        <span className="ll:shrink-0 ll:font-mono ll:text-micro ll:text-muted">
          {entry.meta}
        </span>
      </div>
    );
  }
}
