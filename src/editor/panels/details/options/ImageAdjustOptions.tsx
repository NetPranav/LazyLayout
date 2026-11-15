"use client";

/**
 * A picture's adjustments (Phase 122), for an image layer or an image fill. The seven adjustments, a simple curve, a
 * duotone, sharpen and blur, with presets, and "Show original" to see the picture as it is without losing any of
 * it. Nothing here changes the picture's file. A slider writes one undo step when it is let go.
 */

import React, { useState } from "react";
import { invokeCommand } from "@/core/commands";
import { useLayers } from "@/core/store/useDocumentStore";
import { ADJUSTMENT_KEYS, ADJUSTMENT_PRESETS, NO_ADJUSTMENTS, type ImageAdjustments } from "@/core/paint/color";
import { CURVE_INPUTS, LOOK_PRESETS, type ImageLook } from "@/core/paint/imageLook";
import { imageEditFor } from "@/core/editing/imageEditOps";
import { Select } from "@/editor/components/Select";
import { Slider } from "@/editor/components/Slider";
import { Toggle } from "@/editor/components/Toggle";
import { NumberField } from "@/editor/components/NumberField";
import { RowColorField } from "../controls/RowColorField";
import { OptionGroup, OptionRow } from "./OptionRow";

const LABEL: Record<keyof ImageAdjustments, string> = { exposure: "Exposure", contrast: "Contrast", saturation: "Saturation", temperature: "Temperature", tint: "Tint", highlights: "Highlights", shadows: "Shadows" };
const CURVE_LABEL = ["", "Darks", "Mids", "Lights", ""];
const PRESETS = [
  { value: "", label: "Choose a preset" },
  ...ADJUSTMENT_PRESETS.filter((p) => p.id !== "reset").map((p) => ({ value: `a:${p.id}`, label: p.label })),
  ...LOOK_PRESETS.map((p) => ({ value: `l:${p.id}`, label: p.label })),
  { value: "reset", label: "Reset all" },
];

export const ImageAdjustOptions: React.FC<{ layerId: string; fill?: number }> = ({ layerId, fill }) => {
  useLayers(); // re-read after undo, redo or another panel
  const { adjust, look } = imageEditFor(layerId, fill);
  const a = adjust ?? NO_ADJUSTMENTS;
  const l: ImageLook = look ?? {};
  // a slider being dragged shows its value here, and writes when it is let go
  const [draft, setDraft] = useState<Record<string, number>>({});
  const send = (edit: { adjust?: Partial<ImageAdjustments> | null; look?: ImageLook | null }) => void invokeCommand("image.adjust", { ids: [layerId], ...(fill !== undefined ? { fill } : {}), ...edit });
  const setLook = (patch: Partial<ImageLook>) => {
    const next = { ...l, ...patch };
    for (const k of Object.keys(next) as (keyof ImageLook)[]) if (next[k] === undefined) delete next[k];
    send({ look: next });
  };
  const slider = (key: string, label: string, value: number, min: number, max: number, commit: (v: number) => void) => (
    <OptionRow label={label} key={key}>
      <Slider
        ariaLabel={`Image ${label.toLowerCase()}`}
        min={min}
        max={max}
        step={1}
        value={draft[key] ?? value}
        onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
        onCommit={(v) => {
          setDraft((d) => {
            const { [key]: _, ...rest } = d;
            return rest;
          });
          commit(v);
        }}
        showInput
      />
    </OptionRow>
  );
  const curve = l.curve ?? [...CURVE_INPUTS];
  const duo = l.map && l.map.length === 2 ? l.map : null;

  return (
    <>
      <OptionGroup>
        <OptionRow label="Original">
          <Toggle size="sm" aria-label="Show original" checked={!!l.bypass} onChange={(on) => setLook({ bypass: on || undefined })} />
        </OptionRow>
        <OptionRow label="Preset">
          <Select
            size="sm"
            aria-label="Image preset"
            value=""
            options={PRESETS}
            width="100%"
            onChange={(v) => {
              if (v === "reset") send({ adjust: null, look: null });
              else if (v.startsWith("a:")) send({ adjust: ADJUSTMENT_PRESETS.find((p) => p.id === v.slice(2))?.adjustments ?? null });
              else if (v.startsWith("l:")) setLook({ ...(LOOK_PRESETS.find((p) => p.id === v.slice(2))?.look ?? {}), bypass: undefined });
            }}
          />
        </OptionRow>
      </OptionGroup>
      <OptionGroup>
        {ADJUSTMENT_KEYS.map((k) => slider(k, LABEL[k], Math.round(a[k] * 100), -100, 100, (v) => send({ adjust: { ...a, [k]: v / 100 } })))}
      </OptionGroup>
      <OptionGroup>
        {[1, 2, 3].map((i) => slider(`curve${i}`, CURVE_LABEL[i], Math.round(curve[i] * 100), 0, 100, (v) => setLook({ curve: curve.map((c, j) => (j === i ? v / 100 : c)) })))}
      </OptionGroup>
      <OptionGroup>
        <OptionRow label="Duotone">
          <Toggle
            size="sm"
            aria-label="Duotone"
            checked={!!l.map}
            onChange={(on) => setLook({ map: on ? [{ at: 0, color: "#1b1464" }, { at: 1, color: "#ff5c8a" }] : undefined })}
          />
        </OptionRow>
        {duo && (
          <>
            <OptionRow label="Dark">
              <RowColorField hex={duo[0].color.replace("#", "").toUpperCase()} label="Duotone dark colour picker" hexLabel="Duotone dark hex" onChange={(hex) => setLook({ map: [{ at: 0, color: `#${hex}` }, duo[1]] })} />
            </OptionRow>
            <OptionRow label="Light">
              <RowColorField hex={duo[1].color.replace("#", "").toUpperCase()} label="Duotone light colour picker" hexLabel="Duotone light hex" onChange={(hex) => setLook({ map: [duo[0], { at: 1, color: `#${hex}` }] })} />
            </OptionRow>
          </>
        )}
        {l.map && !duo && <OptionRow label="Map">{`${l.map.length} colours`}</OptionRow>}
        {slider("sharpen", "Sharpen", Math.round((l.sharpen ?? 0) * 100), 0, 100, (v) => setLook({ sharpen: v > 0 ? v / 100 : undefined }))}
        <OptionRow label="Blur">
          <NumberField size="sm" aria-label="Image blur" value={l.blur ?? 0} min={0} max={100} step={1} onChange={(v) => setLook({ blur: v > 0 ? v : undefined })} />
        </OptionRow>
      </OptionGroup>
    </>
  );
};
