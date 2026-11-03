"use client";

import React, { useState } from "react";
import { ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { IconButton } from "./IconButton";
import { Icon } from "./Icon";

export interface PanelSectionProps {
  title: string;
  defaultOpen?: boolean;
  collapsible?: boolean;
  onAdd?: () => void;
  moreContent?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export const PanelSection: React.FC<PanelSectionProps> = ({
  title,
  defaultOpen = true,
  collapsible = true,
  onAdd,
  moreContent,
  children,
  className = "",
  headerAction,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showMore, setShowMore] = useState(false);

  return (
    <section className={`ll:flex ll:flex-col ll:border-b ll:border-border ll:py-2 ${className}`}>
      {/* Header bar */}
      <div className="ll:flex ll:items-center ll:justify-between ll:px-3 ll:h-8 ll:select-none">
        <div
          role={collapsible ? "button" : undefined}
          tabIndex={collapsible ? 0 : undefined}
          onClick={() => collapsible && setIsOpen((prev) => !prev)}
          onKeyDown={(e) => {
            if (collapsible && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              setIsOpen((prev) => !prev);
            }
          }}
          className={`ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0 ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ll:rounded-sm`}
        >
          {collapsible && (
            <Icon
              icon={ChevronRight}
              size={14}
              className={`ll:text-muted ll:transition-transform ll:duration-120 ${
                isOpen ? "ll:rotate-90" : ""
              }`}
            />
          )}
          <span className="ll:text-small ll:font-medium ll:text-primary ll:truncate">
            {title}
          </span>
        </div>

        {/* Actions group */}
        <div className="ll:flex ll:items-center ll:gap-0.5 ll:shrink-0">
          {headerAction}

          {moreContent && (
            <IconButton
              size="sm"
              pressed={showMore}
              aria-label={`Toggle advanced ${title} options`}
              icon={<Icon icon={MoreHorizontal} size={14} />}
              onClick={() => setShowMore((prev) => !prev)}
            />
          )}

          {onAdd && (
            <IconButton
              size="sm"
              aria-label={`Add ${title}`}
              icon={<Icon icon={Plus} size={14} />}
              onClick={onAdd}
            />
          )}
        </div>
      </div>

      {/* Main section body */}
      {isOpen && (
        <div className="ll:flex ll:flex-col ll:gap-2 ll:px-3 ll:pt-1.5">
          {children}

          {/* Advanced more options block */}
          {showMore && moreContent && (
            <div className="ll:flex ll:flex-col ll:gap-2 ll:pt-2 ll:mt-1 ll:border-t ll:border-border ll:animate-in ll:fade-in ll:slide-in-from-top-1 ll:duration-120">
              {moreContent}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

