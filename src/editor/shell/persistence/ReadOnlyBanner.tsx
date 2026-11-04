"use client";

import React from "react";
import { Lock } from "lucide-react";
import { useProjectLockStore } from "@/core/store/useProjectLockStore";
import { Button } from "@/editor/components/Button";
import { Icon } from "@/editor/components/Icon";

export interface ReadOnlyBannerProps {
  forced?: boolean;
  onTakeOver?: () => void;
  className?: string;
}

/** Shown while another tab has this project: this tab can look, not change. */
export const ReadOnlyBanner: React.FC<ReadOnlyBannerProps> = ({
  forced = false,
  onTakeOver,
  className = "",
}) => {
  const { state, takeOver } = useProjectLockStore();
  if (!forced && state !== "readonly") return null;

  const handleTakeOver = () => {
    if (onTakeOver) {
      onTakeOver();
    } else {
      takeOver?.();
    }
  };

  return (
    <div
      role="status"
      data-testid="readonly-banner"
      className={`read-only-banner ll:w-full ll:bg-surface-bar ll:border-b ll:border-border ll:px-4 ll:py-2 ll:flex ll:items-center ll:justify-between ll:gap-3 ll:font-sans ll:text-small ll:text-primary ll:select-none ll:z-30 ${className}`}
    >
      <div className="ll:flex ll:items-center ll:gap-2">
        <Icon icon={Lock} size={14} className="ll:text-muted ll:shrink-0" />
        <span>This project is open in another tab, so it is read-only here.</span>
      </div>
      <Button variant="secondary" size="sm" onClick={handleTakeOver}>
        Edit here instead
      </Button>
    </div>
  );
};
