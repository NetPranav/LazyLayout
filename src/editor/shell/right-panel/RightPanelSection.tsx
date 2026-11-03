"use client";

import React, { useState, useId } from "react";
import { ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { RightPanelEmptyPlaceholder } from "./RightPanelEmptyPlaceholder";

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
  isOpen: controlledOpen,
  onToggleOpen,
  defaultOpen = true,
  collapsible = true,
  onAdd,
  moreContent,
  headerAction,
  children,
  className = "",
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [showMore, setShowMore] = useState(false);
  const autoId = useId();
  const sectionId = propId ?? autoId;
  const bodyId = `${autoId}-body`;

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const handleToggle = () => {
    if (!collapsible) return;
    if (isControlled) {
      onToggleOpen?.();
    } else {
      setUncontrolledOpen((prev) => !prev);
    }
  };

  return (
    <section
      data-section-id={sectionId}
      className={`ll-dsec ll:flex ll:flex-col ll:border-b ll:border-border ll:py-2 ${className}`}
    >
      {/* Section Header */}
      <div className="ll-dtitle ll:flex ll:items-center ll:justify-between ll:px-4 ll:h-8 ll:select-none">
        <button
          type="button"
          aria-expanded={collapsible ? isOpen : undefined}
          aria-controls={collapsible ? bodyId : undefined}
          disabled={!collapsible}
          onClick={handleToggle}
          className={`ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0 ll:text-left ll:bg-transparent ll:border-0 ll:p-1 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ll:rounded-sm ${
            collapsible ? "ll:cursor-pointer" : "ll:cursor-default"
          }`}
        >
          {collapsible && (
            <Icon
              icon={ChevronRight}
              size={14}
              className={`ll:text-muted ll:shrink-0 ll:transition-transform ll:duration-100 ll:motion-reduce:transition-none ${
                isOpen ? "ll:rotate-90" : ""
              }`}
            />
          )}
          <h3 className="ll:text-small ll:font-medium ll:text-primary ll:truncate ll:m-0">
            {title}
          </h3>
        </button>

        {/* Section Actions */}
        <div className="ll:flex ll:items-center ll:gap-0.5 ll:shrink-0">
          {headerAction}

          {moreContent && (
            <IconButton
              size="sm"
              pressed={showMore}
              aria-label={`More ${title} options`}
              title="More options"
              icon={<Icon icon={MoreHorizontal} size={14} />}
              onClick={() => setShowMore((prev) => !prev)}
            />
          )}

          {onAdd && (
            <IconButton
              size="sm"
              aria-label={`Add ${title.toLowerCase()}`}
              title="Add"
              icon={<Icon icon={Plus} size={14} />}
              onClick={onAdd}
            />
          )}
        </div>
      </div>

      {/* Section Content: region exists with bodyId whether open or closed so aria-controls remains valid */}
      <div
        id={bodyId}
        role="region"
        aria-label={title}
        hidden={!isOpen}
        className={`ll-dbody ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:pt-1.5 ll:pb-1 ${
          !isOpen ? "ll:hidden" : ""
        }`}
      >
        {children ? (
          children
        ) : (
          <RightPanelEmptyPlaceholder label={`Configure ${title.toLowerCase()}`} />
        )}

        {/* More options collapsible drawer */}
        {showMore && moreContent && (
          <div className="ll-dmore ll:flex ll:flex-col ll:gap-2 ll:pt-2 ll:mt-1 ll:border-t ll:border-border">
            {moreContent}
          </div>
        )}
      </div>
    </section>
  );
};
