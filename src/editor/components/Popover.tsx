"use client";

import React, { useRef, useEffect, useState, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { surf, type Surf } from "../motion/surface";
import { MOT, MENU_FALLBACKS } from "../motion/presets";
import { prefersReducedMotion } from "../motion/feel";
import { defaultHost } from "../motion/loop";
import { IconButton } from "./IconButton";
import { Icon } from "./Icon";
import { useMounted } from "./useMounted";
import {
  registerOverlay,
  unregisterOverlay,
  getFamilyHandoff,
  animateRetarget,
  type OverlayFamily,
} from "./retarget";

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
  anchorRef?: React.RefObject<HTMLElement | null>;
  title?: string;
  width?: number | string;
  side?: "bottom" | "left" | "right" | "top";
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
  family?: OverlayFamily;
}

export const Popover: React.FC<PopoverProps> = ({
  open,
  onClose,
  anchorEl,
  anchorRef,
  title,
  width = MENU_FALLBACKS.menuWidthContext,
  side = "bottom",
  children,
  className = "",
  "aria-label": ariaLabel,
  family = "menu",
}) => {
  const mounted = useMounted();
  const popRef = useRef<HTMLDivElement>(null);
  const layRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<Surf | null>(null);
  const prevActiveElementRef = useRef<HTMLElement | null>(null);
  const prevAnchorRef = useRef<HTMLElement | null>(null);
  const isImmediateCloseRef = useRef(false);
  const titleId = useId();
  const popoverUniqueId = useId();

  const [isRendered, setIsRendered] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsRendered(true);
    }
  }

  // Initialize Surf instance
  useEffect(() => {
    if (!isRendered || !popRef.current) return;
    const popEl = popRef.current;
    const s = surf(popEl);
    surfRef.current = s;

    return () => {
      s.reset();
      unregisterOverlay(popoverUniqueId);
    };
  }, [isRendered, popoverUniqueId]);

  // Open & Close with Surf physics & retargeting
  useEffect(() => {
    if (!isRendered) return;
    const s = surfRef.current;
    const popEl = popRef.current;
    if (!s || !popEl) return;

    const targetAnchor = (anchorRef?.current ?? anchorEl) as HTMLElement | null;

    if (open) {
      prevActiveElementRef.current = document.activeElement as HTMLElement | null;
      const pad =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--ll-spacing-2"
          )
        ) || MENU_FALLBACKS.viewportPadding;
      const gap =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--ll-submenu-gap"
          )
        ) || MENU_FALLBACKS.edgeGap;

      let left = pad;
      let top = pad;
      let seed: { w: number; h: number; r: number } = { ...MENU_FALLBACKS.seedDefault, r: MENU_FALLBACKS.popoverRadius };

      const m = s.measure();
      const popW =
        m.w ||
        (typeof width === "number" ? width : MENU_FALLBACKS.menuWidthContext);
      const popH =
        m.h || (layRef.current?.offsetHeight ?? MENU_FALLBACKS.defaultMenuHeight);

      if (targetAnchor) {
        const r = targetAnchor.getBoundingClientRect();
        seed = {
          w: Math.round(r.width),
          h: Math.round(r.height),
          r:
            parseFloat(getComputedStyle(targetAnchor).borderRadius) ||
            MENU_FALLBACKS.menuRadius,
        };

        if (side === "left") {
          left = r.left - popW - pad;
          top = r.top;
        } else if (side === "right") {
          left = r.right + pad;
          top = r.top;
        } else if (side === "top") {
          left = r.left;
          top = r.top - popH - gap;
        } else {
          // bottom
          left = Math.max(pad, Math.min(r.left, window.innerWidth - popW - pad));
          top = r.bottom + gap;
        }

        left = Math.max(pad, Math.min(left, window.innerWidth - popW - pad));
        top = Math.max(pad, Math.min(top, window.innerHeight - popH - pad));
      }

      const toRect = new DOMRect(left, top, popW, popH);
      const isAnchorSwitch =
        prevAnchorRef.current !== null &&
        prevAnchorRef.current !== targetAnchor &&
        s.live();
      const handoff = !isAnchorSwitch ? getFamilyHandoff(family, popoverUniqueId) : null;

      popEl.style.left = `${left}px`;
      popEl.style.top = `${top}px`;

      if (isAnchorSwitch) {
        const oldRect = popEl.getBoundingClientRect();
        animateRetarget(popEl, oldRect, toRect, layRef.current);
      } else if (handoff) {
        animateRetarget(popEl, handoff, toRect, layRef.current);
      } else {
        const y0 = targetAnchor ? targetAnchor.getBoundingClientRect().top - top : 0;
        s.open({
          from: seed,
          y0,
          up: side === "top",
          right: side === "left",
        });
      }

      prevAnchorRef.current = targetAnchor;
      registerOverlay({
        id: popoverUniqueId,
        family,
        element: popEl,
        anchor: targetAnchor,
        close: (immediate) => {
          if (immediate) isImmediateCloseRef.current = true;
          onClose();
        },
        rect: toRect,
        timestamp: performance.now(),
      });

      const unreg = defaultHost.register(() => {
        unreg();
        popEl.focus();
      });
    } else {
      prevAnchorRef.current = null;
      unregisterOverlay(popoverUniqueId);
      if (isImmediateCloseRef.current) {
        isImmediateCloseRef.current = false;
        setIsRendered(false);
        return;
      }
      s.leave();
      const exitDuration = prefersReducedMotion() ? MENU_FALLBACKS.reducedMotionDuration : MOT.exitDelay + MOT.exitMs;
      const t = setTimeout(() => {
        // Focus goes back only if nothing else has taken it during the fade: otherwise a closing menu would pull it
        // out of whatever came next (a text being edited closes itself, a colour picker stops hearing Escape).
        const active = document.activeElement;
        const untaken = !active || active === document.body || popEl.contains(active);
        setIsRendered(false);
        if (untaken && prevActiveElementRef.current && document.contains(prevActiveElementRef.current)) {
          prevActiveElementRef.current.focus();
        }
      }, exitDuration);
      return () => clearTimeout(t);
    }
  }, [open, isRendered, anchorEl, anchorRef, side, width, family, popoverUniqueId, onClose]);

  // Outside click & Escape handler
  useEffect(() => {
    if (!open || !isRendered) return;

    const targetAnchor = anchorRef?.current ?? anchorEl;

    const handlePointerDownOutside = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        if (targetAnchor && targetAnchor.contains(e.target as Node)) return;
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        targetAnchor?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isRendered, onClose, anchorEl, anchorRef]);

  if (!mounted || !isRendered) return null;

  const widthStyle = typeof width === "number" ? `${width}px` : width;

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={title ? titleId : undefined}
      aria-label={ariaLabel}
      tabIndex={-1}
      className={`ll-ppop ll-menu ll:fixed ll:z-50 ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:outline-none ${className}`}
      style={{ width: widthStyle }}
    >
      <div ref={layRef} className="ll-lay">
        {title && (
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2 ll:px-3 ll:h-9 ll:border-b ll:border-border ll:select-none">
            <span id={titleId} className="ll:text-small ll:font-medium ll:text-primary ll:truncate">
              {title}
            </span>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="Close"
              onClick={onClose}
              icon={<Icon icon={X} size={14} />}
            />
          </div>
        )}
        <div className="ll:p-3 ll:text-body">{children}</div>
      </div>
    </div>,
    document.body
  );
};
