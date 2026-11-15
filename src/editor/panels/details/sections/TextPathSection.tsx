"use client";

/**
 * Text on a path (Phase 124). With a text and a shape or path selected: "Put on path". A text on a path has:
 * - Start (% along the path; also a handle on the canvas, and animatable);
 * - Side (along the path, or on its other side);
 * - Align (where the text sits at its start) and Spacing (letter spacing);
 * - "Take off path".
 * Double-click the text on the canvas to edit its words in place.
 */

import React, { useState } from "react";
import { invokeCommand } from "@/core/commands";
import { useLayers } from "@/core/store/useDocumentStore";
import { getDocument } from "@/core/store/documentState";
import { parseTextPath } from "@/core/text/textFeatures";
import { Button } from "@/editor/components/Button";
import { Select } from "@/editor/components/Select";
import { Slider } from "@/editor/components/Slider";
import { NumberField } from "@/editor/components/NumberField";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { OptionGroup, OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

const SIDES = [
  { value: "along", label: "Along" },
  { value: "other", label: "Other side" },
] as const;
const ALIGN = [
  { value: "left", label: "Start at" },
  { value: "center", label: "Centre on" },
  { value: "right", label: "End at" },
];

export const TextPathSection: React.FC<InspectorSectionProps> = ({ selectedId, selectedIds, onUpdateProp, getValue }) => {
  useLayers();
  const [draft, setDraft] = useState<number | null>(null);
  const layers = getDocument().layers;
  const text = selectedId ? layers[selectedId] : undefined;
  if (!text || text.archetype !== "text" || !selectedId) return null;
  const path = parseTextPath(text.properties["typography.textPath"]);
  const other = (selectedIds ?? []).find((id) => id !== selectedId && layers[id] && layers[id].archetype !== "text");
  if (!path) {
    return (
      <OptionGroup>
        <OptionRow label="Path">
          {other ? (
            <Button size="sm" variant="secondary" onClick={() => void invokeCommand("text.attachToPath", { text: selectedId, path: other })}>
              Put on path
            </Button>
          ) : (
            <span className="ll:text-micro ll:text-muted">Select a shape or path too, to put this text on it</span>
          )}
        </OptionRow>
      </OptionGroup>
    );
  }
  const own = text.properties["typography.textPathStart"];
  const start = Math.round((typeof own === "number" ? own / 100 : path.start) * 100);
  return (
    <OptionGroup>
      <OptionRow label="Start">
        <Slider
          ariaLabel="Text start on path"
          min={0}
          max={100}
          step={1}
          unit="%"
          value={draft ?? start}
          onChange={setDraft}
          onCommit={(v) => {
            setDraft(null);
            void invokeCommand("text.setPath", { ids: [selectedId], start: v / 100 });
          }}
          showInput
        />
      </OptionRow>
      <OptionRow label="Side">
        <SegmentedControl size="compact" ariaLabel="Text side of path" options={SIDES} value={path.flip ? "other" : "along"} onChange={(v) => void invokeCommand("text.setPath", { ids: [selectedId], flip: v === "other" })} className="ll:w-full" />
      </OptionRow>
      <OptionRow label="Align">
        <Select size="sm" aria-label="Text align on path" value={String(getValue?.("typography.textAlign") ?? "left")} options={ALIGN} width="100%" onChange={(v) => onUpdateProp?.("typography.textAlign", v)} />
      </OptionRow>
      <OptionRow label="Spacing">
        <NumberField size="sm" aria-label="Letter spacing on path" value={Number(getValue?.("typography.letterSpacing") ?? 0)} step={0.5} onChange={(v) => onUpdateProp?.("typography.letterSpacing", v)} />
      </OptionRow>
      <OptionRow label="">
        <Button size="sm" variant="ghost" onClick={() => void invokeCommand("text.detachFromPath", { ids: [selectedId] })}>
          Take off path
        </Button>
      </OptionRow>
    </OptionGroup>
  );
};
