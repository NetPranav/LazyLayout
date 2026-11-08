"use client";

import React, { useRef, useEffect, useState, useId, useCallback } from "react";
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
  CLOSE_DURATION,
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
    const rightZone = document.querySelector(".zone.right");
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

  // Open & Close animations with retargeting
  useEffect(() => {
    if (!isRendered) return;
    const pop = popRef.current;
    const anchor = (anchorRef?.current ?? triggerRef?.current) as HTMLElement | null;
    if (!pop) return;

    const reduced = prefersReducedMotion();
    const preset = getActivePreset();

    if (open) {
      updatePosition();

      const toRect = pop.getBoundingClientRect();
      const isAnchorSwitch =
        prevAnchorRef.current !== null &&
        prevAnchorRef.current !== anchor;
      const handoff = !isAnchorSwitch ? getFamilyHandoff("inspector-options", optionsUniqueId) : null;

      if (reduced) {
        pop.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: REDUCED_DURATION,
          easing: "ease-out",
          fill: "backwards",
        });
      } else if (isAnchorSwitch && prevAnchorRef.current) {
        const oldRect = prevAnchorRef.current.getBoundingClientRect();
        animateRetarget(pop, oldRect, toRect, bodyRef.current);
      } else if (handoff) {
        animateRetarget(pop, handoff, toRect, bodyRef.current);
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
          const directKids = Array.from(bodyEl.children) as HTMLElement[];
          childElements.push(...directKids.slice(0, 14));
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
          onClose();
        },
        rect: toRect,
        timestamp: performance.now(),
      });
    } else {
      prevAnchorRef.current = null;
      unregisterOverlay(optionsUniqueId);
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
  }, [open, isRendered, anchorRef, updatePosition]);

  // Outside pointerdown and Escape handler
  useEffect(() => {
    if (!open || !isRendered) return;

    const handlePointerDown = (e: PointerEvent) => {
      const pop = popRef.current;
      const anchor = anchorRef?.current ?? triggerRef?.current;
      const target = e.target as Node | null;

      if (pop && target && !pop.contains(target)) {
        if (anchor && anchor.contains(target)) return;
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        anchorRef?.current?.focus();
      }
    };

    const handleResize = () => {
      updatePosition();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, isRendered, onClose, anchorRef, updatePosition]);

  if (!mounted || !isRendered) return null;

  return createPortal(
    <div
      ref={popRef}
      role="group"
      aria-label={ariaLabel || `${title} options`}
      aria-labelledby={titleId}
      tabIndex={-1}
      className={`llm-pop ppop ll-ppop ${open ? "ll-open" : ""} ll:fixed ll:z-60 ll:w-options-popover ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:text-primary ll:outline-none ll:flex ll:flex-col ll:overflow-hidden ${className}`}
    >
      <div className="ll:flex ll:flex-col ll:flex-1 ll:min-w-0 ll:min-h-0 ll:rounded-inherit ll:overflow-hidden">
        {/* Header (36px) */}
        <div
          ref={headerRef}
          className="phead ll-phead ll:flex ll:items-center ll:gap-2 ll:h-9 ll:pl-4 ll:pr-2 ll:border-b ll:border-border ll:shrink-0"
        >
          <span
            id={titleId}
            className="pt ll-pt ll:flex-1 ll:min-w-0 ll:text-micro ll:font-medium ll:text-muted ll:truncate"
          >
            {title} options
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
