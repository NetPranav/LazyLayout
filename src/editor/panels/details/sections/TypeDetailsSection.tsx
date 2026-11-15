"use client";

/**
 * Typography depth (Phase 125), for text:
 * - **OpenType**: ligatures, numbers, fractions … as the font has them, a stylistic set, and small caps (the font's
 *   own when it has them);
 * - **Axes**: the variable font's axes as sliders (weight, width, optical size …), here and, when switched on, over the
 *   text on the canvas;
 * - **Shape**: text that fills a shape (with a shape selected too), with its inset;
 * - **Columns**.
 */

import React, { useState } from "react";
import { invokeCommand } from "@/core/commands";
import { useLayers } from "@/core/store/useDocumentStore";
import { getDocument } from "@/core/store/documentState";
import { setLayerProps } from "@/core/editing/editOps";
import { FEATURES, parseFeatures } from "@/core/text/textFeatures";
import { parseTextShape } from "@/core/text/textShape";
import { Checkbox } from "@/editor/components/Checkbox";
import { Select } from "@/editor/components/Select";
import { Slider } from "@/editor/components/Slider";
import { Toggle } from "@/editor/components/Toggle";
import { Button } from "@/editor/components/Button";
import { NumberField } from "@/editor/components/NumberField";
import { useAxesEditStore } from "@/editor/stage/axesEditStore";
import { OptionGroup, OptionRow } from "../options/OptionRow";
import { axisPatch, axisSliders, axisValue } from "../options/typeAxes";
import type { InspectorSectionProps } from "../types";

/** Features the browser turns on by itself: off is what gets stored. */
const ON_BY_DEFAULT = new Set(["liga", "calt"]);
const TOGGLES = FEATURES.filter(([tag]) => !/^ss\d\d$/.test(tag));
const SETS = [{ value: "", label: "None" }, ...Array.from({ length: 20 }, (_, i) => ({ value: `ss${String(i + 1).padStart(2, "0")}`, label: `Set ${i + 1}` }))];

export const TypeDetailsSection: React.FC<InspectorSectionProps> = ({ selectedId, selectedIds }) => {
  useLayers();
  const axesOn = useAxesEditStore((s) => s.layerId === selectedId);
  const showAxes = useAxesEditStore((s) => s.show);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const layers = getDocument().layers;
  const text = selectedId ? layers[selectedId] : undefined;
  if (!text || text.archetype !== "text" || !selectedId) return null;
  const p = text.properties;
  const features = parseFeatures(p["typography.fontFeatures"]);
  const setFeatures = (next: Record<string, boolean>) => setLayerProps([selectedId], { "typography.fontFeatures": Object.keys(next).length ? JSON.stringify(next) : null }, "OpenType features");
  const toggle = (tag: string, on: boolean) => {
    const next = { ...features };
    if (on === ON_BY_DEFAULT.has(tag)) delete next[tag];
    else next[tag] = on;
    setFeatures(next);
  };
  const set = Object.keys(features).find((k) => /^ss\d\d$/.test(k) && features[k]) ?? "";
  const family = typeof p["typography.fontFamily"] === "string" ? String(p["typography.fontFamily"]).split(",")[0].replace(/["']/g, "").trim() : null;
  const axes = axisSliders(family);
  const shape = parseTextShape(p["text.shape"]);
  const other = (selectedIds ?? []).find((id) => id !== selectedId && layers[id] && layers[id].archetype !== "text");

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      <OptionGroup>
        <div role="group" aria-label="OpenType features" className="ll:grid ll:grid-cols-2 ll:gap-x-2 ll:gap-y-1">
          {TOGGLES.map(([tag, label]) => (
            <Checkbox key={tag} aria-label={label} label={label} checked={features[tag] ?? ON_BY_DEFAULT.has(tag)} onChange={(on) => toggle(tag, on)} />
          ))}
          <Checkbox aria-label="Small caps" label="Small caps" checked={p["typography.smallCaps"] === true} onChange={(on) => setLayerProps([selectedId], { "typography.smallCaps": on ? true : null }, "Small caps")} />
        </div>
        <OptionRow label="Stylistic set">
          <Select
            size="sm"
            aria-label="Stylistic set"
            value={set}
            options={SETS}
            width="100%"
            onChange={(v) => {
              const next = Object.fromEntries(Object.entries(features).filter(([k]) => !/^ss\d\d$/.test(k)));
              if (v) next[v] = true;
              setFeatures(next);
            }}
          />
        </OptionRow>
      </OptionGroup>
      <OptionGroup>
        {axes.map((a) => (
          <OptionRow key={a.tag} label={a.name}>
            <Slider ariaLabel={`Font axis ${a.name}`} min={a.min} max={a.max} step={a.tag === "wght" ? 1 : 0.5} value={draft[a.tag] ?? axisValue(p, a)}
              onChange={(v) => setDraft((d) => ({ ...d, [a.tag]: v }))}
              onCommit={(v) => {
                setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== a.tag)));
                setLayerProps([selectedId], axisPatch(getDocument().layers[selectedId].properties, a, v), `Font ${a.name.toLowerCase()}`);
              }}
              showInput
            />
          </OptionRow>
        ))}
        <OptionRow label="On canvas">
          <Toggle size="sm" aria-label="Font axes on canvas" checked={axesOn} onChange={(on) => showAxes(on ? selectedId : null)} />
        </OptionRow>
      </OptionGroup>
      <OptionGroup>
        {shape ? (
          <>
            <OptionRow label="Inset">
              <NumberField size="sm" aria-label="Text inset in shape" value={shape.inset} min={0} max={500} step={1} onChange={(v) => void invokeCommand("text.setShapeInset", { ids: [selectedId], inset: v })} />
            </OptionRow>
            <OptionRow label="">
              <Button size="sm" variant="ghost" onClick={() => void invokeCommand("text.releaseShape", { ids: [selectedId] })}>
                Take out of shape
              </Button>
            </OptionRow>
          </>
        ) : (
          <>
            <OptionRow label="Shape">
              {other ? (
                <Button size="sm" variant="secondary" onClick={() => void invokeCommand("text.fillShape", { text: selectedId, shape: other })}>
                  Fill shape with text
                </Button>
              ) : (
                <span className="ll:text-micro ll:text-muted">Select a shape too, to pour this text into it</span>
              )}
            </OptionRow>
            <OptionRow label="Columns">
              <NumberField size="sm" aria-label="Text columns" value={Number(p["typography.columns"] ?? 1)} min={1} max={8} step={1} onChange={(v) => setLayerProps([selectedId], { "typography.columns": Math.round(v) > 1 ? Math.round(v) : null }, "Columns")} />
            </OptionRow>
            {Number(p["typography.columns"] ?? 1) > 1 && (
              <OptionRow label="Gap">
                <NumberField size="sm" aria-label="Column gap" value={Number(p["typography.columnGap"] ?? 24)} min={0} max={500} step={1} onChange={(v) => setLayerProps([selectedId], { "typography.columnGap": v }, "Column gap")} />
              </OptionRow>
            )}
          </>
        )}
      </OptionGroup>
    </div>
  );
};
