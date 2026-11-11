"use client";
import React, { useState, useEffect } from "react";
import { useLayers } from "@/core/store/useDocumentStore";
import { effectItemsOf, writeEffectItems } from "../hooks/effectsModel";
import { GripVertical, Eye, EyeOff, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { RowSettingsPopover } from "../controls/RowSettingsPopover";
import { RowColorField } from "../controls/RowColorField";
import { OptionGroup, OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps, EffectItem } from "../types";

export interface EffectsSectionProps extends InspectorSectionProps {
  onAddEffectRef?: { current?: () => void };
}

const EFFECT_OPTIONS = [
  { value: "drop-shadow", label: "Drop shadow" },
  { value: "inner-shadow", label: "Inner shadow" },
  { value: "layer-blur", label: "Layer blur" },
  { value: "background-blur", label: "Background blur" },
] as const;

const EFFECT_LABEL: Record<EffectItem["type"], string> = {
  "drop-shadow": "Drop shadow",
  "inner-shadow": "Inner shadow",
  "layer-blur": "Layer blur",
  "background-blur": "Background blur",
};

const FIELD_TITLE: Record<string, string> = {
  X: "Horizontal offset: how far the shadow sits to the right (negative: left).",
  Y: "Vertical offset: how far the shadow sits down (negative: up).",
  B: "Blur: how soft the shadow's edge is.",
  S: "Spread: grows (positive) or shrinks (negative) the shadow before it is blurred.",
  Amt: "Blur amount: how strongly the layer or what is behind it is blurred.",
};

const numberField = (label: string, value: number, onChange: (v: number) => void) => (
  <NumberField
    size="sm"
    title={FIELD_TITLE[label]}
    aria-label={`Effect ${label}`}
    value={value}
    step={1}
    min={label === "B" || label === "Amt" ? 0 : undefined}
    onChange={onChange}
  />
);

export const EffectsSection: React.FC<EffectsSectionProps> = ({
  onAddEffectRef,
  selectedId,
  selectedIds,
  className = "",
}) => {
  useLayers(); // re-read the rows when the document changes (undo, redo, another panel)
  const ids = selectedIds && selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
  const primary = selectedId ?? ids[0] ?? null;
  const stored = effectItemsOf(primary);
  // Hidden blurs are not stored, so their rows live here until the selection changes.
  const [parked, setParked] = useState<EffectItem[]>([]);
  const [parkedFor, setParkedFor] = useState(primary);
  if (parkedFor !== primary) {
    setParkedFor(primary);
    setParked([]);
  }
  const effects: EffectItem[] = [...stored, ...parked];
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

  const commit = (next: EffectItem[]) => {
    if (!primary) return;
    const live = next.filter((e) => !(e.hidden && (e.type === "layer-blur" || e.type === "background-blur")));
    setParked(next.filter((e) => e.hidden && (e.type === "layer-blur" || e.type === "background-blur")));
    writeEffectItems(ids, live, primary);
  };

  const handleAddEffect = () => {
    commit([...effects, { id: "shadow-new", type: "drop-shadow", hex: "000000", x: 0, y: 4, blur: 8, spread: 0, amount: 8 }]);
  };

  useEffect(() => {
    if (onAddEffectRef) {
      onAddEffectRef.current = handleAddEffect;
    }
  });

  const updateEffect = (id: string, patch: Partial<EffectItem>) => {
    if (patch.type) setActivePopoverId(null); // a changed kind moves the row; close its popover
    commit(effects.map((e) => (e.id === id ? { ...e, ...patch, ...(patch.type && (patch.type === "layer-blur" || patch.type === "background-blur") && e.amount === 0 ? { amount: 8 } : {}) } : e)));
  };

  const handleRemoveEffect = (id: string) => {
    commit(effects.filter((e) => e.id !== id));
    if (activePopoverId === id) setActivePopoverId(null);
  };

  const reorderBy = (id: string, steps: number) => {
    const from = effects.findIndex((e) => e.id === id);
    if (from < 0 || steps === 0) return;
    const next = [...effects];
    const [moved] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(next.length, from + steps)), 0, moved);
    commit(next);
  };

  const handleToggleHide = (id: string) => {
    commit(effects.map((e) => (e.id === id ? { ...e, hidden: !e.hidden } : e)));
  };

  if (effects.length === 0) {
    return null;
  }

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-0.5 ll:-mx-1 ${className}`}>
      {effects.map((effect, index) => {
        const isDim = Boolean(effect.hidden);
        const isOpen = activePopoverId === effect.id;
        const effectNum = index + 1;
        const isShadow = effect.type === "drop-shadow" || effect.type === "inner-shadow";
        return (
          <div
            key={effect.id}
            data-k="effects"
            className={`ll-dr ll-rr ll:group ll:flex ll:items-center ll:gap-1 ll:h-8 ll:py-0.5 ll:px-1 ll:rounded-sm ${
              isOpen ? "ll:bg-surface-raised ll:text-primary" : ""
            } ${isDim ? "ll-rdim ll:opacity-50" : ""}`}
          >
            <button
              type="button"
              data-grip
              onPointerDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const target = e.currentTarget;
                target.setPointerCapture(e.pointerId);
                const up = (ev: PointerEvent) => {
                  target.releasePointerCapture(e.pointerId);
                  target.removeEventListener("pointerup", up);
                  reorderBy(effect.id, Math.round((ev.clientY - startY) / 32));
                };
                target.addEventListener("pointerup", up);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault();
                  reorderBy(effect.id, e.key === "ArrowUp" ? -1 : 1);
                }
              }}
              aria-label={`Reorder effect ${effectNum}`}
              title={`Reorder effect ${effectNum}`}
              className="ll-ib ll-grip ll:-ml-4 ll:w-3 ll:h-6 ll:grid ll:place-items-center ll:text-muted ll:cursor-grab ll:opacity-0 ll:group-hover:opacity-100 ll:group-focus-within:opacity-100 ll:transition-opacity ll:duration-100 ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={GripVertical} size={12} />
            </button>

            <button
              type="button"
              data-lead
              aria-label={`Effect ${effectNum} settings`}
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              title={`Effect ${effectNum} settings`}
              onClick={() => setActivePopoverId(isOpen ? null : effect.id)}
              className="ll-lead ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:shrink-0 ll:bg-transparent ll:border-0 ll:p-0 ll:cursor-pointer ll:outline-none ll:hover:bg-surface-hover ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
            >
              <span
                className="ll-dsw ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
                style={{ backgroundColor: `#${effect.hex}` }}
              />
            </button>

            <div className="ll-sum ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0">
              <span className="ll-stx ll:font-sans ll:text-small ll:text-primary ll:truncate">
                {EFFECT_LABEL[effect.type]}
              </span>
            </div>

            <button
              type="button"
              data-eye
              aria-label={effect.hidden ? `Show effect ${effectNum}` : `Hide effect ${effectNum}`}
              title={effect.hidden ? `Show effect ${effectNum}` : `Hide effect ${effectNum}`}
              onClick={() => handleToggleHide(effect.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={effect.hidden ? EyeOff : Eye} size={14} />
            </button>

            <button
              type="button"
              data-rm
              aria-label={`Remove effect ${effectNum}`}
              title={`Remove effect ${effectNum}`}
              onClick={() => handleRemoveEffect(effect.id)}
              className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
            >
              <Icon icon={Minus} size={14} />
            </button>

            <RowSettingsPopover isOpen={isOpen} title="Effects" onClose={() => setActivePopoverId(null)}>
              <OptionGroup>
                <OptionRow label="Type">
                  <Select
                    aria-label="Effect type"
                    options={EFFECT_OPTIONS}
                    value={effect.type}
                    width="100%"
                    size="sm"
                    onChange={(value) => updateEffect(effect.id, { type: value as EffectItem["type"] })}
                  />
                </OptionRow>
                {isShadow ? (
                  <>
                    <OptionRow label="Colour">
                      <RowColorField hex={effect.hex} label="Shadow colour picker" hexLabel="Shadow hex" onChange={(hex) => updateEffect(effect.id, { hex })} />
                    </OptionRow>
                    <OptionRow label="X">{numberField("X", effect.x, (v) => updateEffect(effect.id, { x: v }))}</OptionRow>
                    <OptionRow label="Y">{numberField("Y", effect.y, (v) => updateEffect(effect.id, { y: v }))}</OptionRow>
                    <OptionRow label="Blur">{numberField("B", effect.blur, (v) => updateEffect(effect.id, { blur: v }))}</OptionRow>
                    <OptionRow label="Spread">{numberField("S", effect.spread, (v) => updateEffect(effect.id, { spread: v }))}</OptionRow>
                  </>
                ) : (
                  <OptionRow label="Amount">{numberField("Amt", effect.amount, (v) => updateEffect(effect.id, { amount: v }))}</OptionRow>
                )}
              </OptionGroup>
            </RowSettingsPopover>
          </div>
        );
      })}
    </div>
  );
};
