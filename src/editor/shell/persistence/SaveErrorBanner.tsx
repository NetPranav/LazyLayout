"use client";

import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useSaveStatus } from "@/core/storage/ProjectSession";
import { Icon } from "@/editor/components/Icon";

export interface SaveErrorBannerProps {
  fileError: string | null;
  onDismissFileError: () => void;
  className?: string;
}

/** Shows save failures (such as full storage) and file-open errors until dismissed or fixed. */
export const SaveErrorBanner: React.FC<SaveErrorBannerProps> = ({
  fileError,
  onDismissFileError,
  className = "",
}) => {
  const [dismissedPersistentWarning, setDismissedPersistentWarning] = useState(false);
  const saveError = useSaveStatus((s) => s.error);
  const persistent = useSaveStatus((s) => s.persistent);

  const message =
    fileError ??
    saveError?.message ??
    (!persistent && !dismissedPersistentWarning
      ? "This browser isn't allowing LazyLayout to store data, so projects are kept only until you close this tab."
      : null);

  if (!message) return null;

  const handleDismiss = () => {
    if (fileError) {
      onDismissFileError();
    } else {
      setDismissedPersistentWarning(true);
    }
  };

  return (
    <div
      role="alert"
      data-testid="save-error-banner"
      className={`ll:fixed ll:bottom-6 ll:left-1/2 ll:-translate-x-1/2 ll:z-50 ll:w-banner ll:max-w-md ll:rounded-md ll:border ll:border-border ll:bg-surface-raised ll:shadow-soft ll:p-3.5 ll:flex ll:items-start ll:gap-3 ll:font-sans ll:text-primary ${className}`}
    >
      <Icon
        icon={AlertTriangle}
        size={18}
        className="ll:text-muted ll:shrink-0 ll:mt-0.5"
      />
      <div className="ll:flex-1 ll:min-w-0 ll:text-small ll:text-primary ll:leading-relaxed">
        {message}
      </div>
      <button
        type="button"
        aria-label="Dismiss banner"
        onClick={handleDismiss}
        className="ll:shrink-0 ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-surface-hover ll:hover:text-primary ll:outline-none ll:border-0 ll:bg-transparent ll:cursor-pointer ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
      >
        <Icon icon={X} size={14} />
      </button>
    </div>
  );
};
