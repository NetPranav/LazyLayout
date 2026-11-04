"use client";

import React, { useState, useEffect } from "react";
import { GripVertical, Eye, EyeOff, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import type { InspectorSectionProps, EffectItem } from "../types";

export interface EffectsSectionProps extends InspectorSectionProps {
  onAddEffectRef?: { current?: () => void };
}

export const EffectsSection: React.FC<EffectsSectionProps> = ({
  onAddEffectRef,
  className = "",
}) => {
  const [effects, setEffects] = useState<EffectItem[]>([]);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

  const handleAddEffect = () => {
    const newId = `effect-${Date.now()}`;
    const newEffect: EffectItem = {
      id: newId,
      type: "drop-shadow",
      hex: "000000",
      x: 0,
      y: 4,
      blur: 8,
      spread: 0,
      amount: 8,
    };
    setEffects((prev) => [...prev, newEffect]);
  };

  useEffect(() => {
    if (onAddEffectRef) {
      onAddEffectRef.current = handleAddEffect;
    }
  });

  const handleRemoveEffect = (id: string) => {
    setEffects((prev) => prev.filter((e) => e.id !== id));
    if (activePopoverId === id) setActivePopoverId(null);
  };

  const handleToggleHide = (id: string) => {
    setEffects((prev) =>
      prev.map((e) => (e.id === id ? { ...e, hidden: !e.hidden } : e))
    );
  };

  if (effects.length === 0) {
    return null;
  }

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:w-full ${className}`}>
      {effects.map((effect) => {
        const isDim = Boolean(effect.hidden);
        return (
          <div
            key={effect.id}
            data-k="effects"
            className={`ll-dr ll-rr ll:flex ll:items-center ll:gap-1.5 ll:h-8 ll:px-1 ll:rounded-sm ll:hover:bg-surface-bar ll:transition-colors ${
              isDim ? "ll-rdim ll:opacity-50" : ""
            }`}
          >
            {/* Grip handle */}
            <button
              type="button"
              aria-label="Reorder"
              title="Reorder"
              className="ll-grip ll:w-3 ll:h-6 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:cursor-grab ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={GripVertical} size={12} />
            </button>

            {/* Lead swatch */}
            <button
              type="button"
              aria-label="Settings"
              title="Settings"
              onClick={() =>
                setActivePopoverId(activePopoverId === effect.id ? null : effect.id)
              }
              className="ll-lead ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
            >
              <span
                className="ll-dsw ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
                style={{ backgroundColor: `#${effect.hex}` }}
              />
            </button>

            {/* Effect label */}
            <div className="ll-sum ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0">
              <span className="ll-stx ll:font-sans ll:text-small ll:text-primary ll:truncate">
                {effect.type === "drop-shadow"
                  ? "Drop shadow"
                  : effect.type === "inner-shadow"
                  ? "Inner shadow"
                  : effect.type === "layer-blur"
                  ? "Layer blur"
                  : "Background blur"}
              </span>
            </div>

            {/* Visibility Toggle */}
            <button
              type="button"
              aria-label={effect.hidden ? "Show" : "Hide"}
              title={effect.hidden ? "Show" : "Hide"}
              onClick={() => handleToggleHide(effect.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={effect.hidden ? EyeOff : Eye} size={14} />
            </button>

            {/* Remove Button */}
            <button
              type="button"
              aria-label="Remove"
              title="Remove"
              onClick={() => handleRemoveEffect(effect.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={Minus} size={14} />
            </button>

            {/* Settings Popover */}
            {activePopoverId === effect.id && (
              <RowSettingsPopover
                isOpen={true}
                title="Effect Settings"
                onClose={() => setActivePopoverId(null)}
              >
                <div className="ll:flex ll:flex-col ll:gap-2">
                  <span className="ll:text-nano ll:font-mono ll:text-muted">
                    {effect.type} (#{effect.hex})
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
