"use client";

import React, { useRef, useEffect, useState, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { surf, type Surf } from "../motion/surface";
import { prefersReducedMotion } from "../motion/feel";
import { defaultHost } from "../motion/loop";
import { IconButton } from "./IconButton";
import { Icon } from "./Icon";
import { useMounted } from "./useMounted";

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
}

export const Popover: React.FC<PopoverProps> = ({
  open,
  onClose,
  anchorEl,
  anchorRef,
  title,
  width = 248,
  side = "bottom",
  children,
  className = "",
  "aria-label": ariaLabel,
}) => {
  const mounted = useMounted();
  const popRef = useRef<HTMLDivElement>(null);
  const layRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<Surf | null>(null);
  const prevActiveElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

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
    };
}, [isRendered]);

// Open & Close with Surf physics
useEffect(() => {
  if (!isRendered) return;
  const s = surfRef.current;
  const popEl = popRef.current;
  if (!s || !popEl) return;

  const targetAnchor = anchorRef?.current ?? anchorEl;

  if (open) {
    prevActiveElementRef.current = document.activeElement as HTMLElement | null;
    let left = 8;
    let top = 8;
    let seed = { w: 32, h: 32, r: 8 };

    if (targetAnchor) {
      const r = targetAnchor.getBoundingClientRect();
      seed = {
        w: Math.round(r.width),
        h: Math.round(r.height),
        r: parseFloat(getComputedStyle(targetAnchor).borderRadius) || 6,
      };

      const popW = typeof width === "number" ? width : 248;
      if (side === "left") {
        left = r.left - popW - 8;
        top = r.top;
      } else if (side === "right") {
        left = r.right + 8;
        top = r.top;
      } else if (side === "top") {
        left = r.left;
        top = r.top - 280;
      } else {
        // bottom
        left = Math.max(8, Math.min(r.left, window.innerWidth - popW - 8));
        top = r.bottom + 4;
      }

      left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));
      top = Math.max(8, Math.min(top, window.innerHeight - 320));
    }

    popEl.style.left = `${left}px`;
    popEl.style.top = `${top}px`;

    s.open({
      from: seed,
      right: side === "left",
    });

    const unreg = defaultHost.register(() => {
      unreg();
      popEl.focus();
    });
  } else {
    s.leave();
    const exitDuration = prefersReducedMotion() ? 120 : 160;
    const t = setTimeout(() => {
      setIsRendered(false);
      if (prevActiveElementRef.current && document.contains(prevActiveElementRef.current)) {
        prevActiveElementRef.current.focus();
      }
    }, exitDuration);
    return () => clearTimeout(t);
  }
  }, [open, isRendered, anchorEl, anchorRef, side, width]);

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
    aria-modal="true"
    aria-labelledby={title ? titleId : undefined}
    aria-label={ariaLabel}
    tabIndex={-1}
    style={{ width: widthStyle }}
    className={`ppop ll:fixed ll:z-60 ll:flex ll:flex-col ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:overflow-hidden ll:outline-none ll:font-sans ${className}`}
  >
    <div ref={layRef} className="ll-lay ll:flex ll:flex-col ll:flex-none">
      {title && (
        <div className="ll:flex ll:items-center ll:justify-between ll:px-3 ll:h-9 ll:border-b ll:border-border ll:shrink-0">
            <span id={titleId} className="ll:text-small ll:font-medium ll:text-primary ll:font-sans">
              {title}
            </span>
            <IconButton
              aria-label="Close"
              size="sm"
              icon={<Icon icon={X} size={14} />}
              onClick={onClose}
            />
        </div>
      )}

        <div className="ll:p-3 ll:flex ll:flex-col ll:gap-2.5 ll:max-h-popover ll:overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
    );
};
