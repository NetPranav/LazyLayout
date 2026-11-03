"use client";

import React, { useState } from "react";
import { Plus, Film } from "lucide-react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";
import { RepeatableRow } from "../controls/RepeatableRow";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import { EasingCurveBox } from "../controls/EasingCurveBox";
import {
  INSPECTOR_CONSTANTS,
  ANIMATION_PRESET_OPTIONS,
  ANIMATION_TRIGGER_OPTIONS,
  EASING_PRESETS,
} from "../constants";
import type { InspectorSectionProps, AnimationItem } from "../types";

const DEFAULT_ANIMATION: AnimationItem = {
  id: "anim-default",
  preset: "fade-in",
  duration: 0.6,
  trigger: "load",
  curve: EASING_PRESETS[2], // Ease out (0, 0, 0.58, 1)
};

export const AnimationSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const [animations, setAnimations] = useState<AnimationItem[]>([DEFAULT_ANIMATION]);
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
      preset: "slide-up",
      duration: 0.6,
      trigger: "scroll",
      curve: EASING_PRESETS[2],
    };
    const next = [...animations, newAnim];
    setAnimations(next);
    setActivePopoverId(newId);
    syncPrimaryToStore(next);
  };

  const handleUpdateAnim = (id: string, patch: Partial<AnimationItem>) => {
    const next = animations.map((a) => (a.id === id ? { ...a, ...patch } : a));
    setAnimations(next);
    syncPrimaryToStore(next);
  };

  const handleRemoveAnim = (id: string) => {
    const next = animations.filter((a) => a.id !== id);
    setAnimations(next);
    if (activePopoverId === id) setActivePopoverId(null);
    syncPrimaryToStore(next);
  };

  const handleToggleHide = (id: string) => {
    const next = animations.map((a) => (a.id === id ? { ...a, hidden: !a.hidden } : a));
    setAnimations(next);
    syncPrimaryToStore(next);
  };

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* Header Add Button */}
      <div className="ll:flex ll:items-center ll:justify-between ll:pb-1">
        <span className="ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted">
          Transitions &amp; Motion
        </span>
        <IconButton
          size="sm"
          aria-label="Add animation"
          tooltip="Add animation"
          onClick={handleAddAnimation}
          icon={<Icon icon={Plus} size={14} />}
        />
      </div>

      {/* Repeatable Animations List */}
      <div className="ll:flex ll:flex-col ll:gap-1.5 ll:w-full">
        {animations.map((anim) => {
          const isOpen = activePopoverId === anim.id;
          const presetLabel =
            ANIMATION_PRESET_OPTIONS.find((o) => o.value === anim.preset)?.label ||
            "Fade in";

          const leadNode = (
            <span className="ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:text-muted">
              <Icon icon={Film} size={13} />
            </span>
          );

          const summaryNode = (
            <div className="ll:flex ll:items-center ll:justify-between ll:w-full ll:gap-2">
              <span className="ll:text-small ll:font-mono ll:text-primary">
                {presetLabel}
              </span>
              <span className="ll:text-micro ll:font-mono ll:text-muted ll:shrink-0">
                {anim.duration}s
              </span>
            </div>
          );

          return (
            <React.Fragment key={anim.id}>
              <RepeatableRow
                id={anim.id}
                isOpen={isOpen}
                isHidden={anim.hidden}
                leadContent={leadNode}
                leadTitle={`${presetLabel} settings`}
                summaryContent={summaryNode}
                onOpenSettings={() =>
                  setActivePopoverId((prev) => (prev === anim.id ? null : anim.id))
                }
                onToggleHide={() => handleToggleHide(anim.id)}
                onRemove={() => handleRemoveAnim(anim.id)}
              />

              {/* Popover Settings */}
              {isOpen && (
                <RowSettingsPopover
                  title="Animation Settings"
                  isOpen={isOpen}
                  onClose={() => setActivePopoverId(null)}
                >
                  {/* Preset Select */}
                  <Select
                    size="sm"
                    label="Preset"
                    aria-label="Animation preset"
                    value={anim.preset}
                    options={ANIMATION_PRESET_OPTIONS}
                    onChange={(preset) => handleUpdateAnim(anim.id, { preset })}
                  />

                  {/* Duration NumberField */}
                  <NumberField
                    size="sm"
                    label="Duration"
                    aria-label="Duration"
                    suffix="s"
                    min={0.05}
                    value={anim.duration}
                    step={INSPECTOR_CONSTANTS.STEP_DECIMAL}
                    precision={2}
                    onChange={(duration) =>
                      handleUpdateAnim(anim.id, { duration })
                    }
                  />

                  {/* Trigger Select */}
                  <Select
                    size="sm"
                    label="Trigger"
                    aria-label="Animation trigger"
                    value={anim.trigger}
                    options={ANIMATION_TRIGGER_OPTIONS}
                    onChange={(val) =>
                      handleUpdateAnim(anim.id, {
                        trigger: val as AnimationItem["trigger"],
                      })
                    }
                  />

                  {/* Interactive Easing Curve Box with x1/y1/x2/y2 scrub fields */}
                  <div className="ll:flex ll:flex-col ll:gap-1 ll:pt-1">
                    <span className="ll:text-nano ll:font-mono ll:uppercase ll:text-muted">
                      Timing Curve
                    </span>
                    <EasingCurveBox
                      curve={anim.curve}
                      onChange={(curve) => handleUpdateAnim(anim.id, { curve })}
                    />
                  </div>
                </RowSettingsPopover>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
