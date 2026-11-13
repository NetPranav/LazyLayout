"use client";
import React, { useState } from "react";
import { useStore } from "zustand";
import { Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { Button } from "@/editor/components/Button";
import { tryRunCommand } from "@/core/commands";
import { documentStore } from "@/core/store/documentState";
import { documentCommands } from "@/core/store/useDocumentStore";
import { transformParentChoices } from "@/core/timeline/timelineOps";
import { getLayerParentRef } from "@/core/geometry/parentTransforms";
import { readLinks } from "@/core/links/linkModel";
import { readExpressions } from "@/core/expressions/exprModel";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Parent & links (Design track D5): the new editor's way to the engine Lane B merged (Phases 73, 76, 77). Parent a layer to
 * another (or to a helper) so it follows without jumping; link a property to another layer's property (a multiplier of -1
 * turns it the other way); type an expression. Each is a command, so each is one undo step and refuses a cycle with a message.
 */
const PROPS: Record<string, string> = { "transform.x": "Position X", "transform.y": "Position Y", "transform.rotate": "Rotation", "transform.scale": "Scale", "appearance.opacity": "Opacity" };
const PROP_OPTIONS = Object.entries(PROPS).map(([value, label]) => ({ value, label }));
const NONE = "__none__";

export const ParentLinksSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, className = "" }) => {
  const doc = useStore(documentStore, (s) => s.document); // re-read when anything changes (undo, redo, another panel)
  const [target, setTarget] = useState("transform.rotate");
  const [source, setSource] = useState("");
  const [sourceProp, setSourceProp] = useState("transform.rotate");
  const [factor, setFactor] = useState(-1);
  const [exprProp, setExprProp] = useState("transform.rotate");
  const [exprText, setExprText] = useState("");
  const [message, setMessage] = useState("");
  const layer = selectedId && !isMulti ? doc.layers[selectedId] : undefined;
  if (!layer || !selectedId) return null;

  const others = Object.values(doc.layers).filter((l) => l.id !== selectedId && l.parentId !== null);
  const parentOf = getLayerParentRef(layer) ?? NONE;
  const choices = transformParentChoices(selectedId).map((c) => ({ value: c.id, label: c.name }));
  // the layer's current parent is no longer a "new" valid link, but it must stay in the list so the box shows it
  if (parentOf !== NONE && !choices.some((c) => c.value === parentOf)) choices.push({ value: parentOf, label: doc.layers[parentOf]?.name ?? parentOf });
  const parentOptions = [{ value: NONE, label: "None" }, ...choices];
  const nameOf = (id: string) => doc.layers[id]?.name ?? id;
  const isHelper = layer.properties["render.role"] === "helper";
  const links = readLinks(layer.properties);
  const exprs = readExpressions(layer.properties);
  const chosenSource = source || others[0]?.id || "";

  const run = (id: string, args: unknown) => {
    const out = tryRunCommand(id, args);
    const inner = out.ok ? (out.result as { ok?: boolean; message?: string } | undefined) : undefined;
    setMessage(!out.ok ? (out.message ?? "That did not work.") : inner && inner.ok === false ? (inner.message ?? "That did not work.") : "");
    return out.ok && !(inner && inner.ok === false);
  };

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`}>
      <OptionRow label="Parent">
        <Select
          aria-label="Parent layer"
          size="sm"
          width="100%"
          options={parentOptions}
          value={parentOf}
          onChange={(v) => {
            try {
              documentCommands.setTransformParent(selectedId, v === NONE ? null : v, true, v === NONE ? "Clear parent" : "Set parent");
              setMessage("");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : String(e));
            }
          }}
        />
      </OptionRow>

      <button
        type="button"
        aria-pressed={isHelper}
        aria-label="Helper layer"
        title="A helper is drawn in the editor and left out of Preview and of every export: a null, a guide or a controller that other layers follow."
        onClick={() => documentCommands.updateProps(selectedId, { "render.role": isHelper ? "" : "helper" }, isHelper ? "Make a normal layer" : "Make a helper")}
        className={`ll:h-7 ll:px-2 ll:text-left ll:text-small ll:rounded-sm ll:border ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ${isHelper ? "ll:bg-control-secondary-bg ll:text-primary ll:border-border-active" : "ll:bg-surface-bar ll:text-muted ll:border-border ll:hover:text-primary"}`}
      >
        {isHelper ? "Helper layer: on" : "Make a helper layer"}
      </button>

      {links.map((l) => (
        <div key={`l${l.slot}`} data-link-slot={l.slot} className="ll:flex ll:items-center ll:gap-1.5 ll:min-h-7">
          <span className="ll:flex-1 ll:min-w-0 ll:truncate ll:text-small ll:text-primary" title={`${PROPS[l.target] ?? l.target} follows ${nameOf(l.source)} ${PROPS[l.sourceProperty] ?? l.sourceProperty}`}>
            {PROPS[l.target] ?? l.target} ← {nameOf(l.source)} {PROPS[l.sourceProperty] ?? l.sourceProperty}
            {l.map === "range" && l.inMax !== l.inMin ? ` ×${+((l.outMax - l.outMin) / (l.inMax - l.inMin)).toFixed(3)}` : ""}
          </span>
          <button type="button" aria-label={`Remove link ${PROPS[l.target] ?? l.target}`} title="Remove" onClick={() => run("layer.removeLink", { id: selectedId, slot: l.slot })} className="ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:text-secondary ll:hover:text-primary">
            <Icon icon={Minus} size={14} />
          </button>
        </div>
      ))}
      {others.length > 0 && (
        <>
          <OptionRow label="Link">
            <Select aria-label="Link property" size="sm" width="100%" options={PROP_OPTIONS} value={target} onChange={setTarget} />
          </OptionRow>
          <OptionRow label="Follows">
            <Select aria-label="Link source layer" size="sm" width="100%" options={others.map((l) => ({ value: l.id, label: l.name }))} value={chosenSource} onChange={setSource} />
          </OptionRow>
          <OptionRow label="Its">
            <Select aria-label="Link source property" size="sm" width="100%" options={PROP_OPTIONS} value={sourceProp} onChange={setSourceProp} />
          </OptionRow>
          <OptionRow label="Times">
            <NumberField size="sm" aria-label="Link multiplier" title="Multiplies what it follows. 1 follows it exactly; -1 does the opposite (a ring turns the other way); 0.5 half as much." value={factor} step={0.1} onChange={setFactor} />
          </OptionRow>
          <Button
            size="sm"
            aria-label="Add link"
            onClick={() => run("layer.setLink", { id: selectedId, targetProperty: target, sourceLayerId: chosenSource, sourceProperty: sourceProp, map: "range", inMin: 0, inMax: 1, outMin: 0, outMax: factor, clamp: false })}
          >
            Add link
          </Button>
        </>
      )}

      {exprs.map((e) => (
        <div key={`e${e.slot}`} data-expression-slot={e.slot} className="ll:flex ll:items-center ll:gap-1.5 ll:min-h-7">
          <span className="ll:flex-1 ll:min-w-0 ll:truncate ll:text-small ll:font-mono ll:text-primary" title={e.text}>
            {PROPS[e.target] ?? e.target} = {e.text}
          </span>
          <button type="button" aria-label={`Remove expression ${PROPS[e.target] ?? e.target}`} title="Remove" onClick={() => run("layer.removeExpression", { id: selectedId, slot: e.slot })} className="ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:text-secondary ll:hover:text-primary">
            <Icon icon={Minus} size={14} />
          </button>
        </div>
      ))}
      <OptionRow label="Expression">
        <Select aria-label="Expression property" size="sm" width="100%" options={PROP_OPTIONS} value={exprProp} onChange={setExprProp} />
      </OptionRow>
      <input
        aria-label="Expression text"
        placeholder="time * 40"
        spellCheck={false}
        value={exprText}
        onChange={(e) => setExprText(e.target.value)}
        className="ll-dfield ll:w-full ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-transparent ll:focus:border-primary ll:font-mono ll:text-micro ll:text-primary ll:outline-none ll:placeholder:text-muted"
      />
      <Button
        size="sm"
        aria-label="Set expression"
        onClick={() => {
          if (run("layer.setExpression", { id: selectedId, property: exprProp, text: exprText })) setExprText("");
        }}
      >
        Set expression
      </Button>
      {message && (
        <p role="alert" aria-label="Link or expression error" className="ll:m-0 ll:text-micro ll:text-primary">
          {message}
        </p>
      )}
    </div>
  );
};
