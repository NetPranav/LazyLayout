"use client";

/**
 * The brush tool's settings (Phase 120), at the top of the canvas while the brush is the tool:
 * - size and colour;
 * - the brush (a plain band, or one of the stretch and scatter brushes);
 * - what thins and thickens the stroke: Auto (pen pressure, or the mouse's speed), Pressure, Tilt, Speed or None;
 * - smoothing.
 */

import React from "react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { Slider } from "@/editor/components/Slider";
import { RowColorField } from "@/editor/panels/details/controls/RowColorField";
import { PRESETS } from "@/core/paths/brush";
import { WIDTH_SOURCES, type WidthSource } from "@/core/paths/penInput";
import { useBrushToolStore } from "./brushToolStore";

const SOURCE_LABEL: Record<WidthSource, string> = { auto: "Auto", pressure: "Pressure", tilt: "Tilt", speed: "Speed", none: "None" };
const BRUSH_OPTIONS = [{ value: "", label: "Plain" }, ...PRESETS.map((p) => ({ value: p.id, label: p.label }))];
const SOURCE_OPTIONS = WIDTH_SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }));

export const BrushToolBar: React.FC = () => {
  const s = useBrushToolStore();
  return (
    <div
      role="toolbar"
      aria-label="Brush settings"
      data-stage-chrome=""
      // the bar is over the canvas: its presses and clicks are not strokes, and don't end the tool
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="ll:absolute ll:top-3 ll:left-1/2 ll:-translate-x-1/2 ll:z-50 ll:flex ll:items-center ll:gap-2 ll:px-2 ll:py-1.5 ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:text-micro ll:text-secondary"
    >
      <span>Size</span>
      <NumberField size="sm" aria-label="Brush size" value={s.size} min={0.5} max={200} step={1} onChange={(v) => s.set({ size: v })} className="ll:w-16" />
      <div className="ll:w-28">
        <RowColorField hex={s.color.replace("#", "").toUpperCase()} label="Brush colour picker" hexLabel="Brush hex" onChange={(hex) => s.set({ color: `#${hex}` })} />
      </div>
      <Select size="sm" aria-label="Brush" value={s.brush} options={BRUSH_OPTIONS} onChange={(v) => s.set({ brush: v })} className="ll:w-24" />
      <span>Width from</span>
      <Select size="sm" aria-label="Brush width from" value={s.source} options={SOURCE_OPTIONS} onChange={(v) => s.set({ source: v as WidthSource })} className="ll:w-24" />
      <span>Smoothing</span>
      <div className="ll:w-24">
        <Slider ariaLabel="Brush smoothing" min={0} max={100} step={5} value={Math.round(s.smoothing * 100)} onChange={(v) => s.set({ smoothing: v / 100 })} />
      </div>
    </div>
  );
};
