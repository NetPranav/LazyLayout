"use client";

import React, { useState } from "react";
import { Button } from "@/editor/components/Button";
import { Slider } from "@/editor/components/Slider";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { PropertyRow } from "@/editor/components/PropertyRow";
import type { DesignSectionConfig } from "@/editor/shell/right-panel/types";
import type { InspectorSectionProps } from "../types";
import { SURFACE_PRESETS, surfacePreset, type SurfacePresetId } from "../surfacePresets";
import { invokeCommand } from "@/core/commands";

/**
 * The 3D face of the inspector (the right panel's 2D / 3D switch): the same layer's surface settings, presets first.
 * One click on a look gives a finished result; the rows below tune it. Every control writes generic `surface.*`
 * properties, one undo step each.
 */

const SURFACE_ARCHETYPES = new Set(["container", "rectangle", "ellipse"]);

type P = InspectorSectionProps;

const num = (p: P, key: string, dflt: number): number => {
  const v = p.getValue?.(key);
  return typeof v === "number" ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : dflt;
};
const str = (p: P, key: string, dflt: string): string => {
  const v = p.getValue?.(key);
  return typeof v === "string" && v ? v : dflt;
};

/** A labelled slider that writes on release (one undo step) and shows its value while dragging. */
const SliderRow: React.FC<{ p: P; label: string; prop: string; dflt: number; min: number; max: number; step: number; unit?: string; percent?: boolean; title?: string }> = ({ p, label, prop, dflt, min, max, step, unit, percent, title }) => {
  const stored = num(p, prop, dflt);
  const [dragging, setDragging] = useState<number | null>(null);
  const value = dragging ?? stored;
  const shown = percent ? `${Math.round(value * 100)}%` : `${Math.round(value * 100) / 100}${unit ?? ""}`;
  return (
    <div className="ll:flex ll:flex-col ll:gap-1" title={title}>
      <div className="ll:flex ll:items-center ll:justify-between ll:text-small">
        <span className="ll:text-secondary">{label}</span>
        <span className="ll:font-mono ll:text-micro ll:text-muted">{shown}</span>
      </div>
      <Slider
        ariaLabel={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(v) => setDragging(v)}
        onCommit={(v) => {
          setDragging(null);
          p.onUpdateProp?.(prop, v);
        }}
      />
    </div>
  );
};

const Presets: React.FC<{ p: P }> = ({ p }) => {
  const width = num(p, "frame.width", 200);
  const height = num(p, "frame.height", 80);
  const mode = str(p, "surface.mode", "flat");
  return (
    <div className="ll:flex ll:flex-col ll:gap-2">
      <div className="ll:grid ll:grid-cols-2 ll:gap-1.5">
        {SURFACE_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant={preset.id === "balloon" ? "primary" : "default"}
            title={preset.hint}
            data-surface-preset={preset.id}
            onClick={() => p.onUpdateProps?.(surfacePreset(preset.id as SurfacePresetId, width, height, (k) => p.getValue?.(k) ?? null, p.layer?.archetype))}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <p className="ll:text-micro ll:text-muted ll:m-0">
        {mode === "inflated" ? "Inflated. Press it in the Motion tab (or Preview) to see it dent." : "Pick a look to inflate this layer."}
      </p>
    </div>
  );
};

const Shape: React.FC<{ p: P }> = ({ p }) => {
  const method = str(p, "surface.method", "cloth");
  return (
    <div className="ll:flex ll:flex-col ll:gap-3">
      <PropertyRow label="Made by">
        <SegmentedControl
          size="sm"
          ariaLabel="How the shape is made"
          value={method}
          options={[
            { value: "cloth", label: "Cloth", title: "A cloth simulation: real creases and wrinkles (takes a moment)" },
            { value: "quick", label: "Quick", title: "A smooth bulge, instantly" },
          ]}
          onChange={(v) => p.onUpdateProp?.("surface.method", v)}
        />
      </PropertyRow>
      <SliderRow p={p} label="Depth" prop="surface.depth" dflt={22} min={0} max={120} step={1} unit=" px" title="How high it bulges" />
      {method === "cloth" ? (
        <>
          <SliderRow p={p} label="Wrinkles" prop="surface.slack" dflt={0.06} min={0} max={0.15} step={0.005} percent title="Extra material in the sheet: more is more pleats at the seam" />
          <PropertyRow label="Seam">
            <SegmentedControl
              size="sm"
              ariaLabel="Seam"
              value={str(p, "surface.seam", "fixed")}
              options={[
                { value: "fixed", label: "Fixed", title: "The outline stays clean" },
                { value: "free", label: "Pulls in", title: "The edge pulls inwards like a real foil pillow" },
              ]}
              onChange={(v) => p.onUpdateProp?.("surface.seam", v)}
            />
          </PropertyRow>
          <SliderRow p={p} label="Detail" prop="surface.detail" dflt={4} min={2} max={10} step={1} unit=" px" title="Smaller is finer wrinkles (slower)" />
        </>
      ) : (
        <>
          <SliderRow p={p} label="Fullness" prop="surface.fullness" dflt={0.6} min={0} max={1} step={0.05} percent title="A soft dome or a full pillow" />
          <SliderRow p={p} label="Creases" prop="surface.creases" dflt={0.6} min={0} max={1} step={0.05} percent />
          <SliderRow p={p} label="Wrinkles" prop="surface.wrinkles" dflt={0.6} min={0} max={1} step={0.05} percent />
        </>
      )}
      <div className="ll:flex ll:items-center ll:gap-2">
        <Button size="sm" onClick={() => p.onUpdateProp?.("surface.seed", Math.floor(Math.random() * 1000))} title="Another arrangement of the same wrinkles">
          Shuffle wrinkles
        </Button>
      </div>
    </div>
  );
};

const Material: React.FC<{ p: P }> = ({ p }) => (
  <div className="ll:flex ll:flex-col ll:gap-3">
    <PropertyRow label="Material">
      <SegmentedControl
        size="sm"
        ariaLabel="Material"
        value={str(p, "surface.material", "foil")}
        options={[
          { value: "foil", label: "Foil" },
          { value: "plastic", label: "Plastic" },
          { value: "satin", label: "Satin" },
        ]}
        onChange={(v) => p.onUpdateProp?.("surface.material", v)}
      />
    </PropertyRow>
    <SliderRow p={p} label="Gloss" prop="surface.gloss" dflt={0.4} min={0} max={1} step={0.05} percent title="How sharp the studio's reflection is" />
    <p className="ll:text-micro ll:text-muted ll:m-0">The colour is the layer&apos;s fill (2D panel).</p>
  </div>
);

const Press: React.FC<{ p: P }> = ({ p }) => (
  <div className="ll:flex ll:flex-col ll:gap-3">
    <SliderRow p={p} label="Dent depth" prop="surface.dentDepth" dflt={14} min={0} max={60} step={1} unit=" px" />
    <SliderRow p={p} label="Dent size" prop="surface.dentSize" dflt={34} min={4} max={200} step={1} unit=" px" />
    <SliderRow p={p} label="Springiness" prop="surface.damping" dflt={0.35} min={0} max={1} step={0.05} percent title="Lower rings longer after release" />
    <SliderRow p={p} label="Text pull" prop="surface.contentPull" dflt={0.35} min={0} max={1.5} step={0.05} percent title="How much the text is drawn into a press" />
  </div>
);

/** The 3D face's sections for the selection. */
export function getSurfaceSections(p: P): DesignSectionConfig[] {
  const archetype = p.layer?.archetype;
  const reference: DesignSectionConfig = {
    id: "reference",
    title: "Reference",
    children: (
      <div className="ll:flex ll:flex-col ll:gap-2">
        <Button onClick={() => invokeCommand("file.placeReference")}>Place reference image…</Button>
        <p className="ll:text-micro ll:text-muted ll:m-0">A picture to copy from: behind everything, half transparent, locked, never exported.</p>
      </div>
    ),
  };
  if (!archetype || !SURFACE_ARCHETYPES.has(archetype)) {
    return [
      {
        id: "surface-none",
        title: "3D",
        children: <p className="ll:text-small ll:text-muted ll:m-0">3D surfaces work on frames, rectangles and ellipses. Select one (a button is a frame with a label in it).</p>,
      },
      reference,
    ];
  }
  const on = str(p, "surface.mode", "flat") === "inflated";
  return [
    { id: "surface-looks", title: "Looks", children: <Presets p={p} /> },
    ...(on
      ? [
          { id: "surface-shape", title: "Shape", children: <Shape p={p} /> },
          { id: "surface-material", title: "Material & light", children: <Material p={p} /> },
          { id: "surface-press", title: "Press", children: <Press p={p} /> },
        ]
      : []),
    reference,
  ];
}
