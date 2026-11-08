"use client";

import React from "react";
import { LeftPanel, PageSelector } from "@/editor/shell/left-panel";
import { useLeftPanelData } from "./useLeftPanelData";
import { usePagesData } from "./usePagesData";
import type { LeftPanelConnectedProps } from "./types";

export const LeftPanelConnected: React.FC<LeftPanelConnectedProps> = ({
  mode = "design",
  filterByActivePage,
  headerStart,
  className = "",
  ...overrides
}) => {
  const leftPanelData = useLeftPanelData({ mode, filterByActivePage });
  const pagesData = usePagesData();

  const renderedHeaderStart =
    headerStart !== undefined
      ? headerStart
      : mode === "design" || mode === "motion"
      ? <PageSelector {...pagesData} />
      : undefined;

  return (
    <LeftPanel
      {...leftPanelData}
      headerStart={renderedHeaderStart}
      className={className}
      {...overrides}
    />
  );
};
