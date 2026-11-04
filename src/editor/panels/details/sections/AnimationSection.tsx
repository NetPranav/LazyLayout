"use client";

import React, { useState, useEffect } from "react";
import { Film, GripVertical, Eye, EyeOff, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import { EASING_PRESETS } from "../constants";
import type { InspectorSectionProps, AnimationItem } from "../types";

export interface AnimationSectionProps extends InspectorSectionProps {
  onAddAnimationRef?: { current?: () => void };
}

export const AnimationSection: React.FC<AnimationSectionProps> = ({
  onUpdateProp,
  onAddAnimationRef,
  className = "",
}) => {
  const [animations, setAnimations] = useState<AnimationItem[]>([]);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

  const syncPrimaryToStore = (updated: AnimationItem[]) => {
    const visible = updated.find((a) => !a.hidden);
    if (visible) {
      onUpdateProp?.("transition.duration", visible.duration);
      onUpdateProp?.(
        "transition.easing",
        `cubic-bezier(${visible.curve.x1}, ${visible.curve.y1}, ${visible.curve.x2}, ${visible.curve.y2})`
      );
    }
  };

  const handleAddAnimation = () => {
    const newId = `anim-${Date.now()}`;
    const newAnim: AnimationItem = {
      id: newId,
      preset: "Fade in",
      duration: 0.6,
      trigger: "load",
      curve: EASING_PRESETS[2],
    };
    const next = [...animations, newAnim];
    setAnimations(next);
    syncPrimaryToStore(next);
  };

  useEffect(() => {
    if (onAddAnimationRef) {
      onAddAnimationRef.current = handleAddAnimation;
    }
  });

  const handleRemove = (id: string) => {
    const next = animations.filter((a) => a.id !== id);
    setAnimations(next);
    if (activePopoverId === id) setActivePopoverId(null);
    syncPrimaryToStore(next);
  };

  const handleToggleHide = (id: string) => {
    const next = animations.map((a) =>
      a.id === id ? { ...a, hidden: !a.hidden } : a
    );
    setAnimations(next);
    syncPrimaryToStore(next);
  };

  if (animations.length === 0) {
    return null;
  }

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:w-full ${className}`}>
      {animations.map((anim) => {
        const isDim = Boolean(anim.hidden);
        return (
          <div
            key={anim.id}
            data-k="animation"
            className={`ll-dr ll-rr ll:flex ll:items-center ll:gap-1.5 ll:h-8 ll:px-1 ll:rounded-sm ll:hover:bg-surface-bar ll:transition-colors ${
              isDim ? "ll-rdim ll:opacity-50" : ""
            }`}
          >
            <button
              type="button"
              aria-label="Reorder"
              title="Reorder"
              className="ll-grip ll:w-3 ll:h-6 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:cursor-grab ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={GripVertical} size={12} />
            </button>

            <button
              type="button"
              aria-label="Settings"
              title="Settings"
              onClick={() =>
                setActivePopoverId(activePopoverId === anim.id ? null : anim.id)
              }
              className="ll-lead ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
            >
              <Icon icon={Film} size={14} className="ll:text-muted" />
            </button>

            <div className="ll-sum ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0">
              <span className="ll-stx ll:font-sans ll:text-small ll:text-primary ll:truncate">
                {anim.preset}
              </span>
              <span className="ll-stx ll-mt ll:font-mono ll:text-nano ll:text-muted ll:shrink-0">
                {anim.duration}s
              </span>
            </div>

            <button
              type="button"
              aria-label={anim.hidden ? "Show" : "Hide"}
              title={anim.hidden ? "Show" : "Hide"}
              onClick={() => handleToggleHide(anim.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={anim.hidden ? EyeOff : Eye} size={14} />
            </button>

            <button
              type="button"
              aria-label="Remove"
              title="Remove"
              onClick={() => handleRemove(anim.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={Minus} size={14} />
            </button>

            {activePopoverId === anim.id && (
              <RowSettingsPopover
                isOpen={true}
                title="Animation Settings"
                onClose={() => setActivePopoverId(null)}
              >
                <div className="ll:flex ll:flex-col ll:gap-2">
                  <span className="ll:text-nano ll:font-mono ll:text-muted">
                    Preset: {anim.preset}, {anim.duration}s
                  </span>
                </div>
              </RowSettingsPopover>
            )}
          </div>
        );
      })}
    </div>
  );
};
