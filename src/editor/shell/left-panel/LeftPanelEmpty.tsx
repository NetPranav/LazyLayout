import React from "react";

export interface LeftPanelEmptyProps {
  title: string;
  description: string;
}

/** Text-only empty state for the left panel lists (no action buttons: handlers are not wired yet). */
export const LeftPanelEmpty: React.FC<LeftPanelEmptyProps> = ({ title, description }) => (
  <div className="ll-left-empty ll:flex ll:flex-col ll:items-center ll:gap-1 ll:px-4 ll:py-8 ll:text-center ll:font-sans ll:select-none">
    <span className="ll:text-body ll:font-medium ll:text-primary">{title}</span>
    <span className="ll:text-small ll:text-muted">{description}</span>
  </div>
);
