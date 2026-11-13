"use client";
import React from "react";
import { NumberField } from "@/editor/components/NumberField";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Repeat (Design track D8): repeat the layer N times, each copy stepped in position, rotation, scale and opacity, like After
 * Effects' Repeater. The copies are drawn by the renderer from these properties (`repeat.*`), so the canvas, Preview and the
 * export agree. Absolutely placed layers only: a layer inside an auto-layout frame has no fixed place to step from.
 */
export const RepeatSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, getValue, onUpdateProp, className = "" }) => {
  if (!selectedId || isMulti) return null;
  const num = (path: string, fallback: number) => {
    const v = getValue?.(path);
    return typeof v === "number" ? v : fallback;
  };
  const absolute = getValue?.("positioning") === "absolute";
  const count = num("repeat.count", 1);
  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`}>
      <OptionRow label="Copies">
        <NumberField size="sm" aria-label="Repeat count" title="How many in all: 1 is just the layer, 12 is the layer and 11 copies." value={count} min={1} step={1} precision={0} onChange={(v) => onUpdateProp?.("repeat.count", Math.min(500, Math.max(1, Math.round(v))))} />
      </OptionRow>
      {count > 1 && !absolute && (
        <p className="ll:m-0 ll:text-micro ll:text-muted" role="note">
          Copies are drawn for layers placed freely (not inside an auto-layout frame).
        </p>
      )}
      <OptionRow label="Step">
        <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
          <NumberField size="sm" aria-label="Repeat step X" title="Each copy sits this many px further right than the one before (negative: left)." value={num("repeat.x", 0)} step={1} onChange={(v) => onUpdateProp?.("repeat.x", v)} />
          <NumberField size="sm" aria-label="Repeat step Y" title="Each copy sits this many px further down than the one before (negative: up)." value={num("repeat.y", 0)} step={1} onChange={(v) => onUpdateProp?.("repeat.y", v)} />
        </div>
      </OptionRow>
      <OptionRow label="Turn">
        <NumberField size="sm" aria-label="Repeat rotate step" title="Each copy is turned this many degrees more than the one before, about its own centre." value={num("repeat.rotate", 0)} step={1} onChange={(v) => onUpdateProp?.("repeat.rotate", v)} />
      </OptionRow>
      <OptionRow label="Scale">
        <NumberField size="sm" aria-label="Repeat scale step" title="Each copy is this many times the size of the one before: 1 keeps it, 0.9 shrinks it, 1.1 grows it." value={num("repeat.scale", 1)} min={0} step={0.05} onChange={(v) => onUpdateProp?.("repeat.scale", Math.max(0, v))} />
      </OptionRow>
      <OptionRow label="Fade">
        <NumberField size="sm" aria-label="Repeat opacity step" title="Each copy is this many times as opaque as the one before: 1 keeps it, 0.8 fades it." value={num("repeat.opacity", 1)} min={0} step={0.05} onChange={(v) => onUpdateProp?.("repeat.opacity", Math.min(1, Math.max(0, v)))} />
      </OptionRow>
    </div>
  );
};
