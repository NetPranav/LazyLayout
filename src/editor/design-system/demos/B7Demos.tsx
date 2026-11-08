"use client";

import React, { useState } from "react";
import { TimelinePanel } from "@/editor/panels/timeline/TimelinePanel";
import { TimelineFooter } from "@/editor/panels/timeline/TimelineFooter";
import { EasingPopover } from "@/editor/panels/timeline/EasingPopover";
import { EasingEditor } from "@/editor/panels/inspectors/EasingEditor";
import { useMotionModel, motionActions, LABEL_COLORS, type Keyframe } from "@/editor/motion-model";
import { Icon } from "@/editor/components/Icon";
import {
  AutoKeyIcon,
  OnionSkinIcon,
  SplitIcon,
  EaseCurveIcon,
  AddKeyframeIcon,
  CloseIcon,
} from "@/editor/panels/timeline/icons";

/**
 * 1. Full Motion Mode Timeline Demo
 * Full motion timeline matching P's 2026-11-07 state:
 * - 44px transport header with Split (C), disabled Add Keyframe (K), and Easing popover button.
 * - 28px footer with Auto-key and Onion skin toggles, FPS selector, snapping, and work area length.
 * - Theme-reactive label colors (--ll-label-1..6 and -tint) across clips and tracks.
 */
export function B7MotionTimelineDemo() {
  return (
    <div className="ll:w-full ll:h-96 ll:border ll:border-border ll:rounded-md ll:overflow-hidden ll:bg-surface-panel">
      <TimelinePanel height="100%" />
    </div>
  );
}

/**
 * 2. Timeline Footer Demo (Auto-Key & Onion Skin Toggles)
 * Shows the 28px timeline footer in isolation with Auto-key and Onion skin buttons.
 */
export function B7TimelineFooterDemo() {
  const autoKey = useMotionModel((s) => s.autoKey);
  const onionSkin = useMotionModel((s) => s.onionSkin);

  return (
    <div className="ll:flex ll:flex-col ll:gap-3 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
      <div className="ll:flex ll:items-center ll:gap-4 ll:text-xs ll:font-mono ll:text-muted">
        <span>Auto-key state: <strong className="ll:text-primary">{autoKey ? "ON" : "OFF"}</strong></span>
        <span>Onion skin state: <strong className="ll:text-primary">{onionSkin ? "ON" : "OFF"}</strong></span>
      </div>
      <div className="ll:border ll:border-border ll:rounded-sm ll:overflow-hidden">
        <TimelineFooter trackWidth={264} />
      </div>
    </div>
  );
}

/**
 * 3. Easing Popover Demo
 * Demonstrates the Easing popover reusing EasingEditor for keyframe curve & spring customization.
 */
export function B7EasingPopoverDemo() {
  const [open, setOpen] = useState(false);
  const comp = useMotionModel((s) => s.comp);
  const [dummyKeyframe, setDummyKeyframe] = useState<Keyframe>({
    id: "demo-kf",
    t: 60,
    v: 1,
    ease: "Ease out",
    bz: [0.25, 0.1, 0.25, 1.0],
    spring: { response: 0.35, damping: 0.6 },
  });

  return (
    <div className="ll:flex ll:flex-col ll:gap-4 ll:p-6 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:relative">
      <div className="ll:flex ll:items-center ll:gap-3">
        <button
          type="button"
          onClick={() => {
            if (!open) {
              const firstKey = comp.layers[0]?.tr[0]?.keys[0];
              if (firstKey) {
                motionActions.selectKeys([firstKey.id], false);
              }
            }
            setOpen(!open);
          }}
          className="ll:h-8 ll:px-3 ll:flex ll:items-center ll:gap-2 ll:rounded-sm ll:bg-surface-hover ll:border ll:border-border ll:text-primary ll:text-xs ll:font-medium"
        >
          <Icon icon={EaseCurveIcon} size={15} />
          <span>Toggle Easing Popover ({dummyKeyframe.ease})</span>
        </button>
      </div>

      <div className="ll:min-w-popover-min ll:p-3 ll:bg-surface-float ll:border ll:border-border ll:rounded-md ll:shadow-sm">
        <div className="ll:text-xs ll:font-mono ll:text-muted ll:mb-2">
          Embedded EasingEditor Preview:
        </div>
        <EasingEditor
          keyframe={dummyKeyframe}
          onKeyframeChange={(patch) =>
            setDummyKeyframe((prev) => ({
              ...prev,
              ...patch,
            }))
          }
        />
      </div>

      <EasingPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRect={null}
        anchorPos={{ x: 280, y: 380 }}
      />
    </div>
  );
}

/**
 * 4. Theme-Reactive Label Colors Demo
 * Sourced from P lines 1128-1135: per-theme --ll-label-1..6 and --ll-label-1..6-tint.
 */
export function B7LabelColorsDemo() {
  return (
    <div className="ll:grid ll:grid-cols-2 ll:md:grid-cols-3 ll:gap-3 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
      {LABEL_COLORS.map((name, i) => {
        const num = i + 1;
        return (
          <div
            key={name}
            style={{
              backgroundColor: `var(--ll-label-${num}-tint)`,
              borderColor: `var(--ll-label-${num})`,
            }}
            className="ll:flex ll:flex-col ll:gap-1.5 ll:p-3 ll:rounded-xs ll:border"
          >
            <div className="ll:flex ll:items-center ll:gap-2">
              <span
                style={{ backgroundColor: `var(--ll-label-${num})` }}
                className="ll:w-3 ll:h-3 ll:rounded-2xs"
              />
              <span className="ll:font-sans ll:text-xs ll:font-medium ll:text-primary">
                {name} (Label {num})
              </span>
            </div>
            <div className="ll:font-mono ll:text-nano ll:text-muted">
              --ll-label-{num} &amp; -tint
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 5. Motion Custom Icons Demo
 * Icons sourced from P: Auto-key, Onion skin, Split, Ease, and Add keyframe.
 */
export function B7MotionIconsDemo() {
  const icons = [
    { name: "Auto-key (#tb-auto)", icon: AutoKeyIcon },
    { name: "Onion skin (#tb-onion)", icon: OnionSkinIcon },
    { name: "Split clip (#split)", icon: SplitIcon },
    { name: "Easing curve (#tb-ease)", icon: EaseCurveIcon },
    { name: "Add keyframe (#kfadd)", icon: AddKeyframeIcon },
    { name: "Close (#close)", icon: CloseIcon },
  ];

  return (
    <div className="ll:flex ll:flex-wrap ll:gap-4 ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
      {icons.map(({ name, icon }) => (
        <div
          key={name}
          className="ll:flex ll:flex-col ll:items-center ll:gap-2 ll:p-3 ll:border ll:border-border ll:rounded-sm ll:bg-surface-float ll:w-36"
        >
          <div className="ll:w-8 ll:h-8 ll:flex ll:items-center ll:justify-center ll:rounded-xs ll:bg-surface-panel ll:text-primary">
            <Icon icon={icon} size={18} />
          </div>
          <span className="ll:font-sans ll:text-nano ll:text-muted ll:text-center">
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}
