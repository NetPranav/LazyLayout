"use client";
import React from "react";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Effector (Design track D10): vary each copy of a Repeat or Clone by a field, so a grid is not uniform. The field gives each
 * copy an influence from 0 to 1, and Scale, Fade and Shift then take the copy from as made (0) to the setting (1).
 */
const MODES = [
  { value: "off", label: "Off", hint: "Every copy alike" },
  { value: "index", label: "Ramp", hint: "From the layer to the last copy" },
  { value: "noise", label: "Noise", hint: "Random, the same every time" },
  { value: "pointer", label: "Pointer", hint: "Near the pointer, while the page runs" },
  { value: "scroll", label: "Scroll", hint: "A wave along the copies as the page scrolls" },
] as const;
const FALLOFFS = [
  { value: "linear", label: "Linear", hint: "Straight down to nothing" },
  { value: "smoothstep", label: "Smooth", hint: "Eases in and out" },
  { value: "gaussian", label: "Soft", hint: "A bell: strong at the centre, a long gentle tail" },
  { value: "inverse-square", label: "Sharp", hint: "Falls off quickly, never quite reaches nothing" },
] as const;

export const EffectorSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, getValue, onUpdateProp, className = "" }) => {
  if (!selectedId || isMulti) return null;
  const num = (path: string, fallback: number) => {
    const v = getValue?.(path);
    return typeof v === "number" ? v : fallback;
  };
  const mode = (getValue?.("effector.mode") as string) || "off";
  const copies = num("repeat.count", 1) > 1 || ((getValue?.("clone.mode") as string) || "off") !== "off";
  const field = (label: string, path: string, fallback: number, title: string, opts: { min?: number; step?: number } = {}) => (
    <NumberField size="sm" aria-label={label} title={title} value={num(path, fallback)} min={opts.min} step={opts.step ?? 1} onChange={(v) => onUpdateProp?.(path, v)} />
  );
  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`}>
      <OptionRow label="Vary by">
        <Select aria-label="Effector mode" size="sm" width="100%" options={MODES} value={mode} onChange={(v) => onUpdateProp?.("effector.mode", v)} />
      </OptionRow>
      {mode !== "off" && !copies && (
        <p className="ll:m-0 ll:text-micro ll:text-muted" role="note">
          Turn on Repeat or Clone first: an effector varies the copies.
        </p>
      )}
      {mode !== "off" && (
        <>
          <OptionRow label="Scale">{field("Effector scale", "effector.scale", 1, "The size of a copy at full influence, as a multiple of its size at none: 2 doubles it, 0.5 halves it.", { min: 0, step: 0.1 })}</OptionRow>
          <OptionRow label="Fade">{field("Effector fade", "effector.fade", 1, "The opacity of a copy at full influence, as a multiple: 0.5 halves it.", { min: 0, step: 0.1 })}</OptionRow>
          <OptionRow label="Colour">{field("Effector hue", "effector.hue", 0, "Turns the colour of a copy at full influence by this many degrees around the colour wheel.", { step: 5 })}</OptionRow>
          <OptionRow label="Shift">
            <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
              {field("Effector shift X", "effector.offsetX", 0, "How far a copy at full influence moves right, in px (negative: left).")}
              {field("Effector shift Y", "effector.offsetY", 0, "How far a copy at full influence moves down, in px (negative: up).")}
            </div>
          </OptionRow>
        </>
      )}
      {mode === "scroll" && (
        <>
          <OptionRow label="Spread">{field("Effector spread", "effector.spread", 3, "How many copies either side of the scroll position still feel it.", { min: 0.5, step: 0.5 })}</OptionRow>
          <OptionRow label="Falloff">
            <Select aria-label="Effector falloff" size="sm" width="100%" options={FALLOFFS} value={(getValue?.("effector.falloff") as string) || "smoothstep"} onChange={(v) => onUpdateProp?.("effector.falloff", v)} />
          </OptionRow>
        </>
      )}
      {mode === "pointer" && (
        <>
          <OptionRow label="Radius">{field("Effector radius", "effector.radius", 200, "How far from the pointer, in px, a copy still feels it.", { min: 1, step: 10 })}</OptionRow>
          <OptionRow label="Falloff">
            <Select aria-label="Effector falloff" size="sm" width="100%" options={FALLOFFS} value={(getValue?.("effector.falloff") as string) || "smoothstep"} onChange={(v) => onUpdateProp?.("effector.falloff", v)} />
          </OptionRow>
        </>
      )}
      {mode === "noise" && <OptionRow label="Seed">{field("Effector seed", "effector.seed", 1, "Another seed gives another random pattern.", { step: 1 })}</OptionRow>}
    </div>
  );
};
