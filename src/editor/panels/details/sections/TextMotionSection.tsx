"use client";
import React from "react";
import { useStore } from "zustand";
import { Button } from "@/editor/components/Button";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { Toggle } from "@/editor/components/Toggle";
import { documentStore } from "@/core/store/documentState";
import { bindingsOf, removeBinding, setDriversNamed } from "@/core/bindings/bindingCommands";
import { TEXT_FX_MODES } from "@/core/text/textFx";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Text motion (Design track D12, Main 84): scramble, typewriter (with a caret), rotating words and count-up, driven by one Progress
 * value (0 to 1) that a keyframe, a driver or the scroll can move, and a variable-font axis you can animate. The shown text is a
 * function of the progress (the same in the editor and the export); a screen reader reads the full text once.
 */
const LABEL: Record<string, string> = { off: "Off", scramble: "Scramble", typewriter: "Typewriter", rotate: "Rotating words", countup: "Count up" };
const DRIVER = "Text progress with scroll";
const inputClass = "ll-dfield ll:min-w-0 ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-transparent ll:focus:border-primary ll:text-micro ll:text-primary ll:outline-none ll:w-full";

export const TextMotionSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, layer, getValue, onUpdateProp, className = "" }) => {
  useStore(documentStore, (s) => s.document.bindings);
  if (!selectedId || isMulti || layer?.archetype !== "text") return null;
  const str = (p: string) => (typeof getValue?.(p) === "string" ? (getValue?.(p) as string) : "");
  const num = (p: string, d: number) => (typeof getValue?.(p) === "number" ? (getValue?.(p) as number) : d);
  const mode = str("text.fx") || "off";
  const mine = bindingsOf(selectedId).find((b) => b.name === DRIVER);
  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`} data-testid="text-motion-section">
      <OptionRow label="Effect">
        <Select size="sm" aria-label="Text effect" width="100%" options={TEXT_FX_MODES.map((m) => ({ value: m, label: LABEL[m] }))} value={mode} onChange={(v) => onUpdateProp?.("text.fx", v)} />
      </OptionRow>
      {mode !== "off" && (
        <>
          <OptionRow label="Progress">
            <NumberField size="sm" aria-label="Text effect progress" title="How far the effect has played, 0 to 1. Animate it, or drive it from the scroll." value={num("text.fxProgress", 1)} min={0} max={1} step={0.05} onChange={(v) => onUpdateProp?.("text.fxProgress", Math.min(1, Math.max(0, v)))} />
          </OptionRow>
          {mode === "scramble" && (
            <OptionRow label="Seed">
              <NumberField size="sm" aria-label="Scramble seed" title="Which random letters show; the same seed always shows the same." value={num("text.fxSeed", 0)} min={0} step={1} precision={0} onChange={(v) => onUpdateProp?.("text.fxSeed", Math.max(0, Math.round(v)))} />
            </OptionRow>
          )}
          {mode === "typewriter" && (
            <OptionRow label="Caret">
              <Toggle size="sm" aria-label="Typewriter caret" checked={getValue?.("text.fxCaret") === true} onChange={(c) => onUpdateProp?.("text.fxCaret", c)} />
            </OptionRow>
          )}
          {mode === "rotate" && (
            <OptionRow label="Words">
              <input aria-label="Rotating words" placeholder="fast, simple, yours" title="The words to show in turn, separated by commas." defaultValue={str("text.fxWords")} key={str("text.fxWords")} className={inputClass} onBlur={(e) => e.target.value !== str("text.fxWords") && onUpdateProp?.("text.fxWords", e.target.value)} />
            </OptionRow>
          )}
          {mode === "countup" && (
            <OptionRow label="Decimals">
              <NumberField size="sm" aria-label="Count-up decimals" title="Digits after the point. The first number in the text counts up to its value." value={num("text.fxDecimals", 0)} min={0} max={8} step={1} precision={0} onChange={(v) => onUpdateProp?.("text.fxDecimals", Math.min(8, Math.max(0, Math.round(v))))} />
            </OptionRow>
          )}
          <Button
            size="sm"
            aria-label={mine ? "Stop driving the effect from scroll" : "Play the effect with scroll"}
            onClick={() => {
              if (mine) removeBinding(mine.id);
              else
                setDriversNamed(selectedId, DRIVER, [{ expr: { signal: { kind: "view", layer: selectedId, channel: "progress" }, operators: [{ op: "remap", inMin: 0.1, inMax: 0.6, outMin: 0, outMax: 1, clamp: true }] }, target: { kind: "property", on: { kind: "layer", ref: selectedId }, path: "text.fxProgress" }, blend: "add" } as never], "Text effect with scroll");
            }}
          >
            {mine ? "Stop driving from scroll" : "Play with scroll"}
          </Button>
        </>
      )}
      <OptionRow label="Sheen">
        <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
          <NumberField size="sm" aria-label="Text sheen position" title="A band of light crossing the text: 0 at the left to 1 at the right; -1 turns it off. Animate it for a shine that sweeps." value={num("text.sheen", -1)} min={-1} max={1} step={0.1} onChange={(v) => onUpdateProp?.("text.sheen", Math.min(1, Math.max(-1, v)))} />
          <input aria-label="Text sheen colour" type="color" className="ll:h-7 ll:w-full ll:bg-transparent" value={/^#[0-9a-f]{6}$/i.test(str("text.sheenColor")) ? str("text.sheenColor") : "#ffffff"} onChange={(e) => onUpdateProp?.("text.sheenColor", e.target.value)} />
        </div>
      </OptionRow>
      <OptionRow label="Font axis">
        <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
          <input aria-label="Variable font axis" placeholder="wght" title="A variable font axis tag: wght (weight), wdth (width), slnt (slant), opsz (optical size)." defaultValue={str("text.axis")} key={str("text.axis")} className={inputClass} onBlur={(e) => e.target.value.trim() !== str("text.axis") && onUpdateProp?.("text.axis", e.target.value.trim())} />
          <NumberField size="sm" aria-label="Variable font axis value" title="The axis value. Animate it for a weight or width that moves." value={num("text.axisValue", 400)} step={10} onChange={(v) => onUpdateProp?.("text.axisValue", v)} />
        </div>
      </OptionRow>
    </div>
  );
};
