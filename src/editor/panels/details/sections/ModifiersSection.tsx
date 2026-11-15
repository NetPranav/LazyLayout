"use client";

import React from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { Toggle } from "@/editor/components/Toggle";
import { addModifier, moveModifier, removeModifier, setModifier } from "@/core/editing/modifierOps";
import { MODIFIER_DEFS, MODIFIER_TYPES, parseModifiers, type Modifier, type ModifierType } from "@/core/paths/modifiers";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

const ADD_OPTIONS = MODIFIER_TYPES.map((t) => ({ value: t, label: MODIFIER_DEFS[t].label }));

/** One modifier's controls: the Simple face, or every parameter when `pro`. */
const ModifierControls: React.FC<{ layerId: string; m: Modifier; pro: boolean }> = ({ layerId, m, pro }) => (
  <>
    {MODIFIER_DEFS[m.type].params
      .filter((d) => pro || d.simple)
      .map((d) => (
        <OptionRow key={d.key} label={d.label}>
          {d.kind === "choice" ? (
            <Select
              size="sm"
              aria-label={`${MODIFIER_DEFS[m.type].label} ${d.label}`}
              value={String(m.params[d.key])}
              options={(d.choices ?? []).map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))}
              onChange={(v) => setModifier(layerId, m.id, { params: { [d.key]: v } })}
              className="ll:w-full"
            />
          ) : (
            <NumberField
              size="sm"
              aria-label={`${MODIFIER_DEFS[m.type].label} ${d.label}`}
              value={Number(m.params[d.key])}
              min={d.min}
              max={d.max}
              suffix={d.unit}
              onChange={(v) => setModifier(layerId, m.id, { params: { [d.key]: v } })}
            />
          )}
        </OptionRow>
      ))}
  </>
);

/**
 * The Modifiers section (Phase 109): an ordered, non-destructive list applied top to bottom to a shape's outline.
 * Add, switch on and off, move up and down, remove; each modifier shows its Simple controls, and every control in
 * the section's More options.
 */
const ModifierList: React.FC<InspectorSectionProps & { pro: boolean }> = ({ selectedId, getValue, pro }) => {
  const id = selectedId ?? "";
  const stack = parseModifiers(getValue?.("shape.modifiers"));
  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full" data-testid={pro ? "modifiers-pro" : "modifiers-section"}>
      {!pro && (
        <Select
          size="sm"
          aria-label="Add modifier"
          placeholder="Add modifier"
          value=""
          options={ADD_OPTIONS}
          onChange={(v) => id && addModifier(id, v as ModifierType)}
          className="ll:w-full"
        />
      )}
      {stack.length === 0 && !pro && <p className="ll:m-0 ll:text-micro ll:text-muted">Modifiers change the shape without editing it: repeat, trim, offset, round.</p>}
      {stack.map((m, i) => (
        <div key={m.id} className="ll:flex ll:flex-col ll:gap-1" data-modifier={m.type}>
          <div className="ll:flex ll:items-center ll:gap-1">
            <Toggle size="sm" aria-label={`${MODIFIER_DEFS[m.type].label} on`} checked={m.on} onChange={(on) => setModifier(id, m.id, { on })} />
            <span className="ll:flex-1 ll:text-small ll:text-primary">{MODIFIER_DEFS[m.type].label}</span>
            <IconButton size="sm" aria-label={`Move ${MODIFIER_DEFS[m.type].label} up`} tooltip="Apply earlier" disabled={i === 0} onClick={() => moveModifier(id, m.id, i - 1)} icon={<Icon icon={ArrowUp} size={12} />} />
            <IconButton size="sm" aria-label={`Move ${MODIFIER_DEFS[m.type].label} down`} tooltip="Apply later" disabled={i === stack.length - 1} onClick={() => moveModifier(id, m.id, i + 1)} icon={<Icon icon={ArrowDown} size={12} />} />
            <IconButton size="sm" aria-label={`Remove ${MODIFIER_DEFS[m.type].label}`} tooltip="Remove" onClick={() => removeModifier(id, m.id)} icon={<Icon icon={X} size={12} />} />
          </div>
          {m.on && <ModifierControls layerId={id} m={m} pro={pro} />}
        </div>
      ))}
    </div>
  );
};

export const ModifiersSection: React.FC<InspectorSectionProps> = (p) => <ModifierList {...p} pro={false} />;
export const ModifiersOptions: React.FC<InspectorSectionProps> = (p) => <ModifierList {...p} pro />;
