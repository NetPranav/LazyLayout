"use client";
import React, { useState } from "react";
import { Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { Select } from "@/editor/components/Select";
import { Toggle } from "@/editor/components/Toggle";
import { tryRunCommand } from "@/core/commands";
import { instanceRootOf } from "@/core/components/instances";
import { readProperty } from "@/core/components/variantOps";
import { useDocument } from "@/core/store/useDocumentStore";
import type { Layer } from "@/core/document/schema";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Components (Design track D23, Main 46 and 47): make a component from a layer, give it variants (Size: S, M, L; Kind: Primary,
 * Secondary) and exposed properties (text, picture, on/off), put instances of it on the page, and on an instance switch the
 * variant, change the exposed properties, reset overrides or detach it. Every control runs a `component.*` command.
 */
const inputClass = "ll-dfield ll:min-w-0 ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-transparent ll:focus:border-primary ll:text-micro ll:text-primary ll:outline-none";

/** Phase 80: what makes an instance change variant by itself in Preview. */
const TRIGGERS = [
  { value: "none", label: "Nothing" },
  { value: "click", label: "A click", hint: "Each click switches" },
  { value: "hover", label: "Hover", hint: "While the pointer is over it" },
  { value: "press", label: "Press", hint: "While the pointer is down on it" },
];
const NEXT = "__next__";

/** The main component layer that holds `id` (it, or an ancestor), or undefined. */
function mainAround(layers: Record<string, Layer>, id: string): Layer | undefined {
  let cur: Layer | undefined = layers[id];
  for (let i = 0; cur && i < 10_000; i++) {
    if (cur.componentMain) return cur;
    cur = cur.parentId ? layers[cur.parentId] : undefined;
  }
  return undefined;
}

export const ComponentsSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti }) => {
  const layers = useDocument((d) => d.layers);
  const comps = useDocument((d) => d.designComponents);
  const [propName, setPropName] = useState("");
  const [propValues, setPropValues] = useState("");
  const [note, setNote] = useState("");

  const run = (id: string, args: Record<string, unknown>) => {
    const out = tryRunCommand(id, args);
    const r = out.ok ? (out.result as { ok?: boolean; changed?: number; id?: unknown } | undefined) : undefined;
    setNote(!out.ok ? (out.message ?? "That did not work.") : r && (r.ok === false || r.changed === 0 || r.id === null) ? "That did not work: check the name, or that the layer is the right kind." : "");
  };

  if (isMulti) {
    return (
      <div className="ll:flex ll:flex-col ll:gap-2" data-testid="components-section">
        <Button size="sm" aria-label="Combine as variants" onClick={() => run("component.combineAsVariants", {})}>
          Combine as variants
        </Button>
        <p className="ll:m-0 ll:text-micro ll:text-muted">Each selected component becomes one variant of a set.</p>
      </div>
    );
  }
  const layer = selectedId ? layers[selectedId] : undefined;
  if (!layer) return <p className="ll:m-0 ll:text-micro ll:text-muted">Select a layer to make it a component.</p>;

  const rootId = instanceRootOf(layers, layer.id);
  const rootLayer = rootId ? layers[rootId] : undefined;
  const main = mainAround(layers, layer.id);

  // an instance (or a part of one)
  if (rootLayer?.instance) {
    const compId = rootLayer.instance.component;
    const comp = comps?.[compId];
    const variantProps = comp?.variantProps ?? [];
    const chosen = rootLayer.instance.variant ?? {};
    const props = comp?.properties ?? [];
    const overridden = rootLayer.instance.overridden?.length ?? 0;
    const rp = rootLayer.properties;
    const triggerOn = typeof rp["variantTrigger.on"] === "string" && TRIGGERS.some((t) => t.value === rp["variantTrigger.on"]) ? (rp["variantTrigger.on"] as string) : "none";
    const triggerProp = variantProps.find((p) => p.name === rp["variantTrigger.property"]) ?? variantProps[0];
    const triggerValue = typeof rp["variantTrigger.value"] === "string" && triggerProp?.values.includes(rp["variantTrigger.value"] as string) ? (rp["variantTrigger.value"] as string) : "";
    return (
      <div className="ll:flex ll:flex-col ll:gap-2" data-testid="components-section">
        <p className="ll:m-0 ll:text-micro ll:text-primary" role="status">
          Instance of {comp ? (layers[comp.mainId]?.name ?? "a component") : "a component"}
        </p>
        {variantProps.map((p) => (
          <OptionRow key={p.name} label={p.name}>
            <Select size="sm" aria-label={`Variant ${p.name}`} width="100%" options={p.values.map((v) => ({ value: v, label: v }))} value={chosen[p.name] ?? p.values[0]} onChange={(v) => run("component.setVariant", { values: { [p.name]: v }, ids: [rootLayer.id] })} />
          </OptionRow>
        ))}
        {variantProps.length > 0 && (comp?.variants?.length ?? 0) > 1 && (
          <>
            <OptionRow label="Switches on">
              <Select size="sm" aria-label="Variant switches on" width="100%" options={TRIGGERS} value={triggerOn} onChange={(v) => run("component.setVariantTrigger", { id: rootLayer.id, on: v })} />
            </OptionRow>
            {triggerOn !== "none" && variantProps.length > 1 && (
              <OptionRow label="Changes">
                <Select size="sm" aria-label="Variant trigger property" width="100%" options={variantProps.map((p) => ({ value: p.name, label: p.name }))} value={triggerProp.name} onChange={(v) => run("component.setVariantTrigger", { id: rootLayer.id, property: v, value: "" })} />
              </OptionRow>
            )}
            {triggerOn !== "none" && (
              <OptionRow label="Goes to">
                <Select size="sm" aria-label="Variant trigger value" width="100%" options={[{ value: NEXT, label: "The next one" }, ...triggerProp.values.map((v) => ({ value: v, label: v }))]} value={triggerValue === "" ? NEXT : triggerValue} onChange={(v) => run("component.setVariantTrigger", { id: rootLayer.id, value: v === NEXT ? "" : v })} />
              </OptionRow>
            )}
            <p className="ll:m-0 ll:text-micro ll:text-muted">A change of variant moves on this instance&apos;s Transition (below States). {triggerOn !== "none" ? "Try it in Preview, or with the States switch on." : ""}</p>
          </>
        )}
        {props.map((p) => {
          const v = readProperty(rootLayer.id, p.id);
          return (
            <OptionRow key={p.id} label={p.name}>
              {p.type === "boolean" ? (
                <Toggle size="sm" aria-label={`Property ${p.name}`} checked={v !== false} onChange={(c) => run("component.setProperty", { property: p.id, value: c, id: rootLayer.id })} />
              ) : (
                <input key={`${p.id}:${String(v)}`} aria-label={`Property ${p.name}`} defaultValue={typeof v === "string" ? v : ""} className={`${inputClass} ll:w-full`} onBlur={(e) => e.target.value !== v && run("component.setProperty", { property: p.id, value: e.target.value, id: rootLayer.id })} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
              )}
            </OptionRow>
          );
        })}
        <div className="ll:flex ll:flex-wrap ll:gap-1.5">
          <Button size="sm" aria-label="Go to main component" onClick={() => run("component.goToMain", { id: rootLayer.id })}>
            Go to main
          </Button>
          <Button size="sm" aria-label="Reset overrides" disabled={overridden === 0} title="Puts back whatever this instance changed on its own" onClick={() => run("component.resetOverrides", { ids: [rootLayer.id] })}>
            Reset overrides
          </Button>
          <Button size="sm" aria-label="Detach instance" title="Turns the instance into ordinary layers" onClick={() => run("component.detach", { ids: [rootLayer.id] })}>
            Detach
          </Button>
        </div>
        {note && <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">{note}</p>}
      </div>
    );
  }

  // a main component, or a layer inside one
  if (main?.componentMain) {
    const comp = comps?.[main.componentMain];
    const variantProps = comp?.variantProps ?? [];
    const props = comp?.properties ?? [];
    const inside = layer.id !== main.id;
    const exposable: { kind: "text" | "image" | "boolean"; label: string }[] = [
      ...(layer.archetype === "text" ? [{ kind: "text" as const, label: "Text" }] : []),
      ...(layer.archetype === "image" ? [{ kind: "image" as const, label: "Picture" }] : []),
      ...(inside ? [{ kind: "boolean" as const, label: "Visible" }] : []),
    ];
    const addVariant = () => {
      const values = propValues.split(",").map((s) => s.trim()).filter(Boolean);
      if (!propName.trim() || values.length === 0) return;
      run("component.addVariantProperty", { component: main.componentMain, name: propName.trim(), values });
      setPropName("");
      setPropValues("");
    };
    return (
      <div className="ll:flex ll:flex-col ll:gap-2" data-testid="components-section">
        <OptionRow label="Name">
          <input key={`c:${main.name}`} aria-label="Component name" defaultValue={main.name} className={`${inputClass} ll:w-full`} onBlur={(e) => e.target.value.trim() && e.target.value !== main.name && run("component.rename", { component: main.componentMain, name: e.target.value.trim() })} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
        </OptionRow>
        {variantProps.map((p) => (
          <p key={p.name} className="ll:m-0 ll:text-micro" data-variant-prop={p.name}>
            <b>{p.name}</b>: {p.values.join(", ")}
          </p>
        ))}
        <OptionRow label="Variant">
          <div className="ll:flex ll:flex-wrap ll:gap-1.5 ll:w-full">
            <input aria-label="Variant property name" placeholder="Kind" title="A property of the component, such as Size or Kind" value={propName} onChange={(e) => setPropName(e.target.value)} className={`${inputClass} ll:basis-full`} />
            <input aria-label="Variant values" placeholder="Primary, Secondary" title="Its values, separated by commas. Each combination becomes a variant you can edit." value={propValues} onChange={(e) => setPropValues(e.target.value)} className={`${inputClass} ll:basis-full`} />
            <Button size="sm" aria-label="Add variant property" onClick={addVariant}>
              Add variants
            </Button>
          </div>
        </OptionRow>
        {props.map((p) => (
          <div key={p.id} className="ll:flex ll:items-center ll:gap-1.5 ll:text-micro" data-component-property={p.name}>
            <span className="ll:flex-1">{p.name} ({p.type})</span>
            <Button size="sm" aria-label={`Remove property ${p.name}`} onClick={() => run("component.removeProperty", { component: main.componentMain, property: p.id })}>
              <Icon icon={Minus} size={12} />
            </Button>
          </div>
        ))}
        {exposable.length > 0 && (
          <OptionRow label="Expose">
            <div className="ll:flex ll:flex-wrap ll:gap-1.5">
              {exposable.map((e) => (
                <Button key={e.kind} size="sm" aria-label={`Expose ${e.label}`} title="Every instance gets a field for this" onClick={() => run("component.exposeProperty", { kind: e.kind, layer: layer.id })}>
                  {e.label}
                </Button>
              ))}
            </div>
          </OptionRow>
        )}
        <Button size="sm" aria-label="Insert instance" onClick={() => run("component.insert", { component: main.componentMain })}>
          Insert instance
        </Button>
        {note && <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">{note}</p>}
      </div>
    );
  }

  // an ordinary layer
  return (
    <div className="ll:flex ll:flex-col ll:gap-2" data-testid="components-section">
      <Button size="sm" aria-label="Create component" onClick={() => run("component.createFrom", { ids: [layer.id] })}>
        Create component
      </Button>
      <p className="ll:m-0 ll:text-micro ll:text-muted">Turns this layer into a main component you can reuse and give variants.</p>
      {note && <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">{note}</p>}
    </div>
  );
};
