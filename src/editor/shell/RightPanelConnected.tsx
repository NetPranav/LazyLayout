"use client";

import React from "react";
import { RightPanelFrame } from "@/editor/shell/right-panel";
import type { RightPanelMode } from "@/editor/shell/right-panel";
import {
  getInspectorDesignSections,
  useSelectionInspector,
} from "@/editor/panels/details";

export interface RightPanelConnectedProps {
  mode: RightPanelMode;
}

/** Right panel frame with the real inspector fields as the Design sections. */
export const RightPanelConnected: React.FC<RightPanelConnectedProps> = ({ mode }) => {
  const inspector = useSelectionInspector();
  const designSections = getInspectorDesignSections(inspector);
  return <RightPanelFrame mode={mode} designSections={designSections} />;
};
