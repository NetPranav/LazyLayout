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
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { useDocument } from "@/core/store/useDocumentStore";
import { Properties3d } from "@/editor/panels/details/properties3d";

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
  const active3dId = useViewportStore((s) => s.selection.active);
  const editingSceneId = useViewportStore((s) => s.editingSceneId);
  const doc = useDocument((d) => d);
  const selected3dObj = active3dId ? doc.objects?.[active3dId] : undefined;

  // 3D selection in viewport store mounts Properties3d editor
  const has3dSelection = Boolean(active3dId && (dimension === "3d" || Boolean(editingSceneId) || !inspector.hasSelection));

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

  // ONE additive branch: When 3D object is selected, render Blender-style Properties3d
  if (has3dSelection && mode === "design") {
    return (
      <RightPanelFrame
        mode={mode}
        selectionName={selected3dObj?.name ?? "3D Object"}
        dimension={dimension}
        aiOpen={aiOpen}
        onAiClose={onAiClose}
      >
        <Properties3d activeId={active3dId} />
      </RightPanelFrame>
    );
  }

  return <RightPanelFrame mode={mode} designSections={designSections} aiOpen={aiOpen} onAiClose={onAiClose} />;
};
