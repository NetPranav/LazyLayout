"use client";

import React, { useState, useId } from "react";
import { Plus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";

export interface RightPanelSectionProps {
  id?: string;
  title: string;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  defaultOpen?: boolean;
  collapsible?: boolean;
  onAdd?: () => void;
  moreContent?: React.ReactNode;
  headerAction?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const RightPanelSection: React.FC<RightPanelSectionProps> = ({
  id: propId,
  title,
  isOpen: _controlledOpen,
  onToggleOpen: _onToggleOpen,
  defaultOpen: _defaultOpen = true,
  collapsible: _collapsible = false,
  onAdd,
  moreContent,
  headerAction,
  children,
  className = "",
}) => {
  const [showMore, setShowMore] = useState(false);
  const autoId = useId();
  const sectionId = propId ?? autoId;
  const bodyId = `${autoId}-body`;
  const moreId = `${autoId}-more`;

  const hasMore = Boolean(moreContent);

  return (
    <section
      data-section-id={sectionId}
      className={`ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:[&:not(:first-child)]:border-t ll:border-border ${className}`}
    >
      {/* Section Header */}
      <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6 ll:select-none">
        <h3 className="ll:text-small ll:font-medium ll:text-primary ll:truncate ll:m-0">
          {title}
        </h3>

        <div className="ll:flex-1" />

        {/* Section Actions: More button ("...") and Add button ("+") */}
        <div className="ll:flex ll:items-center ll:gap-1 ll:shrink-0">
          {headerAction}

          {hasMore && (
            <button
              type="button"
              aria-expanded={showMore}
              aria-controls={moreId}
              aria-label={`More ${title} options`}
              title="More options"
              onClick={() => setShowMore((prev) => !prev)}
              className={`ll-ib ll-more ll:w-6 ll:h-6 ll:inline-grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:text-xs ll:font-mono ll:cursor-pointer ll:bg-transparent ll:border-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ${
                showMore ? "ll:bg-control-secondary-bg ll:text-primary" : ""
              } ${!onAdd ? "ll:-mr-1.25" : ""}`}
            >
              ...
            </button>
          )}

          {onAdd && (
            <button
              type="button"
              aria-label={`Add ${title.toLowerCase()}`}
              title="Add"
              onClick={onAdd}
              className="ll-ib ll:w-6 ll:h-6 ll:inline-grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:cursor-pointer ll:bg-transparent ll:border-0 ll:-mr-1.25 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors"
            >
              <Icon icon={Plus} size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Section Content: always visible, generous spacing, no dashed placeholders */}
      {children && (
        <div id={bodyId} className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {children}
        </div>
      )}

      {/* Expandable Advanced Options Drawer */}
      {showMore && moreContent && (
        <div
          id={moreId}
          className="ll-dmore ll:flex ll:flex-col ll:gap-2 ll:pt-3 ll:mt-1 ll:border-t ll:border-border ll:animate-in ll:fade-in ll:slide-in-from-top-1 ll:duration-120 ll:motion-reduce:animate-none"
        >
          {moreContent}
        </div>
      )}
    </section>
  );
};
