"use client";
import React, { useState } from "react";
import { Minus, Pencil } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { Toggle } from "@/editor/components/Toggle";
import { useDocument } from "@/core/store/useDocumentStore";
import { useStateEditStore } from "@/core/states/stateEdit";
import { BUILT_IN_STATES, statesOf } from "@/core/states/states";
import { tryRunCommand } from "@/core/commands";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * States (Design track D15, Main 78): a layer's hover, pressed and focus looks, and any custom state. Picking a state makes
 * every control (and the canvas) edit that state, and keeps only the difference from the base. "Live" shows hover and press
 * on the canvas; Preview always does. Eases in and out in about a tenth of a second (instant with reduced motion).
 */
const LABEL: Record<string, string> = { hover: "Hover", pressed: "Pressed", focus: "Focus" };
const label = (name: string) => LABEL[name] ?? name;

export const LayerStatesSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti }) => {
  const states = useDocument((d) => d.states);
  const editLayer = useStateEditStore((s) => s.layerId);
  const editName = useStateEditStore((s) => s.name);
  const live = useStateEditStore((s) => s.live);
  const setLive = useStateEditStore((s) => s.setLive);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");

  if (!selectedId || isMulti) return <p className="ll:m-0 ll:text-micro ll:text-text-muted">Select one layer to give it states.</p>;
  const rows = statesOf({ states }, selectedId);
  const have = new Set(rows.map((r) => r.name));
  const editing = editLayer === selectedId ? editName : null;

  const run = (id: string, args: Record<string, unknown>) => {
    const out = tryRunCommand(id, args);
    const inner = out.ok ? (out.result as { ok?: boolean; message?: string } | undefined) : undefined;
    if (!out.ok) setNote(out.message ?? "That did not work.");
    else setNote(inner && inner.ok === false ? (inner.message ?? "That did not work.") : "");
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-2" data-testid="states-section">
      <OptionRow label="Editing">
        <div className="ll:flex ll:flex-wrap ll:gap-1.5">
          <Button size="sm" variant={editing === null ? "primary" : "secondary"} aria-label="Edit the base layer" aria-pressed={editing === null} onClick={() => run("layer.editState", { id: selectedId, name: null })}>
            Base
          </Button>
          {rows.map((r) => (
            <Button key={r.id} size="sm" variant={editing === r.name ? "primary" : "secondary"} aria-label={`Edit state ${label(r.name)}`} aria-pressed={editing === r.name} onClick={() => run("layer.editState", { id: selectedId, name: r.name })}>
              {label(r.name)}
            </Button>
          ))}
        </div>
      </OptionRow>
      {editing && (
        <p className="ll:m-0 ll:flex ll:items-center ll:gap-1.5 ll:text-micro ll:text-primary" role="status">
          <Icon icon={Pencil} size={12} /> Editing {label(editing)}: only what differs from the base is kept.
        </p>
      )}
      {BUILT_IN_STATES.filter((n) => !have.has(n)).length > 0 && (
        <OptionRow label="Add">
          <div className="ll:flex ll:flex-wrap ll:gap-1.5">
            {BUILT_IN_STATES.filter((n) => !have.has(n)).map((n) => (
              <Button key={n} size="sm" aria-label={`Add ${label(n)} state`} onClick={() => run("layer.addState", { id: selectedId, name: n })}>
                {label(n)}
              </Button>
            ))}
          </div>
        </OptionRow>
      )}
      <OptionRow label="Custom">
        <div className="ll:flex ll:gap-1.5 ll:w-full">
          <input
            aria-label="Custom state name"
            title="A name for your own state, such as open or loading. It is shown by picking it."
            spellCheck={false}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="ll-dfield ll:flex-1 ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-transparent ll:focus:border-primary ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
          />
          <Button
            size="sm"
            aria-label="Add custom state"
            onClick={() => {
              if (!custom.trim()) return;
              run("layer.addState", { id: selectedId, name: custom.trim() });
              setCustom("");
            }}
          >
            Add
          </Button>
        </div>
      </OptionRow>
      {rows.length > 0 && (
        <OptionRow label="Remove">
          <div className="ll:flex ll:flex-wrap ll:gap-1.5">
            {rows.map((r) => (
              <Button key={r.id} size="sm" aria-label={`Remove state ${label(r.name)}`} onClick={() => run("layer.removeState", { id: selectedId, name: r.name })}>
                <Icon icon={Minus} size={12} /> {label(r.name)}
              </Button>
            ))}
          </div>
        </OptionRow>
      )}
      <OptionRow label="Live">
        <Toggle size="sm" aria-label="Show states live on the canvas" checked={live} onChange={setLive} />
      </OptionRow>
      {note && (
        <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">
          {note}
        </p>
      )}
    </div>
  );
};
