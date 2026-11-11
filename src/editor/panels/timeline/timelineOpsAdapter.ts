"use client";

import { useMotionModel, motionActions } from "@/editor/motion-model";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import type { PropId } from "@/editor/motion-model";

export interface SplitResult {
  success: boolean;
  frame?: number;
  timeSec?: number;
  reason?: string;
}

export interface KeyframeCommandStatus {
  allowed: boolean;
  reason: string;
}

/**
 * Thin adapter mediating between Timeline Panel actions and Core Engine commands/ops.
 * - Split at playhead executes via the motion model (which writes the document clips).
 * - Add keyframe goes through `motionActions.addKey`, which calls the core `setKeyframeAt` (one undo step).
 */
function keyframeTarget(layerId?: string): { layerId: string; props: PropId[] } | null {
  const s = useMotionModel.getState();
  const id = layerId ?? useSelectionStore.getState().selectedIds.find((x) => s.comp.layers.some((l) => l.id === x));
  if (!id) return null;
  const layer = s.comp.layers.find((l) => l.id === id);
  if (!layer || layer.lock) return null;
  if (s.selectedProp?.layerId === id) return { layerId: id, props: [s.selectedProp.p] };
  const animated = layer.tr.map((t) => t.p);
  return { layerId: id, props: animated.length > 0 ? animated : ["opacity"] };
}

export const timelineOpsAdapter = {
  /** A keyframe can be added when a (unlocked) layer that the timeline knows is selected. */
  canAddKeyframe(layerId?: string): KeyframeCommandStatus {
    const target = keyframeTarget(layerId);
    return target
      ? { allowed: true, reason: "" }
      : { allowed: false, reason: "Select an unlocked layer to add a keyframe at the playhead" };
  },

  /** Adds a keyframe at the playhead on the selected property, or on every animated property of the layer. */
  addKeyframeAtPlayhead(layerId?: string): { success: boolean; reason?: string } {
    const target = keyframeTarget(layerId);
    if (!target) return { success: false, reason: this.canAddKeyframe(layerId).reason };
    const { playhead } = useMotionModel.getState();
    const ids: string[] = [];
    for (const p of target.props) ids.push(motionActions.addKey(target.layerId, p, playhead));
    motionActions.selectKeys(ids);
    return { success: true };
  },

  /**
   * Splits the active or specified layer's clip at current playhead frame.
   * Uses motion model splitAtPlayhead.
   */
  splitClipAtPlayhead(
    layerId?: string,
    at?: { clipIndex?: number; frame?: number },
  ): SplitResult {
    const { playhead, fps } = useMotionModel.getState();
    if (layerId && at?.clipIndex !== undefined) {
      const frame = at.frame ?? playhead;
      const success = motionActions.splitClip(layerId, at.clipIndex, frame);
      return {
        success,
        frame,
        timeSec: frame / fps,
        reason: success ? undefined : `Frame ${frame} is not inside the clip`,
      };
    }
    const timeSec = playhead / fps;

    const targetId = layerId ?? useSelectionStore.getState().selectedIds[0];
    const success = motionActions.splitAtPlayhead(targetId);

    return {
      success,
      frame: playhead,
      timeSec,
      reason: success
        ? undefined
        : `Playhead (${playhead}f) is not over an interior section of a clip`,
    };
  },
};
