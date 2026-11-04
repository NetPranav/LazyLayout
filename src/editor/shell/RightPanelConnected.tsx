"use client";

import React from "react";
import { RightPanelFrame } from "@/editor/shell/right-panel";
import type { RightPanelMode } from "@/editor/shell/right-panel";
import {
  getInspectorDesignSections,
  useSelectionInspector,
} from "@/editor/panels/details";
import { DEFAULT_LAYERS, KeyframeInspector } from "@/editor/panels/inspectors";
import { CodeInspector } from "@/editor/panels/code-view";

export interface RightPanelConnectedProps {
  mode: RightPanelMode;
  /** Show the AI chat view instead of the inspector. */
  aiOpen?: boolean;
  onAiClose?: () => void;
}

/** Right panel frame: the real inspector fields in Design, the keyframe inspector in Motion, the file inspector in Code. */
export const RightPanelConnected: React.FC<RightPanelConnectedProps> = ({ mode, aiOpen = false, onAiClose }) => {
  const inspector = useSelectionInspector();
  const designSections = getInspectorDesignSections(inspector);

  if (mode === "motion") {
    const targetLayer = inspector.hasSelection ? inspector.selectionName : undefined;
    const layers = targetLayer && !DEFAULT_LAYERS.includes(targetLayer) ? [targetLayer, ...DEFAULT_LAYERS] : DEFAULT_LAYERS;
    return (
      <RightPanelFrame mode={mode} aiOpen={aiOpen} onAiClose={onAiClose}>
        <KeyframeInspector layer={targetLayer} availableLayers={layers} />
      </RightPanelFrame>
    );
  }
  if (mode === "code") {
    return (
      <RightPanelFrame mode={mode} aiOpen={aiOpen} onAiClose={onAiClose}>
        <CodeInspector />
      </RightPanelFrame>
    );
  }
  return <RightPanelFrame mode={mode} designSections={designSections} aiOpen={aiOpen} onAiClose={onAiClose} />;
};
