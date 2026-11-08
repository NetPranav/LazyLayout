"use client";

import React, { useRef, useState, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { surf, pressEl, type Surf } from "../motion/surface";
import { flipCard } from "../motion/flip";
import { prefersReducedMotion } from "../motion/feel";
import { Icon } from "./Icon";
import { useMounted } from "./useMounted";
import {
  registerOverlay,
  unregisterOverlay,
  getFamilyHandoff,
  animateRetarget,
} from "./retarget";
import {
  SHIP_POPOVER_WIDTH,
  VIEWPORT_EDGE_PAD,
  TRIGGER_GAP_Y,
  RADIUS_MD,
  POPUP_LEAVE_DURATION_MS,
  POPUP_LEAVE_REDUCED_DURATION_MS,
  MENU_ICON_SIZE,
  DEFAULT_SHIP_ISSUES,
  PREVIEW_DISABLED_REASON,
} from "./topbar-constants";

export interface ShipIssue {
  id: string;
  title: string;
}

export interface ShipPopoverProps {
  issues?: readonly ShipIssue[];
  ready?: boolean;
  onFixIssue?: (id: string) => void;
  onPreview?: () => void;
  onShare?: () => void;
  onPublish?: () => void;
  className?: string;
  disabled?: boolean;
  dataState?: "hover" | "focus";
}

export const ShipPopover: React.FC<ShipPopoverProps> = ({
  issues = DEFAULT_SHIP_ISSUES,
  ready,
  onFixIssue,
  onPreview,
  onShare,
  onPublish,
  className = "",
  disabled = false,
  dataState,
}) => {
  const mounted = useMounted();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const layRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<Surf | null>(null);
  const popoverId = useId();

  const isReady = ready !== undefined ? ready : issues.length === 0;
  const issueCount = issues.length;

  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

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

  const openPopover = useCallback(() => {
    if (disabled) return;
    setIsRendered(true);
    setIsOpen(true);
  }, [disabled]);

  const closePopover = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Handle open/close surf physics
  useEffect(() => {
    if (!isRendered) return;
    const s = surfRef.current;
    const popEl = popRef.current;
    const triggerEl = triggerRef.current;
    if (!s || !popEl || !triggerEl) return;

    if (isOpen) {
      const r = triggerEl.getBoundingClientRect();
      const popW = SHIP_POPOVER_WIDTH;
      const pad = VIEWPORT_EDGE_PAD;

      const left = Math.max(pad, Math.min(r.right - popW, window.innerWidth - popW - pad));
      const top = r.bottom + TRIGGER_GAP_Y;
      const popH = popEl.offsetHeight || 340;
      const toRect = new DOMRect(left, top, popW, popH);
      const handoff = getFamilyHandoff("ship", popoverId) || getFamilyHandoff("menu", popoverId);

      popEl.style.left = `${left}px`;
      popEl.style.top = `${top}px`;

      if (handoff) {
        animateRetarget(popEl, handoff, toRect, layRef.current);
      } else {
        s.open({
          from: {
            w: Math.round(r.width),
            h: Math.round(r.height),
            r: RADIUS_MD,
          },
          y0: -(r.height + TRIGGER_GAP_Y),
          right: true,
        });
      }

      registerOverlay({
        id: popoverId,
        family: "ship",
        element: popEl,
        anchor: triggerEl,
        close: closePopover,
        rect: toRect,
        timestamp: performance.now(),
      });
    } else {
      unregisterOverlay(popoverId);
      s.leave();
      const duration = prefersReducedMotion()
        ? POPUP_LEAVE_REDUCED_DURATION_MS
        : POPUP_LEAVE_DURATION_MS;
      const t = setTimeout(() => {
        setIsRendered(false);
      }, duration);
      return () => clearTimeout(t);
    }
  }, [closePopover, isOpen, isRendered, popoverId]);

  // Focus the first control in the dialog when it opens (Item 9)
  useEffect(() => {
    if (isOpen && isRendered && popRef.current) {
      const firstControl = popRef.current.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstControl?.focus();
    }
  }, [isOpen, isRendered]);

  // Outside click and Escape handler
  useEffect(() => {
    if (!isOpen || !isRendered) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closePopover();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closePopover();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isRendered, closePopover]);

  const handleFix = useCallback(
    (id: string) => {
      if (listRef.current) {
        flipCard(listRef.current, () => {
          onFixIssue?.(id);
        });
      } else {
        onFixIssue?.(id);
      }
    },
    [onFixIssue]
  );

  const handlePointerDown = () => {
    if (!disabled && triggerRef.current) {
      pressEl(triggerRef.current, true);
    }
  };

  const handlePointerUp = () => {
    if (!disabled && triggerRef.current) {
      pressEl(triggerRef.current, false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id="shipbtn"
        disabled={disabled}
        onClick={() => (isOpen ? closePopover() : openPopover())}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        data-state={dataState}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        aria-label={isReady ? "Ship, ready" : `Ship, ${issueCount} to fix`}
        className={`ship ll-ship ${
          isReady ? "ready ll-ready" : ""
        } ll:inline-flex ll:items-center ll:gap-2 ll:h-8 ll:px-3 ll:rounded-md ll:border-0 ll:font-sans ll:text-body ll:font-medium ll:cursor-pointer ll:select-none ll:shrink-0 ll:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary ${
          isReady
            ? "ll:bg-control-primary ll:text-control-primary-fg"
            : "ll:bg-ship-bg ll:text-ship-fg"
        } ${dataState === "hover" ? "ll:opacity-90 " : ""}${
          dataState === "focus" ? "ll:ring-2 ll:ring-primary " : ""
        }${disabled ? "ll:opacity-disabled ll:cursor-not-allowed" : ""} ${className}`}
      >
        <span>Ship</span>

        <span id="shipc" className="shipc ll-shipc ll:font-sans ll:text-body ll:font-medium ll:tabular-nums">
          {isReady ? "Ready" : issueCount}
        </span>

        <Icon
          icon={ChevronDown}
          size={MENU_ICON_SIZE}
          className="ll-chevron-flip ll:shrink-0"
        />
      </button>

      {mounted &&
        isRendered &&
        createPortal(
          <div
            ref={popRef}
            id={popoverId}
            role="menu"
            aria-label="Ship"
            tabIndex={-1}
            className="ll-ppop ll-menu ll:fixed ll:z-50 ll:w-menu-wide ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:overflow-hidden ll:outline-none ll:font-sans"
          >
            <div ref={layRef} className="ll-lay ll:flex ll:flex-col ll:gap-0">
              {/* Issue rows */}
              <div ref={listRef} className="ll:flex ll:flex-col">
                {issues.length > 0 ? (
                  issues.map((issue) => (
                    <div
                      key={issue.id}
                      className="srow ll-srow ll:flex ll:items-center ll:gap-2 ll:min-h-9 ll:px-3 ll:text-body ll:text-primary ll:border-t ll:border-border ll:first:border-t-0"
                    >
                      <span className="ll:flex-1 ll:min-w-0">{issue.title}</span>
                      <button
                        type="button"
                        onClick={() => handleFix(issue.id)}
                        aria-label={`Fix: ${issue.title}`}
                        className="mini ll-mini ll:h-6 ll:px-2.5 ll:rounded-sm ll:border ll:border-border ll:text-micro ll:font-medium ll:text-primary ll:bg-transparent ll:hover:bg-surface-panel ll:cursor-pointer ll:shrink-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
                      >
                        Fix
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="srow muted ll-srow ll-muted ll:flex ll:items-center ll:min-h-9 ll:px-3 ll:text-body ll:text-muted">
                    No issues left
                  </div>
                )}
              </div>

              <div role="separator" className="hl ll:h-px ll:bg-border ll:my-1 ll:shrink-0" />

              {/* Action items */}
              <button
                type="button"
                role="menuitem"
                aria-disabled={!onPreview}
                title={onPreview ? undefined : PREVIEW_DISABLED_REASON}
                onClick={() => {
                  if (!onPreview) return;
                  onPreview();
                  closePopover();
                }}
                className={`ll:flex ll:items-center ll:w-full ll:h-8 ll:px-3 ll:text-body ll:text-left ll:outline-none ${onPreview ? "ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer" : "ll:text-muted ll:opacity-disabled ll:cursor-not-allowed"} ll:border-0 ll:bg-transparent ll:focus-visible:bg-surface-hover`}
              >
                Preview link
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onShare?.();
                  closePopover();
                }}
                className="ll:flex ll:items-center ll:w-full ll:h-8 ll:px-3 ll:text-body ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover ll:text-left ll:cursor-pointer ll:outline-none ll:border-0 ll:bg-transparent ll:focus-visible:bg-surface-hover"
              >
                Share
              </button>

              {/* Publish row */}
              <div className="pubrow ll-pubrow ll:px-3 ll:pt-2 ll:pb-3">
                <button
                  type="button"
                  disabled={issues.length > 0}
                  onClick={() => {
                    onPublish?.();
                    closePopover();
                  }}
                  className="btn strong wfull ll-btn ll-strong ll-wfull ll:w-full ll:h-8 ll:flex ll:items-center ll:justify-center ll:rounded-md ll:border ll:border-primary ll:bg-control-primary ll:text-control-primary-fg ll:text-body ll:font-medium ll:cursor-pointer ll:disabled:cursor-not-allowed ll:disabled:opacity-40 ll:disabled:border-border ll:disabled:bg-surface-canvas ll:disabled:text-muted ll:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary"
                >
                  Publish
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
