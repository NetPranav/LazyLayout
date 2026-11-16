"use client";
import React, { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { Toggle } from "@/editor/components/Toggle";
import { tryRunCommand } from "@/core/commands";
import { getPropertyDefinition, isPropertyLegalFor } from "@/core/document/properties";
import { useDocument } from "@/core/store/useDocumentStore";
import { useModeStore } from "@/core/store/useModeStore";
import { groupVariables, isAlias, modesOf, variableTypeForPath, type StyleDef, type Variable, type VariableType } from "@/core/tokens/tokens";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Variables & styles (Design track D22, Main 45 and 47): the token manager in the new editor. Modes (Light, Dark, your own),
 * colour, number, text and on/off variables with a value in each mode, where each is used, binding a layer's properties to
 * them, and text, effect and fill styles made from a layer. Every control runs a `token.*` or `style.*` command, so undo,
 * the code view and the agent bridge see the same edit. Variables are listed by their `group/name`.
 */
const TYPES: { value: VariableType; label: string }[] = [
  { value: "color", label: "Colour" },
  { value: "number", label: "Number" },
  { value: "string", label: "Text" },
  { value: "boolean", label: "On / off" },
];
/** The properties the Bind row offers, with their names. Only the ones legal for the layer and of the variable's type are listed. */
const BINDABLE: [path: string, label: string][] = [
  ["appearance.background.color", "Fill"],
  ["typography.color", "Text colour"],
  ["appearance.border.color", "Border colour"],
  ["appearance.radius", "Corner radius"],
  ["appearance.opacity", "Opacity"],
  ["layout.gap", "Gap"],
  ["layout.padding", "Padding"],
  ["typography.fontSize", "Font size"],
  ["frame.width", "Width"],
  ["frame.height", "Height"],
  ["content.text", "Text"],
  ["visible", "Visible"],
];
const labelOf = (path: string) => BINDABLE.find(([p]) => p === path)?.[1] ?? path;
const inputClass = "ll-dfield ll:min-w-0 ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-transparent ll:focus:border-primary ll:text-micro ll:text-primary ll:outline-none";

type Run = (id: string, args: Record<string, unknown>) => unknown;

const ValueCell: React.FC<{ variable: Variable; modeId: string; modeName: string; run: Run }> = ({ variable, modeId, modeName, run }) => {
  const v = variable.values[modeId];
  const label = `${variable.name} in ${modeName}`;
  const set = (value: unknown) => run("token.updateVariable", { id: variable.id, values: { [modeId]: value } });
  if (isAlias(v)) return <span className="ll:text-micro ll:text-text-muted">alias</span>;
  if (variable.type === "color")
    return <input type="color" aria-label={label} className="ll:h-7 ll:w-10 ll:bg-transparent" value={/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : "#000000"} onChange={(e) => set(e.target.value)} />;
  if (variable.type === "boolean") return <Toggle size="sm" aria-label={label} checked={v === true} onChange={set} />;
  if (variable.type === "string")
    return <input key={`${modeId}:${String(v)}`} aria-label={label} defaultValue={String(v ?? "")} className={`${inputClass} ll:w-28`} onBlur={(e) => e.target.value !== v && set(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />;
  return <NumberField size="sm" aria-label={label} value={typeof v === "number" ? v : 0} step={1} onChange={set} />;
};

export const VariablesSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, selectedIds }) => {
  const variablesMap = useDocument((d) => d.variables);
  const stylesMap = useDocument((d) => d.styles);
  const modeList = useDocument((d) => d.modes);
  const layers = useDocument((d) => d.layers);
  const activeModeId = useModeStore((s) => s.activeModeId);
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<VariableType>("color");
  const [modeName, setModeName] = useState("");
  const [styleName, setStyleName] = useState("");
  const [styleKind, setStyleKind] = useState<"text" | "effect" | "paint">("text");
  const [bindPath, setBindPath] = useState("");
  const [bindVar, setBindVar] = useState("");

  const modes = useMemo(() => modesOf({ modes: modeList }), [modeList]);
  const mode = modes.find((m) => m.id === activeModeId) ?? modes[0];
  const variables = useMemo(() => Object.values(variablesMap ?? {}) as Variable[], [variablesMap]);
  const styles = useMemo(() => Object.values(stylesMap ?? {}) as StyleDef[], [stylesMap]);
  const selectedLayer = selectedId && !isMulti ? layers[selectedId] : undefined;
  const ids = selectedIds && selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];

  /** How many layers (and styles) each variable is used by. */
  const usage = useMemo(() => {
    const out = new Map<string, number>();
    for (const l of Object.values(layers)) for (const b of Object.values(l.tokens ?? {})) if (!b.detached) out.set(b.variable, (out.get(b.variable) ?? 0) + 1);
    for (const s of styles) for (const id of Object.values(s.bound ?? {})) out.set(id, (out.get(id) ?? 0) + 1);
    return out;
  }, [layers, styles]);

  const run: Run = (id, args) => {
    const out = tryRunCommand(id, args);
    if (!out.ok) setNote(out.message ?? "That did not work.");
    else {
      const r = out.result as { ok?: boolean; message?: string; changed?: number } | undefined;
      setNote(r && r.ok === false ? (r.message ?? "That did not work.") : r?.changed === 0 ? "Nothing changed: that property cannot take this variable, or the layer is locked." : "");
    }
    return out.ok ? out.result : undefined;
  };

  const addVariable = () => {
    if (!name.trim() || !mode) return;
    const first = type === "color" ? "#808080" : type === "number" ? 0 : type === "boolean" ? true : "";
    run("token.createVariable", { name: name.trim(), type, values: { [mode.id]: first } });
    setName("");
  };

  // what the Bind row can bind on the selected layer: the properties legal for it, of the chosen variable's type
  const chosen = variables.find((v) => v.id === bindVar);
  const bindable = selectedLayer && chosen ? BINDABLE.filter(([p]) => p === "visible" ? chosen.type === "boolean" : !!getPropertyDefinition(p) && isPropertyLegalFor(p, selectedLayer.archetype as never) && variableTypeForPath(p, getPropertyDefinition(p)?.valueType) === chosen.type) : [];
  const bindings = Object.entries(selectedLayer?.tokens ?? {});

  return (
    <div className="ll:flex ll:flex-col ll:gap-2" data-testid="variables-section">
      <OptionRow label="Mode">
        <div className="ll:flex ll:flex-wrap ll:gap-1.5">
          {modes.map((m) => (
            <span key={m.id} className="ll:inline-flex ll:gap-0.5">
              <Button size="sm" variant={m.id === mode?.id ? "primary" : "secondary"} aria-label={`View ${m.name}`} aria-pressed={m.id === mode?.id} onClick={() => run("token.setMode", { id: m.id })}>
                {m.name}
              </Button>
              {modes.length > 1 && (
                <Button size="sm" aria-label={`Remove mode ${m.name}`} onClick={() => run("token.removeMode", { id: m.id })}>
                  <Icon icon={Minus} size={12} />
                </Button>
              )}
            </span>
          ))}
        </div>
      </OptionRow>
      <OptionRow label="New mode">
        <div className="ll:flex ll:gap-1.5 ll:w-full">
          <input aria-label="New mode name" title="A name for another set of values, such as Dark or Brand B. It starts as a copy of the first." value={modeName} onChange={(e) => setModeName(e.target.value)} className={`${inputClass} ll:flex-1`} />
          <Button size="sm" aria-label="Add mode" onClick={() => modeName.trim() && (run("token.addMode", { name: modeName.trim() }), setModeName(""))}>
            <Icon icon={Plus} size={12} />
          </Button>
        </div>
      </OptionRow>

      <OptionRow label="Variable">
        <div className="ll:flex ll:flex-wrap ll:gap-1.5 ll:w-full">
          <input aria-label="New variable name" title="A name; use / to group, as in brand/primary." value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addVariable()} className={`${inputClass} ll:basis-full`} />
          <Select size="sm" aria-label="New variable type" width={92} options={TYPES} value={type} onChange={(v) => setType(v as VariableType)} />
          <Button size="sm" aria-label="Add variable" onClick={addVariable}>
            <Icon icon={Plus} size={12} />
          </Button>
        </div>
      </OptionRow>

      {groupVariables(variables).map(({ group, items }) => (
        <div key={group} className="ll:flex ll:flex-col ll:gap-1" role="group" aria-label={group || "Ungrouped"}>
          {group && <span className="ll:text-micro ll:text-text-muted">{group}</span>}
          {items.map((v) => {
            const leaf = group ? v.name.slice(group.length + 1) : v.name;
            const used = usage.get(v.id) ?? 0;
            return (
              <div key={v.id} className="ll:flex ll:flex-wrap ll:items-center ll:gap-1.5 ll:pb-1" data-variable-id={v.id}>
                <input
                  key={`n:${v.name}`}
                  aria-label={`Name of ${v.name}`}
                  defaultValue={leaf}
                  className={`${inputClass} ll:basis-full`}
                  onBlur={(e) => {
                    const next = group ? `${group}/${e.target.value.trim()}` : e.target.value.trim();
                    if (e.target.value.trim() && next !== v.name) run("token.updateVariable", { id: v.id, name: next });
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
                {mode && <ValueCell variable={v} modeId={mode.id} modeName={mode.name} run={run} />}
                <span className="ll:flex-1 ll:text-micro ll:text-text-muted ll:whitespace-nowrap" title="Layers and styles that use this variable" data-testid={`used-${v.id}`}>
                  {used === 0 ? "unused" : `${used} used`}
                </span>
                <Button size="sm" aria-label={`Delete ${v.name}`} onClick={() => run("token.deleteVariable", { id: v.id })}>
                  <Icon icon={Minus} size={12} />
                </Button>
              </div>
            );
          })}
        </div>
      ))}
      {variables.length === 0 && <p className="ll:m-0 ll:text-micro ll:text-text-muted">No variables yet. Add one above, then bind a layer to it.</p>}

      {selectedLayer && (
        <>
          <OptionRow label="Bind">
            <div className="ll:flex ll:flex-wrap ll:gap-1.5 ll:w-full">
              <Select size="sm" aria-label="Variable to bind" width="100%" placeholder="Variable" options={variables.map((v) => ({ value: v.id, label: v.name }))} value={bindVar} onChange={(v) => { setBindVar(v); setBindPath(""); }} />
              <Select size="sm" aria-label="Property to bind" width="calc(100% - 64px)" placeholder="Property" options={bindable.map(([p, l]) => ({ value: p, label: l }))} value={bindPath} onChange={setBindPath} />
              <Button size="sm" aria-label="Bind property to variable" onClick={() => bindPath && bindVar && run("token.bind", { path: bindPath, variable: bindVar, ids })}>
                Bind
              </Button>
            </div>
          </OptionRow>
          {bindings.map(([path, b]) => {
            const v = variablesMap?.[b.variable] as Variable | undefined;
            return (
              <div key={path} className="ll:flex ll:items-center ll:gap-1.5 ll:text-micro" data-binding-path={path}>
                <span className="ll:flex-1 ll:truncate" role="status">
                  {b.detached ? `${labelOf(path)} is detached from ${v?.name ?? "a deleted variable"}` : `${labelOf(path)} follows ${v?.name ?? "a deleted variable"}`}
                </span>
                {b.detached ? (
                  <Button size="sm" aria-label={`Re-link ${labelOf(path)}`} onClick={() => run("token.bind", { path, variable: b.variable, ids })}>
                    Re-link
                  </Button>
                ) : (
                  <Button size="sm" aria-label={`Detach ${labelOf(path)}`} title="Keeps the value it shows now, and stops following the variable" onClick={() => run("token.detach", { path, ids })}>
                    Detach
                  </Button>
                )}
                <Button size="sm" aria-label={`Unbind ${labelOf(path)}`} onClick={() => run("token.unbind", { path, ids })}>
                  <Icon icon={Minus} size={12} />
                </Button>
              </div>
            );
          })}
        </>
      )}

      <OptionRow label="Styles">
        <div className="ll:flex ll:flex-wrap ll:gap-1.5 ll:w-full">
          <input aria-label="New style name" title="A name for a style made from the selected layer" value={styleName} onChange={(e) => setStyleName(e.target.value)} className={`${inputClass} ll:basis-full`} />
          <Select size="sm" aria-label="New style kind" width={84} options={[{ value: "text", label: "Text" }, { value: "effect", label: "Effect" }, { value: "paint", label: "Fill" }]} value={styleKind} onChange={(v) => setStyleKind(v as "text" | "effect" | "paint")} />
          <Button size="sm" aria-label="Create style from selection" disabled={!selectedLayer} onClick={() => styleName.trim() && selectedId && (run("style.create", { kind: styleKind, name: styleName.trim(), from: selectedId }), setStyleName(""))}>
            <Icon icon={Plus} size={12} />
          </Button>
        </div>
      </OptionRow>
      {styles.map((s) => (
        <div key={s.id} className="ll:flex ll:items-center ll:gap-1.5 ll:w-full ll:min-w-0" data-style-id={s.id}>
          <span className="ll:flex-1 ll:min-w-0 ll:truncate ll:text-micro">
            {s.name} <span className="ll:text-text-muted">({s.kind === "paint" ? "fill" : s.kind})</span>
          </span>
          <Button size="sm" aria-label={`Apply ${s.name}`} disabled={ids.length === 0} onClick={() => run("style.apply", { id: s.id })} className="ll:shrink-0">
            Apply
          </Button>
          <Button size="sm" aria-label={`Delete style ${s.name}`} onClick={() => run("style.delete", { id: s.id })} className="ll:shrink-0">
            <Icon icon={Minus} size={12} />
          </Button>
        </div>
      ))}

      {note && (
        <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">
          {note}
        </p>
      )}
    </div>
  );
};
