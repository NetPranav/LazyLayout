"use client";
import React from "react";
import { NumberField } from "@/editor/components/NumberField";
import { Button } from "@/editor/components/Button";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Speed (Design track D18): a layer that is animated or driven stretches along its motion, leans into it and blurs by how fast
 * it moves, and settles back when it stops. The amounts follow the speed up to the reference speed. Shown in Motion and Preview.
 */
const TRAIL_FADE = 0.75;

export const SpeedSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, getValue, onUpdateProp, onUpdateProps, className = "" }) => {
  if (!selectedId || isMulti) return null;
  const num = (path: string, fallback: number) => {
    const v = getValue?.(path);
    return typeof v === "number" ? v : fallback;
  };
  const trailing = num("copy.delay", 0) > 0 && num("repeat.count", 1) > 1 && num("repeat.x", 0) === 0 && num("repeat.y", 0) === 0;
  const field = (label: string, path: string, fallback: number, title: string, opts: { min?: number; step?: number } = {}) => (
    <NumberField size="sm" aria-label={label} title={title} value={num(path, fallback)} min={opts.min} step={opts.step ?? 0.1} onChange={(v) => onUpdateProp?.(path, v)} />
  );
  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`}>
      <OptionRow label="Stretch">{field("Speed stretch", "speed.stretch", 0, "How much longer the layer gets along its motion at the reference speed: 1 is twice as long. It is squashed across so it keeps its size.", { min: 0, step: 0.1 })}</OptionRow>
      <OptionRow label="Lean">{field("Speed lean", "speed.lean", 0, "Degrees the layer leans toward the side it moves, at the reference speed (negative: away).", { step: 1 })}</OptionRow>
      <OptionRow label="Blur">{field("Speed blur", "speed.blur", 0, "Seconds of smear: the blur is as long as the layer travels in this time. 0.02 is a light blur.", { min: 0, step: 0.005 })}</OptionRow>
      <OptionRow label="Full at">{field("Speed reference", "speed.ref", 1200, "The speed, in px per second, at which the effects are at full strength. Slower is proportionally less; a layer at rest is left alone.", { min: 1, step: 100 })}</OptionRow>
      <OptionRow label="Trail">
        <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
          <NumberField size="sm" aria-label="Trail copies" title="How many echoes follow the layer." value={Math.max(0, num("repeat.count", 1) - 1)} min={0} step={1} precision={0} onChange={(v) => onUpdateProps?.({ "repeat.count": Math.min(30, Math.max(0, Math.round(v))) + 1, "repeat.x": 0, "repeat.y": 0, "repeat.opacity": TRAIL_FADE, "copy.delay": num("copy.delay", 0) > 0 ? num("copy.delay", 0) : 0.04 })} />
          <NumberField size="sm" aria-label="Trail gap" title="Seconds each echo runs behind the one before." value={num("copy.delay", 0)} min={0} step={0.01} onChange={(v) => onUpdateProp?.("copy.delay", Math.max(0, v))} />
        </div>
      </OptionRow>
      {trailing && (
        <Button size="sm" aria-label="Remove trail" onClick={() => onUpdateProps?.({ "repeat.count": 1, "repeat.opacity": 1, "copy.delay": 0 })}>
          Remove trail
        </Button>
      )}
    </div>
  );
};
