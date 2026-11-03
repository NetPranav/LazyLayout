"use client";

import React, { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { ColorSwatchField } from "@/editor/components/ColorSwatchField";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";
import { RepeatableRow } from "../controls/RepeatableRow";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import {
  INSPECTOR_CONSTANTS,
  EFFECT_TYPE_OPTIONS,
} from "../constants";
import type { InspectorSectionProps, EffectItem } from "../types";

const DEFAULT_EFFECT: EffectItem = {
  id: "effect-default",
  type: "drop-shadow",
  hex: "000000",
  x: 0,
  y: 4,
  blur: 8,
  spread: 0,
  amount: 8,
};

export const EffectsSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const [effects, setEffects] = useState<EffectItem[]>([DEFAULT_EFFECT]);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

  const syncPrimaryToStore = (updatedEffects: EffectItem[]) => {
    const visibleShadow = updatedEffects.find(
      (e) => !e.hidden && (e.type === "drop-shadow" || e.type === "inner-shadow")
    );
    if (visibleShadow) {
      const inset = visibleShadow.type === "inner-shadow" ? "inset " : "";
      const shadowCss = `${inset}${visibleShadow.x}px ${visibleShadow.y}px ${visibleShadow.blur}px ${visibleShadow.spread}px #${visibleShadow.hex}`;
      onUpdateProp?.("appearance.shadow", shadowCss);
      onUpdateProp?.("boxShadow", shadowCss);
    }

    const visibleBlur = updatedEffects.find(
      (e) => !e.hidden && (e.type === "layer-blur" || e.type === "background-blur")
    );
    if (visibleBlur) {
      if (visibleBlur.type === "background-blur") {
        onUpdateProp?.("paint.backgroundBlur", visibleBlur.amount);
      } else {
        onUpdateProp?.("filter.blur", visibleBlur.amount);
      }
    }
  };

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
    const next = [...effects, newEffect];
    setEffects(next);
    setActivePopoverId(newId);
    syncPrimaryToStore(next);
  };

  const handleUpdateEffect = (id: string, patch: Partial<EffectItem>) => {
    const next = effects.map((e) => (e.id === id ? { ...e, ...patch } : e));
    setEffects(next);
    syncPrimaryToStore(next);
  };

  const handleRemoveEffect = (id: string) => {
    const next = effects.filter((e) => e.id !== id);
    setEffects(next);
    if (activePopoverId === id) setActivePopoverId(null);
    syncPrimaryToStore(next);
  };

  const handleToggleHide = (id: string) => {
    const next = effects.map((e) => (e.id === id ? { ...e, hidden: !e.hidden } : e));
    setEffects(next);
    syncPrimaryToStore(next);
  };

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* Header Add Button */}
      <div className="ll:flex ll:items-center ll:justify-between ll:pb-1">
        <span className="ll:text-nano ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted">
          Shadows &amp; Blurs
        </span>
        <IconButton
          size="sm"
          aria-label="Add effect"
          tooltip="Add effect"
          onClick={handleAddEffect}
          icon={<Icon icon={Plus} size={14} />}
        />
      </div>

      {/* Repeatable Effects List */}
      <div className="ll:flex ll:flex-col ll:gap-1.5 ll:w-full">
        {effects.map((effect) => {
          const isOpen = activePopoverId === effect.id;
          const isShadow =
            effect.type === "drop-shadow" || effect.type === "inner-shadow";

          const leadNode = isShadow ? (
            <span
              aria-hidden="true"
              style={{ backgroundColor: `#${effect.hex}` }}
              className="ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-swatch-line ll:shadow-soft"
            />
          ) : (
            <span className="ll:w-5 ll:h-5 ll:flex ll:items-center ll:justify-center ll:text-muted">
              <Icon icon={Sparkles} size={13} />
            </span>
          );

          const typeLabel =
            EFFECT_TYPE_OPTIONS.find((o) => o.value === effect.type)?.label ||
            "Drop shadow";

          const summaryNode = (
            <span className="ll:text-small ll:font-mono ll:text-primary">
              {typeLabel}
            </span>
          );

          return (
            <React.Fragment key={effect.id}>
              <RepeatableRow
                id={effect.id}
                isOpen={isOpen}
                isHidden={effect.hidden}
                leadContent={leadNode}
                leadTitle={`${typeLabel} settings`}
                summaryContent={summaryNode}
                onOpenSettings={() =>
                  setActivePopoverId((prev) => (prev === effect.id ? null : effect.id))
                }
                onToggleHide={() => handleToggleHide(effect.id)}
                onRemove={() => handleRemoveEffect(effect.id)}
              />

              {/* Popover Settings */}
              {isOpen && (
                <RowSettingsPopover
                  title="Effect Settings"
                  isOpen={isOpen}
                  onClose={() => setActivePopoverId(null)}
                >
                  {/* Effect Type Select */}
                  <Select
                    size="sm"
                    label="Type"
                    aria-label="Effect type"
                    value={effect.type}
                    options={EFFECT_TYPE_OPTIONS}
                    onChange={(val) =>
                      handleUpdateEffect(effect.id, {
                        type: val as EffectItem["type"],
                      })
                    }
                  />

                  {/* Shadow settings */}
                  {isShadow && (
                    <div className="ll:flex ll:flex-col ll:gap-2">
                      <ColorSwatchField
                        size="sm"
                        hex={effect.hex}
                        onChangeHex={(hex) =>
                          handleUpdateEffect(effect.id, { hex })
                        }
                      />
                      <div className="ll:grid ll:grid-cols-4 ll:gap-1">
                        <NumberField
                          size="sm"
                          label="X"
                          value={effect.x}
                          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                          onChange={(x) => handleUpdateEffect(effect.id, { x })}
                        />
                        <NumberField
                          size="sm"
                          label="Y"
                          value={effect.y}
                          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                          onChange={(y) => handleUpdateEffect(effect.id, { y })}
                        />
                        <NumberField
                          size="sm"
                          label="B"
                          aria-label="Blur"
                          min={0}
                          value={effect.blur}
                          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                          onChange={(blur) =>
                            handleUpdateEffect(effect.id, { blur })
                          }
                        />
                        <NumberField
                          size="sm"
                          label="S"
                          aria-label="Spread"
                          value={effect.spread}
                          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                          onChange={(spread) =>
                            handleUpdateEffect(effect.id, { spread })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Blur amount setting */}
                  {!isShadow && (
                    <NumberField
                      size="sm"
                      label="Amount"
                      aria-label="Blur amount"
                      min={0}
                      value={effect.amount}
                      step={INSPECTOR_CONSTANTS.STEP_INTEGER}
                      onChange={(amount) =>
                        handleUpdateEffect(effect.id, { amount })
                      }
                    />
                  )}
                </RowSettingsPopover>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
