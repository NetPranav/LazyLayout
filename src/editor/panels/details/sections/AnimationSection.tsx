"use client";
import React, { useState, useEffect } from "react";
import { Film, GripVertical, Eye, EyeOff, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import { EASING_PRESETS } from "../constants";
import type { InspectorSectionProps, AnimationItem } from "../types";

export interface AnimationSectionProps extends InspectorSectionProps {
  onAddAnimationRef?: { current?: () => void };
}

const PRESET_OPTIONS = [
  { value: "Fade in", label: "Fade in" },
  { value: "Slide up", label: "Slide up" },
  { value: "Scale in", label: "Scale in" },
] as const;

const TRIGGER_OPTIONS = [
  { value: "load", label: "On load" },
  { value: "scroll", label: "On scroll" },
  { value: "hover", label: "On hover" },
  { value: "click", label: "On click" },
] as const;

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

  const handleUpdate = (id: string, patch: Partial<AnimationItem>) => {
    const next = animations.map((a) => (a.id === id ? { ...a, ...patch } : a));
    setAnimations(next);
    syncPrimaryToStore(next);
  };

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
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-0.5 ll:-mx-1 ${className}`}>
      {animations.map((anim) => {
        const isDim = Boolean(anim.hidden);
        const isOpen = activePopoverId === anim.id;
        return (
          <div
            key={anim.id}
            data-k="animation"
            className={`ll-dr ll-rr ll:group ll:flex ll:items-center ll:gap-1 ll:h-8 ll:py-0.5 ll:px-1 ll:rounded-sm ${
              isOpen ? "ll:bg-surface-raised ll:text-primary" : ""
            } ${isDim ? "ll-rdim ll:opacity-50" : ""}`}
          >
            <span
              aria-hidden="true"
              title="Drag to reorder"
              className="ll-grip ll:-ml-4 ll:w-3 ll:h-6 ll:grid ll:place-items-center ll:text-muted ll:cursor-grab ll:opacity-0 ll:group-hover:opacity-100 ll:group-focus-within:opacity-100 ll:transition-opacity ll:duration-100"
            >
              <Icon icon={GripVertical} size={12} />
            </span>

            <button
              type="button"
              aria-label="Settings"
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              title="Settings"
              onClick={() => setActivePopoverId(isOpen ? null : anim.id)}
              className="ll-lead ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:shrink-0 ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ll:hover:bg-surface-hover ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:text-muted"
            >
              <Icon icon={Film} size={14} />
            </button>

            <div className="ll-sum ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0">
              <span className="ll-stx ll:font-sans ll:text-small ll:text-primary ll:truncate">
                {anim.preset}
              </span>
              <span className="ll-stx ll-mt ll:font-mono ll:text-micro ll:text-muted ll:shrink-0">
                {anim.duration} s
              </span>
            </div>

            <button
              type="button"
              aria-label={anim.hidden ? "Show" : "Hide"}
              title={anim.hidden ? "Show" : "Hide"}
              onClick={() => handleToggleHide(anim.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={anim.hidden ? EyeOff : Eye} size={14} />
            </button>

            <button
              type="button"
              aria-label="Remove"
              title="Remove"
              onClick={() => handleRemove(anim.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={Minus} size={14} />
            </button>

            <RowSettingsPopover isOpen={isOpen} title="Animation" onClose={() => setActivePopoverId(null)}>
              <Select
                aria-label="Animation preset"
                options={PRESET_OPTIONS}
                value={anim.preset}
                width="100%"
                size="sm"
                onChange={(value) => handleUpdate(anim.id, { preset: value })}
              />
              <div className="ll:grid ll:grid-cols-2 ll:gap-2">
                <div className="ll-dfield ll:flex ll:items-center ll:gap-1 ll:min-w-0 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:rounded-sm">
                  <span className="ll:font-mono ll:text-micro ll:text-muted">Dur</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    aria-label="Animation duration"
                    value={anim.duration}
                    onChange={(e) => handleUpdate(anim.id, { duration: Math.max(0, Number(e.target.value)) })}
                    className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="ll:font-mono ll:text-micro ll:text-muted">s</span>
                </div>
              </div>
              <Select
                aria-label="Animation trigger"
                options={TRIGGER_OPTIONS}
                value={anim.trigger}
                width="100%"
                size="sm"
                onChange={(value) => handleUpdate(anim.id, { trigger: value as AnimationItem["trigger"] })}
              />
            </RowSettingsPopover>
          </div>
        );
      })}
    </div>
  );
};
