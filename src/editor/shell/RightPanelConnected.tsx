"use client";

import React from "react";
import { RightPanelFrame } from "@/editor/shell/right-panel";
import type { RightPanelMode } from "@/editor/shell/right-panel";
import {
  getInspectorDesignSections,
  InspectorExtras,
  useSelectionInspector,
} from "@/editor/panels/details";
import { MotionInspector } from "@/editor/panels/inspectors";
import { CodeInspector } from "@/editor/panels/code-view";
import { useInspectorDimension } from "@/editor/panels/details/inspectorDimension";
import { getSurfaceSections } from "@/editor/panels/details/sections/SurfaceSections";

export interface RightPanelConnectedProps {
  mode: RightPanelMode;
  /** Show the AI chat view instead of the inspector. */
  aiOpen?: boolean;
  onAiClose?: () => void;
}

/** Right panel frame: the real inspector fields in Design, the motion inspector (composition, layer or keyframe by selection) in Motion, the file inspector in Code. */
export const RightPanelConnected: React.FC<RightPanelConnectedProps> = ({ mode, aiOpen = false, onAiClose }) => {
  const inspector = useSelectionInspector();
  const dimension = useInspectorDimension((s) => s.dimension);
  // the 2D / 3D switch: the same selection, its Figma-style or its Blender-style settings
  const designSections =
    dimension === "3d" && inspector.hasSelection
      ? getSurfaceSections({
          selectedId: inspector.selectedId,
          selectedIds: inspector.selectedIds,
          layer: inspector.primaryLayer,
          isMulti: inspector.isMulti,
          getValue: inspector.getValue,
          onUpdateProp: inspector.onUpdateProp,
          onUpdateProps: inspector.onUpdateProps,
        })
      : getInspectorDesignSections(inspector);

  if (mode === "motion") {
    return (
      <RightPanelFrame mode={mode} aiOpen={aiOpen} onAiClose={onAiClose}>
        <MotionInspector />
        <InspectorExtras kind="animation" />
      </RightPanelFrame>
    );
  }
  if (mode === "code") {
    return (
      <RightPanelFrame mode={mode} aiOpen={aiOpen} onAiClose={onAiClose}>
        <CodeInspector />
        <InspectorExtras kind="data-logic" />
      </RightPanelFrame>
    );
  }
  return <RightPanelFrame mode={mode} designSections={designSections} aiOpen={aiOpen} onAiClose={onAiClose} />;
};
