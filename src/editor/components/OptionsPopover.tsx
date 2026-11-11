"use client";

import React, { useRef, useEffect, useLayoutEffect, useState, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "./ColorPickerIcons";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { useMounted } from "./useMounted";
import { getActivePreset, prefersReducedMotion } from "../motion/feel";
import { springEase } from "../motion/ease";
import {
  MORPH_EXPANDED_CLIP,
  buildTriggerMorphClip,
  rowCascadeInitialTransform,
  rowCascadeSettleTransform,
  ROW_CASCADE_BLUR_ENTER,
  ROW_CASCADE_BLUR_SETTLE,
  REDUCED_DURATION,
} from "./ColorPickerMotion";
import {
  registerOverlay,
  unregisterOverlay,
  getFamilyHandoff,
  animateRetarget,
} from "./retarget";

export interface OptionsPopoverProps {
  open: boolean;
  title: string;
  anchorRef?: React.RefObject<HTMLElement | null>;
  triggerRef?: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
  [key: string]: unknown;
}

const POPOVER_WIDTH = 280;
const POPOVER_GAP = 8;
const STAGGER_BASE = 50;
const STAGGER_MS = 18;
const CLOSE_MS = 190;
const MAX_CASCADE = 14;
const STAGE_AREA = ".ll-stagewrap, [data-stage='canvas']";
const RIGHT_ZONE = ".zone.right, [data-testid='right-panel'], .ll-shell-right";

export function OptionsPopover({
  open,
  title,
  anchorRef,
  triggerRef,
  onClose,
  children,
  className = "",
  "aria-label": ariaLabel,
}: OptionsPopoverProps) {
  const mounted = useMounted();
  const popRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const prevAnchorRef = useRef<HTMLElement | null>(null);
  const isImmediateCloseRef = useRef(false);
  const closeAnimRef = useRef<Animation | null>(null);
  // Parents pass a fresh onClose every render; the effects must not restart the morph because of it.
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });
  const titleId = useId();
  const optionsUniqueId = useId();

  const [isRendered, setIsRendered] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsRendered(true);
    }
  }

  // Positioning
  const updatePosition = useCallback(() => {
    const pop = popRef.current;
    if (!pop) return;

    const anchor = (anchorRef?.current ?? triggerRef?.current) as HTMLElement | null;
    const rightZone = anchor?.closest(RIGHT_ZONE) ?? document.querySelector(RIGHT_ZONE);
    const rightRect = rightZone
      ? rightZone.getBoundingClientRect()
      : anchor
      ? anchor.getBoundingClientRect()
      : null;

    let left = window.innerWidth - POPOVER_WIDTH - POPOVER_GAP;
    let top = POPOVER_GAP;
    const maxHeight = Math.max(100, window.innerHeight - 2 * POPOVER_GAP);

    if (anchor && rightRect) {
      const s = anchor.getBoundingClientRect();
      left = rightRect.left - POPOVER_WIDTH - POPOVER_GAP;
      if (left < POPOVER_GAP) {
        left = Math.max(
          POPOVER_GAP,
          Math.min(s.left - POPOVER_WIDTH - POPOVER_GAP, window.innerWidth - POPOVER_WIDTH - POPOVER_GAP)
        );
      }
      top = s.top + s.height / 2 - 18;
    }

    const popH = pop.offsetHeight || 260;
    const fittedTop = Math.max(POPOVER_GAP, Math.min(top, window.innerHeight - POPOVER_GAP - popH));

    pop.style.left = `${left}px`;
    pop.style.top = `${fittedTop}px`;
    pop.style.maxHeight = `${maxHeight}px`;
  }, [anchorRef, triggerRef]);

  // Open & Close animations with retargeting. A layout effect, so the first painted frame is already the morph start.
  useLayoutEffect(() => {
    if (!isRendered) return;
    const pop = popRef.current;
    const anchor = (anchorRef?.current ?? triggerRef?.current) as HTMLElement | null;
    if (!pop) return;

    const reduced = prefersReducedMotion();
    const preset = getActivePreset();

    if (open) {
      const wasClosing = closeAnimRef.current !== null;
      if (closeAnimRef.current) {
        closeAnimRef.current.onfinish = null;
        closeAnimRef.current = null;
      }
      pop.getAnimations().forEach((a) => a.cancel());
      updatePosition();

      const toRect = pop.getBoundingClientRect();
      const isAnchorSwitch =
        prevAnchorRef.current !== null &&
        prevAnchorRef.current !== anchor;
      const handoff = !isAnchorSwitch ? getFamilyHandoff("inspector-options", optionsUniqueId) : null;
      const swap = wasClosing ? null : handoff;

      if (reduced) {
        pop.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: REDUCED_DURATION,
          easing: "ease-out",
          fill: "backwards",
        });
      } else if (isAnchorSwitch && prevAnchorRef.current) {
        const oldRect = prevAnchorRef.current.getBoundingClientRect();
        animateRetarget(pop, oldRect, toRect, bodyRef.current, { blur: false });
      } else if (swap) {
        animateRetarget(pop, swap, toRect, bodyRef.current, { blur: false });
      } else if (anchor) {
        const s = anchor.getBoundingClientRect();
        const r = pop.getBoundingClientRect();
        const originX = s.left + s.width / 2 - r.left;
        const originY = s.top + s.height / 2 - r.top;
        pop.style.transformOrigin = `${originX}px ${originY}px`;

        const morphFrom = buildTriggerMorphClip(s, r);
        const morphTo = MORPH_EXPANDED_CLIP;

        const se = springEase(preset.shape[0], preset.shape[1]);
        pop.animate(
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

        // Staggered cascade for header and rows
        const headerEl = headerRef.current;
        const bodyEl = bodyRef.current;
        const childElements: HTMLElement[] = [];
        if (headerEl) childElements.push(headerEl);
        if (bodyEl) {
          const rows = Array.from(bodyEl.querySelectorAll<HTMLElement>(".dmg > *"));
          const kids = rows.length ? rows : (Array.from(bodyEl.children) as HTMLElement[]);
          childElements.push(...kids.slice(0, MAX_CASCADE));
        }

        const rowSe = springEase(preset.rows[0], preset.rows[1]);
        childElements.forEach((el, i) => {
          el.animate(
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

      prevAnchorRef.current = anchor;
      registerOverlay({
        id: optionsUniqueId,
        family: "inspector-options",
        element: pop,
        anchor,
        close: (immediate) => {
          if (immediate) isImmediateCloseRef.current = true;
          onCloseRef.current();
        },
        rect: toRect,
        timestamp: performance.now(),
      });
    } else {
      prevAnchorRef.current = null;
      unregisterOverlay(optionsUniqueId);
      pop.getAnimations().forEach((a) => a.cancel());
      if (isImmediateCloseRef.current) {
        isImmediateCloseRef.current = false;
        setIsRendered(false);
        return;
      }
      let anim: Animation;
      if (reduced || !anchor) {
        anim = pop.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: REDUCED_DURATION,
          easing: "ease-out",
          fill: "forwards",
        });
      } else {
        const s = anchor.getBoundingClientRect();
        const r = pop.getBoundingClientRect();
        const originX = s.left + s.width / 2 - r.left;
        const originY = s.top + s.height / 2 - r.top;
        pop.style.transformOrigin = `${originX}px ${originY}px`;

        const morphTarget = buildTriggerMorphClip(s, r);
        anim = pop.animate(
          [
            { clipPath: MORPH_EXPANDED_CLIP, transform: "scale(1)", opacity: 1 },
            { clipPath: morphTarget, transform: "scale(0.86)", opacity: 0 },
          ],
          {
            duration: CLOSE_MS,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            fill: "forwards",
          }
        );
      }

      closeAnimRef.current = anim;
      anim.onfinish = () => {
        closeAnimRef.current = null;
        setIsRendered(false);
      };
    }
  }, [open, isRendered, anchorRef, triggerRef, optionsUniqueId, updatePosition]);

  // Outside pointerdown, Escape handler and scroll tracking
  useEffect(() => {
    if (!open || !isRendered) return;

    // The popover closes only when the user presses on the canvas stage. Everything else (its own
    // children, nested portal UIs such as dropdown lists, pickers and tooltips, other panels, and stage overlay controls) is not "outside".
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest) return;
      if (popRef.current?.contains(target)) return;
      if (target.closest('button, [role="button"], [data-testid*="overlay"], [data-testid*="handle"]')) return;
      if (!target.closest(STAGE_AREA)) return;
      onCloseRef.current();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // a nested popover (colour picker, dropdown list, menu) closes first; it handles its own Escape
        const nested = Array.from(
          document.querySelectorAll("[data-color-picker], [role='listbox'], [role='menu']")
        ).find((el) => !popRef.current?.contains(el) && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== "hidden");
        if (nested) return;
        e.stopPropagation();
        onCloseRef.current();
        const anchor = (anchorRef?.current ?? triggerRef?.current) as HTMLElement | null;
        anchor?.focus();
      }
    };

    const handleResize = () => {
      isImmediateCloseRef.current = true;
      onCloseRef.current();
    };

    const handleScroll = () => {
      const anchorNode = (anchorRef?.current ?? triggerRef?.current) as HTMLElement | null;
      if (!anchorNode) return;
      const scrollParent = anchorNode.closest(".ll-zbody") || document.querySelector(".ll-shell-right .ll-zbody");
      if (scrollParent) {
        const cRect = scrollParent.getBoundingClientRect();
        const aRect = anchorNode.getBoundingClientRect();
        if (aRect.bottom < cRect.top + 20 || aRect.top > cRect.bottom - 20) {
          onCloseRef.current();
          return;
        }
      }
      updatePosition();
    };

    const anchorNode = (anchorRef?.current ?? triggerRef?.current) as HTMLElement | null;
    const scrollParent = anchorNode?.closest(".ll-zbody") || document.querySelector(".ll-shell-right .ll-zbody");
    if (scrollParent) {
      scrollParent.addEventListener("scroll", handleScroll, { passive: true });
    }
    window.addEventListener("scroll", handleScroll, { passive: true });

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      if (scrollParent) {
        scrollParent.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, isRendered, anchorRef, triggerRef, updatePosition]);

  if (!mounted || !isRendered) return null;

  return createPortal(
    <div
      ref={popRef}
      role="group"
      aria-label={ariaLabel || `${title} options`}
      aria-labelledby={titleId}
      tabIndex={-1}
      style={open ? undefined : { pointerEvents: "none" }}
      className={`llm-pop ppop ll-ppop ll-open ll-optpop ll:fixed ll:z-60 ll:box-border ll:w-options-popover ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:text-primary ll:outline-none ll:flex ll:flex-col ll:overflow-hidden ${className}`}
    >
      <div className="ll:flex ll:flex-col ll:flex-1 ll:min-w-0 ll:min-h-0 ll:rounded-inherit ll:overflow-hidden">
        {/* Header (36px) */}
        <div
          ref={headerRef}
          className="phead ll-phead ll:box-border ll:flex ll:items-center ll:gap-2 ll:h-9 ll:pl-4 ll:pr-2 ll:border-b ll:border-border ll:shrink-0"
        >
          <span
            id={titleId}
            className="pt ll-pt ll:flex-1 ll:min-w-0 ll:text-micro ll:font-medium ll:text-muted ll:truncate"
          >
            {title.toLowerCase().endsWith("options") ? title : `${title} options`}
          </span>
          <IconButton
            size="sm"
            variant="ghost"
            onClick={onClose}
            aria-label="Close options"
            tooltip="Close options"
            icon={<Icon icon={X} size={14} />}
          />
        </div>

        {/* Body content with hairline fields styling */}
        <div
          ref={bodyRef}
          className="pbody ll-pbody ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:overscroll-contain ll:scrollbar-none ll:px-4 ll:pt-3 ll:pb-4 ll:flex ll:flex-col ll:gap-0 [&_.field]:ll:border [&_.field]:ll:border-border [&_.dfield]:ll:border [&_.dfield]:ll:border-border"
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
