"use client";

import React, { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Icon } from "@/editor/components/Icon";

export interface RowSettingsPopoverProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export const RowSettingsPopover: React.FC<RowSettingsPopoverProps> = ({
  title,
  isOpen,
  onClose,
  children,
  className = "",
}) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Places the popover like the design: floating 8px left of the right panel, top aligned to its row.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const findRightPanel = () => {
      return (
        document.querySelector(".zone.right") ||
        document.querySelector("[data-testid='right-panel']") ||
        document.querySelector(".ll-shell-right") ||
        anchorRef.current?.closest("aside")
      ) as HTMLElement | null;
    };

    const place = () => {
      const row = anchorRef.current?.closest(".ll-rr") as HTMLElement | null;
      const zone = findRightPanel();
      const pop = popRef.current;
      if (!pop) return;

      const rightPanelRect = zone?.getBoundingClientRect();
      const rowRect = row?.getBoundingClientRect();

      const h = pop.offsetHeight || 280;
      const w = pop.offsetWidth || 280;

      // Position horizontally: 8px to the left of the right panel
      const targetLeft = rightPanelRect ? rightPanelRect.left - w - 8 : window.innerWidth - 320 - w - 8;
      const left = Math.max(8, Math.min(targetLeft, window.innerWidth - w - 8));

      // Position vertically: align with row top, clamped inside viewport
      const anchorTop = rowRect ? rowRect.top : window.innerHeight / 2 - h / 2;
      const top = Math.max(8, Math.min(anchorTop, window.innerHeight - h - 8));

      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
    };

    place();
    window.addEventListener("resize", place);
    const scrollContainer = document.querySelector(".ll-zbody") || window;
    scrollContainer.addEventListener("scroll", place, { passive: true });

    return () => {
      window.removeEventListener("resize", place);
      scrollContainer.removeEventListener("scroll", place);
    };
  }, [isOpen, children]);

  // Escape and outside pointer-down close the popover. Clicks on the owning row keep their own toggle.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      // a dropdown opened from inside the popover draws its list outside it: choosing there is not "outside"
      if ((target as Element).closest?.('[role="listbox"], [role="menu"], [data-color-picker]')) return;
      if (anchorRef.current?.closest(".ll-rr")?.contains(target)) return;
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onClose]);

  return (
    <>
      <span ref={anchorRef} aria-hidden="true" className="ll:hidden" />
      {isOpen &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={`${title} settings`}
            style={{ left: -9999, top: -9999 }}
            className={`ppop ll-ppop llm-pop ${isOpen ? "ll-open" : ""} ll:fixed ll:z-60 ll:flex ll:flex-col ll:box-border ll:w-70 ll:overflow-hidden ll:bg-surface-float ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:text-primary ${className}`}
          >
            <div className="phead ll-phead ll:flex ll:items-center ll:justify-between ll:gap-2 ll:h-9 ll:pl-4 ll:pr-2 ll:border-b ll:border-border ll:shrink-0">
              <span className="pt ll-pt ll:text-micro ll:font-medium ll:text-muted ll:truncate">{title}</span>
              <button
                type="button"
                aria-label="Close settings"
                title="Close"
                onClick={onClose}
                className="ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
              >
                <Icon icon={X} size={14} />
              </button>
            </div>
            <div className="pbody ll-pbody ll:flex ll:flex-col ll:gap-0 ll:px-4 ll:pt-3 ll:pb-4 ll:overflow-y-auto ll:overscroll-contain ll:scrollbar-none [&_.field]:ll:border [&_.field]:ll:border-border [&_.dfield]:ll:border [&_.dfield]:ll:border-border">{children}</div>
          </div>,
          document.body
        )}
    </>
  );
};
