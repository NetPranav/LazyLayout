"use client";

/**
 * A stroke's width along its length (Phase 119), in the stroke popover. The profile is the layer's, shared by its
 * strokes:
 * - a preset (taper, swell...), one of the file's saved profiles, or a calligraphic nib at an angle;
 * - "On canvas" shows the width handles along the path;
 * - "Save" keeps the current profile in the file under a name, to reuse on any stroke.
 */

import React, { useState } from "react";
import { invokeCommand } from "@/core/commands";
import { useDocument } from "@/core/store/useDocumentStore";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import { Toggle } from "@/editor/components/Toggle";
import { Button } from "@/editor/components/Button";
import { TextField } from "@/editor/components/TextField";
import { OptionGroup, OptionRow } from "./OptionRow";
import { WIDTH_PRESETS, parseWidthProfile, presetLabel, presetProfile, profilePreset } from "@/core/paths/strokes";
import { matchSaved, savedProfilesOf, type SavedWidthProfile } from "@/core/paths/widthProfiles";
import { useWidthEditStore } from "@/editor/stage/widthEditStore";
import type { Layer } from "@/core/document/schema";

const NONE: SavedWidthProfile[] = [];

export const WidthProfileOptions: React.FC<{ layer: Layer }> = ({ layer }) => {
  const saved = useDocument((d) => (d as { widthProfiles?: SavedWidthProfile[] }).widthProfiles ?? NONE);
  const list = savedProfilesOf({ widthProfiles: saved });
  const editing = useWidthEditStore((s) => s.layerId === layer.id);
  const edit = useWidthEditStore((s) => s.edit);
  const stop = useWidthEditStore((s) => s.stop);
  const [nib, setNib] = useState(45);
  const [naming, setNaming] = useState<string | null>(null);
  const profile = parseWidthProfile(layer.properties["stroke.widthProfile"]);
  const preset = profilePreset(profile);
  const match = matchSaved(list, profile);
  const value = preset ? `preset:${preset}` : match ? `saved:${match.id}` : "custom";
  const options = [
    ...WIDTH_PRESETS.map((p) => ({ value: `preset:${p}`, label: presetLabel(p) })),
    ...list.map((p) => ({ value: `saved:${p.id}`, label: p.name })),
    ...(value === "custom" ? [{ value: "custom", label: "Custom" }] : []),
  ];
  const choose = (v: string) => {
    if (v.startsWith("preset:")) void invokeCommand("stroke.set", { ids: [layer.id], widthProfile: presetProfile(v.slice(7) as (typeof WIDTH_PRESETS)[number]) });
    else if (v.startsWith("saved:")) void invokeCommand("stroke.applyWidthProfile", { ids: [layer.id], profile: v.slice(6) });
  };
  const save = () => {
    const name = (naming ?? "").trim();
    if (name) void invokeCommand("stroke.saveWidthProfile", { name, layerId: layer.id });
    setNaming(null);
  };

  return (
    <OptionGroup>
      <OptionRow label="Profile">
        <Select size="sm" aria-label="Width profile" value={value} options={options} onChange={choose} className="ll:w-full" />
      </OptionRow>
      <OptionRow label="Nib">
        <div className="ll:flex ll:items-center ll:gap-1 ll:w-full">
          <NumberField size="sm" aria-label="Nib angle" value={nib} min={-180} max={180} step={5} onChange={setNib} className="ll:w-full" />
          <Button size="sm" variant="secondary" aria-label="Make calligraphic" onClick={() => void invokeCommand("stroke.calligraphic", { ids: [layer.id], angle: nib })}>
            Apply
          </Button>
        </div>
      </OptionRow>
      <OptionRow label="On canvas">
        <Toggle size="sm" aria-label="Edit stroke width on canvas" checked={editing} onChange={(on) => (on ? edit(layer.id) : stop())} />
      </OptionRow>
      <OptionRow label="Saved">
        {naming === null ? (
          <div className="ll:flex ll:items-center ll:gap-1 ll:w-full">
            <Button size="sm" variant="secondary" disabled={!profile} onClick={() => setNaming(`Profile ${list.length + 1}`)}>
              Save profile
            </Button>
            {match && (
              <Button size="sm" variant="ghost" aria-label={`Delete saved profile ${match.name}`} onClick={() => void invokeCommand("stroke.removeWidthProfile", { profile: match.id })}>
                Delete
              </Button>
            )}
          </div>
        ) : (
          <div className="ll:flex ll:items-center ll:gap-1 ll:w-full">
            <TextField
              size="sm"
              aria-label="Width profile name"
              autoFocus
              value={naming}
              onChange={(e) => setNaming(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setNaming(null);
                }
              }}
            />
            <Button size="sm" variant="primary" onClick={save}>
              Save
            </Button>
          </div>
        )}
      </OptionRow>
    </OptionGroup>
  );
};
