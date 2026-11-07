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

  // Places the popover like the design: floating left of the right panel, top aligned to its row.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const row = anchorRef.current?.closest(".ll-rr");
      const zone = anchorRef.current?.closest(".ll-zbody") ?? row;
      const pop = popRef.current;
      if (!row || !zone || !pop) return;
      const r = row.getBoundingClientRect();
      const z = zone.getBoundingClientRect();
      const h = pop.offsetHeight;
      const w = pop.offsetWidth;
      pop.style.left = `${Math.max(8, z.left - w - 8)}px`;
      pop.style.top = `${Math.max(8, Math.min(r.top, window.innerHeight - 8 - h))}px`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
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
            className={`ppop ll:fixed ll:z-60 ll:flex ll:flex-col ll:box-border ll:w-62 ll:overflow-auto ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:text-primary ${className}`}
          >
            <div className="phead ll:flex ll:items-center ll:justify-between ll:gap-2 ll:pt-2 ll:pr-2 ll:pb-1 ll:pl-4">
              <span className="pt ll:text-body ll:font-medium ll:text-primary">{title}</span>
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
            <div className="pbody ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:pt-1 ll:pb-4">{children}</div>
          </div>,
          document.body
        )}
    </>
  );
};
