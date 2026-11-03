"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/editor/components/IconButton";
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={`${title} settings`}
      className={`ppop ll:flex ll:flex-col ll:w-full ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:p-3 ll:gap-2.5 ll:my-1.5 ll:transition-all ${className}`}
    >
      {/* Popover Header */}
      <div className="phead ll:flex ll:items-center ll:justify-between ll:gap-2 ll:pb-1 ll:border-b ll:border-border">
        <span className="pt ll:text-small ll:font-medium ll:text-primary">
          {title}
        </span>
        <IconButton
          size="sm"
          aria-label="Close settings"
          tooltip="Close"
          onClick={onClose}
          icon={<Icon icon={X} size={14} />}
        />
      </div>

      {/* Popover Body */}
      <div className="pbody ll:flex ll:flex-col ll:gap-2.5 ll:pt-1">
        {children}
      </div>
    </div>
  );
};
