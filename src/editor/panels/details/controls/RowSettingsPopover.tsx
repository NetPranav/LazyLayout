"use client";

import React, { useMemo, useRef } from "react";
import { OptionsPopover } from "@/editor/components/OptionsPopover";

export interface RowSettingsPopoverProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * A row's settings popover (Fill, Stroke, Effects). It is the shared OptionsPopover anchored to the row's
 * sliders button, so it opens, closes and slides between anchors with the same springs as every other options popover.
 */
export const RowSettingsPopover: React.FC<RowSettingsPopoverProps> = ({
  title,
  isOpen,
  onClose,
  children,
  className = "",
}) => {
  const markerRef = useRef<HTMLSpanElement>(null);

  // The trigger is the row's own sliders button; the hidden marker sits in the same row.
  const triggerRef = useMemo<React.RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        const row = markerRef.current?.closest(".ll-rr") ?? markerRef.current?.parentElement;
        return (row?.querySelector('[aria-haspopup="dialog"]') as HTMLElement | null) ?? null;
      },
    }),
    [],
  );

  return (
    <>
      <span ref={markerRef} aria-hidden="true" className="ll:hidden" />
      <OptionsPopover
        open={isOpen}
        title={title}
        aria-label={`${title} settings`}
        triggerRef={triggerRef}
        onClose={onClose}
        className={`ll-rowpop ${className}`}
      >
        {children}
      </OptionsPopover>
    </>
  );
};
