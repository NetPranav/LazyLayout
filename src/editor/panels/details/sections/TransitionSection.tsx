"use client";
import React, { useState } from "react";
import { useStore } from "zustand";
import { Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { tryRunCommand } from "@/core/commands";
import { documentStore } from "@/core/store/documentState";
import { statePaths, statesOf } from "@/core/states/states";
import { variantSetOf } from "@/core/components/variantMotion";
import { TRANSITION_OVERRIDES, overridePath, transitionOf } from "@/core/states/transitions";
import { OptionGroup, OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Transition (ROADMAP Phase 79): how the layer moves between its states. A spring by default (it carries its speed
 * through an interruption, so quick hovers and clicks never snap), or a tween; and up to three properties that move
 * on a transition of their own. Every control calls a command (`layer.setTransition`, `layer.setTransitionOverride`).
 */
const TYPES = [
  { value: "spring", label: "Spring", hint: "Keeps its speed when interrupted; can overshoot" },
  { value: "tween", label: "Tween", hint: "A fixed time along a curve" },
];
const CURVES = [
  { value: "power2.out", label: "Ease out" },
  { value: "power2.in", label: "Ease in" },
  { value: "power2.inOut", label: "Ease in and out" },
  { value: "power4.out", label: "Strong ease out" },
  { value: "linear", label: "Linear" },
];
const ADD = "__add__";
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** A property path as words: `appearance.background.color` is "Background color". */
const words = (path: string): string => {
  const parts = path.split(".").slice(-2).join(" ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return parts.charAt(0).toUpperCase() + parts.slice(1);
};

export const TransitionSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, className = "" }) => {
  const doc = useStore(documentStore, (s) => s.document); // re-read on every change (undo, redo, an agent)
  const [message, setMessage] = useState("");
  const layer = selectedId && !isMulti ? doc.layers[selectedId] : undefined;
  if (!layer || !selectedId) return null;
  const variants = !!variantSetOf(doc, selectedId);
  if (statesOf(doc, selectedId).length === 0 && !variants) {
    return (
      <p className={`ll:m-0 ll:text-micro ll:text-muted ${className}`} data-section="transition">
        Add a state (Hover, Pressed) in States, and this is where you choose how the layer moves into it. An instance of a component with variants also gets it, for a change of variant.
      </p>
    );
  }

  const p = layer.properties;
  const spec = transitionOf(p);
  const run = (id: string, args: Record<string, unknown>) => {
    const out = tryRunCommand(id, args);
    const inner = out.ok ? (out.result as { ok?: boolean; message?: string } | undefined) : undefined;
    setMessage(!out.ok ? (out.message ?? "That did not work.") : inner?.ok === false ? (inner.message ?? "That did not work.") : "");
  };
  const set = (args: Record<string, unknown>) => run("layer.setTransition", { ids: [selectedId], ...args });
  const override = (args: Record<string, unknown>) => run("layer.setTransitionOverride", { id: selectedId, ...args });

  const slots = Array.from({ length: TRANSITION_OVERRIDES }, (_, i) => i + 1).filter((n) => typeof p[overridePath(n, "property")] === "string" && p[overridePath(n, "property")] !== "");
  const taken = new Set(slots.map((n) => p[overridePath(n, "property")] as string));
  const free = Array.from(statePaths(doc, selectedId)).filter((path) => !taken.has(path));
  const addOptions = [{ value: ADD, label: "A property of its own…" }, ...free.map((path) => ({ value: path, label: words(path) }))];

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`} data-section="transition">
      <OptionRow label="Type">
        <Select aria-label="Transition type" size="sm" width="100%" options={TYPES} value={spec.type} onChange={(v) => set({ type: v })} />
      </OptionRow>
      <OptionRow label="Time">
        <NumberField size="sm" aria-label="Transition time" title="How long the move takes, in seconds. A spring is nearly there by then and settles just after." value={spec.duration} min={0.01} max={10} step={0.05} suffix="s" onChange={(v) => set({ duration: clamp(v, 0.01, 10) })} />
      </OptionRow>
      {spec.type === "spring" ? (
        <OptionRow label="Bounce">
          <NumberField size="sm" aria-label="Transition bounce" title="How far the spring overshoots: 0 doesn't, 100 swings a lot." value={+(spec.bounce * 100).toFixed(1)} min={0} max={100} step={5} suffix="%" onChange={(v) => set({ bounce: clamp(v, 0, 100) / 100 })} />
        </OptionRow>
      ) : (
        <OptionRow label="Curve">
          <Select aria-label="Transition curve" size="sm" width="100%" options={CURVES} value={spec.curve} onChange={(v) => set({ curve: v })} />
        </OptionRow>
      )}

      {slots.map((n) => {
        const path = p[overridePath(n, "property")] as string;
        const type = p[overridePath(n, "type")] === "tween" ? "tween" : p[overridePath(n, "type")] === "spring" ? "spring" : spec.type;
        const duration = typeof p[overridePath(n, "duration")] === "number" ? (p[overridePath(n, "duration")] as number) : spec.duration;
        const name = words(path);
        return (
          <OptionGroup key={n}>
            <div data-transition-override={path} className="ll:flex ll:items-center ll:gap-1 ll:min-h-7">
              <span className="ll:flex-1 ll:min-w-0 ll:truncate ll:text-small ll:text-primary" title={path}>
                {name}
              </span>
              <button type="button" aria-label={`Remove transition of ${name}`} title="This property moves with the rest again" onClick={() => override({ slot: n, property: null })} className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active">
                <Icon icon={Minus} size={14} />
              </button>
            </div>
            <OptionRow label="Type">
              <Select aria-label={`${name} transition type`} size="sm" width="100%" options={TYPES} value={type} onChange={(v) => override({ slot: n, property: path, type: v })} />
            </OptionRow>
            <OptionRow label="Time">
              <NumberField size="sm" aria-label={`${name} transition time`} value={duration} min={0.01} max={10} step={0.05} suffix="s" onChange={(v) => override({ slot: n, property: path, duration: clamp(v, 0.01, 10) })} />
            </OptionRow>
          </OptionGroup>
        );
      })}
      {slots.length < TRANSITION_OVERRIDES && free.length > 0 && <Select aria-label="Add property transition" size="sm" width="100%" options={addOptions} value={ADD} onChange={(v) => v !== ADD && override({ property: v })} />}
      <p className="ll:m-0 ll:text-micro ll:text-muted">Seen in Preview, and in Design with the States switch on: move the pointer on and off the layer, or click it quickly.</p>
      {message && (
        <p role="alert" aria-label="Transition error" className="ll:m-0 ll:text-micro ll:text-primary">
          {message}
        </p>
      )}
    </div>
  );
};
