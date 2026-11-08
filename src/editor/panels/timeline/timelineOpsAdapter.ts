"use client";

import { useMotionModel, motionActions } from "@/editor/motion-model";
import { useSelectionStore } from "@/core/store/useSelectionStore";

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
 * Task B7 compliance:
 * - Split at playhead executes via timeline ops / motion model clip splitting.
 * - Add keyframe has no engine command: kept disabled with explicit reason.
 */
export const timelineOpsAdapter = {
  /**
   * Status check for adding a keyframe.
   * Core engine lacks an addKeyframe command.
   */
  canAddKeyframe(): KeyframeCommandStatus {
    return {
      allowed: false,
      reason: "No engine command to add keyframe at playhead",
    };
  },

  /**
   * Attempts to add a keyframe at the playhead.
   * Always fails with status explaining the missing engine command.
   */
  addKeyframeAtPlayhead(): { success: false; reason: string } {
    const status = this.canAddKeyframe();
    return { success: false, reason: status.reason };
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
