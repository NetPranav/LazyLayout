"use client";

import React, { useState, useRef, useId } from "react";
import { Plus, Sliders } from "@/editor/components/ColorPickerIcons";
import { Icon } from "@/editor/components/Icon";
import { OptionsPopover } from "@/editor/components/OptionsPopover";

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
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const autoId = useId();
  const sectionId = propId ?? autoId;
  const bodyId = `${autoId}-body`;
  const moreId = `${autoId}-more`;

  const hasMore = Boolean(moreContent);

  // Alt+click on any field inside the section opens its section's OptionsPopover (matches prototype line 2468)
  const handleSectionClick = (e: React.MouseEvent<HTMLElement>) => {
    if (e.altKey && hasMore) {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-more]") &&
        !target.closest('.llm-pop, [role="group"][aria-label*="options"]')
      ) {
        e.preventDefault();
        e.stopPropagation();
        setIsPopoverOpen(true);
      }
    }
  };

  return (
    <section
      data-section-id={sectionId}
      onClick={handleSectionClick}
      className={`ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:first:border-t-0 ll:border-border ${className}`}
    >
      {/* Section Header */}
      <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6 ll:select-none">
        <h3 className="ll:text-small ll:font-medium ll:text-primary ll:truncate ll:m-0">
          {title}
        </h3>

        <div className="ll:flex-1" />

        {/* Section Actions: Sliders icon button for options, and Add button ("+") */}
        <div className="ll:flex ll:items-center ll:gap-1 ll:shrink-0">
          {headerAction}

          {hasMore && (
            <button
              ref={moreBtnRef}
              type="button"
              data-more
              aria-expanded={isPopoverOpen}
              aria-controls={moreId}
              aria-label={`${title} options`}
              title={`${title} options`}
              onClick={(e) => {
                e.stopPropagation();
                setIsPopoverOpen((prev) => !prev);
              }}
              className={`ll-ib ll-dic ll-more ll:w-6 ll:h-6 ll:inline-grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:cursor-pointer ll:bg-transparent ll:border-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ${
                isPopoverOpen ? "ll:bg-control-secondary-bg ll:text-primary" : ""
              } ${!onAdd ? "ll:-mr-1" : ""}`}
            >
              <Icon icon={Sliders} size={14} />
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

      {/* Section Content: always visible, generous spacing */}
      {children && (
        <div id={bodyId} className="ll-dbody ll:flex ll:flex-col ll:gap-2 ll:empty:hidden">
          {children}
        </div>
      )}

      {/* OptionsPopover: floats 8px left of inspector with extra fields, hairline fields */}
      {hasMore && (
        <OptionsPopover
          className="llm-pop"
          open={isPopoverOpen}
          title={title}
          anchorRef={moreBtnRef}
          onClose={() => setIsPopoverOpen(false)}
        >
          {moreContent}
        </OptionsPopover>
      )}
    </section>
  );
};
