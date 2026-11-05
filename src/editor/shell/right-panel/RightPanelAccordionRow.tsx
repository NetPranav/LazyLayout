"use client";

import React, { useState, useId } from "react";
import { ChevronRight } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { RightPanelEmptyPlaceholder } from "./RightPanelEmptyPlaceholder";

export interface RightPanelAccordionRowProps {
  id?: string;
  label: string;
  value: string;
  isMuted?: boolean;
  defaultOpen?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const RightPanelAccordionRow: React.FC<RightPanelAccordionRowProps> = ({
  id: propId,
  label,
  value,
  isMuted,
  defaultOpen = false,
  children,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const autoId = useId();
  const rowId = propId ?? autoId;
  const contentId = `${autoId}-content`;

  const isValueMuted =
    isMuted ??
    (value === "none" ||
      value === "0" ||
      value === "0s" ||
      value === "Off" ||
      value === "not bound");

  return (
    <div
      data-row-id={rowId}
      className={`ll-prow ll:border-b ll:border-border ${className}`}
    >
      {/* Accordion header button */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((prev) => !prev)}
        className="ll-prow-h ll:flex ll:items-center ll:gap-2 ll:w-full ll:h-9 ll:px-4 ll:text-left ll:bg-transparent ll:border-0 ll:hover:bg-surface-bar ll:transition-none ll:cursor-pointer ll:select-none ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
      >
        <span className="ll-pl ll:w-20 ll:shrink-0 ll:text-muted ll:font-medium ll:text-small ll:truncate">
          {label}
        </span>

        <span
          className={`ll-pv ll:flex-1 ll:min-w-0 ll:flex ll:items-center ll:justify-end ll:gap-1.5 ll:font-mono ll:text-micro ll:truncate ${
            isValueMuted ? "ll:text-muted" : "ll:text-primary"
          }`}
        >
          {value}
        </span>

        <Icon
          icon={ChevronRight}
          size={14}
          className={`ll-car ll:text-muted ll:shrink-0 ll:transition-transform ll:duration-100 ll:motion-reduce:transition-none ${
            isOpen ? "ll:rotate-90" : ""
          }`}
        />
      </button>

      {/* Accordion content slot: element exists with contentId whether open or closed so aria-controls remains valid */}
      <div
        id={contentId}
        role="region"
        aria-label={label}
        hidden={!isOpen}
        className={`ll-sec ll:px-4 ll:pt-1 ll:pb-3.5 ll:flex ll:flex-col ll:gap-2 ${
          !isOpen ? "ll:hidden" : ""
        }`}
      >
        {children ? (
          children
        ) : (
          <RightPanelEmptyPlaceholder label={`${label}: ${value}`} />
        )}
      </div>
    </div>
  );
};
