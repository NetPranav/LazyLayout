import React from "react";

export interface RightPanelEmptyPlaceholderProps {
  label: string;
  className?: string;
}

export const RightPanelEmptyPlaceholder: React.FC<RightPanelEmptyPlaceholderProps> = ({
  label,
  className = "",
}) => {
  return (
    <div
      className={`ll-empty-placeholder ll:flex ll:items-center ll:justify-center ll:py-2.5 ll:px-3 ll:rounded-sm ll:border ll:border-dashed ll:border-border ll:bg-surface-bar ll:text-micro ll:text-muted ll:font-sans ll:select-none ${className}`}
    >
      <span className="ll:truncate">{label}</span>
    </div>
  );
};

