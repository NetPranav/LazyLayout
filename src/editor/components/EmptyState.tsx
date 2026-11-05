"use client";

import React from "react";
import { Frame, Plus, Sparkles } from "lucide-react";
import { Button } from "./Button";
import { Icon } from "./Icon";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  onAddFrame?: () => void;
  onInsert?: () => void;
  onAskAi?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "Start with",
  description,
  onAddFrame,
  onInsert,
  onAskAi,
  className = "",
}) => {
  return (
    <div
      className={`es ll:flex ll:flex-col ll:items-center ll:justify-center ll:gap-4 ll:p-8 ll:text-center ll:select-none ${className}`}
    >
      <div className="ll:flex ll:flex-col ll:items-center ll:gap-1">
        <span className="ll:text-title ll:font-medium ll:text-primary">{title}</span>
        {description && (
          <span className="ll:text-body ll:text-secondary ll:max-w-xs">{description}</span>
        )}
      </div>

      <div className="esb ll:flex ll:items-center ll:gap-2.5">
        <Button
          variant="primary"
          size="md"
          leftIcon={<Icon icon={Frame} size={14} />}
          onClick={onAddFrame}
        >
          Add frame
        </Button>

        <Button
          variant="secondary"
          size="md"
          leftIcon={<Icon icon={Plus} size={14} />}
          onClick={onInsert}
        >
          Insert
        </Button>

        <Button
          variant="secondary"
          size="md"
          leftIcon={<Icon icon={Sparkles} size={14} />}
          onClick={onAskAi}
        >
          Ask AI
        </Button>
      </div>
    </div>
  );
};

