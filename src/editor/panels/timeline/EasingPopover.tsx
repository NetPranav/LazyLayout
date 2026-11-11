"use client";

import React, { useEffect, useRef } from "react";
import { Icon } from "@/editor/components/Icon";
import { CloseIcon } from "./icons";
import { EasingEditor } from "@/editor/panels/inspectors/EasingEditor";
import { registerOverlay, retargetPosition, getFamilyHandoff } from "@/editor/components/retarget";
import {
  useMotionModel,
  motionActions,
  type Keyframe,
  type EaseName,
  type Bezier,
  type SpringParams,
} from "@/editor/motion-model";

export interface EasingPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  anchorPos?: { x: number; y: number } | null;
}

/** Popover placement, in viewport units (the popover has no fixed token width). */
const POP_W = 330;
const POP_HALF = 144;
const POP_H = 380;
const POP_PAD = 16;
const POP_GAP = 8;

const FALLBACK_KEYFRAME: Keyframe = {
  id: "temp-ease-kf",
  t: 0,
  v: 0,
  ease: "Ease out",
  bz: [0.25, 0.1, 0.25, 1.0],
  spring: { response: 0.35, damping: 0.6 },
};

export const EasingPopover: React.FC<EasingPopoverProps> = ({
  open,
  onClose,
  anchorRect,
  anchorPos,
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const comp = useMotionModel((s) => s.comp);
  const selectedKeys = useMotionModel((s) => s.selectedKeys);
  const selectedKeyIds = Object.keys(selectedKeys);

  // Find the first selected keyframe in the model, or fallback
  let activeKeyframe: Keyframe = FALLBACK_KEYFRAME;
  for (const l of comp.layers) {
    for (const tr of l.tr) {
      for (const k of tr.keys) {
        if (selectedKeys[k.id]) {
          activeKeyframe = k;
          break;
        }
      }
      if (activeKeyframe !== FALLBACK_KEYFRAME) break;
    }
    if (activeKeyframe !== FALLBACK_KEYFRAME) break;
  }

  const hasSelectedKeys = selectedKeyIds.length > 0;

  // Determine popover position: prefer anchored above or below
  let left = 240;
  let top = 120;
  if (typeof window !== "undefined") {
    if (anchorPos) {
      left = Math.max(POP_PAD, Math.min(window.innerWidth - POP_W, anchorPos.x - POP_HALF));
      top = Math.max(POP_PAD, anchorPos.y - POP_H);
    } else if (anchorRect) {
      left = Math.max(POP_PAD, Math.min(window.innerWidth - POP_W, anchorRect.left + anchorRect.width / 2 - POP_HALF));
      if (anchorRect.top > POP_H) {
        top = anchorRect.top - POP_H;
      } else {
        top = anchorRect.bottom + POP_GAP;
      }
    }
  }

  const prevPosRef = useRef<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!open) {
      prevPosRef.current = null;
      return;
    }
    return registerOverlay("timeline-easing", popoverRef.current, onClose);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !popoverRef.current) return;
    const current = { left, top };
    if (prevPosRef.current && (prevPosRef.current.left !== left || prevPosRef.current.top !== top)) {
      const el = popoverRef.current;
      const rect = el.getBoundingClientRect();
      const prevRect: DOMRect = {
        left: prevPosRef.current.left,
        top: prevPosRef.current.top,
        width: rect.width,
        height: rect.height,
        right: prevPosRef.current.left + rect.width,
        bottom: prevPosRef.current.top + rect.height,
        x: prevPosRef.current.left,
        y: prevPosRef.current.top,
        toJSON: () => ({}),
      };
      const newRect: DOMRect = {
        left,
        top,
        width: rect.width,
        height: rect.height,
        right: left + rect.width,
        bottom: top + rect.height,
        x: left,
        y: top,
        toJSON: () => ({}),
      };
      retargetPosition(el, prevRect, newRect);
    } else if (!prevPosRef.current) {
      const handoff = getFamilyHandoff("timeline-easing");
      if (handoff && popoverRef.current) {
        const el = popoverRef.current;
        const rect = el.getBoundingClientRect();
        const newRect: DOMRect = {
          left,
          top,
          width: rect.width,
          height: rect.height,
          right: left + rect.width,
          bottom: top + rect.height,
          x: left,
          y: top,
          toJSON: () => ({}),
        };
        retargetPosition(el, handoff, newRect);
      }
    }
    prevPosRef.current = current;
  }, [open, left, top]);

  // Dismiss on Escape and click outside
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleKeyframeChange = (patch: Partial<Keyframe>) => {
    if (!hasSelectedKeys) return;
    const nextEase: EaseName = patch.ease ?? activeKeyframe.ease;
    const nextBz: Bezier | undefined = patch.bz ?? activeKeyframe.bz;
    const nextSpring: SpringParams | undefined = patch.spring ?? activeKeyframe.spring;

    motionActions.setKeysEase(selectedKeyIds, nextEase, nextBz, nextSpring);
  };

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Easing curve and spring settings"
      style={{ left: `${left}px`, top: `${top}px` }}
      className="ll-tbpop ll:fixed ll:z-50 ll:min-w-popover-min ll:p-3 ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-lg ll:select-none ll:flex ll:flex-col ll:gap-3"
    >
      {/* Popover Header */}
      <div className="ll:flex ll:items-center ll:justify-between ll:border-b ll:border-border ll:pb-2">
        <div className="ll:flex ll:items-center ll:gap-2">
          <span className="ll:font-sans ll:text-sm ll:font-medium ll:text-primary">
            Easing
          </span>
          <span className="ll:font-mono ll:text-nano ll:text-muted ll:px-1.5 ll:py-0.5 ll:bg-surface-panel ll:rounded-xs ll:border ll:border-border">
            {hasSelectedKeys ? activeKeyframe.ease : "Disabled"}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close easing popover"
          className="ll:w-6 ll:h-6 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:transition-colors"
        >
          <Icon icon={CloseIcon} size={14} />
        </button>
      </div>

      {!hasSelectedKeys && (
        <div className="ll:p-2 ll:rounded-xs ll:bg-surface-panel ll:border ll:border-border ll:text-muted ll:font-sans ll:text-xs">
          Select a keyframe on the timeline to edit easing curves and spring physics.
        </div>
      )}

      {/* Embedded EasingEditor */}
      <div
        className={`ll:flex ll:flex-col ll:min-w-0 ${
          !hasSelectedKeys ? "ll:opacity-45 ll:pointer-events-none" : ""
        }`}
        aria-disabled={!hasSelectedKeys}
      >
        <EasingEditor
          keyframe={activeKeyframe}
          onKeyframeChange={handleKeyframeChange}
          segmentDurationSec={1.0}
        />
      </div>
    </div>
  );
};
