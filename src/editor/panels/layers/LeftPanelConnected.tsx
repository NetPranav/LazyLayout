"use client";

import React from "react";
import { LeftPanel } from "@/editor/shell/left-panel";
import { PagesManager } from "@/editor/shell/pages-manager";
import { useLeftPanelData } from "./useLeftPanelData";
import type { LeftPanelConnectedProps } from "./types";

export const LeftPanelConnected: React.FC<LeftPanelConnectedProps> = ({
  mode = "design",
  filterByActivePage,
  headerStart,
  className = "",
  ...overrides
}) => {
  const leftPanelData = useLeftPanelData({ mode, filterByActivePage });

  const renderedHeaderStart =
    headerStart !== undefined
      ? headerStart
      : mode === "design" || mode === "motion"
      ? <PagesManager query={leftPanelData.searchQuery} />
      : undefined;

  return (
    <div className="ll:relative ll:w-full ll:h-full ll:min-h-0 ll:min-w-0">
      <LeftPanel
        {...leftPanelData}
        headerStart={renderedHeaderStart}
        className={className}
        {...overrides}
      />
    </div>
  );
};
