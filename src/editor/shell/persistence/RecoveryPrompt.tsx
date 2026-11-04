"use client";

import React from "react";
import { History } from "lucide-react";
import type { PendingRecovery } from "@/core/storage/ProjectSession";
import { Button } from "@/editor/components/Button";
import { Icon } from "@/editor/components/Icon";

export interface RecoveryPromptProps {
  recovery: PendingRecovery;
  onRestore: () => void;
  onDiscard: () => void;
  className?: string;
}

/** Offered when the last session closed before its latest changes were saved. */
export const RecoveryPrompt: React.FC<RecoveryPromptProps> = ({
  recovery,
  onRestore,
  onDiscard,
  className = "",
}) => {
  const when = new Date(recovery.lastChangeAt).toLocaleString();
  const count = recovery.changeCount;

  return (
    <div
      role="alertdialog"
      aria-labelledby="recovery-title"
      aria-describedby="recovery-body"
      data-testid="recovery-prompt"
      className={`ll:fixed ll:top-16 ll:left-1/2 ll:-translate-x-1/2 ll:z-50 ll:w-banner ll:max-w-md ll:rounded-md ll:border ll:border-border ll:bg-surface-raised ll:shadow-soft ll:p-4 ll:flex ll:items-start ll:gap-3 ll:font-sans ll:text-primary ${className}`}
    >
      <Icon
        icon={History}
        size={18}
        className="ll:text-muted ll:shrink-0 ll:mt-0.5"
      />
      <div className="ll:flex-1 ll:min-w-0">
        <h2
          id="recovery-title"
          className="ll:text-body ll:font-semibold ll:text-primary ll:m-0"
        >
          Restore unsaved changes?
        </h2>
        <p
          id="recovery-body"
          className="ll:text-small ll:text-secondary ll:mt-1 ll:mb-0 ll:leading-relaxed"
        >
          LazyLayout closed before saving {count === 1 ? "1 change" : `${count} changes`} to this project (last one at {when}).
        </p>
        <div className="ll:flex ll:items-center ll:gap-2 ll:mt-3.5">
          <Button variant="primary" size="sm" onClick={onRestore}>
            Restore
          </Button>
          <Button variant="secondary" size="sm" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </div>
    </div>
  );
};
