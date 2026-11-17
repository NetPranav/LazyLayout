"use client";

import React from "react";
import {
  RightPanelFrame,
  useAiChat,
  type AiChatMessage,
  type AiProviderId,
  type AiProviderStatusMap,
} from "@/editor/shell/right-panel";
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
  onAiOpen?: () => void;
  onAiClose?: () => void;
  aiMessages?: AiChatMessage[];
  onAiSendMessage?: (content: string) => void;
  aiProvider?: AiProviderId;
  onAiProviderChange?: (provider: AiProviderId) => void;
  onAiModelChange?: (provider: AiProviderId, model: string) => void;
  aiProviderStatus?: AiProviderStatusMap;
  aiUserKeys?: Partial<Record<Exclude<AiProviderId, "offline">, string>>;
  aiUseUserKey?: Partial<Record<Exclude<AiProviderId, "offline">, boolean>>;
  onAiToggleUseUserKey?: (provider: Exclude<AiProviderId, "offline">, useOwn: boolean) => void;
  aiLastKeySource?: "byok" | "server" | "offline";
  aiCustomModels?: Partial<Record<AiProviderId, string>>;
  onAiSaveCredentials?: (
    provider: Exclude<AiProviderId, "offline">,
    apiKey: string,
    customModel?: string,
  ) => void;
  aiLoading?: boolean;
  onAiStop?: () => void;
  onClosePanel?: () => void;
}

/** Right panel frame: the real inspector fields in Design, the motion inspector (composition, layer or keyframe by selection) in Motion, the file inspector in Code. */
export const RightPanelConnected: React.FC<RightPanelConnectedProps> = ({
  mode,
  aiOpen = false,
  onAiOpen,
  onAiClose,
  aiMessages: controlledAiMessages,
  onAiSendMessage: controlledOnAiSendMessage,
  aiProvider: controlledAiProvider,
  onAiProviderChange: controlledOnAiProviderChange,
  onAiModelChange: controlledOnAiModelChange,
  aiProviderStatus: controlledAiProviderStatus,
  aiUserKeys: controlledAiUserKeys,
  aiUseUserKey: controlledAiUseUserKey,
  onAiToggleUseUserKey: controlledOnAiToggleUseUserKey,
  aiLastKeySource: controlledAiLastKeySource,
  aiCustomModels: controlledAiCustomModels,
  onAiSaveCredentials: controlledOnAiSaveCredentials,
  aiLoading: controlledAiLoading,
  onAiStop: controlledOnAiStop,
  onClosePanel,
}) => {
  const internalAiChat = useAiChat({ mode });
  const aiSharedProps = {
    aiOpen,
    onAiOpen,
    onAiClose,
    aiMessages: controlledAiMessages ?? internalAiChat.messages,
    onAiSendMessage:
      controlledOnAiSendMessage ?? ((content: string) => void internalAiChat.sendMessage(content)),
    aiProvider: controlledAiProvider ?? internalAiChat.provider,
    onAiProviderChange: controlledOnAiProviderChange ?? internalAiChat.setProvider,
    onAiModelChange: controlledOnAiModelChange ?? internalAiChat.setModel,
    aiProviderStatus: controlledAiProviderStatus ?? internalAiChat.providerStatus,
    aiUserKeys: controlledAiUserKeys ?? internalAiChat.userKeys,
    aiUseUserKey: controlledAiUseUserKey ?? internalAiChat.useUserKey,
    onAiToggleUseUserKey: controlledOnAiToggleUseUserKey ?? internalAiChat.setUseUserKey,
    aiLastKeySource: controlledAiLastKeySource ?? internalAiChat.lastMeta?.keySource,
    aiCustomModels: controlledAiCustomModels ?? internalAiChat.customModels,
    onAiSaveCredentials: controlledOnAiSaveCredentials ?? internalAiChat.saveCredentials,
    aiLoading: controlledAiLoading ?? internalAiChat.isLoading,
    onAiStop: controlledOnAiStop ?? internalAiChat.stop,
  };

  const inspector = useSelectionInspector();
  const dimension = useInspectorDimension((s) => s.dimension);
  const active3dId = useViewportStore((s) => s.selection.active);
  const editingSceneId = useViewportStore((s) => s.editingSceneId);
  const doc = useDocument((d) => d);
  const effective3dId =
    active3dId ??
    (editingSceneId
      ? doc.scenes?.[editingSceneId]?.objects?.[0] ?? Object.keys(doc.objects ?? {})[0] ?? null
      : null);
  const selected3dObj = effective3dId ? doc.objects?.[effective3dId] : undefined;

  // 3D selection (or active 3D scene editing mode) in viewport store mounts Properties3d editor
  const has3dSelection = Boolean(effective3dId && (dimension === "3d" || Boolean(editingSceneId) || !inspector.hasSelection));

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
      <RightPanelFrame mode={mode} onClosePanel={onClosePanel} {...aiSharedProps}>
        <MotionInspector />
        <InspectorExtras kind="animation" />
      </RightPanelFrame>
    );
  }
  if (mode === "code") {
    return (
      <RightPanelFrame mode={mode} onClosePanel={onClosePanel} {...aiSharedProps}>
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
        onClosePanel={onClosePanel}
        {...aiSharedProps}
      >
        <Properties3d activeId={effective3dId} />
      </RightPanelFrame>
    );
  }

  return <RightPanelFrame mode={mode} designSections={designSections} onClosePanel={onClosePanel} {...aiSharedProps} />;
};
